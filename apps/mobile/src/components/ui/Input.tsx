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

      <View
        style={[
          styles.inputContainer,
          isFocused && styles.focused,
          error && styles.errorBorder,
        ]}
      >
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
