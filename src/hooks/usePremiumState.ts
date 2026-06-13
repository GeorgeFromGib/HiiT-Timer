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

  async function purchase() {
    await purchasePremium();
    await refreshState();
  }

  async function restore() {
    await restorePurchases();
    await refreshState();
  }

  function setMockPremium(val: boolean) {
    mockSet(val);
    refreshState();
  }

  async function expireTrialForTesting() {
    await expireTrial();
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
    resetTrialForTesting,
  };
}