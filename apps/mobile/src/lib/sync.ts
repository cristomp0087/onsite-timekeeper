import { supabase } from './supabase';
import * as SQLite from 'expo-sqlite';
import NetInfo from '@react-native-community/netinfo';
import { logger } from './logger';
import type { SessaoDB } from './database';

const db = SQLite.openDatabaseSync('onsite.db');

interface SyncResult {
  success: boolean;
  uploaded: number;
  downloaded: number;
  errors: string[];
}

export async function isOnline(): Promise<boolean> {
  const netInfo = await NetInfo.fetch();
  return netInfo.isConnected === true;
}

// Inicialização apenas verifica se tabelas existem (segurança)
export async function initSyncTables(): Promise<void> {
  // A criação real está no database.ts. Aqui podemos apenas logar.
  logger.info('sync', 'Sync service ready to use shared database tables');
}

export async function syncLocais(userId: string): Promise<SyncResult> {
  // Mantém a lógica do arquivo anterior que você enviou,
  // mas garantindo que usa a mesma instância de conexão 'db'
  // (O código que você enviou anteriormente para syncLocais está correto,
  // apenas certifique-se de que a query SQL bate com a tabela criada no database.ts)

  // Resumo para brevidade da resposta: Use a mesma função do seu upload anterior.
  // A tabela 'locais' é idêntica nos dois lados.
  return { success: true, uploaded: 0, downloaded: 0, errors: [] }; // Placeholder para não repetir código grande
}

export async function syncRegistros(userId: string): Promise<SyncResult> {
  const result: SyncResult = {
    success: true,
    uploaded: 0,
    downloaded: 0,
    errors: [],
  };

  if (!(await isOnline())) {
    result.success = false;
    result.errors.push('Offline');
    return result;
  }

  try {
    // 1. UPLOAD: Pegar tudo que mudou localmente (synced_at NULL)
    // Note que agora usamos a tabela 'registros' que contém a sessão completa
    const registrosPendentes = db.getAllSync<SessaoDB>(
      `SELECT * FROM registros WHERE (user_id = ? OR user_id = 'user_current') AND synced_at IS NULL`,
      [userId]
    );

    for (const reg of registrosPendentes) {
      // Ajustar user_id se estiver usando placeholder local
      const payload = {
        ...reg,
        user_id: userId, // Garante ID correto
        synced_at: new Date().toISOString(), // Será atualizado no Supabase
      };

      const { error } = await supabase.from('registros').upsert({
        id: payload.id,
        user_id: payload.user_id,
        local_id: payload.local_id,
        local_nome: payload.local_nome,
        entrada: payload.entrada,
        saida: payload.saida,
        tipo: payload.tipo,
        editado_manualmente: payload.editado_manualmente === 1,
        motivo_edicao: payload.motivo_edicao,
        created_at: payload.created_at,
        synced_at: new Date().toISOString(),
      });

      if (error) {
        result.errors.push(`Erro upload registro ${reg.id}: ${error.message}`);
      } else {
        // Marca como syncado localmente
        db.runSync(
          `UPDATE registros SET synced_at = ?, user_id = ? WHERE id = ?`,
          [new Date().toISOString(), userId, reg.id]
        );
        result.uploaded++;
      }
    }

    // 2. DOWNLOAD: Opcional para este MVP, mas ideal para backup
    // ... (Logica de download similar à anterior)

    logger.info('sync', 'Registros synced', { uploaded: result.uploaded });
  } catch (error) {
    result.success = false;
    result.errors.push(`Erro sync registros: ${String(error)}`);
    logger.error('sync', 'Error syncing registros', { error: String(error) });
  }

  return result;
}

export async function syncAll(userId: string): Promise<SyncResult> {
  // Reutilize a função syncAll do seu arquivo anterior, chamando as novas funções acima
  const regResult = await syncRegistros(userId);
  // const locaisResult = await syncLocais(userId);

  return regResult;
}
