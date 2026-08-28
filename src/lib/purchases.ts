import {
  initConnection,
  requestPurchase,
  getAvailablePurchases,
  restorePurchases as iapRestorePurchases,
  finishTransaction,
  purchaseUpdatedListener,
  purchaseErrorListener,
} from 'expo-iap';
import { readJsonFile, writeJsonFile } from './jsonFile';

// Replace with real App Store product ID before production release
const PRODUCT_ID = 'com.georgefromgib.hiittimer.premium_lifetime';

const TRIAL_DAYS = 30;

type FlowState = 'idle' | 'purchasing' | 'restoring';

const state = {
  isPremium: false,
  trialStartedAt: null as string | null,
  trialReminderShown: false,
  flowState: 'idle' as FlowState,
  pendingResolve: null as ((success: boolean) => void) | null,
};

const TRIAL_FILE = 'trial_v1.json';
const PREMIUM_FILE = 'premium_v1.json';
const TRIAL_REMINDER_FILE = 'trial_reminder_v1.json';

async function loadPremium(): Promise<boolean> {
  const parsed = await readJsonFile<{ isPremium: boolean }>(PREMIUM_FILE);
  return parsed?.isPremium === true;
}

function savePremium(): void {
  writeJsonFile(PREMIUM_FILE, { isPremium: true });
}

async function saveTrialStart(iso: string): Promise<void> {
  writeJsonFile(TRIAL_FILE, { startedAt: iso });
}

function setTrialReminderShown(shown: boolean): void {
  state.trialReminderShown = shown;
  writeJsonFile(TRIAL_REMINDER_FILE, { shown });
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

  const trial = await readJsonFile<{ startedAt: string }>(TRIAL_FILE);
  if (trial) {
    state.trialStartedAt = trial.startedAt;
  } else {
    state.trialStartedAt = new Date().toISOString();
    await saveTrialStart(state.trialStartedAt);
  }

  const reminder = await readJsonFile<{ shown: boolean }>(TRIAL_REMINDER_FILE);
  state.trialReminderShown = reminder?.shown === true;

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

export function isTrialReminderDue(days: number, isPremium: boolean, shown: boolean): boolean {
  return !isPremium && !shown && days >= 1 && days <= 3;
}

export function wasTrialReminderShown(): boolean {
  return state.trialReminderShown;
}

export function markTrialReminderShown(): void {
  setTrialReminderShown(true);
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
    await iapRestorePurchases();
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

export async function endTrialSoonForTesting(): Promise<void> {
  state.trialStartedAt = new Date(
    Date.now() - (TRIAL_DAYS - 2) * 24 * 60 * 60 * 1000
  ).toISOString();
  await saveTrialStart(state.trialStartedAt);
  setTrialReminderShown(false);
}

export async function resetTrialForTesting(): Promise<void> {
  state.trialStartedAt = new Date().toISOString();
  await saveTrialStart(state.trialStartedAt);
  setTrialReminderShown(false);
}
