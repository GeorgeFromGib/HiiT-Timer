import { File, Paths } from 'expo-file-system';

let _isPremium = false;
let _trialStartedAt: string | null = null;

const TRIAL_DAYS = 30;

const trialFile = () => new File(Paths.document, 'trial_v1.json');

async function saveTrialStart(iso: string): Promise<void> {
  try {
    trialFile().write(JSON.stringify({ startedAt: iso }));
  } catch {}
}

function isWithinTrial(): boolean {
  if (!_trialStartedAt) return false;
  const elapsed = (Date.now() - new Date(_trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return elapsed < TRIAL_DAYS;
}

export async function initPurchases(_apiKey?: string): Promise<void> {
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
}

export async function getIsPremium(): Promise<boolean> {
  return _isPremium;
}

export function getHasAccess(): boolean {
  return _isPremium || isWithinTrial();
}

export function getTrialDaysRemaining(): number {
  if (!_trialStartedAt) return 0;
  const elapsed = (Date.now() - new Date(_trialStartedAt).getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRIAL_DAYS - elapsed));
}

export async function purchasePremium(): Promise<boolean> {
  _isPremium = true;
  return true;
}

export async function restorePurchases(): Promise<boolean> {
  return _isPremium;
}

export function setMockPremium(val: boolean): void {
  _isPremium = val;
}

export async function expireTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  await saveTrialStart(_trialStartedAt);
}

export async function resetTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date().toISOString();
  await saveTrialStart(_trialStartedAt);
}