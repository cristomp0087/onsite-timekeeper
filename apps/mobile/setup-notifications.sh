#!/bin/bash

# ============================================
# OnSite Flow - Sistema de Notificações
# ============================================

echo "🔔 Configurando sistema de notificações..."

# ============================================
# src/lib/notifications.ts - Serviço de Notificações
# ============================================
cat > src/lib/notifications.ts << 'NOTIFICATIONS'
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { logger } from './logger';

// Configurar como as notificações aparecem quando o app está aberto
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

// ============================================
// Tipos
// ============================================
export type NotificationAction = 'start' | 'skip_today' | 'delay_10min' | 'stop' | 'timeout';

export interface GeofenceNotificationData {
  type: 'geofence_enter' | 'geofence_exit' | 'auto_start' | 'reminder';
  localId: string;
  localNome: string;
  action?: NotificationAction;
}

// ============================================
// Solicitar Permissões
// ============================================
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;
    
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }
    
    if (finalStatus !== 'granted') {
      logger.warn('notifications', 'Permission not granted');
      return false;
    }
    
    // Configurar canal no Android
    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync('geofence', {
        name: 'Alertas de Local',
        importance: Notifications.AndroidImportance.HIGH,
        vibrationPattern: [0, 250, 250, 250],
        lightColor: '#3B82F6',
      });
    }
    
    logger.info('notifications', 'Permissions granted');
    return true;
  } catch (error) {
    logger.error('notifications', 'Error requesting permissions', { error });
    return false;
  }
}

// ============================================
// Configurar Categorias de Ações (Android/iOS)
// ============================================
export async function setupNotificationCategories(): Promise<void> {
  try {
    // Categoria para entrada no geofence
    await Notifications.setNotificationCategoryAsync('geofence_enter', [
      {
        identifier: 'start',
        buttonTitle: '▶️ Iniciar',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'skip_today',
        buttonTitle: '😴 Desligar por hoje',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'delay_10min',
        buttonTitle: '⏰ Em 10 min',
        options: { opensAppToForeground: false },
      },
    ]);
    
    // Categoria para saída do geofence
    await Notifications.setNotificationCategoryAsync('geofence_exit', [
      {
        identifier: 'stop',
        buttonTitle: '⏹️ Parar cronômetro',
        options: { opensAppToForeground: false },
      },
    ]);
    
    logger.info('notifications', 'Notification categories configured');
  } catch (error) {
    logger.error('notifications', 'Error setting up categories', { error });
  }
}

// ============================================
// Mostrar Notificação de Entrada
// ============================================
export async function showGeofenceEnterNotification(
  localId: string,
  localNome: string
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `📍 Você chegou em ${localNome}`,
        body: 'Deseja iniciar o cronômetro? (Inicia automaticamente em 30s)',
        data: {
          type: 'geofence_enter',
          localId,
          localNome,
        } as GeofenceNotificationData,
        categoryIdentifier: 'geofence_enter',
        sound: 'default',
      },
      trigger: null, // Imediato
    });
    
    logger.info('notifications', 'Enter notification shown', { localNome, notificationId });
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error showing enter notification', { error });
    return '';
  }
}

// ============================================
// Mostrar Notificação de Saída
// ============================================
export async function showGeofenceExitNotification(
  localId: string,
  localNome: string
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚪 Você saiu de ${localNome}`,
        body: 'O cronômetro foi pausado automaticamente.',
        data: {
          type: 'geofence_exit',
          localId,
          localNome,
        } as GeofenceNotificationData,
        categoryIdentifier: 'geofence_exit',
        sound: 'default',
      },
      trigger: null,
    });
    
    logger.info('notifications', 'Exit notification shown', { localNome, notificationId });
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error showing exit notification', { error });
    return '';
  }
}

// ============================================
// Mostrar Notificação de Auto-Início
// ============================================
export async function showAutoStartNotification(localNome: string): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏱️ Cronômetro iniciado`,
        body: `Você está trabalhando em ${localNome}`,
        data: { type: 'auto_start' } as GeofenceNotificationData,
        sound: 'default',
      },
      trigger: null,
    });
    
    logger.info('notifications', 'Auto-start notification shown');
  } catch (error) {
    logger.error('notifications', 'Error showing auto-start notification', { error });
  }
}

