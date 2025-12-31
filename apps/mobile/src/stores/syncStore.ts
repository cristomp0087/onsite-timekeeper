/**
 * Sync Store - Gerencia estado de sincronização
 *
 * Localização: apps/mobile/src/stores/syncStore.ts
 */

import { create } from 'zustand';
import {
  syncAll,
  syncLocais,
  syncRegistros,
  isOnline,
  initSyncTables,
} from '../lib/sync';
import { useAuthStore } from './authStore';
import { logger } from '../lib/logger';
import NetInfo from '@react-native-community/netinfo';

interface SyncState {
  // Estado
  isInitialized: boolean;
  isSyncing: boolean;
  lastSyncAt: Date | null;
  pendingCount: number;
  isOnline: boolean;

  // Erros
  lastError: string | null;

  // Actions
  initialize: () => Promise<void>;
  syncNow: () => Promise<boolean>;
  syncLocaisOnly: () => Promise<boolean>;
  syncRegistrosOnly: () => Promise<boolean>;
  checkConnection: () => Promise<boolean>;

  // Internal
  _updatePendingCount: () => void;
}

export const useSyncStore = create<SyncState>((set, get) => ({
  isInitialized: false,
  isSyncing: false,
  lastSyncAt: null,
  pendingCount: 0,
  isOnline: true,
  lastError: null,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      logger.info('syncStore', 'Initializing sync store...');

      // Inicializar tabelas de sync
      await initSyncTables();

      // Verificar conexão inicial
      const online = await isOnline();
      set({ isOnline: online });

      // Listener de conexão
      NetInfo.addEventListener((state) => {
        const wasOffline = !get().isOnline;
        const isNowOnline = state.isConnected === true;

        set({ isOnline: isNowOnline });

        // Se voltou online, tentar sync
        if (wasOffline && isNowOnline) {
          logger.info('syncStore', 'Back online, triggering sync...');
          get().syncNow();
        }
      });

      // Atualizar contagem de pendentes
      get()._updatePendingCount();

      // Sync inicial se online
      if (online) {
        get().syncNow();
      }

      set({ isInitialized: true });
      logger.info('syncStore', 'Sync store initialized');
    } catch (error) {
      logger.error('syncStore', 'Error initializing', { error: String(error) });
      set({ lastError: String(error) });
    }
  },

  syncNow: async () => {
    const { isSyncing, isOnline } = get();

    if (isSyncing) {
      logger.info('syncStore', 'Sync already in progress');
      return false;
    }

    if (!isOnline) {
      logger.info('syncStore', 'Offline, skipping sync');
      return false;
    }

    const user = useAuthStore.getState().user;
    if (!user) {
      logger.info('syncStore', 'No user, skipping sync');
      return false;
    }

    set({ isSyncing: true, lastError: null });

    try {
      logger.info('syncStore', 'Starting sync...');

      const result = await syncAll(user.id);

      set({
        lastSyncAt: new Date(),
        lastError: result.errors.length > 0 ? result.errors.join('; ') : null,
      });

      get()._updatePendingCount();

      logger.info('syncStore', 'Sync completed', {
        success: result.success,
        uploaded: result.uploaded,
        downloaded: result.downloaded,
      });

      return result.success;
    } catch (error) {
      logger.error('syncStore', 'Sync failed', { error: String(error) });
      set({ lastError: String(error) });
      return false;
    } finally {
      set({ isSyncing: false });
    }
  },

  syncLocaisOnly: async () => {
    const user = useAuthStore.getState().user;
    if (!user || !get().isOnline) return false;

    try {
      const result = await syncLocais(user.id);
      get()._updatePendingCount();
      return result.success;
    } catch (error) {
      logger.error('syncStore', 'Sync locais failed', { error: String(error) });
      return false;
    }
  },

  syncRegistrosOnly: async () => {
    const user = useAuthStore.getState().user;
    if (!user || !get().isOnline) return false;

    try {
      const result = await syncRegistros(user.id);
      get()._updatePendingCount();
      return result.success;
    } catch (error) {
      logger.error('syncStore', 'Sync registros failed', {
        error: String(error),
      });
      return false;
    }
  },

  checkConnection: async () => {
    const online = await isOnline();
    set({ isOnline: online });
    return online;
  },

  _updatePendingCount: () => {
    // Contar itens não sincronizados
    // TODO: Implementar contagem do SQLite
    // Por enquanto, deixar 0
    set({ pendingCount: 0 });
  },
}));
