import { create } from 'zustand';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
import {
  saveLocal,
  getLocais,
  deleteLocal as deleteLocalDB,
} from '../lib/database';
import {
  setGeofenceCallback,
  type GeofenceEvent,
} from '../lib/backgroundTasks';
import { useWorkSessionStore } from './workSessionStore';
import { useRegistroStore } from './registroStore';

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
const STORAGE_KEY_MONITORING = '@onsite_monitoring_active';

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
  isInitialized: boolean;

  // Flag para evitar processamento duplicado
  isProcessingGeofenceEvent: boolean;

  initialize: () => Promise<void>;
  refreshLocation: () => Promise<void>;
  startTracking: () => Promise<void>;
  stopTracking: () => Promise<void>;
  addLocal: (local: Omit<LocalDeTrabalho, 'id'>) => Promise<void>;
  removeLocal: (id: string) => Promise<void>;
  updateLocal: (id: string, updates: Partial<LocalDeTrabalho>) => void;
  loadLocaisFromDB: () => Promise<void>;
  startGeofenceMonitoring: () => Promise<void>;
  stopGeofenceMonitoring: () => Promise<void>;
  checkCurrentGeofence: () => void;
  startPolling: () => void;
  stopPolling: () => void;
  autoStartMonitoringIfNeeded: () => Promise<void>;
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
  isInitialized: false,
  isProcessingGeofenceEvent: false,

  initialize: async () => {
    if (get().isInitialized) return;

    logger.info('gps', 'Initializing location store');

    // Importar background tasks
    await import('../lib/backgroundTasks');

    // Verificar permissões
    const permissions = await checkPermissions();
    set({
      hasPermission: permissions.foreground,
      hasBackgroundPermission: permissions.background,
    });

    // Configurar callback de geofence nativo
    setGeofenceCallback((event) => {
      const { isProcessingGeofenceEvent } = get();

      // Evitar processamento duplicado
      if (isProcessingGeofenceEvent) {
        logger.warn('geofence', 'Already processing event, skipping', {
          event: event.type,
        });
        return;
      }

      logger.info(
        'geofence',
        `System event: ${event.type} - ${event.regionIdentifier}`
      );
      set({
        lastGeofenceEvent: event,
        activeGeofence: event.type === 'enter' ? event.regionIdentifier : null,
      });

      // Processar evento via workSessionStore
      const workSession = useWorkSessionStore.getState();
      const registroStore = useRegistroStore.getState();
      const { locais, currentLocation, accuracy } = get();
      const local = locais.find((l) => l.id === event.regionIdentifier);

      if (local) {
        const coords = currentLocation
          ? {
              latitude: currentLocation.latitude,
              longitude: currentLocation.longitude,
              accuracy: accuracy || undefined,
            }
          : undefined;

        // REGRA: Só processar entrada se não há sessão ATIVA
        if (event.type === 'enter') {
          const sessaoAtual = registroStore.sessaoAtual;

          // Se já tem sessão ATIVA em OUTRO local, ignorar
          // Sessões pausadas/finalizadas NÃO bloqueiam
          if (
            sessaoAtual &&
            sessaoAtual.status === 'ativa' &&
            sessaoAtual.local_id !== local.id
          ) {
            logger.warn(
              'geofence',
              'Ignoring enter - already has ACTIVE session in another location',
              {
                activeLocalId: sessaoAtual.local_id,
                newLocalId: local.id,
              }
            );
            return;
          }

          workSession.handleGeofenceEnter(local.id, local.nome, coords);
        } else {
          workSession.handleGeofenceExit(local.id, local.nome, coords);
        }
      }
    });

    // Carregar locais do banco de dados
    await get().loadLocaisFromDB();

    // Obter localização atual
    const location = await getCurrentLocation();
    if (location) {
      set({
        currentLocation: location.coords,
        accuracy: location.accuracy,
        lastUpdate: location.timestamp,
        hasPermission: true,
      });
    }

    set({ isInitialized: true });

    // Auto-start do monitoramento se necessário
    await get().autoStartMonitoringIfNeeded();

    // Verificar geofence atual
    get().checkCurrentGeofence();
  },

  loadLocaisFromDB: async () => {
    try {
      const locaisDB = await getLocais();
      const locais: LocalDeTrabalho[] = locaisDB.map((l) => ({
        id: l.id,
        nome: l.nome,
        latitude: l.latitude,
        longitude: l.longitude,
        raio: l.raio,
        cor: l.cor,
        ativo: l.ativo === 1,
      }));

      set({ locais });
      logger.info('gps', `Loaded ${locais.length} locations from database`);
    } catch (error) {
      logger.error('gps', 'Error loading locations from DB', { error });
    }
  },

  autoStartMonitoringIfNeeded: async () => {
    const { locais, isGeofencingActive } = get();

    // Se já está ativo, não fazer nada
    if (isGeofencingActive) return;

    // Se não há locais, não iniciar
    if (locais.length === 0) {
      logger.info('gps', 'No locations to monitor, skipping auto-start');
      return;
    }

    // Verificar se o usuário tinha monitoramento ativo antes
    try {
      const wasActive = await AsyncStorage.getItem(STORAGE_KEY_MONITORING);

      // Auto-iniciar se tinha locais E (era ativo antes OU é primeira vez)
      if (wasActive === 'true' || wasActive === null) {
        logger.info('gps', 'Auto-starting geofence monitoring...');
        await get().startGeofenceMonitoring();
      }
    } catch (error) {
      logger.error('gps', 'Error checking monitoring state', { error });
      // Em caso de erro, iniciar mesmo assim se há locais
      await get().startGeofenceMonitoring();
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

  addLocal: async (local) => {
    logger.info('geofence', 'Adding new local', { nome: local.nome });

    try {
      // 1. Salvar no banco de dados
      const id = await saveLocal({
        id: '', // será gerado no banco
        user_id: '', // será preenchido no banco
        ...local,
      });

      // 2. ⭐ RECARREGAR LOCAIS DO BANCO (ISSO QUE ESTAVA FALTANDO!)
      await get().loadLocaisFromDB();

      logger.info('geofence', 'Local added successfully', { id, nome: local.nome });

      // 3. Verificar se já há sessão ativa
      const registroStore = useRegistroStore.getState();
      const sessaoAtual = registroStore.sessaoAtual;
      const hasActiveSession = sessaoAtual && sessaoAtual.status === 'ativa';

      // 4. Gerenciar geofencing
      const { locais: allLocais, isGeofencingActive } = get();

      if (!hasActiveSession) {
        // Sem sessão ativa: pode reiniciar monitoramento normalmente
        if (isGeofencingActive) {
          // Reiniciar geofencing para incluir novo local
          await get().stopGeofenceMonitoring();
          await get().startGeofenceMonitoring();
        } else {
          // Auto-iniciar monitoramento quando primeiro local é adicionado
          await get().startGeofenceMonitoring();
        }
      } else {
        // Com sessão ativa: adicionar às fences sem reiniciar
        logger.info(
          'geofence',
          'Session active - adding local without restarting monitoring'
        );

        const activeLocais = allLocais.filter((l) => l.ativo);
        const regions: GeofenceRegion[] = activeLocais.map((l) => ({
          identifier: l.id,
          latitude: l.latitude,
          longitude: l.longitude,
          radius: l.raio,
          notifyOnEnter: true,
          notifyOnExit: true,
        }));

        // Reiniciar geofencing silenciosamente
        await stopGeofencing();
        await startGeofencing(regions);
      }

      // 5. Verificar geofence atual (só se não há sessão ativa)
      if (!hasActiveSession) {
        setTimeout(() => get().checkCurrentGeofence(), 100);
      }
    } catch (error) {
      logger.error('geofence', 'Error adding local', { error });
      throw error; // Re-throw para UI mostrar erro
    }
  },

  removeLocal: async (id) => {
    logger.info('geofence', 'Removing local', { id });

    try {
      await deleteLocalDB(id);

      set((state) => ({
        locais: state.locais.filter((l) => l.id !== id),
        activeGeofence:
          state.activeGeofence === id ? null : state.activeGeofence,
      }));

      // Se monitoramento está ativo, reiniciar para remover local
      const { locais, isGeofencingActive } = get();
      if (isGeofencingActive) {
        if (locais.length === 0) {
          await get().stopGeofenceMonitoring();
        } else {
          await get().stopGeofenceMonitoring();
          await get().startGeofenceMonitoring();
        }
      }
    } catch (error) {
      logger.error('geofence', 'Error removing local from DB', { error });
    }
  },

  updateLocal: (id, updates) => {
    set((state) => ({
      locais: state.locais.map((l) => (l.id === id ? { ...l, ...updates } : l)),
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
    const activeLocais = locais.filter((l) => l.ativo);

    if (activeLocais.length === 0) {
      logger.warn('geofence', 'No active locations to monitor');
      return;
    }

    const regions: GeofenceRegion[] = activeLocais.map((local) => ({
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

      // Persistir estado
      try {
        await AsyncStorage.setItem(STORAGE_KEY_MONITORING, 'true');
      } catch (error) {
        logger.error('gps', 'Error saving monitoring state', { error });
      }

      logger.info('geofence', 'Full monitoring started (geofence + polling)');

      // NÃO verificar geofence atual ao iniciar monitoramento
      // Se já há sessão ativa, não queremos interferir
      const registroStore = useRegistroStore.getState();
      const sessaoAtual = registroStore.sessaoAtual;

      if (!sessaoAtual || sessaoAtual.status === 'finalizada') {
        get().checkCurrentGeofence();
      }
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

    // Persistir estado
    try {
      await AsyncStorage.setItem(STORAGE_KEY_MONITORING, 'false');
    } catch (error) {
      logger.error('gps', 'Error saving monitoring state', { error });
    }

    logger.info('geofence', 'All monitoring stopped');
  },

  checkCurrentGeofence: () => {
    const {
      currentLocation,
      locais,
      activeGeofence,
      accuracy,
      isProcessingGeofenceEvent,
    } = get();
    if (!currentLocation) return;

    // Evitar processamento se já está processando
    if (isProcessingGeofenceEvent) {
      logger.debug('geofence', 'Skipping check - already processing');
      return;
    }

    // Verificar se há sessão ATIVA - se sim, não processar novas entradas
    // Sessões pausadas/finalizadas NÃO bloqueiam
    const registroStore = useRegistroStore.getState();
    const sessaoAtual = registroStore.sessaoAtual;
    const hasActiveSession = sessaoAtual && sessaoAtual.status === 'ativa';

    const activeLocais = locais.filter((l) => l.ativo);
    const workSession = useWorkSessionStore.getState();

    // Marcar como processando
    set({ isProcessingGeofenceEvent: true });

    try {
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
              hasActiveSession,
              distance:
                calculateDistance(currentLocation, {
                  latitude: local.latitude,
                  longitude: local.longitude,
                }).toFixed(1) + 'm',
            });

            set({ activeGeofence: local.id });

            // REGRA: Só notificar entrada se não há sessão ativa OU é o mesmo local
            if (!hasActiveSession) {
              workSession.handleGeofenceEnter(local.id, local.nome, {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                accuracy: accuracy || undefined,
              });
            } else if (sessaoAtual?.local_id === local.id) {
              // Mesmo local - pode ser retomada
              workSession.handleGeofenceEnter(local.id, local.nome, {
                latitude: currentLocation.latitude,
                longitude: currentLocation.longitude,
                accuracy: accuracy || undefined,
              });
            } else {
              logger.info(
                'geofence',
                'Entered fence but session active in another location - ignoring'
              );
            }
          }
          return;
        }
      }

      // Não está em nenhum geofence
      if (activeGeofence !== null) {
        const previousLocal = locais.find((l) => l.id === activeGeofence);

        logger.info(
          'geofence',
          `🚪 EXITED: ${previousLocal?.nome || 'unknown'}`,
          {
            localId: activeGeofence,
          }
        );

        // Notificar saída
        if (previousLocal) {
          workSession.handleGeofenceExit(activeGeofence, previousLocal.nome, {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: accuracy || undefined,
          });
        }

        set({ activeGeofence: null });
      }
    } finally {
      // Desmarcar processamento após um pequeno delay
      setTimeout(() => {
        set({ isProcessingGeofenceEvent: false });
      }, 1000);
    }
  },
}));

