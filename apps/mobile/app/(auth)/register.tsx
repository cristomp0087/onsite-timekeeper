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
