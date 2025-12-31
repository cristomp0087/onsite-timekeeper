import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { logger } from './logger';

// Nome da task de background
export const LOCATION_TASK_NAME = 'onsite-flow-background-location';
export const GEOFENCE_TASK_NAME = 'onsite-flow-geofence';

// Tipos
export interface Coordinates {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  coords: Coordinates;
  accuracy: number | null;
  timestamp: number;
}

export interface GeofenceRegion {
  identifier: string;
  latitude: number;
  longitude: number;
  radius: number;
  notifyOnEnter?: boolean;
  notifyOnExit?: boolean;
}

// ============================================
// Permissões
// ============================================

export async function requestForegroundPermission(): Promise<boolean> {
  try {
    logger.info('gps', 'Requesting foreground location permission');

    const { status } = await Location.requestForegroundPermissionsAsync();
    const granted = status === 'granted';

    logger.info(
      'gps',
      `Foreground permission: ${granted ? 'granted' : 'denied'}`
    );
    return granted;
  } catch (error) {
    logger.error('gps', 'Error requesting foreground permission', { error });
    return false;
  }
}

export async function requestBackgroundPermission(): Promise<boolean> {
  try {
    logger.info('gps', 'Requesting background location permission');

    const { status } = await Location.requestBackgroundPermissionsAsync();
    const granted = status === 'granted';

    logger.info(
      'gps',
      `Background permission: ${granted ? 'granted' : 'denied'}`
    );
    return granted;
  } catch (error) {
    logger.error('gps', 'Error requesting background permission', { error });
    return false;
  }
}

export async function checkPermissions(): Promise<{
  foreground: boolean;
  background: boolean;
}> {
  const foreground = await Location.getForegroundPermissionsAsync();
  const background = await Location.getBackgroundPermissionsAsync();

  return {
    foreground: foreground.status === 'granted',
    background: background.status === 'granted',
  };
}

// ============================================
// Localização Atual
// ============================================

export async function getCurrentLocation(): Promise<LocationResult | null> {
  try {
    const hasPermission = await requestForegroundPermission();
    if (!hasPermission) {
      logger.warn('gps', 'No permission for location');
      return null;
    }

    logger.debug('gps', 'Getting current location...');

    const location = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

    const result: LocationResult = {
      coords: {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
      },
      accuracy: location.coords.accuracy,
      timestamp: location.timestamp,
    };

    logger.info('gps', 'Location obtained', {
      lat: result.coords.latitude.toFixed(6),
      lng: result.coords.longitude.toFixed(6),
      accuracy: result.accuracy?.toFixed(1) + 'm',
    });

    return result;
  } catch (error) {
    logger.error('gps', 'Error getting location', { error });
    return null;
  }
}

// ============================================
// Watch Location (tempo real)
// ============================================

let locationSubscription: Location.LocationSubscription | null = null;

export async function startWatchingLocation(
  onUpdate: (location: LocationResult) => void,
  options?: {
    accuracy?: Location.Accuracy;
    distanceInterval?: number;
    timeInterval?: number;
  }
): Promise<boolean> {
  try {
    const hasPermission = await requestForegroundPermission();
    if (!hasPermission) return false;

    // Para qualquer watch anterior
    await stopWatchingLocation();

    logger.info('gps', 'Starting location watch');

    locationSubscription = await Location.watchPositionAsync(
      {
        accuracy: options?.accuracy ?? Location.Accuracy.Balanced,
        distanceInterval: options?.distanceInterval ?? 10, // metros
        timeInterval: options?.timeInterval ?? 5000, // ms
      },
      (location) => {
        const result: LocationResult = {
          coords: {
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
          },
          accuracy: location.coords.accuracy,
          timestamp: location.timestamp,
        };

        logger.debug('gps', 'Location update', {
          lat: result.coords.latitude.toFixed(6),
          lng: result.coords.longitude.toFixed(6),
        });

        onUpdate(result);
      }
    );

    return true;
  } catch (error) {
    logger.error('gps', 'Error starting location watch', { error });
    return false;
  }
}

export async function stopWatchingLocation(): Promise<void> {
  if (locationSubscription) {
    logger.info('gps', 'Stopping location watch');
    locationSubscription.remove();
    locationSubscription = null;
  }
}

// ============================================
// Geofencing
// ============================================

export async function startGeofencing(
  regions: GeofenceRegion[]
): Promise<boolean> {
  try {
    const hasBackground = await requestBackgroundPermission();
    if (!hasBackground) {
      logger.warn('geofence', 'No background permission for geofencing');
      return false;
    }

    logger.info(
      'geofence',
      `Starting geofencing for ${regions.length} regions`
    );

    await Location.startGeofencingAsync(
      GEOFENCE_TASK_NAME,
      regions.map((r) => ({
        ...r,
        notifyOnEnter: r.notifyOnEnter ?? true,
        notifyOnExit: r.notifyOnExit ?? true,
      }))
    );

    logger.info('geofence', 'Geofencing started successfully');
    return true;
  } catch (error) {
    logger.error('geofence', 'Error starting geofencing', { error });
    return false;
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    const isRunning =
      await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
    if (isRunning) {
      logger.info('geofence', 'Stopping geofencing');
      await Location.stopGeofencingAsync(GEOFENCE_TASK_NAME);
    }
  } catch (error) {
    logger.error('geofence', 'Error stopping geofencing', { error });
  }
}

// ============================================
// Background Location Updates
// ============================================

export async function startBackgroundLocation(): Promise<boolean> {
  try {
    const hasBackground = await requestBackgroundPermission();
    if (!hasBackground) {
      logger.warn('gps', 'No background permission');
      return false;
    }

    logger.info('gps', 'Starting background location updates');

    await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
      accuracy: Location.Accuracy.Balanced,
      distanceInterval: 50, // metros - só atualiza se mover 50m
      timeInterval: 60000, // 1 minuto
      deferredUpdatesInterval: 300000, // 5 minutos
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'OnSite Flow',
        notificationBody: 'Monitorando sua localização',
        notificationColor: '#3B82F6',
      },
    });

    logger.info('gps', 'Background location started');
    return true;
  } catch (error) {
    logger.error('gps', 'Error starting background location', { error });
    return false;
  }
}

export async function stopBackgroundLocation(): Promise<void> {
  try {
    const isRunning =
      await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
    if (isRunning) {
      logger.info('gps', 'Stopping background location');
      await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
    }
  } catch (error) {
    logger.error('gps', 'Error stopping background location', { error });
  }
}

// ============================================
// Utilitários
// ============================================

export function calculateDistance(
  point1: Coordinates,
  point2: Coordinates
): number {
  const R = 6371e3; // metros
  const φ1 = (point1.latitude * Math.PI) / 180;
  const φ2 = (point2.latitude * Math.PI) / 180;
  const Δφ = ((point2.latitude - point1.latitude) * Math.PI) / 180;
  const Δλ = ((point2.longitude - point1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c; // metros
}

export function isInsideGeofence(
  position: Coordinates,
  geofence: GeofenceRegion
): boolean {
  const distance = calculateDistance(position, {
    latitude: geofence.latitude,
    longitude: geofence.longitude,
  });
  return distance <= geofence.radius;
}

export function formatDistance(meters: number): string {
  if (meters < 1000) {
    return `${Math.round(meters)}m`;
  }
  return `${(meters / 1000).toFixed(1)}km`;
}
