import { create } from 'zustand';
import { Share } from 'react-native';
import { logger } from '../lib/logger';
import {
  initDatabase,
  saveRegistro,
  iniciarSessao,
  finalizarSessao,
  finalizarSessaoComAjuste,
  pausarSessao,
  retomarSessao,
  getSessaoAberta,
  getSessaoAtivaGlobal,
  getSessoesHoje,
  getEstatisticasHoje,
  formatDuration,
  type SessaoDB,
  type EstatisticasDia,
} from '../lib/database';
import { generateSingleSessionReport } from '../lib/reports';

let dbInitialized = false;
let dbInitializing = false;

async function ensureDbInitialized(): Promise<boolean> {
  if (dbInitialized) return true;

  if (dbInitializing) {
    let attempts = 0;
    while (dbInitializing && attempts < 50) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }
    return dbInitialized;
  }

  dbInitializing = true;
  try {
    await initDatabase();
    dbInitialized = true;
    logger.info('database', 'Database initialized via ensureDbInitialized');
    return true;
  } catch (error) {
    logger.error('database', 'Failed to initialize database', {
      error: String(error),
    });
    return false;
  } finally {
    dbInitializing = false;
  }
}

interface RegistroState {
  isInitialized: boolean;
  sessaoAtual: SessaoDB | null;
  sessoesHoje: SessaoDB[];
  estatisticasHoje: EstatisticasDia | null;
  lastFinalizedSession: SessaoDB | null; // Última sessão finalizada (para mostrar relatório)

  initialize: () => Promise<void>;
  registrarEntrada: (
    local_id: string,
    coords?: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<void>;
  registrarSaida: (
    local_id: string,
    coords?: { latitude: number; longitude: number; accuracy?: number }
  ) => Promise<SessaoDB | null>;
  registrarSaidaComAjuste: (
    local_id: string,
    coords?: { latitude: number; longitude: number; accuracy?: number },
    adjustMinutes?: number
  ) => Promise<SessaoDB | null>;
  pausar: () => Promise<void>;
  retomar: () => Promise<void>;
  refreshData: () => Promise<void>;
  getSessaoAtiva: (local_id: string) => Promise<SessaoDB | null>;
  shareLastSession: (userEmail?: string) => Promise<void>;
  clearLastSession: () => void;
}

export const useRegistroStore = create<RegistroState>((set, get) => ({
  isInitialized: false,
  sessaoAtual: null,
  sessoesHoje: [],
  estatisticasHoje: null,
  lastFinalizedSession: null,

  initialize: async () => {
    try {
      logger.info('database', 'Initializing registro store...');

      const success = await ensureDbInitialized();
      if (!success) {
        logger.error('database', 'Could not initialize database');
        return;
      }

      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      const sessaoAtual = await getSessaoAtivaGlobal();

      set({
        isInitialized: true,
        sessoesHoje,
        estatisticasHoje,
        sessaoAtual,
      });

      logger.info('database', 'Registro store initialized', {
        sessoesHoje: sessoesHoje.length,
        minutosHoje: estatisticasHoje.total_minutos,
        sessaoAtiva: sessaoAtual?.status || 'none',
      });
    } catch (error) {
      logger.error('database', 'Failed to initialize registro store', {
        error: String(error),
      });
    }
  },

  registrarEntrada: async (local_id, coords) => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) {
        logger.error('database', 'Cannot register entrada - DB not ready');
        return;
      }

      logger.info('database', '📥 Registrando ENTRADA', { local_id });

      const registro_id = await saveRegistro({
        local_id,
        tipo: 'entrada',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });

      await iniciarSessao(local_id, registro_id);
      await get().refreshData();

      logger.info('database', '✅ Entrada registrada com sucesso');
    } catch (error) {
      logger.error('database', 'Erro ao registrar entrada', {
        error: String(error),
      });
    }
  },

