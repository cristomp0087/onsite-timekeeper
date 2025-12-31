import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { useRegistroStore } from '../src/stores/registroStore';
import { useWorkSessionStore } from '../src/stores/workSessionStore';
import { useSyncStore } from '../src/stores/syncStore';
import { DevMonitor } from '../src/components/DevMonitor';
import { logger } from '../src/lib/logger';
import { colors } from '../src/constants/colors';

export default function RootLayout() {
  const { initialize: initAuth, isLoading, user } = useAuthStore();
  const { initialize: initRegistros } = useRegistroStore();
  const { initialize: initWorkSession } = useWorkSessionStore();
  const { initialize: initSync } = useSyncStore();

  useEffect(() => {
    logger.info('auth', 'App starting...');
    initAuth();
    initRegistros();
    initWorkSession();
  }, []);

  // Inicializar sync quando usuário logar
  useEffect(() => {
    if (user) {
      logger.info('sync', 'User logged in, initializing sync...');
      initSync();
    }
  }, [user]);

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
