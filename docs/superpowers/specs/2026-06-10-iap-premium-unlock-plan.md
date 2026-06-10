# IAP — Premium Unlock (Unlimited Sessions)

**Date:** 2026-06-10
**Status:** Approved design → implementation plan
**Author:** george (with Claude)

## Summary

Add a one-time, non-consumable in-app purchase that unlocks **unlimited saved
sessions**. Free users may keep up to `FREE_SESSION_LIMIT = 5` total sessions
(the 3 bundled defaults count toward this). Attempting to create or duplicate a
6th session as a free user opens a paywall offering the unlock and a "Restore
Purchases" action.

### Decisions (locked)

| Decision | Choice |
|---|---|
| Monetization model | One-time unlock (non-consumable IAP) |
| Platforms | iOS only |
| Gated feature | Unlimited sessions |
| Free limit | 5 total sessions (defaults included) |
| Store layer | RevenueCat (`react-native-purchases`) |

### Why RevenueCat

- No backend in this app (data is local JSON). RevenueCat provides server-side
  receipt validation for free, which Apple effectively expects for IAPs.
- "Restore Purchases" is an Apple review requirement for non-consumables;
  RevenueCat makes it one correct SDK call.
- Free until ~$2.5k/mo revenue; purchases live in App Store Connect regardless,
  so it's reversible later.

## Architecture

New code follows the existing `src/lib/*` + context pattern (mirrors
`SettingsContext`/`ThemeContext` in `App.tsx`).

| Unit | Responsibility | Depends on |
|---|---|---|
| `src/lib/purchases.ts` | **Only** file importing `react-native-purchases`. Exports `initPurchases()`, `purchasePremium()`, `restorePurchases()`, `getIsPremium()`. | RevenueCat SDK |
| `src/lib/sessionLimit.ts` | Pure logic. `FREE_SESSION_LIMIT = 5`; `canCreateSession(count, isPremium): boolean`. No RN/SDK imports → trivially unit-testable. | nothing |
| `src/lib/premiumContext.ts` | `PremiumContext` + `usePremium()` (mirrors `settingsContext.ts`). | React |
| `src/hooks/usePremiumState.ts` | Owns premium state: init on mount, exposes `{ isPremium, loading, purchase, restore }`. | purchases.ts |
| `src/components/PaywallModal.tsx` | Themed modal: pitch copy, price, "Unlock" + "Restore Purchases" + close. | usePremium, theme |

`App.tsx` wraps the tree in `PremiumContext.Provider` and calls `initPurchases()`
once on mount (alongside the existing `loadSettings()` effect).

### Enforcement points (the gate)

Both live in `src/screens/SessionsListScreen.tsx`:

1. **+ add button** — `onPress` at line ~71. Before
   `onNavigate({ name: 'EditSession' })`, check
   `canCreateSession(sessions.length, isPremium)`. If false, open paywall instead.
2. **Swipe-to-duplicate** — `handleDuplicate` at line ~31. Same check before
   creating the copy.

Editing an existing session (the `+` button passes no session; edit passes one)
is **not** gated — only creation/duplication is.

### Data flow

```
App mount
  └─ initPurchases() → RevenueCat configure() → fetch entitlements
       └─ usePremiumState sets isPremium

User taps + / duplicate
  └─ canCreateSession(count, isPremium)?
        ├─ true  → proceed (navigate / create copy)
        └─ false → open PaywallModal
                     ├─ Unlock  → purchasePremium() → on success setIsPremium(true), close, proceed
                     └─ Restore → restorePremium()  → if entitled setIsPremium(true), close
```

Premium status is **not** persisted locally — it is sourced from RevenueCat on
each launch (the entitlement is the source of truth). During the brief launch
fetch, `loading` is true; we treat unknown as non-premium but do not show the
paywall until a creation is attempted, so there is no flash.

## Store / account setup (manual, outside code)

These are prerequisites the developer performs; the plan notes them but they are
not code steps:

1. App Store Connect → create non-consumable IAP, product ID
   `com.georgefromgib.hiittimer.premium_unlock`. Set price tier. Add localized
   display name/description. Submit for review with the build.
2. RevenueCat dashboard → create project, add the App Store app, paste the
   StoreKit shared secret, create entitlement `premium`, attach the product to a
   default offering.
3. Create a Sandbox tester in App Store Connect for purchase testing.
4. Add a local **StoreKit configuration file** in Xcode for simulator testing
   without sandbox.

The RevenueCat **public SDK key** goes in the app via `app.json` `extra` (read
through `expo-constants`) — not hardcoded, not secret-sensitive (it's a
publishable key).

## Dependencies & native build

- `npx expo install react-native-purchases`
- Add its Expo config plugin to `app.json` `plugins` if required by the installed
  version; then `npx expo prebuild` is implied by a fresh dev build.
