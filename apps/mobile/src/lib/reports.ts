import { SessaoDB } from './database';

/**
 * Agrupa sessões por local
 */
export function groupSessionsByLocal(sessoes: SessaoDB[]): Array<{
  localNome: string;
  sessoes: Array<{
    data: string;
    entrada: string;
    saida: string;
    duracao: number;
  }>;
  subtotal: number;
}> {
  const grouped: Record<
    string,
    {
      localNome: string;
      sessoes: Array<{
        data: string;
        entrada: string;
        saida: string;
        duracao: number;
      }>;
      subtotal: number;
    }
  > = {};

  for (const sessao of sessoes) {
    const localNome = sessao.local_nome || 'Local não identificado';

    if (!grouped[localNome]) {
      grouped[localNome] = {
        localNome,
        sessoes: [],
        subtotal: 0,
      };
    }

    // ✅ CORRIGIDO: usar entrada/saida ao invés de inicio/fim
    const data = sessao.entrada.split('T')[0];
    const entrada = new Date(sessao.entrada).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const saida = sessao.saida
      ? new Date(sessao.saida).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Em andamento';
    const duracao = sessao.duracao_minutos || 0;

    grouped[localNome].sessoes.push({ data, entrada, saida, duracao });
    grouped[localNome].subtotal += duracao;
  }

  // Ordenar sessões dentro de cada local por data
  for (const local of Object.values(grouped)) {
    local.sessoes.sort((a, b) => a.data.localeCompare(b.data));
  }

  // Retornar ordenado por subtotal (maior primeiro)
  return Object.values(grouped).sort((a, b) => b.subtotal - a.subtotal);
}

/**
 * Formata duração em minutos para string legível
 */
export function formatDurationText(minutes: number): string {
  if (!minutes || isNaN(minutes)) return '0min';
  
  const totalMinutes = Math.floor(Math.max(0, minutes));
  const hours = Math.floor(totalMinutes / 60);
  const mins = totalMinutes % 60;

  if (hours === 0) {
    return `${mins}min`;
  }

  return `${hours}h ${mins.toString().padStart(2, '0')}min`;
}

/**
 * Formata data para exibição
 */
export function formatDateBR(dateStr: string): string {
  try {
    const [year, month, day] = dateStr.split('-');
    return `${day}/${month}/${year}`;
  } catch {
    return dateStr;
  }
}

/**
 * Formata período para exibição
 */
export function formatPeriod(dataInicio: string, dataFim: string): string {
  if (dataInicio === dataFim) {
    return formatDateBR(dataInicio);
  }
  return `${formatDateBR(dataInicio)} a ${formatDateBR(dataFim)}`;
}

/**
 * Gera relatório em texto puro para compartilhar
 */
export function generateTextReport(
  sessoes: SessaoDB[],
  userEmail?: string,
  userName?: string
): string {
  if (!sessoes || sessoes.length === 0) {
    return 'Nenhuma sessão encontrada no período selecionado.';
  }

  try {
    const grouped = groupSessionsByLocal(sessoes);
    const totalGeral = grouped.reduce((acc, g) => acc + g.subtotal, 0);
    const totalSessoes = sessoes.length;

    // Determinar período
    const datas = sessoes.map((s) => s.entrada.split('T')[0]).sort();
    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    let report = '';

    // Cabeçalho
    report += '═══════════════════════════════\n';
    report += '       RELATÓRIO DE HORAS      \n';
    report += '═══════════════════════════════\n\n';

    // Info do período
    report += `📅 Período: ${formatPeriod(dataInicio, dataFim)}\n`;
    if (userName) {
      report += `👤 Trabalhador: ${userName}\n`;
    } else if (userEmail) {
      report += `👤 Usuário: ${userEmail}\n`;
    }
    report += `📊 Total de registros: ${totalSessoes}\n`;
    report += '\n';

    // Sessões por local
    for (const local of grouped) {
      report += `───────────────────────────────\n`;
      report += `📍 ${local.localNome.toUpperCase()}\n`;
      report += `───────────────────────────────\n`;

      for (const sessao of local.sessoes) {
        const duracaoStr =
          sessao.duracao > 0
            ? formatDurationText(sessao.duracao)
            : '(em andamento)';
        report += `  ${formatDateBR(sessao.data)}  ${sessao.entrada} → ${sessao.saida}  [${duracaoStr}]\n`;
      }

      report += `  ─────────────────────────────\n`;
      report += `  Subtotal: ${formatDurationText(local.subtotal)}\n\n`;
    }

    // Total geral
    report += '═══════════════════════════════\n';
    report += `   TOTAL GERAL: ${formatDurationText(totalGeral)}\n`;
    report += '═══════════════════════════════\n\n';

    // Rodapé
    report += `Gerado por OnSite Flow\n`;
    report += `${new Date().toLocaleString('pt-BR')}\n`;

    return report;
  } catch (error) {
    return `Erro ao gerar relatório: ${String(error)}`;
  }
}

/**
 * Gera relatório resumido (para preview)
 */
export function generateSummaryReport(
  sessoes: SessaoDB[],
  userEmail?: string
): string {
  if (!sessoes || sessoes.length === 0) {
    return 'Nenhuma sessão selecionada.';
  }

  try {
    const grouped = groupSessionsByLocal(sessoes);
    const totalGeral = grouped.reduce((acc, g) => acc + g.subtotal, 0);

    // Determinar período
    const datas = sessoes.map((s) => s.entrada.split('T')[0]).sort();
    const dataInicio = datas[0];
    const dataFim = datas[datas.length - 1];

    let summary = `📅 ${formatPeriod(dataInicio, dataFim)}\n\n`;

    for (const local of grouped) {
      summary += `📍 ${local.localNome}: ${formatDurationText(local.subtotal)}\n`;
    }

    summary += `\n💰 Total: ${formatDurationText(totalGeral)}`;

    return summary;
  } catch (error) {
    return `Erro ao gerar resumo: ${String(error)}`;
  }
}

/**
 * Gera relatório de uma única sessão
 */
export function generateSingleSessionReport(
  sessao: SessaoDB,
  userEmail?: string
): string {
  try {
    // ✅ CORRIGIDO: usar entrada/saida
    const data = sessao.entrada.split('T')[0];
    const entrada = new Date(sessao.entrada).toLocaleTimeString('pt-BR', {
      hour: '2-digit',
      minute: '2-digit',
    });
    const saida = sessao.saida
      ? new Date(sessao.saida).toLocaleTimeString('pt-BR', {
          hour: '2-digit',
          minute: '2-digit',
        })
      : 'Em andamento';
    const duracao = sessao.duracao_minutos || 0;

    let report = '';
    report += '───────────────────────────────\n';
    report += '     REGISTRO DE TRABALHO      \n';
    report += '───────────────────────────────\n\n';
    report += `📅 Data: ${formatDateBR(data)}\n`;
    report += `📍 Local: ${sessao.local_nome || 'Não identificado'}\n`;
    report += `🕐 Entrada: ${entrada}\n`;
    report += `🕐 Saída: ${saida}\n`;
    report += `⏱️ Duração: ${formatDurationText(duracao)}\n`;
    if (userEmail) {
      report += `👤 Usuário: ${userEmail}\n`;
    }
    report += '\n───────────────────────────────\n';
    report += `OnSite Flow • ${new Date().toLocaleString('pt-BR')}\n`;

    return report;
  } catch (error) {
    return `Erro ao gerar relatório: ${String(error)}`;
  }
}
