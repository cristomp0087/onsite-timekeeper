-- ============================================
-- MIGRATION 001: TABELAS E RLS
-- OnSite Timekeeper - Supabase
-- ============================================

-- Habilitar extensões necessárias
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- TABELA: locais
-- ============================================

CREATE TABLE IF NOT EXISTS public.locais (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  latitude FLOAT8 NOT NULL,
  longitude FLOAT8 NOT NULL,
  raio INTEGER DEFAULT 100 CHECK (raio >= 10 AND raio <= 1000),
  cor TEXT DEFAULT '#3B82F6',
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ
);

-- Comentários
COMMENT ON TABLE public.locais IS 'Locais de trabalho com geofencing';
COMMENT ON COLUMN public.locais.raio IS 'Raio da geofence em metros (10-1000m)';
COMMENT ON COLUMN public.locais.synced_at IS 'Última sincronização com dispositivo móvel';

-- ============================================
-- TABELA: registros
-- ============================================

CREATE TABLE IF NOT EXISTS public.registros (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  local_id UUID NOT NULL REFERENCES public.locais(id) ON DELETE CASCADE,
  local_nome TEXT,
  entrada TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  saida TIMESTAMPTZ,
  tipo TEXT DEFAULT 'automatico' CHECK (tipo IN ('automatico', 'manual')),
  editado_manualmente BOOLEAN DEFAULT false,
  motivo_edicao TEXT,
  hash_integridade TEXT,
  cor TEXT,
  device_id TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  synced_at TIMESTAMPTZ,
  
  -- Constraints
  CONSTRAINT valid_saida CHECK (saida IS NULL OR saida > entrada)
);

-- Comentários
COMMENT ON TABLE public.registros IS 'Registros de ponto (entrada/saída)';
COMMENT ON COLUMN public.registros.entrada IS 'Timestamp de entrada no local';
COMMENT ON COLUMN public.registros.saida IS 'Timestamp de saída do local (NULL = sessão ativa)';
COMMENT ON COLUMN public.registros.tipo IS 'Tipo de registro: automatico (geofence) ou manual';

-- ============================================
-- ÍNDICES
-- ============================================

-- Locais
CREATE INDEX IF NOT EXISTS idx_locais_user_id ON public.locais(user_id);
CREATE INDEX IF NOT EXISTS idx_locais_ativo ON public.locais(user_id, ativo) WHERE ativo = true;
CREATE INDEX IF NOT EXISTS idx_locais_coords ON public.locais(latitude, longitude);

-- Registros
CREATE INDEX IF NOT EXISTS idx_registros_user_id ON public.registros(user_id);
CREATE INDEX IF NOT EXISTS idx_registros_local_id ON public.registros(local_id);
CREATE INDEX IF NOT EXISTS idx_registros_entrada ON public.registros(user_id, entrada DESC);
CREATE INDEX IF NOT EXISTS idx_registros_ativo ON public.registros(user_id, entrada) WHERE saida IS NULL;
CREATE INDEX IF NOT EXISTS idx_registros_periodo ON public.registros(user_id, entrada, saida);

-- ============================================
-- RLS (ROW LEVEL SECURITY)
-- ============================================

-- Habilitar RLS
ALTER TABLE public.locais ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.registros ENABLE ROW LEVEL SECURITY;

-- ============================================
-- POLICIES: locais
-- ============================================

-- Ver apenas seus próprios locais
CREATE POLICY "Users can view own locais"
  ON public.locais
  FOR SELECT
  USING (auth.uid() = user_id);

-- Inserir apenas para si mesmo
CREATE POLICY "Users can insert own locais"
  ON public.locais
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Atualizar apenas seus próprios
CREATE POLICY "Users can update own locais"
  ON public.locais
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deletar apenas seus próprios
CREATE POLICY "Users can delete own locais"
  ON public.locais
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- POLICIES: registros
-- ============================================

-- Ver apenas seus próprios registros
CREATE POLICY "Users can view own registros"
  ON public.registros
  FOR SELECT
  USING (auth.uid() = user_id);

-- Inserir apenas para si mesmo
CREATE POLICY "Users can insert own registros"
  ON public.registros
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Atualizar apenas seus próprios
CREATE POLICY "Users can update own registros"
  ON public.registros
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Deletar apenas seus próprios
CREATE POLICY "Users can delete own registros"
  ON public.registros
  FOR DELETE
  USING (auth.uid() = user_id);

-- ============================================
-- TRIGGERS: updated_at
-- ============================================

-- Função para atualizar updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para locais
CREATE TRIGGER update_locais_updated_at
  BEFORE UPDATE ON public.locais
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- GRANTS (Permissões)
-- ============================================

-- Permitir acesso autenticado
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.locais TO authenticated;
GRANT ALL ON public.registros TO authenticated;

-- ============================================
-- FIM DA MIGRATION 001
-- ============================================
