#!/bin/bash

# ============================================
# OnSite Flow - Checkpoint 3: GPS + Geofencing
# ============================================

echo "🚀 Configurando GPS e Geofencing..."

# ============================================
# src/lib/location.ts - Serviço de Localização
# ============================================
cat > src/lib/location.ts << 'LOCATION'
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
    
    logger.info('gps', `Foreground permission: ${granted ? 'granted' : 'denied'}`);
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
    
    logger.info('gps', `Background permission: ${granted ? 'granted' : 'denied'}`);
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

export async function startGeofencing(regions: GeofenceRegion[]): Promise<boolean> {
  try {
    const hasBackground = await requestBackgroundPermission();
    if (!hasBackground) {
      logger.warn('geofence', 'No background permission for geofencing');
      return false;
    }
    
    logger.info('geofence', `Starting geofencing for ${regions.length} regions`);
    
    await Location.startGeofencingAsync(GEOFENCE_TASK_NAME, regions.map(r => ({
      ...r,
      notifyOnEnter: r.notifyOnEnter ?? true,
      notifyOnExit: r.notifyOnExit ?? true,
    })));
    
    logger.info('geofence', 'Geofencing started successfully');
    return true;
  } catch (error) {
    logger.error('geofence', 'Error starting geofencing', { error });
    return false;
  }
}

