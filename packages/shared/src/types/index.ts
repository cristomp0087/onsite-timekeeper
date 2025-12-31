/**
 * Types compartilhados
 * Serão populados nos próximos checkpoints
 */

export interface Local {
  id: string;
  user_id: string;
  nome: string;
  latitude: number;
  longitude: number;
  raio: number;
  cor: string;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

export interface Registro {
  id: string;
  user_id: string;
  local_id: string;
  local_nome: string;
  entrada: string;
  saida: string | null;
  tipo: 'automatico' | 'manual';
  editado_manualmente: boolean;
  motivo_edicao: string | null;
  hash_integridade: string;
  cor: string;
  device_id: string | null;
  created_at: string;
  synced_at: string | null;
}

export type Database = {
  public: {
    Tables: {
      locais: {
        Row: Local;
        Insert: Omit<Local, 'id' | 'created_at' | 'updated_at'>;
        Update: Partial<Omit<Local, 'id' | 'created_at'>>;
      };
      registros: {
        Row: Registro;
        Insert: Omit<Registro, 'id' | 'created_at'>;
        Update: Partial<Omit<Registro, 'id' | 'created_at'>>;
      };
    };
  };
};
