#!/bin/bash

# ============================================
# OnSite Flow - Mapa Visual + Pause/Resume
# ============================================

echo "🗺️ Configurando mapa visual e pause/resume..."

# ============================================
# src/lib/geocoding.ts - Busca de Endereços
# ============================================
cat > src/lib/geocoding.ts << 'GEOCODING'
import { logger } from './logger';

export interface GeocodingResult {
  latitude: number;
  longitude: number;
  address: string;
  city?: string;
  country?: string;
}

// Usar Nominatim (OpenStreetMap) - 100% gratuito
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org';

export async function searchAddress(query: string): Promise<GeocodingResult[]> {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}/search?q=${encodeURIComponent(query)}&format=json&limit=5&addressdetails=1`,
      {
        headers: {
          'User-Agent': 'OnSiteFlow/1.0',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    
    return data.map((item: any) => ({
      latitude: parseFloat(item.lat),
      longitude: parseFloat(item.lon),
      address: item.display_name,
      city: item.address?.city || item.address?.town || item.address?.village,
      country: item.address?.country,
    }));
  } catch (error) {
    logger.error('geocoding', 'Error searching address', { error: String(error) });
    return [];
  }
}

export async function reverseGeocode(latitude: number, longitude: number): Promise<string | null> {
  try {
    const response = await fetch(
      `${NOMINATIM_URL}/reverse?lat=${latitude}&lon=${longitude}&format=json`,
      {
        headers: {
          'User-Agent': 'OnSiteFlow/1.0',
        },
      }
    );
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    return data.display_name || null;
  } catch (error) {
    logger.error('geocoding', 'Error reverse geocoding', { error: String(error) });
    return null;
  }
}
GEOCODING

echo "✅ geocoding.ts criado!"

# ============================================
# Atualizar database.ts - Adicionar suporte a PAUSE
# ============================================
cat > src/lib/database.ts << 'DATABASE'
import * as SQLite from 'expo-sqlite';
import { logger } from './logger';

const DB_NAME = 'onsite-flow.db';
let db: SQLite.SQLiteDatabase | null = null;

// ============================================
// Inicializar Banco
// ============================================
export async function initDatabase(): Promise<void> {
  try {
    logger.info('database', 'Initializing SQLite database...');
    
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    logger.info('database', 'Database opened, creating tables...');
    
    // Tabela de locais
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS locais (
        id TEXT PRIMARY KEY NOT NULL,
        nome TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        raio INTEGER NOT NULL DEFAULT 50,
        cor TEXT DEFAULT '#3B82F6',
        endereco TEXT,
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
    
    // Tabela de registros
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS registros (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        tipo TEXT NOT NULL,
        timestamp TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        automatico INTEGER DEFAULT 1,
        observacao TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
    
    // Tabela de sessões - ATUALIZADA com suporte a pause
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY NOT NULL,
        local_id TEXT NOT NULL,
        entrada_id TEXT NOT NULL,
        saida_id TEXT,
        inicio TEXT NOT NULL,
        fim TEXT,
        duracao_minutos INTEGER,
        tempo_pausado_minutos INTEGER DEFAULT 0,
        status TEXT DEFAULT 'ativa',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
    `);
    
    // Tabela de pausas
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS pausas (
        id TEXT PRIMARY KEY NOT NULL,
        sessao_id TEXT NOT NULL,
        inicio TEXT NOT NULL,
        fim TEXT,
        duracao_minutos INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP
      );
    `);
    
    logger.info('database', 'Database initialized successfully');
  } catch (error) {
    logger.error('database', 'Failed to initialize database', { error: String(error) });
    throw error;
  }
}

function getDb(): SQLite.SQLiteDatabase {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.');
  }
  return db;
}

function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

// ============================================
// LOCAIS - CRUD
// ============================================
export interface LocalDB {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  endereco: string | null;
  ativo: number;
  created_at: string;
  updated_at: string;
  synced: number;
}

export async function saveLocal(local: {
  id?: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  endereco?: string;
  ativo: boolean;
}): Promise<string> {
  try {
    const database = getDb();
    const id = local.id || generateId();
    
    await database.runAsync(
      `INSERT OR REPLACE INTO locais (id, nome, latitude, longitude, raio, cor, endereco, ativo, updated_at, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'), 0)`,
      [id, local.nome, local.latitude, local.longitude, local.raio, local.cor, local.endereco ?? null, local.ativo ? 1 : 0]
    );
    
    logger.info('database', 'Local saved', { id, nome: local.nome });
    return id;
  } catch (error) {
    logger.error('database', 'Error saving local', { error: String(error) });
    throw error;
  }
}

export async function getLocais(): Promise<LocalDB[]> {
  try {
    const database = getDb();
    const result = await database.getAllAsync<LocalDB>('SELECT * FROM locais ORDER BY created_at DESC');
    return result || [];
  } catch (error) {
    logger.error('database', 'Error getting locais', { error: String(error) });
    return [];
  }
}

export async function deleteLocal(id: string): Promise<void> {
  try {
    const database = getDb();
    await database.runAsync('DELETE FROM locais WHERE id = ?', [id]);
    logger.info('database', 'Local deleted', { id });
  } catch (error) {
    logger.error('database', 'Error deleting local', { error: String(error) });
  }
}

// ============================================
// REGISTROS - CRUD
// ============================================
export interface RegistroDB {
  id: string;
  local_id: string;
  tipo: 'entrada' | 'saida' | 'pause' | 'resume';
  timestamp: string;
  latitude: number | null;
  longitude: number | null;
  accuracy: number | null;
  automatico: number;
  observacao: string | null;
  created_at: string;
  synced: number;
}