export async function stopGeofencing(): Promise<void> {
  try {
    const isRunning = await Location.hasStartedGeofencingAsync(GEOFENCE_TASK_NAME);
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
    const isRunning = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME);
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
LOCATION

echo "✅ location.ts criado!"

# ============================================
# src/lib/backgroundTasks.ts - Tasks de Background
# ============================================
cat > src/lib/backgroundTasks.ts << 'BGTASKS'
import * as TaskManager from 'expo-task-manager';
import * as Location from 'expo-location';
import { logger } from './logger';
import { LOCATION_TASK_NAME, GEOFENCE_TASK_NAME, isInsideGeofence } from './location';

// Armazena callbacks para notificações
let onGeofenceEvent: ((event: GeofenceEvent) => void) | null = null;
let onLocationUpdate: ((location: Location.LocationObject) => void) | null = null;

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

export function setLocationCallback(callback: (location: Location.LocationObject) => void) {
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

    logger.info('geofence', `Geofence ${event.type}: ${event.regionIdentifier}`, {
      type: event.type,
      region: event.regionIdentifier,
    });

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
    logger.error('gps', 'Background location task error', { error: error.message });
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
BGTASKS

echo "✅ backgroundTasks.ts criado!"

# ============================================
# src/stores/locationStore.ts - Estado de Localização
# ============================================
cat > src/stores/locationStore.ts << 'LOCSTORE'
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  getCurrentLocation,
  startWatchingLocation,
  stopWatchingLocation,
  startGeofencing,
  stopGeofencing,
  startBackgroundLocation,
  stopBackgroundLocation,
  checkPermissions,
  calculateDistance,
  isInsideGeofence,
  type Coordinates,
  type LocationResult,
  type GeofenceRegion,
} from '../lib/location';
import { setGeofenceCallback, type GeofenceEvent } from '../lib/backgroundTasks';

export interface LocalDeTrabalho {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  ativo: boolean;
}

interface LocationState {
  // Permissões
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  
  // Localização atual
  currentLocation: Coordinates | null;
  accuracy: number | null;
  lastUpdate: number | null;
  isWatching: boolean;
  
  // Geofencing
  locais: LocalDeTrabalho[];
  activeGeofence: string | null; // ID do local onde está
  isGeofencingActive: boolean;
  isBackgroundActive: boolean;
  
  // Eventos
  lastGeofenceEvent: GeofenceEvent | null;
  
  // Actions
  initialize: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  
  addLocal: (local: Omit<LocalDeTrabalho, 'id'>) => void;
  removeLocal: (id: string) => void;
  updateLocal: (id: string, updates: Partial<LocalDeTrabalho>) => void;
  
  startGeofenceMonitoring: () => Promise<void>;
  stopGeofenceMonitoring: () => Promise<void>;
  
  checkCurrentGeofence: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
  // Estado inicial
  hasPermission: false,
  hasBackgroundPermission: false,
  currentLocation: null,
  accuracy: null,
  lastUpdate: null,
  isWatching: false,
  locais: [],
  activeGeofence: null,
  isGeofencingActive: false,
  isBackgroundActive: false,
  lastGeofenceEvent: null,
  
  // ============================================
  // Inicializar
  // ============================================
  initialize: async () => {
    logger.info('gps', 'Initializing location store');
    
    // Importar tasks de background
    await import('../lib/backgroundTasks');
    
    // Verificar permissões existentes
    const permissions = await checkPermissions();
    set({
      hasPermission: permissions.foreground,
      hasBackgroundPermission: permissions.background,
    });
    
    // Configurar callback de geofence
    setGeofenceCallback((event) => {
      logger.info('geofence', `Event received: ${event.type} - ${event.regionIdentifier}`);
      set({ 
        lastGeofenceEvent: event,
        activeGeofence: event.type === 'enter' ? event.regionIdentifier : null,
      });
    });
    
    // Tentar obter localização inicial
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
        hasPermission: true,
      });
    }
  },
  
  // ============================================
  // Atualizar localização
  // ============================================
  refreshLocation: async () => {
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
      });
      
      // Verificar se está em algum geofence
      get().checkCurrentGeofence();
    }
  },
  
  // ============================================
  // Tracking em tempo real
  // ============================================
  startTracking: async () => {
    const success = await startWatchingLocation((location) => {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
      });
      get().checkCurrentGeofence();
    });
    
    if (success) {
      set({ isWatching: true, hasPermission: true });
    }
  },
  
  stopTracking: async () => {
    await stopWatchingLocation();
    set({ isWatching: false });
  },
  
  // ============================================
  // Gerenciar locais
  // ============================================
  addLocal: (local) => {
    const newLocal: LocalDeTrabalho = {
      ...local,
      id: `local_${Date.now()}`,
    };
    
    logger.info('geofence', 'Adding new local', { nome: local.nome });
    set((state) => ({ locais: [...state.locais, newLocal] }));
  },
  
  removeLocal: (id) => {
    logger.info('geofence', 'Removing local', { id });
    set((state) => ({ 
      locais: state.locais.filter(l => l.id !== id),
      activeGeofence: state.activeGeofence === id ? null : state.activeGeofence,
    }));
  },
  
  updateLocal: (id, updates) => {
    set((state) => ({
      locais: state.locais.map(l => l.id === id ? { ...l, ...updates } : l),
    }));
  },
  
  // ============================================
  // Geofence Monitoring
  // ============================================
  startGeofenceMonitoring: async () => {
    const { locais } = get();
    const activeLocais = locais.filter(l => l.ativo);
    
    if (activeLocais.length === 0) {
      logger.warn('geofence', 'No active locations to monitor');
      return;
    }
    
    const regions: GeofenceRegion[] = activeLocais.map(local => ({
      identifier: local.id,
      latitude: local.latitude,
      longitude: local.longitude,
      radius: local.raio,
      notifyOnEnter: true,
      notifyOnExit: true,
    }));
    
    const success = await startGeofencing(regions);
    if (success) {
      set({ isGeofencingActive: true, hasBackgroundPermission: true });
      
      // Também iniciar background location para precisão
      await startBackgroundLocation();
      set({ isBackgroundActive: true });
    }
  },
  
  stopGeofenceMonitoring: async () => {
    await stopGeofencing();
    await stopBackgroundLocation();
    set({ isGeofencingActive: false, isBackgroundActive: false });
  },
  
  // ============================================
  // Verificar geofence atual
  // ============================================
  checkCurrentGeofence: () => {
    const { currentLocation, locais } = get();
    if (!currentLocation) return;
    
    const activeLocais = locais.filter(l => l.ativo);
    
    for (const local of activeLocais) {
      const inside = isInsideGeofence(currentLocation, {
        identifier: local.id,
        latitude: local.latitude,
        longitude: local.longitude,
        radius: local.raio,
      });
      
      if (inside) {
        if (get().activeGeofence !== local.id) {
          logger.info('geofence', `Now inside: ${local.nome}`);
          set({ activeGeofence: local.id });
        }
        return;
      }
    }
    
    // Não está em nenhum geofence
    if (get().activeGeofence !== null) {
      logger.info('geofence', 'Left all geofences');
      set({ activeGeofence: null });
    }
  },
}));
LOCSTORE

