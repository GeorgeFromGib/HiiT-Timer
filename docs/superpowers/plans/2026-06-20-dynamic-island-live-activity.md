# Dynamic Island / Live Activity Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Show current workout phase and countdown in the Dynamic Island and Lock Screen while the app is in the background or screen is locked.

**Architecture:** Use Apple's ActivityKit Live Activities (iOS 16.2+) with a Widget Extension target for the SwiftUI UI, and a classic `RCT_EXTERN_MODULE` native bridge so JS can start/update/end activities via `NativeModules.LiveActivityModule`. The JS timer's existing 200ms tick is throttled to 1 update/second by passing `Math.ceil(remainingInSegment)` — the integer only changes once per second.

**Tech Stack:** ActivityKit, WidgetKit, SwiftUI (iOS 16.4+ only), React Native `NativeModules` bridge (no Expo Modules Core — avoids auto-discovery complexity), TypeScript.

## Global Constraints

- iOS 16.4 deployment target — already set in `ios/Podfile` and `app.json`
- Do NOT run `expo prebuild --clean` — will delete committed native code
- Widget Extension bundle ID must be: `com.georgefromgib.hiittimer.WorkoutLiveActivity`
- Apple Team ID: `KM666T7T27`
- `WorkoutActivityAttributes.swift` must be added to **both** Xcode targets (ClearHiiT + WorkoutLiveActivity)
- No test framework is configured — verification is via Xcode build + physical device

## Explicit Assumptions

1. **ActivityKit cross-module type matching** — `WorkoutActivityAttributes.swift` is compiled into both the `ClearHiiT` and `WorkoutLiveActivity` Swift modules. ActivityKit is assumed to match activities by struct name alone (not the fully-qualified `Module.StructName`). This is the standard community approach but is not documented by Apple. If it fails: the activity starts but the widget displays nothing (silent, no crash). Fix: create a shared Swift framework target — a known escalation path.

2. **RCT_EXTERN_MODULE interop with New Architecture** — The app has `RCTNewArchEnabled: true`. `RCT_EXTERN_MODULE` works via Expo SDK 56's bridge interop/compatibility layer, which is kept enabled by default. If the interop layer were disabled, `NativeModules.LiveActivityModule` would be `undefined` — the `isSupported` guard catches this silently (no Live Activity, no crash).

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `ios/ClearHiiT/Info.plist` | Modify | Add `NSSupportsLiveActivities` key |
| `app.json` | Modify | Mirror `NSSupportsLiveActivities` in infoPlist |
| `ios/WorkoutLiveActivity/WorkoutActivityAttributes.swift` | Create | Shared Codable data model between app + extension |
| `ios/WorkoutLiveActivity/WorkoutLiveActivityBundle.swift` | Create | `@main` WidgetBundle entry point |
| `ios/WorkoutLiveActivity/WorkoutLiveActivityWidget.swift` | Create | SwiftUI views for compact/expanded/lock screen |
| `ios/ClearHiiT/LiveActivityModule.swift` | Create | Swift implementation of ActivityKit bridge |
| `ios/ClearHiiT/LiveActivityModule.m` | Create | Obj-C macros exposing Swift methods to RN |
| `src/lib/liveActivity.ts` | Create | JS wrapper over `NativeModules.LiveActivityModule` |
| `src/hooks/useLiveActivity.ts` | Create | React hook managing start/update/end lifecycle |
| `src/screens/WorkoutScreen.tsx` | Modify | Call `useLiveActivity` with current timer state |

---

## Task 1: Enable Live Activities in Info.plist and app.json

**Files:**
- Modify: `ios/ClearHiiT/Info.plist`
- Modify: `app.json`

**Interfaces:**
- Produces: `NSSupportsLiveActivities = true` in the installed app's Info.plist

- [ ] **Step 1: Add key to ios/ClearHiiT/Info.plist**

Open `ios/ClearHiiT/Info.plist`. Add the following key/value pair inside the `<dict>` block, before the closing `</dict>`:

