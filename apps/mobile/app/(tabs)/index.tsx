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

        logger.info('home', 'Full initialization complete');
      } catch (error) {
        logger.error('home', 'Initialization error', { error });
      } finally {
        setIsInitializing(false);
      }
    };

    initializeAll();
  }, []);

  // Mostrar alert quando há pending entry ou exit
  useEffect(() => {
    if (pendingEntry) {
      setAlertData({
        type: 'enter',
        localId: pendingEntry.localId,
        localNome: pendingEntry.localNome,
        onStart: handleAlertStart,
        onDelayEntry: handleAlertDelayEntry,
        onSkipToday: handleAlertSkipToday,
        onStop: () => {},
        onStopAgo1: () => {},
        onStopAgo2: () => {},
        onDismiss: handleAlertDismiss,
      });
      setShowAlert(true);
    } else if (pendingExit) {
      setAlertData({
        type: 'exit',
        localId: pendingExit.localId,
        localNome: pendingExit.localNome,
        onStart: () => {},
        onDelayEntry: () => {},
        onSkipToday: () => {},
        onStop: handleAlertStop,
        onStopAgo1: handleAlertStopAgo1,
        onStopAgo2: handleAlertStopAgo2,
        onDismiss: handleAlertDismiss,
      });
      setShowAlert(true);
    } else {
      setShowAlert(false);
      setAlertData(null);
    }
  }, [pendingEntry, pendingExit]);

  // Handlers do Alert - ENTRADA
  const handleAlertStart = useCallback(async () => {
    if (!pendingEntry) return;
    setShowAlert(false);
    await startTimer(pendingEntry.localId, pendingEntry.coords);
    clearPending();
    refreshData();
  }, [pendingEntry, startTimer, clearPending, refreshData]);

  const handleAlertDelayEntry = useCallback(async () => {
    if (!pendingEntry) return;
    setShowAlert(false);
    await scheduleDelayedStart(
      pendingEntry.localId,
      pendingEntry.localNome,
      entryDelayOption
    );
    clearPending();
  }, [pendingEntry, scheduleDelayedStart, clearPending, entryDelayOption]);

  const handleAlertSkipToday = useCallback(() => {
    if (!pendingEntry) return;
    setShowAlert(false);
    addToSkippedToday(pendingEntry.localId);
    clearPending();
  }, [pendingEntry, addToSkippedToday, clearPending]);

  // Handlers do Alert - SAÍDA
  const handleAlertStop = useCallback(async () => {
    if (!pendingExit) return;
    setShowAlert(false);
    await stopTimer(pendingExit.localId, pendingExit.coords);
    clearPending();
    refreshData();
  }, [pendingExit, stopTimer, clearPending, refreshData]);

  const handleAlertStopAgo1 = useCallback(async () => {
    if (!pendingExit) return;
    setShowAlert(false);
    // Encerrar com desconto de X minutos (configurável)
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
    // Encerrar com desconto de X minutos (configurável)
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
    // Não limpa pending - vai continuar o countdown via notificação do sistema
  }, []);

  // Cronômetro em tempo real - APENAS SESSÃO ATUAL
  useEffect(() => {
    let timer: NodeJS.Timeout | null = null;

    const updateTime = () => {
      if (!sessaoAtual) {
        // Sem sessão ativa - mostrar ZERO (não total do dia)
        setElapsedSeconds(0);
        return;
      }

      const inicio = new Date(sessaoAtual.entrada);
      const agora = new Date();
      const diffSeconds = Math.floor(
        (agora.getTime() - inicio.getTime()) / 1000
      );

      // Tempo pausado (em segundos)
      const tempoPausado = (sessaoAtual.tempo_pausado_minutos || 0) * 60;

      if (sessaoAtual.status === 'ativa') {
        // Mostrar APENAS tempo desta sessão
        setElapsedSeconds(Math.max(0, diffSeconds - tempoPausado));
      } else if (sessaoAtual.status === 'pausada') {
        // Quando pausado, mostrar último valor
        setElapsedSeconds(Math.max(0, diffSeconds - tempoPausado));
      } else {
        // Finalizada - mostrar zero para próxima sessão
        setElapsedSeconds(0);
      }
    };

    if (sessaoAtual && sessaoAtual.status === 'ativa') {
      updateTime();
      timer = setInterval(updateTime, 1000); // Atualiza a cada segundo
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

  // Encerrar - CORRIGIDO
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

              // Forçar refresh após encerrar
              await refreshData();

              logger.info('home', 'Session stopped successfully');
            } catch (error) {
              logger.error('home', 'Error stopping session', { error });
              Alert.alert(
                'Erro',
                'Não foi possível encerrar a sessão. Tente novamente.'
              );
            }
          },
        },
      ]
    );
  };

  if (isInitializing) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Alert grande estilo despertador */}
      <GeofenceAlert
        visible={showAlert}
        data={alertData}
        autoActionSeconds={autoActionTimeout}
        entryDelayMinutes={entryDelayOption}
        exitAgoMinutes1={exitTimeOption1}
        exitAgoMinutes2={exitTimeOption2}
      />

      <ScrollView>
        <View style={styles.header}>
          <Text style={styles.greeting}>👋 Olá!</Text>
          <Text style={styles.email}>{user?.email}</Text>
        </View>

        {/* Status Card */}
        <View
          style={[
            styles.card,
            isWorking && !isPaused && styles.activeCard,
            isPaused && styles.pausedCard,
          ]}
        >
          <Text style={styles.cardTitle}>📍 Status</Text>

          {isWorking ? (
            <>
              <Text style={[styles.statusText, isPaused && styles.pausedText]}>
                {isPaused ? '⏸️ PAUSADO' : '🟢 TRABALHANDO'}
              </Text>
              <Text style={styles.localName}>
                {sessaoAtual?.local_nome || activeLocal?.nome || 'Local'}
              </Text>
              <Text style={styles.sinceText}>
                Desde{' '}
                {new Date(sessaoAtual!.entrada).toLocaleTimeString('pt-BR', {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </Text>

              {/* Botões de controle */}
              <View style={styles.controlButtons}>
                {isPaused ? (
                  <Button
                    title="▶️ Retomar"
                    onPress={handleResume}
                    style={styles.resumeButton}
                  />
                ) : (
                  <Button
                    title="⏸️ Pausar"
                    onPress={handlePause}
                    variant="outline"
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
                    {sessao.fim
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
    borderRadius: 16,
    padding: 16,
    marginHorizontal: 16,
    marginBottom: 12,
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
  pausedCard: {
    backgroundColor: '#FEF3C7',
    borderWidth: 2,
    borderColor: '#F59E0B',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
  },
  statusText: {
    fontSize: 14,
    fontWeight: 'bold',
    color: colors.success,
  },
  pausedText: {
    color: '#F59E0B',
  },
  localName: {
    fontSize: 22,
    fontWeight: 'bold',
    color: colors.text,
    marginTop: 4,
  },
  sinceText: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  controlButtons: {
    flexDirection: 'row',
    marginTop: 16,
    gap: 8,
  },
  pauseButton: {
    flex: 1,
  },
  resumeButton: {
    flex: 1,
    backgroundColor: colors.success,
  },
  stopButton: {
    flex: 1,
    backgroundColor: '#FEE2E2',
  },
  inactiveText: {
    fontSize: 18,
    color: colors.textSecondary,
  },
  hint: {
    fontSize: 14,
    color: colors.textTertiary,
    marginTop: 8,
  },
  warningText: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 8,
  },
  bigNumber: {
    fontSize: 36,
    fontWeight: 'bold',
    color: colors.primary,
    fontVariant: ['tabular-nums'],
  },
  activeNumber: {
    color: colors.success,
  },
  runningIndicator: {
    fontSize: 12,
    color: colors.success,
    marginTop: 4,
  },
  pausedIndicator: {
    fontSize: 12,
    color: '#F59E0B',
    marginTop: 4,
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
    fontWeight: '500',
    color: colors.text,
  },
  sessaoTime: {
    fontSize: 12,
    color: colors.textSecondary,
  },
  sessaoDuracao: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.primary,
  },
  pausedDuracao: {
    color: '#F59E0B',
  },
  activeDuracao: {
    color: colors.success,
  },
  gpsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 6,
  },
  gpsLabel: {
    color: colors.textSecondary,
    fontSize: 13,
  },
  gpsValue: {
    color: colors.text,
    fontSize: 13,
    fontFamily: 'monospace',
  },
  activeGps: {
    color: colors.success,
  },
});
