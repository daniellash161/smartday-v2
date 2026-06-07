import { Priority } from '../types';

export const priorityLabel: Record<Priority, string> = {
  high: 'גבוהה',
  medium: 'בינונית',
  low: 'נמוכה',
};

export const priorityColor: Record<Priority, string> = {
  high: '#C0645A',
  medium: '#C49A3C',
  low: '#6A9E7A',
};

export const priorityOrder: Record<Priority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export function sortByPriority<T extends { priority: Priority }>(items: T[]): T[] {
  return [...items].sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('he-IL', { weekday: 'short', day: 'numeric', month: 'numeric' });
}

export function isToday(dateStr: string): boolean {
  const today = new Date().toISOString().split('T')[0];
  return dateStr === today;
}

export function isTomorrow(dateStr: string): boolean {
  const tomorrow = new Date();
  tomorrow.setDate(tomorrow.getDate() + 1);
  return dateStr === tomorrow.toISOString().split('T')[0];
}
