import { useRef } from 'react';

export function useDraft<T>(initialValue: T) {
  const snapshot = useRef(JSON.stringify(initialValue));

  return {
    isDirty: (current: T) => JSON.stringify(current) !== snapshot.current,
    commit:  (current: T) => { snapshot.current = JSON.stringify(current); },
  };
}
