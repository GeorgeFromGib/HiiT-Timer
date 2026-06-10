# Premium Mock Interface — Dev Toggle

**Date:** 2026-06-10
**Status:** Approved design
**Author:** george (with Claude)

## Summary

Implement the premium feature infrastructure (context, state hook, session-limit gate) backed by an in-memory mock instead of RevenueCat. A `__DEV__`-only toggle row in SettingsScreen lets the developer flip `isPremium` on/off manually. When RevenueCat is ready to integrate, only `purchases.ts` internals change — all consumers are already wired to the correct interface.

This is the implementation of Phases 1–3 from the IAP plan (`2026-06-10-iap-premium-unlock-plan.md`), plus the session-limit gate from Phase 4, with the PaywallModal deferred.

## Files

| File | Change | Responsibility |
|---|---|---|
| `src/lib/sessionLimit.ts` | Create | Pure logic: `FREE_SESSION_LIMIT = 5`, `canCreateSession(count, isPremium): boolean` |
| `src/lib/purchases.ts` | Create | Mock backing: in-memory flag, exports `initPurchases`, `getIsPremium`, `purchasePremium`, `restorePurchases`, `setMockPremium` |
| `src/lib/premiumContext.ts` | Create | `PremiumContext` + `usePremium()` — mirrors `settingsContext.tsx` |
| `src/hooks/usePremiumState.ts` | Create | Calls `initPurchases` on mount; exposes `{ isPremium, loading, purchase, restore }` |
| `App.tsx` | Modify | Wrap tree in `PremiumContext.Provider` using `usePremiumState()` |
| `src/screens/SessionsListScreen.tsx` | Modify | Consume `usePremium()`; guard `+` button and `handleDuplicate` with `canCreateSession` |
| `src/screens/SettingsScreen.tsx` | Modify | Add `__DEV__`-only "Mock Premium" toggle row |

## Architecture

### `purchases.ts` (mock)

```
let _isPremium = false;

initPurchases(apiKey?) → no-op, resolves immediately
getIsPremium()         → Promise<boolean> resolving _isPremium
purchasePremium()      → sets _isPremium = true, resolves true
restorePurchases()     → resolves _isPremium (no-op in mock)
setMockPremium(bool)   → sets _isPremium directly (DEV only)
```

Module-level state resets on app restart. This is intentional — the developer flips the toggle each session.

### `premiumContext.ts`

```ts
type PremiumContextValue = {
  isPremium: boolean;
  loading: boolean;
  purchase: () => Promise<void>;
  restore: () => Promise<void>;
  setMockPremium: (val: boolean) => void; // no-op in production
};
```

### `usePremiumState.ts`

- Calls `initPurchases()` + `getIsPremium()` on mount; sets `loading` true until resolved.
- `purchase()` calls `purchasePremium()`, updates `isPremium` on success.
- `restore()` calls `restorePurchases()`, updates `isPremium` if entitled.
- `setMockPremium(val)` calls `purchases.setMockPremium(val)` then sets local state. Always present in the returned value; a no-op in production (since `purchases.setMockPremium` is a no-op there too).

### Gate enforcement (`SessionsListScreen`)

Both creation paths check `canCreateSession(sessions.length, isPremium)` before proceeding:

1. **+ button** (`onPress` in `ScreenHeader` right prop) — if false, show an Alert: *"Premium required. Toggle in Settings (dev mode)."*
2. **`handleDuplicate`** — same check, same Alert.

The Alert is a placeholder. Phase 4 (PaywallModal) replaces it without touching the gate condition.

### Dev toggle (`SettingsScreen`)

Rendered only when `__DEV__`. Uses the existing `SSection`, `SRow`, and `Toggle` components already in SettingsScreen:

```tsx
{__DEV__ && (
  <SSection title="Developer">
    <SRow
      label="Mock Premium"
      sub="Simulate premium unlock (dev only)"
      right={<Toggle value={isPremium} onChange={setMockPremium} />}
      last
    />
  </SSection>
)}
```

`isPremium` and `setMockPremium` come from `usePremium()`.

## Data flow

```
App mount
  └─ usePremiumState: initPurchases() (no-op) → getIsPremium() → isPremium=false

Dev toggle in Settings
  └─ setMockPremium(true/false)
       └─ purchases._isPremium updated
       └─ usePremiumState re-syncs → isPremium updates in context

User taps + or duplicates
  └─ canCreateSession(sessions.length, isPremium)?
        ├─ true  → proceed
        └─ false → Alert (paywall placeholder)
```

## Out of scope

- PaywallModal UI (Phase 4 of IAP plan)
- RevenueCat SDK integration
- Persisting mock premium state across restarts
- Settings "Restore Purchases" row (Phase 5 of IAP plan)
