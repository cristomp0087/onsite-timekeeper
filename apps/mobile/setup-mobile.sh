#!/bin/bash

# ============================================
# OnSite Flow Mobile - Setup Script
# ============================================

echo "🚀 Criando estrutura do OnSite Flow Mobile..."

# Criar pastas
mkdir -p src/components/ui
mkdir -p src/lib
mkdir -p src/stores
mkdir -p src/hooks
mkdir -p src/constants
mkdir -p app/\(auth\)
mkdir -p app/\(tabs\)

echo "📁 Pastas criadas!"

# ============================================
# app.json - Configuração do Expo
# ============================================
cat > app.json << 'APPJSON'
{
  "expo": {
    "name": "OnSite Flow",
    "slug": "onsite-flow",
    "version": "1.0.0",
    "orientation": "portrait",
    "icon": "./assets/icon.png",
    "scheme": "onsiteflow",
    "userInterfaceStyle": "light",
    "newArchEnabled": true,
    "splash": {
      "image": "./assets/splash-icon.png",
      "resizeMode": "contain",
      "backgroundColor": "#3B82F6"
    },
    "ios": {
      "supportsTablet": true,
      "bundleIdentifier": "com.onsiteclub.flow"
    },
    "android": {
      "adaptiveIcon": {
        "foregroundImage": "./assets/adaptive-icon.png",
        "backgroundColor": "#3B82F6"
      },
      "package": "com.onsiteclub.flow"
    },
    "web": {
      "bundler": "metro",
      "output": "static",
      "favicon": "./assets/favicon.png"
    },
    "plugins": ["expo-router"],
    "experiments": {
      "typedRoutes": true
    }
  }
}
APPJSON

echo "✅ app.json criado!"

# ============================================
# src/lib/supabase.ts - Cliente Supabase
# ============================================
cat > src/lib/supabase.ts << 'SUPABASE'
import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || 'https://xmpckuiluwhcdzyadggh.supabase.co';
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_Jj4HnCvIqOYMh8cL4hND8Q_Z4FB5G72';

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
SUPABASE

echo "✅ supabase.ts criado!"

# ============================================
# src/lib/logger.ts - Sistema de Logs
# ============================================
cat > src/lib/logger.ts << 'LOGGER'
import { supabase } from './supabase';

type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'security';
type LogCategory = 'auth' | 'gps' | 'geofence' | 'sync' | 'database' | 'api' | 'security' | 'perf';

interface LogEntry {
  level: LogLevel;
  category: LogCategory;
  message: string;
  metadata?: Record<string, unknown>;
}

// Fila de logs
const logQueue: LogEntry[] = [];
let flushTimeout: NodeJS.Timeout | null = null;

const CONFIG = {
  flushInterval: 10000,
  maxQueueSize: 50,
  enableConsole: __DEV__,
  enableRemote: true,
};

// Emojis para o console
const levelEmoji = {
  debug: '🔵',
  info: '🟢',
  warn: '🟡',
  error: '🔴',
  security: '🟣',
};

// Listeners para o DevMonitor
type LogListener = (entry: LogEntry & { timestamp: Date }) => void;
const listeners: LogListener[] = [];

export function addLogListener(listener: LogListener) {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index > -1) listeners.splice(index, 1);
  };
}

function notifyListeners(entry: LogEntry) {
  const entryWithTime = { ...entry, timestamp: new Date() };
  listeners.forEach(listener => listener(entryWithTime));
}

export function log(
  level: LogLevel,
  category: LogCategory,
  message: string,
  metadata?: Record<string, unknown>
) {
  const entry: LogEntry = { level, category, message, metadata };
  
  // Notificar DevMonitor
  notifyListeners(entry);
  
  // Console em desenvolvimento
  if (CONFIG.enableConsole) {
    const emoji = levelEmoji[level];
    console.log(`${emoji} [${category.toUpperCase()}] ${message}`, metadata || '');
  }
  
  // Adiciona à fila para envio
  if (CONFIG.enableRemote) {
    logQueue.push(entry);
    
    if (logQueue.length >= CONFIG.maxQueueSize) {
      flushLogs();
    }
    
    if (!flushTimeout) {
      flushTimeout = setTimeout(flushLogs, CONFIG.flushInterval);
    }
  }
}