```xml
<key>NSSupportsLiveActivities</key>
<true/>
```

Final location — add it after the `UIBackgroundModes` block:

```xml
	<key>UIBackgroundModes</key>
	<array>
		<string>audio</string>
	</array>
	<key>NSSupportsLiveActivities</key>
	<true/>
```

- [ ] **Step 2: Mirror in app.json**

In `app.json`, add `NSSupportsLiveActivities` to the existing `infoPlist` section:

```json
"infoPlist": {
  "ITSAppUsesNonExemptEncryption": false,
  "UIBackgroundModes": ["audio"],
  "CFBundleLocalizations": ["en", "es"],
  "NSSupportsLiveActivities": true
}
```

- [ ] **Step 3: Commit**

```bash
git add ios/ClearHiiT/Info.plist app.json
git commit -m "feat: enable NSSupportsLiveActivities for Live Activity support"
```

---

## Task 2: Create Widget Extension Target in Xcode

**Files:**
- Xcode project file (auto-updated by Xcode)
- `ios/WorkoutLiveActivity/` (Xcode creates the folder with boilerplate)

**Interfaces:**
- Produces: A new `WorkoutLiveActivity` target in the Xcode project, bundle ID `com.georgefromgib.hiittimer.WorkoutLiveActivity`, with a WidgetKit extension point

> **This entire task is done in Xcode's UI — no code to write. Follow each step precisely.**

- [ ] **Step 1: Open the workspace (not the .xcodeproj)**

```
open ios/ClearHiiT.xcworkspace
```

You must open the `.xcworkspace`, not the `.xcodeproj`. The workspace includes CocoaPods.

- [ ] **Step 2: Add a new target**

In Xcode:
1. In the **Project Navigator** (left panel), click `ClearHiiT` at the very top — this opens the project settings in the editor.
2. In the left column of the project settings editor, you see a list of targets (ClearHiiT, etc.). At the **bottom-left** of this list, click the **"+"** button.

- [ ] **Step 3: Select Widget Extension template**

In the template picker that appears:
1. Select the **iOS** tab at the top.
2. Scroll to find **Widget Extension**. Click it once to select it.
3. Click **Next**.

- [ ] **Step 4: Configure the extension**

Fill in:
- **Product Name:** `WorkoutLiveActivity`
- **Team:** select your Apple team (KM666T7T27)
- **Organization Identifier:** `com.georgefromgib.hiittimer` (auto-filled)
- **Bundle Identifier:** auto-fills to `com.georgefromgib.hiittimer.WorkoutLiveActivity` — verify this is correct
- **Language:** Swift
- **Check** the box: ✅ `Include Live Activity`
- **Uncheck**: `Include Configuration App Intent` (not needed)

Click **Finish**.

- [ ] **Step 5: Activate the scheme**

Xcode may ask "Activate 'WorkoutLiveActivity' scheme?" — click **Activate**.

- [ ] **Step 6: Delete the Xcode-generated template Swift files**

Xcode creates template Swift files in the `WorkoutLiveActivity` folder (names vary, but look like `WorkoutLiveActivity.swift` or `WorkoutLiveActivityLiveActivity.swift`). We will replace these with our own.

In Xcode's Project Navigator, expand `WorkoutLiveActivity`. Select any auto-generated `.swift` files (NOT `Info.plist` or `Assets.xcassets`). Right-click → **Delete** → **Move to Trash**.

Keep: `Info.plist`, `Assets.xcassets/`
Delete: any `.swift` files Xcode created

- [ ] **Step 7: Set deployment target for the extension**

1. In the Project Navigator, click `ClearHiiT` (the project, top item).
2. In the targets list, click **WorkoutLiveActivity**.
3. Click the **General** tab.
4. Under **Minimum Deployments**, set **iOS** to `16.4`.

- [ ] **Step 8: Verify signing**

Still on the **WorkoutLiveActivity** target:
1. Click the **Signing & Capabilities** tab.
2. Ensure **Team** is set to your Apple team.
3. If it says "No account", sign in to your Apple account via Xcode → Settings → Accounts.

