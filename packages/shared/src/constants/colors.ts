/**
 * Paleta de cores do OnSite Flow
 */

export const colors = {
  // Cores principais
  primary: {
    50: '#EFF6FF',
    100: '#DBEAFE',
    200: '#BFDBFE',
    300: '#93C5FD',
    400: '#60A5FA',
    500: '#3B82F6', // Principal
    600: '#2563EB',
    700: '#1D4ED8',
    800: '#1E40AF',
    900: '#1E3A8A',
  },

  // Sucesso (check-in, online)
  success: {
    50: '#F0FDF4',
    100: '#DCFCE7',
    200: '#BBF7D0',
    300: '#86EFAC',
    400: '#4ADE80',
    500: '#22C55E', // Principal
    600: '#16A34A',
    700: '#15803D',
    800: '#166534',
    900: '#14532D',
  },

  // Alerta (warning, pendente)
  warning: {
    50: '#FFFBEB',
    100: '#FEF3C7',
    200: '#FDE68A',
    300: '#FCD34D',
    400: '#FBBF24',
    500: '#F59E0B', // Principal
    600: '#D97706',
    700: '#B45309',
    800: '#92400E',
    900: '#78350F',
  },

  // Erro (offline, falha)
  error: {
    50: '#FEF2F2',
    100: '#FEE2E2',
    200: '#FECACA',
    300: '#FCA5A5',
    400: '#F87171',
    500: '#EF4444', // Principal
    600: '#DC2626',
    700: '#B91C1C',
    800: '#991B1B',
    900: '#7F1D1D',
  },

  // Neutros
  gray: {
    50: '#F9FAFB',
    100: '#F3F4F6',
    200: '#E5E7EB',
    300: '#D1D5DB',
    400: '#9CA3AF',
    500: '#6B7280',
    600: '#4B5563',
    700: '#374151',
    800: '#1F2937',
    900: '#111827',
  },

  // Cores de locais (para distinguir geofences)
  locals: [
    '#3B82F6', // Azul
    '#22C55E', // Verde
    '#F59E0B', // Amarelo
    '#EF4444', // Vermelho
    '#8B5CF6', // Roxo
    '#EC4899', // Rosa
    '#06B6D4', // Ciano
    '#F97316', // Laranja
    '#14B8A6', // Teal
    '#6366F1', // Indigo
  ],

  // Fundos
  background: {
    primary: '#FFFFFF',
    secondary: '#F9FAFB',
    tertiary: '#F3F4F6',
    dark: '#111827',
  },

  // Texto
  text: {
    primary: '#111827',
    secondary: '#4B5563',
    tertiary: '#9CA3AF',
    inverse: '#FFFFFF',
  },

  // Bordas
  border: {
    light: '#E5E7EB',
    medium: '#D1D5DB',
    dark: '#9CA3AF',
  },
} as const;

// Cores dos níveis de log
export const logLevelColors = {
  debug: colors.primary[500],
  info: colors.success[500],
  warn: colors.warning[500],
  error: colors.error[500],
  security: '#8B5CF6', // Roxo
} as const;

// Tipo para as cores
export type ColorPalette = typeof colors;
export type LogLevelColor = keyof typeof logLevelColors;
