import React, { useEffect, useState, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Vibration,
  Dimensions,
} from 'react-native';
import { colors } from '../constants/colors';

const { height } = Dimensions.get('window');

export type GeofenceAlertType = 'enter' | 'exit';

export interface GeofenceAlertData {
  type: GeofenceAlertType;
  localId: string;
  localNome: string;
  // Entrada
  onStart: () => void;
  onSkipToday: () => void;
  onDelayEntry: () => void;
  // Saída
  onStop: () => void;
  onStopAgo1: () => void;
  onStopAgo2: () => void;
  // Geral
  onDismiss: () => void;
}

interface Props {
  visible: boolean;
  data: GeofenceAlertData | null;
  autoActionSeconds?: number;
  // Configurações personalizáveis
  entryDelayMinutes?: number;
  exitAgoMinutes1?: number;
  exitAgoMinutes2?: number;
}

export function GeofenceAlert({
  visible,
  data,
  autoActionSeconds = 30,
  entryDelayMinutes = 10,
  exitAgoMinutes1 = 10,
  exitAgoMinutes2 = 30,
}: Props) {
  const [countdown, setCountdown] = useState(autoActionSeconds);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const slideAnim = useRef(new Animated.Value(height)).current;

  useEffect(() => {
    if (visible) {
      setCountdown(autoActionSeconds);
      Vibration.vibrate([0, 500, 200, 500]);

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 50,
        friction: 8,
      }).start();

      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.05,
            duration: 800,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 800,
            useNativeDriver: true,
          }),
        ])
      );
      pulse.start();
      return () => pulse.stop();
    } else {
      Animated.timing(slideAnim, {
        toValue: height,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);

  useEffect(() => {
    if (!visible || !data) return;

    const timer = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(timer);
          if (data.type === 'enter') {
            data.onStart();
          } else {
            data.onStop();
          }
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [visible, data]);

  if (!visible || !data) return null;

  const isEnter = data.type === 'enter';
  const bgColor = isEnter ? '#10B981' : '#F59E0B';
  const autoActionText = isEnter
    ? 'Inicia automaticamente'
    : 'Encerra automaticamente';

  return (
    <Modal
      visible={visible}
      animationType="none"
      transparent
      statusBarTranslucent
    >
      <Animated.View
        style={[
          styles.container,
          { backgroundColor: bgColor },
          { transform: [{ translateY: slideAnim }] },
        ]}
      >
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>{isEnter ? '📍' : '🚪'}</Text>
        </View>

        <Text style={styles.title}>
          {isEnter ? 'Você chegou!' : 'Você saiu!'}
        </Text>
        <Text style={styles.localName}>{data.localNome}</Text>

        <View style={styles.countdownContainer}>
          <Text style={styles.countdownText}>{autoActionText} em</Text>
          <Text style={styles.countdownNumber}>{countdown}s</Text>
        </View>

        {isEnter ? (
          <View style={styles.buttonsContainer}>
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }], width: '100%' }}
            >
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#FFFFFF' }]}
                onPress={data.onStart}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonIcon}>▶️</Text>
                <Text style={[styles.primaryButtonText, { color: bgColor }]}>
                  Iniciar Cronômetro
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={data.onDelayEntry}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonIcon}>⏰</Text>
                <Text style={styles.secondaryButtonText}>
                  Em {entryDelayMinutes} min
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={data.onSkipToday}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonIcon}>😴</Text>
                <Text style={styles.secondaryButtonText}>Ignorar hoje</Text>
              </TouchableOpacity>
            </View>
          </View>
        ) : (
          <View style={styles.buttonsContainer}>
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }], width: '100%' }}
            >
              <TouchableOpacity
                style={[styles.primaryButton, { backgroundColor: '#FFFFFF' }]}
                onPress={data.onStop}
                activeOpacity={0.8}
              >
                <Text style={styles.primaryButtonIcon}>⏹️</Text>
                <Text style={[styles.primaryButtonText, { color: bgColor }]}>
                  Encerrar Agora
                </Text>
              </TouchableOpacity>
            </Animated.View>
            <View style={styles.secondaryRow}>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={data.onStopAgo1}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonIcon}>⏪</Text>
                <Text style={styles.secondaryButtonText}>
                  Há {exitAgoMinutes1} min
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.secondaryButton}
                onPress={data.onStopAgo2}
                activeOpacity={0.7}
              >
                <Text style={styles.secondaryButtonIcon}>⏪</Text>
                <Text style={styles.secondaryButtonText}>
                  Há {exitAgoMinutes2} min
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        <TouchableOpacity
          style={styles.closeButton}
          onPress={data.onDismiss}
          activeOpacity={0.7}
        >
          <Text style={styles.closeButtonText}>✕</Text>
        </TouchableOpacity>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 60,
    paddingBottom: 40,
  },
  iconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: 'rgba(255,255,255,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  icon: { fontSize: 60 },
  title: {
    fontSize: 32,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 8,
  },
  localName: {
    fontSize: 24,
    fontWeight: '600',
    color: 'rgba(255,255,255,0.9)',
    textAlign: 'center',
    marginBottom: 32,
  },
  countdownContainer: { alignItems: 'center', marginBottom: 40 },
  countdownText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.8)',
    marginBottom: 8,
  },
  countdownNumber: { fontSize: 48, fontWeight: 'bold', color: '#FFFFFF' },
  buttonsContainer: { width: '100%', alignItems: 'center' },
  primaryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    paddingHorizontal: 32,
    borderRadius: 16,
    width: '100%',
    marginBottom: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  primaryButtonIcon: { fontSize: 24, marginRight: 12 },
  primaryButtonText: { fontSize: 20, fontWeight: 'bold' },
  secondaryRow: { flexDirection: 'row', gap: 12, width: '100%' },
  secondaryButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 16,
    borderRadius: 12,
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  secondaryButtonIcon: { fontSize: 18, marginRight: 8 },
  secondaryButtonText: { fontSize: 14, fontWeight: '600', color: '#FFFFFF' },
  closeButton: {
    position: 'absolute',
    top: 50,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0,0,0,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  closeButtonText: { fontSize: 20, color: '#FFFFFF', fontWeight: 'bold' },
});
