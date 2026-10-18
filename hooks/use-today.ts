import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { todayString } from '@/utils/date';

/**
 * Returns today's LOCAL date ('YYYY-MM-DD') and keeps it correct:
 *  - refreshes when the app returns to the foreground
 *  - refreshes at the next local midnight while the app stays open
 * So a form left open past 12 am never keeps yesterday's date.
 */
export function useToday(): string {
  const [today, setToday] = useState(todayString());

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined;

    const schedule = () => {
      const now = new Date();
      const nextMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 1);
      timer = setTimeout(() => {
        setToday(todayString());
        schedule();
      }, nextMidnight.getTime() - now.getTime());
    };

    schedule();

    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        setToday(todayString());
        if (timer) clearTimeout(timer);
        schedule();
      }
    });

    return () => {
      if (timer) clearTimeout(timer);
      sub.remove();
    };
  }, []);

  return today;
}

/**
 * Date state for a form. Until the user picks a date it follows "today"
 * (including across midnight); once picked, it stays on their choice.
 * Call reset() after saving to go back to following today.
 */
export function useDateField() {
  const today = useToday();
  const [picked, setPicked] = useState<string | null>(null);
  return {
    date: picked ?? today,
    setDate: (value: string) => setPicked(value),
    reset: () => setPicked(null),
  };
}