- [ ] **Step 9: Commit the Xcode project changes**

```bash
git add ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add WorkoutLiveActivity widget extension target"
```

---

## Task 3: Write the Data Model and Widget SwiftUI Files

**Files:**
- Create: `ios/WorkoutLiveActivity/WorkoutActivityAttributes.swift`
- Create: `ios/WorkoutLiveActivity/WorkoutLiveActivityBundle.swift`
- Create: `ios/WorkoutLiveActivity/WorkoutLiveActivityWidget.swift`

**Interfaces:**
- Produces: `WorkoutActivityAttributes` struct with `ContentState` (phase, phaseLabel, timeRemaining, phaseColor). Used by `LiveActivityModule.swift` and the widget views.

- [ ] **Step 1: Create WorkoutActivityAttributes.swift**

Create the file at `ios/WorkoutLiveActivity/WorkoutActivityAttributes.swift`:

```swift
import ActivityKit

struct WorkoutActivityAttributes: ActivityAttributes {
    struct ContentState: Codable, Hashable {
        var phase: String       // "work" | "rest" | "warmup" | "cooldown"
        var phaseLabel: String  // "WORK" | "RECOVER" | "WARM UP" | "COOL DOWN"
        var timeRemaining: Int  // seconds remaining in this segment
        var phaseColor: String  // hex e.g. "#ff5a5f"
    }

    var sessionName: String
}
```

- [ ] **Step 2: Add WorkoutActivityAttributes.swift to BOTH Xcode targets**

This is critical — both the main app and the extension must compile this file.

In Xcode:
1. In the Project Navigator, find `WorkoutActivityAttributes.swift` under `WorkoutLiveActivity`.
2. Click the file to open it.
3. In the right panel (File Inspector), under **Target Membership**, you see checkboxes for `ClearHiiT` and `WorkoutLiveActivity`.
4. **Check BOTH boxes**: ✅ `ClearHiiT` AND ✅ `WorkoutLiveActivity`.

- [ ] **Step 3: Create WorkoutLiveActivityBundle.swift**

Create `ios/WorkoutLiveActivity/WorkoutLiveActivityBundle.swift`:

```swift
import SwiftUI
import WidgetKit

@main
struct WorkoutLiveActivityBundle: WidgetBundle {
    var body: some Widget {
        WorkoutLiveActivityWidget()
    }
}
```

- [ ] **Step 4: Create WorkoutLiveActivityWidget.swift**

Create `ios/WorkoutLiveActivity/WorkoutLiveActivityWidget.swift`:

