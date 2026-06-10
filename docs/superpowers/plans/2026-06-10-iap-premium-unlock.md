# IAP — Premium Unlock (Unlimited Sessions) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a one-time, non-consumable iOS in-app purchase (via RevenueCat) that unlocks unlimited saved sessions; free users are capped at 5 total sessions.

**Architecture:** A single SDK-boundary module (`src/lib/purchases.ts`) wraps `react-native-purchases`. Pure logic (`src/lib/sessionLimit.ts`) decides whether creation is allowed. A React context (`premiumContext.tsx` + `usePremiumState.ts`) exposes premium status app-wide, mirroring the existing `SettingsContext` pattern in `App.tsx`. The gate is enforced at the two session-creation entry points in `SessionsListScreen.tsx`, which open a `PaywallModal` when blocked.

**Tech Stack:** Expo SDK 56, React Native 0.85, TypeScript, `react-native-purchases` (RevenueCat), `expo-constants`, `jest-expo` for tests.

**Reference spec:** `docs/superpowers/specs/2026-06-10-iap-premium-unlock-plan.md`

---

## Prerequisites (manual, performed by the developer — not code tasks)

These must exist before Phase 4 manual verification, but do NOT block writing/landing the code in Phases 0–3:

1. **App Store Connect** → create a non-consumable IAP with product ID `com.georgefromgib.hiittimer.premium_unlock`, set a price tier, add a localized display name + description.
2. **RevenueCat** → create a project, add the App Store app, paste the App Store shared secret, create an **entitlement with identifier `premium`**, create an **offering** (the default `current` offering) and attach the product as a package.
3. Copy the RevenueCat **iOS public SDK key** (prefix `appl_`) — it goes into `app.json` in Task 8.
4. Create a **Sandbox tester** in App Store Connect, and add a local **StoreKit configuration file** in Xcode for simulator testing.

---

## File Structure

| File | Created/Modified | Responsibility |
|---|---|---|
| `src/lib/sessionLimit.ts` | Create | Pure: `FREE_SESSION_LIMIT`, `canCreateSession()`. |
| `src/lib/sessionLimit.test.ts` | Create | Unit tests for the above. |
| `src/lib/purchases.ts` | Create | **Only** importer of `react-native-purchases`. Init, premium check, purchase, restore, price string. |
| `src/lib/purchases.test.ts` | Create | Unit tests with the SDK mocked. |
| `src/lib/premiumContext.tsx` | Create | `PremiumContext` + `usePremium()`. |
| `src/hooks/usePremiumState.ts` | Create | Owns premium state; inits SDK on mount. |
| `src/components/PaywallModal.tsx` | Create | Themed paywall: Unlock / Restore / Close. |
| `App.tsx` | Modify | Wrap tree in `PremiumContext.Provider`. |
| `src/screens/SessionsListScreen.tsx` | Modify | Enforce gate at + button and duplicate. |
| `src/screens/SettingsScreen.tsx` | Modify | Add "Restore Purchases" row. |
| `app.json` | Modify | Add `extra.revenueCatIosKey`. |
| `package.json` | Modify | Add `test` script + `jest` preset + dev deps. |

---

## Phase 0 — Test harness

### Task 1: Install and configure jest-expo

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the test runner**

Run:
```bash
npx expo install -- --save-dev jest-expo jest @types/jest
```
Expected: `jest-expo`, `jest`, `@types/jest` added under `devDependencies`.

- [ ] **Step 2: Add test script and jest preset to `package.json`**

In the `"scripts"` block add a `test` entry, and add a top-level `"jest"` key. Resulting fragments:

```json
  "scripts": {
    "start": "expo start",
    "android": "expo run:android",
    "ios": "expo run:ios",
    "web": "expo start --web",
    "test": "jest"
  },
  "jest": {
    "preset": "jest-expo"
  }
```

- [ ] **Step 3: Add a sanity test**

Create `src/lib/__sanity__.test.ts`:
```ts
test('jest runs', () => {
  expect(1 + 1).toBe(2);
});
```

- [ ] **Step 4: Run it**

Run: `npx jest src/lib/__sanity__.test.ts`
Expected: PASS, 1 test.

- [ ] **Step 5: Remove the sanity test and commit**

