// ios/Shared/SegmentBuilder.swift
import Foundation

func expandWorkout(_ cfg: WorkoutConfig) -> [Segment] {
  var raw: [(phase: Phase, duration: Double)] = []

  if cfg.warmup > 0 { raw.append((.warmup, cfg.warmup)) }
  for _ in 0..<cfg.rounds {
    raw.append((.work, cfg.high))
    if cfg.low > 0 { raw.append((.rest, cfg.low)) }
  }
  if cfg.cooldown > 0 { raw.append((.cooldown, cfg.cooldown)) }

  var cursor: Double = 0
  return raw.enumerated().map { i, s in
    let seg = Segment(phase: s.phase, duration: s.duration, startAt: cursor, endAt: cursor + s.duration, index: i)
    cursor += s.duration
    return seg
  }
}

func intervalsToSegments(_ intervals: [IntervalDTO]) -> [Segment] {
  var cursor: Double = 0
  return intervals.enumerated().map { i, iv in
    let seg = Segment(phase: iv.type, duration: iv.dur, startAt: cursor, endAt: cursor + iv.dur, index: i)
    cursor += iv.dur
    return seg
  }
}

/// Ports src/lib/workout.ts's expandCircuit() — repeats `intervals` for each of
/// `circuits` rounds, tagging every segment in round N with circuitNumber N,
/// with a circuitRest between rounds (never after the last) and warmup/cooldown
/// bookending the whole thing.
func expandCircuit(
  _ intervals: [IntervalDTO],
  circuits: Int,
  warmup: Double,
  cooldown: Double,
  circuitRest: Double
) -> [Segment] {
  var raw: [(phase: Phase, duration: Double, activityLabel: String?, circuitNumber: Int?)] = []

  if warmup > 0 {
    raw.append((.warmup, warmup, nil, nil))
  }

  for c in 0..<circuits {
    for iv in intervals {
      raw.append((iv.type, iv.dur, iv.activityLabel, c + 1))
    }
    if c + 1 < circuits && circuitRest > 0 {
      raw.append((.circuitRest, circuitRest, nil, nil))
    }
  }

  if cooldown > 0 {
    raw.append((.cooldown, cooldown, nil, nil))
  }

  var cursor: Double = 0
  return raw.enumerated().map { i, s in
    var seg = Segment(phase: s.phase, duration: s.duration, startAt: cursor, endAt: cursor + s.duration, index: i)
    seg.activityLabel = s.activityLabel
    seg.circuitNumber = s.circuitNumber
    cursor += s.duration
    return seg
  }
}

func speedForPhase(_ phase: Phase, _ speeds: RunSpeeds) -> Double {
  switch phase {
  case .warmup: return speeds.warmupSpeed
  case .work: return speeds.workSpeed
  case .rest, .circuitRest, .finish: return speeds.restSpeed
  case .cooldown: return speeds.cooldownSpeed
  }
}

func inclineForPhase(_ phase: Phase, _ inclines: RunInclines) -> Double {
  switch phase {
  case .warmup: return inclines.warmupIncline
  case .work: return inclines.workIncline
  case .rest, .circuitRest, .finish: return inclines.restIncline
  case .cooldown: return inclines.cooldownIncline
  }
}

/// Ports src/lib/sessions.ts's spinValueForPhase (resistance half).
func resistanceForPhase(_ phase: Phase, _ values: SpinValuesDTO) -> Double {
  switch phase {
  case .warmup: return values.warmupResistance
  case .work: return values.workResistance
  case .rest, .circuitRest, .finish: return values.restResistance
  case .cooldown: return values.cooldownResistance
  }
}

/// Ports src/lib/sessions.ts's spinValueForPhase (power half).
func powerForPhase(_ phase: Phase, _ values: SpinValuesDTO) -> Double {
  switch phase {
  case .warmup: return values.warmupPower
  case .work: return values.workPower
  case .rest, .circuitRest, .finish: return values.restPower
  case .cooldown: return values.cooldownPower
  }
}

func segmentsForSession(_ session: SessionDTO) -> [Segment] {
  if session.mode == "circuit" {
    return expandCircuit(
      session.intervals ?? [],
      circuits: session.circuits ?? 0,
      warmup: session.warmup ?? 0,
      cooldown: session.cooldown ?? 0,
      circuitRest: session.circuitRest ?? 0
    )
  }

  let base: [Segment]
  if session.mode == "advanced" {
    base = intervalsToSegments(session.intervals ?? [])
  } else {
    base = expandWorkout(session.config ?? WorkoutConfig(warmup: 0, high: 0, low: 0, rounds: 0, cooldown: 0))
  }

  let overrides = session.mode == "advanced" ? session.intervals : nil

  // Ports src/lib/sessions.ts's taperFlag — the taper decision travels on the
  // segment (per-interval in advanced mode, per-session in easy) so it survives
  // reindexing; taperedCooldownSegment reads it back at workout time.
  func taperFlag(_ phase: Phase, _ override: IntervalDTO?) -> Bool {
    guard phase == .cooldown else { return false }
    return session.mode == "advanced" ? (override?.cooldownTaper ?? false) : (session.cooldownTaper ?? false)
  }

  if session.activityType == "run", let speeds = session.runSpeeds {
    let inclineEnabled = session.inclineEnabled != false
    return base.enumerated().map { i, seg in
      var s = seg
      let override = overrides?.indices.contains(i) == true ? overrides?[i] : nil
      s.speed = override?.speed ?? speedForPhase(seg.phase, speeds)
      if inclineEnabled {
        let inclines = session.runInclines ?? defaultRunInclines
        s.incline = override?.incline ?? inclineForPhase(seg.phase, inclines)
      }
      s.cooldownTaper = taperFlag(seg.phase, override)
      return s
    }
  }

  if session.activityType == "spinning" {
    let sv = session.spinValues ?? defaultSpinValues
    return base.enumerated().map { i, seg in
      var s = seg
      let override = overrides?.indices.contains(i) == true ? overrides?[i] : nil
      s.resistance = override?.resistance ?? resistanceForPhase(seg.phase, sv)
      s.power = override?.power ?? powerForPhase(seg.phase, sv)
      s.cooldownTaper = taperFlag(seg.phase, override)
      return s
    }
  }

  return base
}