```swift
import ActivityKit
import SwiftUI
import WidgetKit

private extension Color {
    init(hex: String) {
        var hex = hex.trimmingCharacters(in: CharacterSet.alphanumerics.inverted)
        if hex.count == 3 {
            hex = hex.map { "\($0)\($0)" }.joined()
        }
        var int: UInt64 = 0
        Scanner(string: hex).scanHexInt64(&int)
        self.init(
            red: Double((int >> 16) & 0xFF) / 255,
            green: Double((int >> 8) & 0xFF) / 255,
            blue: Double(int & 0xFF) / 255
        )
    }
}

private func formatTimer(_ seconds: Int) -> String {
    if seconds < 60 { return "\(seconds)" }
    return String(format: "%02d:%02d", seconds / 60, seconds % 60)
}

struct WorkoutLiveActivityWidget: Widget {
    var body: some WidgetConfiguration {
        ActivityConfiguration(for: WorkoutActivityAttributes.self) { context in
            // Lock Screen / Notification banner view
            HStack(spacing: 16) {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 10, height: 10)
                Text(context.state.phaseLabel)
                    .font(.system(size: 16, weight: .black))
                    .foregroundColor(Color(hex: context.state.phaseColor))
                Spacer()
                Text(formatTimer(context.state.timeRemaining))
                    .font(.system(size: 32, weight: .bold, design: .monospaced))
                    .foregroundColor(.white)
            }
            .padding(.horizontal, 20)
            .padding(.vertical, 16)
            .background(.black.opacity(0.8))
        } dynamicIsland: { context in
            DynamicIsland {
                DynamicIslandExpandedRegion(.leading) {
                    HStack(spacing: 8) {
                        Circle()
                            .fill(Color(hex: context.state.phaseColor))
                            .frame(width: 10, height: 10)
                        Text(context.state.phaseLabel)
                            .font(.system(size: 15, weight: .black))
                            .foregroundColor(Color(hex: context.state.phaseColor))
                    }
                    .padding(.leading, 4)
                }
                DynamicIslandExpandedRegion(.trailing) {
                    Text(formatTimer(context.state.timeRemaining))
                        .font(.system(size: 28, weight: .bold, design: .monospaced))
                        .foregroundColor(.white)
                        .padding(.trailing, 8)
                }
                DynamicIslandExpandedRegion(.bottom) {
                    Text(context.attributes.sessionName)
                        .font(.system(size: 12, weight: .medium))
                        .foregroundColor(.white.opacity(0.5))
                        .padding(.bottom, 4)
                }
            } compactLeading: {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 8, height: 8)
                    .padding(.leading, 4)
            } compactTrailing: {
                Text(formatTimer(context.state.timeRemaining))
                    .font(.system(size: 13, weight: .semibold, design: .monospaced))
                    .foregroundColor(.white)
                    .padding(.trailing, 4)
                    .minimumScaleFactor(0.7)
            } minimal: {
                Circle()
                    .fill(Color(hex: context.state.phaseColor))
                    .frame(width: 8, height: 8)
            }
        }
    }
}
```

- [ ] **Step 5: Add the new Swift files to the WorkoutLiveActivity target in Xcode**

For `WorkoutLiveActivityBundle.swift` and `WorkoutLiveActivityWidget.swift`:
1. In Xcode's Project Navigator, find each file.
2. In the File Inspector (right panel), under **Target Membership**, ensure only ✅ `WorkoutLiveActivity` is checked (NOT ClearHiiT).

- [ ] **Step 6: Commit**

```bash
git add ios/WorkoutLiveActivity/
git commit -m "feat: add WorkoutLiveActivity widget UI and data model"
```

---

## Task 4: Write the Native Module Bridge

**Files:**
- Create: `ios/ClearHiiT/LiveActivityModule.swift`
- Create: `ios/ClearHiiT/LiveActivityModule.m`

**Interfaces:**
- Consumes: `WorkoutActivityAttributes` from Task 3 (compiled into ClearHiiT via dual target membership)
- Produces: `NativeModules.LiveActivityModule` in JS with three async methods:
  - `startActivity(sessionName, phase, phaseLabel, timeRemaining, phaseColor) → Promise<void>`
  - `updateActivity(phase, phaseLabel, timeRemaining, phaseColor) → Promise<void>`
  - `endActivity() → Promise<void>`

- [ ] **Step 1: Create LiveActivityModule.swift**

Create `ios/ClearHiiT/LiveActivityModule.swift`:

