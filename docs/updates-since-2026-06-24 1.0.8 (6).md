# Updates Since 2026-06-24

## Haptic Feedback

- Added `hapticFeedback` toggle to Settings
- Phase transitions trigger a ~2-second vibration burst (14 taps at 150ms)
- Same burst fires when the session finishes
- Burst cancels on pause, reset, and unmount
- Uses `expo-haptics`

## Spinning Session Type

- New "Spinning" activity type with resistance and power fields
- Spinning easy/advanced mode UI in the session editor and session cards
- Resistance + power displayed as a combined pill on the workout screen and next-up row
- Spin presets (mid-range defaults), activity type icon in menus, header, and session cards
- `SpinValues` data model, extended `Segment` and `Interval` types

## Activity Type Icons

- `ActivityTypeIcon` component for general / run / circuit / spinning
- Icon shown in session cards, session list menus, and the workout screen header

## Activity Type Dropdown & Editor Improvements

- Inline activity type dropdown when creating a new session
- Activity type threaded through navigation route into the editor
- Interval section headers, activity type shown in preview card
- General renamed to "Standard"

## Circuit Session Type

- Full circuit mode: sets + break intervals, circuit labels, circuit number, circuitRest phase
- Circuit editor form with config grid and interval list
- `circuitRest` phase with hourglass icon, colour, and translations (EN/ES/FR)
- Activity label pill and circuit indicator in the workout screen

## Smart Add Interval

- Typed phase parameter when adding a new interval
- Copy-from-previous logic for faster interval creation
- Inline phase picker UI

## Editor Refactors

- `useEditSession` split into mode sub-hooks (`useEasyModeEdit`, `useCircuitModeEdit`, `useAdvancedModeEdit`)
- `usePickerState`, `PresetStrip`, `IntervalSwipeRow` extracted to focused files
- `useDraft` replaces JSON.stringify snapshot pattern
- Speed unit logic consolidated into `speedUnit.ts`

## Other

- French locale added
- Richer tick sound (beep generator with attack + harmonic overtone)
- Build number and trial/subscription status shown in Settings About section
- UI scaled for Display Zoom and Larger Text accessibility settings
