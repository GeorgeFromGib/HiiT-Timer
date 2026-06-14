# expo-in-app-purchases Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the mock `src/lib/purchases.ts` with a real `expo-in-app-purchases` one-time (non-consumable) purchase flow, keeping all existing interfaces and callers unchanged.

**Architecture:** Only `src/lib/purchases.ts` is modified. The `PremiumContextValue` interface, `usePremiumState`, `PaywallModal`, and all screens are untouched. A new `premium_v1.json` on disk persists `isPremium` across restarts. The 30-day local trial logic is retained. A single purchase listener registered at init resolves a per-purchase Promise via a shared `_purchaseResolve` slot.

**Tech Stack:** `expo-in-app-purchases`, `expo-file-system` (File/Paths API — already used in this file)

---

### Task 1: Install expo-in-app-purchases and verify API surface

**Files:**
- Modify: `package.json` (via expo install)

- [ ] **Step 1: Install the package**

```bash
npx expo install expo-in-app-purchases
```

Expected: `expo-in-app-purchases` appears in `package.json` dependencies and `node_modules`.

- [ ] **Step 2: Read the Expo SDK 56 docs and verify exact API names**

Open: https://docs.expo.dev/versions/v56.0.0/sdk/in-app-purchases/

Confirm the exact names for each of the following (the plan uses these expected names — correct them in Task 2 if they differ):

| Expected name | Actual name from docs |
|---|---|
| `connectAsync()` | |
| `setPurchaseListener(listener)` | |
| `purchaseItemAsync(productId)` | |
| `getPurchaseHistoryAsync()` | |
| `finishTransactionAsync(purchase, consumeItem)` | |
| `IAPResponseCode.OK` | |
| `IAPResponseCode.USER_CANCELLED` | |
| Listener callback shape: `{ responseCode, results }` | |
| Purchase result field: `results[0].productId` | |

Fill in the "Actual name" column. If any name differs from the expected name, use the actual name everywhere in Task 2.

- [ ] **Step 3: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: install expo-in-app-purchases"
```

---

### Task 2: Replace purchases.ts

**Files:**
- Modify: `src/lib/purchases.ts` (full replacement)

> **Note:** If any API names from Task 1 differ from what appears in the imports or code below, correct them before saving the file.

- [ ] **Step 1: Replace the entire contents of `src/lib/purchases.ts`**

```typescript
import {
  connectAsync,
  getPurchaseHistoryAsync,
  finishTransactionAsync,
  purchaseItemAsync,
  setPurchaseListener,
  IAPResponseCode,
} from 'expo-in-app-purchases';
import { File, Paths } from 'expo-file-system';

// TODO: Replace with real App Store product ID before production release
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
    await connectAsync();
    setPurchaseListener(async ({ responseCode, results }) => {
      if (!_purchaseResolve) return;
      const resolve = _purchaseResolve;
      _purchaseResolve = null;

      if (responseCode === IAPResponseCode.OK && results && results.length > 0) {
        _isPremium = true;
        savePremium();
        try {
          await finishTransactionAsync(results[0], false);
        } catch {}
        resolve(true);
      } else {
        resolve(false);
      }
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
  return new Promise((resolve) => {
    _purchaseResolve = resolve;
    purchaseItemAsync(PRODUCT_ID).catch(() => {
      _purchaseResolve = null;
      resolve(false);
    });
  });
}

export async function restorePurchases(): Promise<boolean> {
  try {
    const { responseCode, results } = await getPurchaseHistoryAsync();
    if (responseCode === IAPResponseCode.OK && results) {
      const found = results.some((p) => p.productId === PRODUCT_ID);
      if (found) {
        _isPremium = true;
        savePremium();
        return true;
      }
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

- [ ] **Step 2: Type-check via export**

```bash
npx expo export --platform ios 2>&1 | grep -E "error|Error|purchases" | head -20
```

Expected: no TypeScript errors in `purchases.ts`. Warnings about native modules not found are normal in a non-native build context.

- [ ] **Step 3: Commit**

```bash
git add src/lib/purchases.ts
git commit -m "feat: replace mock purchases with expo-in-app-purchases"
```

---

### Task 3: Manual verification (iOS dev build required)

IAP does not work in Expo Go. All scenarios below require a dev build installed on a real device or simulator. Build with:

```bash
npx eas build --profile development --platform ios
```

**Files:** No code changes — verification only.

- [ ] **Scenario 1: Fresh install — trial active**

Delete the app from the device/simulator (clears `trial_v1.json` and `premium_v1.json`). Install the dev build. Open SettingsScreen. Confirm:
- `trialDaysRemaining` shows ~30
- A workout can be started (`hasAccess` is `true`)
- `isPremium` shows `false`

- [ ] **Scenario 2: isPremium persists across restarts (Sandbox purchase)**

On a device signed in to a **Sandbox Apple ID** (configure in Settings → App Store → Sandbox Account), open PaywallModal and tap "Purchase". Complete the Sandbox purchase sheet. Force-quit the app and reopen. Confirm `isPremium` is `true` in SettingsScreen — this confirms `premium_v1.json` was written and read back correctly.

- [ ] **Scenario 3: User cancels purchase**

Open PaywallModal and tap "Purchase". When the native App Store sheet appears, tap "Cancel". Confirm:
- The modal closes without error (or remains open — depends on current PaywallModal dismiss logic)
- `isPremium` remains `false`
- App does not crash

- [ ] **Scenario 4: Restore purchases**

> **Note:** There is currently no UI button wired to `restore()` in `PaywallModal` or `SettingsScreen`. To test this scenario, temporarily add a button in `SettingsScreen.tsx` that calls `restore()` from `usePremium()`, then remove it after verification.

On a device that previously completed a Sandbox purchase, delete and reinstall the app. Trigger restore. Confirm `isPremium` becomes `true`.

- [ ] **Scenario 5: Store unavailable at launch**

Disable network on the simulator (Network Link Conditioner → 100% Loss). Launch the app. Confirm:
- App opens without crashing
- `trialDaysRemaining` shows correctly (trial logic still works from disk)
- `hasAccess` is correct based on trial state

- [ ] **Final commit**

```bash
git add -p  # stage any notes or minor fixes made during verification
git commit -m "chore: IAP manual verification complete"
```
