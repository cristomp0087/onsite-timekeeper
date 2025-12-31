/**
 * Store de Sessões/Registros - OnSite Flow Web
 *
 * Atualizado para usar tabela 'registros' do Supabase
 *
 * Localização: apps/web/src/stores/sessoesStore.ts
 */

import { create } from 'zustand';
import { supabase } from '@/lib/supabase';
import type { Registro, Local, Sessao } from '@/types/database';
import { registroToSessao } from '@/types/database';
import {
  startOfDay,
  endOfDay,
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  subDays,
} from 'date-fns';

interface Filtros {
  dataInicio: Date | null;
  dataFim: Date | null;
  localId: string | null;
  status: 'all' | 'ativa' | 'pausada' | 'finalizada';
}

interface Estatisticas {
  totalHoras: number;
  totalSessoes: number;
  mediaHorasDia: number;
  localMaisFrequente: string | null;
}

interface SessoesState {
  // Dados brutos do Supabase
  registros: Registro[];

  // Dados convertidos para compatibilidade
  sessoes: Sessao[];

  locais: Local[];
  filtros: Filtros;
  estatisticas: Estatisticas;
  isLoading: boolean;

  // Actions
  fetchSessoes: (userId: string) => Promise<void>;
  fetchLocais: (userId: string) => Promise<void>;
  setFiltros: (filtros: Partial<Filtros>) => void;
  setPresetPeriodo: (preset: 'hoje' | 'semana' | 'mes' | '30dias') => void;
  calcularEstatisticas: () => void;

  // Getters
  getSessoesFiltradas: () => Sessao[];
  getSessoesPorLocal: () => Map<string, Sessao[]>;
  getHorasPorDia: (dias: number) => { data: string; horas: number }[];
}

export const useSessoesStore = create<SessoesState>((set, get) => ({
  registros: [],
  sessoes: [],
  locais: [],
  filtros: {
    dataInicio: startOfMonth(new Date()),
    dataFim: endOfMonth(new Date()),
    localId: null,
    status: 'all',
  },
  estatisticas: {
    totalHoras: 0,
    totalSessoes: 0,
    mediaHorasDia: 0,
    localMaisFrequente: null,
  },
  isLoading: false,

  fetchSessoes: async (userId: string) => {
    set({ isLoading: true });

    const { filtros } = get();

    // Buscar da tabela 'registros'
    let query = supabase
      .from('registros')
      .select('*')
      .eq('user_id', userId)
      .order('entrada', { ascending: false });

    if (filtros.dataInicio) {
      query = query.gte('entrada', filtros.dataInicio.toISOString());
    }
    if (filtros.dataFim) {
      query = query.lte('entrada', filtros.dataFim.toISOString());
    }
    if (filtros.localId) {
      query = query.eq('local_id', filtros.localId);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Erro ao buscar registros:', error);
      set({ isLoading: false });
      return;
    }

    const registros = data || [];

    // Converter para Sessao (compatibilidade)
    let sessoes = registros.map(registroToSessao);

    // Filtrar por status se necessário
    if (filtros.status !== 'all') {
      sessoes = sessoes.filter((s) => s.status === filtros.status);
    }

    set({ registros, sessoes, isLoading: false });
    get().calcularEstatisticas();
  },

  fetchLocais: async (userId: string) => {
    const { data, error } = await supabase
      .from('locais')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('nome');

    if (error) {
      console.error('Erro ao buscar locais:', error);
      return;
    }

    set({ locais: data || [] });
  },

  setFiltros: (novosFiltros: Partial<Filtros>) => {
    set((state) => ({
      filtros: { ...state.filtros, ...novosFiltros },
    }));
  },

  setPresetPeriodo: (preset: 'hoje' | 'semana' | 'mes' | '30dias') => {
    const hoje = new Date();
    let dataInicio: Date;
    let dataFim: Date = endOfDay(hoje);

    switch (preset) {
      case 'hoje':
        dataInicio = startOfDay(hoje);
        break;
      case 'semana':
        dataInicio = startOfWeek(hoje, { weekStartsOn: 1 });
        dataFim = endOfWeek(hoje, { weekStartsOn: 1 });
        break;
      case 'mes':
        dataInicio = startOfMonth(hoje);
        dataFim = endOfMonth(hoje);
        break;
      case '30dias':
        dataInicio = subDays(hoje, 30);
        break;
      default:
        dataInicio = startOfMonth(hoje);
    }

    set((state) => ({
      filtros: { ...state.filtros, dataInicio, dataFim },
    }));
  },

  calcularEstatisticas: () => {
    const sessoes = get().getSessoesFiltradas();
    const finalizadas = sessoes.filter((s) => s.status === 'finalizada');

    const totalMinutos = finalizadas.reduce(
      (acc, s) => acc + (s.duracao_minutos || 0),
      0
    );
    const totalHoras = totalMinutos / 60;

    // Dias únicos
    const diasUnicos = new Set(finalizadas.map((s) => s.inicio.split('T')[0]));
    const mediaHorasDia =
      diasUnicos.size > 0 ? totalHoras / diasUnicos.size : 0;

    // Local mais frequente
    const contagemLocais = new Map<string, number>();
    finalizadas.forEach((s) => {
      const nome = s.local_nome || 'Desconhecido';
      contagemLocais.set(nome, (contagemLocais.get(nome) || 0) + 1);
    });

    let localMaisFrequente: string | null = null;
    let maxContagem = 0;
    contagemLocais.forEach((contagem, nome) => {
      if (contagem > maxContagem) {
        maxContagem = contagem;
        localMaisFrequente = nome;
      }
    });

    set({
      estatisticas: {
        totalHoras,
        totalSessoes: finalizadas.length,
        mediaHorasDia,
        localMaisFrequente,
      },
    });
  },

  getSessoesFiltradas: () => {
    return get().sessoes;
  },

  getSessoesPorLocal: () => {
    const sessoes = get().getSessoesFiltradas();
    const mapa = new Map<string, Sessao[]>();

    sessoes.forEach((s) => {
      const nome = s.local_nome || 'Desconhecido';
      if (!mapa.has(nome)) {
        mapa.set(nome, []);
      }
      mapa.get(nome)!.push(s);
    });

    return mapa;
  },

  getHorasPorDia: (dias: number) => {
    const sessoes = get().sessoes.filter((s) => s.status === 'finalizada');
    const resultado: { data: string; horas: number }[] = [];

    for (let i = dias - 1; i >= 0; i--) {
      const data = subDays(new Date(), i);
      const dataStr = data.toISOString().split('T')[0];

      const horasDia = sessoes
        .filter((s) => s.inicio.startsWith(dataStr))
        .reduce((acc, s) => acc + (s.duracao_minutos || 0) / 60, 0);

      resultado.push({ data: dataStr, horas: horasDia });
    }

    return resultado;
  },
}));
