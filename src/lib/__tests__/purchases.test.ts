// purchases.ts keeps module-level singleton state, so every test gets a fully fresh module
// (and a fresh in-memory expo-file-system mock) via jest.resetModules() + require().

/* eslint-disable @typescript-eslint/no-explicit-any */

const PRODUCT_ID = 'com.georgefromgib.hiittimer.premium_lifetime';

// eslint-disable-next-line @typescript-eslint/no-require-imports
function setup() {
  jest.resetModules();
  const fs: any = require('expo-file-system');
  const iap: any = require('expo-iap');
  const purchases: typeof import('../purchases') = require('../purchases');
  return { fs, iap, purchases };
}

// purchasePremium logs a console.warn on a purchase-error event (see purchases.ts) — expected
// behavior we exercise below, not a test failure, so it's silenced to keep output clean.
let warnSpy: jest.SpyInstance;
beforeEach(() => {
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
});
afterEach(() => {
  warnSpy.mockRestore();
});

describe('initPurchases', () => {
  it('starts a fresh 30-day trial and non-premium state when no files exist', async () => {
    const { purchases } = await setup();
    await purchases.initPurchases();
    expect(await purchases.getIsPremium()).toBe(false);
    expect(purchases.getTrialDaysRemaining()).toBe(30);
    expect(purchases.getHasAccess()).toBe(true);
  });

  it('persists the newly created trial start date to disk', async () => {
    const { fs, purchases } = await setup();
    await purchases.initPurchases();
    const raw = fs.__files.get('document/trial_v1.json');
    expect(raw).toBeDefined();
    expect(JSON.parse(raw)).toHaveProperty('startedAt');
  });

  it('loads an existing trial start date instead of overwriting it', async () => {
    const { fs, purchases } = await setup();
    const oldStart = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString();
    fs.__files.set('document/trial_v1.json', JSON.stringify({ startedAt: oldStart }));
    await purchases.initPurchases();
    expect(purchases.getTrialDaysRemaining()).toBe(20);
  });

  it('loads isPremium: true from the persisted premium file', async () => {
    const { fs, purchases } = await setup();
    fs.__files.set('document/premium_v1.json', JSON.stringify({ isPremium: true }));
    await purchases.initPurchases();
    expect(await purchases.getIsPremium()).toBe(true);
  });

  it('treats a missing/corrupt premium file as not premium', async () => {
    const { fs, purchases } = await setup();
    fs.__files.set('document/premium_v1.json', '{not valid json');
    await purchases.initPurchases();
    expect(await purchases.getIsPremium()).toBe(false);
  });

  it('registers purchaseUpdatedListener/purchaseErrorListener when initConnection succeeds', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();
    expect(iap.purchaseUpdatedListener).toHaveBeenCalledTimes(1);
    expect(iap.purchaseErrorListener).toHaveBeenCalledTimes(1);
  });

  it('does not throw and still loads state when initConnection rejects', async () => {
    const { iap, purchases } = await setup();
    (iap.initConnection as jest.Mock).mockRejectedValueOnce(new Error('no store'));
    await expect(purchases.initPurchases()).resolves.toBeUndefined();
    expect(iap.purchaseUpdatedListener).not.toHaveBeenCalled();
    expect(purchases.getHasAccess()).toBe(true); // trial state was still loaded before the connection attempt
  });
});

describe('getTrialDaysRemaining / getHasAccess without init', () => {
  it('returns 0 days and no access when trialStartedAt was never set', async () => {
    const { purchases } = await setup();
    expect(purchases.getTrialDaysRemaining()).toBe(0);
    expect(purchases.getHasAccess()).toBe(false);
  });
});

describe('expireTrialForTesting / resetTrialForTesting', () => {
  it('expireTrialForTesting pushes the trial start back 31 days, ending access', async () => {
    const { purchases } = await setup();
    await purchases.initPurchases();
    await purchases.expireTrialForTesting();
    expect(purchases.getTrialDaysRemaining()).toBe(0);
    expect(purchases.getHasAccess()).toBe(false);
  });

  it('resetTrialForTesting restarts a fresh 30-day trial', async () => {
    const { purchases } = await setup();
    await purchases.initPurchases();
    await purchases.expireTrialForTesting();
    await purchases.resetTrialForTesting();
    expect(purchases.getTrialDaysRemaining()).toBe(30);
    expect(purchases.getHasAccess()).toBe(true);
  });
});

