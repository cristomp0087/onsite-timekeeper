import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  AppState,
  Alert,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { useLocationStore } from '../../src/stores/locationStore';
import { useRegistroStore } from '../../src/stores/registroStore';
import { useWorkSessionStore } from '../../src/stores/workSessionStore';
import { useSettingsStore } from '../../src/stores/settingsStore';
import { useSyncStore } from '../../src/stores/syncStore';
import { logger } from '../../src/lib/logger';
import { colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';
import {
  GeofenceAlert,
  type GeofenceAlertData,
} from '../../src/components/GeofenceAlert';

export default function HomeScreen() {
  const { user } = useAuthStore();
  const {
    initialize: initLocation,
    isGeofencingActive,
    currentLocation,
    accuracy,
    locais,
    activeGeofence,
    isInitialized: locationInitialized,
  } = useLocationStore();

  // Sync store
  const {
    initialize: initSync,
    syncNow,
    isSyncing,
    lastSyncAt,
    isOnline,
  } = useSyncStore();

  // Configurações personalizáveis
  const {
    exitTimeOption1,
    exitTimeOption2,
    entryDelayOption,
    autoActionTimeout,
  } = useSettingsStore();

  const {
    initialize: initRegistros,
    estatisticasHoje,
    sessoesHoje,
    sessaoAtual,
    refreshData,
    pausar,
    retomar,
    registrarSaida,
    isInitialized: registroInitialized,
  } = useRegistroStore();

  const {
    initialize: initWorkSession,
    startTimer,
    pauseTimer,
    stopTimer,
    stopTimerWithAdjustment,
    pendingEntry,
    pendingExit,
    clearPending,
    addToSkippedToday,
    scheduleDelayedStart,
    scheduleDelayedStop,
    isInitialized: workSessionInitialized,
  } = useWorkSessionStore();

  // Tempo em SEGUNDOS para precisão
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isInitializing, setIsInitializing] = useState(true);

  // Estado do alert grande
  const [alertData, setAlertData] = useState<GeofenceAlertData | null>(null);
  const [showAlert, setShowAlert] = useState(false);

  const activeLocal = locais.find((l) => l.id === activeGeofence);
  const isInsideGeofence = !!activeGeofence;
  const isWorking = sessaoAtual && sessaoAtual.status !== 'finalizada';
  const isPaused = sessaoAtual?.status === 'pausada';

  // Inicialização completa
  useEffect(() => {
    const initializeAll = async () => {
      try {
        logger.info('home', 'Starting full initialization...');
        setIsInitializing(true);

        // 1. Inicializar banco de dados e registros
        await initRegistros();

        // 2. Inicializar workSessionStore (notificações)
        await initWorkSession();

        // 3. Inicializar localização (vai auto-iniciar monitoramento se necessário)
        await initLocation();

        // 4. Inicializar sync (novo!)
        await initSync();

        logger.info('home', 'Full initialization complete');
      } catch (error) {
        logger.error('home', 'Initialization failed', { error: String(error) });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAll();
  }, []);

  // Monitorar pending events
  useEffect(() => {
    if (pendingEntry) {
      const localName = locais.find((l) => l.id === pendingEntry.localId)?.nome;
      setAlertData({
        type: 'enter',
        localId: pendingEntry.localId,
        localNome: localName || 'Local',
        onStart: handleAlertStartNow,
        onDelayEntry: handleAlertStartDelay,
        onSkipToday: handleAlertSkip,
        onStop: () => {},
        onStopAgo1: () => {},
        onStopAgo2: () => {},
        onDismiss: handleAlertDismiss,
      });
      setShowAlert(true);
    } else if (pendingExit) {
      const localName = locais.find((l) => l.id === pendingExit.localId)?.nome;
      setAlertData({
        type: 'exit',
        localId: pendingExit.localId,
        localNome: localName || 'Local',
        onStart: () => {},
        onDelayEntry: () => {},
        onSkipToday: () => {},
        onStop: handleAlertStopNow,
        onStopAgo1: handleAlertStopAgo1,
        onStopAgo2: handleAlertStopAgo2,
        onDismiss: handleAlertDismiss,
      });
      setShowAlert(true);
    }
  }, [
    pendingEntry,
    pendingExit,
    locais,
    handleAlertStartNow,
    handleAlertStartDelay,
    handleAlertSkip,
    handleAlertStopNow,
    handleAlertStopAgo1,
    handleAlertStopAgo2,
    handleAlertDismiss,
  ]);

  const handleAlertStartNow = useCallback(async () => {
    if (!pendingEntry) return;
    setShowAlert(false);
    await startTimer(pendingEntry.localId, pendingEntry.coords);
    clearPending();
    refreshData();
  }, [pendingEntry, clearPending, refreshData, startTimer]);

  const handleAlertStartDelay = useCallback(async () => {
    if (!pendingEntry) return;
    setShowAlert(false);
    scheduleDelayedStart(
      pendingEntry.localId,
      pendingEntry.localNome,
      entryDelayOption,
      pendingEntry.coords
    );
    clearPending();
    refreshData();
  }, [
    pendingEntry,
    clearPending,
    refreshData,
    entryDelayOption,
    scheduleDelayedStart,
  ]);

  const handleAlertSkip = useCallback(() => {
    if (!pendingEntry) return;
    setShowAlert(false);
    addToSkippedToday(pendingEntry.localId);
    clearPending();
  }, [pendingEntry, clearPending, addToSkippedToday]);

  const handleAlertStopNow = useCallback(async () => {
    if (!pendingExit) return;
    setShowAlert(false);
    await stopTimer(pendingExit.localId, pendingExit.coords);
    clearPending();
    refreshData();
  }, [pendingExit, clearPending, refreshData, stopTimer]);

  const handleAlertStopAgo1 = useCallback(async () => {
    if (!pendingExit) return;
    setShowAlert(false);
    scheduleDelayedStop(
      pendingExit.localId,
      pendingExit.localNome,
      exitTimeOption1,
      pendingExit.coords
    );
    clearPending();
    refreshData();
  }, [
    pendingExit,
    clearPending,
    refreshData,
    exitTimeOption1,
    scheduleDelayedStop,
  ]);

  const handleAlertStopAgo2 = useCallback(async () => {
    if (!pendingExit) return;
    setShowAlert(false);
    scheduleDelayedStop(
      pendingExit.localId,
      pendingExit.localNome,
      exitTimeOption2,
      pendingExit.coords
    );
    clearPending();
    refreshData();
  }, [
    pendingExit,
    clearPending,
    refreshData,
    exitTimeOption2,
    scheduleDelayedStop,
  ]);

  const handleAlertDismiss = useCallback(() => {
    setShowAlert(false);
  }, []);

  // Cronômetro em tempo real - APENAS SESSÃO ATUAL
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const updateTime = () => {
      if (!sessaoAtual) {
        setElapsedSeconds(0);
        return;
      }

      const inicio = new Date(sessaoAtual.entrada);
      const agora = new Date();
      const diffSeconds = Math.floor(
        (agora.getTime() - inicio.getTime()) / 1000
      );

      const tempoPausado = (sessaoAtual.tempo_pausado_minutos || 0) * 60;

      if (sessaoAtual.status === 'ativa') {
        setElapsedSeconds(Math.max(0, diffSeconds - tempoPausado));
      } else if (sessaoAtual.status === 'pausada') {
        setElapsedSeconds(Math.max(0, diffSeconds - tempoPausado));
      } else {
        setElapsedSeconds(0);
      }
    };

    if (sessaoAtual && sessaoAtual.status === 'ativa') {
      updateTime();
      timer = setInterval(updateTime, 1000);
    } else {
      updateTime();
    }

    return () => {
      if (timer) clearInterval(timer);
    };
  }, [sessaoAtual]);

  // Refresh quando app volta pro foreground
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        refreshData();
      }
    });
    return () => subscription.remove();
  }, []);

  // Formatar tempo com horas, minutos E segundos
  const formatTimeWithSeconds = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    return `${hours}h ${minutes.toString().padStart(2, '0')}m ${seconds.toString().padStart(2, '0')}s`;
  };

  // Formatar só horas e minutos (para exibição compacta)
  const formatTimeCompact = (totalSeconds: number): string => {
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    return `${hours}h ${minutes.toString().padStart(2, '0')}min`;
  };

  // Iniciar manualmente
  const handleStart = async () => {
    if (!activeGeofence) {
      Alert.alert(
        'Aviso',
        'Você precisa estar dentro de um local de trabalho para iniciar.'
      );
      return;
    }

    await startTimer(
      activeGeofence,
      currentLocation
        ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            accuracy: accuracy || undefined,
          }
        : undefined
    );

    refreshData();
  };

  // Pausar
  const handlePause = () => {
    pausar();
  };

  // Retomar
  const handleResume = () => {
    retomar();
  };

  // Encerrar
  const handleStop = () => {
    if (!sessaoAtual) return;

    Alert.alert(
      'Encerrar Cronômetro',
      'Deseja encerrar e finalizar o registro?',
      [
        { text: 'Cancelar', style: 'cancel' },
        {
          text: 'Encerrar',
          style: 'destructive',
          onPress: async () => {
            try {
              logger.info('home', 'Encerrar pressed - stopping session', {
                localId: sessaoAtual.local_id,
              });

              await registrarSaida(
                sessaoAtual.local_id,
                currentLocation
                  ? {
                      latitude: currentLocation.latitude,
                      longitude: currentLocation.longitude,
                      accuracy: accuracy || undefined,
                    }
                  : undefined
              );

              refreshData();
              logger.info('home', 'Session stopped successfully');
            } catch (error) {
              logger.error('home', 'Error stopping session', {
                error: String(error),
              });
            }
          },
        },
      ]
    );
  };

  // Teste de sync manual
  const handleTestSync = async () => {
    logger.info('home', '🧪 Manual sync triggered by user');
    await syncNow();
    Alert.alert('Sync', 'Sincronização completa!');
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Inicializando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <GeofenceAlert
        visible={showAlert}
        data={alertData}
        autoActionSeconds={autoActionTimeout}
        entryDelayMinutes={entryDelayOption}
        exitAgoMinutes1={exitTimeOption1}
        exitAgoMinutes2={exitTimeOption2}
      />

      <ScrollView>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.greeting}>👋 Olá!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Status Card */}
        <View
          style={[
            styles.statusCard,
            isWorking && !isPaused && styles.statusCardActive,
          ]}
        >
          <Text style={styles.statusLabel}>📍 Status</Text>

          {isWorking ? (
            <>
              <Text
                style={[
                  styles.statusText,
                  isPaused ? styles.statusTextPaused : styles.statusTextActive,
                ]}
              >
                {isPaused ? '⏸️ PAUSADO' : '🟢 TRABALHANDO'}
              </Text>
              <Text style={styles.localName}>
                {sessaoAtual?.local_nome || 'Local'}
              </Text>
              <Text style={styles.sinceText}>
                Desde{' '}
                {sessaoAtual?.entrada
                  ? new Date(sessaoAtual.entrada).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })
                  : '-'}
              </Text>

              <View style={styles.buttonRow}>
                {!isPaused ? (
                  <Button
                    title="⏸️ Pausar"
                    onPress={handlePause}
                    variant="secondary"
                    style={styles.pauseButton}
                  />
                ) : (
                  <Button
                    title="▶️ Retomar"
                    onPress={handleResume}
                    style={styles.pauseButton}
                  />
                )}
                <Button
                  title="⏹️ Encerrar"
                  onPress={handleStop}
                  variant="secondary"
                  style={styles.stopButton}
                />
              </View>
            </>
          ) : (
            <>
              <Text style={styles.inactiveText}>
                {isInsideGeofence
                  ? 'Pronto para trabalhar'
                  : 'Fora do local de trabalho'}
              </Text>
              {isInsideGeofence && (
                <>
                  <Text style={styles.localName}>{activeLocal?.nome}</Text>
                  <Button
                    title="▶️ Iniciar Cronômetro"
                    onPress={handleStart}
                    style={{ marginTop: 12 }}
                  />
                </>
              )}
              {!isInsideGeofence && locais.length === 0 && (
                <Text style={styles.hint}>
                  Vá até a aba Mapa para adicionar locais
                </Text>
              )}
            </>
          )}
        </View>

        {/* Horas Card - COM SEGUNDOS */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>⏱️ Hoje</Text>
          <Text
            style={[
              styles.bigNumber,
              isWorking && !isPaused && styles.activeNumber,
            ]}
          >
            {formatTimeWithSeconds(elapsedSeconds)}
          </Text>
          {isWorking && !isPaused && (
            <Text style={styles.runningIndicator}>● Cronômetro rodando...</Text>
          )}
          {isPaused && <Text style={styles.pausedIndicator}>⏸️ Pausado</Text>}
          {!isWorking && sessoesHoje.length === 0 && (
            <Text style={styles.hint}>Nenhum registro hoje</Text>
          )}
        </View>

        {/* Sessões de Hoje */}
        {sessoesHoje.length > 0 && (
          <View style={styles.card}>
            <Text style={styles.cardTitle}>📋 Sessões de Hoje</Text>
            {sessoesHoje.slice(0, 5).map((sessao) => (
              <View key={sessao.id} style={styles.sessaoItem}>
                <View style={styles.sessaoInfo}>
                  <Text style={styles.sessaoLocal}>
                    {sessao.local_nome || 'Local'}
                  </Text>
                  <Text style={styles.sessaoTime}>
                    {new Date(sessao.entrada).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {sessao.saida
                      ? ` - ${new Date(sessao.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : ' - agora'}
                  </Text>
                </View>
                <Text
                  style={[
                    styles.sessaoDuracao,
                    sessao.status === 'pausada' && styles.pausedDuracao,
                    sessao.status === 'ativa' && styles.activeDuracao,
                  ]}
                >
                  {sessao.status === 'finalizada'
                    ? formatTimeCompact((sessao.duracao_minutos || 0) * 60)
                    : sessao.status === 'pausada'
                      ? '⏸️'
                      : '⏳'}
                </Text>
              </View>
            ))}
          </View>
        )}

        {/* GPS Info */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>🛰️ GPS</Text>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Localização:</Text>
            <Text style={styles.gpsValue}>
              {currentLocation
                ? `${currentLocation.latitude.toFixed(4)}, ${currentLocation.longitude.toFixed(4)}`
                : 'Obtendo...'}
            </Text>
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Monitoramento:</Text>
            <Text
              style={[styles.gpsValue, isGeofencingActive && styles.activeGps]}
            >
              {isGeofencingActive ? '🟢 Ativo' : '⚫ Inativo'}
            </Text>
          </View>
          {locais.length > 0 && !isGeofencingActive && (
            <Text style={styles.warningText}>
              ⚠️ Monitoramento inativo. Vá em Mapa para ativar.
            </Text>
          )}
        </View>

        {/* Sync Info - NOVO! */}
        <View style={styles.card}>
          <Text style={styles.cardTitle}>☁️ Sincronização</Text>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Status:</Text>
            <Text style={[styles.gpsValue, isOnline && styles.activeGps]}>
              {isOnline ? '🟢 Online' : '⚫ Offline'}
            </Text>
          </View>
          <View style={styles.gpsRow}>
            <Text style={styles.gpsLabel}>Última sync:</Text>
            <Text style={styles.gpsValue}>
              {lastSyncAt
                ? new Date(lastSyncAt).toLocaleTimeString('pt-BR', {
                    hour: '2-digit',
                    minute: '2-digit',
                  })
                : 'Nunca'}
            </Text>
          </View>
          <Button
            title={isSyncing ? '⏳ Sincronizando...' : '🔄 Sync Manual'}
            onPress={handleTestSync}
            variant="secondary"
            style={{ marginTop: 12 }}
            disabled={isSyncing || !isOnline}
          />
        </View>

        <View style={{ height: 100 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 16,
    color: colors.textSecondary,
  },
  header: {
    padding: 16,
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
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  statusCard: {
    backgroundColor: colors.background,
    marginHorizontal: 16,
    marginBottom: 16,
    padding: 20,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: colors.border,
  },
  statusCardActive: {
    borderColor: colors.success,
    backgroundColor: '#E8F5E9',
  },
  statusLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 8,
  },
  statusTextActive: {
    color: colors.success,
  },
  statusTextPaused: {
    color: colors.warning,
  },
  inactiveText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  localName: {
    fontSize: 20,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sinceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
  },
  pauseButton: {
    flex: 1,
  },
  stopButton: {
    flex: 1,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.text,
    textAlign: 'center',
    marginVertical: 8,
  },
  activeNumber: {
    color: colors.success,
  },
  runningIndicator: {
    fontSize: 14,
    color: colors.success,
    textAlign: 'center',
  },
  pausedIndicator: {
    fontSize: 14,
    color: colors.warning,
    textAlign: 'center',
  },
  hint: {
    fontSize: 14,
    color: colors.textTertiary,
    textAlign: 'center',
    marginTop: 8,
  },
  sessaoItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  sessaoInfo: {
    flex: 1,
  },
  sessaoLocal: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  sessaoTime: {
    fontSize: 12,
    color: colors.textSecondary,
    marginTop: 2,
  },
  sessaoDuracao: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.text,
  },
  pausedDuracao: {
    color: colors.warning,
  },
  activeDuracao: {
    color: colors.success,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  gpsLabel: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  gpsValue: {
    fontSize: 14,
    color: colors.text,
    fontWeight: '500',
  },
  activeGps: {
    color: colors.success,
  },
  warningText: {
    fontSize: 12,
    color: colors.warning,
    marginTop: 8,
  },
});
