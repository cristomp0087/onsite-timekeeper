import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { User, Session } from '@supabase/supabase-js';

interface AuthState {
  user: User | null;
  session: Session | null;
  isLoading: boolean;
  isInitialized: boolean;

  initialize: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
}

export const useAuthStore = create<AuthState>((set, get) => ({
  user: null,
  session: null,
  isLoading: true,
  isInitialized: false,

  initialize: async () => {
    if (get().isInitialized) return;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      set({
        user: session?.user ?? null,
        session,
        isLoading: false,
        isInitialized: true,
      });

      // Listener para mudanças de auth
      supabase.auth.onAuthStateChange((_event, session) => {
        set({
          user: session?.user ?? null,
          session,
        });
      });
    } catch (error) {
      console.error('Auth init error:', error);
      set({ isLoading: false, isInitialized: true });
    }
  },

  signIn: async (email: string, password: string) => {
    set({ isLoading: true });

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      set({ isLoading: false });
      return { error };
    }

    set({
      user: data.user,
      session: data.session,
      isLoading: false,
    });

    return { error: null };
  },

  signOut: async () => {
    await supabase.auth.signOut();
    set({ user: null, session: null });
  },
}));
