#!/bin/bash

# ============================================
# OnSite Flow - Checkpoint 4: SQLite Local
# ============================================

echo "🚀 Configurando SQLite e banco local..."

# ============================================
# src/lib/database.ts - Banco de Dados Local
# ============================================
cat > src/lib/database.ts << 'DATABASE'
import * as SQLite from 'expo-sqlite';
import { logger } from './logger';

// Nome do banco
const DB_NAME = 'onsite-flow.db';

// Instância do banco
let db: SQLite.SQLiteDatabase | null = null;

// ============================================
// Inicializar Banco
// ============================================
export async function initDatabase(): Promise<void> {
  try {
    logger.info('database', 'Initializing SQLite database...');
    
    db = await SQLite.openDatabaseAsync(DB_NAME);
    
    // Criar tabelas
    await db.execAsync(`
      -- Tabela de locais de trabalho
      CREATE TABLE IF NOT EXISTS locais (
        id TEXT PRIMARY KEY,
        nome TEXT NOT NULL,
        latitude REAL NOT NULL,
        longitude REAL NOT NULL,
        raio INTEGER NOT NULL DEFAULT 50,
        cor TEXT DEFAULT '#3B82F6',
        ativo INTEGER DEFAULT 1,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0
      );
      
      -- Tabela de registros de ponto
      CREATE TABLE IF NOT EXISTS registros (
        id TEXT PRIMARY KEY,
        local_id TEXT NOT NULL,
        tipo TEXT NOT NULL CHECK (tipo IN ('entrada', 'saida')),
        timestamp TEXT NOT NULL,
        latitude REAL,
        longitude REAL,
        accuracy REAL,
        automatico INTEGER DEFAULT 1,
        observacao TEXT,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (local_id) REFERENCES locais(id)
      );
      
      -- Tabela de sessões de trabalho (entrada + saída pareadas)
      CREATE TABLE IF NOT EXISTS sessoes (
        id TEXT PRIMARY KEY,
        local_id TEXT NOT NULL,
        entrada_id TEXT NOT NULL,
        saida_id TEXT,
        inicio TEXT NOT NULL,
        fim TEXT,
        duracao_minutos INTEGER,
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        synced INTEGER DEFAULT 0,
        FOREIGN KEY (local_id) REFERENCES locais(id),
        FOREIGN KEY (entrada_id) REFERENCES registros(id),
        FOREIGN KEY (saida_id) REFERENCES registros(id)
      );
      
      -- Índices para performance
      CREATE INDEX IF NOT EXISTS idx_registros_local ON registros(local_id);
      CREATE INDEX IF NOT EXISTS idx_registros_timestamp ON registros(timestamp);
      CREATE INDEX IF NOT EXISTS idx_sessoes_local ON sessoes(local_id);
      CREATE INDEX IF NOT EXISTS idx_sessoes_inicio ON sessoes(inicio);
    `);
    
    logger.info('database', 'Database initialized successfully');
  } catch (error) {
    logger.error('database', 'Failed to initialize database', { error });
    throw error;
  }
}

// ============================================
// Funções auxiliares
// ============================================
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
  ativo: boolean;
}): Promise<string> {
  const database = getDb();
  const id = local.id || generateId();
  
  await database.runAsync(
    `INSERT OR REPLACE INTO locais (id, nome, latitude, longitude, raio, cor, ativo, updated_at, synced)
     VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, 0)`,
    [id, local.nome, local.latitude, local.longitude, local.raio, local.cor, local.ativo ? 1 : 0]
  );
  
  logger.info('database', 'Local saved', { id, nome: local.nome });
  return id;
}

export async function getLocais(): Promise<LocalDB[]> {
  const database = getDb();
  const result = await database.getAllAsync<LocalDB>('SELECT * FROM locais ORDER BY created_at DESC');
  return result;
}

export async function deleteLocal(id: string): Promise<void> {
  const database = getDb();
  await database.runAsync('DELETE FROM locais WHERE id = ?', [id]);
  logger.info('database', 'Local deleted', { id });
}

// ============================================
// REGISTROS - CRUD
// ============================================
export interface RegistroDB {
  id: string;
  local_id: string;
  tipo: 'entrada' | 'saida';
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
  tipo: 'entrada' | 'saida';
  latitude?: number;
  longitude?: number;
  accuracy?: number;
  automatico?: boolean;
  observacao?: string;
}): Promise<string> {
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
      registro.latitude || null,
      registro.longitude || null,
      registro.accuracy || null,
      registro.automatico !== false ? 1 : 0,
      registro.observacao || null,
    ]
  );
  
  logger.info('database', `Registro saved: ${registro.tipo}`, { 
    id, 
    local_id: registro.local_id,
    timestamp 
  });
  
  return id;
}

