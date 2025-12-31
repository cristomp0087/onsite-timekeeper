import { create } from 'zustand';
import { logger } from '../lib/logger';
import {
  requestNotificationPermissions,
  setupNotificationCategories,
  showGeofenceEnterNotification,
  showGeofenceExitNotification,
  showAutoStartNotification,
  showAutoPauseNotification,
  showAutoResumeNotification,
  scheduleDelayedStart as scheduleDelayedStartNotif,
  cancelNotification,
  addNotificationResponseListener,
  type NotificationAction,
  type GeofenceNotificationData,
} from '../lib/notifications';
import { useRegistroStore } from './registroStore';
import { getSessaoAberta } from '../lib/database';
import type { Coordinates } from '../lib/location';

// Tempo para auto-ação (30 segundos)
const AUTO_ACTION_TIMEOUT = 30000;

interface PendingEntry {
  localId: string;
  localNome: string;
  notificationId: string;
  timeoutId: NodeJS.Timeout;
  coords?: Coordinates & { accuracy?: number };
}

interface PendingExit {
  localId: string;
  localNome: string;
  notificationId: string;
  timeoutId: NodeJS.Timeout;
  coords?: Coordinates & { accuracy?: number };
}

interface PendingEntryPublic {
  localId: string;
  localNome: string;
  coords?: Coordinates & { accuracy?: number };
}

interface PendingExitPublic {
  localId: string;
  localNome: string;
  coords?: Coordinates & { accuracy?: number };
}

interface WorkSessionState {
  // Estado
  isInitialized: boolean;
  pendingEntry: PendingEntryPublic | null;
  pendingExit: PendingExitPublic | null;
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
  handleNotificationAction: (
    action: NotificationAction,
    data: GeofenceNotificationData
  ) => Promise<void>;

  // Iniciar cronômetro manualmente
  startTimer: (
    localId: string,
    coords?: Coordinates & { accuracy?: number }
  ) => Promise<void>;

  // Pausar cronômetro (ao sair da fence)
  pauseTimer: (localId: string) => Promise<void>;

  // Retomar cronômetro (ao voltar na fence)
  resumeTimer: (localId: string) => Promise<void>;

  // Parar cronômetro completamente
  stopTimer: (
    localId: string,
    coords?: Coordinates & { accuracy?: number }
  ) => Promise<void>;

  // Parar cronômetro com ajuste de tempo (ex: parei há 10min)
  stopTimerWithAdjustment: (
    localId: string,
    coords?: Coordinates & { accuracy?: number },
    adjustMinutes?: number
  ) => Promise<void>;

  // Limpar skipped (chamado à meia-noite)
  resetSkippedToday: () => void;

  // Limpar pending (usado pelo GeofenceAlert)
  clearPending: () => void;

  // Adicionar ao skipped (usado pelo GeofenceAlert)
  addToSkippedToday: (localId: string) => void;

  // Agendar início atrasado (usado pelo GeofenceAlert)
  scheduleDelayedStart: (
    localId: string,
    localNome: string,
    minutes: number
  ) => Promise<void>;

  // Agendar encerramento atrasado (usado pelo GeofenceAlert)
  scheduleDelayedStop: (
    localId: string,
    localNome: string,
    minutes: number,
    coords?: Coordinates & { accuracy?: number }
  ) => void;
}

