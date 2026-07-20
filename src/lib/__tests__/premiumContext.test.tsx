import React from 'react';
import { renderHook } from '@testing-library/react-native';
import { PremiumContext, usePremium, type PremiumContextValue } from '../premiumContext';

describe('usePremium', () => {
  it('returns the default context value when no Provider is present', async () => {
    const { result } = await renderHook(() => usePremium());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.trialDaysRemaining).toBe(0);
    expect(result.current.loading).toBe(false);
  });

  it('default purchase() resolves to false', async () => {
    const { result } = await renderHook(() => usePremium());
    await expect(result.current.purchase()).resolves.toBe(false);
  });

  it('default restore() resolves to false', async () => {
    const { result } = await renderHook(() => usePremium());
    await expect(result.current.restore()).resolves.toBe(false);
  });

  it('default setMockPremium/expireTrialForTesting/resetTrialForTesting are no-ops that do not throw', async () => {
    const { result } = await renderHook(() => usePremium());
    expect(() => result.current.setMockPremium(true)).not.toThrow();
    await expect(result.current.expireTrialForTesting()).resolves.toBeUndefined();
    await expect(result.current.resetTrialForTesting()).resolves.toBeUndefined();
  });

  it('reads the value provided by PremiumContext.Provider', async () => {
    const value: PremiumContextValue = {
      isPremium: true,
      hasAccess: true,
      trialDaysRemaining: 5,
      loading: true,
      purchase: jest.fn(async () => true),
      restore: jest.fn(async () => true),
      setMockPremium: jest.fn(),
      expireTrialForTesting: jest.fn(async () => {}),
      resetTrialForTesting: jest.fn(async () => {}),
    };
    const wrapper = ({ children }: { children: React.ReactNode }) => (
      <PremiumContext.Provider value={value}>{children}</PremiumContext.Provider>
    );
    const { result } = await renderHook(() => usePremium(), { wrapper });
    expect(result.current).toBe(value);
    expect(result.current.isPremium).toBe(true);
    expect(result.current.trialDaysRemaining).toBe(5);
  });
});
