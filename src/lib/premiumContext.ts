import { createContext, useContext } from 'react';

export type PremiumContextValue = {
  isPremium: boolean;
  loading: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  setMockPremium: (val: boolean) => void;
};

export const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  loading: false,
  purchase: async () => {},
  restore: async () => {},
  setMockPremium: () => {},
});

export function usePremium() {
  return useContext(PremiumContext);
}