export async function getRegistros(options?: {
  local_id?: string;
  data?: string; // YYYY-MM-DD
  limit?: number;
}): Promise<RegistroDB[]> {
  const database = getDb();
  
  let query = 'SELECT * FROM registros WHERE 1=1';
  const params: any[] = [];
  
  if (options?.local_id) {
    query += ' AND local_id = ?';
    params.push(options.local_id);
  }
  
  if (options?.data) {
    query += ' AND DATE(timestamp) = ?';
    params.push(options.data);
  }
  
  query += ' ORDER BY timestamp DESC';
  
  if (options?.limit) {
    query += ' LIMIT ?';
    params.push(options.limit);
  }
  
  const result = await database.getAllAsync<RegistroDB>(query, params);
  return result;
}

export async function getRegistrosHoje(): Promise<RegistroDB[]> {
  const hoje = new Date().toISOString().split('T')[0];
  return getRegistros({ data: hoje });
}

// ============================================
// SESSÕES - Gerenciamento
// ============================================
export interface SessaoDB {
  id: string;
  local_id: string;
  entrada_id: string;
  saida_id: string | null;
  inicio: string;
  fim: string | null;
  duracao_minutos: number | null;
  created_at: string;
  synced: number;
  // Joins
  local_nome?: string;
}

export async function iniciarSessao(local_id: string, entrada_id: string): Promise<string> {
  const database = getDb();
  const id = generateId();
  const inicio = new Date().toISOString();
  
  await database.runAsync(
    `INSERT INTO sessoes (id, local_id, entrada_id, inicio, synced)
     VALUES (?, ?, ?, ?, 0)`,
    [id, local_id, entrada_id, inicio]
  );
  
  logger.info('database', 'Sessão iniciada', { id, local_id });
  return id;
}

export async function finalizarSessao(
  local_id: string, 
  saida_id: string
): Promise<void> {
  const database = getDb();
  const fim = new Date().toISOString();
  
  // Encontrar sessão aberta para este local
  const sessaoAberta = await database.getFirstAsync<SessaoDB>(
    'SELECT * FROM sessoes WHERE local_id = ? AND fim IS NULL ORDER BY inicio DESC LIMIT 1',
    [local_id]
  );
  
  if (!sessaoAberta) {
    logger.warn('database', 'No open session found to close', { local_id });
    return;
  }
  
  // Calcular duração em minutos
  const inicio = new Date(sessaoAberta.inicio);
  const fimDate = new Date(fim);
  const duracao_minutos = Math.round((fimDate.getTime() - inicio.getTime()) / 60000);
  
  await database.runAsync(
    `UPDATE sessoes SET saida_id = ?, fim = ?, duracao_minutos = ?, synced = 0
     WHERE id = ?`,
    [saida_id, fim, duracao_minutos, sessaoAberta.id]
  );
  
  logger.info('database', 'Sessão finalizada', { 
    id: sessaoAberta.id, 
    duracao_minutos 
  });
}

export async function getSessaoAberta(local_id: string): Promise<SessaoDB | null> {
  const database = getDb();
  const result = await database.getFirstAsync<SessaoDB>(
    'SELECT * FROM sessoes WHERE local_id = ? AND fim IS NULL ORDER BY inicio DESC LIMIT 1',
    [local_id]
  );
  return result || null;
}

export async function getSessoesHoje(): Promise<SessaoDB[]> {
  const database = getDb();
  const hoje = new Date().toISOString().split('T')[0];
  
  const result = await database.getAllAsync<SessaoDB & { local_nome: string }>(
    `SELECT s.*, l.nome as local_nome 
     FROM sessoes s 
     JOIN locais l ON s.local_id = l.id 
     WHERE DATE(s.inicio) = ? 
     ORDER BY s.inicio DESC`,
    [hoje]
  );
  
  return result;
}

