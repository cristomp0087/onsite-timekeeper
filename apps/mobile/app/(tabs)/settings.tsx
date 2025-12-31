import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/colors';
import {
  useSettingsStore,
  EXIT_TIME_OPTIONS,
  ENTRY_DELAY_OPTIONS,
  AUTO_ACTION_TIMEOUT_OPTIONS,
} from '../../src/stores/settingsStore';
import { useAuthStore } from '../../src/stores/authStore';

export default function SettingsScreen() {
  const {
    exitTimeOption1,
    exitTimeOption2,
    entryDelayOption,
    autoActionTimeout,
    setExitTimeOption1,
    setExitTimeOption2,
    setEntryDelayOption,
    setAutoActionTimeout,
    resetToDefaults,
  } = useSettingsStore();

  const { user, signOut } = useAuthStore();

  const handleResetDefaults = () => {
    Alert.alert(
      'Restaurar Padrões',
      'Tem certeza que deseja restaurar as configurações padrão?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { text: 'Restaurar', onPress: resetToDefaults },
      ]
    );
  };

  const handleSignOut = () => {
    Alert.alert('Sair da Conta', 'Tem certeza que deseja sair?', [
      { text: 'Cancelar', style: 'cancel' },
      { text: 'Sair', style: 'destructive', onPress: signOut },
    ]);
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView style={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={styles.headerTitle}>⚙️ Configurações</Text>
        </View>

        {/* Conta */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>👤 Conta</Text>
          <View style={styles.card}>
            <Text style={styles.emailText}>
              {user?.email || 'Não conectado'}
            </Text>
            <TouchableOpacity
              style={styles.signOutButton}
              onPress={handleSignOut}
            >
              <Text style={styles.signOutText}>Sair da conta</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Popup de Saída */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>🚪 Popup de Saída</Text>
          <Text style={styles.sectionDesc}>
            Quando você sai de uma fence, escolha os botões de ajuste de tempo
          </Text>

          <View style={styles.card}>
            <Text style={styles.optionLabel}>Primeiro botão "Há X min"</Text>
            <View style={styles.optionsRow}>
              {EXIT_TIME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionButton,
                    exitTimeOption1 === opt && styles.optionButtonActive,
                  ]}
                  onPress={() => setExitTimeOption1(opt)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      exitTimeOption1 === opt && styles.optionButtonTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.optionLabel, { marginTop: 16 }]}>
              Segundo botão "Há X min"
            </Text>
            <View style={styles.optionsRow}>
              {EXIT_TIME_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionButton,
                    exitTimeOption2 === opt && styles.optionButtonActive,
                  ]}
                  onPress={() => setExitTimeOption2(opt)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      exitTimeOption2 === opt && styles.optionButtonTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Popup de Entrada */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>📍 Popup de Entrada</Text>
          <Text style={styles.sectionDesc}>
            Quando você chega em uma fence, escolha o tempo de atraso
          </Text>

          <View style={styles.card}>
            <Text style={styles.optionLabel}>Botão "Em X min"</Text>
            <View style={styles.optionsRow}>
              {ENTRY_DELAY_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionButton,
                    entryDelayOption === opt && styles.optionButtonActive,
                  ]}
                  onPress={() => setEntryDelayOption(opt)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      entryDelayOption === opt && styles.optionButtonTextActive,
                    ]}
                  >
                    {opt}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Auto-ação */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>⏱️ Tempo Automático</Text>
          <Text style={styles.sectionDesc}>
            Tempo de espera antes da ação automática (em segundos)
          </Text>

          <View style={styles.card}>
            <Text style={styles.optionLabel}>Countdown do popup</Text>
            <View style={styles.optionsRow}>
              {AUTO_ACTION_TIMEOUT_OPTIONS.map((opt) => (
                <TouchableOpacity
                  key={opt}
                  style={[
                    styles.optionButton,
                    autoActionTimeout === opt && styles.optionButtonActive,
                  ]}
                  onPress={() => setAutoActionTimeout(opt)}
                >
                  <Text
                    style={[
                      styles.optionButtonText,
                      autoActionTimeout === opt &&
                        styles.optionButtonTextActive,
                    ]}
                  >
                    {opt}s
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        </View>

        {/* Restaurar Padrões */}
        <View style={styles.section}>
          <TouchableOpacity
            style={styles.resetButton}
            onPress={handleResetDefaults}
          >
            <Text style={styles.resetButtonText}>
              🔄 Restaurar Configurações Padrão
            </Text>
          </TouchableOpacity>
        </View>

        {/* Versão */}
        <View style={styles.footer}>
          <Text style={styles.versionText}>OnSite Flow v1.0.0</Text>
          <Text style={styles.copyrightText}>© 2024 Shabba</Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  content: {
    flex: 1,
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
  section: {
    paddingHorizontal: 20,
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 4,
  },
  sectionDesc: {
    fontSize: 13,
    color: colors.textSecondary,
    marginBottom: 12,
  },
  card: {
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    padding: 16,
  },
  emailText: {
    fontSize: 16,
    color: colors.text,
    marginBottom: 12,
  },
  signOutButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    backgroundColor: colors.background,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  signOutText: {
    color: colors.danger,
    fontWeight: '600',
  },
  optionLabel: {
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 10,
  },
  optionsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  optionButton: {
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: colors.background,
    borderWidth: 1,
    borderColor: colors.border,
    minWidth: 50,
    alignItems: 'center',
  },
  optionButtonActive: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  optionButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
  },
  optionButtonTextActive: {
    color: '#FFFFFF',
  },
  resetButton: {
    paddingVertical: 14,
    paddingHorizontal: 20,
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    alignItems: 'center',
  },
  resetButtonText: {
    fontSize: 15,
    color: colors.textSecondary,
    fontWeight: '500',
  },
  footer: {
    alignItems: 'center',
    paddingVertical: 30,
    paddingBottom: 50,
  },
  versionText: {
    fontSize: 14,
    color: colors.textSecondary,
  },
  copyrightText: {
    fontSize: 12,
    color: colors.textTertiary,
    marginTop: 4,
  },
});
