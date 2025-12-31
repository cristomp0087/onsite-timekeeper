import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { logger } from '../lib/logger';

// Opções disponíveis para ajuste de tempo (em minutos)
export const EXIT_TIME_OPTIONS = [5, 10, 15, 20, 30, 45, 60];
export const ENTRY_DELAY_OPTIONS = [5, 10, 15, 20, 30];
export const AUTO_ACTION_TIMEOUT_OPTIONS = [15, 30, 45, 60];

interface SettingsState {
  // Popup de SAÍDA - opções "Há X min"
  exitTimeOption1: number; // Primeiro botão (default: 10)
  exitTimeOption2: number; // Segundo botão (default: 30)

  // Popup de ENTRADA - opção "Em X min"
  entryDelayOption: number; // Default: 10

  // Tempo do countdown automático (em segundos)
  autoActionTimeout: number; // Default: 30

  // Actions
  setExitTimeOption1: (minutes: number) => void;
  setExitTimeOption2: (minutes: number) => void;
  setEntryDelayOption: (minutes: number) => void;
  setAutoActionTimeout: (seconds: number) => void;
  resetToDefaults: () => void;
}

const DEFAULT_SETTINGS = {
  exitTimeOption1: 10,
  exitTimeOption2: 30,
  entryDelayOption: 10,
  autoActionTimeout: 30,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...DEFAULT_SETTINGS,

      setExitTimeOption1: (minutes: number) => {
        set({ exitTimeOption1: minutes });
        logger.info('settings', 'Exit time option 1 updated', { minutes });
      },

      setExitTimeOption2: (minutes: number) => {
        set({ exitTimeOption2: minutes });
        logger.info('settings', 'Exit time option 2 updated', { minutes });
      },

      setEntryDelayOption: (minutes: number) => {
        set({ entryDelayOption: minutes });
        logger.info('settings', 'Entry delay option updated', { minutes });
      },

      setAutoActionTimeout: (seconds: number) => {
        set({ autoActionTimeout: seconds });
        logger.info('settings', 'Auto action timeout updated', { seconds });
      },

      resetToDefaults: () => {
        set(DEFAULT_SETTINGS);
        logger.info('settings', 'Settings reset to defaults');
      },
    }),
    {
      name: 'onsite-settings',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
