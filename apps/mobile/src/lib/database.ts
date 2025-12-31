import * as SQLite from 'expo-sqlite';
import { logger } from './logger';

const db = SQLite.openDatabaseSync('onsite.db');

// ============================================
// INTERFACES
// ============================================

export interface SessaoDB {
  id: string;
  user_id: string;
  local_id: string;
  local_nome: string | null;
  entrada: string;
  saida: string | null;
  tipo: string;
  editado_manualmente: number;
  motivo_edicao: string | null;
  hash_integridade: string | null;
  cor: string | null;
  device_id: string | null;
  created_at: string;
  synced_at: string | null;
  
  // Campos calculados
  status?: 'ativa' | 'pausada' | 'finalizada';
  duracao_minutos?: number;
}

export interface LocalDB {
  id: string;
  user_id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
  synced_at: string | null;
}

export interface EstatisticasDia {
  total_minutos: number;
  total_sessoes: number;
}

// ============================================
// INICIALIZAÇÃO
// ============================================

export async function initDatabase(): Promise<void> {
  try {
    db.execSync(`
      CREATE TABLE IF NOT EXISTS locais (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        nome TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        raio INTEGER DEFAULT 100,
        cor TEXT,
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT
      )
    `);

    db.execSync(`
      CREATE TABLE IF NOT EXISTS registros (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        local_id TEXT NOT NULL,
        local_nome TEXT,
        entrada TEXT NOT NULL,
        saida TEXT,
        tipo TEXT DEFAULT 'automatico',
        editado_manualmente INTEGER DEFAULT 0,
        motivo_edicao TEXT,
        hash_integridade TEXT,
        cor TEXT,
        device_id TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced_at TEXT
      )
    `);

    logger.info('database', 'Database initialized successfully');
  } catch (error) {
    logger.error('database', 'Failed to init database', { error: String(error) });
  }
}

// ============================================
// LOCAIS - CRUD
// ============================================

export async function adicionarLocal(dados: {
  nome: string;
  latitude: number;
  longitude: number;
  raio?: number;
  cor?: string;
  user_id?: string;
}): Promise<string> {
  const id = generateUUID();
  const agora = new Date().toISOString();
  const userId = dados.user_id || 'user_local';
  const raio = dados.raio || 100;

  try {
    // VALIDAÇÃO 1: Verificar sobreposição com outros locais ativos
    const locaisAtivos = await getLocaisAtivos();
    
    for (const local of locaisAtivos) {
      const distancia = calculateDistanceBetweenPoints(
        dados.latitude,
        dados.longitude,
        local.latitude,
        local.longitude
      );
      
      // Se a distância é menor que a soma dos raios, há sobreposição
      const somaRaios = raio + local.raio;
      
      if (distancia < somaRaios) {
        const erro = `Geofence sobrepõe local "${local.nome}" (distância: ${distancia.toFixed(0)}m, mínimo: ${somaRaios}m)`;
        logger.warn('database', erro);
        throw new Error(erro);
      }
    }

    // VALIDAÇÃO 2: Verificar nome duplicado (case insensitive)
    const nomeDuplicado = locaisAtivos.find(
      (l) => l.nome.toLowerCase() === dados.nome.toLowerCase()
    );
    
    if (nomeDuplicado) {
      throw new Error(`Já existe um local com o nome "${dados.nome}"`);
    }

    db.runSync(
      `INSERT INTO locais (id, user_id, nome, latitude, longitude, raio, cor, ativo, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)`,
      [
        id,
        userId,
        dados.nome,
        dados.latitude,
        dados.longitude,
        raio,
        dados.cor || '#3B82F6',
        agora,
        agora
      ]
    );
    logger.info('database', 'Local adicionado', { id, nome: dados.nome });
    return id;
  } catch (error) {
    logger.error('database', 'Erro ao adicionar local', { error: String(error) });
    throw error;
  }
}

export async function getLocaisAtivos(): Promise<LocalDB[]> {
  try {
    const locais = db.getAllSync<LocalDB>(`SELECT * FROM locais WHERE ativo = 1`);
    logger.info('database', `${locais.length} locais ativos encontrados`);
    return locais;
  } catch (error) {
    logger.error('database', 'Erro ao buscar locais', { error: String(error) });
    return [];
  }
}

