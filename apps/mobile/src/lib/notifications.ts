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
export type NotificationAction =
  | 'start'
  | 'skip_today'
  | 'delay_10min'
  | 'stop'
  | 'pause'
  | 'continue'
  | 'timeout';

export interface GeofenceNotificationData {
  type:
    | 'geofence_enter'
    | 'geofence_exit'
    | 'auto_start'
    | 'auto_pause'
    | 'auto_resume'
    | 'reminder';
  localId: string;
  localNome: string;
  action?: NotificationAction;
}

// ============================================
// Solicitar Permissões
// ============================================
export async function requestNotificationPermissions(): Promise<boolean> {
  try {
    const { status: existingStatus } =
      await Notifications.getPermissionsAsync();
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
        buttonTitle: '😴 Ignorar hoje',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'delay_10min',
        buttonTitle: '⏰ Em 10 min',
        options: { opensAppToForeground: false },
      },
    ]);

    // Categoria para saída do geofence - ATUALIZADA
    await Notifications.setNotificationCategoryAsync('geofence_exit', [
      {
        identifier: 'pause',
        buttonTitle: '⏸️ Pausar',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'continue',
        buttonTitle: '▶️ Continuar contando',
        options: { opensAppToForeground: false },
      },
      {
        identifier: 'stop',
        buttonTitle: '⏹️ Encerrar',
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

    logger.info('notifications', 'Enter notification shown', {
      localNome,
      notificationId,
    });
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error showing enter notification', {
      error,
    });
    return '';
  }
}

// ============================================
// Mostrar Notificação de Saída - ATUALIZADA
// ============================================
export async function showGeofenceExitNotification(
  localId: string,
  localNome: string
): Promise<string> {
  try {
    const notificationId = await Notifications.scheduleNotificationAsync({
      content: {
        title: `🚪 Você saiu de ${localNome}`,
        body: 'O que deseja fazer? (Pausa automaticamente em 30s)',
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

    logger.info('notifications', 'Exit notification shown', {
      localNome,
      notificationId,
    });
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error showing exit notification', { error });
    return '';
  }
}

// ============================================
// Mostrar Notificação de Auto-Início
// ============================================
export async function showAutoStartNotification(
  localNome: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏱️ Cronômetro iniciado`,
        body: `Você está trabalhando em ${localNome}`,
        data: {
          type: 'auto_start',
          localId: '',
          localNome,
        } as GeofenceNotificationData,
        sound: 'default',
      },
      trigger: null,
    });

    logger.info('notifications', 'Auto-start notification shown');
  } catch (error) {
    logger.error('notifications', 'Error showing auto-start notification', {
      error,
    });
  }
}

// ============================================
// Mostrar Notificação de Auto-Pausa - NOVA
// ============================================
export async function showAutoPauseNotification(
  localNome: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `⏸️ Cronômetro pausado`,
        body: `Você saiu de ${localNome}. Voltará a contar quando você retornar.`,
        data: {
          type: 'auto_pause',
          localId: '',
          localNome,
        } as GeofenceNotificationData,
        sound: 'default',
      },
      trigger: null,
    });

    logger.info('notifications', 'Auto-pause notification shown');
  } catch (error) {
    logger.error('notifications', 'Error showing auto-pause notification', {
      error,
    });
  }
}

// ============================================
// Mostrar Notificação de Auto-Retomada - NOVA
// ============================================
export async function showAutoResumeNotification(
  localNome: string
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: `▶️ Cronômetro retomado`,
        body: `Você voltou para ${localNome}. Continuando a contar suas horas.`,
        data: {
          type: 'auto_resume',
          localId: '',
          localNome,
        } as GeofenceNotificationData,
        sound: 'default',
      },
      trigger: null,
    });

    logger.info('notifications', 'Auto-resume notification shown');
  } catch (error) {
    logger.error('notifications', 'Error showing auto-resume notification', {
      error,
    });
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

    logger.info(
      'notifications',
      `Delayed start scheduled for ${delayMinutes} minutes`
    );
    return notificationId;
  } catch (error) {
    logger.error('notifications', 'Error scheduling delayed start', { error });
    return '';
  }
}

// ============================================
// Cancelar Notificação
// ============================================
export async function cancelNotification(
  notificationId: string
): Promise<void> {
  if (!notificationId) return;

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
    logger.error('notifications', 'Error cancelling all notifications', {
      error,
    });
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