```swift
import ActivityKit
import Foundation

@objc(LiveActivityModule)
class LiveActivityModule: NSObject {
    private var currentActivity: Activity<WorkoutActivityAttributes>?

    @objc static func requiresMainQueueSetup() -> Bool { false }

    @objc func startActivity(
        _ sessionName: String,
        phase: String,
        phaseLabel: String,
        timeRemaining: NSNumber,
        phaseColor: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard ActivityAuthorizationInfo().areActivitiesEnabled else {
            resolve(nil)
            return
        }

        // End any existing activity before starting a new one
        if let existing = currentActivity {
            Task { await existing.end(nil, dismissalPolicy: .immediate) }
            currentActivity = nil
        }

        let state = WorkoutActivityAttributes.ContentState(
            phase: phase,
            phaseLabel: phaseLabel,
            timeRemaining: timeRemaining.intValue,
            phaseColor: phaseColor
        )
        let content = ActivityContent(state: state, staleDate: nil)

        do {
            currentActivity = try Activity.request(
                attributes: WorkoutActivityAttributes(sessionName: sessionName),
                content: content,
                pushType: nil
            )
            resolve(nil)
        } catch {
            reject("LIVE_ACTIVITY_START_FAILED", error.localizedDescription, error)
        }
    }

    @objc func updateActivity(
        _ phase: String,
        phaseLabel: String,
        timeRemaining: NSNumber,
        phaseColor: String,
        resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let activity = currentActivity else {
            resolve(nil)
            return
        }

        let state = WorkoutActivityAttributes.ContentState(
            phase: phase,
            phaseLabel: phaseLabel,
            timeRemaining: timeRemaining.intValue,
            phaseColor: phaseColor
        )
        let content = ActivityContent(state: state, staleDate: nil)
        Task { await activity.update(content) }
        resolve(nil)
    }

    @objc func endActivity(
        _ resolve: @escaping RCTPromiseResolveBlock,
        reject: @escaping RCTPromiseRejectBlock
    ) {
        guard let activity = currentActivity else {
            resolve(nil)
            return
        }
        Task { await activity.end(nil, dismissalPolicy: .immediate) }
        currentActivity = nil
        resolve(nil)
    }
}
```

- [ ] **Step 2: Create LiveActivityModule.m**

Create `ios/ClearHiiT/LiveActivityModule.m`:

```objc
#import <React/RCTBridgeModule.h>

RCT_EXTERN_MODULE(LiveActivityModule, NSObject)

RCT_EXTERN_METHOD(
    startActivity:(NSString *)sessionName
    phase:(NSString *)phase
    phaseLabel:(NSString *)phaseLabel
    timeRemaining:(nonnull NSNumber *)timeRemaining
    phaseColor:(NSString *)phaseColor
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    updateActivity:(NSString *)phase
    phaseLabel:(NSString *)phaseLabel
    timeRemaining:(nonnull NSNumber *)timeRemaining
    phaseColor:(NSString *)phaseColor
    resolve:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)

RCT_EXTERN_METHOD(
    endActivity:(RCTPromiseResolveBlock)resolve
    reject:(RCTPromiseRejectBlock)reject
)
```

- [ ] **Step 3: Add both files to the ClearHiiT target in Xcode**

The files won't compile until they're added to the Xcode target.

Option A — drag and drop:
1. In Finder, locate `ios/ClearHiiT/LiveActivityModule.swift` and `LiveActivityModule.m`.
2. Drag both files into Xcode's Project Navigator under the `ClearHiiT` group.
3. In the dialog that appears, ensure **"Add to targets: ClearHiiT"** is checked. Click Finish.

Option B — use Xcode menu:
1. In Xcode, right-click the `ClearHiiT` group in the Project Navigator.
2. Select **Add Files to "ClearHiiT"...**.
3. Navigate to the files, select both, ensure target `ClearHiiT` is checked, click Add.

Verify in File Inspector: both files should show ✅ `ClearHiiT` only (not WorkoutLiveActivity).

- [ ] **Step 4: Commit**

```bash
git add ios/ClearHiiT/LiveActivityModule.swift ios/ClearHiiT/LiveActivityModule.m
git add ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: add LiveActivityModule native bridge for ActivityKit"
```

---

## Task 5: Write the JS Wrapper and React Hook

**Files:**
- Create: `src/lib/liveActivity.ts`
- Create: `src/hooks/useLiveActivity.ts`

**Interfaces:**
- Consumes: `NativeModules.LiveActivityModule` (from Task 4), `PHASE_META` and `Phase` from `src/lib/workout.ts`
- Produces:
  - `startWorkoutActivity(params)` — call when workout transitions to `running`
  - `updateWorkoutActivity(params)` — call each second while running or on phase change
  - `endWorkoutActivity()` — call on `finished` or `idle`
  - `useLiveActivity(props)` — hook that manages the full lifecycle