export async function getLocalById(id: string): Promise<LocalDB | null> {
  try {
    return db.getFirstSync<LocalDB>(`SELECT * FROM locais WHERE id = ?`, [id]);
  } catch (error) {
    logger.error('database', 'Erro ao buscar local por id', { error: String(error) });
    return null;
  }
}

export async function deleteLocal(id: string): Promise<void> {
  try {
    // SOFT DELETE: marca como inativo ao invés de deletar
    db.runSync(`UPDATE locais SET ativo = 0, updated_at = ? WHERE id = ?`, [
      new Date().toISOString(),
      id
    ]);
    logger.info('database', 'Local desativado (soft delete)', { id });
  } catch (error) {
    logger.error('database', 'Erro ao deletar local', { error: String(error) });
    throw error;
  }
}

export async function updateLocal(id: string, updates: Partial<LocalDB>): Promise<void> {
  try {
    const fields = Object.keys(updates)
      .map(key => `${key} = ?`)
      .join(', ');
    const values = [...Object.values(updates), id];
    
    db.runSync(`UPDATE locais SET ${fields}, updated_at = ? WHERE id = ?`, [
      ...Object.values(updates),
      new Date().toISOString(),
      id
    ]);
    logger.info('database', 'Local atualizado', { id });
  } catch (error) {
    logger.error('database', 'Erro ao atualizar local', { error: String(error) });
    throw error;
  }
}

// ============================================
// REGISTROS & SESSÕES
// ============================================