async function flushLogs() {
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  
  if (logQueue.length === 0) return;
  
  const logsToSend = [...logQueue];
  logQueue.length = 0;
  
  try {
    const { data: { user } } = await supabase.auth.getUser();
    
    const entries = logsToSend.map(entry => ({
      level: entry.level,
      category: entry.category,
      message: entry.message,
      metadata: entry.metadata || {},
      user_id: user?.id || null,
      app_version: '1.0.0',
    }));
    
    await supabase.from('app_logs').insert(entries);
  } catch (error) {
    if (__DEV__) console.error('Failed to flush logs:', error);
  }
}

// Helpers
export const logger = {
  debug: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) => log('debug', cat, msg, meta),
  info: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) => log('info', cat, msg, meta),
  warn: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) => log('warn', cat, msg, meta),
  error: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) => log('error', cat, msg, meta),
  security: (cat: LogCategory, msg: string, meta?: Record<string, unknown>) => log('security', cat, msg, meta),
};

export { flushLogs };
LOGGER

echo "✅ logger.ts criado!"

# ============================================
# src/stores/authStore.ts - Estado de Auth
# ============================================
cat > src/stores/authStore.ts << 'AUTHSTORE'
import { create } from 'zustand';
import { supabase } from '../lib/supabase';
import { logger } from '../lib/logger';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  
  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, nome: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,
  
  initialize: async () => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        set({ 
          user: session.user, 
          session, 
          isAuthenticated: true,
          isLoading: false 
        });
        logger.info('auth', 'Session restored', { userId: session.user.id });
      } else {
        set({ isLoading: false });
      }
      
      // Listener para mudanças de auth
      supabase.auth.onAuthStateChange((_event, session) => {
        set({ 
          user: session?.user || null, 
          session,
          isAuthenticated: !!session 
        });
      });
    } catch (error) {
      logger.error('auth', 'Failed to initialize auth', { error });
      set({ isLoading: false });
    }
  },
  
  signIn: async (email: string, password: string) => {
    try {
      logger.info('auth', 'Sign in attempt', { email });
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      
      if (error) {
        logger.warn('auth', 'Sign in failed', { error: error.message });
        return { error: error.message };
      }
      
      set({ 
        user: data.user, 
        session: data.session,
        isAuthenticated: true 
      });
      
      logger.info('auth', 'Sign in successful', { userId: data.user?.id });
      return { error: null };
    } catch (error) {
      logger.error('auth', 'Sign in error', { error });
      return { error: 'Erro ao fazer login' };
    }
  },
  
  signUp: async (email: string, password: string, nome: string) => {
    try {
      logger.info('auth', 'Sign up attempt', { email });
      
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: { nome }
        }
      });
      
      if (error) {
        logger.warn('auth', 'Sign up failed', { error: error.message });
        return { error: error.message };
      }
      
      logger.info('auth', 'Sign up successful', { userId: data.user?.id });
      return { error: null };
    } catch (error) {
      logger.error('auth', 'Sign up error', { error });
      return { error: 'Erro ao criar conta' };
    }
  },
  
  signOut: async () => {
    try {
      logger.info('auth', 'Sign out');
      await supabase.auth.signOut();
      set({ user: null, session: null, isAuthenticated: false });
    } catch (error) {
      logger.error('auth', 'Sign out error', { error });
    }
  },
}));
AUTHSTORE

echo "✅ authStore.ts criado!"

# ============================================
# src/constants/colors.ts
# ============================================
cat > src/constants/colors.ts << 'COLORS'
export const colors = {
  primary: '#3B82F6',
  primaryDark: '#2563EB',
  success: '#22C55E',
  warning: '#F59E0B',
  error: '#EF4444',
  
  background: '#FFFFFF',
  backgroundSecondary: '#F9FAFB',
  
  text: '#111827',
  textSecondary: '#6B7280',
  textTertiary: '#9CA3AF',
  
  border: '#E5E7EB',
  borderDark: '#D1D5DB',
  
  white: '#FFFFFF',
  black: '#000000',
};
COLORS