export async function saveRegistro(registro: {
  local_id: string;
  tipo: 'entrada' | 'saida' | 'pause' | 'resume';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  automatico?: boolean;
  observacao?: string;
}): Promise<string> {
  try {
    const database = getDb();
    const id = generateId();
    const timestamp = new Date().toISOString();
    
    await database.runAsync(
      `INSERT INTO registros (id, local_id, tipo, timestamp, latitude, longitude, accuracy, automatico, observacao, synced)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0)`,
      [
        id,
        registro.local_id,
        registro.tipo,
        timestamp,
        registro.latitude ?? null,
        registro.longitude ?? null,
        registro.accuracy ?? null,
        registro.automatico !== false ? 1 : 0,
        registro.observacao ?? null,
      ]
    );
    
    logger.info('database', `Registro saved: ${registro.tipo}`, { id, local_id: registro.local_id });
    return id;
  } catch (error) {
    logger.error('database', 'Error saving registro', { error: String(error) });
    throw error;
  }
}

// ============================================
// SESSÕES - Com suporte a PAUSE
// ============================================
export interface SessaoDB {
  id: string;
  local_id: string;
  entrada_id: string;
  saida_id: string | null;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  tempo_pausado_minutos: number;
  status: 'ativa' | 'pausada' | 'finalizada';
  created_at: string;
  synced: number;
  local_nome?: string;
}

export interface PausaDB {
  id: string;
  sessao_id: string;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
}

export async function iniciarSessao(local_id: string, entrada_id: string): Promise<string> {
  try {
    const database = getDb();
    const id = generateId();
    const inicio = new Date().toISOString();
    
    await database.runAsync(
      `INSERT INTO sessoes (id, local_id, entrada_id, inicio, status, tempo_pausado_minutos, synced)
       VALUES (?, ?, ?, ?, 'ativa', 0, 0)`,
      [id, local_id, entrada_id, inicio]
    );
    
    logger.info('database', 'Sessão iniciada', { id, local_id });
    return id;
  } catch (error) {
    logger.error('database', 'Error starting session', { error: String(error) });
    throw error;
  }
}

export async function pausarSessao(sessao_id: string): Promise<void> {
  try {
    const database = getDb();
    const agora = new Date().toISOString();
    
    // Criar registro de pausa
    const pausaId = generateId();
    await database.runAsync(
      `INSERT INTO pausas (id, sessao_id, inicio) VALUES (?, ?, ?)`,
      [pausaId, sessao_id, agora]
    );
    
    // Atualizar status da sessão
    await database.runAsync(
      `UPDATE sessoes SET status = 'pausada' WHERE id = ?`,
      [sessao_id]
    );
    
    logger.info('database', 'Sessão pausada', { sessao_id, pausaId });
  } catch (error) {
    logger.error('database', 'Error pausing session', { error: String(error) });
    throw error;
  }
}

export async function retomarSessao(sessao_id: string): Promise<void> {
  try {
    const database = getDb();
    const agora = new Date().toISOString();
    
    // Finalizar pausa ativa
    const pausaAtiva = await database.getFirstAsync<PausaDB>(
      `SELECT * FROM pausas WHERE sessao_id = ? AND fim IS NULL ORDER BY inicio DESC LIMIT 1`,
      [sessao_id]
    );
    
    if (pausaAtiva) {
      const inicio = new Date(pausaAtiva.inicio);
      const fim = new Date(agora);
      const duracao = Math.round((fim.getTime() - inicio.getTime()) / 60000);
      
      await database.runAsync(
        `UPDATE pausas SET fim = ?, duracao_minutos = ? WHERE id = ?`,
        [agora, duracao, pausaAtiva.id]
      );
      
      // Atualizar tempo pausado total na sessão
      await database.runAsync(
        `UPDATE sessoes SET tempo_pausado_minutos = tempo_pausado_minutos + ?, status = 'ativa' WHERE id = ?`,
        [duracao, sessao_id]
      );
      
      logger.info('database', 'Sessão retomada', { sessao_id, pausaDuracao: duracao });
    } else {
      // Só atualizar status
      await database.runAsync(
        `UPDATE sessoes SET status = 'ativa' WHERE id = ?`,
        [sessao_id]
      );
    }
  } catch (error) {
    logger.error('database', 'Error resuming session', { error: String(error) });
    throw error;
  }
}

export async function finalizarSessao(local_id: string, saida_id: string): Promise<void> {
  try {
    const database = getDb();
    const fim = new Date().toISOString();
    
    const sessaoAberta = await database.getFirstAsync<SessaoDB>(
      `SELECT * FROM sessoes WHERE local_id = ? AND status != 'finalizada' ORDER BY inicio DESC LIMIT 1`,
      [local_id]
    );
    
    if (!sessaoAberta) {
      logger.warn('database', 'No open session found to close', { local_id });
      return;
    }
    
    // Se estava pausada, finalizar a pausa também
    if (sessaoAberta.status === 'pausada') {
      await retomarSessao(sessaoAberta.id);
      // Recarregar sessão com tempo atualizado
      const sessaoAtualizada = await database.getFirstAsync<SessaoDB>(
        `SELECT * FROM sessoes WHERE id = ?`,
        [sessaoAberta.id]
      );
      if (sessaoAtualizada) {
        sessaoAberta.tempo_pausado_minutos = sessaoAtualizada.tempo_pausado_minutos;
      }
    }
    
    const inicio = new Date(sessaoAberta.inicio);
    const fimDate = new Date(fim);
    const duracaoTotal = Math.round((fimDate.getTime() - inicio.getTime()) / 60000);
    const duracaoTrabalhada = duracaoTotal - (sessaoAberta.tempo_pausado_minutos || 0);
    
    await database.runAsync(
      `UPDATE sessoes SET saida_id = ?, fim = ?, duracao_minutos = ?, status = 'finalizada', synced = 0 WHERE id = ?`,
      [saida_id, fim, duracaoTrabalhada, sessaoAberta.id]
    );
    
    logger.info('database', 'Sessão finalizada', { 
      id: sessaoAberta.id, 
      duracao_total: duracaoTotal,
      tempo_pausado: sessaoAberta.tempo_pausado_minutos,
      duracao_trabalhada: duracaoTrabalhada,
    });
  } catch (error) {
    logger.error('database', 'Error finishing session', { error: String(error) });
    throw error;
  }
}

