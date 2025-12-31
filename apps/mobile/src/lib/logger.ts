import { supabase } from './supabase';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';
type LogCategory =
  | 'auth'
  | 'gps'
  | 'geofence'
  | 'sync'
  | 'database'
  | 'api'
  | 'security'
  | 'perf';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

// Fila de logs
const logQueue: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const CONFIG = {
  flushInterval: 10000,
  maxQueueSize: 50,
  enableConsole: __DEV__,
  enableRemote: true,
};

// Emojis para o console
const levelEmoji = {
  debug: '🔵',
  info: '🟢',
  warn: '🟡',
  error: '🔴',
  security: '🟣',
};

// Listeners para o DevMonitor
type LogListener = (entry: LogEntry & { timestamp: Date }) => void;
const listeners: LogListener[] = [];

export function addLogListener(listener: LogListener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

function notifyListeners(entry: LogEntry) {
  const entryWithTime = { ...entry, timestamp: new Date() };
  listeners.forEach((listener) => listener(entryWithTime));
}

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>
) {
  const entry: LogEntry = { level, category, message, metadata };

  // Notificar DevMonitor
  notifyListeners(entry);

  // Console em desenvolvimento
  if (CONFIG.enableConsole) {
    const emoji = levelEmoji[level];
    console.log(
      `${emoji} [${category.toUpperCase()}] ${message}`,
      metadata || ''
    );
  }

  // Adiciona à fila para envio
  if (CONFIG.enableRemote) {
    logQueue.push(entry);

    if (logQueue.length >= CONFIG.maxQueueSize) {
      flushLogs();
    }

    if (!flushTimeout) {
      flushTimeout = setTimeout(flushLogs, CONFIG.flushInterval);
    }
  }
}

async function flushLogs() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  if (logQueue.length === 0) return;

  const logsToSend = [...logQueue];
  logQueue.length = 0;

  try {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    const entries = logsToSend.map((entry) => ({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      metadata: entry.metadata || {},
      user_id: user?.id || null,
      app_version: '1.0.0',
    }));

    await supabase.from('app_logs').insert(entries);
  } catch (error) {
    if (__DEV__) console.error('Failed to flush logs:', error);
  }
}

// Helpers
export const logger = {
  debug: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) =>
    log('debug', cat, msg, meta),
  info: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) =>
    log('info', cat, msg, meta),
  warn: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) =>
    log('warn', cat, msg, meta),
  error: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) =>
    log('error', cat, msg, meta),
  security: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) =>
    log('security', cat, msg, meta),
};

export { flushLogs };
