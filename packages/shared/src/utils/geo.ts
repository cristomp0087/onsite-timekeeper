/**
 * Utilitários para cálculos geográficos
 */

import type { Coordinates } from '../types/models';

/**
 * Raio da Terra em metros
 */
const EARTH_RADIUS_METERS = 6371000;

/**
 * Converte graus para radianos
 */
function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Calcula a distância entre dois pontos usando a fórmula de Haversine
 * Retorna a distância em metros
 */
export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const lat1 = toRadians(point1.latitude);
  const lat2 = toRadians(point2.latitude);
  const deltaLat = toRadians(point2.latitude - point1.latitude);
  const deltaLon = toRadians(point2.longitude - point1.longitude);

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) *
      Math.cos(lat2) *
      Math.sin(deltaLon / 2) *
      Math.sin(deltaLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_METERS * c;
}

/**
 * Verifica se um ponto está dentro de um círculo (geofence)
 */
export function isInsideGeofence(
  point: Coordinates,
  center: Coordinates,
  radiusMeters: number
): boolean {
  const distance = calculateDistance(point, center);
  return distance <= radiusMeters;
}

/**
 * Encontra o geofence mais próximo de um ponto
 */
export function findNearestGeofence<
  T extends { center: Coordinates; radius: number },
>(
  point: Coordinates,
  geofences: T[]
): { geofence: T; distance: number } | null {
  if (geofences.length === 0) {
    return null;
  }

  let nearest: { geofence: T; distance: number } | null = null;

  for (const geofence of geofences) {
    const distance = calculateDistance(point, geofence.center);

    if (!nearest || distance < nearest.distance) {
      nearest = { geofence, distance };
    }
  }

  return nearest;
}

/**
 * Encontra todos os geofences que contêm um ponto
 */
export function findContainingGeofences<
  T extends { center: Coordinates; radius: number },
>(point: Coordinates, geofences: T[]): T[] {
  return geofences.filter((geofence) =>
    isInsideGeofence(point, geofence.center, geofence.radius)
  );
}

/**
 * Calcula o bearing (direção) entre dois pontos
 * Retorna ângulo em graus (0-360, onde 0 é Norte)
 */
export function calculateBearing(from: Coordinates, to: Coordinates): number {
  const lat1 = toRadians(from.latitude);
  const lat2 = toRadians(to.latitude);
  const deltaLon = toRadians(to.longitude - from.longitude);

  const y = Math.sin(deltaLon) * Math.cos(lat2);
  const x =
    Math.cos(lat1) * Math.sin(lat2) -
    Math.sin(lat1) * Math.cos(lat2) * Math.cos(deltaLon);

  let bearing = Math.atan2(y, x) * (180 / Math.PI);

  // Normaliza para 0-360
  bearing = (bearing + 360) % 360;

  return bearing;
}

/**
 * Formata distância para exibição
 */
export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}

/**
 * Valida se coordenadas são válidas
 */
export function isValidCoordinates(
  coords: Partial<Coordinates>
): coords is Coordinates {
  if (
    typeof coords.latitude !== 'number' ||
    typeof coords.longitude !== 'number'
  ) {
    return false;
  }

  // Latitude: -90 a 90
  if (coords.latitude < -90 || coords.latitude > 90) {
    return false;
  }

  // Longitude: -180 a 180
  if (coords.longitude < -180 || coords.longitude > 180) {
    return false;
  }

  return true;
}

/**
 * Retorna região aproximada baseada nas coordenadas (Brasil)
 * Usado para analytics anonimizados
 */
export function getApproximateRegion(coords: Coordinates): string {
  const { latitude } = coords;

  // Divisão aproximada das regiões do Brasil
  if (latitude < -26) return 'sul';
  if (latitude < -19) return 'sudeste';
  if (latitude < -12) return 'centro-oeste';
  if (latitude < -5) return 'nordeste';
  return 'norte';
}