- Requires a new **development build** (already the team's workflow). Will **not**
  work in Expo Go.

## Implementation phases

Each phase ends with a verification step. Tests are written before/with the code
they cover where practical (pure logic is TDD-friendly; native SDK is mocked).

### Phase 0 — Test harness (no test runner exists yet)

`package.json` currently has no test script. Add one:

- `npx expo install -- --save-dev jest-expo jest @types/jest`
- Add `@testing-library/react-native` for hook/component tests.
- `package.json`: `"scripts": { "test": "jest" }` and a `jest` preset
  `"jest-expo"`.
- **Verify:** `npm test` runs and reports "no tests found" (or a trivial
  sanity test passes).

### Phase 1 — Pure session-limit logic (TDD)

- Write `src/lib/sessionLimit.test.ts` first:
  - `canCreateSession(4, false) === true`
  - `canCreateSession(5, false) === false`
  - `canCreateSession(5, true) === true` (premium bypasses)
  - `canCreateSession(999, true) === true`
- Implement `src/lib/sessionLimit.ts` to pass.
- **Verify:** `npm test` green.

### Phase 2 — Purchases module + premium state

- `src/lib/purchases.ts` wrapping RevenueCat: `initPurchases(apiKey)`,
  `getIsPremium()`, `purchasePremium()`, `restorePurchases()`. Map the `premium`
  entitlement → boolean.
- `src/lib/premiumContext.ts` (`PremiumContext`, `usePremium`).
- `src/hooks/usePremiumState.ts`: init on mount, expose
  `{ isPremium, loading, purchase, restore }`.
- Tests with `react-native-purchases` mocked
  (`jest.mock('react-native-purchases')`):
  - init sets `isPremium` from a mocked entitled customerInfo
  - `purchase()` flips `isPremium` true on a mocked successful purchase
  - `purchase()` leaves `isPremium` false and does not throw on user-cancel
  - `restore()` flips `isPremium` true when the mock reports entitlement
- **Verify:** `npm test` green.

### Phase 3 — Wire into App.tsx

- Wrap tree in `PremiumContext.Provider` using `usePremiumState()`.
- Call `initPurchases()` with the key from `expo-constants` in the mount effect.
- **Verify:** app builds and launches on a dev build; no runtime error;
  `isPremium` resolves (log it once during dev).

### Phase 4 — Paywall + gate enforcement

- `src/components/PaywallModal.tsx`, themed via `useTheme()`, matching existing
  modal/button styles (reuse `GhostBtn`/`buttonShadow` conventions). Buttons:
  Unlock (calls `purchase`), Restore (calls `restore`), Close.
- In `SessionsListScreen.tsx`: consume `usePremium()`; add local
  `paywallOpen` state; guard the **+ button** and **handleDuplicate** with
  `canCreateSession(sessions.length, isPremium)`.
- On successful purchase/restore from within the paywall triggered by the +
  button, proceed to `EditSession` automatically.
- **Verify (manual, dev build + StoreKit config / Sandbox):**
  1. Free state, 5 sessions present → tap + → paywall appears (no navigation).
  2. Duplicate at 5 sessions → paywall appears (no copy created).
  3. Complete sandbox purchase → paywall closes, creation proceeds, further
     creates/duplicates are unblocked.
  4. Delete app, reinstall, open paywall → Restore Purchases → premium restored.
  5. Premium user → + and duplicate work with no paywall at any count.

### Phase 5 — Settings entry for Restore (review requirement safety net)

- Add a "Restore Purchases" row to `SettingsScreen.tsx` calling
  `usePremium().restore()`, with success/no-purchase feedback via existing
  `alerts` helpers. Ensures restore is reachable even when not at the limit
  (Apple expects an always-available restore path).
- **Verify (manual):** Settings → Restore Purchases works on a device with a
  prior purchase; shows a "nothing to restore" message otherwise.

## Testing strategy summary

| Layer | How |
|---|---|
| `sessionLimit.ts` | Jest unit tests (pure). |
| `purchases.ts` / `usePremiumState` | Jest with `react-native-purchases` mocked. |
| Paywall + gate wiring | Manual on dev build (StoreKit config file in sim; Sandbox tester on device). Native StoreKit cannot be unit-tested. |

## Out of scope (YAGNI)

- Subscriptions, multiple tiers, Android, promo codes, analytics.
- Persisting/caching premium status locally (RevenueCat is the source of truth;
  revisit only if launch-time flicker proves to be a problem).
- Gating any feature other than session count.

## Open items for the developer (non-blocking on code)

- Final price tier.
- IAP display name / description copy.
- Paywall pitch copy + price formatting (use RevenueCat's localized price string).