echo "✅ colors.ts criado!"

# ============================================
# src/components/ui/Button.tsx
# ============================================
cat > src/components/ui/Button.tsx << 'BUTTON'
import React from 'react';
import { 
  TouchableOpacity, 
  Text, 
  StyleSheet, 
  ActivityIndicator,
  ViewStyle,
  TextStyle 
} from 'react-native';
import { colors } from '../../constants/colors';

interface ButtonProps {
  title: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'outline';
  disabled?: boolean;
  loading?: boolean;
  style?: ViewStyle;
  textStyle?: TextStyle;
}

export function Button({ 
  title, 
  onPress, 
  variant = 'primary',
  disabled = false,
  loading = false,
  style,
  textStyle,
}: ButtonProps) {
  const isDisabled = disabled || loading;
  
  return (
    <TouchableOpacity
      style={[
        styles.button,
        variant === 'primary' && styles.primary,
        variant === 'secondary' && styles.secondary,
        variant === 'outline' && styles.outline,
        isDisabled && styles.disabled,
        style,
      ]}
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
    >
      {loading ? (
        <ActivityIndicator color={variant === 'outline' ? colors.primary : colors.white} />
      ) : (
        <Text style={[
          styles.text,
          variant === 'outline' && styles.outlineText,
          textStyle,
        ]}>
          {title}
        </Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingVertical: 14,
    paddingHorizontal: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 50,
  },
  primary: {
    backgroundColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.textSecondary,
  },
  outline: {
    backgroundColor: 'transparent',
    borderWidth: 2,
    borderColor: colors.primary,
  },
  disabled: {
    opacity: 0.5,
  },
  text: {
    color: colors.white,
    fontSize: 16,
    fontWeight: '600',
  },
  outlineText: {
    color: colors.primary,
  },
});
BUTTON

echo "✅ Button.tsx criado!"

# ============================================
# src/components/ui/Input.tsx
# ============================================
cat > src/components/ui/Input.tsx << 'INPUT'
import React, { useState } from 'react';
import { 
  View, 
  TextInput, 
  Text, 
  StyleSheet,
  TouchableOpacity,
  TextInputProps,
} from 'react-native';
import { colors } from '../../constants/colors';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export function Input({ 
  label, 
  error, 
  leftIcon,
  rightIcon,
  secureTextEntry,
  ...props 
}: InputProps) {
  const [isSecure, setIsSecure] = useState(secureTextEntry);
  const [isFocused, setIsFocused] = useState(false);
  
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      
      <View style={[
        styles.inputContainer,
        isFocused && styles.focused,
        error && styles.errorBorder,
      ]}>
        {leftIcon && <View style={styles.icon}>{leftIcon}</View>}
        
        <TextInput
          style={styles.input}
          placeholderTextColor={colors.textTertiary}
          secureTextEntry={isSecure}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          {...props}
        />
        
        {secureTextEntry && (
          <TouchableOpacity 
            style={styles.icon} 
            onPress={() => setIsSecure(!isSecure)}
          >
            <Text style={styles.showHide}>{isSecure ? '👁️' : '🙈'}</Text>
          </TouchableOpacity>
        )}
        
        {rightIcon && <View style={styles.icon}>{rightIcon}</View>}
      </View>
      
      {error && <Text style={styles.error}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginBottom: 16,
  },
  label: {
    fontSize: 14,
    fontWeight: '500',
    color: colors.text,
    marginBottom: 6,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.backgroundSecondary,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.border,
    paddingHorizontal: 12,
  },
  focused: {
    borderColor: colors.primary,
    borderWidth: 2,
  },
  errorBorder: {
    borderColor: colors.error,
  },
  input: {
    flex: 1,
    paddingVertical: 14,
    fontSize: 16,
    color: colors.text,
  },
  icon: {
    marginHorizontal: 4,
  },
  showHide: {
    fontSize: 18,
  },
  error: {
    color: colors.error,
    fontSize: 12,
    marginTop: 4,
  },
});
INPUT

echo "✅ Input.tsx criado!"