export async function getSessaoAberta(local_id: string): Promise<SessaoDB | null> {
  try {
    const database = getDb();
    const result = await database.getFirstAsync<SessaoDB>(
      `SELECT * FROM sessoes WHERE local_id = ? AND status != 'finalizada' ORDER BY inicio DESC LIMIT 1`,
      [local_id]
    );
    return result || null;
  } catch (error) {
    logger.error('database', 'Error getting open session', { error: String(error) });
    return null;
  }
}

export async function getSessaoAtivaGlobal(): Promise<SessaoDB | null> {
  try {
    const database = getDb();
    const result = await database.getFirstAsync<SessaoDB>(
      `SELECT s.*, l.nome as local_nome 
       FROM sessoes s 
       LEFT JOIN locais l ON s.local_id = l.id 
       WHERE s.status != 'finalizada' 
       ORDER BY s.inicio DESC LIMIT 1`
    );
    return result || null;
  } catch (error) {
    logger.error('database', 'Error getting active session', { error: String(error) });
    return null;
  }
}

export async function getSessoesHoje(): Promise<SessaoDB[]> {
  try {
    const database = getDb();
    const hoje = new Date().toISOString().split('T')[0];
    
    const result = await database.getAllAsync<SessaoDB>(
      `SELECT s.*, l.nome as local_nome 
       FROM sessoes s 
       LEFT JOIN locais l ON s.local_id = l.id 
       WHERE DATE(s.inicio) = ? 
       ORDER BY s.inicio DESC`,
      [hoje]
    );
    
    return result || [];
  } catch (error) {
    logger.error('database', 'Error getting today sessions', { error: String(error) });
    return [];
  }
}

export async function getSessoes(options?: {
  local_id?: string;
  dataInicio?: string;
  dataFim?: string;
  limit?: number;
}): Promise<SessaoDB[]> {
  try {
    const database = getDb();
    
    let query = `
      SELECT s.*, l.nome as local_nome 
      FROM sessoes s 
      LEFT JOIN locais l ON s.local_id = l.id 
      WHERE 1=1
    `;
    const params: any[] = [];
    
    if (options?.local_id) {
      query += ' AND s.local_id = ?';
      params.push(options.local_id);
    }
    
    if (options?.dataInicio) {
      query += ' AND DATE(s.inicio) >= ?';
      params.push(options.dataInicio);
    }
    
    if (options?.dataFim) {
      query += ' AND DATE(s.inicio) <= ?';
      params.push(options.dataFim);
    }
    
    query += ' ORDER BY s.inicio DESC';
    
    if (options?.limit) {
      query += ' LIMIT ?';
      params.push(options.limit);
    }
    
    const result = await database.getAllAsync<SessaoDB>(query, params);
    return result || [];
  } catch (error) {
    logger.error('database', 'Error loading sessions', { error: String(error) });
    return [];
  }
}

// ============================================
// ESTATÍSTICAS
// ============================================
export interface EstatisticasDia {
  data: string;
  total_minutos: number;
  total_sessoes: number;
  locais: string[];
}

export async function getEstatisticasHoje(): Promise<EstatisticasDia> {
  try {
    const database = getDb();
    const hoje = new Date().toISOString().split('T')[0];
    
    const result = await database.getFirstAsync<{
      total_minutos: number | null;
      total_sessoes: number;
    }>(
      `SELECT 
         COALESCE(SUM(duracao_minutos), 0) as total_minutos,
         COUNT(*) as total_sessoes
       FROM sessoes 
       WHERE DATE(inicio) = ? AND status = 'finalizada'`,
      [hoje]
    );
    
    // Sessão em andamento
    const sessaoAtiva = await database.getFirstAsync<{ inicio: string; tempo_pausado_minutos: number; status: string }>(
      `SELECT inicio, tempo_pausado_minutos, status FROM sessoes WHERE DATE(inicio) = ? AND status != 'finalizada' LIMIT 1`,
      [hoje]
    );
    
    let totalMinutos = result?.total_minutos || 0;
    
    if (sessaoAtiva && sessaoAtiva.status === 'ativa') {
      const inicio = new Date(sessaoAtiva.inicio);
      const agora = new Date();
      const minutosCorridos = Math.round((agora.getTime() - inicio.getTime()) / 60000);
      totalMinutos += minutosCorridos - (sessaoAtiva.tempo_pausado_minutos || 0);
    }
    
    const locaisResult = await database.getAllAsync<{ nome: string | null }>(
      `SELECT DISTINCT l.nome 
       FROM sessoes s 
       LEFT JOIN locais l ON s.local_id = l.id 
       WHERE DATE(s.inicio) = ?`,
      [hoje]
    );
    
    return {
      data: hoje,
      total_minutos: Math.max(0, totalMinutos),
      total_sessoes: (result?.total_sessoes || 0) + (sessaoAtiva ? 1 : 0),
      locais: (locaisResult || []).map(l => l.nome).filter((n): n is string => n !== null),
    };
  } catch (error) {
    logger.error('database', 'Error getting today stats', { error: String(error) });
    return {
      data: new Date().toISOString().split('T')[0],
      total_minutos: 0,
      total_sessoes: 0,
      locais: [],
    };
  }
}