- [ ] **Step 1: Create src/lib/liveActivity.ts**

```typescript
import { NativeModules, Platform } from 'react-native';
import { PHASE_META, type Phase } from './workout';

const { LiveActivityModule } = NativeModules;
const isSupported = Platform.OS === 'ios' && !!LiveActivityModule;

export async function startWorkoutActivity(params: {
  sessionName: string;
  phase: Phase;
  timeRemaining: number;
  phaseColor: string;
}): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.startActivity(
    params.sessionName,
    params.phase,
    PHASE_META[params.phase].word,
    params.timeRemaining,
    params.phaseColor,
  );
}

export async function updateWorkoutActivity(params: {
  phase: Phase;
  timeRemaining: number;
  phaseColor: string;
}): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.updateActivity(
    params.phase,
    PHASE_META[params.phase].word,
    params.timeRemaining,
    params.phaseColor,
  );
}

export async function endWorkoutActivity(): Promise<void> {
  if (!isSupported) return;
  return LiveActivityModule.endActivity();
}
```

- [ ] **Step 2: Create src/hooks/useLiveActivity.ts**

```typescript
import { useEffect, useRef } from 'react';
import { startWorkoutActivity, updateWorkoutActivity, endWorkoutActivity } from '../lib/liveActivity';
import type { Phase } from '../lib/workout';
import type { WorkoutStatus } from './useWorkoutSession';

interface Props {
  status: WorkoutStatus;
  phase: Phase;
  phaseColor: string;
  timeRemaining: number; // must be Math.ceil(remainingInSegment) — integer changes once/sec
  sessionName: string;
}

export function useLiveActivity({ status, phase, phaseColor, timeRemaining, sessionName }: Props) {
  const isActiveRef = useRef(false);
  const lastSecRef = useRef(-1);
  const lastPhaseRef = useRef<Phase | null>(null);

  useEffect(() => {
    if (status === 'running') {
      const secChanged = timeRemaining !== lastSecRef.current;
      const phaseChanged = phase !== lastPhaseRef.current;

      if (!isActiveRef.current) {
        isActiveRef.current = true;
        lastPhaseRef.current = phase;
        lastSecRef.current = timeRemaining;
        startWorkoutActivity({ sessionName, phase, timeRemaining, phaseColor }).catch(() => {});
      } else if (phaseChanged || secChanged) {
        lastPhaseRef.current = phase;
        lastSecRef.current = timeRemaining;
        updateWorkoutActivity({ phase, timeRemaining, phaseColor }).catch(() => {});
      }
    } else if (status === 'finished' || status === 'idle') {
      if (isActiveRef.current) {
        isActiveRef.current = false;
        lastSecRef.current = -1;
        lastPhaseRef.current = null;
        endWorkoutActivity().catch(() => {});
      }
    }
  }, [status, phase, phaseColor, timeRemaining, sessionName]);

  // End activity if the component unmounts mid-workout (e.g. back button)
  useEffect(() => {
    return () => {
      if (isActiveRef.current) {
        endWorkoutActivity().catch(() => {});
      }
    };
  }, []);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/lib/liveActivity.ts src/hooks/useLiveActivity.ts
git commit -m "feat: add liveActivity JS wrapper and useLiveActivity hook"
```

---

## Task 6: Wire useLiveActivity into WorkoutScreen

**Files:**
- Modify: `src/screens/WorkoutScreen.tsx`

**Interfaces:**
- Consumes: `useLiveActivity` from `src/hooks/useLiveActivity.ts`
- Consumes: `status`, `currentIndex`, `remainingInSegment` from `useWorkoutSession` (already in scope)
- Consumes: `seg.phase`, `T.phases[seg.phase]`, `session.name` (already in scope)

- [ ] **Step 1: Add import**

At the top of `src/screens/WorkoutScreen.tsx`, add after the existing hook imports:

```typescript
import { useLiveActivity } from '../hooks/useLiveActivity';
```

- [ ] **Step 2: Add hook call**