export async function getSessoes(options?: {
  local_id?: string;
  dataInicio?: string;
  dataFim?: string;
  limit?: number;
}): Promise<SessaoDB[]> {
  const database = getDb();
  
  let query = `
    SELECT s.*, l.nome as local_nome 
    FROM sessoes s 
    JOIN locais l ON s.local_id = l.id 
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
  return result;
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
  const database = getDb();
  const hoje = new Date().toISOString().split('T')[0];
  
  const result = await database.getFirstAsync<{
    total_minutos: number;
    total_sessoes: number;
  }>(
    `SELECT 
       COALESCE(SUM(duracao_minutos), 0) as total_minutos,
       COUNT(*) as total_sessoes
     FROM sessoes 
     WHERE DATE(inicio) = ? AND fim IS NOT NULL`,
    [hoje]
  );
  
  // Sessão em andamento
  const sessaoAberta = await database.getFirstAsync<{ inicio: string }>(
    `SELECT inicio FROM sessoes WHERE DATE(inicio) = ? AND fim IS NULL LIMIT 1`,
    [hoje]
  );
  
  let totalMinutos = result?.total_minutos || 0;
  
  if (sessaoAberta) {
    const inicio = new Date(sessaoAberta.inicio);
    const agora = new Date();
    totalMinutos += Math.round((agora.getTime() - inicio.getTime()) / 60000);
  }
  
  const locaisResult = await database.getAllAsync<{ nome: string }>(
    `SELECT DISTINCT l.nome 
     FROM sessoes s 
     JOIN locais l ON s.local_id = l.id 
     WHERE DATE(s.inicio) = ?`,
    [hoje]
  );
  
  return {
    data: hoje,
    total_minutos: totalMinutos,
    total_sessoes: (result?.total_sessoes || 0) + (sessaoAberta ? 1 : 0),
    locais: locaisResult.map(l => l.nome),
  };
}

// ============================================
// SYNC - Dados não sincronizados
// ============================================
export async function getUnsyncedData(): Promise<{
  locais: LocalDB[];
  registros: RegistroDB[];
  sessoes: SessaoDB[];
}> {
  const database = getDb();
  
  const locais = await database.getAllAsync<LocalDB>(
    'SELECT * FROM locais WHERE synced = 0'
  );
  
  const registros = await database.getAllAsync<RegistroDB>(
    'SELECT * FROM registros WHERE synced = 0'
  );
  
  const sessoes = await database.getAllAsync<SessaoDB>(
    'SELECT * FROM sessoes WHERE synced = 0'
  );
  
  return { locais, registros, sessoes };
}

export async function markAsSynced(
  table: 'locais' | 'registros' | 'sessoes',
  ids: string[]
): Promise<void> {
  if (ids.length === 0) return;
  
  const database = getDb();
  const placeholders = ids.map(() => '?').join(',');
  
  await database.runAsync(
    `UPDATE ${table} SET synced = 1 WHERE id IN (${placeholders})`,
    ids
  );
  
  logger.info('database', `Marked ${ids.length} ${table} as synced`);
}

// ============================================
// Utilitários
// ============================================
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return `${hours}h ${mins.toString().padStart(2, '0')}min`;
}

export async function clearAllData(): Promise<void> {
  const database = getDb();
  await database.execAsync(`
    DELETE FROM sessoes;
    DELETE FROM registros;
    DELETE FROM locais;
  `);
  logger.warn('database', 'All data cleared');
}
DATABASE

echo "✅ database.ts criado!"

# ============================================
# src/stores/registroStore.ts - Estado de Registros
# ============================================
cat > src/stores/registroStore.ts << 'REGISTROSTORE'
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  initDatabase,
  saveRegistro,
  iniciarSessao,
  finalizarSessao,
  getSessaoAberta,
  getSessoesHoje,
  getEstatisticasHoje,
  getSessoes,
  formatDuration,
  type SessaoDB,
  type EstatisticasDia,
} from '../lib/database';

interface RegistroState {
  // Estado
  isInitialized: boolean;
  sessaoAtual: SessaoDB | null;
  sessoesHoje: SessaoDB[];
  estatisticasHoje: EstatisticasDia | null;
  
  // Actions
  initialize: () => Promise<void>;
  registrarEntrada: (local_id: string, coords?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
  registrarSaida: (local_id: string, coords?: { latitude: number; longitude: number; accuracy?: number }) => Promise<void>;
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
      await initDatabase();
      
      // Carregar dados iniciais
      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      
      set({ 
        isInitialized: true,
        sessoesHoje,
        estatisticasHoje,
      });
      
      logger.info('database', 'Registro store initialized', {
        sessoesHoje: sessoesHoje.length,
        minutosHoje: estatisticasHoje.total_minutos,
      });
    } catch (error) {
      logger.error('database', 'Failed to initialize registro store', { error });
    }
  },
  
  registrarEntrada: async (local_id, coords) => {
    try {
      logger.info('database', '📥 Registrando ENTRADA', { local_id });
      
      // 1. Salvar registro de entrada
      const registro_id = await saveRegistro({
        local_id,
        tipo: 'entrada',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });
      
      // 2. Iniciar sessão
      await iniciarSessao(local_id, registro_id);
      
      // 3. Atualizar estado
      await get().refreshData();
      
      logger.info('database', '✅ Entrada registrada com sucesso');
    } catch (error) {
      logger.error('database', 'Erro ao registrar entrada', { error });
    }
  },
  
  registrarSaida: async (local_id, coords) => {
    try {
      logger.info('database', '📤 Registrando SAÍDA', { local_id });
      
      // 1. Salvar registro de saída
      const registro_id = await saveRegistro({
        local_id,
        tipo: 'saida',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });
      
      // 2. Finalizar sessão
      await finalizarSessao(local_id, registro_id);
      
      // 3. Atualizar estado
      await get().refreshData();
      
      logger.info('database', '✅ Saída registrada com sucesso');
    } catch (error) {
      logger.error('database', 'Erro ao registrar saída', { error });
    }
  },
  
  refreshData: async () => {
    try {
      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      
      set({ sessoesHoje, estatisticasHoje });
    } catch (error) {
      logger.error('database', 'Erro ao atualizar dados', { error });
    }
  },
  
  getSessaoAtiva: async (local_id) => {
    return await getSessaoAberta(local_id);
  },
}));

// Hook para formatar duração
export function useFormatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '0h 00min';
  return formatDuration(minutes);
}
REGISTROSTORE

echo "✅ registroStore.ts criado!"

# ============================================
# Atualizar locationStore para integrar com registros
# ============================================
cat > src/stores/locationStore.ts << 'LOCSTORE_UPDATED'
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  getCurrentLocation,
  startWatchingLocation,
  stopWatchingLocation,
  startGeofencing,
  stopGeofencing,
  startBackgroundLocation,
  stopBackgroundLocation,
  checkPermissions,
  calculateDistance,
  isInsideGeofence,
  type Coordinates,
  type LocationResult,
  type GeofenceRegion,
} from '../lib/location';
import { setGeofenceCallback, type GeofenceEvent } from '../lib/backgroundTasks';
import { useRegistroStore } from './registroStore';

export interface LocalDeTrabalho {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  ativo: boolean;
}

const POLLING_INTERVAL = 30000;
let pollingTimer: NodeJS.Timeout | null = null;

interface LocationState {
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  currentLocation: Coordinates | null;
  accuracy: number | null;
  lastUpdate: number | null;
  isWatching: boolean;
  locais: LocalDeTrabalho[];
  activeGeofence: string | null;
  isGeofencingActive: boolean;
  isBackgroundActive: boolean;
  isPollingActive: boolean;
  lastGeofenceEvent: GeofenceEvent | null;
  
  initialize: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  addLocal: (local: Omit<LocalDeTrabalho, 'id'>) => void;
  removeLocal: (id: string) => void;
  updateLocal: (id: string, updates: Partial<LocalDeTrabalho>) => void;
  startGeofenceMonitoring: () => Promise<void>;
  stopGeofenceMonitoring: () => Promise<void>;
  checkCurrentGeofence: () => void;
  startPolling: () => void;
  stopPolling: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  hasPermission: false,
  hasBackgroundPermission: false,
  currentLocation: null,
  accuracy: null,
  lastUpdate: null,
  isWatching: false,
  locais: [],
  activeGeofence: null,
  isGeofencingActive: false,
  isBackgroundActive: false,
  isPollingActive: false,
  lastGeofenceEvent: null,
  
  initialize: async () => {
    logger.info('gps', 'Initializing location store');
    
    await import('../lib/backgroundTasks');
    
    const permissions = await checkPermissions();
    set({
      hasPermission: permissions.foreground,
      hasBackgroundPermission: permissions.background,
    });
    
    setGeofenceCallback((event) => {
      logger.info('geofence', `System event: ${event.type} - ${event.regionIdentifier}`);
      set({ 
        lastGeofenceEvent: event,
        activeGeofence: event.type === 'enter' ? event.regionIdentifier : null,
      });
    });
    
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
        hasPermission: true,
      });
      get().checkCurrentGeofence();
    }
  },
  
  refreshLocation: async () => {
    logger.debug('gps', 'Refreshing location...');
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
      });
      get().checkCurrentGeofence();
    }
  },
  
  startTracking: async () => {
    const success = await startWatchingLocation((location) => {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
      });
      get().checkCurrentGeofence();
    });
    
    if (success) {
      set({ isWatching: true, hasPermission: true });
      logger.info('gps', 'Real-time tracking started');
    }
  },
  
  stopTracking: async () => {
    await stopWatchingLocation();
    set({ isWatching: false });
    logger.info('gps', 'Real-time tracking stopped');
  },
  
  addLocal: (local) => {
    const newLocal: LocalDeTrabalho = {
      ...local,
      id: `local_${Date.now()}`,
    };
    
    logger.info('geofence', 'Adding new local', { nome: local.nome });
    set((state) => ({ locais: [...state.locais, newLocal] }));
    setTimeout(() => get().checkCurrentGeofence(), 100);
  },
  
  removeLocal: (id) => {
    logger.info('geofence', 'Removing local', { id });
    set((state) => ({ 
      locais: state.locais.filter(l => l.id !== id),
      activeGeofence: state.activeGeofence === id ? null : state.activeGeofence,
    }));
  },
  
  updateLocal: (id, updates) => {
    set((state) => ({
      locais: state.locais.map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  },
  
  startPolling: () => {
    get().stopPolling();
    logger.info('gps', 'Starting active polling (every 30s)');
    get().refreshLocation();
    
    pollingTimer = setInterval(() => {
      logger.debug('gps', 'Polling check...');
      get().refreshLocation();
    }, POLLING_INTERVAL);
    
    set({ isPollingActive: true });
  },
  
  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
      logger.info('gps', 'Polling stopped');
    }
    set({ isPollingActive: false });
  },
  
  startGeofenceMonitoring: async () => {
    const { locais } = get();
    const activeLocais = locais.filter(l => l.ativo);
    
    if (activeLocais.length === 0) {
      logger.warn('geofence', 'No active locations to monitor');
      return;
    }
    
    const regions: GeofenceRegion[] = activeLocais.map(local => ({
      identifier: local.id,
      latitude: local.latitude,
      longitude: local.longitude,
      radius: local.raio,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
    
    const success = await startGeofencing(regions);
    if (success) {
      set({ isGeofencingActive: true, hasBackgroundPermission: true });
      await startBackgroundLocation();
      set({ isBackgroundActive: true });
      get().startPolling();
      logger.info('geofence', 'Full monitoring started (geofence + polling)');
    }
  },
  
  stopGeofenceMonitoring: async () => {
    get().stopPolling();
    await stopGeofencing();
    await stopBackgroundLocation();
    set({ 
      isGeofencingActive: false, 
      isBackgroundActive: false,
      isPollingActive: false,
    });
    logger.info('geofence', 'All monitoring stopped');
  },
  
  // ATUALIZADO: Integração com registros
  checkCurrentGeofence: () => {
    const { currentLocation, locais, activeGeofence, accuracy } = get();
    if (!currentLocation) return;
    
    const activeLocais = locais.filter(l => l.ativo);
    const registroStore = useRegistroStore.getState();
    
    for (const local of activeLocais) {
      const inside = isInsideGeofence(currentLocation, {
        identifier: local.id,
        latitude: local.latitude,
        longitude: local.longitude,
        radius: local.raio,
      });
      
      if (inside) {
        if (activeGeofence !== local.id) {
          // ENTROU no geofence
          logger.info('geofence', `✅ ENTERED: ${local.nome}`, {
            localId: local.id,
            distance: calculateDistance(currentLocation, {
              latitude: local.latitude,
              longitude: local.longitude,
            }).toFixed(1) + 'm',
          });
          
          set({ activeGeofence: local.id });
          
          // REGISTRAR ENTRADA no banco
          registroStore.registrarEntrada(local.id, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: accuracy || undefined,
          });
        }
        return;
      }
    }
    
    // Não está em nenhum geofence
    if (activeGeofence !== null) {
      const previousLocal = locais.find(l => l.id === activeGeofence);
      
      logger.info('geofence', `🚪 EXITED: ${previousLocal?.nome || 'unknown'}`, {
        localId: activeGeofence,
      });
      
      // REGISTRAR SAÍDA no banco
      registroStore.registrarSaida(activeGeofence, {
        latitude: currentLocation.latitude,
        longitude: currentLocation.longitude,
        accuracy: accuracy || undefined,
      });
      
      set({ activeGeofence: null });
    }
  },
}));
LOCSTORE_UPDATED

echo "✅ locationStore.ts atualizado com integração de registros!"

# ============================================
# Atualizar app/(tabs)/index.tsx - Home com horas
# ============================================
cat > 'app/(tabs)/index.tsx' << 'HOMESCREEN'
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useRegistroStore, useFormatDuration } from '../../src/stores/registroStore';
import { logger } from '../../src/lib/logger';
import { colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';
import { formatDistance, calculateDistance } from '../../src/lib/location';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { 
    initialize: initLocation, 
    isGeofencingActive, 
    isBackgroundActive,
    currentLocation,
    accuracy,
    locais,
    activeGeofence,
  } = useLocationStore();
  
  const {
    initialize: initRegistros,
    estatisticasHoje,
    sessoesHoje,
    refreshData,
  } = useRegistroStore();
  
  const [currentTime, setCurrentTime] = useState(new Date());
  
  // Encontrar local ativo
  const activeLocal = locais.find(l => l.id === activeGeofence);
  
  // Formatar horas trabalhadas
  const horasTrabalhadas = useFormatDuration(estatisticasHoje?.total_minutos);
  
  // Inicializar
  useEffect(() => {
    logger.info('auth', 'Home screen loaded', { userId: user?.id });
    initLocation();
    initRegistros();
  }, []);
  
  // Atualizar relógio e dados a cada minuto
  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(new Date());
      refreshData(); // Atualiza estatísticas (inclui sessão em andamento)
    }, 60000);
    
    return () => clearInterval(timer);
  }, []);
  
  // Atualizar quando app volta ao foco
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshData();
      }
    });
    
    return () => subscription.remove();
  }, []);
  
  // Calcular local mais próximo
  const nearestLocal = currentLocation && locais.length > 0
    ? locais.reduce((nearest, local) => {
        const dist = calculateDistance(currentLocation, { 
          latitude: local.latitude, 
          longitude: local.longitude 
        });
        if (!nearest || dist < nearest.distance) {
          return { local, distance: dist };
        }
        return nearest;
      }, null as { local: typeof locais[0]; distance: number } | null)
    : null;
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>👋 Olá!</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      {/* Status Card */}
      <View style={[styles.card, activeLocal ? styles.activeCard : null]}>
        <Text style={styles.cardTitle}>📍 Status</Text>
        {activeLocal ? (
          <>
            <Text style={styles.activeStatus}>🟢 TRABALHANDO</Text>
            <Text style={styles.activeLocalName}>{activeLocal.nome}</Text>
            <Text style={styles.workingTime}>
              Desde {sessoesHoje.find(s => !s.fim)?.inicio 
                ? new Date(sessoesHoje.find(s => !s.fim)!.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
                : '--:--'}
            </Text>
          </>
        ) : (
          <>
            <Text style={styles.inactiveStatus}>Fora do local de trabalho</Text>
            {nearestLocal && (
              <Text style={styles.nearestText}>
                Mais próximo: {nearestLocal.local.nome} ({formatDistance(nearestLocal.distance)})
              </Text>
            )}
            {locais.length === 0 && (
              <Text style={styles.hint}>
                Vá até a aba Mapa para adicionar locais de trabalho
              </Text>
            )}
          </>
        )}
      </View>
      
      {/* Horas Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱️ Hoje</Text>
        <Text style={styles.bigNumber}>{horasTrabalhadas}</Text>
        <Text style={styles.hint}>
          {estatisticasHoje?.total_sessoes 
            ? `${estatisticasHoje.total_sessoes} ${estatisticasHoje.total_sessoes === 1 ? 'sessão' : 'sessões'} de trabalho`
            : 'Nenhum registro hoje'}
        </Text>
      </View>
      
      {/* Sessões de Hoje */}
      {sessoesHoje.length > 0 && (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📋 Sessões de Hoje</Text>
          {sessoesHoje.slice(0, 3).map((sessao) => (
            <View key={sessao.id} style={styles.sessaoItem}>
              <View style={styles.sessaoInfo}>
                <Text style={styles.sessaoLocal}>{sessao.local_nome}</Text>
                <Text style={styles.sessaoTime}>
                  {new Date(sessao.inicio).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}
                  {sessao.fim 
                    ? ` - ${new Date(sessao.fim).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                    : ' - em andamento...'}
                </Text>
              </View>
              <Text style={[styles.sessaoDuracao, !sessao.fim && styles.emAndamento]}>
                {sessao.duracao_minutos 
                  ? useFormatDuration(sessao.duracao_minutos)
                  : '⏳'}
              </Text>
            </View>
          ))}
          {sessoesHoje.length > 3 && (
            <Text style={styles.moreText}>
              +{sessoesHoje.length - 3} mais na aba Histórico
            </Text>
          )}
        </View>
      )}
      
      {/* GPS Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛰️ GPS</Text>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Localização:</Text>
          <Text style={styles.gpsValue}>
            {currentLocation 
              ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
              : 'Obtendo...'
            }
          </Text>
        </View>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Precisão:</Text>
          <Text style={styles.gpsValue}>
            {accuracy ? `~${accuracy.toFixed(0)}m` : '-'}
          </Text>
        </View>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Monitoramento:</Text>
          <Text style={[styles.gpsValue, isGeofencingActive ? styles.activeText : null]}>
            {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
          </Text>
        </View>
      </View>
      
      {/* Test DevMonitor */}
      <View style={styles.testSection}>
        <Button 
          title="🔄 Atualizar Dados" 
          onPress={refreshData}
          variant="outline"
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
  },
  header: {
    marginBottom: 24,
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
    padding: 20,
    marginBottom: 16,
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  activeStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  activeLocalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
  },
  workingTime: {
    fontSize: 14,
    color: colors.success,
    marginTop: 4,
  },
  inactiveStatus: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  nearestText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  hint: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
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
  emAndamento: {
    color: colors.success,
  },
  moreText: {
    fontSize: 12,
    color: colors.primary,
    textAlign: 'center',
    marginTop: 8,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gpsLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  gpsValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  activeText: {
    color: colors.success,
    fontWeight: '600',
  },
  testSection: {
    marginTop: 'auto',
  },
});
HOMESCREEN

