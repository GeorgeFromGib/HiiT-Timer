# SB-27 — Workout history + post-workout feeling

Terminology: in this codebase a **Session** is a saved workout template (`src/lib/sessions.ts`). A completed/abandoned run of one is a **HistoryEntry** (new) — don't call it a "session".

## Decisions (defaults — flag to change)
- Storage: JSON file via `readJsonFile`/`writeJsonFile` (`src/lib/jsonFile.ts`), matching sessions/settings. File: `history.json`.
- Capture everything now; surface a little. Unused fields cost nothing, missing ones can't be backfilled.
- Free feature (no paywall) — revisit with premium state if wanted.
- No designs exist for the history screen / rating UI → needs a design pass before Steps 3–5 (CLAUDE.md: pixel-close to designs).

## Data model (`src/lib/history.ts`)
```ts
type Feeling = 'easy' | 'right' | 'hard';
interface HistoryEntry {
  id: string;
  startedAt: number;          // epoch ms
  sessionId: string;          // template id (may be deleted later)
  sessionName: string;        // snapshot
  activityType: 'general'|'run'|'circuit'|'spinning'|'tabata';
  plannedSecs: number;        // totalDuration of segments at start
  activeSecs: number;         // actual elapsed
  rounds: number;
  workSecs: number;
  completed: boolean;         // false = abandoned via "terminate"
  feeling?: Feeling;          // only set on completed
  source: 'phone' | 'watch';
}
```
Snapshot name/config so history survives template edits and deletes.

## Steps
Each step is independently shippable and leaves the app working.

### Step 1 — History store (no UI)
- `src/lib/history.ts`: `loadHistory`, `appendEntry`, `setFeeling(id, feeling)`, `newId` reuse from sessions.
- Cap/rotation: none (a few hundred bytes per entry; revisit at ~5k).
- **Tests** (`src/lib/__tests__/history.test.ts`, mock like `jsonFile.test.ts`): append→load round-trip; `setFeeling` updates only the target; corrupt/missing file → `[]`.

### Step 2 — Log completed + abandoned runs (phone)
- `WorkoutScreen`: on `status === 'finished'` append `completed: true` entry once (guard with ref — re-render safe). In `handleBackPress` "terminate" path append `completed: false` with `elapsed`, skip if `elapsed` < ~5s (accidental starts).
- Derive `activeSecs/workSecs/rounds` from existing `segments` + `SessionStats` (same math as `SessionCompleteScreen` lines ~48–54 — extract to a pure helper in `sessionStats.ts` rather than duplicating).
- Live-session mirror (`useLiveSessionMirror`) finishing on the peer must not double-log: only log when this device owns the run (`source`).
- **Tests**: helper unit tests (skips/extends/addRound adjust totals); entry-builder test for completed vs abandoned; ≥5s threshold.

### Step 3 — Feeling prompt on completion screen
- `SessionCompleteScreen`: three buttons "Too Easy / Just Right / Too Hard" below stats; tap → `setFeeling`, buttons collapse to a confirmation state; optional (Done works without answering).
- i18n: add keys to `src/locales/{en,es,fr,de}.ts` (run `i18n-translation-check`).
- Accessibility labels on buttons.
- **Tests**: component test — tap writes feeling to the entry; no tap leaves `feeling` undefined.

### Step 4 — History screen + summary stats
- Route `{ name: 'History' }` in `src/navigation.ts`; entry point from Sessions list header / Settings (decide in design).
- Pure `src/lib/historyStats.ts`: `currentStreak`, `longestStreak` (local-day buckets, streak survives until end of *today*), `totals(range)` (count, active time for week/month/all), `completionRate`.
- UI: streak chips, week/month/all totals, completion %, reverse-chron list (name, date, duration, feeling icon). Heatmap deferred to Step 6.
- **Tests**: `historyStats.test.ts` — streak across day boundary/DST, gap resets, today-not-yet-trained keeps streak, empty history, abandoned entries excluded from streak but included in completion rate.

### Step 5 — Feeling-based nudge
- Rule: last 3 completed entries of the same `sessionId` all `hard` → show "Try an easier interval?" banner on that session's card / complete screen, linking to EditSession. Mirror for 3× `easy`. Dismissible; don't re-show for N days (store `nudgeDismissedAt` in history file wrapper or settings).
- **Tests**: rule function — 3 hard triggers, mixed doesn't, different sessions don't, dismissal window respected.

### Step 6 — Calendar heatmap (optional)
- GitHub-style grid of last ~12 weeks, intensity by active minutes. Pure `heatmapBuckets(entries, weeks)` + SVG (react-native-svg already used).
- **Tests**: bucket function only.

### Step 7 — Watch parity
- Per CLAUDE.md: watch-run workouts must also log. Phone is source of truth: watch sends a completion record over WatchConnectivity (extend `WorkoutSync` / `WorkoutSessionCoordinator.finish` in `ios/Shared/WorkoutSessionRecording.swift`), phone appends with `source: 'watch'`. Feeling prompt on watch is out of scope (rating can be added from History list later).
- Dedupe by entry id so a phone-mirrored run isn't logged twice.
- **Tests**: Swift test for the record encoding (`xcodebuild -workspace ios/ClearHiiT.xcworkspace`); JS test for dedupe-by-id append.

## Out of scope
Cloud sync/export, SB-30 awards (consume `historyStats` later), Google usage tracing (SB-25).

## Open questions
1. Free vs premium?
2. Where does History live in nav (no tab bar — Sessions header icon?)
3. Abandon threshold (5s) and whether to prompt for feeling on abandoned runs (spec: no).