# ============================================
# src/components/DevMonitor.tsx - O "F12" do app!
# ============================================
cat > src/components/DevMonitor.tsx << 'DEVMONITOR'
import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Animated,
  Dimensions,
} from 'react-native';
import { addLogListener } from '../lib/logger';
import { colors } from '../constants/colors';

interface LogEntry {
  level: string;
  category: string;
  message: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const levelColors: Record<string, string> = {
  debug: '#3B82F6',
  info: '#22C55E',
  warn: '#F59E0B',
  error: '#EF4444',
  security: '#8B5CF6',
};

const levelEmoji: Record<string, string> = {
  debug: '🔵',
  info: '🟢',
  warn: '🟡',
  error: '🔴',
  security: '🟣',
};

export function DevMonitor() {
  const [isOpen, setIsOpen] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const slideAnim = useRef(new Animated.Value(0)).current;
  const scrollRef = useRef<ScrollView>(null);
  
  // Só mostra em desenvolvimento
  if (!__DEV__) return null;
  
  useEffect(() => {
    const unsubscribe = addLogListener((entry) => {
      setLogs(prev => [...prev.slice(-99), entry]);
      // Auto scroll
      setTimeout(() => {
        scrollRef.current?.scrollToEnd({ animated: true });
      }, 100);
    });
    
    return unsubscribe;
  }, []);
  
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isOpen ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isOpen]);
  
  const panelHeight = Dimensions.get('window').height * 0.5;
  
  const translateY = slideAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [panelHeight, 0],
  });
  
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };
  
  return (
    <>
      {/* Botão flutuante */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setIsOpen(!isOpen)}
        activeOpacity={0.8}
      >
        <Text style={styles.fabText}>{isOpen ? '✕' : '🔍'}</Text>
      </TouchableOpacity>
      
      {/* Painel de logs */}
      <Animated.View 
        style={[
          styles.panel,
          { height: panelHeight, transform: [{ translateY }] }
        ]}
        pointerEvents={isOpen ? 'auto' : 'none'}
      >
        <View style={styles.header}>
          <Text style={styles.title}>🔍 DevMonitor</Text>
          <TouchableOpacity onPress={() => setLogs([])}>
            <Text style={styles.clearBtn}>Limpar</Text>
          </TouchableOpacity>
        </View>
        
        <ScrollView 
          ref={scrollRef}
          style={styles.logList}
          showsVerticalScrollIndicator={true}
        >
          {logs.length === 0 ? (
            <Text style={styles.emptyText}>Nenhum log ainda...</Text>
          ) : (
            logs.map((log, index) => (
              <View key={index} style={styles.logEntry}>
                <Text style={styles.logTime}>{formatTime(log.timestamp)}</Text>
                <Text style={[styles.logLevel, { color: levelColors[log.level] }]}>
                  {levelEmoji[log.level]} {log.category.toUpperCase()}
                </Text>
                <Text style={styles.logMessage}>{log.message}</Text>
                {log.metadata && Object.keys(log.metadata).length > 0 && (
                  <Text style={styles.logMeta}>
                    {JSON.stringify(log.metadata, null, 2)}
                  </Text>
                )}
              </View>
            ))
          )}
        </ScrollView>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  fab: {
    position: 'absolute',
    bottom: 100,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#1F2937',
    justifyContent: 'center',
    alignItems: 'center',
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    zIndex: 1000,
  },
  fabText: {
    fontSize: 24,
  },
  panel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#1F2937',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    zIndex: 999,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  title: {
    color: '#FFF',
    fontSize: 18,
    fontWeight: 'bold',
  },
  clearBtn: {
    color: '#EF4444',
    fontSize: 14,
  },
  logList: {
    flex: 1,
    padding: 12,
  },
  emptyText: {
    color: '#9CA3AF',
    textAlign: 'center',
    marginTop: 20,
  },
  logEntry: {
    marginBottom: 12,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#374151',
  },
  logTime: {
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: 'monospace',
  },
  logLevel: {
    fontSize: 12,
    fontWeight: 'bold',
    marginTop: 2,
  },
  logMessage: {
    color: '#FFF',
    fontSize: 13,
    marginTop: 4,
  },
  logMeta: {
    color: '#9CA3AF',
    fontSize: 11,
    fontFamily: 'monospace',
    marginTop: 4,
    backgroundColor: '#374151',
    padding: 8,
    borderRadius: 4,
  },
});
DEVMONITOR

