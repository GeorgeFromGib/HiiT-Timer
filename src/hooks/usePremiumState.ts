import { useEffect, useState } from 'react';
import {
  initPurchases,
  getIsPremium,
  getHasAccess,
  getTrialDaysRemaining,
  purchasePremium,
  restorePurchases,
  setMockPremium as mockSet,
  expireTrialForTesting as expireTrial,
  endTrialSoonForTesting as endTrialSoon,
  resetTrialForTesting as resetTrial,
} from '../lib/purchases';
import type { PremiumContextValue } from '../lib/premiumContext';

export function usePremiumState(apiKey?: string): PremiumContextValue {
  const [isPremium, setIsPremium] = useState(false);
  const [hasAccess, setHasAccess] = useState(false);
  const [trialDaysRemaining, setTrialDaysRemaining] = useState(0);
  const [loading, setLoading] = useState(true);

  async function refreshState() {
    const premium = await getIsPremium();
    setIsPremium(premium);
    setHasAccess(getHasAccess());
    setTrialDaysRemaining(getTrialDaysRemaining());
  }

  useEffect(() => {
    initPurchases(apiKey)
      .then(refreshState)
      .finally(() => setLoading(false));
  }, []);

  async function purchase(): Promise<boolean> {
    setLoading(true);
    try {
      const success = await purchasePremium();
      await refreshState();
      return success;
    } finally {
      setLoading(false);
    }
  }

  async function restore(): Promise<boolean> {
    setLoading(true);
    try {
      const found = await restorePurchases();
      await refreshState();
      return found;
    } finally {
      setLoading(false);
    }
  }

  function setMockPremium(val: boolean) {
    mockSet(val);
    refreshState();
  }

  async function expireTrialForTesting() {
    await expireTrial();
    await refreshState();
  }

  async function endTrialSoonForTesting() {
    await endTrialSoon();
    await refreshState();
  }

  async function resetTrialForTesting() {
    await resetTrial();
    await refreshState();
  }

  return {
    isPremium,
    hasAccess,
    trialDaysRemaining,
    loading,
    purchase,
    restore,
    setMockPremium,
    expireTrialForTesting,
    endTrialSoonForTesting,
    resetTrialForTesting,
  };
}