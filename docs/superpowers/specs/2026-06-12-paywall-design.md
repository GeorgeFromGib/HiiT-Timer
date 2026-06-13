  # Paywall — 30-Day Trial Monetisation

**Date:** 2026-06-12
**Status:** Approved design
**Author:** george (with Claude)

## Summary

Replace the existing 5-session creation cap with a **30-day free trial** that gives full, unrestricted access to all features. When the trial expires, all primary actions (start workout, create, edit, duplicate sessions) are blocked behind a `PaywallModal` until the user purchases. The purchase layer remains the existing mock (`purchases.ts`); the only real addition is trial-start persistence and the paywall UI.

This supersedes the session-limit gate from `2026-06-10-premium-mock-interface-design.md`. `sessionLimit.ts` is deleted.

### Decisions (locked)

| Decision | Choice |
|---|---|
| Trial length | 30 days from first app launch |
| Trial persistence | `trial_v1.json` via `expo-file-system` (same pattern as settings/sessions) |
| Gated features | Start workout, create session, edit session, duplicate session |
| Free (never gated) | Browsing the sessions list |
| Access predicate | `hasAccess = isPremium \|\| isWithinTrial()` |
| Purchase layer | Existing mock (`purchases.ts`) — RevenueCat deferred |

## Files

| File | Change | Responsibility |
|---|---|---|
| `src/lib/purchases.ts` | Modify | Add trial persistence, `getHasAccess()`, `getTrialDaysRemaining()`, `resetTrialForTesting()` |
| `src/lib/premiumContext.ts` | Modify | Add `hasAccess`, `trialDaysRemaining`, `resetTrialForTesting` to `PremiumContextValue` |
| `src/hooks/usePremiumState.ts` | Modify | Initialise and expose trial state alongside existing premium state |
| `src/components/PaywallModal.tsx` | **Create** | Themed modal: trial-ended copy, Purchase + dismiss buttons |
| `src/screens/SessionsListScreen.tsx` | Modify | Swap `canCreateSession` guards → `hasAccess`; show `PaywallModal` |
| `src/screens/SettingsScreen.tsx` | Modify | Dev section: trial days remaining label + "Expire trial" button |
| `src/lib/sessionLimit.ts` | **Delete** | Replaced by `hasAccess` predicate in `purchases.ts` |

## Architecture

### `purchases.ts` additions

```
trial_v1.json  →  { startedAt: ISO string }

initPurchases()          → (existing) + load/write trial start date on first run
getHasAccess()           → _isPremium || isWithinTrial()
getTrialDaysRemaining()  → max(0, 30 - daysSinceStart)
resetTrialForTesting()   → write startedAt = now - 31 days  (dev only)

isWithinTrial()          → private helper, reads _trialStartedAt module var
```

Module-level `_trialStartedAt` is set by `initPurchases()` from disk. Subsequent calls to `getHasAccess()` / `getTrialDaysRemaining()` read the cached value — no async needed after init.

### `premiumContext.ts`

```ts
type PremiumContextValue = {
  isPremium: boolean;
  hasAccess: boolean;                          // ← new
  trialDaysRemaining: number;                  // ← new
  loading: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  setMockPremium: (val: boolean) => void;
  expireTrialForTesting: () => Promise<void>;  // ← new (dev only)
  resetTrialForTesting: () => Promise<void>;   // ← new (dev only)
};
```

### `usePremiumState.ts`

- After `initPurchases()` resolves, derive initial `hasAccess` and `trialDaysRemaining` from the now-initialised module state.
- `refreshState()` helper re-reads both after any mutation (purchase, restore, setMockPremium, resetTrialForTesting).

### `PaywallModal.tsx`

- `Modal` (transparent, fade) centred on screen.
- Themed card using `T` tokens (matches existing modal conventions).
- Heading: **"Trial Ended"**
- Body: *"Your 30-day free trial has ended. Purchase to keep using all features."*
- Primary button: **"Purchase"** → `purchase()` → `onDismiss()`.
- Secondary link: **"Not now"** → `onDismiss()`.
- Disabled state on buttons while `loading`.

### Gate enforcement (`SessionsListScreen`)

Three call sites, all identical guard pattern:

```ts
if (!hasAccess) { setShowPaywall(true); return; }
```

1. **+ button** (`onPress` in `ScreenHeader` right prop)
2. **`handleDuplicate`**
3. **`onStart`** (passed to `SessionCard`)

`<PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />` added to the JSX root.

Remove `import { canCreateSession } from '../lib/sessionLimit'`.

### Dev section (`SettingsScreen`)

Two trial controls are exposed in dev mode:

- **Expire trial** — sets `_trialStartedAt` to 31 days ago, simulating a lapsed trial. `hasAccess` immediately becomes `false`.
- **Reset trial** — sets `_trialStartedAt` to now, restarting the full 30-day window. `hasAccess` immediately becomes `true`.

Both require corresponding exports from `purchases.ts`:

```ts
// purchases.ts
export async function expireTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date(Date.now() - 31 * 24 * 60 * 60 * 1000).toISOString();
  await saveTrialStart(_trialStartedAt);
}

export async function resetTrialForTesting(): Promise<void> {
  _trialStartedAt = new Date().toISOString();
  await saveTrialStart(_trialStartedAt);
}
```

