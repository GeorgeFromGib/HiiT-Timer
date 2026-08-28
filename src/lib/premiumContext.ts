import { createContext, useContext } from 'react';

export type PremiumContextValue = {
  isPremium: boolean;
  hasAccess: boolean;
  trialDaysRemaining: number;
  loading: boolean;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
  setMockPremium: (val: boolean) => void;
  expireTrialForTesting: () => Promise<void>;
  endTrialSoonForTesting: () => Promise<void>;
  resetTrialForTesting: () => Promise<void>;
};

export const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  hasAccess: false,
  trialDaysRemaining: 0,
  loading: false,
  purchase: async () => false,
  restore: async () => false,
  setMockPremium: () => {},
  expireTrialForTesting: async () => {},
  endTrialSoonForTesting: async () => {},
  resetTrialForTesting: async () => {},
});

export function usePremium() {
  return useContext(PremiumContext);
}