// ============================================
// Utilitários
// ============================================
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.abs(minutes % 60);
  return `${hours}h ${mins.toString().padStart(2, '0')}min`;
}

export async function clearAllData(): Promise<void> {
  try {
    const database = getDb();
    await database.execAsync('DELETE FROM pausas;');
    await database.execAsync('DELETE FROM sessoes;');
    await database.execAsync('DELETE FROM registros;');
    await database.execAsync('DELETE FROM locais;');
    logger.warn('database', 'All data cleared');
  } catch (error) {
    logger.error('database', 'Error clearing data', { error: String(error) });
  }
}
DATABASE

echo "✅ database.ts atualizado com pause/resume!"

# ============================================
# Atualizar registroStore.ts com pause/resume
# ============================================
cat > src/stores/registroStore.ts << 'REGISTROSTORE'
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  initDatabase,
  saveRegistro,
  iniciarSessao,
  finalizarSessao,
  pausarSessao,
  retomarSessao,
  getSessaoAberta,
  getSessaoAtivaGlobal,
  getSessoesHoje,
  getEstatisticasHoje,
  formatDuration,
  type SessaoDB,
  type EstatisticasDia,
} from '../lib/database';

let dbInitialized = false;
let dbInitializing = false;

async function ensureDbInitialized(): Promise<boolean> {
  if (dbInitialized) return true;
  
  if (dbInitializing) {
    let attempts = 0;
    while (dbInitializing && attempts < 50) {
      await new Promise(resolve => setTimeout(resolve, 100));
      attempts++;
    }
    return dbInitialized;
  }
  
  dbInitializing = true;
  try {
    await initDatabase();
    dbInitialized = true;
    logger.info('database', 'Database initialized via ensureDbInitialized');
    return true;
  } catch (error) {
    logger.error('database', 'Failed to initialize database', { error: String(error) });
    return false;
  } finally {
    dbInitializing = false;
  }
}

interface RegistroState {
  isInitialized: boolean;
  sessaoAtual: SessaoDB | null;
  sessoesHoje: SessaoDB[];
  estatisticasHoje: EstatisticasDia | null;
  
  initialize: () => Promise<void>;
  registrarEntrada: (local_id: string, coords?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  registrarSaida: (local_id: string, coords?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  pausar: () => Promise<void>;
  retomar: () => Promise<void>;
  refreshData: () => Promise<void>;
  getSessaoAtiva: (local_id: string) => Promise<SessaoDB | null>;
}

export const useRegistroStore = create<RegistroState>((set, get) => ({
  isInitialized: false,
  sessaoAtual: null,
  sessoesHoje: [],
  estatisticasHoje: null,
  
  initialize: async () => {
    try {
      logger.info('database', 'Initializing registro store...');
      
      const success = await ensureDbInitialized();
      if (!success) {
        logger.error('database', 'Could not initialize database');
        return;
      }
      
      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      const sessaoAtual = await getSessaoAtivaGlobal();
      
      set({ 
        isInitialized: true,
        sessoesHoje,
        estatisticasHoje,
        sessaoAtual,
      });
      
      logger.info('database', 'Registro store initialized', {
        sessoesHoje: sessoesHoje.length,
        minutosHoje: estatisticasHoje.total_minutos,
        sessaoAtiva: sessaoAtual?.status || 'none',
      });
    } catch (error) {
      logger.error('database', 'Failed to initialize registro store', { error: String(error) });
    }
  },
  
  registrarEntrada: async (local_id, coords) => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) {
        logger.error('database', 'Cannot register entrada - DB not ready');
        return;
      }
      
      logger.info('database', '📥 Registrando ENTRADA', { local_id });
      
      const registro_id = await saveRegistro({
        local_id,
        tipo: 'entrada',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });
      
      await iniciarSessao(local_id, registro_id);
      await get().refreshData();
      
      logger.info('database', '✅ Entrada registrada com sucesso');
    } catch (error) {
      logger.error('database', 'Erro ao registrar entrada', { error: String(error) });
    }
  },
  
  registrarSaida: async (local_id, coords) => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) {
        logger.error('database', 'Cannot register saida - DB not ready');
        return;
      }
      
      logger.info('database', '📤 Registrando SAÍDA', { local_id });
      
      const registro_id = await saveRegistro({
        local_id,
        tipo: 'saida',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });
      
      await finalizarSessao(local_id, registro_id);
      await get().refreshData();
      
      logger.info('database', '✅ Saída registrada com sucesso');
    } catch (error) {
      logger.error('database', 'Erro ao registrar saída', { error: String(error) });
    }
  },
  
  pausar: async () => {
    try {
      const { sessaoAtual } = get();
      if (!sessaoAtual || sessaoAtual.status !== 'ativa') {
        logger.warn('database', 'No active session to pause');
        return;
      }
      
      logger.info('database', '⏸️ Pausando sessão', { sessaoId: sessaoAtual.id });
      
      await saveRegistro({
        local_id: sessaoAtual.local_id,
        tipo: 'pause',
        automatico: false,
      });
      
      await pausarSessao(sessaoAtual.id);
      await get().refreshData();
      
      logger.info('database', '✅ Sessão pausada');
    } catch (error) {
      logger.error('database', 'Erro ao pausar', { error: String(error) });
    }
  },
  
  retomar: async () => {
    try {
      const { sessaoAtual } = get();
      if (!sessaoAtual || sessaoAtual.status !== 'pausada') {
        logger.warn('database', 'No paused session to resume');
        return;
      }
      
      logger.info('database', '▶️ Retomando sessão', { sessaoId: sessaoAtual.id });
      
      await saveRegistro({
        local_id: sessaoAtual.local_id,
        tipo: 'resume',
        automatico: false,
      });
      
      await retomarSessao(sessaoAtual.id);
      await get().refreshData();
      
      logger.info('database', '✅ Sessão retomada');
    } catch (error) {
      logger.error('database', 'Erro ao retomar', { error: String(error) });
    }
  },
  
  refreshData: async () => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) return;
      
      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      const sessaoAtual = await getSessaoAtivaGlobal();
      
      set({ sessoesHoje, estatisticasHoje, sessaoAtual });
      
      logger.debug('database', 'Data refreshed', {
        sessoes: sessoesHoje.length,
        minutos: estatisticasHoje.total_minutos,
        status: sessaoAtual?.status || 'none',
      });
    } catch (error) {
      logger.error('database', 'Erro ao atualizar dados', { error: String(error) });
    }
  },
  
  getSessaoAtiva: async (local_id) => {
    const dbReady = await ensureDbInitialized();
    if (!dbReady) return null;
    return await getSessaoAberta(local_id);
  },
}));