echo "✅ DevMonitor.tsx criado!"

# ============================================
# app/_layout.tsx - Layout principal
# ============================================
cat > app/_layout.tsx << 'ROOTLAYOUT'
import { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useAuthStore } from '../src/stores/authStore';
import { DevMonitor } from '../src/components/DevMonitor';
import { logger } from '../src/lib/logger';
import { colors } from '../src/constants/colors';

export default function RootLayout() {
  const { initialize, isLoading } = useAuthStore();
  
  useEffect(() => {
    logger.info('auth', 'App starting...');
    initialize();
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

echo "✅ _layout.tsx criado!"

# ============================================
# app/index.tsx - Redireciona baseado em auth
# ============================================
cat > app/index.tsx << 'INDEXROUTE'
import { Redirect } from 'expo-router';
import { useAuthStore } from '../src/stores/authStore';

export default function Index() {
  const { isAuthenticated } = useAuthStore();
  
  if (isAuthenticated) {
    return <Redirect href="/(tabs)" />;
  }
  
  return <Redirect href="/(auth)/login" />;
}
INDEXROUTE

echo "✅ index.tsx criado!"

# ============================================
# app/(auth)/_layout.tsx
# ============================================
cat > 'app/(auth)/_layout.tsx' << 'AUTHLAYOUT'
import { Stack } from 'expo-router';

export default function AuthLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="login" />
      <Stack.Screen name="register" />
    </Stack>
  );
}
AUTHLAYOUT

echo "✅ (auth)/_layout.tsx criado!"

# ============================================
# app/(auth)/login.tsx
# ============================================
cat > 'app/(auth)/login.tsx' << 'LOGIN'
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '../../src/constants/colors';

export default function LoginScreen() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signIn } = useAuthStore();
  
  const handleLogin = async () => {
    if (!email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    
    setLoading(true);
    const { error } = await signIn(email, password);
    setLoading(false);
    
    if (error) {
      Alert.alert('Erro', error);
    } else {
      router.replace('/(tabs)');
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>📍</Text>
          <Text style={styles.title}>OnSite Flow</Text>
          <Text style={styles.subtitle}>Entre para continuar</Text>
        </View>
        
        <View style={styles.form}>
          <Input
            label="Email"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <Button
            title="Entrar"
            onPress={handleLogin}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Não tem conta? </Text>
          <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
            <Text style={styles.link}>Criar conta</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: colors.textSecondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
LOGIN

echo "✅ login.tsx criado!"

# ============================================
# app/(auth)/register.tsx
# ============================================
cat > 'app/(auth)/register.tsx' << 'REGISTER'
import React, { useState } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  KeyboardAvoidingView,
  Platform,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Input } from '../../src/components/ui/Input';
import { Button } from '../../src/components/ui/Button';
import { useAuthStore } from '../../src/stores/authStore';
import { colors } from '../../src/constants/colors';

export default function RegisterScreen() {
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const { signUp } = useAuthStore();
  
  const handleRegister = async () => {
    if (!nome || !email || !password) {
      Alert.alert('Erro', 'Preencha todos os campos');
      return;
    }
    
    if (password.length < 6) {
      Alert.alert('Erro', 'A senha deve ter pelo menos 6 caracteres');
      return;
    }
    
    setLoading(true);
    const { error } = await signUp(email, password, nome);
    setLoading(false);
    
    if (error) {
      Alert.alert('Erro', error);
    } else {
      Alert.alert('Sucesso', 'Conta criada! Faça login para continuar.');
      router.replace('/(auth)/login');
    }
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>📍</Text>
          <Text style={styles.title}>Criar Conta</Text>
          <Text style={styles.subtitle}>Comece a rastrear suas horas</Text>
        </View>
        
        <View style={styles.form}>
          <Input
            label="Nome"
            placeholder="Seu nome"
            value={nome}
            onChangeText={setNome}
          />
          
          <Input
            label="Email"
            placeholder="seu@email.com"
            value={email}
            onChangeText={setEmail}
            keyboardType="email-address"
            autoCapitalize="none"
          />
          
          <Input
            label="Senha"
            placeholder="••••••••"
            value={password}
            onChangeText={setPassword}
            secureTextEntry
          />
          
          <Button
            title="Criar Conta"
            onPress={handleRegister}
            loading={loading}
            style={{ marginTop: 8 }}
          />
        </View>
        
        <View style={styles.footer}>
          <Text style={styles.footerText}>Já tem conta? </Text>
          <TouchableOpacity onPress={() => router.back()}>
            <Text style={styles.link}>Fazer login</Text>
          </TouchableOpacity>
        </View>
      </KeyboardAvoidingView>
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
    padding: 24,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  logo: {
    fontSize: 64,
    marginBottom: 16,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: colors.text,
  },
  subtitle: {
    fontSize: 16,
    color: colors.textSecondary,
    marginTop: 8,
  },
  form: {
    marginBottom: 24,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'center',
  },
  footerText: {
    color: colors.textSecondary,
  },
  link: {
    color: colors.primary,
    fontWeight: '600',
  },
});
REGISTER

echo "✅ register.tsx criado!"

# ============================================
# app/(tabs)/_layout.tsx
# ============================================
cat > 'app/(tabs)/_layout.tsx' << 'TABLAYOUT'
import { Tabs } from 'expo-router';
import { Text } from 'react-native';
import { colors } from '../../src/constants/colors';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.primary,
        tabBarInactiveTintColor: colors.textTertiary,
        tabBarStyle: {
          backgroundColor: colors.background,
          borderTopColor: colors.border,
          paddingTop: 8,
          paddingBottom: 8,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '500',
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Início',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🏠</Text>,
        }}
      />
      <Tabs.Screen
        name="map"
        options={{
          title: 'Mapa',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>🗺️</Text>,
        }}
      />
      <Tabs.Screen
        name="history"
        options={{
          title: 'Histórico',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>📋</Text>,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Config',
          tabBarIcon: ({ color }) => <Text style={{ fontSize: 24 }}>⚙️</Text>,
        }}
      />
    </Tabs>
  );
}
TABLAYOUT

