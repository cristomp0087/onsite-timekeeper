import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { Sessao } from '@/types/database';
import { formatarData, formatarHora, formatarDuracao } from './utils';

interface ExportOptions {
  sessoes: Sessao[];
  formato: 'xlsx' | 'csv';
  incluirResumo?: boolean;
}

export function exportarParaExcel({
  sessoes,
  formato,
  incluirResumo = true,
}: ExportOptions) {
  // Preparar dados
  const dados = sessoes
    .filter((s) => s.status === 'finalizada')
    .map((s) => ({
      Data: formatarData(s.inicio),
      Local: s.local_nome || 'N/A',
      Entrada: formatarHora(s.inicio),
      Saída: s.fim ? formatarHora(s.fim) : 'N/A',
      Duração: formatarDuracao(s.duracao_minutos),
      Minutos: s.duracao_minutos || 0,
    }));

  // Criar workbook
  const wb = XLSX.utils.book_new();

  // Sheet de registros
  const wsRegistros = XLSX.utils.json_to_sheet(dados);

  // Ajustar largura das colunas
  wsRegistros['!cols'] = [
    { wch: 12 }, // Data
    { wch: 25 }, // Local
    { wch: 10 }, // Entrada
    { wch: 10 }, // Saída
    { wch: 12 }, // Duração
    { wch: 10 }, // Minutos
  ];

  XLSX.utils.book_append_sheet(wb, wsRegistros, 'Registros');

  // Sheet de resumo
  if (incluirResumo) {
    const resumoPorLocal = new Map<string, number>();
    sessoes
      .filter((s) => s.status === 'finalizada')
      .forEach((s) => {
        const nome = s.local_nome || 'N/A';
        resumoPorLocal.set(
          nome,
          (resumoPorLocal.get(nome) || 0) + (s.duracao_minutos || 0)
        );
      });

    const dadosResumo = Array.from(resumoPorLocal.entries()).map(
      ([local, minutos]) => ({
        Local: local,
        'Total Horas': formatarDuracao(minutos),
        'Total Minutos': minutos,
      })
    );

    // Adicionar total geral
    const totalMinutos = Array.from(resumoPorLocal.values()).reduce(
      (a, b) => a + b,
      0
    );
    dadosResumo.push({
      Local: 'TOTAL GERAL',
      'Total Horas': formatarDuracao(totalMinutos),
      'Total Minutos': totalMinutos,
    });

    const wsResumo = XLSX.utils.json_to_sheet(dadosResumo);
    wsResumo['!cols'] = [{ wch: 25 }, { wch: 15 }, { wch: 15 }];

    XLSX.utils.book_append_sheet(wb, wsResumo, 'Resumo');
  }

  // Gerar arquivo
  const dataAtual = format(new Date(), 'yyyy-MM-dd');
  const nomeArquivo = `relatorio_horas_${dataAtual}.${formato}`;

  if (formato === 'xlsx') {
    XLSX.writeFile(wb, nomeArquivo);
  } else {
    XLSX.writeFile(wb, nomeArquivo, { bookType: 'csv' });
  }

  return nomeArquivo;
}

export function gerarRelatorioTexto(sessoes: Sessao[]): string {
  const finalizadas = sessoes.filter((s) => s.status === 'finalizada');

  if (finalizadas.length === 0) {
    return 'Nenhum registro encontrado.';
  }

  // Agrupar por local
  const porLocal = new Map<string, Sessao[]>();
  finalizadas.forEach((s) => {
    const nome = s.local_nome || 'N/A';
    if (!porLocal.has(nome)) porLocal.set(nome, []);
    porLocal.get(nome)!.push(s);
  });

  let texto = '═══════════════════════════════\n';
  texto += '       RELATÓRIO DE HORAS      \n';
  texto += '═══════════════════════════════\n\n';

  let totalGeral = 0;

  porLocal.forEach((sessoes, local) => {
    texto += `📍 ${local.toUpperCase()}\n`;

    let subtotal = 0;
    sessoes.forEach((s) => {
      const data = formatarData(s.inicio);
      const entrada = formatarHora(s.inicio);
      const saida = s.fim ? formatarHora(s.fim) : 'N/A';
      const duracao = formatarDuracao(s.duracao_minutos);

      texto += `  ${data}  ${entrada} → ${saida}  [${duracao}]\n`;
      subtotal += s.duracao_minutos || 0;
    });

    texto += `  Subtotal: ${formatarDuracao(subtotal)}\n\n`;
    totalGeral += subtotal;
  });

  texto += '═══════════════════════════════\n';
  texto += `   TOTAL GERAL: ${formatarDuracao(totalGeral)}\n`;
  texto += '═══════════════════════════════\n';

  return texto;
}
