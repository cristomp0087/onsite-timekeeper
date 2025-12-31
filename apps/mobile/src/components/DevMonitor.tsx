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
      setLogs((prev) => [...prev.slice(-99), entry]);
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
          { height: panelHeight, transform: [{ translateY }] },
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
                <Text
                  style={[styles.logLevel, { color: levelColors[log.level] }]}
                >
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
