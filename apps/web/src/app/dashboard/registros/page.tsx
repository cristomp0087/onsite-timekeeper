'use client';

import { useEffect, useState } from 'react';
import { useAuthStore } from '@/stores/authStore';
import { useSessoesStore } from '@/stores/sessoesStore';
import { formatarData, formatarHora, formatarDuracao } from '@/lib/utils';
import { exportarParaExcel } from '@/lib/export';
import {
  Download,
  Filter,
  Search,
  ChevronLeft,
  ChevronRight,
  FileSpreadsheet,
} from 'lucide-react';

const ITEMS_PER_PAGE = 15;

export default function RegistrosPage() {
  const { user } = useAuthStore();
  const {
    sessoes,
    locais,
    filtros,
    isLoading,
    fetchSessoes,
    fetchLocais,
    setFiltros,
    setPresetPeriodo,
  } = useSessoesStore();

  const [pagina, setPagina] = useState(1);
  const [busca, setBusca] = useState('');

  useEffect(() => {
    if (user) {
      setPresetPeriodo('mes');
      fetchSessoes(user.id);
      fetchLocais(user.id);
    }
  }, [user, fetchSessoes, fetchLocais, setPresetPeriodo]);

  // Filtrar por busca
  const sessoesFiltradas = sessoes.filter((s) => {
    if (!busca) return true;
    const termo = busca.toLowerCase();
    return (
      s.local_nome?.toLowerCase().includes(termo) ||
      formatarData(s.inicio).includes(termo)
    );
  });

  // Paginação
  const totalPaginas = Math.ceil(sessoesFiltradas.length / ITEMS_PER_PAGE);
  const sessoesExibidas = sessoesFiltradas.slice(
    (pagina - 1) * ITEMS_PER_PAGE,
    pagina * ITEMS_PER_PAGE
  );

  const handleExport = (formato: 'xlsx' | 'csv') => {
    exportarParaExcel({ sessoes: sessoesFiltradas, formato });
  };

  const handleFiltroLocal = (localId: string) => {
    setFiltros({ localId: localId || null });
    if (user) fetchSessoes(user.id);
  };

  const handleFiltroPeriodo = (
    preset: 'hoje' | 'semana' | 'mes' | '30dias'
  ) => {
    setPresetPeriodo(preset);
    if (user) fetchSessoes(user.id);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Registros</h1>
          <p className="text-gray-500 mt-1">
            {sessoesFiltradas.length} registro
            {sessoesFiltradas.length !== 1 ? 's' : ''} encontrado
            {sessoesFiltradas.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Export Buttons */}
        <div className="flex gap-2">
          <button
            onClick={() => handleExport('xlsx')}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white rounded-lg transition"
          >
            <FileSpreadsheet className="w-4 h-4" />
            Excel
          </button>
          <button
            onClick={() => handleExport('csv')}
            className="flex items-center gap-2 px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg transition"
          >
            <Download className="w-4 h-4" />
            CSV
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
        <div className="flex flex-wrap gap-4">
          {/* Search */}
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
            <input
              type="text"
              placeholder="Buscar por local ou data..."
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
            />
          </div>

          {/* Período */}
          <div className="flex gap-2">
            {['hoje', 'semana', 'mes', '30dias'].map((preset) => (
              <button
                key={preset}
                onClick={() => handleFiltroPeriodo(preset as any)}
                className="px-3 py-2 text-sm border border-gray-300 rounded-lg hover:bg-gray-50 transition"
              >
                {preset === 'hoje' && 'Hoje'}
                {preset === 'semana' && 'Semana'}
                {preset === 'mes' && 'Mês'}
                {preset === '30dias' && '30 dias'}
              </button>
            ))}
          </div>

          {/* Local */}
          <select
            value={filtros.localId || ''}
            onChange={(e) => handleFiltroLocal(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent outline-none"
          >
            <option value="">Todos os locais</option>
            {locais.map((local) => (
              <option key={local.id} value={local.id}>
                {local.nome}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Data
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Local
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Entrada
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Saída
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Duração
              </th>
              <th className="text-left px-6 py-4 text-sm font-semibold text-gray-600">
                Status
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {isLoading ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Carregando...
                </td>
              </tr>
            ) : sessoesExibidas.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                  Nenhum registro encontrado
                </td>
              </tr>
            ) : (
              sessoesExibidas.map((sessao) => (
                <tr key={sessao.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 text-gray-900">
                    {formatarData(sessao.inicio)}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {sessao.local_nome || 'N/A'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {formatarHora(sessao.inicio)}
                  </td>
                  <td className="px-6 py-4 text-gray-600">
                    {sessao.fim ? formatarHora(sessao.fim) : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-900 font-medium">
                    {formatarDuracao(sessao.duracao_minutos)}
                  </td>
                  <td className="px-6 py-4">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        sessao.status === 'finalizada'
                          ? 'bg-green-100 text-green-700'
                          : sessao.status === 'ativa'
                            ? 'bg-blue-100 text-blue-700'
                            : 'bg-yellow-100 text-yellow-700'
                      }`}
                    >
                      {sessao.status === 'finalizada' && 'Finalizada'}
                      {sessao.status === 'ativa' && 'Ativa'}
                      {sessao.status === 'pausada' && 'Pausada'}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>

        {/* Pagination */}
        {totalPaginas > 1 && (
          <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200">
            <p className="text-sm text-gray-500">
              Mostrando {(pagina - 1) * ITEMS_PER_PAGE + 1} a{' '}
              {Math.min(pagina * ITEMS_PER_PAGE, sessoesFiltradas.length)} de{' '}
              {sessoesFiltradas.length}
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => setPagina((p) => Math.max(1, p - 1))}
                disabled={pagina === 1}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={() => setPagina((p) => Math.min(totalPaginas, p + 1))}
                disabled={pagina === totalPaginas}
                className="p-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
