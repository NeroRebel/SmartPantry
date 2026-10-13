import { isValidISODate } from './product-status';

export function getReminderDate(expirationDate: string, daysBefore: number, now = new Date()): Date | null {
  if (!isValidISODate(expirationDate) || !Number.isInteger(daysBefore) || daysBefore < 0 || daysBefore > 3) return null;
  const [year, month, day] = expirationDate.split('-').map(Number);
  const reminder = new Date(year, month - 1, day, 9, 0, 0, 0);
  reminder.setDate(reminder.getDate() - daysBefore);
  return reminder.getTime() > now.getTime() ? reminder : null;
}

export function getReminderBody(name: string, daysBefore: number): string {
  if (daysBefore === 0) return `${name} expires today.`;
  if (daysBefore === 1) return `${name} expires tomorrow.`;
  return `${name} expires in ${daysBefore} days.`;
}
