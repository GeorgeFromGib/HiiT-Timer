# expo-iap Implementation Design

**Date:** 2026-06-14
**Branch:** paywall-2
**Scope:** Replace mock `purchases.ts` with real `expo-iap` calls, keeping all existing interfaces unchanged. Add Restore purchases button to `PaywallModal` (required by App Store guidelines).

---

## Goal

Swap the mock body of `src/lib/purchases.ts` for a real one-time (non-consumable) purchase flow using `expo-iap`. No other file changes.

The 30-day local trial (tracked in `trial_v1.json`) is retained. Trial expiry is not enforced during TestFlight — this runs in production only.

---

## Architecture

Two files change: `src/lib/purchases.ts` (IAP logic) and `src/components/PaywallModal.tsx` (Restore purchases button). Everything above — `premiumContext.ts`, `usePremiumState.ts`, `usePremium()`, all screens — is untouched.

```
App.tsx
  └── usePremiumState()            ← no change
        └── purchases.ts           ← IAP logic (expo-iap)
              ├── expo-iap               (new dependency)
              ├── trial_v1.json    (existing — 30-day trial state)
              └── premium_v1.json  (new — persists isPremium across restarts)

PaywallModal.tsx                   ← adds Restore purchases button
  └── usePremium().restore()       ← already wired in context, no change needed
```

A `PRODUCT_ID` placeholder constant at the top of the file must be replaced with the real App Store product ID before production release.

---

## API reference

`expo-iap` exports the following functions used in this implementation:

| Function | Description |
|---|---|
| `initConnection()` | Connect to the store (StoreKit 2 on iOS). Returns `Promise<boolean>`. |
| `endConnection()` | Disconnect from the store. Call on unmount if needed. |
| `requestPurchase(args)` | Initiate a purchase. `args` shape: `{ sku: string }` on iOS. Returns `Promise<Purchase \| Purchase[] \| null>`. |
| `getAvailablePurchases()` | Fetch all non-consumed past purchases for the current Apple ID. Used for restore. |
| `finishTransaction({ purchase })` | Finish/acknowledge a transaction on iOS. Best-effort — call after persisting. |
| `purchaseUpdatedListener(fn)` | Event listener — fires on successful purchase. Returns an `EventSubscription`. |
| `purchaseErrorListener(fn)` | Event listener — fires on error or cancellation. |

Error codes live in the `ErrorCode` enum — notably `ErrorCode.UserCancelled`.

---

## Function-by-function

**Listener lifecycle:** `purchaseUpdatedListener` and `purchaseErrorListener` are registered once in `initPurchases()` and stored as module-level refs. `initPurchases()` is called once at app start from `App.tsx` — no guard against double-registration is needed.

**Purchase flow:** `purchasePremium()` calls `requestPurchase()` and wraps the two event listeners in a one-shot Promise. The `purchaseUpdatedListener` fires on success; `purchaseErrorListener` fires on cancel or error.

| Function | New behaviour |
|---|---|
| `initPurchases()` | `initConnection()` to the store. Load `premium_v1.json` → `_isPremium`. Load `trial_v1.json` as before. Register `purchaseUpdatedListener` and `purchaseErrorListener`. |
| `purchasePremium()` | `requestPurchase({ sku: PRODUCT_ID })`. One-shot Promise resolved by listeners: success → persist `_isPremium = true` to `premium_v1.json`, call `finishTransaction`, return `true`. `ErrorCode.UserCancelled` or any error → return `false`. |
| `restorePurchases()` | `getAvailablePurchases()`. If any entry's `productId` matches `PRODUCT_ID`, set `_isPremium = true`, persist, return `true`. Otherwise return `false`. |
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
| User cancels purchase | `purchaseErrorListener` fires with `ErrorCode.UserCancelled` — `purchasePremium()` returns `false`, no state change. |
| Store unavailable at init | `initConnection()` error caught silently. Falls back to disk state. Trial logic still works. |
| `premium_v1.json` missing or corrupt | Treated as not premium — same as first launch. |
| `finishTransaction` fails | Purchase still persisted. `finishTransaction` is best-effort — never blocks the user on an acknowledged receipt. |
| Restore finds no matching purchase | Returns `false`, no state change. |
| Duplicate purchase event | Guarded by checking `purchase.productId === PRODUCT_ID` before persisting — idempotent. |

---

## Success criteria (manual verification)

Since there are no automated tests configured, these are the manual checks that confirm the implementation is correct:

| # | Scenario | Expected result |
|---|---|---|
| 1 | Fresh install — no `premium_v1.json` | `hasAccess: true`, trial active, `trialDaysRemaining` ~30 (confirm via dev toggle in SettingsScreen) |
| 2 | Purchase flow completes → app restart | `isPremium: true` after restart — confirms `premium_v1.json` persistence |
| 3 | Restore on a device that previously purchased | `isPremium: true` after restore |
| 4 | User cancels purchase dialog | `isPremium` unchanged, no error thrown |
| 5 | Store unavailable at launch | App opens normally, trial state works, no crash |

---

## New dependency

```
expo-iap
```

Install via: `npx expo install expo-iap`

---

## Out of scope

- No changes to `premiumContext.ts`, `usePremiumState.ts`, or any screen.
- `PaywallModal.tsx` receives one addition only: a "Restore purchases" text button that calls `restore()` from `usePremium()` and dismisses the modal.
- No subscription products.
- No server-side receipt validation.
- No Android (placeholder only; Android IAP uses a different product ID namespace).