export const useWorkSessionStore = create<WorkSessionState>((set, get) => ({
  isInitialized: false,
  pendingEntry: null,
  pendingExit: null,
  skippedToday: [],
  delayedStarts: new Map(),

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      logger.info('workSession', 'Initializing work session store...');

      // Solicitar permissões
      await requestNotificationPermissions();

      // Configurar categorias de ações
      await setupNotificationCategories();

      // Listener para respostas às notificações
      addNotificationResponseListener((response) => {
        const actionId = response.actionIdentifier;
        const data = response.notification.request.content
          .data as GeofenceNotificationData;

        logger.info('workSession', 'Notification response received', {
          actionId,
          data,
        });

        // Mapear ação
        let action: NotificationAction = 'start';
        if (actionId === 'start') action = 'start';
        else if (actionId === 'skip_today') action = 'skip_today';
        else if (actionId === 'delay_10min') action = 'delay_10min';
        else if (actionId === 'stop') action = 'stop';
        else if (actionId === 'pause') action = 'pause';
        else if (actionId === 'continue') action = 'continue';
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
    const { skippedToday, pendingEntry, pendingExit } = get();
    const registroStore = useRegistroStore.getState();
    const sessaoAtual = registroStore.sessaoAtual;

    // REGRA PRINCIPAL: Se já há sessão ATIVA em OUTRO local, ignorar
    // (sessões pausadas ou finalizadas não bloqueiam)
    if (
      sessaoAtual &&
      sessaoAtual.status === 'ativa' &&
      sessaoAtual.local_id !== localId
    ) {
      logger.warn(
        'workSession',
        'BLOCKED: Already has ACTIVE session in another location',
        {
          activeLocalId: sessaoAtual.local_id,
          attemptedLocalId: localId,
        }
      );
      return;
    }

    // Cancelar pending exit se existir (voltou rápido para o MESMO local)
    if (pendingExit?.localId === localId) {
      clearTimeout(pendingExit.timeoutId);
      await cancelNotification(pendingExit.notificationId);
      set({ pendingExit: null });
      logger.info(
        'workSession',
        'Cancelled pending exit - user returned quickly'
      );
      return; // Não fazer mais nada, sessão continua
    }

    // REGRA: Cada lugar inicia seu próprio cronômetro
    // NÃO retomar sessões pausadas - sempre iniciar nova

    // Verificar se o local foi ignorado hoje
    if (skippedToday.includes(localId)) {
      logger.info('workSession', 'Local skipped for today', {
        localId,
        localNome,
      });
      return;
    }

    // Se já tem uma entrada pendente para este local, ignorar
    if (pendingEntry?.localId === localId) {
      logger.debug('workSession', 'Already pending entry for this local');
      return;
    }

    // Verificar se já está trabalhando neste local (sessão ativa)
    if (sessaoAtual?.local_id === localId && sessaoAtual.status === 'ativa') {
      logger.debug('workSession', 'Already working at this location');
      return;
    }

    // Cancelar entrada pendente anterior (se houver para outro local)
    if (pendingEntry) {
      clearTimeout(pendingEntry.timeoutId);
      await cancelNotification(pendingEntry.notificationId);
    }

    logger.info('workSession', '📍 Geofence ENTER - showing notification', {
      localId,
      localNome,
    });

    // Mostrar notificação
    const notificationId = await showGeofenceEnterNotification(
      localId,
      localNome
    );

    // Configurar timeout para auto-iniciar em 30 segundos
    const timeoutId = setTimeout(async () => {
      // Verificar novamente se não há sessão ATIVA (pode ter mudado durante os 30s)
      const currentRegistro = useRegistroStore.getState();
      if (
        currentRegistro.sessaoAtual &&
        currentRegistro.sessaoAtual.status === 'ativa'
      ) {
        logger.warn(
          'workSession',
          'Auto-start cancelled - session became active'
        );
        set({ pendingEntry: null });
        return;
      }

      logger.info('workSession', '⏱️ Auto-starting NEW timer (30s timeout)');
      await get().startTimer(localId, coords);
      await showAutoStartNotification(localNome);
      set({ pendingEntry: null });
    }, AUTO_ACTION_TIMEOUT);

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
    const { pendingEntry, pendingExit } = get();
    const registroStore = useRegistroStore.getState();

    // Se tinha entrada pendente, cancelar (saiu antes de responder)
    if (pendingEntry?.localId === localId) {
      clearTimeout(pendingEntry.timeoutId);
      await cancelNotification(pendingEntry.notificationId);
      set({ pendingEntry: null });
      logger.info('workSession', 'Pending entry cancelled due to exit');
      return;
    }

    // Se já tem exit pendente para este local, ignorar
    if (pendingExit?.localId === localId) {
      logger.debug('workSession', 'Already pending exit for this local');
      return;
    }

    // Verificar se está trabalhando neste local
    const sessaoAtual = registroStore.sessaoAtual;
    if (
      !sessaoAtual ||
      sessaoAtual.local_id !== localId ||
      sessaoAtual.status !== 'ativa'
    ) {
      logger.debug(
        'workSession',
        'Not working at this location, ignoring exit'
      );
      return;
    }

    logger.info('workSession', '🚪 Geofence EXIT - showing notification', {
      localId,
      localNome,
    });

    // Mostrar notificação de saída
    const notificationId = await showGeofenceExitNotification(
      localId,
      localNome
    );

    // Configurar timeout para auto-ENCERRAR em 30 segundos
    // REGRA: Se usuário não responde em 30s, ENCERRA a sessão
    // Isso libera o sistema para iniciar nova sessão em outro local
    const timeoutId = setTimeout(async () => {
      logger.info(
        'workSession',
        '⏱️ Auto-STOPPING timer (30s timeout - no response)'
      );
      await get().stopTimer(localId, coords);
      set({ pendingExit: null });
    }, AUTO_ACTION_TIMEOUT);

    set({
      pendingExit: {
        localId,
        localNome,
        notificationId,
        timeoutId,
        coords,
      },
    });
  },

  handleNotificationAction: async (action, data) => {
    const { pendingEntry, pendingExit } = get();

    logger.info('workSession', 'Processing action', { action, data });

    // Cancelar timeouts relevantes
    if (pendingEntry?.localId === data.localId) {
      clearTimeout(pendingEntry.timeoutId);
    }
    if (pendingExit?.localId === data.localId) {
      clearTimeout(pendingExit.timeoutId);
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
        logger.info('workSession', 'Local skipped for today', {
          localId: data.localId,
        });
        break;

      case 'delay_10min':
        const delayNotifId = await scheduleDelayedStart(
          data.localId,
          data.localNome,
          10
        );
        set((state) => {
          const newDelayed = new Map(state.delayedStarts);
          newDelayed.set(data.localId, delayNotifId);
          return { delayedStarts: newDelayed, pendingEntry: null };
        });
        logger.info('workSession', 'Start delayed by 10 minutes');
        break;

      case 'pause':
        await get().pauseTimer(data.localId);
        set({ pendingExit: null });
        break;

      case 'continue':
        // Usuário quer continuar contando mesmo fora da fence
        set({ pendingExit: null });
        logger.info(
          'workSession',
          'User chose to continue tracking outside fence'
        );
        break;

      case 'stop':
        await get().stopTimer(data.localId, pendingExit?.coords);
        set({ pendingExit: null });
        break;

      case 'timeout':
        // Já tratado pelos setTimeouts
        break;
    }
  },

  startTimer: async (localId, coords) => {
    // VERIFICAÇÃO: Só bloquear se há sessão ATIVA (não pausada)
    const registroStore = useRegistroStore.getState();
    const sessaoAtual = registroStore.sessaoAtual;

    if (sessaoAtual && sessaoAtual.status === 'ativa') {
      if (sessaoAtual.local_id === localId) {
        logger.warn('workSession', 'Timer already running for this location');
      } else {
        logger.error(
          'workSession',
          'BLOCKED: Cannot start timer - ACTIVE session in another location',
          {
            activeLocalId: sessaoAtual.local_id,
            attemptedLocalId: localId,
          }
        );
      }
      return;
    }

    // Sessões pausadas/finalizadas não bloqueiam - podemos iniciar nova
    logger.info('workSession', '▶️ Starting NEW timer', { localId });

    await registroStore.registrarEntrada(localId, coords);
  },

  pauseTimer: async (localId) => {
    logger.info('workSession', '⏸️ Pausing timer', { localId });

    const registroStore = useRegistroStore.getState();
    await registroStore.pausar();
  },

  resumeTimer: async (localId) => {
    logger.info('workSession', '▶️ Resuming timer', { localId });

    const registroStore = useRegistroStore.getState();
    await registroStore.retomar();
  },

  stopTimer: async (localId, coords) => {
    logger.info('workSession', '⏹️ Stopping timer', { localId });

    const registroStore = useRegistroStore.getState();
    await registroStore.registrarSaida(localId, coords);
  },

  stopTimerWithAdjustment: async (localId, coords, adjustMinutes = 0) => {
    logger.info('workSession', '⏹️ Stopping timer with adjustment', {
      localId,
      adjustMinutes,
    });

    const registroStore = useRegistroStore.getState();
    // Registrar saída com ajuste de tempo
    // adjustMinutes é negativo quando "parei há X minutos"
    await registroStore.registrarSaidaComAjuste(localId, coords, adjustMinutes);
  },

  resetSkippedToday: () => {
    set({ skippedToday: [], delayedStarts: new Map() });
    logger.info('workSession', 'Skipped list reset');
  },

  clearPending: () => {
    const { pendingEntry, pendingExit } = get();

    // Cancelar timeouts internos se existirem
    // (Os timeouts são gerenciados internamente, mas limpamos o estado)

    set({ pendingEntry: null, pendingExit: null });
    logger.info('workSession', 'Pending cleared');
  },

  addToSkippedToday: (localId: string) => {
    set((state) => ({
      skippedToday: [...state.skippedToday, localId],
      pendingEntry: null,
    }));
    logger.info('workSession', 'Local added to skip list', { localId });
  },

  scheduleDelayedStart: async (
    localId: string,
    localNome: string,
    minutes: number
  ) => {
    const delayNotifId = await scheduleDelayedStartNotif(
      localId,
      localNome,
      minutes
    );
    set((state) => {
      const newDelayed = new Map(state.delayedStarts);
      newDelayed.set(localId, delayNotifId);
      return { delayedStarts: newDelayed, pendingEntry: null };
    });
    logger.info('workSession', `Start delayed by ${minutes} minutes`);
  },

  scheduleDelayedStop: (
    localId: string,
    localNome: string,
    minutesAgo: number,
    coords?: Coordinates & { accuracy?: number }
  ) => {
    // NOTA: minutesAgo é PASSADO, ou seja, desconta do total
    // Ex: "Encerrar há 10 min" = encerra agora mas desconta 10min
    logger.info(
      'workSession',
      `Stopping with ${minutesAgo} minutes ago adjustment`,
      { localId, localNome }
    );

    const registroStore = useRegistroStore.getState();
    // Usar ajuste negativo para descontar tempo
    registroStore.registrarSaidaComAjuste(localId, coords, -minutesAgo);

    set({ pendingExit: null });
  },
}));

// Import necessário para o listener
import * as Notifications from 'expo-notifications';