In `src/screens/WorkoutScreen.tsx`, find this block (the `seg` / `nextSeg` derivation):

```typescript
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg            = segments[effectiveIndex];
  const nextSeg        = segments[effectiveIndex + 1];
```

Add the hook call immediately after:

```typescript
  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg            = segments[effectiveIndex];
  const nextSeg        = segments[effectiveIndex + 1];

  useLiveActivity({
    status,
    phase: seg.phase,
    phaseColor: T.phases[seg.phase],
    timeRemaining: Math.ceil(remainingInSegment),
    sessionName: session.name,
  });
```

- [ ] **Step 3: Commit**

```bash
git add src/screens/WorkoutScreen.tsx
git commit -m "feat: wire Live Activity updates into WorkoutScreen"
```

---

## Task 7: Xcode Build and Device Test

**Files:** none

This step requires a physical iPhone 14 Pro or newer (Dynamic Island) running iOS 16.4+. The simulator does not support Live Activities.

- [ ] **Step 1: Verify the project builds**

1. In Xcode, select your physical device from the device picker at the top (not a simulator — Live Activities are not supported in the simulator).
2. Press **⌘B** (Build Only) first.
3. Expected: build succeeds with no errors. Common errors to look for:
   - `"use of undeclared type 'WorkoutActivityAttributes'"` in `LiveActivityModule.swift` → `WorkoutActivityAttributes.swift` was not added to the `ClearHiiT` target (Task 3 Step 2)
   - `"Multiple commands produce..."` or `@main` conflict → Xcode's template `.swift` files were not deleted (Task 2 Step 6)
4. Fix any errors before continuing.

- [ ] **Step 2: Run on device**

Press **⌘R**. Xcode compiles both the `ClearHiiT` app and the `WorkoutLiveActivity` extension, then installs both on the device.

- [ ] **Step 3: Verify Live Activity starts**

1. Open the app on the device.
2. Start a workout.
3. Lock the screen (press power button).
4. Verify: a Live Activity banner appears on the Lock Screen showing phase label (e.g. "WARM UP") and countdown timer.

- [ ] **Step 4: Verify Dynamic Island**

1. While workout is running, press the Home button (swipe up on Face ID devices) to background the app.
2. Verify: the Dynamic Island shows a colored dot (leading) and countdown number (trailing).
3. Long-press the Dynamic Island — verify the expanded view shows phase label, countdown, and session name.

- [ ] **Step 5: Verify cleanup**

1. Let the workout finish (or press stop/reset).
2. Verify: the Live Activity disappears from the Lock Screen and Dynamic Island.

- [ ] **Step 6: Verify background countdown**

1. Start a workout.
2. Lock the screen.
3. Wait 10–15 seconds.
4. Unlock: verify the countdown has been ticking accurately (matches what the timer would show).

---

## Self-Review

**Spec coverage:**
- ✅ Dynamic Island compact view (leading dot + trailing countdown)
- ✅ Dynamic Island expanded view (phase label + countdown + session name)
- ✅ Lock Screen banner (phase label + countdown)
- ✅ Updates while screen locked (JS timer + background audio session already running)
- ✅ Ends cleanly on workout finish and reset
- ✅ Ends on component unmount (back button mid-workout)
- ✅ iOS only (`Platform.OS === 'ios'` guard + NativeModules null check)
- ✅ No `prebuild --clean` required — only Xcode target + file additions

**Type consistency:**
- `WorkoutActivityAttributes.ContentState` fields: `phase: String`, `phaseLabel: String`, `timeRemaining: Int`, `phaseColor: String` — consistent across `.swift`, `LiveActivityModule.swift`, `liveActivity.ts`, and `useLiveActivity.ts`
- `PHASE_META[params.phase].word` maps Phase → display label consistently with the app's existing display logic

**Known constraint:**
- `NativeModules.LiveActivityModule` will be `undefined` in Expo Go and on Android — the `isSupported` guard handles this silently
- The RCT_EXTERN_MODULE bridge works via React Native's interop layer even with New Architecture enabled
