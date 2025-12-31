/**
 * Tipos gerados a partir do schema do Supabase
 * Estes tipos representam as tabelas do banco de dados
 */

// ===========================================
// ENUMS
// ===========================================

export type RegistroTipo = 'trabalho' | 'visita';

export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';

export type LogCategory =
  | 'auth'
  | 'gps'
  | 'geofence'
  | 'sync'
  | 'database'
  | 'api'
  | 'security'
  | 'perf';

// ===========================================
// TABELAS DO BANCO
// ===========================================

/**
 * Perfil do usuário (extensão do auth.users)
 */
export interface Profile {
  id: string; // UUID, referência a auth.users
  nome: string;
  email: string;
  cor_padrao: string;
  horario_inicio: string; // TIME como string "HH:MM:SS"
  horario_fim: string;
  timezone: string;
  created_at: string; // ISO timestamp
  updated_at: string;
}

/**
 * Local de trabalho com geofence
 */
export interface Local {
  id: string; // UUID
  user_id: string; // FK para profiles
  nome: string;
  latitude: number;
  longitude: number;
  raio: number; // em metros, 10-2000
  cor: string; // hex color
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * Registro de ponto (entrada/saída)
 */
export interface Registro {
  id: string; // UUID
  user_id: string; // FK para profiles
  local_id: string | null; // FK para locais (pode ser null se deletado)
  local_nome: string; // Nome salvo no momento do registro
  entrada: string; // ISO timestamp
  saida: string | null; // null = ainda trabalhando
  tipo: RegistroTipo;
  editado_manualmente: boolean;
  motivo_edicao: string | null;
  hash_integridade: string | null;
  cor: string | null;
  device_id: string | null;
  created_at: string;
  synced_at: string | null;
}

/**
 * Log de aplicação
 */
export interface AppLog {
  id: string; // UUID
  timestamp: string; // ISO timestamp
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata: Record<string, unknown>;
  user_id: string | null;
  device_id: string | null;
  app_version: string | null;
  created_at: string;
}

/**
 * Log de sincronização
 */
export interface SyncLog {
  id: string;
  user_id: string;
  device_id: string | null;
  action: 'push' | 'pull' | 'conflict';
  table_name: string;
  record_id: string | null;
  status: 'success' | 'error';
  error_message: string | null;
  created_at: string;
}

// ===========================================
// TIPOS PARA INSERÇÃO (sem campos automáticos)
// ===========================================

export type ProfileInsert = Omit<Profile, 'created_at' | 'updated_at'>;
export type ProfileUpdate = Partial<Omit<Profile, 'id' | 'created_at'>>;

export type LocalInsert = Omit<Local, 'id' | 'created_at' | 'updated_at'>;
export type LocalUpdate = Partial<Omit<Local, 'id' | 'user_id' | 'created_at'>>;

export type RegistroInsert = Omit<Registro, 'id' | 'created_at'>;
export type RegistroUpdate = Partial<
  Omit<Registro, 'id' | 'user_id' | 'created_at'>
>;

export type AppLogInsert = Omit<AppLog, 'id' | 'created_at'>;

// ===========================================
// TIPOS DE RESPOSTA DA API
// ===========================================

export interface ApiResponse<T> {
  data: T | null;
  error: ApiError | null;
}

export interface ApiError {
  message: string;
  code?: string;
  details?: unknown;
}

export interface PaginatedResponse<T> {
  data: T[];
  count: number;
  page: number;
  pageSize: number;
  hasMore: boolean;
}
