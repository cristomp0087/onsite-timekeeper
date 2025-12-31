import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import * as SQLite from 'expo-sqlite';
import {
  getLocaisAtivos,
  adicionarLocal,
  getSessoesHoje,
  type SessaoDB,
  type LocalDB,
} from '../lib/database';

const db = SQLite.openDatabaseSync('onsite.db');

interface SyncState {
  isSyncing: boolean;
  lastSyncAt: Date | null;
  isOnline: boolean;
  autoSyncEnabled: boolean;
  
  initialize: () => Promise<void>;
  syncNow: () => Promise<void>;
  syncLocais: () => Promise<void>;
  syncRegistros: () => Promise<void>;
  toggleAutoSync: () => void;
}

let syncInterval: NodeJS.Timeout | null = null;

export const useSyncStore = create<SyncState>((set, get) => ({
  isSyncing: false,
  lastSyncAt: null,
  isOnline: false,
  autoSyncEnabled: true,

  initialize: async () => {
    logger.info('sync', 'Initializing sync store...');

    // Monitorar conexão
    const unsubscribe = NetInfo.addEventListener((state) => {
      const online = state.isConnected && state.isInternetReachable;
      set({ isOnline: online ?? false });

      if (online && get().autoSyncEnabled) {
        logger.info('sync', 'Back online - triggering sync');
        get().syncNow();
      }
    });

    // Verificar conexão inicial
    const state = await NetInfo.fetch();
    const online = state.isConnected && state.isInternetReachable;
    set({ isOnline: online ?? false });

    // Auto-sync a cada 5 minutos (se online e habilitado)
    syncInterval = setInterval(() => {
      if (get().isOnline && get().autoSyncEnabled && !get().isSyncing) {
        logger.debug('sync', 'Auto-sync triggered');
        get().syncNow();
      }
    }, 5 * 60 * 1000); // 5 minutos

    logger.info('sync', 'Sync store initialized', {
      online,
      autoSync: get().autoSyncEnabled,
    });

    // Sync inicial se estiver online
    if (online && get().autoSyncEnabled) {
      get().syncNow();
    }

    return () => {
      unsubscribe();
      if (syncInterval) clearInterval(syncInterval);
    };
  },

  syncNow: async () => {
    const { isSyncing, isOnline } = get();

    if (isSyncing) {
      logger.warn('sync', 'Sync already in progress, skipping');
      return;
    }

    if (!isOnline) {
      logger.warn('sync', 'Device offline, skipping sync');
      return;
    }

    set({ isSyncing: true });

    try {
      logger.info('sync', '🔄 Starting full sync...');

      // 1. Sync locais
      await get().syncLocais();

      // 2. Sync registros
      await get().syncRegistros();

      set({ lastSyncAt: new Date() });
      logger.info('sync', '✅ Full sync completed');
    } catch (error) {
      logger.error('sync', 'Sync failed', { error: String(error) });
    } finally {
      set({ isSyncing: false });
    }
  },

  syncLocais: async () => {
    try {
      logger.info('sync', '📍 Syncing locais...');

      // 1. Get locais locais (SQLite) - TODOS, não só ativos
      const locaisLocalTodos = await db.getAllSync<LocalDB>('SELECT * FROM locais');

      // 2. Get user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        logger.warn('sync', 'User not authenticated, skipping locais sync');
        return;
      }

      // 3. Upload TODOS os locais (incluindo desativados)
      const naoSincronizados = locaisLocalTodos.filter(
        (l) => !l.synced_at || new Date(l.updated_at) > new Date(l.synced_at)
      );

      if (naoSincronizados.length > 0) {
        logger.info('sync', `⬆️ Uploading ${naoSincronizados.length} locais`);

        for (const local of naoSincronizados) {
          const { error } = await supabase.from('locais').upsert({
            id: local.id,
            user_id: user.id,
            nome: local.nome,
            latitude: local.latitude,
            longitude: local.longitude,
            raio: local.raio,
            cor: local.cor,
            ativo: local.ativo === 1, // Propaga soft delete!
            created_at: local.created_at,
            updated_at: local.updated_at,
            synced_at: new Date().toISOString(),
          });

          if (error) {
            logger.error('sync', 'Error uploading local', {
              id: local.id,
              error: error.message,
            });
          } else {
            logger.debug('sync', 'Local uploaded', { 
              id: local.id,
              ativo: local.ativo === 1 
            });
            
            // Marcar como sincronizado no SQLite
            db.runSync(
              'UPDATE locais SET synced_at = ? WHERE id = ?',
              [new Date().toISOString(), local.id]
            );
          }
        }
      }

      // 4. Download locais do servidor
      const { data: locaisRemote, error: downloadError } = await supabase
        .from('locais')
        .select('*')
        .eq('user_id', user.id);

      if (downloadError) {
        logger.error('sync', 'Error downloading locais', {
          error: downloadError.message,
        });
        return;
      }

      // 5. Atualizar/inserir locais remotos no SQLite
      if (locaisRemote && locaisRemote.length > 0) {
        logger.info('sync', `⬇️ Processing ${locaisRemote.length} remote locais`);

        for (const remoteLocal of locaisRemote) {
          const localExistente = locaisLocalTodos.find((l) => l.id === remoteLocal.id);

          if (!localExistente) {
            // Novo local do servidor - inserir
            db.runSync(
              `INSERT INTO locais (id, user_id, nome, latitude, longitude, raio, cor, ativo, created_at, updated_at, synced_at)
               VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
              [
                remoteLocal.id,
                user.id,
                remoteLocal.nome,
                remoteLocal.latitude,
                remoteLocal.longitude,
                remoteLocal.raio,
                remoteLocal.cor || '#3B82F6',
                remoteLocal.ativo ? 1 : 0,
                remoteLocal.created_at,
                remoteLocal.updated_at,
                new Date().toISOString(),
              ]
            );
            logger.debug('sync', 'Remote local inserted', { id: remoteLocal.id });
          } else {
            // Local existente - atualizar se servidor é mais recente
            const remoteNewer = new Date(remoteLocal.updated_at) > new Date(localExistente.updated_at);
            
            if (remoteNewer) {
              db.runSync(
                `UPDATE locais SET nome = ?, latitude = ?, longitude = ?, raio = ?, cor = ?, ativo = ?, updated_at = ?, synced_at = ? WHERE id = ?`,
                [
                  remoteLocal.nome,
                  remoteLocal.latitude,
                  remoteLocal.longitude,
                  remoteLocal.raio,
                  remoteLocal.cor,
                  remoteLocal.ativo ? 1 : 0,
                  remoteLocal.updated_at,
                  new Date().toISOString(),
                  remoteLocal.id,
                ]
              );
              logger.debug('sync', 'Local updated from remote', { id: remoteLocal.id });
            }
          }
        }
      }

      logger.info('sync', '✅ Locais synced');
    } catch (error) {
      logger.error('sync', 'Error syncing locais', { error: String(error) });
      throw error;
    }
  },

  syncRegistros: async () => {
    try {
      logger.info('sync', '📝 Syncing registros...');

      // 1. Get registros locais (SQLite)
      const registrosLocal = await getSessoesHoje();

      // 2. Get user ID
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        logger.warn('sync', 'User not authenticated, skipping registros sync');
        return;
      }

      // 3. Upload registros não sincronizados
      const naoSincronizados = registrosLocal.filter((r) => !r.synced_at);

      if (naoSincronizados.length > 0) {
        logger.info('sync', `⬆️ Uploading ${naoSincronizados.length} registros`);

        for (const registro of naoSincronizados) {
          const { error } = await supabase.from('registros').upsert({
            id: registro.id,
            user_id: user.id,
            local_id: registro.local_id,
            local_nome: registro.local_nome,
            entrada: registro.entrada,
            saida: registro.saida,
            tipo: registro.tipo,
            editado_manualmente: registro.editado_manualmente === 1,
            motivo_edicao: registro.motivo_edicao,
            hash_integridade: registro.hash_integridade,
            cor: registro.cor,
            device_id: registro.device_id,
            created_at: registro.created_at,
            synced_at: new Date().toISOString(),
          });

          if (error) {
            logger.error('sync', 'Error uploading registro', {
              id: registro.id,
              error: error.message,
            });
          } else {
            logger.debug('sync', 'Registro uploaded', { id: registro.id });
            // TODO: Marcar como sincronizado no SQLite
          }
        }
      }

      logger.info('sync', '✅ Registros synced');
    } catch (error) {
      logger.error('sync', 'Error syncing registros', { error: String(error) });
      throw error;
    }
  },

  toggleAutoSync: () => {
    set((state) => {
      const newValue = !state.autoSyncEnabled;
      logger.info('sync', `Auto-sync ${newValue ? 'enabled' : 'disabled'}`);
      return { autoSyncEnabled: newValue };
    });
  },
}));
