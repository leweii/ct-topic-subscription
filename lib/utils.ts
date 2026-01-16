import type { Frequency } from './types';

export function calculateNextRun(frequency: Frequency): string | null {
  if (frequency === 'once') {
    return null;
  }

  const now = new Date();

  switch (frequency) {
    case 'daily':
      now.setDate(now.getDate() + 1);
      now.setHours(8, 0, 0, 0); // 8:00 AM next day
      break;
    case 'weekly':
      now.setDate(now.getDate() + 7);
      now.setHours(8, 0, 0, 0);
      break;
    case 'monthly':
      now.setMonth(now.getMonth() + 1);
      now.setHours(8, 0, 0, 0);
      break;
  }

  return now.toISOString();
}

export function cn(...classes: (string | boolean | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
