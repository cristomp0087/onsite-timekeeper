import { createClient } from '@supabase/supabase-js';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ||
  'https://xmpckuiluwhcdzyadggh.supabase.co';
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_Jj4HnCvIqOYMh8cL4hND8Q_Z4FB5G72';

// Storage que funciona em web e mobile
const customStorage =
  Platform.OS === 'web'
    ? {
        getItem: (key: string) => {
          if (typeof window !== 'undefined') {
            return Promise.resolve(window.localStorage.getItem(key));
          }
          return Promise.resolve(null);
        },
        setItem: (key: string, value: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.setItem(key, value);
          }
          return Promise.resolve();
        },
        removeItem: (key: string) => {
          if (typeof window !== 'undefined') {
            window.localStorage.removeItem(key);
          }
          return Promise.resolve();
        },
      }
    : AsyncStorage;

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: customStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
