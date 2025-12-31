'use client';

import { useEffect } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSessoesStore } from '@/stores/sessoesStore';
import { StatCard } from '@/components/StatCard';
import { HoursChart } from '@/components/HoursChart';
import { Clock, MapPin, Calendar, TrendingUp } from 'lucide-react';
import { formatarDuracao } from '@/lib/utils';

export default function DashboardPage() {
  const { user } = useAuthStore();
  const {
    estatisticas,
    isLoading,
    fetchSessoes,
    fetchLocais,
    getHorasPorDia,
    setPresetPeriodo,
  } = useSessoesStore();

  useEffect(() => {
    if (user) {
      setPresetPeriodo('mes');
      fetchSessoes(user.id);
      fetchLocais(user.id);
    }
  }, [user, fetchSessoes, fetchLocais, setPresetPeriodo]);

  const horasPorDia = getHorasPorDia(14); // Últimos 14 dias

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 mt-1">
          Visão geral das suas horas de trabalho
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard
          title="Total de Horas"
          value={formatarDuracao(estatisticas.totalHoras * 60)}
          subtitle="Este mês"
          icon={Clock}
          color="primary"
        />
        <StatCard
          title="Sessões"
          value={estatisticas.totalSessoes.toString()}
          subtitle="Registros finalizados"
          icon={Calendar}
          color="success"
        />
        <StatCard
          title="Média Diária"
          value={formatarDuracao(estatisticas.mediaHorasDia * 60)}
          subtitle="Por dia trabalhado"
          icon={TrendingUp}
          color="warning"
        />
        <StatCard
          title="Local Frequente"
          value={estatisticas.localMaisFrequente || 'N/A'}
          subtitle="Mais visitado"
          icon={MapPin}
          color="danger"
        />
      </div>

      {/* Chart */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <HoursChart data={horasPorDia} title="Horas nos Últimos 14 Dias" />

        {/* Recent Activity */}
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            Atividade Recente
          </h3>
          <div className="space-y-4">
            {isLoading ? (
              <p className="text-gray-500 text-center py-8">Carregando...</p>
            ) : (
              horasPorDia
                .slice(-5)
                .reverse()
                .map((dia, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between py-2 border-b border-gray-100 last:border-0"
                  >
                    <span className="text-gray-600">{dia.data}</span>
                    <span className="font-medium text-gray-900">
                      {dia.horas > 0 ? `${dia.horas.toFixed(1)}h` : '-'}
                    </span>
                  </div>
                ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
