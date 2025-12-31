/**
 * Modelos de domínio usados no app
 * Estes tipos são usados na lógica de negócio, independente do banco
 */

// ===========================================
// GEOLOCALIZAÇÃO
// ===========================================

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface Position extends Coordinates {
  accuracy: number; // em metros
  altitude?: number;
  altitudeAccuracy?: number;
  heading?: number;
  speed?: number;
  timestamp: number;
}

export interface Geofence {
  id: string;
  nome: string;
  center: Coordinates;
  radius: number; // em metros
  cor: string;
}

export type GeofenceEvent = 'enter' | 'exit' | 'dwell';

export interface GeofenceTransition {
  event: GeofenceEvent;
  geofence: Geofence;
  position: Position;
  timestamp: number;
}

// ===========================================
// SESSÃO DE TRABALHO
// ===========================================

export interface WorkSession {
  id: string;
  localId: string;
  localNome: string;
  startTime: Date;
  endTime: Date | null;
  tipo: 'trabalho' | 'visita';
  isActive: boolean;
}

export interface WorkSessionSummary {
  totalHours: number;
  totalMinutes: number;
  formattedDuration: string;
}

// ===========================================
// RELATÓRIOS
// ===========================================

export interface ReportFilters {
  startDate: Date;
  endDate: Date;
  localIds?: string[];
  tipo?: 'trabalho' | 'visita' | 'todos';
}

export interface ReportEntry {
  date: Date;
  localNome: string;
  localCor: string;
  entrada: Date;
  saida: Date;
  duration: WorkSessionSummary;
  editadoManualmente: boolean;
}

export interface ReportSummary {
  periodo: {
    inicio: Date;
    fim: Date;
  };
  totalHoras: number;
  totalDias: number;
  mediaHorasPorDia: number;
  locaisVisitados: number;
  registrosEditados: number;
  entriesByLocal: Map<string, ReportEntry[]>;
}

export interface ExportedReport {
  text: string;
  hash: string;
  generatedAt: Date;
  isValid: boolean;
}

// ===========================================
// SYNC
// ===========================================

export type SyncStatus = 'idle' | 'syncing' | 'error' | 'offline';

export interface SyncQueueItem {
  id: number;
  tableName: string;
  recordId: string;
  action: 'insert' | 'update' | 'delete';
  payload: Record<string, unknown>;
  attempts: number;
  lastError?: string;
  createdAt: Date;
}

export interface SyncState {
  status: SyncStatus;
  pendingCount: number;
  lastSyncAt: Date | null;
  lastError: string | null;
}

// ===========================================
// NOTIFICAÇÕES
// ===========================================

export type NotificationAction =
  | 'work' // Iniciar trabalho
  | 'visit' // Registrar visita
  | 'ignore' // Ignorar
  | 'delay' // Daqui 30 minutos
  | 'end' // Encerrar
  | 'end_early'; // Encerrar 30 min atrás

export interface GeofenceNotification {
  id: string;
  type: 'enter' | 'exit';
  localNome: string;
  localId: string;
  timestamp: Date;
  actions: NotificationAction[];
  autoAction: NotificationAction;
  autoActionDelay: number; // segundos
}

// ===========================================
// UI STATE
// ===========================================

export interface AppState {
  isAuthenticated: boolean;
  isLoading: boolean;
  currentPosition: Position | null;
  currentGeofence: Geofence | null;
  activeSession: WorkSession | null;
  syncState: SyncState;
}

export type TabName = 'home' | 'map' | 'history' | 'settings';
