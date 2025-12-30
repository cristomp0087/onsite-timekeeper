/**
 * Constantes compartilhadas
 */

/**
 * Cores disponíveis para locais
 */
export const CORES_LOCAIS = [
  '#FF6B6B', // Vermelho
  '#4ECDC4', // Turquesa
  '#45B7D1', // Azul
  '#FFA07A', // Laranja claro
  '#98D8C8', // Verde menta
  '#F7DC6F', // Amarelo
  '#BB8FCE', // Roxo
  '#85C1E2', // Azul claro
] as const;

/**
 * Raio padrão de geofencing (metros)
 */
export const RAIO_PADRAO = 100;

/**
 * Raio mínimo permitido (metros)
 */
export const RAIO_MINIMO = 50;

/**
 * Raio máximo permitido (metros)
 */
export const RAIO_MAXIMO = 500;

/**
 * Tempo mínimo de sessão (segundos)
 */
export const SESSAO_MINIMA = 60; // 1 minuto

/**
 * Intervalo de sync automático (ms)
 */
export const SYNC_INTERVAL = 5 * 60 * 1000; // 5 minutos
