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

type FlowState = 'idle' | 'purchasing' | 'restoring';

const state = {
  isPremium: false,
  trialStartedAt: null as string | null,
  flowState: 'idle' as FlowState,
  pendingResolve: null as ((success: boolean) => void) | null,
};

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
  if (!state.trialStartedAt) return false;
  const elapsed =
    (Date.now() - new Date(state.trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return elapsed < TRIAL_DAYS;
}

function settlePurchase(success: boolean): void {
  const resolve = state.pendingResolve;
  state.pendingResolve = null;
  state.flowState = 'idle';
  resolve?.(success);
}

export async function initPurchases(_apiKey?: string): Promise<void> {
  state.isPremium = await loadPremium();

  try {
    const f = trialFile();
    if (f.exists) {
      const raw = await f.text();
      const data = JSON.parse(raw) as { startedAt: string };
      state.trialStartedAt = data.startedAt;
    } else {
      state.trialStartedAt = new Date().toISOString();
      await saveTrialStart(state.trialStartedAt);
    }
  } catch {
    state.trialStartedAt = new Date().toISOString();
  }

  try {
    await initConnection();

    purchaseUpdatedListener(async (purchase) => {
      if (purchase.productId !== PRODUCT_ID) return;
      state.isPremium = true;
      savePremium();
      try {
        await finishTransaction({ purchase });
      } catch {}
      if (state.flowState === 'purchasing') settlePurchase(true);
    });

    purchaseErrorListener((error) => {
      console.warn('[purchases] purchaseError:', error);
      if (state.flowState === 'purchasing') settlePurchase(false);
    });
  } catch {}
}

export async function getIsPremium(): Promise<boolean> {
  return state.isPremium;
}

export function getHasAccess(): boolean {
  return state.isPremium || isWithinTrial();
}

export function getTrialDaysRemaining(): number {
  if (!state.trialStartedAt) return 0;
  const elapsed =
    (Date.now() - new Date(state.trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export async function purchasePremium(): Promise<boolean> {
  if (state.flowState !== 'idle') return false;
  return new Promise((resolve) => {
    state.flowState = 'purchasing';
    state.pendingResolve = resolve;
    requestPurchase({
      type: 'in-app',
      request: {
        apple: { sku: PRODUCT_ID },
        google: { skus: [PRODUCT_ID] },
      },
    }).catch(() => {
      if (state.flowState === 'purchasing') settlePurchase(false);
    });
  });
}

export async function restorePurchases(): Promise<boolean> {
  if (state.flowState !== 'idle') return false;
  state.flowState = 'restoring';
  try {
    const purchases = await getAvailablePurchases();
    const found = purchases.some((p) => p.productId === PRODUCT_ID);
    if (found) {
      state.isPremium = true;
      savePremium();
    }
    return found;
  } catch {
    return false;
  } finally {
    state.flowState = 'idle';
  }
}

export function setMockPremium(val: boolean): void {
  state.isPremium = val;
}

export async function expireTrialForTesting(): Promise<void> {
  state.trialStartedAt = new Date(
    Date.now() - 31 * 24 * 60 * 60 * 1000
  ).toISOString();
  await saveTrialStart(state.trialStartedAt);
}

export async function resetTrialForTesting(): Promise<void> {
  state.trialStartedAt = new Date().toISOString();
  await saveTrialStart(state.trialStartedAt);
}