Both are surfaced on `PremiumContextValue` and `usePremiumState` (call `refreshState()` after each).

```tsx
{__DEV__ && (
  <SettingsSection title="Developer">
    <SettingsRow
      label="Mock Premium"
      sub="Simulate premium unlock"
      right={<SettingsToggle value={isPremium} onChange={setMockPremium} />}
    />
    <SettingsRow
      label="Trial days remaining"
      right={<Text style={styles.versionText}>{trialDaysRemaining}</Text>}
    />
    <SettingsRow
      label="Expire trial"
      sub="Set trial start to 31 days ago"
      right={<Pressable onPress={expireTrialForTesting}><Text style={styles.versionText}>Expire</Text></Pressable>}
    />
    <SettingsRow
      label="Reset trial"
      sub="Restart the 30-day trial window"
      right={<Pressable onPress={resetTrialForTesting}><Text style={styles.versionText}>Reset</Text></Pressable>}
      last
    />
  </SettingsSection>
)}
```

## Data flow

```
App mount
  └─ initPurchases()
       ├─ load trial_v1.json → _trialStartedAt set (or written fresh)
       └─ usePremiumState derives hasAccess, trialDaysRemaining

User taps Start / + / Edit / Duplicate
  └─ hasAccess?
        ├─ true  → proceed normally
        └─ false → setShowPaywall(true) → PaywallModal appears
                     ├─ Purchase → purchasePremium() → hasAccess=true → dismiss → action unblocked
                     └─ Not now  → dismiss (action not retried)

Dev: "Expire trial" tapped
  └─ expireTrialForTesting() → _trialStartedAt = 31 days ago → refreshState()
       └─ hasAccess=false, trialDaysRemaining=0 → next action shows paywall

Dev: "Reset trial" tapped
  └─ resetTrialForTesting() → _trialStartedAt = now → refreshState()
       └─ hasAccess=true, trialDaysRemaining=30 → paywall no longer shown

Dev: "Mock Premium" toggled on
  └─ setMockPremium(true) → _isPremium=true → hasAccess=true (trial irrelevant)
```

## Implementation phases

### Phase 1 — Trial persistence in `purchases.ts`

- Add `trial_v1.json` read/write helpers.
- Update `initPurchases()` to load/write `_trialStartedAt`.
- Add `getHasAccess()`, `getTrialDaysRemaining()`, `resetTrialForTesting()`.
- **Verify:** on first run, `trial_v1.json` exists in document directory; `getHasAccess()` returns `true`; `getTrialDaysRemaining()` returns 30.

### Phase 2 — Context and hook

- Update `premiumContext.ts` type.
- Update `usePremiumState.ts` to expose `hasAccess`, `trialDaysRemaining`, `resetTrialForTesting`.
- **Verify:** no TypeScript errors; existing app behaviour unchanged.

### Phase 3 — `PaywallModal`

- Create `src/components/PaywallModal.tsx`.
- **Verify:** render in isolation via dev toggle: expire trial, tap +, modal appears with correct copy; Purchase button calls mock and dismisses.

### Phase 4 — Gate wiring in `SessionsListScreen`

- Replace `canCreateSession` guards with `hasAccess` checks.
- Add `PaywallModal` to JSX.
- Gate `onStart` in addition to create/duplicate.
- Remove `sessionLimit` import.
- **Verify (manual):**
  1. Fresh install → trial active → all actions work, no paywall.
  2. Dev: expire trial → tap Start → paywall appears, action does not proceed.
  3. Dev: expire trial → tap + → paywall appears.
  4. Dev: expire trial → swipe duplicate → paywall appears.
  5. In paywall: tap Purchase → modal closes → action now unblocked for rest of session.
  6. Dev: Mock Premium on → no paywall regardless of trial state.
  7. Dev: reset trial → trialDaysRemaining returns to 30, paywall no longer shown.

### Phase 5 — Dev section in `SettingsScreen`

- Add trial days remaining, expire trial, and reset trial rows to `__DEV__` section.
- Delete `src/lib/sessionLimit.ts`.
- **Verify:** days remaining shows correct value; expire trial sets it to 0 and subsequent actions show paywall; reset trial restores it to 30 and clears the paywall.

## Testing strategy

| Layer | How |
|---|---|
| `purchases.ts` trial logic | Manual via dev toggle (no test runner configured) |
| `PaywallModal` | Manual on dev build |
| Gate wiring | Manual on dev build (Phase 4 checklist above) |

## Known limitations

- **Trial resets on reinstall.** `trial_v1.json` lives in the app's document directory, which iOS wipes on uninstall. A fresh install starts a new 30-day trial. This is acceptable while the purchase layer is a mock — RevenueCat tracks trial state server-side and will fix this when integrated.

## Out of scope

- RevenueCat / real IAP integration (deferred).
- Persisting `isPremium` across app restarts (mock resets on cold launch — intentional).
- Blocking the sessions list view (browsing is always free).
- Android.
- Subscription model, free tier with feature restrictions, analytics.
