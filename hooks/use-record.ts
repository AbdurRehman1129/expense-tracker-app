import { useEffect, useState } from 'react';

export type RecordState<T> =
  | { status: 'loading' }
  | { status: 'missing' }
  | { status: 'ready'; record: T };

/** Loads one record by id for an edit screen. */
export function useRecord<T>(id: number, loader: (id: number) => Promise<T | null>): RecordState<T> {
  const [state, setState] = useState<RecordState<T>>({ status: 'loading' });

  useEffect(() => {
    let alive = true;
    if (!Number.isFinite(id)) {
      setState({ status: 'missing' });
      return;
    }
    loader(id)
      .then((record) => {
        if (alive) setState(record ? { status: 'ready', record } : { status: 'missing' });
      })
      .catch(() => {
        if (alive) setState({ status: 'missing' });
      });
    return () => {
      alive = false;
    };
  }, [id, loader]);

  return state;
}
