# Preset Selection Persistence

**Date:** 2026-06-12

## Problem

The preset strip pills (Easy / Medium / Hard) have no visual indication of which preset is currently active. Tapping a preset applies it, but the pill immediately returns to its default style, so the user has no feedback about which preset they're working from. Manual edits should clear the selection — independently for timing and speed presets.

## Behaviour

- **Duration preset** stays selected until any timing-related value is manually adjusted (field picker commit, interval duration change, add/remove/reorder/duplicate interval, cycle phase, clear intervals, rounds change).
- **Speed preset** stays selected until any speed-related value is manually adjusted (speed picker commit).
- The two are fully independent: editing timing does not clear the speed selection, and vice versa.
- **Pre-selection on open:** if an existing session's easy-mode timing values exactly match a `DURATION_PRESET` level, that pill is pre-selected. Same for speed values vs `SPEED_PRESETS`. Advanced mode duration is not pre-selected (interval-array comparison is complex and unlikely to match in practice).

## Changes

### `useEditSession.ts`

1. Add two helper functions (module-level):
   - `findMatchingDurationPreset(warmup, work, rest, rounds, cooldown): PresetLevel | null` — checks all three `DURATION_PRESETS` entries for an exact match.
   - `findMatchingSpeedPreset(runSpeeds): PresetLevel | null` — checks all three `SPEED_PRESETS` entries for an exact match.

2. Add state:
   ```ts
   const [activeTimingPreset, setActiveTimingPreset] = useState<PresetLevel | null>(() =>
     existing?.mode === 'easy'
       ? findMatchingDurationPreset(warmup0, work0, rest0, rounds0, cooldown0)
       : null
   );
   const [activeSpeedPreset, setActiveSpeedPreset] = useState<PresetLevel | null>(() =>
     existing?.runSpeeds ? findMatchingSpeedPreset(existing.runSpeeds) : null
   );
   ```

3. Every existing `setTimingDirty(true)` call also calls `setActiveTimingPreset(null)`. Every `setSpeedsDirty(true)` call also calls `setActiveSpeedPreset(null)`.

4. `applyDurationPreset` sets `setActiveTimingPreset(level)` on successful apply (inside `doApply`).

5. `applySpeedPreset` sets `setActiveSpeedPreset(level)` on successful apply.

6. Add `activeTimingPreset` and `activeSpeedPreset` to `EditSessionDraft` and the returned `draft` object.

### `EditSessionScreen.tsx`

1. `PresetStrip` gains an `activePreset?: PresetLevel | null` prop.

2. The pill whose `level === activePreset` renders with persistent accent border + tinted background (same styling as the `pressed` state today):
   ```ts
   style={[
     styles.presetPill,
     level === activePreset && { borderColor: T.accent, backgroundColor: withOpacity(T.accent, 0x14) },
   ]}
   ```
   Text color similarly: accent when active, `T.subText` otherwise.

3. All four `PresetStrip` usages pass the appropriate active value:
   - Easy mode duration strip → `activePreset={draft.activeTimingPreset}`
   - Easy mode speed strip → `activePreset={draft.activeSpeedPreset}`
   - Advanced mode duration strip → `activePreset={draft.activeTimingPreset}`
   - Advanced mode speed strip → `activePreset={draft.activeSpeedPreset}`

## Out of scope

- Persisting the active preset to the saved session (it's derived from values on load).
- Fuzzy/approximate matching for pre-selection.
- Advanced mode duration pre-selection.
