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

  guard session.activityType == "run", let speeds = session.runSpeeds else { return base }
  let overrides = session.mode == "advanced" ? session.intervals : nil
  let inclineEnabled = session.inclineEnabled != false

  return base.enumerated().map { i, seg in
    var s = seg
    let override = overrides?.indices.contains(i) == true ? overrides?[i] : nil
    s.speed = override?.speed ?? speedForPhase(seg.phase, speeds)
    if inclineEnabled, let inclines = session.runInclines {
      s.incline = override?.incline ?? inclineForPhase(seg.phase, inclines)
    }
    return s
  }
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
