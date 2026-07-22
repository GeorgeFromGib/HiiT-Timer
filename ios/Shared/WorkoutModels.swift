// ios/Shared/WorkoutModels.swift
import Foundation

enum Phase: String, Codable, CaseIterable {
  case warmup, work, rest, cooldown, circuitRest, finish
}

struct Segment: Equatable {
  let phase: Phase
  let duration: Double
  let startAt: Double
  let endAt: Double
  let index: Int
  var speed: Double? = nil
  var incline: Double? = nil
}

struct WorkoutConfig: Codable {
  let warmup: Double
  let high: Double
  let low: Double
  let rounds: Int
  let cooldown: Double
}

let phaseWord: [Phase: String] = [
  .warmup: "WARM UP",
  .work: "WORK",
  .rest: "RECOVER",
  .cooldown: "COOL DOWN",
  .circuitRest: "BREAK",
  .finish: "",
]

/// Clock-style format for the live timer display: "45", "1:30", "2:05:30".
func fmtTimer(_ seconds: Double) -> String {
  let s = max(0, Int(seconds.rounded(.up)))
  if s >= 3600 {
    let h = s / 3600, m = (s % 3600) / 60, sec = s % 60
    return String(format: "%d:%02d:%02d", h, m, sec)
  }
  if s < 60 { return "\(s)" }
  return String(format: "%02d:%02d", s / 60, s % 60)
}
