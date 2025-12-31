/**
 * Utilitários para manipulação de datas
 */

/**
 * Formata uma data para exibição (DD/MM/YYYY)
 */
export function formatDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

/**
 * Formata uma data com horário (DD/MM/YYYY HH:MM)
 */
export function formatDateTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata apenas o horário (HH:MM)
 */
export function formatTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('pt-BR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Formata duração em horas e minutos
 */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);

  if (hours === 0) {
    return `${mins}min`;
  }

  if (mins === 0) {
    return `${hours}h`;
  }

  return `${hours}h ${mins}min`;
}

/**
 * Calcula duração entre duas datas em minutos
 */
export function calculateDuration(
  start: Date | string,
  end: Date | string
): number {
  const startDate = typeof start === 'string' ? new Date(start) : start;
  const endDate = typeof end === 'string' ? new Date(end) : end;

  const diffMs = endDate.getTime() - startDate.getTime();
  return Math.round(diffMs / 60000); // Converter para minutos
}

/**
 * Verifica se uma data é hoje
 */
export function isToday(date: Date | string): boolean {
  const d = typeof date === 'string' ? new Date(date) : date;
  const today = new Date();

  return (
    d.getDate() === today.getDate() &&
    d.getMonth() === today.getMonth() &&
    d.getFullYear() === today.getFullYear()
  );
}

/**
 * Verifica se o horário atual está dentro do intervalo de trabalho
 */
export function isWithinWorkHours(
  startTime: string = '05:00',
  endTime: string = '22:00'
): boolean {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();

  const [startHour, startMin] = startTime.split(':').map(Number);
  const [endHour, endMin] = endTime.split(':').map(Number);

  const startMinutes = (startHour ?? 0) * 60 + (startMin ?? 0);
  const endMinutes = (endHour ?? 0) * 60 + (endMin ?? 0);

  return currentMinutes >= startMinutes && currentMinutes <= endMinutes;
}

/**
 * Retorna o nome do dia da semana
 */
export function getDayName(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('pt-BR', { weekday: 'long' });
}

/**
 * Retorna o início do dia (00:00:00)
 */
export function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Retorna o fim do dia (23:59:59)
 */
export function endOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(23, 59, 59, 999);
  return d;
}

/**
 * Adiciona dias a uma data
 */
export function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

/**
 * Retorna ISO string sem timezone (para consistência)
 */
export function toISOStringLocal(date: Date): string {
  return date.toISOString();
}
