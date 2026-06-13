import { createContext, useContext } from 'react';

export type PremiumContextValue = {
  isPremium: boolean;
  hasAccess: boolean;
  trialDaysRemaining: number;
  loading: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  setMockPremium: (val: boolean) => void;
  expireTrialForTesting: () => Promise<void>;
  resetTrialForTesting: () => Promise<void>;
};

export const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  hasAccess: false,
  trialDaysRemaining: 0,
  loading: false,
  purchase: async () => {},
  restore: async () => {},
  setMockPremium: () => {},
  expireTrialForTesting: async () => {},
  resetTrialForTesting: async () => {},
});

export function usePremium() {
  return useContext(PremiumContext);
}