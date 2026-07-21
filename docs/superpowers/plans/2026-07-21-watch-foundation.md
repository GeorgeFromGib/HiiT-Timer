# Watch App Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
>
> **Human-in-the-loop notice:** Task 2, Step 1 requires interactive use of the Xcode GUI (target creation wizard). This cannot be automated by an AI agent driving a terminal. A human must perform that one step, then hand control back for the remaining CLI-driven steps.

**Goal:** Add a minimal, buildable watchOS App target to the existing `ClearHiiT` Xcode project, proving the scaffolding works end-to-end (target exists, builds, installs on a paired watch simulator) before any real feature code (Core Data/CloudKit sync, session engine, HealthKit) is written on top of it.

**Architecture:** A second Xcode target, `ClearHiiTWatch Watch App` (product name entered in the Xcode wizard; bundle id `com.georgefromgib.hiittimer.watchkitapp`), is added directly to `ios/ClearHiiT.xcodeproj` via Xcode's target wizard and embedded in the existing `ClearHiiT` companion app via the auto-generated "Embed Watch Content" build phase. No CocoaPods, no Expo config-plugin involvement — the watch target uses only first-party Apple frameworks (SwiftUI to start; Core Data/CloudKit/HealthKit/WatchConnectivity come in later plans).

**Tech Stack:** Xcode 26.6, Swift 5.x/SwiftUI, watchOS Simulator (via `xcrun simctl`), no third-party dependencies.

## Global Constraints

