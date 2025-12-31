import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Share,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import { useRegistroStore } from '../../src/stores/registroStore';
import { useAuthStore } from '../../src/stores/authStore';
import {
  getSessoesHoje,
  formatDuration,
  type SessaoDB,
} from '../../src/lib/database';
import {
  generateTextReport,
  generateSummaryReport,
  generateSingleSessionReport,
  formatDateBR,
  formatDurationText,
} from '../../src/lib/reports';
import { colors } from '../../src/constants/colors';
import { logger } from '../../src/lib/logger';

export default function HistoryScreen() {
  const { refreshData, isInitialized } = useRegistroStore();
  const { user } = useAuthStore();
  const [sessoes, setSessoes] = useState<SessaoDB[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [totalMinutos, setTotalMinutos] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  // Modo seleção
  const [selectionMode, setSelectionMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const loadSessoes = useCallback(async () => {
    if (!isInitialized) {
      logger.debug('database', 'History: waiting for initialization');
      return;
    }

    try {
      setIsLoading(true);
      
      // Buscar sessões de hoje
      const result = await getSessoesHoje();

      // Filtrar apenas sessões finalizadas para o total
      const finalizadas = result.filter((s) => s.saida !== null);
      setSessoes(result);

      // Calcular total
      const total = finalizadas.reduce(
        (acc, s) => acc + (s.duracao_minutos || 0),
        0
      );
      setTotalMinutos(total);

      logger.info('database', `History: loaded ${result.length} sessions`);
    } catch (error) {
      logger.error('database', 'Error loading sessions', {
        error: String(error),
      });
      setSessoes([]);
      setTotalMinutos(0);
    } finally {
      setIsLoading(false);
    }
  }, [isInitialized]);

  // Refresh on focus
  useFocusEffect(
    useCallback(() => {
      logger.debug('database', 'History screen focused - refreshing');
      loadSessoes();
    }, [loadSessoes])
  );

  // Pull to refresh
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await refreshData();
    await loadSessoes();
    setRefreshing(false);
  }, [refreshData, loadSessoes]);

  // Share relatório geral
  const handleShareReport = async () => {
    try {
      const report = await generateSummaryReport(sessoes);
      await Share.share({
        message: report,
        title: 'Relatório OnSite Flow',
      });
    } catch (error) {
      logger.error('share', 'Error sharing report', { error });
      Alert.alert('Erro', 'Não foi possível compartilhar o relatório');
    }
  };

  // Share sessão individual
  const handleShareSession = async (sessao: SessaoDB) => {
    try {
      const report = await generateSingleSessionReport(sessao);
      await Share.share({
        message: report,
        title: `Sessão ${sessao.local_nome}`,
      });
    } catch (error) {
      logger.error('share', 'Error sharing session', { error });
      Alert.alert('Erro', 'Não foi possível compartilhar');
    }
  };

  // Toggle seleção
  const toggleSelection = (id: string) => {
    setSelectedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  // Compartilhar selecionadas
  const handleShareSelected = async () => {
    const selected = sessoes.filter((s) => selectedIds.has(s.id));
    if (selected.length === 0) return;

    try {
      const report = await generateTextReport(selected);
      await Share.share({
        message: report,
        title: `${selected.length} Sessões - OnSite Flow`,
      });
      setSelectionMode(false);
      setSelectedIds(new Set());
    } catch (error) {
      logger.error('share', 'Error sharing selected', { error });
      Alert.alert('Erro', 'Não foi possível compartilhar');
    }
  };

  if (isLoading) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.loadingContainer}>
          <Text style={styles.loadingText}>Carregando...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>📋 Histórico</Text>
          <Text style={styles.subtitle}>Sessões de Hoje</Text>
        </View>

        {/* Summary Card */}
        <View style={styles.summaryCard}>
          <View style={styles.summaryRow}>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Total</Text>
              <Text style={styles.summaryValue}>{formatDuration(totalMinutos)}</Text>
            </View>
            <View style={styles.summaryItem}>
              <Text style={styles.summaryLabel}>Sessões</Text>
              <Text style={styles.summaryValue}>{sessoes.length}</Text>
            </View>
          </View>
          {sessoes.length > 0 && (
            <TouchableOpacity
              style={styles.shareButton}
              onPress={handleShareReport}
            >
              <Text style={styles.shareButtonText}>📤 Compartilhar Relatório</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Selection Mode Controls */}
        {selectionMode && (
          <View style={styles.selectionControls}>
            <TouchableOpacity
              onPress={() => {
                setSelectionMode(false);
                setSelectedIds(new Set());
              }}
            >
              <Text style={styles.cancelText}>Cancelar</Text>
            </TouchableOpacity>
            <Text style={styles.selectedText}>
              {selectedIds.size} selecionada(s)
            </Text>
            <TouchableOpacity
              onPress={handleShareSelected}
              disabled={selectedIds.size === 0}
            >
              <Text
                style={[
                  styles.shareText,
                  selectedIds.size === 0 && styles.disabledText,
                ]}
              >
                Compartilhar
              </Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Sessions List */}
        <View style={styles.listContainer}>
          {sessoes.length === 0 ? (
            <View style={styles.emptyContainer}>
              <Text style={styles.emptyEmoji}>📭</Text>
              <Text style={styles.emptyText}>Nenhum registro hoje</Text>
              <Text style={styles.emptyHint}>
                Inicie o cronômetro quando chegar ao trabalho
              </Text>
            </View>
          ) : (
            sessoes.map((sessao) => (
              <TouchableOpacity
                key={sessao.id}
                style={[
                  styles.sessionCard,
                  selectedIds.has(sessao.id) && styles.sessionCardSelected,
                ]}
                onPress={() => {
                  if (selectionMode) {
                    toggleSelection(sessao.id);
                  } else {
                    handleShareSession(sessao);
                  }
                }}
                onLongPress={() => {
                  setSelectionMode(true);
                  toggleSelection(sessao.id);
                }}
              >
                <View style={styles.sessionHeader}>
                  <View
                    style={[
                      styles.statusDot,
                      sessao.status === 'ativa' && styles.statusActive,
                      sessao.status === 'pausada' && styles.statusPaused,
                      sessao.status === 'finalizada' && styles.statusFinished,
                    ]}
                  />
                  <Text style={styles.sessionLocal}>
                    {sessao.local_nome || 'Local'}
                  </Text>
                  {selectionMode && selectedIds.has(sessao.id) && (
                    <Text style={styles.checkmark}>✓</Text>
                  )}
                </View>

                <View style={styles.sessionDetails}>
                  <Text style={styles.sessionTime}>
                    {new Date(sessao.entrada).toLocaleTimeString('pt-BR', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {sessao.saida
                      ? ` - ${new Date(sessao.saida).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}`
                      : ' - agora'}
                  </Text>

                  <Text
                    style={[
                      styles.sessionDuration,
                      sessao.status === 'ativa' && styles.durationActive,
                    ]}
                  >
                    {sessao.duracao_minutos !== undefined
                      ? formatDuration(sessao.duracao_minutos)
                      : '0min'}
                  </Text>
                </View>

                {sessao.editado_manualmente === 1 && (
                  <Text style={styles.editedBadge}>✏️ Editado</Text>
                )}
              </TouchableOpacity>
            ))
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
    color: colors.textSecondary,
  },
  header: {
    padding: 20,
    paddingBottom: 10,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 4,
  },
  summaryCard: {
    backgroundColor: colors.background,
    marginHorizontal: 20,
    marginBottom: 16,
    padding: 16,
    borderRadius: 12,
  },
  summaryRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginBottom: 16,
  },
  summaryItem: {
    alignItems: 'center',
  },
  summaryLabel: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  summaryValue: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.primary,
  },
  shareButton: {
    backgroundColor: colors.primary,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  shareButtonText: {
    color: colors.white,
    fontWeight: '600',
  },
  selectionControls: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: colors.background,
    marginBottom: 8,
  },
  cancelText: {
    color: colors.error,
    fontWeight: '600',
  },
  selectedText: {
    color: colors.text,
  },
  shareText: {
    color: colors.primary,
    fontWeight: '600',
  },
  disabledText: {
    opacity: 0.3,
  },
  listContainer: {
    paddingHorizontal: 20,
  },
  emptyContainer: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  emptyEmoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 18,
    color: colors.textSecondary,
    marginBottom: 8,
  },
  emptyHint: {
    fontSize: 14,
    color: colors.textTertiary,
  },
  sessionCard: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 12,
  },
  sessionCardSelected: {
    borderWidth: 2,
    borderColor: colors.primary,
  },
  sessionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    marginRight: 8,
  },
  statusActive: {
    backgroundColor: colors.success,
  },
  statusPaused: {
    backgroundColor: colors.warning,
  },
  statusFinished: {
    backgroundColor: colors.textTertiary,
  },
  sessionLocal: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    flex: 1,
  },
  checkmark: {
    fontSize: 20,
    color: colors.primary,
  },
  sessionDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sessionTime: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  sessionDuration: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
  },
  durationActive: {
    color: colors.success,
  },
  editedBadge: {
    fontSize: 11,
    color: colors.warning,
    marginTop: 8,
  },
});
