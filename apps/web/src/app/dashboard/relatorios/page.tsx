'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSessoesStore } from '@/stores/sessoesStore';
import { formatarData, formatarDuracao } from '@/lib/utils';
import { exportarParaExcel, gerarRelatorioTexto } from '@/lib/export';
import {
  FileText,
  Download,
  FileSpreadsheet,
  Calendar,
  Clock,
  MapPin,
  TrendingUp,
  Filter,
  Printer,
  Mail,
  Share2,
} from 'lucide-react';
import { format, startOfMonth, endOfMonth, subMonths } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export default function RelatoriosPage() {
  const { user } = useAuthStore();
  const {
    sessoes,
    locais,
    estatisticas,
    isLoading,
    fetchSessoes,
    fetchLocais,
    setFiltros,
    filtros,
  } = useSessoesStore();

  const [mesSelecionado, setMesSelecionado] = useState(new Date());
  const [localSelecionado, setLocalSelecionado] = useState<string>('');

  // Carregar dados
  useEffect(() => {
    if (user) {
      // Definir período do mês selecionado
      setFiltros({
        dataInicio: startOfMonth(mesSelecionado),
        dataFim: endOfMonth(mesSelecionado),
        localId: localSelecionado || null,
      });
      fetchSessoes(user.id);
      fetchLocais(user.id);
    }
  }, [
    user,
    mesSelecionado,
    localSelecionado,
    fetchSessoes,
    fetchLocais,
    setFiltros,
  ]);

  // Sessões finalizadas do período
  const sessoesFinalizadas = sessoes.filter((s) => s.status === 'finalizada');

  // Agrupar por local
  const sessoesPorLocal = new Map<string, typeof sessoes>();
  sessoesFinalizadas.forEach((s) => {
    const nome = s.local_nome || 'N/A';
    if (!sessoesPorLocal.has(nome)) sessoesPorLocal.set(nome, []);
    sessoesPorLocal.get(nome)!.push(s);
  });

  // Calcular totais por local
  const totaisPorLocal = Array.from(sessoesPorLocal.entries())
    .map(([nome, sessoes]) => ({
      nome,
      sessoes: sessoes.length,
      minutos: sessoes.reduce((acc, s) => acc + (s.duracao_minutos || 0), 0),
    }))
    .sort((a, b) => b.minutos - a.minutos);

  // Total geral
  const totalMinutos = totaisPorLocal.reduce((acc, l) => acc + l.minutos, 0);

  // Handlers de export
  const handleExportExcel = () => {
    exportarParaExcel({ sessoes: sessoesFinalizadas, formato: 'xlsx' });
  };

  const handleExportCSV = () => {
    exportarParaExcel({ sessoes: sessoesFinalizadas, formato: 'csv' });
  };

  const handleExportPDF = () => {
    // TODO: Implementar export PDF
    // Pode usar jsPDF ou html2pdf
    alert(
      'Export PDF será implementado em breve!\n\nPor enquanto, use Ctrl+P para imprimir como PDF.'
    );
  };

  const handlePrint = () => {
    window.print();
  };

  const handleEmail = () => {
    const texto = gerarRelatorioTexto(sessoesFinalizadas);
    const assunto = `Relatório de Horas - ${format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}`;
    const mailtoLink = `mailto:?subject=${encodeURIComponent(assunto)}&body=${encodeURIComponent(texto)}`;
    window.open(mailtoLink);
  };

  const handleShare = async () => {
    const texto = gerarRelatorioTexto(sessoesFinalizadas);

    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Relatório de Horas',
          text: texto,
        });
      } catch (err) {
        console.log('Share cancelled');
      }
    } else {
      // Fallback: copiar para clipboard
      await navigator.clipboard.writeText(texto);
      alert('Relatório copiado para a área de transferência!');
    }
  };

  // Navegação de meses
  const mesAnterior = () => setMesSelecionado((prev) => subMonths(prev, 1));
  const mesProximo = () => {
    const proximo = new Date(mesSelecionado);
    proximo.setMonth(proximo.getMonth() + 1);
    if (proximo <= new Date()) {
      setMesSelecionado(proximo);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Relatórios</h1>
          <p className="text-gray-500 mt-1">
            Gere e exporte relatórios de horas trabalhadas
          </p>
        </div>
      </div>

      {/* Filtros */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap items-center gap-4">
          {/* Seletor de Mês */}
          <div className="flex items-center gap-2">
            <button
              onClick={mesAnterior}
              className="p-2 hover:bg-gray-100 rounded-lg transition"
            >
              ←
            </button>
            <div className="px-4 py-2 bg-gray-100 rounded-lg font-medium min-w-[160px] text-center">
              {format(mesSelecionado, 'MMMM yyyy', { locale: ptBR })}
            </div>
            <button
              onClick={mesProximo}
              disabled={mesSelecionado >= startOfMonth(new Date())}
              className="p-2 hover:bg-gray-100 rounded-lg transition disabled:opacity-50"
            >
              →
            </button>
          </div>

          {/* Filtro por Local */}
          <select
            value={localSelecionado}
            onChange={(e) => setLocalSelecionado(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Todos os locais</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>

          {/* Spacer */}
          <div className="flex-1" />

          {/* Botões de Export */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Imprimir"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={handleEmail}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Enviar por Email"
            >
              <Mail className="w-4 h-4" />
            </button>
            <button
              onClick={handleShare}
              className="flex items-center gap-2 px-3 py-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
              title="Compartilhar"
            >
              <Share2 className="w-4 h-4" />
            </button>
            <div className="w-px h-6 bg-gray-200" />
            <button
              onClick={handleExportCSV}
              className="flex items-center gap-2 px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
            >
              <Download className="w-4 h-4" />
              CSV
            </button>
            <button
              onClick={handleExportExcel}
              className="flex items-center gap-2 px-3 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
            >
              <FileSpreadsheet className="w-4 h-4" />
              Excel
            </button>
            <button
              onClick={handleExportPDF}
              className="flex items-center gap-2 px-3 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg transition"
            >
              <FileText className="w-4 h-4" />
              PDF
            </button>
          </div>
        </div>
      </div>

      {/* Resumo do Período */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center">
              <Clock className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Total de Horas</p>
              <p className="text-xl font-bold text-gray-900">
                {formatarDuracao(totalMinutos)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-lg flex items-center justify-center">
              <Calendar className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Registros</p>
              <p className="text-xl font-bold text-gray-900">
                {sessoesFinalizadas.length}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-yellow-100 rounded-lg flex items-center justify-center">
              <MapPin className="w-5 h-5 text-yellow-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Locais</p>
              <p className="text-xl font-bold text-gray-900">
                {sessoesPorLocal.size}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-lg flex items-center justify-center">
              <TrendingUp className="w-5 h-5 text-purple-600" />
            </div>
            <div>
              <p className="text-sm text-gray-500">Média/Dia</p>
              <p className="text-xl font-bold text-gray-900">
                {formatarDuracao(estatisticas.mediaHorasDia * 60)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Relatório por Local */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-0">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Resumo por Local
          </h2>
        </div>

        {isLoading ? (
          <div className="p-8 text-center text-gray-500">Carregando...</div>
        ) : totaisPorLocal.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            Nenhum registro encontrado neste período
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {totaisPorLocal.map((local) => (
              <div key={local.nome} className="p-4 hover:bg-gray-50">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <MapPin className="w-5 h-5 text-gray-400" />
                    <div>
                      <h3 className="font-medium text-gray-900">
                        {local.nome}
                      </h3>
                      <p className="text-sm text-gray-500">
                        {local.sessoes} registro(s)
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-bold text-gray-900">
                      {formatarDuracao(local.minutos)}
                    </p>
                    <p className="text-sm text-gray-500">
                      {((local.minutos / totalMinutos) * 100).toFixed(0)}% do
                      total
                    </p>
                  </div>
                </div>
                {/* Barra de progresso */}
                <div className="mt-2 h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-primary-500 rounded-full"
                    style={{
                      width: `${(local.minutos / totalMinutos) * 100}%`,
                    }}
                  />
                </div>
              </div>
            ))}

            {/* Total */}
            <div className="p-4 bg-gray-50">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-gray-900">TOTAL GERAL</span>
                <span className="font-bold text-xl text-primary-600">
                  {formatarDuracao(totalMinutos)}
                </span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Lista Detalhada (para impressão) */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-semibold text-gray-900">
            Registros Detalhados
          </h2>
        </div>

        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                Data
              </th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                Local
              </th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                Entrada
              </th>
              <th className="text-left px-6 py-3 text-sm font-semibold text-gray-600">
                Saída
              </th>
              <th className="text-right px-6 py-3 text-sm font-semibold text-gray-600">
                Duração
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {sessoesFinalizadas.slice(0, 20).map((sessao) => (
              <tr key={sessao.id} className="hover:bg-gray-50">
                <td className="px-6 py-3 text-gray-900">
                  {formatarData(sessao.inicio)}
                </td>
                <td className="px-6 py-3 text-gray-900">
                  {sessao.local_nome || 'N/A'}
                </td>
                <td className="px-6 py-3 text-gray-600">
                  {format(new Date(sessao.inicio), 'HH:mm')}
                </td>
                <td className="px-6 py-3 text-gray-600">
                  {sessao.fim ? format(new Date(sessao.fim), 'HH:mm') : '-'}
                </td>
                <td className="px-6 py-3 text-right font-medium text-gray-900">
                  {formatarDuracao(sessao.duracao_minutos)}
                </td>
              </tr>
            ))}
          </tbody>
          {sessoesFinalizadas.length > 20 && (
            <tfoot>
              <tr>
                <td
                  colSpan={5}
                  className="px-6 py-3 text-center text-gray-500 text-sm"
                >
                  Mostrando 20 de {sessoesFinalizadas.length} registros. Exporte
                  para ver todos.
                </td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
}
