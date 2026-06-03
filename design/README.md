# Handoff: HIIT Timer App

## Overview
A mobile HIIT (High-Intensity Interval Training) timer app with three screens:
1. **Workout Screen** — active timer running a session
2. **Sessions List** — browse, select and manage saved sessions
3. **Edit Session** — create or edit a session's interval sequence

The app supports two visual themes: **Tidal** (dark, deep teal) and **Daybreak** (light, warm paper). All screens are designed at **390 × 844 px** (iPhone 14 equivalent), rendered inside a 286 × 588 px artboard in the prototype. However the design should be adaptable across all iphone sizes

---

## About the Design Files
The files in this bundle are **high-fidelity design references built in HTML + React**. They are prototypes showing intended look, layout, and interactions — not production code to ship directly. The task is to **recreate these designs in your target codebase** using its established patterns and libraries (React Native, SwiftUI, Flutter, etc.).

**Fidelity: High-fidelity.** Colors, typography, spacing, and interactions are final. Implement pixel-close to the designs.

---

## Fonts

| Role | Family | Weights |
|---|---|---|
| UI / body | **Inter** | 400, 500, 600, 700, 800, 900 |
| Timers / numbers | **Chakra Petch** (monospace) | 500, 600, 700 |

Both available on Google Fonts.

---

## Design Tokens

### Color Themes

#### Tidal (Dark)
```
bg gradient:       #0b1d26 → #0e2832  (165deg, bg[1] → bg[0])
accent:            #3ad6c6
btnGlyph:          #06131a  (icon color on accent buttons)

text:              #eef6f7
subText:           rgba(255,255,255,0.72)
faintText:         rgba(255,255,255,0.44)
hairline:          rgba(255,255,255,0.10)
ghostBg:           rgba(255,255,255,0.05)
card:              rgba(255,255,255,0.05)
```

#### Daybreak (Light)
```
bg gradient:       #f3efe6 → #e7e1d4  (165deg)
accent:            #ff5a3d
btnGlyph:          #ffffff

text:              #16242b
subText:           rgba(20,32,38,0.62)
faintText:         rgba(20,32,38,0.45)
hairline:          rgba(20,32,38,0.13)
ghostBg:           rgba(20,32,38,0.05)
card:              rgba(255,255,255,0.66)
```

### Phase Colors

| Phase | Tidal | Daybreak | Label | Icon |
|---|---|---|---|---|
| warmup | `#5fd38a` | `#1f9d57` | WARM UP | sun |
| work | `#ff8a3d` | `#e0631a` | WORK | flame |
| blast | `#ff5a5f` | `#e23b40` | ALL OUT | bolt |
| rest | `#46a6ff` | `#1f7fd6` | RECOVER | pause (double bar) |
| cooldown | `#5fd38a` | `#1f9d57` | COOL DOWN | snowflake |

---

## Shared Components

### Ghost Button
- Size: 54 × 54 px, border-radius: 50%
- Background: `ghostBg`, border: 1px solid `hairline`
- Icon color: `subText`
- Used for: Reset, Skip

### Play/Pause Button
- Size: 74 × 74 px, border-radius: 50%
- Background: radial gradient from `accent` (full) to `accent` at 60% opacity
- Box shadow: `0 12px 30px {accent}55`, inset `0 1px 1px rgba(255,255,255,0.45)`
- Icon color: `btnGlyph`
- Pause icon: two rounded rectangles (8×26 px, rx 2.6)
- Play icon: filled triangle

### Accent Circle Button (＋ / back)
- Size: 36 × 36 px, border-radius: 50%
- Accent: filled `accent` bg, `btnGlyph` icon, `0 6px 18px {accent}55` shadow
- Ghost: `ghostBg` bg, `hairline` border, `subText` icon

### Pill Badge
- Padding: 3px 9px, border-radius: 999
- Background: `{color}22`, border: 1px solid `{color}44`
- Font: 10.5px Inter 700, letter-spacing 0.1em, uppercase
- Used for category (accent color) and difficulty (phase-mapped color)

### Difficulty Colors
```
Easy:   #5fd38a
Medium: #ff8a3d
Hard:   #ff5a5f
```