```bash
rm src/lib/__sanity__.test.ts
git add package.json package-lock.json
git commit -m "chore: add jest-expo test harness

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 1 — Pure session-limit logic (TDD)

### Task 2: `canCreateSession`

**Files:**
- Create: `src/lib/sessionLimit.ts`
- Test: `src/lib/sessionLimit.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/sessionLimit.test.ts`:
```ts
import { canCreateSession, FREE_SESSION_LIMIT } from './sessionLimit';

describe('canCreateSession', () => {
  test('FREE_SESSION_LIMIT is 5', () => {
    expect(FREE_SESSION_LIMIT).toBe(5);
  });

  test('free user under the limit can create', () => {
    expect(canCreateSession(4, false)).toBe(true);
  });

  test('free user at the limit cannot create', () => {
    expect(canCreateSession(5, false)).toBe(false);
  });

  test('free user over the limit cannot create', () => {
    expect(canCreateSession(9, false)).toBe(false);
  });

  test('premium user is never blocked', () => {
    expect(canCreateSession(5, true)).toBe(true);
    expect(canCreateSession(999, true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/lib/sessionLimit.test.ts`
Expected: FAIL — cannot find module `./sessionLimit`.

- [ ] **Step 3: Implement**

Create `src/lib/sessionLimit.ts`:
```ts
export const FREE_SESSION_LIMIT = 5;

/** Free users may keep up to FREE_SESSION_LIMIT total sessions (defaults included). */
export function canCreateSession(count: number, isPremium: boolean): boolean {
  return isPremium || count < FREE_SESSION_LIMIT;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/lib/sessionLimit.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/sessionLimit.ts src/lib/sessionLimit.test.ts
git commit -m "feat: add pure session-limit gate logic

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 2 — Purchases module (TDD with SDK mocked)

### Task 3: Install the SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install RevenueCat and expo-constants**

Run:
```bash
npx expo install react-native-purchases expo-constants
```
Expected: both added to `dependencies` at SDK-56-compatible versions.

- [ ] **Step 2: Commit**

```bash
git add package.json package-lock.json
git commit -m "chore: add react-native-purchases and expo-constants

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 4: `purchases.ts` wrapper

**Files:**
- Create: `src/lib/purchases.ts`
- Test: `src/lib/purchases.test.ts`

- [ ] **Step 1: Write the failing test**

Create `src/lib/purchases.test.ts`:
```ts
jest.mock('react-native-purchases', () => ({
  __esModule: true,
  default: {
    configure: jest.fn(),
    getCustomerInfo: jest.fn(),
    getOfferings: jest.fn(),
    purchasePackage: jest.fn(),
    restorePurchases: jest.fn(),
  },
}));

import Purchases from 'react-native-purchases';
import {
  initPurchases,
  getIsPremium,
  purchasePremium,
  restorePurchases,
  getPremiumPriceString,
} from './purchases';

const mockP = Purchases as unknown as {
  configure: jest.Mock;
  getCustomerInfo: jest.Mock;
  getOfferings: jest.Mock;
  purchasePackage: jest.Mock;
  restorePurchases: jest.Mock;
};

const entitled = { entitlements: { active: { premium: { isActive: true } } } };
const notEntitled = { entitlements: { active: {} } };
const offering = {
  current: { availablePackages: [{ product: { priceString: '$4.99' } }] },
};

beforeEach(() => jest.clearAllMocks());

test('initPurchases configures the SDK with the key', () => {
  initPurchases('appl_test');
  expect(mockP.configure).toHaveBeenCalledWith({ apiKey: 'appl_test' });
});

test('getIsPremium true when entitlement active', async () => {
  mockP.getCustomerInfo.mockResolvedValue(entitled);
  expect(await getIsPremium()).toBe(true);
});

test('getIsPremium false when not entitled', async () => {
  mockP.getCustomerInfo.mockResolvedValue(notEntitled);
  expect(await getIsPremium()).toBe(false);
});

test('getPremiumPriceString returns the package price', async () => {
  mockP.getOfferings.mockResolvedValue(offering);
  expect(await getPremiumPriceString()).toBe('$4.99');
});

test('getPremiumPriceString null when no offering', async () => {
  mockP.getOfferings.mockResolvedValue({ current: null });
  expect(await getPremiumPriceString()).toBeNull();
});

test('purchasePremium true on successful purchase', async () => {
  mockP.getOfferings.mockResolvedValue(offering);
  mockP.purchasePackage.mockResolvedValue({ customerInfo: entitled });
  expect(await purchasePremium()).toBe(true);
});

test('purchasePremium false when user cancels', async () => {
  mockP.getOfferings.mockResolvedValue(offering);
  mockP.purchasePackage.mockRejectedValue({ userCancelled: true });
  expect(await purchasePremium()).toBe(false);
});

test('purchasePremium rethrows non-cancel errors', async () => {
  mockP.getOfferings.mockResolvedValue(offering);
  mockP.purchasePackage.mockRejectedValue({ userCancelled: false, message: 'boom' });
  await expect(purchasePremium()).rejects.toMatchObject({ message: 'boom' });
});

test('restorePurchases true when entitlement restored', async () => {
  mockP.restorePurchases.mockResolvedValue(entitled);
  expect(await restorePurchases()).toBe(true);
});

test('restorePurchases false when nothing to restore', async () => {
  mockP.restorePurchases.mockResolvedValue(notEntitled);
  expect(await restorePurchases()).toBe(false);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx jest src/lib/purchases.test.ts`
Expected: FAIL — cannot find module `./purchases`.

- [ ] **Step 3: Implement**

Create `src/lib/purchases.ts`:
```ts
import Purchases, { type PurchasesPackage } from 'react-native-purchases';

const ENTITLEMENT_ID = 'premium';

export function initPurchases(apiKey: string): void {
  Purchases.configure({ apiKey });
}

async function getPremiumPackage(): Promise<PurchasesPackage | null> {
  const offerings = await Purchases.getOfferings();
  return offerings.current?.availablePackages[0] ?? null;
}

export async function getIsPremium(): Promise<boolean> {
  const info = await Purchases.getCustomerInfo();
  return info.entitlements.active[ENTITLEMENT_ID] != null;
}

export async function getPremiumPriceString(): Promise<string | null> {
  const pkg = await getPremiumPackage();
  return pkg?.product.priceString ?? null;
}

export async function purchasePremium(): Promise<boolean> {
  const pkg = await getPremiumPackage();
  if (!pkg) throw new Error('No premium package available');
  try {
    const { customerInfo } = await Purchases.purchasePackage(pkg);
    return customerInfo.entitlements.active[ENTITLEMENT_ID] != null;
  } catch (e: any) {
    if (e?.userCancelled) return false;
    throw e;
  }
}

export async function restorePurchases(): Promise<boolean> {
  const info = await Purchases.restorePurchases();
  return info.entitlements.active[ENTITLEMENT_ID] != null;
}
```

- [ ] **Step 4: Run to verify it passes**

Run: `npx jest src/lib/purchases.test.ts`
Expected: PASS, 10 tests.

- [ ] **Step 5: Commit**

```bash
git add src/lib/purchases.ts src/lib/purchases.test.ts
git commit -m "feat: add RevenueCat purchases wrapper

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 3 — Context, state hook, and app wiring

### Task 5: Premium context

**Files:**
- Create: `src/lib/premiumContext.tsx`

- [ ] **Step 1: Implement (mirrors `src/lib/settingsContext.tsx`)**

Create `src/lib/premiumContext.tsx`:
```tsx
import { createContext, useContext } from 'react';

export type PremiumContextValue = {
  isPremium: boolean;
  loading: boolean;
  priceString: string | null;
  purchase: () => Promise<boolean>;
  restore: () => Promise<boolean>;
};

export const PremiumContext = createContext<PremiumContextValue>({
  isPremium: false,
  loading: true,
  priceString: null,
  purchase: async () => false,
  restore: async () => false,
});

export function usePremium() {
  return useContext(PremiumContext);
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/premiumContext.tsx
git commit -m "feat: add premium context

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 6: Premium state hook

**Files:**
- Create: `src/hooks/usePremiumState.ts`

- [ ] **Step 1: Implement**

Create `src/hooks/usePremiumState.ts`:
```ts
import { useEffect, useState, useCallback } from 'react';
import Constants from 'expo-constants';
import {
  initPurchases,
  getIsPremium,
  purchasePremium,
  restorePurchases,
  getPremiumPriceString,
} from '../lib/purchases';
import type { PremiumContextValue } from '../lib/premiumContext';

export function usePremiumState(): PremiumContextValue {
  const [isPremium, setIsPremium] = useState(false);
  const [loading, setLoading] = useState(true);
  const [priceString, setPriceString] = useState<string | null>(null);

  useEffect(() => {
    const apiKey = Constants.expoConfig?.extra?.revenueCatIosKey as string | undefined;
    let cancelled = false;
    (async () => {
      try {
        if (apiKey) initPurchases(apiKey);
        const [premium, price] = await Promise.all([
          getIsPremium(),
          getPremiumPriceString(),
        ]);
        if (!cancelled) {
          setIsPremium(premium);
          setPriceString(price);
        }
      } catch {
        // On any failure, remain non-premium; the user can retry via the paywall.
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const purchase = useCallback(async () => {
    const ok = await purchasePremium();
    if (ok) setIsPremium(true);
    return ok;
  }, []);

  const restore = useCallback(async () => {
    const ok = await restorePurchases();
    if (ok) setIsPremium(true);
    return ok;
  }, []);

  return { isPremium, loading, priceString, purchase, restore };
}
```

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/hooks/usePremiumState.ts
git commit -m "feat: add usePremiumState hook

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 7: Wire provider into `App.tsx`

**Files:**
- Modify: `App.tsx`

- [ ] **Step 1: Add imports**

After the existing `import { SettingsContext } from './src/lib/settingsContext';` line (App.tsx:26), add:
```tsx
import { PremiumContext } from './src/lib/premiumContext';
import { usePremiumState } from './src/hooks/usePremiumState';
```

- [ ] **Step 2: Call the hook inside `App()`**

After the `const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);` line (App.tsx:50), add:
```tsx
  const premium = usePremiumState();
```

- [ ] **Step 3: Wrap the tree with the provider**

In the returned JSX, wrap `ThemeContext.Provider` with `PremiumContext.Provider`. The provider nesting becomes:
```tsx
    <GestureHandlerRootView style={{ flex: 1 }}>
    <SettingsContext.Provider value={{ settings, updateSettings }}>
    <PremiumContext.Provider value={premium}>
    <ThemeContext.Provider value={{ T, themeKey, setTheme }}>
```
and the matching closing tags become:
```tsx
    </ThemeContext.Provider>
    </PremiumContext.Provider>
    </SettingsContext.Provider>
    </GestureHandlerRootView>
```

- [ ] **Step 4: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 5: Commit**

```bash
git add App.tsx
git commit -m "feat: provide premium context app-wide

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 8: Add the RevenueCat key to `app.json`

**Files:**
- Modify: `app.json`

- [ ] **Step 1: Add the key under `expo.extra`**

In `app.json`, the `expo.extra` object currently contains only `eas`. Add `revenueCatIosKey` alongside it (replace `appl_REPLACE_WITH_REAL_KEY` with the real public key from the RevenueCat dashboard):
```json
    "extra": {
      "eas": {
        "projectId": "b088a50f-b0f1-4ed6-810b-092b1cb02360"
      },
      "revenueCatIosKey": "appl_REPLACE_WITH_REAL_KEY"
    }
```

- [ ] **Step 2: Commit**

```bash
git add app.json
git commit -m "chore: add RevenueCat iOS key to app config

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Phase 4 — Paywall and gate enforcement

### Task 9: Paywall modal

**Files:**
- Create: `src/components/PaywallModal.tsx`

- [ ] **Step 1: Implement**

Create `src/components/PaywallModal.tsx`. It uses the theme tokens and `usePremium()`. On a successful purchase OR restore it calls `onUnlocked()`; errors surface via `Alert`.
```tsx
import { useState } from 'react';
import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, buttonShadow, type ThemeTokens } from '../theme';
import { usePremium } from '../lib/premiumContext';

export default function PaywallModal({
  visible,
  onClose,
  onUnlocked,
}: {
  visible: boolean;
  onClose: () => void;
  onUnlocked: () => void;
}) {
  const { T } = useTheme();
  const styles = makeStyles(T);
  const { priceString, purchase, restore } = usePremium();
  const [busy, setBusy] = useState(false);

  const run = async (fn: () => Promise<boolean>, nothingMsg?: string) => {
    setBusy(true);
    try {
      const ok = await fn();
      if (ok) onUnlocked();
      else if (nothingMsg) Alert.alert('Restore', nothingMsg);
    } catch (e: any) {
      Alert.alert('Something went wrong', e?.message ?? 'Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <Text style={styles.title}>Unlock Unlimited Sessions</Text>
          <Text style={styles.body}>
            Free includes up to 5 sessions. Unlock once to create as many as you like.
          </Text>

          <Pressable
            style={[styles.primaryBtn, buttonShadow(T), busy && styles.disabled]}
            disabled={busy}
            onPress={() => run(purchase)}
          >
            <Text style={styles.primaryLabel}>
              {priceString ? `Unlock — ${priceString}` : 'Unlock'}
            </Text>
          </Pressable>

          <Pressable
            style={[styles.secondaryBtn, busy && styles.disabled]}
            disabled={busy}
            onPress={() => run(restore, 'No previous purchase found.')}
          >
            <Text style={styles.secondaryLabel}>Restore Purchases</Text>
          </Pressable>

          <Pressable style={styles.closeBtn} disabled={busy} onPress={onClose}>
            <Text style={styles.closeLabel}>Not now</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
      justifyContent: 'center',
      padding: 24,
    },
    card: { backgroundColor: T.card, borderRadius: 20, padding: 24 },
    title: { color: T.text, fontFamily: 'Inter_800ExtraBold', fontSize: 22, marginBottom: 8 },
    body: { color: T.subText, fontFamily: 'Inter_600SemiBold', fontSize: 15, marginBottom: 20 },
    primaryBtn: {
      backgroundColor: T.accent,
      borderRadius: 14,
      paddingVertical: 16,
      alignItems: 'center',
    },
    primaryLabel: { color: T.btnGlyph, fontFamily: 'Inter_800ExtraBold', fontSize: 16 },
    secondaryBtn: { paddingVertical: 14, alignItems: 'center', marginTop: 8 },
    secondaryLabel: { color: T.text, fontFamily: 'Inter_700Bold', fontSize: 15 },
    closeBtn: { paddingVertical: 10, alignItems: 'center' },
    closeLabel: { color: T.subText, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
    disabled: { opacity: 0.5 },
  });
}
```

> **Token note:** `T.card`, `T.text`, `T.subText`, `T.accent`, `T.btnGlyph` are all confirmed present on `ThemeTokens` in `src/theme.ts`, and `buttonShadow(T)` is a function returning a `ViewStyle`. Do not invent new tokens.

- [ ] **Step 2: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/PaywallModal.tsx
git commit -m "feat: add paywall modal

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 10: Enforce the gate in `SessionsListScreen.tsx`

**Files:**
- Modify: `src/screens/SessionsListScreen.tsx`

- [ ] **Step 1: Add imports**

After `import SessionCard from '../components/SessionCard';` (line 18), add:
```tsx
import PaywallModal from '../components/PaywallModal';
import { usePremium } from '../lib/premiumContext';
import { canCreateSession } from '../lib/sessionLimit';
```

- [ ] **Step 2: Add premium + pending state**

Immediately after `const [selectedId, setSelectedId] = useState<string | null>(null);` (line 25), add:
```tsx
  const { isPremium } = usePremium();
  const [pending, setPending] =
    useState<{ kind: 'create' } | { kind: 'duplicate'; session: Session } | null>(null);
```

- [ ] **Step 3: Add gated request helpers**

Immediately after the existing `handleDuplicate` function (ends line 37), add:
```tsx
  const requestCreate = () => {
    if (canCreateSession(sessions.length, isPremium)) onNavigate({ name: 'EditSession' });
    else setPending({ kind: 'create' });
  };

  const requestDuplicate = (session: Session) => {
    if (canCreateSession(sessions.length, isPremium)) handleDuplicate(session);
    else setPending({ kind: 'duplicate', session });
  };

  const runPending = () => {
    const p = pending;
    setPending(null);
    if (p?.kind === 'create') onNavigate({ name: 'EditSession' });
    else if (p?.kind === 'duplicate') handleDuplicate(p.session);
  };
```

- [ ] **Step 4: Route the + button through the gate**

Change the add button's handler (line 71) from:
```tsx
          <Pressable style={styles.addBtn} onPress={() => onNavigate({ name: 'EditSession' })}>
```
to:
```tsx
          <Pressable style={styles.addBtn} onPress={requestCreate}>
```

- [ ] **Step 5: Route duplicate through the gate**

Change the `onDuplicate` prop on `SessionSwipeRow` (line 97) from:
```tsx
            onDuplicate={() => handleDuplicate(session)}
```
to:
```tsx
            onDuplicate={() => requestDuplicate(session)}
```

- [ ] **Step 6: Render the paywall**

Immediately before the closing `</LinearGradient>` (line 105), add:
```tsx
      <PaywallModal
        visible={pending !== null}
        onClose={() => setPending(null)}
        onUnlocked={runPending}
      />
```

- [ ] **Step 7: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 8: Commit**

```bash
git add src/screens/SessionsListScreen.tsx
git commit -m "feat: gate session creation behind premium

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

### Task 11: Manual verification (dev build)

Requires the App Store Connect product, RevenueCat setup, and a StoreKit config file / Sandbox tester from Prerequisites.

- [ ] **Step 1: Native build**

Run:
```bash
npx expo prebuild --clean
npx expo run:ios
```
Expected: app launches in a dev build (NOT Expo Go — RevenueCat needs native).

- [ ] **Step 2: Verify the gate as a free user**

With 5 sessions present (3 defaults + 2 created), tap **+**. Expected: paywall appears; no navigation to the editor.

- [ ] **Step 3: Verify duplicate is gated**

At 5 sessions, swipe a card and tap duplicate. Expected: paywall appears; no copy is created.

- [ ] **Step 4: Verify purchase unblocks**

In the paywall tap **Unlock**, complete the sandbox/StoreKit purchase. Expected: paywall closes, the pending action proceeds (editor opens / copy is created), and subsequent + / duplicate no longer show the paywall.

- [ ] **Step 5: Verify restore**

Delete and reinstall the app. Trigger the paywall, tap **Restore Purchases**. Expected: premium is restored, no further paywall.

---

## Phase 5 — Settings restore entry (review safety net)

### Task 12: "Restore Purchases" row in Settings

**Files:**
- Modify: `src/screens/SettingsScreen.tsx`

- [ ] **Step 1: Inspect the screen's row pattern**

Open `src/screens/SettingsScreen.tsx`. Identify the row component used for tappable rows (a `Pressable` / row helper around line 38–104) and the section layout so the new row matches existing styling.

- [ ] **Step 2: Add imports**

At the top of `src/screens/SettingsScreen.tsx`, add:
```tsx
import { Alert } from 'react-native';
import { usePremium } from '../lib/premiumContext';
```
(If `Alert` is already imported from `react-native`, add it to the existing import instead of duplicating.)

- [ ] **Step 3: Read premium in the component**

Inside the `SettingsScreen` component body, near the other hooks, add:
```tsx
  const { isPremium, restore } = usePremium();
```

- [ ] **Step 4: Add a restore handler**

Add this handler inside the component:
```tsx
  const onRestore = async () => {
    try {
      const ok = await restore();
      Alert.alert('Restore', ok ? 'Premium restored.' : 'No previous purchase found.');
    } catch (e: any) {
      Alert.alert('Restore failed', e?.message ?? 'Please try again.');
    }
  };
```

- [ ] **Step 5: Render a tappable row**

Add a tappable row in the settings list, following the screen's existing row markup. If the screen has a reusable tappable row helper, use it; otherwise add a `Pressable` styled like the existing rows:
```tsx
        <Pressable style={styles.row} onPress={onRestore}>
          <View style={styles.rowLabels}>
            <Text style={styles.rowLabel}>Restore Purchases</Text>
            <Text style={styles.rowSub}>
              {isPremium ? 'Premium active' : 'Recover a previous unlock'}
            </Text>
          </View>
        </Pressable>
```
> Match the actual style names in this file (`styles.row`, `styles.rowLabels`, `styles.rowLabel`, `styles.rowSub` are referenced elsewhere in the screen per grep). Adjust if the real names differ.

- [ ] **Step 6: Type-check**

Run: `npx tsc --noEmit`
Expected: no new errors.

- [ ] **Step 7: Manual check**

Reload the app, open Settings. Expected: a "Restore Purchases" row that runs restore and shows an alert with the result.

- [ ] **Step 8: Commit**

```bash
git add src/screens/SettingsScreen.tsx
git commit -m "feat: add restore purchases to settings

Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>"
```

---

## Final verification

- [ ] **Run the full test suite**

Run: `npx jest`
Expected: all tests pass (sessionLimit + purchases = 15 tests).

- [ ] **Type-check the whole project**

Run: `npx tsc --noEmit`
Expected: no new errors.

---

## Notes / decisions carried from the spec

- **Free limit = 5 total, defaults included.** A fresh free user can add 2 custom sessions; deleting defaults frees room.
- **Premium status is not cached locally** — RevenueCat is the source of truth on each launch. During the launch fetch (`loading`), the user is treated as non-premium but the paywall only appears on a creation attempt, avoiding flicker.
- **Only session creation/duplication is gated.** Editing existing sessions, starting workouts, themes, and audio remain free.
- **Out of scope (YAGNI):** subscriptions, Android, multiple tiers, promo codes, analytics, RevenueCatUI paywall templates.
