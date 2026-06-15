import { usePremium } from '../lib/premiumContext';

export function useGatedAction(onDenied: () => void) {
  const { hasAccess } = usePremium();
  return function gate<T extends unknown[]>(action: (...args: T) => void) {
    return (...args: T) => {
      if (!hasAccess) { onDenied(); return; }
      action(...args);
    };
  };
}