// ============================================
// Agendar Lembrete (para delay de 10 min)
// ============================================
export async function scheduleDelayedStart(
  localId: string,
  localNome: string,
  delayMinutes: number = 10
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏰ Hora de começar!`,
        body: `Iniciando cronômetro em ${localNome}`,
        data: {
          type: 'reminder',
          localId,
          localNome,
          action: 'start',
        } as GeofenceNotificationData,
        sound: 'default',
      },
      trigger: {
        seconds: delayMinutes * 60,
      },
    });
    
    logger.info('notifications', `Delayed start scheduled for ${delayMinutes} minutes`);
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error scheduling delayed start', { error });
    return '';
  }
}

// ============================================
// Cancelar Notificação
// ============================================
export async function cancelNotification(notificationId: string): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(notificationId);
    logger.debug('notifications', 'Notification cancelled', { notificationId });
  } catch (error) {
    logger.error('notifications', 'Error cancelling notification', { error });
  }
}

// ============================================
// Cancelar Todas as Notificações
// ============================================
export async function cancelAllNotifications(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    logger.debug('notifications', 'All notifications cancelled');
  } catch (error) {
    logger.error('notifications', 'Error cancelling all notifications', { error });
  }
}

// ============================================
// Listeners
// ============================================
export function addNotificationResponseListener(
  callback: (response: Notifications.NotificationResponse) => void
): Notifications.Subscription {
  return Notifications.addNotificationResponseReceivedListener(callback);
}

export function addNotificationReceivedListener(
  callback: (notification: Notifications.Notification) => void
): Notifications.Subscription {
  return Notifications.addNotificationReceivedListener(callback);
}
NOTIFICATIONS

echo "✅ notifications.ts criado!"

# ============================================
# src/stores/workSessionStore.ts - Gerenciamento de Sessões com Notificações
# ============================================
cat > src/stores/workSessionStore.ts << 'WORKSESSION'
import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  requestNotificationPermissions,
  setupNotificationCategories,
  showGeofenceEnterNotification,
  showGeofenceExitNotification,
  showAutoStartNotification,
  scheduleDelayedStart,
  cancelNotification,
  addNotificationResponseListener,
  type NotificationAction,
  type GeofenceNotificationData,
} from '../lib/notifications';
import { useRegistroStore } from './registroStore';
import type { Coordinates } from '../lib/location';

// Tempo para auto-iniciar (30 segundos)
const AUTO_START_TIMEOUT = 30000;

interface PendingEntry {
  localId: string;
  localNome: string;
  notificationId: string;
  timeoutId: NodeJS.Timeout;
  coords?: Coordinates & { accuracy?: number };
}

interface WorkSessionState {
  // Estado
  isInitialized: boolean;
  pendingEntry: PendingEntry | null;
  skippedToday: string[]; // IDs de locais ignorados hoje
  delayedStarts: Map<string, string>; // localId -> notificationId
  
  // Actions
  initialize: () => Promise<void>;
  
  // Chamado quando entra no geofence
  handleGeofenceEnter: (
    localId: string, 
    localNome: string, 
    coords?: Coordinates & { accuracy?: number }
  ) => Promise<void>;
  
  // Chamado quando sai do geofence
  handleGeofenceExit: (
    localId: string, 
    localNome: string,
    coords?: Coordinates & { accuracy?: number }
  ) => Promise<void>;
  
  // Processar resposta da notificação
  handleNotificationAction: (action: NotificationAction, data: GeofenceNotificationData) => Promise<void>;
  
  // Iniciar cronômetro manualmente
  startTimer: (localId: string, coords?: Coordinates & { accuracy?: number }) => Promise<void>;
  
  // Parar cronômetro
  stopTimer: (localId: string, coords?: Coordinates & { accuracy?: number }) => Promise<void>;
  
  // Limpar skipped (chamado à meia-noite)
  resetSkippedToday: () => void;
}

export const useWorkSessionStore = create<WorkSessionState>((set, get) => ({
  isInitialized: false,
  pendingEntry: null,
  skippedToday: [],
  delayedStarts: new Map(),
  
  initialize: async () => {
    try {
      logger.info('workSession', 'Initializing work session store...');
      
      // Solicitar permissões
      await requestNotificationPermissions();
      
      // Configurar categorias de ações
      await setupNotificationCategories();
      
      // Listener para respostas às notificações
      addNotificationResponseListener((response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content.data as GeofenceNotificationData;
        
        logger.info('workSession', 'Notification response received', { actionId, data });
        
        // Mapear ação
        let action: NotificationAction = 'start';
        if (actionId === 'start') action = 'start';
        else if (actionId === 'skip_today') action = 'skip_today';
        else if (actionId === 'delay_10min') action = 'delay_10min';
        else if (actionId === 'stop') action = 'stop';
        else if (actionId === Notifications.DEFAULT_ACTION_IDENTIFIER) {
          // Usuário tocou na notificação (não em um botão)
          action = 'start';
        }
        
        get().handleNotificationAction(action, data);
      });
      
      set({ isInitialized: true });
      logger.info('workSession', 'Work session store initialized');
    } catch (error) {
      logger.error('workSession', 'Failed to initialize', { error });
    }
  },
  
  handleGeofenceEnter: async (localId, localNome, coords) => {
    const { skippedToday, pendingEntry } = get();
    
    // Verificar se o local foi ignorado hoje
    if (skippedToday.includes(localId)) {
      logger.info('workSession', 'Local skipped for today', { localId, localNome });
      return;
    }
    
    // Se já tem uma entrada pendente para este local, ignorar
    if (pendingEntry?.localId === localId) {
      logger.debug('workSession', 'Already pending entry for this local');
      return;
    }
    
    // Cancelar entrada pendente anterior (se houver)
    if (pendingEntry) {
      clearTimeout(pendingEntry.timeoutId);
      await cancelNotification(pendingEntry.notificationId);
    }
    
    logger.info('workSession', '📍 Geofence ENTER - showing notification', { localId, localNome });
    
    // Mostrar notificação
    const notificationId = await showGeofenceEnterNotification(localId, localNome);
    
    // Configurar timeout para auto-iniciar em 30 segundos
    const timeoutId = setTimeout(async () => {
      logger.info('workSession', '⏱️ Auto-starting timer (30s timeout)');
      await get().startTimer(localId, coords);
      await showAutoStartNotification(localNome);
      set({ pendingEntry: null });
    }, AUTO_START_TIMEOUT);
    
    set({
      pendingEntry: {
        localId,
        localNome,
        notificationId,
        timeoutId,
        coords,
      },
    });
  },
  
  handleGeofenceExit: async (localId, localNome, coords) => {
    const { pendingEntry } = get();
    
    // Se tinha entrada pendente, cancelar
    if (pendingEntry?.localId === localId) {
      clearTimeout(pendingEntry.timeoutId);
      await cancelNotification(pendingEntry.notificationId);
      set({ pendingEntry: null });
      logger.info('workSession', 'Pending entry cancelled due to exit');
      return;
    }
    
    logger.info('workSession', '🚪 Geofence EXIT - stopping timer', { localId, localNome });
    
    // Parar cronômetro e mostrar notificação
    await get().stopTimer(localId, coords);
    await showGeofenceExitNotification(localId, localNome);
  },
  
  handleNotificationAction: async (action, data) => {
    const { pendingEntry } = get();
    
    logger.info('workSession', 'Processing action', { action, data });
    
    // Cancelar timeout se existir
    if (pendingEntry?.localId === data.localId) {
      clearTimeout(pendingEntry.timeoutId);
    }
    
    switch (action) {
      case 'start':
        await get().startTimer(data.localId, pendingEntry?.coords);
        set({ pendingEntry: null });
        break;
        
      case 'skip_today':
        set((state) => ({
          skippedToday: [...state.skippedToday, data.localId],
          pendingEntry: null,
        }));
        logger.info('workSession', 'Local skipped for today', { localId: data.localId });
        break;
        
      case 'delay_10min':
        const delayNotifId = await scheduleDelayedStart(data.localId, data.localNome, 10);
        set((state) => {
          const newDelayed = new Map(state.delayedStarts);
          newDelayed.set(data.localId, delayNotifId);
          return { delayedStarts: newDelayed, pendingEntry: null };
        });
        logger.info('workSession', 'Start delayed by 10 minutes');
        break;
        
      case 'stop':
        await get().stopTimer(data.localId);
        break;
        
      case 'timeout':
        // Já tratado pelo setTimeout
        break;
    }
  },
  
  startTimer: async (localId, coords) => {
    logger.info('workSession', '▶️ Starting timer', { localId });
    
    const registroStore = useRegistroStore.getState();
    await registroStore.registrarEntrada(localId, coords);
  },
  
  stopTimer: async (localId, coords) => {
    logger.info('workSession', '⏹️ Stopping timer', { localId });
    
    const registroStore = useRegistroStore.getState();
    await registroStore.registrarSaida(localId, coords);
  },
  
  resetSkippedToday: () => {
    set({ skippedToday: [] });
    logger.info('workSession', 'Skipped list reset');
  },
}));

// Import necessário para o listener
import * as Notifications from 'expo-notifications';
WORKSESSION

echo "✅ workSessionStore.ts criado!"

# ============================================
# Atualizar locationStore.ts para usar workSessionStore
# ============================================
cat > src/stores/locationStore.ts << 'LOCSTORE_NOTIF'
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
import { useWorkSessionStore } from './workSessionStore';

export interface LocalDeTrabalho {
  id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  ativo: boolean;
}

const POLLING_INTERVAL = 30000;
let pollingTimer: NodeJS.Timeout | null = null;

interface LocationState {
  hasPermission: boolean;
  hasBackgroundPermission: boolean;
  currentLocation: Coordinates | null;
  accuracy: number | null;
  lastUpdate: number | null;
  isWatching: boolean;
  locais: LocalDeTrabalho[];
  activeGeofence: string | null;
  isGeofencingActive: boolean;
  isBackgroundActive: boolean;
  isPollingActive: boolean;
  lastGeofenceEvent: GeofenceEvent | null;
  
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
  startPolling: () => void;
  stopPolling: () => void;
}

export const useLocationStore = create<LocationState>((set, get) => ({
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
  isPollingActive: false,
  lastGeofenceEvent: null,
  
  initialize: async () => {
    logger.info('gps', 'Initializing location store');
    
    await import('../lib/backgroundTasks');
    
    const permissions = await checkPermissions();
    set({
      hasPermission: permissions.foreground,
      hasBackgroundPermission: permissions.background,
    });
    
    setGeofenceCallback((event) => {
      logger.info('geofence', `System event: ${event.type} - ${event.regionIdentifier}`);
      set({ 
        lastGeofenceEvent: event,
        activeGeofence: event.type === 'enter' ? event.regionIdentifier : null,
      });
    });
    
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
        hasPermission: true,
      });
      get().checkCurrentGeofence();
    }
  },
  
  refreshLocation: async () => {
    logger.debug('gps', 'Refreshing location...');
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
      });
      get().checkCurrentGeofence();
    }
  },
  
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
      logger.info('gps', 'Real-time tracking started');
    }
  },
  
  stopTracking: async () => {
    await stopWatchingLocation();
    set({ isWatching: false });
    logger.info('gps', 'Real-time tracking stopped');
  },
  
  addLocal: (local) => {
    const newLocal: LocalDeTrabalho = {
      ...local,
      id: `local_${Date.now()}`,
    };
    
    logger.info('geofence', 'Adding new local', { nome: local.nome });
    set((state) => ({ locais: [...state.locais, newLocal] }));
    setTimeout(() => get().checkCurrentGeofence(), 100);
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
  
  startPolling: () => {
    get().stopPolling();
    logger.info('gps', 'Starting active polling (every 30s)');
    get().refreshLocation();
    
    pollingTimer = setInterval(() => {
      logger.debug('gps', 'Polling check...');
      get().refreshLocation();
    }, POLLING_INTERVAL);
    
    set({ isPollingActive: true });
  },
  
  stopPolling: () => {
    if (pollingTimer) {
      clearInterval(pollingTimer);
      pollingTimer = null;
      logger.info('gps', 'Polling stopped');
    }
    set({ isPollingActive: false });
  },
  
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
      await startBackgroundLocation();
      set({ isBackgroundActive: true });
      get().startPolling();
      logger.info('geofence', 'Full monitoring started (geofence + polling)');
    }
  },
  
  stopGeofenceMonitoring: async () => {
    get().stopPolling();
    await stopGeofencing();
    await stopBackgroundLocation();
    set({ 
      isGeofencingActive: false, 
      isBackgroundActive: false,
      isPollingActive: false,
    });
    logger.info('geofence', 'All monitoring stopped');
  },
  
  // ATUALIZADO: Usa workSessionStore para notificações
  checkCurrentGeofence: () => {
    const { currentLocation, locais, activeGeofence, accuracy } = get();
    if (!currentLocation) return;
    
    const activeLocais = locais.filter(l => l.ativo);
    const workSession = useWorkSessionStore.getState();
    
    for (const local of activeLocais) {
      const inside = isInsideGeofence(currentLocation, {
        identifier: local.id,
        latitude: local.latitude,
        longitude: local.longitude,
        radius: local.raio,
      });
      
      if (inside) {
        if (activeGeofence !== local.id) {
          // ENTROU no geofence
          logger.info('geofence', `✅ ENTERED: ${local.nome}`, {
            localId: local.id,
            distance: calculateDistance(currentLocation, {
              latitude: local.latitude,
              longitude: local.longitude,
            }).toFixed(1) + 'm',
          });
          
          set({ activeGeofence: local.id });
          
          // NOTIFICAÇÃO em vez de registro direto
          workSession.handleGeofenceEnter(local.id, local.nome, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: accuracy || undefined,
          });
        }
        return;
      }
    }
    
    // Não está em nenhum geofence
    if (activeGeofence !== null) {
      const previousLocal = locais.find(l => l.id === activeGeofence);
      
      logger.info('geofence', `🚪 EXITED: ${previousLocal?.nome || 'unknown'}`, {
        localId: activeGeofence,
      });
      
      // NOTIFICAÇÃO de saída
      if (previousLocal) {
        workSession.handleGeofenceExit(activeGeofence, previousLocal.nome, {
          latitude: currentLocation.latitude,
          longitude: currentLocation.longitude,
          accuracy: accuracy || undefined,
        });
      }
      
      set({ activeGeofence: null });
    }
  },
}));
LOCSTORE_NOTIF

echo "✅ locationStore.ts atualizado com notificações!"

# ============================================
# Atualizar app/_layout.tsx para inicializar workSession
# ============================================
cat > app/_layout.tsx << 'ROOTLAYOUT'
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useRegistroStore } from '../src/stores/registroStore';
import { useWorkSessionStore } from '../src/stores/workSessionStore';
import { DevMonitor } from '../src/components/DevMonitor';
import { logger } from '../src/lib/logger';
import { colors } from '../src/constants/colors';

export default function RootLayout() {
  const { initialize: initAuth, isLoading } = useAuthStore();
  const { initialize: initRegistros } = useRegistroStore();
  const { initialize: initWorkSession } = useWorkSessionStore();
  
  useEffect(() => {
    logger.info('auth', 'App starting...');
    initAuth();
    initRegistros();
    initWorkSession();
  }, []);
  
  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }
  
  return (
    <View style={{ flex: 1 }}>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(auth)" />
        <Stack.Screen name="(tabs)" />
      </Stack>
      <DevMonitor />
    </View>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: colors.background,
  },
});
ROOTLAYOUT

echo "✅ _layout.tsx atualizado!"

echo ""
echo "✅✅✅ SISTEMA DE NOTIFICAÇÕES CRIADO! ✅✅✅"
echo ""
echo "Agora reinicie o servidor Expo:"
echo "  npx expo start -c"
echo ""
echo "FLUXO NOVO:"
echo "  1. Você entra no geofence"
echo "  2. Aparece notificação com 3 opções"
echo "  3. Se não responder em 30s, inicia automaticamente"
echo ""
