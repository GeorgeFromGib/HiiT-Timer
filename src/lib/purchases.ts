import {
  initConnection,
  requestPurchase,
  getAvailablePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';
import { File, Paths } from 'expo-file-system';

// Replace with real App Store product ID before production release
const PRODUCT_ID = 'com.yourapp.premium_lifetime';

const TRIAL_DAYS = 30;

let _isPremium = false;
let _trialStartedAt: string | null = null;
let _purchaseResolve: ((success: boolean) => void) | null = null;

const trialFile = () => new File(Paths.document, 'trial_v1.json');
const premiumFile = () => new File(Paths.document, 'premium_v1.json');

async function loadPremium(): Promise<boolean> {
  try {
    const f = premiumFile();
    if (f.exists) {
      const raw = await f.text();
      return (JSON.parse(raw) as { isPremium: boolean }).isPremium === true;
    }
  } catch {}
  return false;
}

function savePremium(): void {
  try {
    premiumFile().write(JSON.stringify({ isPremium: true }));
  } catch {}
}

async function saveTrialStart(iso: string): Promise<void> {
  try {
    trialFile().write(JSON.stringify({ startedAt: iso }));
  } catch {}
}

function isWithinTrial(): boolean {
  if (!_trialStartedAt) return false;
  const elapsed =
    (Date.now() - new Date(_trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return elapsed < TRIAL_DAYS;
}

export async function initPurchases(_apiKey?: string): Promise<void> {
  _isPremium = await loadPremium();

  try {
    const f = trialFile();
    if (f.exists) {
      const raw = await f.text();
      const data = JSON.parse(raw) as { startedAt: string };
      _trialStartedAt = data.startedAt;
    } else {
      _trialStartedAt = new Date().toISOString();
      await saveTrialStart(_trialStartedAt);
    }
  } catch {
    _trialStartedAt = new Date().toISOString();
  }

  try {
    await initConnection();

    purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PRODUCT_ID) return;

      // Handle unfinished-transaction replay (no active purchase flow)
      if (!_purchaseResolve) {
        _isPremium = true;
        savePremium();
        try {
          await finishTransaction({ purchase });
        } catch {}
        return;
      }

      const resolve = _purchaseResolve;
      _purchaseResolve = null;
      _isPremium = true;
      savePremium();
      try {
        await finishTransaction({ purchase });
      } catch {}
      resolve(true);
    });

    purchaseErrorListener((error) => {
      console.warn('[purchases] purchaseError:', error);
      if (!_purchaseResolve) return;
      const resolve = _purchaseResolve;
      _purchaseResolve = null;
      resolve(false);
    });
  } catch {}
}

export async function getIsPremium(): Promise<boolean> {
  return _isPremium;
}

export function getHasAccess(): boolean {
  return _isPremium || isWithinTrial();
}

export function getTrialDaysRemaining(): number {
  if (!_trialStartedAt) return 0;
  const elapsed =
    (Date.now() - new Date(_trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export async function purchasePremium(): Promise<boolean> {
  if (_purchaseResolve) return false;
  return new Promise((resolve) => {
    _purchaseResolve = resolve;
    requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku: PRODUCT_ID },
        google: { skus: [PRODUCT_ID] },
      },
    }).catch(() => {
      _purchaseResolve = null;
      resolve(false);
    });
  });
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const purchases = await getAvailablePurchases();
    const found = purchases.some((p) => p.productId === PRODUCT_ID);
    if (found) {
      _isPremium = true;
      savePremium();
      return true;
    }
  } catch {}
  return false;
}

export function setMockPremium(val: boolean): void {
  _isPremium = val;
}

export async function expireTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date(
    Date.now() - 31 * 24 * 60 * 60 * 1000
  ).toISOString();
  await saveTrialStart(_trialStartedAt);
}

export async function resetTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date().toISOString();
  await saveTrialStart(_trialStartedAt);
}
