import { useEffect } from 'react';
import { useLocationStore } from '../stores/locationStore';

export function useLocation() {
  const store = useLocationStore();

  useEffect(() => {
    store.initialize();
  }, []);

  return store;
}

export function useCurrentLocation() {
  const { currentLocation, accuracy, lastUpdate, refreshLocation } =
    useLocationStore();

  return {
    location: currentLocation,
    accuracy,
    lastUpdate,
    refresh: refreshLocation,
  };
}

export function useGeofences() {
  const {
    locais,
    activeGeofence,
    isGeofencingActive,
    addLocal,
    removeLocal,
    updateLocal,
    startGeofenceMonitoring,
    stopGeofenceMonitoring,
  } = useLocationStore();

  const activeLocal = locais.find((l) => l.id === activeGeofence);

  return {
    locais,
    activeLocal,
    isMonitoring: isGeofencingActive,
    addLocal,
    removeLocal,
    updateLocal,
    startMonitoring: startGeofenceMonitoring,
    stopMonitoring: stopGeofenceMonitoring,
  };
}
