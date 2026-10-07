// ios/Shared/WorkoutModels.swift
import Foundation

enum Phase: String, Codable, CaseIterable, Hashable {
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
  var activityLabel: String? = nil
  var circuitNumber: Int? = nil
  var resistance: Double? = nil
  var power: Double? = nil
  var cooldownTaper: Bool = false
}

struct WorkoutConfig: Codable, Hashable {
  let warmup: Double
  let high: Double
  let low: Double
  let rounds: Int
  let cooldown: Double
}

struct IntervalDTO: Codable, Hashable {
  let type: Phase
  let dur: Double
  let speed: Double?
  let incline: Double?
  var activityLabel: String? = nil
  var resistance: Double? = nil
  var power: Double? = nil
  var cooldownTaper: Bool? = nil
}

/// Mirrors src/lib/sessions.ts's SpinValues.
struct SpinValuesDTO: Codable, Hashable {
  let warmupResistance: Double
  let warmupPower: Double
  let workResistance: Double
  let workPower: Double
  let restResistance: Double
  let restPower: Double
  let cooldownResistance: Double
  let cooldownPower: Double
}

/// Mirrors src/lib/sessions.ts's DEFAULT_SPIN_VALUES.
let defaultSpinValues = SpinValuesDTO(
  warmupResistance: 3, warmupPower: 85,
  workResistance: 5, workPower: 120,
  restResistance: 2, restPower: 60,
  cooldownResistance: 3, cooldownPower: 85
)

struct RunSpeeds: Codable, Hashable {
  let warmupSpeed: Double
  let workSpeed: Double
  let restSpeed: Double
  let cooldownSpeed: Double
}

struct RunInclines: Codable, Hashable {
  let warmupIncline: Double
  let workIncline: Double
  let restIncline: Double
  let cooldownIncline: Double
}

/// Mirrors src/lib/sessions.ts's DEFAULT_RUN_INCLINES (INCLINE_PRESETS['3']).
let defaultRunInclines = RunInclines(warmupIncline: 1.5, workIncline: 4, restIncline: 1.5, cooldownIncline: 1)

struct SessionDTO: Codable, Hashable {
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
  var circuits: Int? = nil
  var warmup: Double? = nil
  var cooldown: Double? = nil
  var circuitRest: Double? = nil
  var spinValues: SpinValuesDTO? = nil
  var cooldownTaper: Bool? = nil
  /// Circuit sessions created as the Tabata type (src/lib/sessions.ts). Runs as an
  /// ordinary circuit — this only identifies the type (e.g. for History).
  var tabata: Bool? = nil

  /// Standard (no activityType), Treadmill (activityType == "run"), and
  /// Spinning (activityType == "spinning") sessions run in easy or advanced
  /// mode; Circuit sessions run via their own circuits/warmup/cooldown/circuitRest
  /// fields. Walk still syncs to Core Data but isn't runnable on the watch yet.
  var isRunnableInV1: Bool {
    mode == "circuit" || ((mode == "easy" || mode == "advanced") && (activityType == nil || activityType == "run" || activityType == "spinning"))
  }

  var isTreadmill: Bool {
    activityType == "run"
  }

  var isTabata: Bool {
    mode == "circuit" && tabata == true
  }

  var isSpinning: Bool {
    activityType == "spinning"
  }
}

extension SessionDTO: Identifiable {}

/// Mirrors src/lib/sessions.ts's Folder. Icon rendering is out of scope on the
/// watch — folder rows use a generic systemImage instead.
struct FolderDTO: Identifiable {
  let id: String
  let name: String
  let orderIndex: Int
}

/// Drops duplicate folder ids, keeping the first occurrence. CloudKit-backed
/// Core Data has no unique constraint on `id`, so the same logical folder can
/// end up as more than one FolderRecord; mirrors the seenIds guard
/// decodeRunnableSessions already applies to SessionRecord for the same reason.
func dedupeFoldersById(_ folders: [FolderDTO]) -> [FolderDTO] {
  var seenIds = Set<String>()
  var result: [FolderDTO] = []
  for folder in folders {
    guard !seenIds.contains(folder.id) else { continue }
    seenIds.insert(folder.id)
    result.append(folder)
  }
  return result
}

/// Mirrors src/locales/{en,es,fr,de}.ts's `run.phase` block. Keyed by
/// Settings.language, synced from the phone via WorkoutSync/PreferenceRecord
/// (see WorkoutStore.fetchLanguage) since the watch has no i18n system of
/// its own.
private let phaseWordsByLanguage: [String: [Phase: String]] = [
  "en": [.warmup: "WARM UP", .work: "WORK", .rest: "RECOVER", .cooldown: "COOL DOWN", .circuitRest: "BREAK", .finish: ""],
  "es": [.warmup: "CALENTAMIENTO", .work: "TRABAJO", .rest: "RECUPERA", .cooldown: "ENFRIAMIENTO", .circuitRest: "PAUSA", .finish: ""],
  "fr": [.warmup: "ÉCHAUFFEMENT", .work: "TRAVAIL", .rest: "RÉCUPÉRATION", .cooldown: "RETOUR AU CALME", .circuitRest: "PAUSE", .finish: ""],
  "de": [.warmup: "AUFWÄRMEN", .work: "ARBEIT", .rest: "ERHOLUNG", .cooldown: "ABKÜHLEN", .circuitRest: "PAUSE", .finish: ""],
]

func phaseWords(forLanguage language: String) -> [Phase: String] {
  phaseWordsByLanguage[language] ?? phaseWordsByLanguage["en"]!
}

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
