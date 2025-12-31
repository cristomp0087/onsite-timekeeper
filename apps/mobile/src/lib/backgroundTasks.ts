import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { logger } from './logger';
import {
  LOCATION_TASK_NAME,
  GEOFENCE_TASK_NAME,
  isInsideGeofence,
} from './location';

// Armazena callbacks para notificações
let onGeofenceEvent: ((event: GeofenceEvent) => void) | null = null;
let onLocationUpdate: ((location: Location.LocationObject) => void) | null =
  null;

export interface GeofenceEvent {
  type: 'enter' | 'exit';
  regionIdentifier: string;
  timestamp: number;
}

// ============================================
// Registrar callback de geofence
// ============================================
export function setGeofenceCallback(callback: (event: GeofenceEvent) => void) {
  onGeofenceEvent = callback;
}

export function setLocationCallback(
  callback: (location: Location.LocationObject) => void
) {
  onLocationUpdate = callback;
}

// ============================================
// Definir Task de Geofencing
// ============================================
TaskManager.defineTask(GEOFENCE_TASK_NAME, ({ data, error }) => {
  if (error) {
    logger.error('geofence', 'Geofence task error', { error: error.message });
    return;
  }

  if (data) {
    const { eventType, region } = data as {
      eventType: Location.GeofencingEventType;
      region: Location.LocationRegion;
    };

    const event: GeofenceEvent = {
      type: eventType === Location.GeofencingEventType.Enter ? 'enter' : 'exit',
      regionIdentifier: region.identifier || 'unknown',
      timestamp: Date.now(),
    };

    logger.info(
      'geofence',
      `Geofence ${event.type}: ${event.regionIdentifier}`,
      {
        type: event.type,
        region: event.regionIdentifier,
      }
    );

    // Chama callback se registrado
    if (onGeofenceEvent) {
      onGeofenceEvent(event);
    }
  }
});

// ============================================
// Definir Task de Background Location
// ============================================
TaskManager.defineTask(LOCATION_TASK_NAME, ({ data, error }) => {
  if (error) {
    logger.error('gps', 'Background location task error', {
      error: error.message,
    });
    return;
  }

  if (data) {
    const { locations } = data as { locations: Location.LocationObject[] };

    if (locations && locations.length > 0) {
      const location = locations[0];

      logger.debug('gps', 'Background location update', {
        lat: location.coords.latitude.toFixed(6),
        lng: location.coords.longitude.toFixed(6),
        accuracy: location.coords.accuracy?.toFixed(1) + 'm',
      });

      // Chama callback se registrado
      if (onLocationUpdate) {
        onLocationUpdate(location);
      }
    }
  }
});

// ============================================
// Verificar se tasks estão rodando
// ============================================
export async function isGeofencingRunning(): Promise<boolean> {
  return await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  return await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
}

logger.info('gps', 'Background tasks registered');