### Phase Strip (mini timeline)
- Height: 8–10 px, gap: 2 px between segments
- Each segment: flex-width proportional to interval duration, border-radius: 4–5 px
- Color: phase color at 85% opacity
- Used in session cards and Edit Session preview

### Controls Row (Workout screen)
Layout: `flex-row, justify-center, gap: 22 px, margin-top: 6 px`
Order: [Reset ghost btn] [Play/Pause btn] [Skip ghost btn]

---

## Screen 1: Workout Timer (Hero Layout)

### Layout
Full-screen, `flex-column`, padding: 54px top, 20px sides, 24px bottom.
Background: theme `bg` gradient (165deg).

### Sections (top → bottom)
```
[Header]
[Phase center block]   — flex:1, centered
[Next up row]
[Timeline strip]
[Controls row]
```

### Header
- Left: label "INTERVAL SESSION" (10.5px Inter 700, letter-spacing 0.18em, uppercase, `faintText`) + title "Tabata Burnout" (18px Inter 700, letter-spacing -0.01em, `text`)
- Right: close button — 36×36 ghost circle, ✕ icon 14×14

### Phase Center Block
Vertically and horizontally centered, `flex-column, align-center, gap: 8px`.

1. **Phase icon badge**: 40×40 px, border-radius: 12 px, bg `{phaseColor}22`, border 1.5px solid `{phaseColor}55`. SVG icon 23×23 in phase color.
2. **Phase label**: 36px Inter 900, letter-spacing 0.01em, color: `phaseColor`, text-shadow `0 0 30px {phaseColor}55`. E.g. "ALL OUT", "RECOVER".
3. **Countdown clock**: Chakra Petch 700, 86px, line-height 1, tabular-nums, color: `text`, text-shadow `0 0 34px {phaseColor}3a`. Format: `MM:SS`.
4. **Interval counter**: 13.5px Inter 700, `faintText`, letter-spacing 0.08em. "INTERVAL **N** OF 10" — the number N is `phaseColor`.
5. **Phase progress bar**: width 100%, max-width 240px, height 22px, border-radius 6, bg: `hairline`. Fill depletes right→left as time runs out; fill is `phaseColor`, box-shadow `0 0 12px {phaseColor}99`. Transition: `width 0.2s linear`.

### Next Up Row
`flex-row, align-center, justify-center, gap: 9px, padding: 8px 0`
- "NEXT" label: 11px Inter 700, letter-spacing 0.14em, `faintText`
- Arrow icon: →, `faintText`
- Phase icon (15×15) + phase label: 14px Inter 800, letter-spacing 0.05em, `nextPhaseColor`
- If final interval: "FINISH" in current `phaseColor`

### Timeline Strip
Full width, `flex-column, gap: 8px, margin-bottom: 6px`.

**Bar** (height: 22px):
- Segments: `flex-row, gap: 2px`. Each segment's width = `(duration / totalDuration) * 100%`, min-width 2px, border-radius 5.
  - Completed: `opacity: 0.28`
  - Active: `opacity: 1`, box-shadow `0 0 0 1.5px {color}, 0 0 12px {color}99`
  - Upcoming: `opacity: 0.5`
  - Transition: `opacity 0.3s`
- **Playhead marker**: absolute, `left: {pct}%`, width 3px, top -4px, bottom -4px, margin-left -1.5px, border-radius 3, bg: `text`, box-shadow `0 0 9px {text}`, transition `left 0.25s linear`.
  - Circle cap on top: 12×12 px, border-radius 50%, top -6px, centered, same bg + shadow.

**Labels row** (below bar):
- Font: 12.5px Inter 700, letter-spacing 0.04em, color: `subText`, tabular-nums
- Left: `{pct}%` (rounded integer)
- Right: `MM:SS left` (total time remaining)

---

## Screen 2: Sessions List

### Layout
Full-screen `flex-column`, padding: 54px top, 20px sides, 28px bottom. Scrollable content.

### Header
- Left: "CHOOSE" label (11px, uppercase, `faintText`) + "My Sessions" title (22px Inter 800)
- Right: accent ＋ circle button (36×36) — opens new session flow

