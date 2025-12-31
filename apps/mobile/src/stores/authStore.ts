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
  signIn: (
    email: string,
    password: string
  ) => Promise<{ error: string | null }>;
  signUp: (
    email: string,
    password: string,
    nome: string
  ) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isAuthenticated: false,

  initialize: async () => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        set({
          user: session.user,
          session,
          isAuthenticated: true,
          isLoading: false,
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
          isAuthenticated: !!session,
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
        isAuthenticated: true,
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
          data: { nome },
        },
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
