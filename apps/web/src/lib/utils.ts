import { format, parseISO } from 'date-fns';
import { ptBR } from 'date-fns/locale';

export function formatarData(dataISO: string): string {
  return format(parseISO(dataISO), 'dd/MM/yyyy', { locale: ptBR });
}

export function formatarDataCompleta(dataISO: string): string {
  return format(parseISO(dataISO), "EEEE, dd 'de' MMMM", { locale: ptBR });
}

export function formatarHora(dataISO: string): string {
  return format(parseISO(dataISO), 'HH:mm', { locale: ptBR });
}

export function formatarDuracao(minutos: number | null): string {
  if (!minutos || minutos <= 0) return '0min';

  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);

  if (horas === 0) return `${mins}min`;
  if (mins === 0) return `${horas}h`;
  return `${horas}h ${mins}min`;
}

export function formatarDuracaoLonga(minutos: number | null): string {
  if (!minutos || minutos <= 0) return '0 minutos';

  const horas = Math.floor(minutos / 60);
  const mins = Math.round(minutos % 60);

  const partesHoras = horas > 0 ? `${horas} hora${horas > 1 ? 's' : ''}` : '';
  const partesMinutos = mins > 0 ? `${mins} minuto${mins > 1 ? 's' : ''}` : '';

  if (partesHoras && partesMinutos) {
    return `${partesHoras} e ${partesMinutos}`;
  }

  return partesHoras || partesMinutos;
}

export function formatarMoeda(valor: number): string {
  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(valor);
}

export function calcularValorHora(minutos: number, valorHora: number): number {
  return (minutos / 60) * valorHora;
}
