/**
 * Configurações de Geofence
 */

export const geofenceConfig = {
  // Raio padrão em metros
  defaultRadius: 50,

  // Limites de raio
  minRadius: 10,
  maxRadius: 2000,

  // Opções de raio para seleção
  radiusOptions: [25, 50, 100, 200, 500, 1000],

  // Tempo de permanência mínimo para considerar "dwell" (ms)
  dwellTime: 60000, // 1 minuto

  // Precisão mínima do GPS para considerar válido (metros)
  minAccuracy: 100,

  // Intervalo de verificação quando em background (ms)
  backgroundInterval: 1800000, // 30 minutos

  // Intervalo de verificação quando em foreground (ms)
  foregroundInterval: 10000, // 10 segundos
} as const;

export const notificationConfig = {
  // Tempo para auto-ação se usuário não responder (ms)
  autoActionDelay: 30000, // 30 segundos

  // Ações disponíveis na entrada
  enterActions: ['work', 'visit', 'ignore', 'delay'] as const,

  // Ações disponíveis na saída
  exitActions: ['end', 'end_early', 'ignore'] as const,

  // Ação padrão para entrada (quando timeout)
  defaultEnterAction: 'work' as const,

  // Ação padrão para saída (quando timeout)
  defaultExitAction: 'end' as const,
} as const;

export const workHoursConfig = {
  // Horário padrão de início de monitoramento
  defaultStart: '05:00',

  // Horário padrão de fim de monitoramento
  defaultEnd: '22:00',

  // Se deve monitorar fora do horário (usuário pode ativar)
  allowOutsideHours: true,
} as const;

// Tipo para configuração
export type GeofenceConfig = typeof geofenceConfig;
export type NotificationConfig = typeof notificationConfig;
export type WorkHoursConfig = typeof workHoursConfig;
