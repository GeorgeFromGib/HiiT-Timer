# Ta-Da Finish Sound

**Date:** 2026-06-15

## Goal

Replace the single-tone finish sound with a rising arpeggio ("ta-da") that plays when a workout session completes.

## Design

Replace the `finish.wav` entry in `scripts/generate-audio.js` with a four-step arpeggio sequence:

| Step | Freq | Duration | Notes |
|------|------|----------|-------|
| C5   | 523 Hz | 0.07s  | blip |
| E5   | 659 Hz | 0.07s  | blip |
| G5   | 784 Hz | 0.07s  | blip |
| G5   | 784 Hz | 0.40s  | sustain |

Each step uses the existing `tone()` helper. The four buffers are concatenated into a single WAV written to `assets/audio/finish.wav`.

## Scope

- **Change:** `scripts/generate-audio.js` only — update the `finish.wav` generator
- **Regenerate:** Run `node scripts/generate-audio.js` to produce the new WAV
- **No code changes:** `audio.ts`, `useWorkoutSession.ts`, and all screens remain untouched — `playFinish()` already plays `finish.wav` at session end

## Testing

Manually verify the new sound plays at session completion in the app.