### Category Filter
`flex-row, gap: 8px, margin-bottom: 18px`
Tabs: All · HIIT · Express · Steady

Each tab button:
- Padding: 6px 14px, border-radius: 999
- **Active**: bg `{accent}18`, border `accent`, color `accent`
- **Inactive**: bg `ghostBg`, border `hairline`, color `subText`
- Font: 12px Inter 700, letter-spacing 0.06em

### Session Card
Border-radius: 20px, padding: 16px 16px 14px.
- **Default**: bg `card`, border 1.5px `hairline`
- **Selected**: bg `{accent}14`, border 1.5px `accent`, box-shadow `0 0 0 1px {accent}33`
- Transition: border-color and background 0.2s

**Top row** (space-between):
- Left: Session name (16px Inter 800, letter-spacing -0.01em) + pill badges row (gap 8px): category pill (accent color) + difficulty pill (difficulty color)
- Right: edit pencil button — 34×34 ghost circle

**Phase strip**: height 9px, border-radius 4, full width, margin-top 10px

**Stats row** (gap 16px, margin-top 10px):
- Total duration: number in Chakra Petch 14px 700 `text`, label "total" in 11px 600 `faintText`
- Interval count: number in Chakra Petch 14px 700 `text`, label "intervals" in 11px 600 `faintText`

**Start button** (selected card only):
- Width: 100%, padding: 12px, border-radius: 14px, border: none
- Background: `accent`, color: `btnGlyph`, font: 14px Inter 800, letter-spacing 0.06em
- Box-shadow: `0 8px 22px {accent}55`
- Label: "START SESSION"

---

## Screen 3: Edit Session

### Layout
Full-screen `flex-column`, padding: 54px top, 20px sides, 28px bottom.
Intervals list is scrollable (`flex: 1, min-height: 0, overflow-y: auto`).
Phase picker is pinned below the list (`flex-shrink: 0`).

### Header
`flex-row, space-between, margin-bottom: 24px`
- Left: back button (36×36 ghost circle, ‹ chevron) + label/title stack
  - Label: 11px Inter 700 uppercase letter-spacing 0.18em `faintText` — "Edit" or "Create"
  - Title: 20px Inter 800 — "Edit Session" or "New Session"
- Right: accent ＋ circle button (36×36) — triggers phase picker to appear

### Session Name Field
Label: "SESSION NAME" — 11px Inter 700 uppercase, letter-spacing 0.12em, `faintText`, margin-bottom 7px

Input area: bg `card`, border-radius 14, padding 12px 16px
- **Filled**: border 1.5px `accent`, text 16px Inter 700 `text`, letter-spacing -0.01em
- **Empty**: border 1.5px `hairline`, placeholder "e.g. Morning Blast" in `faintText`

### Preview Strip
PhaseStrip, height 10px, radius 5, full width. Updates live as intervals change.

### Intervals Header Row
`flex-row, space-between, margin-top: 16px, margin-bottom: 10px`
- Left: "INTERVALS" — 11px Inter 700 uppercase, letter-spacing 0.12em, `faintText`
- Right: total duration + count — Chakra Petch 13px 600 `subText` format: `"Xm · N blocks"`

### Interval Row
`flex-row, align-center, gap: 12px`, bg `card`, border 1px `hairline`, border-radius 14, padding 11px 14px.

Elements left → right:
1. **Drag handle**: 3 horizontal lines, 14×14, `faintText`
2. **Phase dot**: 10×10 circle, phase color
3. **Phase name**: 14px Inter 700 `text`, flex:1 (e.g. "Work", "Recover")
4. **Duration stepper**:
   - `−` button: 26×26 circle, `ghostBg` bg, `hairline` border, `subText` color
   - Value: Chakra Petch 15px 700 `text`, min-width 36px, centered (format: `"Xs"`)
   - `+` button: same as `−`
   - Step: 5 seconds; minimum: 5 seconds
5. **Delete button**: 28×28 circle, `ghostBg` bg, `hairline` border, ✕ icon 12×12 `faintText`

