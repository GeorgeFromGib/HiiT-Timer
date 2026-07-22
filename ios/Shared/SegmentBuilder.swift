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
