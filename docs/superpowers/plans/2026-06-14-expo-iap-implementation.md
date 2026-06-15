# expo-iap Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock `src/lib/purchases.ts` with a real `expo-iap` one-time (non-consumable) purchase flow, keeping all existing interfaces and callers unchanged.

**Architecture:** `src/lib/purchases.ts` is replaced with a real expo-iap implementation. `src/components/PaywallModal.tsx` gains a Restore purchases button (required by App Store guidelines). `premiumContext.ts`, `usePremiumState`, and all screens are untouched. A new `premium_v1.json` on disk persists `isPremium` across restarts. The 30-day local trial logic is retained. Two event listeners (`purchaseUpdatedListener` / `purchaseErrorListener`) are registered once at init and resolve per-purchase Promises via a shared `_purchaseResolve` slot.

**Tech Stack:** `expo-iap`, `expo-file-system` (File/Paths API — already used in this file)

---

### Task 1: Install expo-iap

**Files:**
- Modify: `package.json` (via expo install)

- [x] **Step 1: Install the package**

```bash
npx expo install expo-iap
```

Expected: `expo-iap` appears in `package.json` dependencies and `node_modules/expo-iap` exists.

- [x] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install expo-iap"
```


---

### Task 2: Replace purchases.ts

**Files:**
- Modify: `src/lib/purchases.ts` (full replacement)

- [x] **Step 1: Replace the entire contents of `src/lib/purchases.ts`**

```typescript
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
```

- [x] **Step 2: Type-check**

```bash
npx tsc --noEmit 2>&1 | grep -i "purchases" | head -20
```

Expected: no errors in `purchases.ts`. If `expo-iap` types complain about `{ sku }` on `requestPurchase`, check the installed version's types with `cat node_modules/expo-iap/src/types.ts | grep -A5 "RequestPurchaseArgs"` and adjust the argument shape accordingly.

- [x] **Step 3: Commit**

```bash
git add src/lib/purchases.ts
git commit -m "feat: replace mock purchases with expo-iap"
```

---

### Task 3: Manual verification (iOS dev build required)

IAP does not work in Expo Go. All scenarios require a dev build on a real device or simulator signed into a **Sandbox Apple ID** (Settings → App Store → Sandbox Account on device). Build with:

```bash
npx eas build --profile development --platform ios
```

**Files:** No code changes — verification only.

- [ ] **Scenario 1: Fresh install — trial active**

Delete the app from the device/simulator (clears both JSON files). Install the dev build. Open SettingsScreen. Confirm:
- `trialDaysRemaining` shows ~30
- A workout can be started (`hasAccess` is `true`)
- `isPremium` shows `false`

- [ ] **Scenario 2: isPremium persists across restarts**

Open PaywallModal and tap "Purchase". Complete the Sandbox purchase sheet. Force-quit the app and reopen. Confirm `isPremium` is `true` in SettingsScreen — confirms `premium_v1.json` was written and read correctly.

- [ ] **Scenario 3: User cancels purchase**

Open PaywallModal and tap "Purchase". When the native sheet appears, tap "Cancel". Confirm:
- `isPremium` remains `false`
- App does not crash

- [ ] **Scenario 4: Restore purchases**

On a device that previously completed a Sandbox purchase, delete and reinstall the app. Open PaywallModal and tap "Restore purchases". Confirm `isPremium` becomes `true`.

- [ ] **Scenario 5: Store unavailable at launch**

Disable network on the simulator (Network Link Conditioner → 100% Loss). Launch the app. Confirm:
- App opens without crashing
- `trialDaysRemaining` shows correctly
- `hasAccess` is correct based on trial state

- [ ] **Final commit**

```bash
git add -p
git commit -m "chore: IAP manual verification complete"
```
