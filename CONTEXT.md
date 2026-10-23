# Domain language

**Session** — a saved workout template (`Session` in `src/lib/sessions.ts`, `SessionDTO` on the watch). Not a single run of it; that's a **History entry**.

**Session kind** — what sort of Session it is: `general | run | spinning | circuit | tabata` (`sessionKind()` in `src/lib/sessions.ts`, `SessionDTO.kind` in `ios/Shared/WorkoutModels.swift`). Derived from the stored `mode` + `activityType`; never stored itself. The Swift side adds `unsupported` for kinds the watch can't run (e.g. Walk). Per-kind rules (history type, cooldown-taper support, watch-runnable) live behind this seam, not in scattered `mode`/`activityType` checks.