export function useFormatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '0h 00min';
  return formatDuration(minutes);
}
REGISTROSTORE

echo "✅ registroStore.ts atualizado com pause/resume!"

# ============================================
# Nova tela de Mapa com busca e mapa visual
# ============================================
cat > app/\(tabs\)/map.tsx << 'MAPSCREEN'
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker, Circle, PROVIDER_GOOGLE } from 'react-native-maps';
import { useLocationStore, type LocalDeTrabalho } from '../../src/stores/locationStore';
import { searchAddress, reverseGeocode, type GeocodingResult } from '../../src/lib/geocoding';
import { colors } from '../../src/constants/colors';
import { logger } from '../../src/lib/logger';
import { Button } from '../../src/components/ui/Button';

export default function MapScreen() {
  const {
    initialize,
    currentLocation,
    accuracy,
    refreshLocation,
    locais,
    addLocal,
    removeLocal,
    activeGeofence,
    isGeofencingActive,
    startGeofenceMonitoring,
    stopGeofenceMonitoring,
    hasPermission,
    hasBackgroundPermission,
  } = useLocationStore();

  const mapRef = useRef<MapView>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalRaio, setNewLocalRaio] = useState('50');
  const [selectedLocation, setSelectedLocation] = useState<{
    latitude: number;
    longitude: number;
    address?: string;
  } | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<GeocodingResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [locationType, setLocationType] = useState<'current' | 'search' | 'map'>('current');

  useEffect(() => {
    initialize();
  }, []);

  // Buscar endereço
  const handleSearch = async () => {
    if (searchQuery.length < 3) return;
    
    setIsSearching(true);
    try {
      const results = await searchAddress(searchQuery);
      setSearchResults(results);
    } catch (error) {
      logger.error('map', 'Search error', { error });
    } finally {
      setIsSearching(false);
    }
  };

  // Selecionar resultado da busca
  const selectSearchResult = (result: GeocodingResult) => {
    setSelectedLocation({
      latitude: result.latitude,
      longitude: result.longitude,
      address: result.address,
    });
    setSearchResults([]);
    setSearchQuery('');
    setLocationType('search');
    
    // Mover mapa para o local
    mapRef.current?.animateToRegion({
      latitude: result.latitude,
      longitude: result.longitude,
      latitudeDelta: 0.005,
      longitudeDelta: 0.005,
    }, 500);
  };

  // Selecionar ponto no mapa
  const handleMapPress = async (event: any) => {
    const { latitude, longitude } = event.nativeEvent.coordinate;
    
    // Buscar endereço do ponto
    const address = await reverseGeocode(latitude, longitude);
    
    setSelectedLocation({
      latitude,
      longitude,
      address: address || undefined,
    });
    setLocationType('map');
  };

  // Usar localização atual
  const useCurrentLocation = () => {
    if (currentLocation) {
      setSelectedLocation({
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
      });
      setLocationType('current');
    }
  };

  // Abrir modal de adicionar
  const openAddModal = () => {
    useCurrentLocation();
    setNewLocalName('');
    setNewLocalRaio('50');
    setShowAddModal(true);
  };

  // Salvar novo local
  const handleSaveLocal = () => {
    if (!newLocalName.trim()) {
      Alert.alert('Erro', 'Digite um nome para o local');
      return;
    }
    
    if (!selectedLocation) {
      Alert.alert('Erro', 'Selecione uma localização');
      return;
    }
    
    const raio = parseInt(newLocalRaio) || 50;
    
    addLocal({
      nome: newLocalName.trim(),
      latitude: selectedLocation.latitude,
      longitude: selectedLocation.longitude,
      raio,
      cor: getRandomColor(),
      ativo: true,
    });
    
    setShowAddModal(false);
    setNewLocalName('');
    setSelectedLocation(null);
    
    Alert.alert('Sucesso', 'Local adicionado!');
  };

  // Deletar local
  const handleDeleteLocal = (local: LocalDeTrabalho) => {
    Alert.alert(
      'Remover Local',
      `Deseja remover "${local.nome}"?`,
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Remover', 
          style: 'destructive',
          onPress: () => removeLocal(local.id),
        },
      ]
    );
  };

  const getRandomColor = () => {
    const colors = ['#3B82F6', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#EC4899'];
    return colors[Math.floor(Math.random() * colors.length)];
  };

  const activeLocal = locais.find(l => l.id === activeGeofence);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Mapa */}
      <View style={styles.mapContainer}>
        {currentLocation ? (
          <MapView
            ref={mapRef}
            style={styles.map}
            provider={PROVIDER_GOOGLE}
            initialRegion={{
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              latitudeDelta: 0.01,
              longitudeDelta: 0.01,
            }}
            showsUserLocation
            showsMyLocationButton
            onPress={handleMapPress}
          >
            {/* Círculos dos geofences */}
            {locais.map((local) => (
              <React.Fragment key={local.id}>
                <Circle
                  center={{ latitude: local.latitude, longitude: local.longitude }}
                  radius={local.raio}
                  fillColor={`${local.cor}30`}
                  strokeColor={local.cor}
                  strokeWidth={2}
                />
                <Marker
                  coordinate={{ latitude: local.latitude, longitude: local.longitude }}
                  title={local.nome}
                  description={`Raio: ${local.raio}m`}
                  pinColor={local.cor}
                />
              </React.Fragment>
            ))}
            
            {/* Marcador de seleção */}
            {selectedLocation && (
              <Marker
                coordinate={selectedLocation}
                pinColor="#FF6B6B"
                title="Local selecionado"
              />
            )}
          </MapView>
        ) : (
          <View style={styles.loadingMap}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={styles.loadingText}>Carregando mapa...</Text>
          </View>
        )}
        
        {/* Status overlay */}
        {activeLocal && (
          <View style={styles.statusOverlay}>
            <Text style={styles.statusText}>🎯 Você está em: {activeLocal.nome}</Text>
          </View>
        )}
      </View>
      
      {/* Painel inferior */}
      <View style={styles.panel}>
        <ScrollView>
          {/* Locais */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>📍 Locais ({locais.length})</Text>
              <TouchableOpacity onPress={openAddModal}>
                <Text style={styles.addButton}>+ Adicionar</Text>
              </TouchableOpacity>
            </View>
            
            {locais.length === 0 ? (
              <Text style={styles.emptyText}>Nenhum local cadastrado</Text>
            ) : (
              locais.map((local) => (
                <View key={local.id} style={styles.localItem}>
                  <View style={[styles.localDot, { backgroundColor: local.cor }]} />
                  <View style={styles.localInfo}>
                    <Text style={styles.localName}>{local.nome}</Text>
                    <Text style={styles.localDetails}>Raio: {local.raio}m</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteLocal(local)}>
                    <Text style={styles.deleteButton}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </View>
          
          {/* Monitoramento */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>🔔 Monitoramento</Text>
            <Text style={styles.statusLabel}>
              Status: {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
            </Text>
            
            <Button
              title={isGeofencingActive ? '⏹️ Parar' : '▶️ Iniciar Monitoramento'}
              onPress={isGeofencingActive ? stopGeofenceMonitoring : startGeofenceMonitoring}
              variant={isGeofencingActive ? 'secondary' : 'primary'}
              disabled={locais.length === 0}
            />
          </View>
        </ScrollView>
      </View>
      
      {/* Modal Adicionar Local */}
      <Modal visible={showAddModal} animationType="slide" transparent>
        <KeyboardAvoidingView 
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.modalOverlay}
        >
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>📍 Adicionar Local</Text>
            
            {/* Opções de localização */}
            <View style={styles.locationOptions}>
              <TouchableOpacity
                style={[styles.locationOption, locationType === 'current' && styles.locationOptionActive]}
                onPress={useCurrentLocation}
              >
                <Text style={styles.locationOptionText}>📍 Local atual</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationOption, locationType === 'search' && styles.locationOptionActive]}
                onPress={() => setLocationType('search')}
              >
                <Text style={styles.locationOptionText}>🔍 Buscar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.locationOption, locationType === 'map' && styles.locationOptionActive]}
                onPress={() => setLocationType('map')}
              >
                <Text style={styles.locationOptionText}>🗺️ No mapa</Text>
              </TouchableOpacity>
            </View>
            
            {/* Busca de endereço */}
            {locationType === 'search' && (
              <View style={styles.searchContainer}>
                <TextInput
                  style={styles.searchInput}
                  placeholder="Digite o endereço..."
                  value={searchQuery}
                  onChangeText={setSearchQuery}
                  onSubmitEditing={handleSearch}
                />
                <TouchableOpacity style={styles.searchButton} onPress={handleSearch}>
                  <Text style={styles.searchButtonText}>🔍</Text>
                </TouchableOpacity>
              </View>
            )}
            
            {/* Resultados da busca */}
            {isSearching && <ActivityIndicator style={{ marginVertical: 10 }} />}
            {searchResults.length > 0 && (
              <ScrollView style={styles.searchResults}>
                {searchResults.map((result, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.searchResultItem}
                    onPress={() => selectSearchResult(result)}
                  >
                    <Text style={styles.searchResultText} numberOfLines={2}>
                      {result.address}
                    </Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
            
            {/* Local selecionado */}
            {selectedLocation && (
              <View style={styles.selectedLocation}>
                <Text style={styles.selectedLocationLabel}>Local selecionado:</Text>
                <Text style={styles.selectedLocationText}>
                  {selectedLocation.address || 
                   `${selectedLocation.latitude.toFixed(6)}, ${selectedLocation.longitude.toFixed(6)}`}
                </Text>
              </View>
            )}
            
            {/* Nome do local */}
            <TextInput
              style={styles.input}
              placeholder="Nome do local (ex: Escritório)"
              value={newLocalName}
              onChangeText={setNewLocalName}
            />
            
            {/* Raio */}
            <View style={styles.raioContainer}>
              <Text style={styles.raioLabel}>Raio (metros):</Text>
              <TextInput
                style={styles.raioInput}
                keyboardType="numeric"
                value={newLocalRaio}
                onChangeText={setNewLocalRaio}
              />
            </View>
            
            {/* Botões */}
            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                onPress={() => setShowAddModal(false)}
                variant="outline"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Salvar"
                onPress={handleSaveLocal}
                style={{ flex: 1, marginLeft: 8 }}
                disabled={!newLocalName.trim() || !selectedLocation}
              />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  mapContainer: {
    flex: 1,
  },
  map: {
    flex: 1,
  },
  loadingMap: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
  },
  loadingText: {
    marginTop: 12,
    color: colors.textSecondary,
  },
  statusOverlay: {
    position: 'absolute',
    top: 10,
    left: 10,
    right: 10,
    backgroundColor: '#DCFCE7',
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: colors.success,
  },
  statusText: {
    color: colors.success,
    fontWeight: '600',
    textAlign: 'center',
  },
  panel: {
    maxHeight: '40%',
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  section: {
    marginBottom: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  addButton: {
    color: colors.primary,
    fontWeight: '600',
  },
  emptyText: {
    color: colors.textSecondary,
    fontStyle: 'italic',
  },
  localItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  localDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  localInfo: {
    flex: 1,
  },
  localName: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  localDetails: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  deleteButton: {
    fontSize: 18,
    padding: 4,
  },
  statusLabel: {
    color: colors.textSecondary,
    marginBottom: 12,
  },
  // Modal styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: colors.background,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    maxHeight: '80%',
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 16,
    textAlign: 'center',
  },
  locationOptions: {
    flexDirection: 'row',
    marginBottom: 16,
    gap: 8,
  },
  locationOption: {
    flex: 1,
    padding: 10,
    borderRadius: 8,
    backgroundColor: colors.backgroundSecondary,
    alignItems: 'center',
  },
  locationOptionActive: {
    backgroundColor: colors.primary,
  },
  locationOptionText: {
    fontSize: 12,
    fontWeight: '500',
    color: colors.text,
  },
  searchContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 14,
  },
  searchButton: {
    marginLeft: 8,
    backgroundColor: colors.primary,
    borderRadius: 8,
    padding: 12,
    justifyContent: 'center',
  },
  searchButtonText: {
    fontSize: 18,
  },
  searchResults: {
    maxHeight: 150,
    marginBottom: 12,
  },
  searchResultItem: {
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  searchResultText: {
    fontSize: 13,
    color: colors.text,
  },
  selectedLocation: {
    backgroundColor: colors.backgroundSecondary,
    padding: 12,
    borderRadius: 8,
    marginBottom: 12,
  },
  selectedLocationLabel: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  selectedLocationText: {
    fontSize: 13,
    color: colors.text,
  },
  input: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 12,
  },
  raioContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  raioLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginRight: 12,
  },
  raioInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 8,
    padding: 8,
    width: 80,
    textAlign: 'center',
  },
  modalButtons: {
    flexDirection: 'row',
  },
});
MAPSCREEN