- iOS deployment target: `16.4` (existing `ClearHiiT` target — do not lower or raise it).
- Apple Development Team: `KM666T7T27` (must match on the new watch target for it to build/sign).
- Container app bundle identifier: `com.georgefromgib.hiittimer`. Watch app bundle identifier must be `com.georgefromgib.hiittimer.watchkitapp` (Apple's required companion-app naming convention — CloudKit container and entitlements in later plans depend on this exact string).
- watchOS deployment target for the new target: `10.0` (wide device coverage; Double Tap gesture support from the spec's v2 phase needs watchOS 26 and will be raised later if required — not a concern for this plan).
- No CocoaPods dependencies are to be added for the watch target in this plan. `ios/Podfile` is not modified.
- Do not run `npx expo prebuild --clean`. This repo's `ios/` directory is a tracked, hand-maintained native project (see `.gitignore`: "ios - track custom native files, ignore generated artifacts"), not a purely regenerated CNG project. A clean prebuild would not know about the manually-added watch target and could strip it back out — if one is ever run, the watch target must be re-added via this plan's Task 2.
- Explicitly out of scope for this plan: Core Data, CloudKit, HealthKit, WatchConnectivity, EAS Build/provisioning-profile updates for the new target, and any real UI. Those are follow-up plans once this scaffold is verified.

---

### Task 1: Install the watchOS Simulator platform and create a paired device

**Files:** None (Xcode/simulator environment setup only — no repo files change in this task).

**Interfaces:**
- Consumes: nothing.
- Produces: a booted, paired `iPhone` + `Apple Watch` simulator pair that Task 3/4 will build and install against. Record the exact watch simulator UDID printed in Step 3 — later tasks refer to it as `<WATCH_UDID>`.

- [ ] **Step 1: Check what's currently installed**

Run: `xcrun simctl list runtimes`
Expected (before this task): only `iOS 26.5 (26.5 - 23F77) - com.apple.CoreSimulator.SimRuntime.iOS-26-5` — no `watchOS` line.

- [ ] **Step 2: Download the watchOS Simulator platform**

Run: `xcodebuild -downloadPlatform watchOS`
Expected: progress output ending in `Installing...` then a success message (this can take several minutes and requires network access).

- [ ] **Step 3: Verify the runtime installed and capture its identifier**

Run: `xcrun simctl list runtimes | grep -i watch`
Expected: a line like `watchOS 26.0 (26.0 - 23R...) - com.apple.CoreSimulator.SimRuntime.watchOS-26-0`. Note the full identifier string (`com.apple.CoreSimulator.SimRuntime.watchOS-26-0` or whatever version actually installs) — call it `<WATCH_RUNTIME_ID>` in later steps.

- [ ] **Step 4: Create a watch simulator device**

Run: `xcrun simctl create "Apple Watch Series 10 (46mm)" "com.apple.CoreSimulator.SimDeviceType.Apple-Watch-Series-10-46mm" <WATCH_RUNTIME_ID>`
Expected: prints a UDID (this is `<WATCH_UDID>`).

- [ ] **Step 5: Pair the watch simulator with an existing iPhone simulator**

This repo's machine already has an `iPhone 17 Pro` simulator (UDID `56F56D92-9F03-4EBF-92E5-313E2E1D39D0` at time of writing — confirm with `xcrun simctl list devices available | grep "iPhone 17 Pro"` since UDIDs can change).

Run: `xcrun simctl pair <WATCH_UDID> 56F56D92-9F03-4EBF-92E5-313E2E1D39D0`
Expected: prints a pair UDID. Verify with `xcrun simctl list pairs` — should show `(active, connected)`.

- [ ] **Step 6: Boot both simulators**

Run: `xcrun simctl boot 56F56D92-9F03-4EBF-92E5-313E2E1D39D0 2>/dev/null; xcrun simctl boot <WATCH_UDID>`
Expected: no error (or "already booted" if the iPhone sim was already running).

---

### Task 2: Add the `ClearHiiTWatch Watch App` target in Xcode

> **Deviation note (recorded during execution):** the plan originally specified product name `ClearHiiTWatch`. The target was actually created with product name `ClearHiiTWatch Watch App` (Xcode's default suggestion), which is what the target, scheme, app bundle, and folder are named below. The bundle identifier, team, and watchOS deployment target all landed exactly as specified — only the display/target name has the extra " Watch App" suffix. Confirmed via `xcodebuild -showBuildSettings`: `DEVELOPMENT_TEAM = KM666T7T27`, `PRODUCT_BUNDLE_IDENTIFIER = com.georgefromgib.hiittimer.watchkitapp`, `WATCHOS_DEPLOYMENT_TARGET = 10.0`.

**Files:**
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj` (via Xcode GUI — do not hand-edit)
- Create: `ios/ClearHiiTWatch Watch App/ClearHiiTWatchApp.swift`
- Create: `ios/ClearHiiTWatch Watch App/ContentView.swift`
- Create: `ios/ClearHiiTWatch Watch App/Assets.xcassets/`
- Create: `ios/ClearHiiTWatch Watch App/Preview Content/Preview Assets.xcassets/`

**Interfaces:**
- Consumes: existing `ClearHiiT` target (team `KM666T7T27`, bundle id `com.georgefromgib.hiittimer`, iOS deployment target `16.4`).
- Produces: new target `ClearHiiTWatch Watch App` (scheme `ClearHiiTWatch Watch App`), bundle id `com.georgefromgib.hiittimer.watchkitapp`, embedded in `ClearHiiT` via the "Embed Watch Content" build phase. Later plans add files under `ios/ClearHiiTWatch Watch App/`.

- [x] **Step 1 (manual, human only): Create the target in Xcode** — DONE by George. Product Name entered was `ClearHiiTWatch Watch App` (see deviation note above); all other fields matched.

1. Open `ios/ClearHiiT.xcworkspace` in Xcode.
2. File → New → Target…
3. Select the **watchOS** tab → **App** → Next.
4. Fill in the wizard exactly:
   - Product Name: `ClearHiiTWatch`
   - Team: `KM666T7T27`
   - Organization Identifier: leave as whatever the wizard inherited (should combine to `com.georgefromgib.hiittimer.watchkitapp` — if it doesn't, fix the Bundle Identifier field directly to that exact string)
   - Interface: `SwiftUI`
   - Language: `Swift`
   - Include Notification Scene: unchecked
   - Project: `ClearHiiT`
   - Embed in Companion Application: `ClearHiiT`
5. Click Finish. When Xcode prompts "Activate scheme?", click **Activate**.
6. Select the new `ClearHiiTWatch` target → General tab → confirm **Minimum Deployments** watchOS version. Set it to `10.0` if the wizard defaulted to something newer.

- [x] **Step 2: Verify the target and scheme exist** — DONE. Actual output:
```
Information about project "ClearHiiT":
    Targets:
        ClearHiiT
        ClearHiiTWatch Watch App

    Build Configurations:
        Debug
        Release

    Schemes:
        ClearHiiT
        ClearHiiTWatch Watch App
```

- [x] **Step 3: Verify build settings landed correctly** — DONE. Actual output (target name substituted per the deviation note above):
```
DEVELOPMENT_TEAM = KM666T7T27
PRODUCT_BUNDLE_IDENTIFIER = com.georgefromgib.hiittimer.watchkitapp
WATCHOS_DEPLOYMENT_TARGET = 10.0
```
All values match the plan's required constraints exactly.

---

### Task 3: Customize the smoke-test screen and build for the watch simulator

**Files:**
- Modify: `ios/ClearHiiTWatch Watch App/ContentView.swift`

**Interfaces:**
- Consumes: `ClearHiiTWatch Watch App` target from Task 2.
- Produces: a distinguishable on-screen string (`"ClearHiiT Watch — Foundation OK"`) that Task 4 verifies visually.

- [ ] **Step 1: Read the generated file**

Xcode's watchOS App template generates `ContentView.swift` with a `Text("Hello, World!")`. Confirm the exact generated content before editing:
Run: `cat "ios/ClearHiiTWatch Watch App/ContentView.swift"`

- [ ] **Step 2: Replace the placeholder text**

Change the `Text("Hello, World!")` line to:
```swift
Text("ClearHiiT Watch — Foundation OK")
    .multilineTextAlignment(.center)
```

- [x] **Step 3: Build for the watch simulator** — DONE (corrected command; see deviation note).

> **Deviation note (recorded during execution):** the plan originally specified `-project ClearHiiT.xcodeproj`. This repo integrates CocoaPods (`ios/Podfile`, `ios/Pods/`), and Xcode only wires the Pods-generated module maps through the `.xcworkspace`, not the bare `.xcodeproj`. Building with `-project` failed with `module map file ... not found` / `no such module 'Expo'` errors for the main `ClearHiiT` target (which the watch scheme also builds/embeds). Fixed by building via `-workspace` instead. Task 5 Step 1's phone-target build command below is corrected the same way.

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme "ClearHiiTWatch Watch App" -destination "platform=watchOS Simulator,name=Apple Watch Series 10 (46mm)" 2>&1 | tail -20`
Expected: last line `** BUILD SUCCEEDED **`. Confirmed.

---

### Task 4: Install, launch, and visually verify on the paired watch simulator

**Files:** None.

**Interfaces:**
- Consumes: the built `.app` product from Task 3, `<WATCH_UDID>` from Task 1.
- Produces: a screenshot proving the smoke-test text renders on-device.

- [ ] **Step 1: Locate the built .app bundle**

Run: `find ~/Library/Developer/Xcode/DerivedData -iname "ClearHiiTWatch Watch App.app" -path "*watchsimulator*" 2>/dev/null | head -1`
Expected: a path like `.../Build/Products/Debug-watchsimulator/ClearHiiTWatch Watch App.app`. Call this `<APP_PATH>`.

- [ ] **Step 2: Install it on the watch simulator**

Run: `xcrun simctl install <WATCH_UDID> <APP_PATH>`
Expected: no output on success.

- [ ] **Step 3: Launch it**

Run: `xcrun simctl launch <WATCH_UDID> com.georgefromgib.hiittimer.watchkitapp`
Expected: prints `com.georgefromgib.hiittimer.watchkitapp: <pid>`.

- [ ] **Step 4: Screenshot and visually confirm**

Run: `xcrun simctl io <WATCH_UDID> screenshot /private/tmp/claude-501/-Users-george-dev-react-native-hiit-timer/65d3a59b-4808-4828-bb95-be696f04cab8/scratchpad/watch-foundation-smoke-test.png`
Then read the resulting PNG (e.g. with the Read tool) and confirm it shows the text "ClearHiiT Watch — Foundation OK" on a watch face outline. If it shows the unmodified "Hello, World!" instead, Task 3 Step 2's edit didn't take effect — rebuild and reinstall.

---

### Task 5: Regression-check the phone app and commit

**Files:**
- Add: `ios/ClearHiiTWatch Watch App/` (all files from Task 2)
- Modify: `ios/ClearHiiT.xcodeproj/project.pbxproj`

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: a committed, working two-target Xcode project ready for the next plan (library sync).

- [ ] **Step 1: Confirm the existing phone target still builds unaffected**

Run: `cd ios && xcodebuild build -workspace ClearHiiT.xcworkspace -scheme ClearHiiT -destination "platform=iOS Simulator,name=iPhone 17 Pro" 2>&1 | tail -20`
Expected: last line `** BUILD SUCCEEDED **`. If this fails but Task 3's watch build succeeded, the target-embedding step (Task 2, Step 1) broke the container app — investigate the "Embed Watch Content" build phase on the `ClearHiiT` target before continuing.

- [ ] **Step 2: Review what changed**

Run: `git status`
Expected: new untracked directory `ios/ClearHiiTWatch Watch App/` and a modified `ios/ClearHiiT.xcodeproj/project.pbxproj`. No changes outside `ios/`.

- [ ] **Step 3: Commit**

```bash
git add "ios/ClearHiiTWatch Watch App" ios/ClearHiiT.xcodeproj/project.pbxproj
git commit -m "feat: scaffold ClearHiiTWatch Watch App target as watch app foundation"
```
