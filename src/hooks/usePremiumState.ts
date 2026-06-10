import { useEffect, useState } from 'react';
import {
  initPurchases,
  getIsPremium,
  purchasePremium,
  restorePurchases,
  setMockPremium as mockSet,
} from '../lib/purchases';
import type { PremiumContextValue } from '../lib/premiumContext';

export function usePremiumState(apiKey?: string): PremiumContextValue {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    initPurchases(apiKey)
      .then(() => getIsPremium())
      .then(setIsPremium)
      .finally(() => setLoading(false));
  }, []);

  async function purchase() {
    const result = await purchasePremium();
    if (result) setIsPremium(true);
  }

  async function restore() {
    const result = await restorePurchases();
    if (result) setIsPremium(true);
  }

  function setMockPremium(val: boolean) {
    mockSet(val);
    setIsPremium(val);
  }

  return { isPremium, loading, purchase, restore, setMockPremium };
}
