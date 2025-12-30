/**
 * Utilities compartilhadas
 */

/**
 * Formata duração em segundos para HH:MM:SS
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

/**
 * Calcula hash de integridade para registro
 */
export function calcularHashIntegridade(
  entrada: string,
  saida: string | null,
  localId: string
): string {
  const data = `${entrada}|${saida || ''}|${localId}`;
  // Hash simples - será melhorado com crypto
  return btoa(data);
}

/**
 * Valida se coordenadas são válidas
 */
export function validarCoordenadas(lat: number, lng: number): boolean {
  return lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}