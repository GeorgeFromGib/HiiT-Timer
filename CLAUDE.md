# CLAUDE.md

@AGENTS.md

Background audio reliability **will not work in Expo Go**. Test on a dev build:

### Navigation

No React Navigation library — `App.tsx` holds a `Route` state and switches between screens manually. Routes are typed in `src/navigation.ts`:


### iOS background reliability

The silent keep-alive audio track is what defeats iOS JS timer throttling when the screen is locked. This requires:
1. `shouldPlayInBackground: true` in `setAudioModeAsync`
2. `UIBackgroundModes: ["audio"]` in `app.json` under `expo.ios.infoPlist` — **already set**
3. A development build (not Expo Go)

### `expo-audio` API note

`expo-audio` is still evolving. Always verify `setAudioModeAsync` option names and `AudioPlayer` methods against the installed version's docs before writing audio code.

## Design Files

Implement pixel-close to the designs. Colors, spacing, and interactions are final.

### Versioning

Format is `MAJOR.MINOR.PATCH`:
- MAJOR — breaking change or significant new product (rare, usually signals a full rewrite or incompatible data migration)
- MINOR — new features, backwards compatible
- PATCH — bug fixes, no new features

### Planning
- When you have finshed written a plan from a spec ask if you should run the karpathy skill on it.

## graphify

This project has a knowledge graph at graphify-out/ with god nodes, community structure, and cross-file relationships.

Rules:
- For codebase questions, first run `graphify query "<question>"` when graphify-out/graph.json exists. Use `graphify path "<A>" "<B>"` for relationships and `graphify explain "<concept>"` for focused concepts. These return a scoped subgraph, usually much smaller than GRAPH_REPORT.md or raw grep output.
- If graphify-out/wiki/index.md exists, use it for broad navigation instead of raw source browsing.
- Read graphify-out/GRAPH_REPORT.md only for broad architecture review or when query/path/explain do not surface enough context.
- After modifying code, run `graphify update .` to keep the graph current (AST-only, no API cost).

## Self-learning

When I correct you, or you catch yourself making a mistake: before continuing,
add the lesson as a one-line rule under ## Lessons, so it never happens again.

## Lessons

- For Swift builds/tests (`xcodebuild`), always pass `-workspace ios/ClearHiiT.xcworkspace`, never `-project ios/ClearHiiT.xcodeproj` — the bare `.xcodeproj` skips CocoaPods' `Pods.xcodeproj`, causing "module map not found" / "No such module 'Expo'" errors unrelated to any code change.
- Watch complication images (`ComplicationIcon.imageset`) must stay small (~48×48) — a 128×128 asset rendered as a blank grey placeholder on a real watch despite being byte-correct (verified via simulator build + binary extraction) and despite fixing alpha/opacity/ICC-profile; simulator and asset-extraction checks did not reproduce the failure, only real hardware did. Keep new complication art at the old asset's resolution rather than shipping high-res source images as-is.