echo "✅ locationStore.ts criado!"

# ============================================
# src/hooks/useLocation.ts - Hook customizado
# ============================================
cat > src/hooks/useLocation.ts << 'USELOC'
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
  const { currentLocation, accuracy, lastUpdate, refreshLocation } = useLocationStore();
  
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
  
  const activeLocal = locais.find(l => l.id === activeGeofence);
  
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
USELOC

echo "✅ useLocation.ts criado!"

# ============================================
# Atualizar app/(tabs)/map.tsx - Tela do Mapa
# ============================================
cat > 'app/(tabs)/map.tsx' << 'MAPSCREEN'
import React, { useState, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  TouchableOpacity, 
  Alert,
  ScrollView,
  TextInput,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocation, useGeofences, useCurrentLocation } from '../../src/hooks/useLocation';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/constants/colors';
import { formatDistance, calculateDistance } from '../../src/lib/location';

export default function MapScreen() {
  const { hasPermission, hasBackgroundPermission, isWatching, startTracking, stopTracking } = useLocation();
  const { location, accuracy, refresh } = useCurrentLocation();
  const { locais, activeLocal, isMonitoring, addLocal, removeLocal, startMonitoring, stopMonitoring } = useGeofences();
  
  const [showAddModal, setShowAddModal] = useState(false);
  const [newLocalName, setNewLocalName] = useState('');
  const [newLocalRaio, setNewLocalRaio] = useState('50');
  
  // Inicializar ao montar
  useEffect(() => {
    refresh();
  }, []);
  
  const handleAddLocal = () => {
    if (!location) {
      Alert.alert('Erro', 'Aguarde obter sua localização primeiro');
      return;
    }
    
    if (!newLocalName.trim()) {
      Alert.alert('Erro', 'Digite um nome para o local');
      return;
    }
    
    addLocal({
      nome: newLocalName.trim(),
      latitude: location.latitude,
      longitude: location.longitude,
      raio: parseInt(newLocalRaio) || 50,
      cor: `#${Math.floor(Math.random()*16777215).toString(16).padStart(6, '0')}`,
      ativo: true,
    });
    
    setNewLocalName('');
    setNewLocalRaio('50');
    setShowAddModal(false);
    
    Alert.alert('Sucesso', 'Local adicionado! Ative o monitoramento para começar.');
  };
  
  const handleToggleMonitoring = async () => {
    if (isMonitoring) {
      await stopMonitoring();
    } else {
      if (locais.length === 0) {
        Alert.alert('Erro', 'Adicione pelo menos um local primeiro');
        return;
      }
      await startMonitoring();
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <ScrollView style={styles.scrollView}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.title}>🗺️ Mapa</Text>
          <Text style={styles.subtitle}>Gerencie seus locais de trabalho</Text>
        </View>
        
        {/* Status de Permissões */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📱 Permissões</Text>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>GPS (foreground):</Text>
            <Text style={[styles.statusValue, hasPermission ? styles.statusOk : styles.statusNo]}>
              {hasPermission ? '✅ Permitido' : '❌ Negado'}
            </Text>
          </View>
          <View style={styles.statusRow}>
            <Text style={styles.statusLabel}>GPS (background):</Text>
            <Text style={[styles.statusValue, hasBackgroundPermission ? styles.statusOk : styles.statusNo]}>
              {hasBackgroundPermission ? '✅ Permitido' : '⚠️ Não solicitado'}
            </Text>
          </View>
        </View>
        
        {/* Localização Atual */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>📍 Sua Localização</Text>
          {location ? (
            <>
              <Text style={styles.coordText}>
                Lat: {location.latitude.toFixed(6)}
              </Text>
              <Text style={styles.coordText}>
                Lng: {location.longitude.toFixed(6)}
              </Text>
              {accuracy && (
                <Text style={styles.accuracyText}>
                  Precisão: ~{accuracy.toFixed(0)}m
                </Text>
              )}
            </>
          ) : (
            <Text style={styles.noDataText}>Obtendo localização...</Text>
          )}
          
          <View style={styles.buttonRow}>
            <Button 
              title="🔄 Atualizar" 
              onPress={refresh}
              variant="outline"
              style={styles.smallButton}
            />
            <Button 
              title={isWatching ? "⏹️ Parar" : "▶️ Tempo Real"} 
              onPress={isWatching ? stopTracking : startTracking}
              variant={isWatching ? "secondary" : "primary"}
              style={styles.smallButton}
            />
          </View>
        </View>
        
        {/* Geofence Ativo */}
        {activeLocal && (
          <View style={[styles.card, styles.activeCard]}>
            <Text style={styles.cardTitle}>🎯 VOCÊ ESTÁ EM:</Text>
            <Text style={styles.activeLocalName}>{activeLocal.nome}</Text>
          </View>
        )}
        
        {/* Lista de Locais */}
        <View style={styles.card}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardTitle}>📋 Locais ({locais.length})</Text>
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Text style={styles.addButton}>+ Adicionar</Text>
            </TouchableOpacity>
          </View>
          
          {locais.length === 0 ? (
            <Text style={styles.noDataText}>
              Nenhum local cadastrado.{'\n'}
              Toque em "+ Adicionar" para criar um local na sua posição atual.
            </Text>
          ) : (
            locais.map((local) => {
              const distance = location 
                ? calculateDistance(location, { latitude: local.latitude, longitude: local.longitude })
                : null;
              
              return (
                <View key={local.id} style={styles.localItem}>
                  <View style={[styles.localColor, { backgroundColor: local.cor }]} />
                  <View style={styles.localInfo}>
                    <Text style={styles.localName}>{local.nome}</Text>
                    <Text style={styles.localDetails}>
                      Raio: {local.raio}m
                      {distance !== null && ` • ${formatDistance(distance)} de distância`}
                    </Text>
                  </View>
                  <TouchableOpacity 
                    onPress={() => {
                      Alert.alert(
                        'Remover Local',
                        `Deseja remover "${local.nome}"?`,
                        [
                          { text: 'Cancelar', style: 'cancel' },
                          { text: 'Remover', style: 'destructive', onPress: () => removeLocal(local.id) },
                        ]
                      );
                    }}
                  >
                    <Text style={styles.removeButton}>🗑️</Text>
                  </TouchableOpacity>
                </View>
              );
            })
          )}
        </View>
        
        {/* Controle de Monitoramento */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🔔 Monitoramento</Text>
          <Text style={styles.monitoringStatus}>
            Status: {isMonitoring ? '🟢 Ativo' : '⚫ Inativo'}
          </Text>
          <Button
            title={isMonitoring ? '⏹️ Parar Monitoramento' : '▶️ Iniciar Monitoramento'}
            onPress={handleToggleMonitoring}
            variant={isMonitoring ? 'secondary' : 'primary'}
            disabled={locais.length === 0}
          />
          {locais.length === 0 && (
            <Text style={styles.hintText}>
              Adicione locais acima para poder monitorar
            </Text>
          )}
        </View>
        
        <View style={{ height: 100 }} />
      </ScrollView>
      
      {/* Modal Adicionar Local */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowAddModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>➕ Adicionar Local</Text>
            
            <Text style={styles.inputLabel}>Nome do Local</Text>
            <TextInput
              style={styles.input}
              placeholder="Ex: Escritório, Obra, Cliente"
              value={newLocalName}
              onChangeText={setNewLocalName}
            />
            
            <Text style={styles.inputLabel}>Raio (metros)</Text>
            <TextInput
              style={styles.input}
              placeholder="50"
              value={newLocalRaio}
              onChangeText={setNewLocalRaio}
              keyboardType="number-pad"
            />
            
            <Text style={styles.modalHint}>
              📍 O local será criado na sua posição atual
            </Text>
            
            <View style={styles.modalButtons}>
              <Button
                title="Cancelar"
                onPress={() => setShowAddModal(false)}
                variant="outline"
                style={{ flex: 1, marginRight: 8 }}
              />
              <Button
                title="Adicionar"
                onPress={handleAddLocal}
                style={{ flex: 1, marginLeft: 8 }}
              />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.background,
    margin: 16,
    marginBottom: 0,
    padding: 16,
    borderRadius: 12,
  },
  activeCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: colors.success,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  statusLabel: {
    color: colors.textSecondary,
  },
  statusValue: {
    fontWeight: '500',
  },
  statusOk: {
    color: colors.success,
  },
  statusNo: {
    color: colors.warning,
  },
  coordText: {
    fontFamily: 'monospace',
    fontSize: 14,
    color: colors.text,
    marginBottom: 4,
  },
  accuracyText: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 4,
  },
  noDataText: {
    color: colors.textTertiary,
    fontStyle: 'italic',
    textAlign: 'center',
    padding: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 8,
  },
  smallButton: {
    flex: 1,
    paddingVertical: 10,
  },
  activeLocalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
    textAlign: 'center',
  },
  addButton: {
    color: colors.primary,
    fontWeight: '600',
  },
  localItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  localColor: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 12,
  },
  localInfo: {
    flex: 1,
  },
  localName: {
    fontSize: 16,
    fontWeight: '500',
    color: colors.text,
  },
  localDetails: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  removeButton: {
    fontSize: 20,
    padding: 8,
  },
  monitoringStatus: {
    fontSize: 16,
    marginBottom: 12,
    color: colors.text,
  },
  hintText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 8,
    textAlign: 'center',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    padding: 24,
  },
  modalContent: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 24,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: colors.text,
    marginBottom: 20,
    textAlign: 'center',
  },
  inputLabel: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  input: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 8,
    padding: 12,
    fontSize: 16,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: colors.border,
  },
  modalHint: {
    fontSize: 12,
    color: colors.textSecondary,
    textAlign: 'center',
    marginBottom: 20,
  },
  modalButtons: {
    flexDirection: 'row',
  },
});
MAPSCREEN