echo "✅ index.tsx (home) atualizado com horas!"

# ============================================
# Atualizar app/(tabs)/history.tsx - Histórico
# ============================================
cat > 'app/(tabs)/history.tsx' << 'HISTORYSCREEN'
import React, { useEffect, useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ScrollView,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRegistroStore, useFormatDuration } from '../../src/stores/registroStore';
import { getSessoes, type SessaoDB } from '../../src/lib/database';
import { colors } from '../../src/constants/colors';
import { logger } from '../../src/lib/logger';

type FilterPeriod = 'hoje' | 'semana' | 'mes';

export default function HistoryScreen() {
  const { sessoesHoje, estatisticasHoje, refreshData } = useRegistroStore();
  const [filter, setFilter] = useState<FilterPeriod>('hoje');
  const [sessoes, setSessoes] = useState<SessaoDB[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMinutos, setTotalMinutos] = useState(0);
  
  const loadSessoes = async () => {
    let dataInicio: string | undefined;
    const hoje = new Date();
    
    switch (filter) {
      case 'hoje':
        dataInicio = hoje.toISOString().split('T')[0];
        break;
      case 'semana':
        const semanaAtras = new Date(hoje);
        semanaAtras.setDate(hoje.getDate() - 7);
        dataInicio = semanaAtras.toISOString().split('T')[0];
        break;
      case 'mes':
        const mesAtras = new Date(hoje);
        mesAtras.setMonth(hoje.getMonth() - 1);
        dataInicio = mesAtras.toISOString().split('T')[0];
        break;
    }
    
    const result = await getSessoes({ 
      dataInicio,
      dataFim: hoje.toISOString().split('T')[0],
    });
    
    setSessoes(result);
    
    // Calcular total
    const total = result.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0);
    setTotalMinutos(total);
    
    logger.debug('database', `Loaded ${result.length} sessions for ${filter}`);
  };
  
  useEffect(() => {
    loadSessoes();
  }, [filter]);
  
  const onRefresh = async () => {
    setRefreshing(true);
    await refreshData();
    await loadSessoes();
    setRefreshing(false);
  };
  
  // Agrupar sessões por dia
  const sessoesPorDia = sessoes.reduce((acc, sessao) => {
    const dia = sessao.inicio.split('T')[0];
    if (!acc[dia]) {
      acc[dia] = [];
    }
    acc[dia].push(sessao);
    return acc;
  }, {} as Record<string, SessaoDB[]>);
  
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T00:00:00');
    const hoje = new Date().toISOString().split('T')[0];
    const ontem = new Date(Date.now() - 86400000).toISOString().split('T')[0];
    
    if (dateStr === hoje) return 'Hoje';
    if (dateStr === ontem) return 'Ontem';
    
    return date.toLocaleDateString('pt-BR', { 
      weekday: 'long', 
      day: 'numeric', 
      month: 'short' 
    });
  };
  
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>📋 Histórico</Text>
        <Text style={styles.subtitle}>Seus registros de trabalho</Text>
      </View>
      
      {/* Filtros */}
      <View style={styles.filterContainer}>
        {(['hoje', 'semana', 'mes'] as FilterPeriod[]).map((period) => (
          <TouchableOpacity
            key={period}
            style={[styles.filterButton, filter === period && styles.filterActive]}
            onPress={() => setFilter(period)}
          >
            <Text style={[styles.filterText, filter === period && styles.filterTextActive]}>
              {period === 'hoje' ? 'Hoje' : period === 'semana' ? '7 dias' : '30 dias'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
      
      {/* Total */}
      <View style={styles.totalCard}>
        <Text style={styles.totalLabel}>Total no período</Text>
        <Text style={styles.totalValue}>{useFormatDuration(totalMinutos)}</Text>
        <Text style={styles.totalSessions}>{sessoes.length} sessões</Text>
      </View>
      
      {/* Lista de Sessões */}
      <ScrollView 
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {sessoes.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyEmoji}>📭</Text>
            <Text style={styles.emptyText}>Nenhum registro encontrado</Text>
            <Text style={styles.emptySubtext}>
              Os registros aparecerão aqui quando você entrar em um local de trabalho
            </Text>
          </View>
        ) : (
          Object.entries(sessoesPorDia).map(([dia, sessoesDia]) => {
            const totalDia = sessoesDia.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0);
            
            return (
              <View key={dia} style={styles.dayGroup}>
                <View style={styles.dayHeader}>
                  <Text style={styles.dayTitle}>{formatDate(dia)}</Text>
                  <Text style={styles.dayTotal}>{useFormatDuration(totalDia)}</Text>
                </View>
                
                {sessoesDia.map((sessao) => (
                  <View key={sessao.id} style={styles.sessaoCard}>
                    <View style={styles.sessaoLeft}>
                      <View style={styles.timeline}>
                        <View style={[styles.dot, styles.dotStart]} />
                        <View style={styles.line} />
                        <View style={[styles.dot, sessao.fim ? styles.dotEnd : styles.dotActive]} />
                      </View>
                      <View style={styles.times}>
                        <Text style={styles.time}>
                          {new Date(sessao.inicio).toLocaleTimeString('pt-BR', { 
                            hour: '2-digit', 
                            minute: '2-digit' 
                          })}
                        </Text>
                        <Text style={styles.time}>
                          {sessao.fim 
                            ? new Date(sessao.fim).toLocaleTimeString('pt-BR', { 
                                hour: '2-digit', 
                                minute: '2-digit' 
                              })
                            : '...'}
                        </Text>
                      </View>
                    </View>
                    
                    <View style={styles.sessaoRight}>
                      <Text style={styles.sessaoLocal}>{sessao.local_nome}</Text>
                      <Text style={[styles.sessaoDuracao, !sessao.fim && styles.emAndamento]}>
                        {sessao.duracao_minutos 
                          ? useFormatDuration(sessao.duracao_minutos)
                          : '⏳ Em andamento'}
                      </Text>
                    </View>
                  </View>
                ))}
              </View>
            );
          })
        )}
        
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
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  filterContainer: {
    flexDirection: 'row',
    padding: 16,
    gap: 8,
  },
  filterButton: {
    flex: 1,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    alignItems: 'center',
  },
  filterActive: {
    backgroundColor: colors.primary,
  },
  filterText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.textSecondary,
  },
  filterTextActive: {
    color: colors.white,
  },
  totalCard: {
    margin: 16,
    marginTop: 0,
    padding: 20,
    backgroundColor: colors.primary,
    borderRadius: 16,
    alignItems: 'center',
  },
  totalLabel: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  totalValue: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.white,
    marginVertical: 4,
  },
  totalSessions: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
  },
  scrollView: {
    flex: 1,
  },
  emptyState: {
    padding: 40,
    alignItems: 'center',
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 8,
  },
  emptySubtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
  },
  dayGroup: {
    marginBottom: 16,
  },
  dayHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  dayTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    textTransform: 'capitalize',
  },
  dayTotal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  sessaoCard: {
    flexDirection: 'row',
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 8,
    borderRadius: 12,
    padding: 16,
  },
  sessaoLeft: {
    flexDirection: 'row',
    marginRight: 16,
  },
  timeline: {
    width: 12,
    alignItems: 'center',
    marginRight: 8,
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dotStart: {
    backgroundColor: colors.success,
  },
  dotEnd: {
    backgroundColor: colors.error,
  },
  dotActive: {
    backgroundColor: colors.warning,
  },
  line: {
    flex: 1,
    width: 2,
    backgroundColor: colors.border,
    marginVertical: 2,
  },
  times: {
    justifyContent: 'space-between',
  },
  time: {
    fontSize: 12,
    color: colors.textSecondary,
    fontFamily: 'monospace',
  },
  sessaoRight: {
    flex: 1,
    justifyContent: 'center',
  },
  sessaoLocal: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 4,
  },
  sessaoDuracao: {
    fontSize: 14,
    color: colors.primary,
    fontWeight: '600',
  },
  emAndamento: {
    color: colors.warning,
  },
});
HISTORYSCREEN

echo "✅ history.tsx criado!"

# ============================================
# Atualizar _layout.tsx para inicializar banco
# ============================================
cat > app/_layout.tsx << 'ROOTLAYOUT'
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useRegistroStore } from '../src/stores/registroStore';
import { DevMonitor } from '../src/components/DevMonitor';
import { logger } from '../src/lib/logger';
import { colors } from '../src/constants/colors';

export default function RootLayout() {
  const { initialize: initAuth, isLoading } = useAuthStore();
  const { initialize: initRegistros } = useRegistroStore();
  
  useEffect(() => {
    logger.info('auth', 'App starting...');
    initAuth();
    initRegistros();
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <DevMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
ROOTLAYOUT

echo "✅ _layout.tsx atualizado!"

echo ""
echo "✅✅✅ CHECKPOINT 4 - ARQUIVOS CRIADOS! ✅✅✅"
echo ""
echo "Agora reinicie o servidor Expo:"
echo "  npx expo start -c"
echo ""