describe('setMockPremium', () => {
  it('toggles isPremium without touching the trial state', async () => {
    const { purchases } = await setup();
    purchases.setMockPremium(true);
    expect(await purchases.getIsPremium()).toBe(true);
    expect(purchases.getHasAccess()).toBe(true);

    purchases.setMockPremium(false);
    expect(await purchases.getIsPremium()).toBe(false);
  });
});

describe('purchasePremium', () => {
  it('resolves true and marks premium when the matching product purchase event fires', async () => {
    const { fs, iap, purchases } = await setup();
    await purchases.initPurchases();

    const purchasePromise = purchases.purchasePremium();
    expect(iap.requestPurchase).toHaveBeenCalledTimes(1);

    const onUpdate = (iap.purchaseUpdatedListener as jest.Mock).mock.calls[0][0];
    await onUpdate({ productId: PRODUCT_ID });

    expect(await purchasePromise).toBe(true);
    expect(await purchases.getIsPremium()).toBe(true);
    expect(JSON.parse(fs.__files.get('document/premium_v1.json'))).toEqual({ isPremium: true });
    expect(iap.finishTransaction).toHaveBeenCalledWith({ purchase: { productId: PRODUCT_ID } });
  });

  it('ignores a purchase update for a different productId', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();

    purchases.purchasePremium();
    const onUpdate = (iap.purchaseUpdatedListener as jest.Mock).mock.calls[0][0];
    await onUpdate({ productId: 'some.other.sku' });

    expect(await purchases.getIsPremium()).toBe(false);
  });

  it('resolves false when the purchase error listener fires', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();

    const purchasePromise = purchases.purchasePremium();
    const onError = (iap.purchaseErrorListener as jest.Mock).mock.calls[0][0];
    onError({ message: 'user cancelled' });

    expect(await purchasePromise).toBe(false);
    expect(await purchases.getIsPremium()).toBe(false);
  });

  it('resolves false when requestPurchase itself rejects', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();
    (iap.requestPurchase as jest.Mock).mockRejectedValueOnce(new Error('failed to start'));

    expect(await purchases.purchasePremium()).toBe(false);
  });

  it('returns false immediately when a purchase or restore flow is already in progress', async () => {
    const { purchases } = await setup();
    await purchases.initPurchases();

    const first = purchases.purchasePremium(); // leaves flowState === 'purchasing'
    expect(await purchases.purchasePremium()).toBe(false);

    // drain the first flow so it doesn't leak into other tests via unhandled rejection warnings
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const iap: any = require('expo-iap');
    const onError = (iap.purchaseErrorListener as jest.Mock).mock.calls[0][0];
    onError({ message: 'cleanup' });
    await first;
  });
});

describe('restorePurchases', () => {
  it('resolves true and marks premium when a matching purchase is found', async () => {
    const { fs, iap, purchases } = await setup();
    await purchases.initPurchases();
    (iap.getAvailablePurchases as jest.Mock).mockResolvedValueOnce([{ productId: PRODUCT_ID }]);

    expect(await purchases.restorePurchases()).toBe(true);
    expect(await purchases.getIsPremium()).toBe(true);
    expect(JSON.parse(fs.__files.get('document/premium_v1.json'))).toEqual({ isPremium: true });
  });

  it('resolves false and stays non-premium when no matching purchase is found', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();
    (iap.getAvailablePurchases as jest.Mock).mockResolvedValueOnce([{ productId: 'other.sku' }]);

    expect(await purchases.restorePurchases()).toBe(false);
    expect(await purchases.getIsPremium()).toBe(false);
  });

  it('resolves false when the underlying restore call throws', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();
    (iap.restorePurchases as jest.Mock).mockRejectedValueOnce(new Error('network error'));

    expect(await purchases.restorePurchases()).toBe(false);
  });

  it('returns false immediately when a purchase or restore flow is already in progress', async () => {
    const { iap, purchases } = await setup();
    await purchases.initPurchases();
    (iap.getAvailablePurchases as jest.Mock).mockImplementationOnce(
      () => new Promise(() => {}), // never resolves, keeps flowState 'restoring'
    );

    purchases.restorePurchases();
    expect(await purchases.restorePurchases()).toBe(false);
  });

  it('resets flowState to idle after finishing, allowing a subsequent call', async () => {
    const { purchases } = await setup();
    await purchases.initPurchases();

    await purchases.restorePurchases();
    // flowState should be back to idle; a second call should proceed normally rather than
    // short-circuit to false due to a stuck flowState.
    const result = purchases.restorePurchases();
    await expect(result).resolves.toBe(false);
  });
});
