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

struct IntervalDTO: Codable {
  let type: Phase
  let dur: Double
  let speed: Double?
  let incline: Double?
}

struct RunSpeeds: Codable {
  let warmupSpeed: Double
  let workSpeed: Double
  let restSpeed: Double
  let cooldownSpeed: Double
}

struct RunInclines: Codable {
  let warmupIncline: Double
  let workIncline: Double
  let restIncline: Double
  let cooldownIncline: Double
}

struct SessionDTO: Codable {
  let id: String
  let name: String
  let folderId: String
  let activityType: String?
  let runSpeeds: RunSpeeds?
  let runInclines: RunInclines?
  let inclineEnabled: Bool?
  let mode: String
  let config: WorkoutConfig?
  let intervals: [IntervalDTO]?

  /// v1 supports Standard (no activityType) and Treadmill (activityType == "run")
  /// sessions in easy or advanced mode. Circuit mode and walk/spinning activity
  /// types sync to Core Data but aren't runnable on the watch until v2.
  var isRunnableInV1: Bool {
    (mode == "easy" || mode == "advanced") && (activityType == nil || activityType == "run")
  }
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
