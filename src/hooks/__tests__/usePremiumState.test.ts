import { act, renderHook } from '@testing-library/react-native';
import { usePremiumState } from '../usePremiumState';

// Mirrors the private PRODUCT_ID in src/lib/purchases.ts — not exported, so duplicated here
// for the purposes of simulating a matching purchase-updated event.
const PRODUCT_ID = 'com.georgefromgib.hiittimer.premium_lifetime';

const iapMock = jest.requireMock('expo-iap');
const filesMock = jest.requireMock('expo-file-system').__files as Map<string, string>;

function latestListener(mockFn: jest.Mock) {
  return mockFn.mock.calls[mockFn.mock.calls.length - 1][0];
}

// purchasePremium logs a console.warn on a purchase-error event (see lib/purchases.ts) —
// expected behavior we exercise below, not a test failure, so it's silenced to keep output clean.
let warnSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  filesMock.clear();
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});

afterEach(() => {
  warnSpy.mockRestore();
});

describe('usePremiumState', () => {
  it('starts loading and resolves to a fresh (non-premium, in-trial) state once init completes', async () => {
    const { result } = await renderHook(() => usePremiumState());
    expect(result.current.loading).toBe(false);
    expect(result.current.isPremium).toBe(false);
    expect(result.current.hasAccess).toBe(true); // brand-new trial just started
    expect(result.current.trialDaysRemaining).toBe(30);
  });

  it('loads isPremium=true from a persisted premium file', async () => {
    filesMock.set('document/premium_v1.json', JSON.stringify({ isPremium: true }));
    const { result } = await renderHook(() => usePremiumState());
    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasAccess).toBe(true);
  });

  it('computes hasAccess=false and trialDaysRemaining=0 once the trial has expired', async () => {
    const expired = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
    filesMock.set('document/trial_v1.json', JSON.stringify({ startedAt: expired }));
    const { result } = await renderHook(() => usePremiumState());
    expect(result.current.isPremium).toBe(false);
    expect(result.current.hasAccess).toBe(false);
    expect(result.current.trialDaysRemaining).toBe(0);
  });

  it('purchase() sets loading while pending, then grants premium once the purchase-updated event fires', async () => {
    const { result } = await renderHook(() => usePremiumState());

    let purchasePromise: Promise<boolean>;
    await act(async () => { purchasePromise = result.current.purchase(); });
    expect(result.current.loading).toBe(true);

    let success: boolean | undefined;
    await act(async () => {
      const listener = latestListener(iapMock.purchaseUpdatedListener);
      await listener({ productId: PRODUCT_ID });
      success = await purchasePromise;
    });

    expect(success).toBe(true);
    expect(result.current.loading).toBe(false);
    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasAccess).toBe(true);
  });

  it('purchase() ignores a purchase-updated event for a different productId', async () => {
    const { result } = await renderHook(() => usePremiumState());
    await act(async () => {
      const listener = latestListener(iapMock.purchaseUpdatedListener);
      await listener({ productId: 'com.some.other.sku' });
    });
    expect(result.current.isPremium).toBe(false);
  });

  it('purchase() resolves false and clears loading when the purchase-error event fires', async () => {
    const { result } = await renderHook(() => usePremiumState());

    let purchasePromise: Promise<boolean>;
    await act(async () => { purchasePromise = result.current.purchase(); });

    let success: boolean | undefined;
    await act(async () => {
      const listener = latestListener(iapMock.purchaseErrorListener);
      listener({ code: 'E_USER_CANCELLED', message: 'cancelled' });
      success = await purchasePromise;
    });

    expect(success).toBe(false);
    expect(result.current.loading).toBe(false);
    expect(result.current.isPremium).toBe(false);
  });

  it('restore() grants premium when a matching purchase is found', async () => {
    iapMock.getAvailablePurchases.mockResolvedValueOnce([{ productId: PRODUCT_ID }]);
    const { result } = await renderHook(() => usePremiumState());

    let found: boolean | undefined;
    await act(async () => { found = await result.current.restore(); });

    expect(found).toBe(true);
    expect(result.current.isPremium).toBe(true);
    expect(result.current.loading).toBe(false);
  });

  it('restore() leaves isPremium false when no matching purchase is found', async () => {
    iapMock.getAvailablePurchases.mockResolvedValueOnce([{ productId: 'com.some.other.sku' }]);
    const { result } = await renderHook(() => usePremiumState());

    let found: boolean | undefined;
    await act(async () => { found = await result.current.restore(); });

    expect(found).toBe(false);
    expect(result.current.isPremium).toBe(false);
  });

  it('setMockPremium(true) flips isPremium/hasAccess without an async purchase flow', async () => {
    const { result } = await renderHook(() => usePremiumState());
    await act(async () => result.current.setMockPremium(true));
    expect(result.current.isPremium).toBe(true);
    expect(result.current.hasAccess).toBe(true);
  });

  it('expireTrialForTesting() zeroes trialDaysRemaining and drops hasAccess when not premium', async () => {
    const { result } = await renderHook(() => usePremiumState());
    await act(async () => result.current.expireTrialForTesting());
    expect(result.current.trialDaysRemaining).toBe(0);
    expect(result.current.hasAccess).toBe(false);
  });

  it('resetTrialForTesting() restores a full 30-day trial', async () => {
    const { result } = await renderHook(() => usePremiumState());
    await act(async () => result.current.expireTrialForTesting());
    expect(result.current.hasAccess).toBe(false);

    await act(async () => result.current.resetTrialForTesting());
    expect(result.current.trialDaysRemaining).toBe(30);
    expect(result.current.hasAccess).toBe(true);
  });
});