echo "✅ map.tsx criado com mapa visual!"

# ============================================
# Atualizar Home com Pause/Resume
# ============================================
cat > app/\(tabs\)/index.tsx << 'HOMESCREEN'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState, Alert, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useRegistroStore } from '../../src/stores/registroStore';
import { useWorkSessionStore } from '../../src/stores/workSessionStore';
import { logger } from '../../src/lib/logger';
import { colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';
import { formatDuration } from '../../src/lib/database';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { 
    initialize: initLocation, 
    isGeofencingActive,
    currentLocation,
    accuracy,
    locais,
    activeGeofence,
  } = useLocationStore();
  
  const {
    initialize: initRegistros,
    estatisticasHoje,
    sessoesHoje,
    sessaoAtual,
    refreshData,
    pausar,
    retomar,
    registrarSaida,
  } = useRegistroStore();
  
  const { startTimer } = useWorkSessionStore();
  
  const [elapsedMinutes, setElapsedMinutes] = useState(0);
  
  const activeLocal = locais.find(l => l.id === activeGeofence);
  const isInsideGeofence = !!activeGeofence;
  const isWorking = sessaoAtual && sessaoAtual.status !== 'finalizada';
  const isPaused = sessaoAtual?.status === 'pausada';
  
  useEffect(() => {
    initLocation();
    initRegistros();
  }, []);
  
  // Cronômetro em tempo real
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;
    
    if (sessaoAtual && sessaoAtual.status === 'ativa') {
      updateElapsedTime();
      timer = setInterval(updateElapsedTime, 1000);
    } else if (sessaoAtual && sessaoAtual.status === 'pausada') {
      // Quando pausado, mostrar tempo até a pausa
      updateElapsedTime();
    } else {
      setElapsedMinutes(estatisticasHoje?.total_minutos || 0);
    }
    
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sessaoAtual, estatisticasHoje]);
  
  const updateElapsedTime = () => {
    if (!sessaoAtual) return;
    
    const inicio = new Date(sessaoAtual.inicio);
    const agora = new Date();
    const diffMinutes = Math.floor((agora.getTime() - inicio.getTime()) / 60000);
    
    const sessoesFinalizadas = sessoesHoje
      .filter(s => s.status === 'finalizada')
      .reduce((acc, s) => acc + (s.duracao_minutos || 0), 0);
    
    // Descontar tempo pausado
    const tempoPausado = sessaoAtual.tempo_pausado_minutos || 0;
    
    if (sessaoAtual.status === 'ativa') {
      setElapsedMinutes(sessoesFinalizadas + diffMinutes - tempoPausado);
    } else {
      // Se pausado, não incrementar
      setElapsedMinutes(sessoesFinalizadas + diffMinutes - tempoPausado);
    }
  };
  
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshData();
      }
    });
    return () => subscription.remove();
  }, []);
  
  // Iniciar manualmente
  const handleStart = async () => {
    if (!activeGeofence) {
      Alert.alert('Aviso', 'Você precisa estar dentro de um local de trabalho para iniciar.');
      return;
    }
    
    await startTimer(activeGeofence, currentLocation ? {
      latitude: currentLocation.latitude,
      longitude: currentLocation.longitude,
      accuracy: accuracy || undefined,
    } : undefined);
    
    refreshData();
  };
  
  // Pausar
  const handlePause = () => {
    Alert.alert(
      'Pausar Cronômetro',
      'Deseja pausar? O tempo não será contado até você retomar.',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Pausar', onPress: pausar },
      ]
    );
  };
  
  // Retomar
  const handleResume = () => {
    retomar();
  };
  
  // Encerrar
  const handleStop = () => {
    if (!sessaoAtual) return;
    
    Alert.alert(
      'Encerrar Cronômetro',
      'Deseja encerrar e gerar o relatório?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Encerrar', 
          style: 'destructive',
          onPress: async () => {
            await registrarSaida(sessaoAtual.local_id, currentLocation ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              accuracy: accuracy || undefined,
            } : undefined);
          }
        },
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.greeting}>👋 Olá!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>
        
        {/* Status Card */}
        <View style={[styles.card, isWorking && !isPaused && styles.activeCard, isPaused && styles.pausedCard]}>
          <Text style={styles.cardTitle}>📍 Status</Text>
          
          {isWorking ? (
            <>
              <Text style={[styles.statusText, isPaused && styles.pausedText]}>
                {isPaused ? '⏸️ PAUSADO' : '🟢 TRABALHANDO'}
              </Text>
              <Text style={styles.localName}>{sessaoAtual?.local_nome || activeLocal?.nome || 'Local'}</Text>
              <Text style={styles.sinceText}>
                Desde {new Date(sessaoAtual!.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
              </Text>
              
              {/* Botões de controle */}
              <View style={styles.controlButtons}>
                {isPaused ? (
                  <Button
                    title="▶️ Retomar"
                    onPress={handleResume}
                    style={styles.resumeButton}
                  />
                ) : (
                  <Button
                    title="⏸️ Pausar"
                    onPress={handlePause}
                    variant="outline"
                    style={styles.pauseButton}
                  />
                )}
                <Button
                  title="⏹️ Encerrar"
                  onPress={handleStop}
                  variant="secondary"
                  style={styles.stopButton}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inactiveText}>
                {isInsideGeofence ? 'Pronto para trabalhar' : 'Fora do local de trabalho'}
              </Text>
              {isInsideGeofence && (
                <>
                  <Text style={styles.localName}>{activeLocal?.nome}</Text>
                  <Button
                    title="▶️ Iniciar Cronômetro"
                    onPress={handleStart}
                    style={{ marginTop: 12 }}
                  />
                </>
              )}
              {!isInsideGeofence && locais.length === 0 && (
                <Text style={styles.hint}>Vá até a aba Mapa para adicionar locais</Text>
              )}
            </>
          )}
        </View>
        
        {/* Horas Card */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏱️ Hoje</Text>
          <Text style={[styles.bigNumber, isWorking && !isPaused && styles.activeNumber]}>
            {formatDuration(elapsedMinutes)}
          </Text>
          {isWorking && !isPaused && (
            <Text style={styles.runningIndicator}>● Cronômetro rodando...</Text>
          )}
          {isPaused && (
            <Text style={styles.pausedIndicator}>⏸️ Pausado</Text>
          )}
          {!isWorking && sessoesHoje.length === 0 && (
            <Text style={styles.hint}>Nenhum registro hoje</Text>
          )}
        </View>
        
        {/* Sessões de Hoje */}
        {sessoesHoje.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Sessões de Hoje</Text>
            {sessoesHoje.slice(0, 5).map((sessao) => (
              <View key={sessao.id} style={styles.sessaoItem}>
                <View style={styles.sessaoInfo}>
                  <Text style={styles.sessaoLocal}>{sessao.local_nome || 'Local'}</Text>
                  <Text style={styles.sessaoTime}>
                    {new Date(sessao.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                    {sessao.fim 
                      ? ` - ${new Date(sessao.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : ' - agora'}
                  </Text>
                </View>
                <Text style={[
                  styles.sessaoDuracao,
                  sessao.status === 'pausada' && styles.pausedDuracao,
                  sessao.status === 'ativa' && styles.activeDuracao,
                ]}>
                  {sessao.status === 'finalizada' 
                    ? formatDuration(sessao.duracao_minutos || 0)
                    : sessao.status === 'pausada' ? '⏸️' : '⏳'}
                </Text>
              </View>
            ))}
          </View>
        )}
        
        {/* GPS Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛰️ GPS</Text>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Localização:</Text>
            <Text style={styles.gpsValue}>
              {currentLocation 
                ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : 'Obtendo...'}
            </Text>
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Monitoramento:</Text>
            <Text style={[styles.gpsValue, isGeofencingActive && styles.activeGps]}>
              {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
            </Text>
          </View>
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 16,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: colors.success,
  },
  pausedCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
  },
  pausedText: {
    color: '#F59E0B',
  },
  localName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  sinceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  pauseButton: {
    flex: 1,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: colors.success,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
  },
  inactiveText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  bigNumber: {
    fontSize: 42,
    fontWeight: 'bold',
    color: colors.primary,
  },
  activeNumber: {
    color: colors.success,
  },
  runningIndicator: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  pausedIndicator: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
  },
  sessaoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessaoInfo: {
    flex: 1,
  },
  sessaoLocal: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  sessaoTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sessaoDuracao: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pausedDuracao: {
    color: '#F59E0B',
  },
  activeDuracao: {
    color: colors.success,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gpsLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  gpsValue: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  activeGps: {
    color: colors.success,
  },
});
HOMESCREEN

echo "✅ index.tsx (Home) atualizado com pause/resume!"

echo ""
echo "✅✅✅ MAPA VISUAL + PAUSE/RESUME CRIADOS! ✅✅✅"
echo ""
echo "Agora:"
echo "1. Limpe os dados do Expo Go (Config > Apps > Clear Data)"
echo "2. Reinicie: npx expo start -c"
echo ""