echo "✅ map.tsx atualizado!"

# ============================================
# Atualizar app/(tabs)/index.tsx - Home com GPS
# ============================================
cat > 'app/(tabs)/index.tsx' << 'HOMESCREEN'
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocation, useGeofences, useCurrentLocation } from '../../src/hooks/useLocation';
import { logger } from '../../src/lib/logger';
import { colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';
import { formatDistance, calculateDistance } from '../../src/lib/location';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const { initialize, isGeofencingActive, isBackgroundActive } = useLocation();
  const { location, accuracy } = useCurrentLocation();
  const { locais, activeLocal } = useGeofences();
  
  useEffect(() => {
    logger.info('auth', 'Home screen loaded', { userId: user?.id });
    initialize();
  }, []);
  
  // Calcular distância do local mais próximo
  const nearestLocal = location && locais.length > 0
    ? locais.reduce((nearest, local) => {
        const dist = calculateDistance(location, { latitude: local.latitude, longitude: local.longitude });
        if (!nearest || dist < nearest.distance) {
          return { local, distance: dist };
        }
        return nearest;
      }, null as { local: typeof locais[0]; distance: number } | null)
    : null;
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>👋 Olá!</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      {/* Status Card */}
      <View style={[
        styles.card, 
        activeLocal ? styles.activeCard : null
      ]}>
        <Text style={styles.cardTitle}>📍 Status</Text>
        {activeLocal ? (
          <>
            <Text style={styles.activeStatus}>TRABALHANDO</Text>
            <Text style={styles.activeLocalName}>{activeLocal.nome}</Text>
          </>
        ) : (
          <>
            <Text style={styles.inactiveStatus}>Fora do local de trabalho</Text>
            {nearestLocal && (
              <Text style={styles.nearestText}>
                Mais próximo: {nearestLocal.local.nome} ({formatDistance(nearestLocal.distance)})
              </Text>
            )}
            {locais.length === 0 && (
              <Text style={styles.hint}>
                Vá até a aba Mapa para adicionar locais de trabalho
              </Text>
            )}
          </>
        )}
      </View>
      
      {/* Horas Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱️ Hoje</Text>
        <Text style={styles.bigNumber}>0h 00min</Text>
        <Text style={styles.hint}>Nenhum registro hoje</Text>
      </View>
      
      {/* GPS Info Card */}
      <View style={styles.card}>
        <Text style={styles.cardTitle}>🛰️ GPS</Text>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Localização:</Text>
          <Text style={styles.gpsValue}>
            {location 
              ? `${location.latitude.toFixed(4)}, ${location.longitude.toFixed(4)}`
              : 'Obtendo...'
            }
          </Text>
        </View>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Precisão:</Text>
          <Text style={styles.gpsValue}>
            {accuracy ? `~${accuracy.toFixed(0)}m` : '-'}
          </Text>
        </View>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Monitoramento:</Text>
          <Text style={[styles.gpsValue, isGeofencingActive ? styles.activeText : null]}>
            {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
          </Text>
        </View>
        <View style={styles.gpsRow}>
          <Text style={styles.gpsLabel}>Background:</Text>
          <Text style={[styles.gpsValue, isBackgroundActive ? styles.activeText : null]}>
            {isBackgroundActive ? '🟢 Ativo' : '⚫ Inativo'}
          </Text>
        </View>
      </View>
      
      {/* Test DevMonitor */}
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>🧪 Teste o DevMonitor:</Text>
        <Button 
          title="Gerar Logs de Teste" 
          onPress={() => {
            logger.debug('perf', 'Debug test', { test: true });
            logger.info('gps', 'GPS position update', { 
              lat: location?.latitude || 45.4215, 
              lng: location?.longitude || -75.6972 
            });
            logger.warn('sync', 'Sync retry warning', { attempt: 2 });
            logger.error('api', 'API error test', { status: 500 });
          }}
          variant="outline"
        />
        <Text style={styles.testHint}>
          Toque no botão 🔍 no canto inferior direito para ver os logs!
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
    padding: 16,
  },
  header: {
    marginBottom: 24,
  },
  greeting: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  email: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  card: {
    backgroundColor: colors.background,
    borderRadius: 16,
    padding: 20,
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
  },
  activeCard: {
    backgroundColor: '#DCFCE7',
    borderWidth: 2,
    borderColor: colors.success,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  activeStatus: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
    marginBottom: 4,
  },
  activeLocalName: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.success,
  },
  inactiveStatus: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  nearestText: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
  },
  hint: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  gpsLabel: {
    color: colors.textSecondary,
    fontSize: 14,
  },
  gpsValue: {
    color: colors.text,
    fontSize: 14,
    fontFamily: 'monospace',
  },
  activeText: {
    color: colors.success,
    fontWeight: '600',
  },
  testSection: {
    marginTop: 'auto',
    padding: 16,
    backgroundColor: colors.background,
    borderRadius: 16,
  },
  testTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  testHint: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 12,
    textAlign: 'center',
  },
});
HOMESCREEN

echo "✅ index.tsx (home) atualizado!"

echo ""
echo "✅✅✅ CHECKPOINT 3 - ARQUIVOS CRIADOS! ✅✅✅"
echo ""
echo "Agora reinicie o servidor Expo:"
echo "  npx expo start -c"
echo ""