echo "✅ (tabs)/_layout.tsx criado!"

# ============================================
# app/(tabs)/index.tsx - Home
# ============================================
cat > 'app/(tabs)/index.tsx' << 'HOME'
import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useAuthStore } from '../../src/stores/authStore';
import { logger } from '../../src/lib/logger';
import { colors } from '../../src/constants/colors';
import { Button } from '../../src/components/ui/Button';

export default function HomeScreen() {
  const { user } = useAuthStore();
  
  useEffect(() => {
    logger.info('auth', 'Home screen loaded', { userId: user?.id });
  }, []);
  
  const testLog = () => {
    logger.debug('perf', 'Debug test', { test: true });
    logger.info('gps', 'Info test - GPS position updated', { lat: 45.4215, lng: -75.6972 });
    logger.warn('sync', 'Warning test - Sync retry', { attempt: 2 });
    logger.error('api', 'Error test - API failed', { status: 500 });
    logger.security('auth', 'Security test - Token check');
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>👋 Olá!</Text>
        <Text style={styles.email}>{user?.email}</Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>📍 Status</Text>
        <Text style={styles.status}>Nenhum local ativo</Text>
        <Text style={styles.hint}>
          Vá até a aba Mapa para adicionar locais de trabalho
        </Text>
      </View>
      
      <View style={styles.card}>
        <Text style={styles.cardTitle}>⏱️ Hoje</Text>
        <Text style={styles.bigNumber}>0h 00min</Text>
        <Text style={styles.hint}>Nenhum registro hoje</Text>
      </View>
      
      <View style={styles.testSection}>
        <Text style={styles.testTitle}>🧪 Teste o DevMonitor:</Text>
        <Button 
          title="Gerar Logs de Teste" 
          onPress={testLog}
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
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    color: colors.text,
    marginBottom: 12,
  },
  status: {
    fontSize: 18,
    color: colors.textSecondary,
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
HOME

echo "✅ (tabs)/index.tsx criado!"

# ============================================
# app/(tabs)/map.tsx
# ============================================
cat > 'app/(tabs)/map.tsx' << 'MAP'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/colors';

export default function MapScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>🗺️ Mapa</Text>
      </View>
      
      <View style={styles.placeholder}>
        <Text style={styles.emoji}>🗺️</Text>
        <Text style={styles.text}>Mapa será implementado no Checkpoint 3</Text>
        <Text style={styles.subtext}>
          Aqui você poderá adicionar locais de trabalho e ver geofences
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
MAP

echo "✅ (tabs)/map.tsx criado!"

# ============================================
# app/(tabs)/history.tsx
# ============================================
cat > 'app/(tabs)/history.tsx' << 'HISTORY'
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { colors } from '../../src/constants/colors';

export default function HistoryScreen() {
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>📋 Histórico</Text>
      </View>
      
      <View style={styles.placeholder}>
        <Text style={styles.emoji}>📋</Text>
        <Text style={styles.text}>Seus registros aparecerão aqui</Text>
        <Text style={styles.subtext}>
          Checkpoint 4 - Banco local e sincronização
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  header: {
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  placeholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  emoji: {
    fontSize: 64,
    marginBottom: 16,
  },
  text: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
  },
  subtext: {
    fontSize: 14,
    color: colors.textSecondary,
    textAlign: 'center',
    marginTop: 8,
  },
});
HISTORY

echo "✅ (tabs)/history.tsx criado!"

# ============================================
# app/(tabs)/settings.tsx
# ============================================
cat > 'app/(tabs)/settings.tsx' << 'SETTINGS'
import React from 'react';
import { View, Text, StyleSheet, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { useAuthStore } from '../../src/stores/authStore';
import { Button } from '../../src/components/ui/Button';
import { colors } from '../../src/constants/colors';

export default function SettingsScreen() {
  const { user, signOut } = useAuthStore();
  
  const handleSignOut = () => {
    Alert.alert(
      'Sair',
      'Tem certeza que deseja sair?',
      [
        { text: 'Cancelar', style: 'cancel' },
        { 
          text: 'Sair', 
          style: 'destructive',
          onPress: async () => {
            await signOut();
            router.replace('/(auth)/login');
          }
        },
      ]
    );
  };
  
  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.title}>⚙️ Configurações</Text>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Conta</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Email</Text>
          <Text style={styles.value}>{user?.email}</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>ID</Text>
          <Text style={styles.valueSmall}>{user?.id}</Text>
        </View>
      </View>
      
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>App</Text>
        <View style={styles.card}>
          <Text style={styles.label}>Versão</Text>
          <Text style={styles.value}>1.0.0 (Checkpoint 2)</Text>
        </View>
        <View style={styles.card}>
          <Text style={styles.label}>Região</Text>
          <Text style={styles.value}>🇨🇦 Canada (Ottawa)</Text>
        </View>
      </View>
      
      <View style={styles.footer}>
        <Button
          title="Sair da Conta"
          onPress={handleSignOut}
          variant="outline"
          style={{ borderColor: colors.error }}
          textStyle={{ color: colors.error }}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.backgroundSecondary,
  },
  header: {
    padding: 16,
    backgroundColor: colors.background,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: colors.text,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  card: {
    backgroundColor: colors.background,
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  label: {
    fontSize: 12,
    color: colors.textSecondary,
    marginBottom: 4,
  },
  value: {
    fontSize: 16,
    color: colors.text,
    fontWeight: '500',
  },
  valueSmall: {
    fontSize: 12,
    color: colors.text,
    fontFamily: 'monospace',
  },
  footer: {
    marginTop: 'auto',
    padding: 16,
  },
});
SETTINGS

echo "✅ (tabs)/settings.tsx criado!"

# ============================================
# Instalar Zustand (gerenciador de estado)
# ============================================
echo ""
echo "📦 Instalando Zustand..."
npm install zustand

echo ""
echo "✅✅✅ ESTRUTURA COMPLETA CRIADA! ✅✅✅"
echo ""
echo "Agora reinicie o servidor Expo:"
echo "  1. No outro terminal, pressione Ctrl+C"
echo "  2. Rode: npx expo start"
echo ""