### Phase Picker (appears when ＋ is tapped)
`flex-column, gap: 10px, margin-top: 10px`, border-radius 16, border 1.5px `{accent}55`, bg `{accent}0e`, padding 14px.

Header row: "CHOOSE PHASE" label (11px 700 uppercase `faintText`) + ✕ close button.

Phase buttons (flex-wrap row, gap 8px):
- Each: `flex-row, align-center, gap: 7px`, padding 8px 14px, border-radius 999
- Background: `{phaseColor}18`, border 1.5px `{phaseColor}55`, color: `phaseColor`
- Font: 13px Inter 700, letter-spacing 0.04em
- Left: 8×8 phase color dot
- Label: "Warm Up", "Work", "All Out", "Recover", "Cool Down"
- On tap: appends a new interval (default 30s) and dismisses picker

---

## Interactions & Behavior

### Workout Timer
- Runs automatically on load; clock ticks every ~90ms
- Play/pause toggles the clock; Reset sets elapsed to 0 and pauses
- Skip advances to the next interval boundary: `elapsed = (acc + cur.dur) % TTOTAL`
- Clock loops back to 0 when it reaches total duration (showcase mode)
- Phase color, icon, label, countdown, progress bar, and timeline all update reactively
- Phase progress bar depletes from right to left (shows time **remaining** in current interval)
- Timeline playhead moves left-to-right; `transition: left 0.25s linear`

### Sessions List
- Tapping a card selects it (highlight + reveals START SESSION button)
- Category filter tabs filter cards; "All" shows everything
- Edit pencil navigates to Edit Session screen
- ＋ button navigates to Edit Session in "Create" (isNew) mode

### Edit Session
- ＋ button in header reveals the phase picker inline below the interval list
- Tapping a phase pill appends the interval and closes the picker
- ✕ on picker dismisses without adding
- Duration `−`/`+` steppers adjust by 5s, floor at 5s
- Drag handle (visual only in prototype — implement drag-to-reorder in production)
- Preview strip updates live as intervals change

---

## Workout Data Model

```typescript
type PhaseType = 'warmup' | 'work' | 'blast' | 'rest' | 'cooldown';

interface Interval {
  type: PhaseType;
  dur: number; // seconds
}

interface Session {
  id: number;
  name: string;
  category: 'HIIT' | 'Express' | 'Steady';
  difficulty: 'Easy' | 'Medium' | 'Hard';
  intervals: Interval[];
}
```

### Sample workout (Tabata Burnout) — 285 seconds total
```
warmup   45s
work     30s
rest     15s
blast    30s
rest     15s
work     30s
rest     15s
blast    30s
rest     15s
cooldown 60s
```

### deriveState(elapsed) — key timer logic
```typescript
// Given elapsed seconds, returns:
// idx   — current interval index (0-based)
// into  — seconds elapsed within current interval
// acc   — seconds elapsed before current interval
// cur   — the current Interval object

function deriveState(elapsed: number, intervals: Interval[]) {
  let acc = 0;
  for (let i = 0; i < intervals.length; i++) {
    if (elapsed < acc + intervals[i].dur || i === intervals.length - 1) {
      return { idx: i, into: elapsed - acc, acc, cur: intervals[i] };
    }
    acc += intervals[i].dur;
  }
}
```

---

## Time Formatting
```typescript
// Formats seconds as MM:SS, always 2 digits each
function tfmt(s: number): string {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
}
```

---

## Design Reference Files
The following HTML files in this bundle are the live prototypes. Open them in a browser to see the designs in action:

| File | Contents |
|---|---|
| `HIIT Timer - Explorations.html` | Design canvas — all screens side-by-side in both themes |
| `HIIT Timer.html` | Earlier standalone timer prototype |
| `themed-layouts.jsx` | Workout timer screen (Hero layout + Timeline) |
| `sessions-screens.jsx` | Sessions List + Edit Session screens |
| `themed-core.jsx` | Clock hook, deriveState, shared buttons + icons |
| `themes.js` | All color tokens for both themes |

Open `HIIT Timer - Explorations.html` in a browser to see all screens running live.
