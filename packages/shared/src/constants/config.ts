/**
 * Configurações gerais do aplicativo
 */

export const appConfig = {
  // Nome do app
  name: 'OnSite Flow',

  // Versão (atualizar a cada release)
  version: '0.1.0',

  // Bundle ID
  bundleId: {
    ios: 'com.onsiteclub.flow',
    android: 'com.onsiteclub.flow',
  },

  // URLs
  urls: {
    website: 'https://onsiteflow.app',
    privacy: 'https://onsiteflow.app/privacidade',
    terms: 'https://onsiteflow.app/termos',
    support: 'https://onsiteflow.app/suporte',
  },

  // Contato
  contact: {
    email: 'suporte@onsiteclub.com',
  },
} as const;

export const syncConfig = {
  // Intervalo de sync automático (ms)
  autoSyncInterval: 300000, // 5 minutos

  // Máximo de tentativas antes de marcar como falha
  maxRetries: 5,

  // Delay entre tentativas (ms) - exponential backoff
  retryDelays: [1000, 5000, 15000, 60000, 300000],

  // Tamanho do batch de sync
  batchSize: 50,

  // Timeout para requisições (ms)
  requestTimeout: 30000,
} as const;

export const logConfig = {
  // Se deve logar no console em desenvolvimento
  enableConsole: true,

  // Se deve enviar para o servidor
  enableRemote: true,

  // Intervalo de flush de logs (ms)
  flushInterval: 10000, // 10 segundos

  // Máximo de logs na fila antes de flush forçado
  maxQueueSize: 50,

  // Níveis de log habilitados por ambiente
  enabledLevels: {
    development: ['debug', 'info', 'warn', 'error', 'security'],
    production: ['info', 'warn', 'error', 'security'],
  },
} as const;

export const storageKeys = {
  // Auth
  authToken: '@onsite/auth_token',
  refreshToken: '@onsite/refresh_token',
  userId: '@onsite/user_id',

  // Configurações do usuário
  userSettings: '@onsite/user_settings',

  // Cache
  localsCache: '@onsite/locals_cache',
  lastSyncAt: '@onsite/last_sync_at',

  // Estado do app
  onboardingComplete: '@onsite/onboarding_complete',
  deviceId: '@onsite/device_id',
} as const;

// Tipos
export type AppConfig = typeof appConfig;
export type SyncConfig = typeof syncConfig;
export type LogConfig = typeof logConfig;
export type StorageKeys = typeof storageKeys;
