/**
 * Tipos do Banco de Dados - OnSite Timekeeper Web
 * 
 * Alinhado com estrutura do Supabase
 * 
 * Localização: apps/web/src/types/database.ts
 */

export type Database = {
  public: {
    Tables: {
      locais: {
        Row: {
          id: string;
          user_id: string;
          nome: string;
          latitude: number;
          longitude: number;
          raio: number;
          cor: string | null;
          ativo: boolean;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          nome: string;
          latitude: number;
          longitude: number;
          raio?: number;
          cor?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          nome?: string;
          latitude?: number;
          longitude?: number;
          raio?: number;
          cor?: string | null;
          ativo?: boolean;
          created_at?: string;
          updated_at?: string;
        };
      };
      registros: {
        Row: {
          id: string;
          user_id: string;
          local_id: string;
          local_nome: string | null;
          entrada: string;
          saida: string | null;
          tipo: string;
          editado_manualmente: boolean;
          motivo_edicao: string | null;
          hash_integridade: string | null;
          cor: string | null;
          device_id: string | null;
          created_at: string;
          synced_at: string | null;
        };
        Insert: {
          id?: string;
          user_id: string;
          local_id: string;
          local_nome?: string | null;
          entrada: string;
          saida?: string | null;
          tipo?: string;
          editado_manualmente?: boolean;
          motivo_edicao?: string | null;
          hash_integridade?: string | null;
          cor?: string | null;
          device_id?: string | null;
          created_at?: string;
          synced_at?: string | null;
        };
        Update: {
          id?: string;
          user_id?: string;
          local_id?: string;
          local_nome?: string | null;
          entrada?: string;
          saida?: string | null;
          tipo?: string;
          editado_manualmente?: boolean;
          motivo_edicao?: string | null;
          hash_integridade?: string | null;
          cor?: string | null;
          device_id?: string | null;
          created_at?: string;
          synced_at?: string | null;
        };
      };
      profiles: {
        Row: {
          id: string;
          email: string | null;
          nome: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id: string;
          email?: string | null;
          nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          email?: string | null;
          nome?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
    };
  };
};

// Tipos auxiliares
export type Local = Database['public']['Tables']['locais']['Row'];
export type Registro = Database['public']['Tables']['registros']['Row'];
export type Profile = Database['public']['Tables']['profiles']['Row'];

// Alias para compatibilidade (sessao = registro)
export type Sessao = Registro & {
  inicio: string; // = entrada
  fim: string | null; // = saida
  duracao_minutos: number | null;
  status: 'ativa' | 'pausada' | 'finalizada';
};

// Helper para converter Registro em Sessao
export function registroToSessao(registro: Registro): Sessao {
  const entrada = new Date(registro.entrada);
  const saida = registro.saida ? new Date(registro.saida) : null;
  
  let duracao_minutos: number | null = null;
  if (saida) {
    duracao_minutos = Math.round((saida.getTime() - entrada.getTime()) / 60000);
  }
  
  let status: 'ativa' | 'pausada' | 'finalizada' = 'ativa';
  if (registro.saida) {
    status = 'finalizada';
  }
  
  return {
    ...registro,
    inicio: registro.entrada,
    fim: registro.saida,
    duracao_minutos,
    status,
  };
}