export async function saveRegistro(dados: {
  local_id: string;
  tipo: 'entrada' | 'saida' | 'pause' | 'resume';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  automatico?: boolean;
}): Promise<string> {
  const uuid = generateUUID();
  const agora = new Date().toISOString();
  const userId = 'user_current';

  try {
    if (dados.tipo === 'entrada') {
      const local = await getLocalById(dados.local_id);

      db.runSync(
        `INSERT INTO registros (id, user_id, local_id, local_nome, entrada, tipo, created_at) 
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          uuid,
          userId,
          dados.local_id,
          local?.nome || 'Local',
          agora,
          dados.automatico ? 'automatico' : 'manual',
          agora
        ]
      );
      logger.info('database', 'Entrada registrada', { id: uuid, local_id: dados.local_id });
      return uuid;

    } else if (dados.tipo === 'saida') {
      const sessaoAberta = await getSessaoAberta(dados.local_id);
      if (sessaoAberta) {
        db.runSync(
          `UPDATE registros SET saida = ?, synced_at = NULL WHERE id = ?`,
          [agora, sessaoAberta.id]
        );
        logger.info('database', 'Saída registrada', { sessao_id: sessaoAberta.id });
        return sessaoAberta.id;
      }
    }
    return uuid;
  } catch (error) {
    logger.error('database', 'Erro ao salvar registro', { error: String(error) });
    throw error;
  }
}

export async function finalizarSessaoComAjuste(
  localId: string,
  registroId: string,
  minutosAjuste: number
): Promise<void> {
  try {
    const sessaoAberta = await getSessaoAberta(localId);
    if (!sessaoAberta) {
      logger.warn('database', 'Nenhuma sessão aberta para finalizar', { localId });
      return;
    }

    const agora = new Date();
    const saidaAjustada = new Date(agora.getTime() + minutosAjuste * 60000).toISOString();

    db.runSync(
      `UPDATE registros SET saida = ?, editado_manualmente = 1, synced_at = NULL WHERE id = ?`,
      [saidaAjustada, sessaoAberta.id]
    );
    logger.info('database', 'Sessão finalizada com ajuste', { 
      id: sessaoAberta.id, 
      ajuste: minutosAjuste 
    });
  } catch (error) {
    logger.error('database', 'Erro ao finalizar com ajuste', { error: String(error) });
    throw error;
  }
}

// Funções mantidas para compatibilidade
export async function iniciarSessao(localId: string, sessaoId: string): Promise<void> {}
export async function finalizarSessao(localId: string, registroId: string): Promise<void> {}
export async function pausarSessao(sessaoId: string): Promise<void> {}
export async function retomarSessao(sessaoId: string): Promise<void> {}

// ============================================
// LEITURAS - SESSÕES
// ============================================

export async function getSessaoAberta(localId: string): Promise<SessaoDB | null> {
  try {
    const row = db.getFirstSync<SessaoDB>(
      `SELECT * FROM registros WHERE local_id = ? AND saida IS NULL ORDER BY entrada DESC LIMIT 1`,
      [localId]
    );
    
    if (row) {
      return {
        ...row,
        status: 'ativa',
        duracao_minutos: calculateDurationSafe(row.entrada, new Date().toISOString())
      };
    }
    return null;
  } catch (error) {
    logger.error('database', 'Erro ao buscar sessão aberta', { error: String(error) });
    return null;
  }
}

export async function getSessaoAtivaGlobal(): Promise<SessaoDB | null> {
  try {
    const row = db.getFirstSync<SessaoDB>(
      `SELECT * FROM registros WHERE saida IS NULL ORDER BY entrada DESC LIMIT 1`
    );
    
    if (row) {
      return {
        ...row,
        status: 'ativa',
        duracao_minutos: calculateDurationSafe(row.entrada, new Date().toISOString())
      };
    }
    return null;
  } catch (error) {
    logger.error('database', 'Erro ao buscar sessão global', { error: String(error) });
    return null;
  }
}

export async function getSessoesHoje(): Promise<SessaoDB[]> {
  try {
    const hoje = new Date().toISOString().split('T')[0];
    const rows = db.getAllSync<SessaoDB>(
      `SELECT * FROM registros WHERE entrada LIKE ? ORDER BY entrada DESC`,
      [`${hoje}%`]
    );

    return rows.map((r) => ({
      ...r,
      status: r.saida ? 'finalizada' : 'ativa',
      duracao_minutos: calculateDurationSafe(
        r.entrada,
        r.saida || new Date().toISOString()
      )
    }));
  } catch (error) {
    logger.error('database', 'Erro ao buscar sessões hoje', { error: String(error) });
    return [];
  }
}

export async function getEstatisticasHoje(): Promise<EstatisticasDia> {
  try {
    const sessoes = await getSessoesHoje();
    const finalizadas = sessoes.filter((s) => s.saida !== null);
    const total = finalizadas.reduce((acc, curr) => acc + (curr.duracao_minutos || 0), 0);
    
    return { 
      total_minutos: total, 
      total_sessoes: finalizadas.length 
    };
  } catch (error) {
    logger.error('database', 'Erro ao calcular estatísticas', { error: String(error) });
    return { total_minutos: 0, total_sessoes: 0 };
  }
}

// ============================================
// HELPERS - UTILITÁRIOS
// ============================================

function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

/**
 * Calcula duração entre duas datas (PROTEGIDO contra NaN)
 */
function calculateDurationSafe(start: string, end: string): number {
  if (!start || !end) {
    return 0;
  }

  try {
    const startTime = new Date(start).getTime();
    const endTime = new Date(end).getTime();

    if (isNaN(startTime) || isNaN(endTime)) {
      logger.warn('database', 'Invalid date in calculateDuration', { start, end });
      return 0;
    }

    const diff = Math.round((endTime - startTime) / 60000);
    return diff > 0 ? diff : 0;
  } catch (error) {
    logger.error('database', 'Error in calculateDuration', { error: String(error) });
    return 0;
  }
}

/**
 * Calcula distância entre dois pontos geográficos (Haversine formula)
 * Retorna distância em METROS
 */
function calculateDistanceBetweenPoints(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Raio da Terra em metros
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return distance;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Formata duração em formato legível (PROTEGIDO contra NaN)
 */
export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined || isNaN(minutes)) {
    return '0min';
  }

  const totalMinutes = Math.floor(Math.max(0, minutes));
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;

  if (h === 0) return `${m}min`;
  return `${h}h ${m}min`;
}

// ============================================
// ALIASES PARA COMPATIBILIDADE
// ============================================

/**
 * Aliases para manter compatibilidade com locationStore.ts
 * que espera estes nomes de funções
 */
export const saveLocal = adicionarLocal;
export const getLocais = getLocaisAtivos;