// ── Cooldown taper — ports src/lib/sessions.ts's cooldownTaperFactor /
// taperedCooldownSegment. See that file for the full rationale; kept in sync
// field-for-field so the watch shows the same stepped-down effort as the phone.
private let cooldownTaperCurve: [Double] = [0.75, 0.65, 0.6, 0.55, 0.5]
private let speedStep = 0.1

private func clamp01(_ n: Double) -> Double { min(1, max(0, n)) }

private func roundTo(_ v: Double, _ step: Double) -> Double {
  let inv = (1 / step).rounded()
  return (v * inv).rounded() / inv
}

private func lerpCurve(_ curve: [Double], _ progress: Double) -> Double {
  let p = clamp01(progress)
  let span = 1 / Double(curve.count - 1)
  let i = min(curve.count - 2, Int(floor(p / span)))
  return curve[i] + (curve[i + 1] - curve[i]) * ((p - Double(i) * span) / span)
}

func cooldownTaperFactor(_ progress: Double) -> Double {
  let step = min(0.75, floor(clamp01(progress) * 4) / 4)
  return lerpCurve(cooldownTaperCurve, step)
}

/// The last segment before `cooldownIndex` with a real effort set. Assumes
/// `segments[i].index == i`, true for every builder above.
private func priorEffortSegment(_ segments: [Segment], _ cooldownIndex: Int) -> Segment? {
  guard cooldownIndex > 0, cooldownIndex <= segments.count else { return nil }
  for i in stride(from: cooldownIndex - 1, through: 0, by: -1) {
    let s = segments[i]
    if let speed = s.speed, speed > 0 { return s }
    if let resistance = s.resistance, let power = s.power, resistance > 0 || power > 0 { return s }
  }
  return nil
}

/// The cooldown segment as it should be shown `progress` (0...1) of the way
/// through it. Returns `segments[index]` untouched when it isn't a tapering
/// cooldown or nothing before it had a usable effort.
func taperedCooldownSegment(_ segments: [Segment], index: Int, progress: Double) -> Segment? {
  guard index >= 0, index < segments.count else { return nil }
  let seg = segments[index]
  guard seg.phase == .cooldown, seg.cooldownTaper else { return seg }
  guard let prior = priorEffortSegment(segments, index) else { return seg }

  let f = cooldownTaperFactor(progress)
  var out = seg
  if let resistance = prior.resistance, let power = prior.power {
    out.resistance = max(1, (resistance * f).rounded())
    out.power = max(1, (power * f).rounded())
    return out
  }
  guard let priorSpeed = prior.speed else { return seg }
  let floor = (priorSpeed * 0.4 * 10 - 1e-9).rounded(.up) / 10
  out.speed = max(roundTo(f * priorSpeed, speedStep), floor)
  if prior.incline != nil { out.incline = 0 }
  return out
}

/// Exercises still to come in the wearer's current circuit round, in display
/// order — backs the Crown-scrollable "up next" list on SessionRunView. Empty
/// once the last exercise of the round is reached, or for non-circuit segments.
func upNextExercises(_ segments: [Segment], currentIndex: Int) -> [String] {
  guard let current = segments.first(where: { $0.index == currentIndex }),
        let circuitNumber = current.circuitNumber else { return [] }
  return segments
    .filter { $0.circuitNumber == circuitNumber && $0.index > currentIndex }
    .compactMap(\.activityLabel)
}

/// `blobs` is expected newest-first (see WorkoutStore.fetchRunnableSessions' sort
/// descriptor); CloudKit doesn't enforce uniqueness on the `id` field, so two
/// devices writing independently before their first sync can each produce a
/// SessionRecord with the same id, which CloudKit then merges as separate rows.
func decodeRunnableSessions(fromJSONBlobs blobs: [String]) -> [SessionDTO] {
  let decoder = JSONDecoder()
  var seenIds = Set<String>()
  var result: [SessionDTO] = []
  for json in blobs {
    guard let data = json.data(using: .utf8),
          let session = try? decoder.decode(SessionDTO.self, from: data),
          session.isRunnableInV1,
          !seenIds.contains(session.id) else { continue }
    seenIds.insert(session.id)
    result.append(session)
  }
  return result
}