  registrarSaida: async (local_id, coords) => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) {
        logger.error('database', 'Cannot register saida - DB not ready');
        return null;
      }

      // Guardar sessão atual antes de finalizar
      const sessaoAntes = get().sessaoAtual;

      logger.info('database', '📤 Registrando SAÍDA', { local_id });

      const registro_id = await saveRegistro({
        local_id,
        tipo: 'saida',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: true,
      });

      await finalizarSessao(local_id, registro_id);
      await get().refreshData();

      // Buscar a sessão que acabou de ser finalizada
      const sessoesHoje = get().sessoesHoje;
      const sessaoFinalizada =
        sessoesHoje.find(
          (s) =>
            s.local_id === local_id &&
            s.status === 'finalizada' &&
            s.saida_id === registro_id
        ) ||
        sessoesHoje.find(
          (s) => s.local_id === local_id && s.status === 'finalizada'
        );

      if (sessaoFinalizada) {
        set({ lastFinalizedSession: sessaoFinalizada });
        logger.info('database', '✅ Saída registrada com sucesso', {
          duracao: sessaoFinalizada.duracao_minutos,
        });
        return sessaoFinalizada;
      }

      logger.info('database', '✅ Saída registrada com sucesso');
      return null;
    } catch (error) {
      logger.error('database', 'Erro ao registrar saída', {
        error: String(error),
      });
      return null;
    }
  },

  registrarSaidaComAjuste: async (local_id, coords, adjustMinutes = 0) => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) {
        logger.error('database', 'Cannot register saida - DB not ready');
        return null;
      }

      logger.info('database', '📤 Registrando SAÍDA com ajuste', {
        local_id,
        adjustMinutes,
      });

      // Calcular o horário ajustado
      // Se adjustMinutes = -10, significa "parei há 10 minutos"
      const agora = new Date();
      const horaAjustada = new Date(
        agora.getTime() + adjustMinutes * 60 * 1000
      );

      const registro_id = await saveRegistro({
        local_id,
        tipo: 'saida',
        latitude: coords?.latitude,
        longitude: coords?.longitude,
        accuracy: coords?.accuracy,
        automatico: false, // Manual porque usuário escolheu ajuste
        // Nota: Se o banco suportar, podemos passar horaAjustada
      });

      // Finalizar sessão com ajuste de tempo
      await finalizarSessaoComAjuste(local_id, registro_id, adjustMinutes);
      await get().refreshData();

      // Buscar a sessão finalizada
      const sessoesHoje = get().sessoesHoje;
      const sessaoFinalizada = sessoesHoje.find(
        (s) => s.local_id === local_id && s.status === 'finalizada'
      );

      if (sessaoFinalizada) {
        set({ lastFinalizedSession: sessaoFinalizada });
        logger.info('database', '✅ Saída registrada com ajuste', {
          duracao: sessaoFinalizada.duracao_minutos,
          ajuste: adjustMinutes,
        });
        return sessaoFinalizada;
      }

      return null;
    } catch (error) {
      logger.error('database', 'Erro ao registrar saída com ajuste', {
        error: String(error),
      });
      return null;
    }
  },

  pausar: async () => {
    try {
      const { sessaoAtual } = get();
      if (!sessaoAtual || sessaoAtual.status !== 'ativa') {
        logger.warn('database', 'No active session to pause');
        return;
      }

      logger.info('database', '⏸️ Pausando sessão', {
        sessaoId: sessaoAtual.id,
      });

      await saveRegistro({
        local_id: sessaoAtual.local_id,
        tipo: 'pause',
        automatico: false,
      });

      await pausarSessao(sessaoAtual.id);
      await get().refreshData();

      logger.info('database', '✅ Sessão pausada');
    } catch (error) {
      logger.error('database', 'Erro ao pausar', { error: String(error) });
    }
  },

  retomar: async () => {
    try {
      const { sessaoAtual } = get();
      if (!sessaoAtual || sessaoAtual.status !== 'pausada') {
        logger.warn('database', 'No paused session to resume');
        return;
      }

      logger.info('database', '▶️ Retomando sessão', {
        sessaoId: sessaoAtual.id,
      });

      await saveRegistro({
        local_id: sessaoAtual.local_id,
        tipo: 'resume',
        automatico: false,
      });

      await retomarSessao(sessaoAtual.id);
      await get().refreshData();

      logger.info('database', '✅ Sessão retomada');
    } catch (error) {
      logger.error('database', 'Erro ao retomar', { error: String(error) });
    }
  },

  refreshData: async () => {
    try {
      const dbReady = await ensureDbInitialized();
      if (!dbReady) return;

      const sessoesHoje = await getSessoesHoje();
      const estatisticasHoje = await getEstatisticasHoje();
      const sessaoAtual = await getSessaoAtivaGlobal();

      set({ sessoesHoje, estatisticasHoje, sessaoAtual });

      logger.debug('database', 'Data refreshed', {
        sessoes: sessoesHoje.length,
        minutos: estatisticasHoje.total_minutos,
        status: sessaoAtual?.status || 'none',
      });
    } catch (error) {
      logger.error('database', 'Erro ao atualizar dados', {
        error: String(error),
      });
    }
  },

  getSessaoAtiva: async (local_id) => {
    const dbReady = await ensureDbInitialized();
    if (!dbReady) return null;
    return await getSessaoAberta(local_id);
  },

  shareLastSession: async (userEmail?: string) => {
    const { lastFinalizedSession } = get();
    if (!lastFinalizedSession) {
      logger.warn('database', 'No last session to share');
      return;
    }

    try {
      const report = generateSingleSessionReport(
        lastFinalizedSession,
        userEmail
      );
      await Share.share({
        message: report,
        title: 'Registro de Trabalho',
      });
    } catch (error) {
      logger.error('database', 'Error sharing last session', { error });
    }
  },

  clearLastSession: () => {
    set({ lastFinalizedSession: null });
  },
}));

export function useFormatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '0h 00min';
  return formatDuration(minutes);
}
