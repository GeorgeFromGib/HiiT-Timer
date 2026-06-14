# expo-in-app-purchases Implementation Design

**Date:** 2026-06-14
**Branch:** paywall-2
**Scope:** Replace mock `purchases.ts` with real `expo-in-app-purchases` calls, keeping all existing interfaces unchanged.

---

## Goal

Swap the mock body of `src/lib/purchases.ts` for a real one-time (non-consumable) purchase flow using `expo-in-app-purchases`. No other file changes.

The 30-day local trial (tracked in `trial_v1.json`) is retained. Trial expiry is not enforced during TestFlight — this runs in production only.

---

## Architecture

Only `src/lib/purchases.ts` changes. Everything above it — `premiumContext.ts`, `usePremiumState.ts`, `usePremium()`, all screens, `PaywallModal` — is untouched.

```
App.tsx
  └── usePremiumState()            ← no change
        └── purchases.ts           ← ONLY file that changes
              ├── expo-in-app-purchases  (new dependency)
              ├── trial_v1.json    (existing — 30-day trial state)
              └── premium_v1.json  (new — persists isPremium across restarts)
```

A `PRODUCT_ID` placeholder constant at the top of the file must be replaced with the real App Store product ID before production release.

---

## Function-by-function

| Function | New behaviour |
|---|---|
| `initPurchases()` | `connectAsync()` to the store. Load `premium_v1.json` → `_isPremium`. Load `trial_v1.json` as before. Register purchase listener (required before purchases can complete). |
| `purchasePremium()` | `purchaseItemAsync(PRODUCT_ID)`. Listener resolves a one-shot Promise: `IAPResponseCode.OK` → persist `_isPremium = true` to `premium_v1.json`, return `true`. User cancel → return `false`. |
| `restorePurchases()` | `getPurchaseHistoryAsync()`. If any entry matches `PRODUCT_ID`, set `_isPremium = true`, persist, return `true`. Otherwise return `false`. |
| `getIsPremium()` | Reads `_isPremium` in-memory (loaded at init). Signature unchanged. |
| `getHasAccess()` | Unchanged — `_isPremium \|\| isWithinTrial()`. |
| `getTrialDaysRemaining()` | Unchanged. |
| `setMockPremium()` | Unchanged — dev/TestFlight helper. |
| `expireTrialForTesting()` | Unchanged. |
| `resetTrialForTesting()` | Unchanged. |

---

## Error handling & edge cases

| Scenario | Behaviour |
|---|---|
| User cancels purchase | Listener returns `USER_CANCELLED` — `purchasePremium()` returns `false`, no state change. |
| Store unavailable at init | `connectAsync()` error caught silently. Falls back to disk state. Trial logic still works. |
| `premium_v1.json` missing or corrupt | Treated as not premium — same as first launch. |
| `finishTransactionAsync` fails | Purchase still persisted. `finishTransaction` is best-effort — never blocks the user on an acknowledged receipt. |
| Restore finds no matching purchase | Returns `false`, no state change. |
| Duplicate purchase event | Guarded by `responseCode === OK` check — idempotent. |

---

## New dependency

```
expo-in-app-purchases
```

Install via: `npx expo install expo-in-app-purchases`

---

## Out of scope

- No changes to `premiumContext.ts`, `usePremiumState.ts`, `PaywallModal.tsx`, or any screen.
- No subscription products.
- No server-side receipt validation.
- No Android (placeholder only; Android IAP uses a different product ID namespace).
