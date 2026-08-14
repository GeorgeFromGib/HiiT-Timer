// ios/Shared/RecentSessionStore.swift
import Foundation
import WidgetKit

/// Widget kind identifier shared between the app (which reloads this widget's
/// timeline after recording a session) and the widget extension (which
/// registers itself under this kind) — keeping it here, in the one file both
/// targets include, keeps the two from ever drifting apart.
// Renamed from "RecentSessionComplication" once to force watchOS to treat
// this as a brand-new complication with no cached gallery/picker state —
// the system's complication picker cache proved sticky across reinstalls
// and device restarts alike.
let recentSessionWidgetKind = "RecentSessionComplicationV2"

private let appGroupSuiteName = "group.com.georgefromgib.hiittimer"
private let recentSessionDefaultsKey = "watch.recentSession"

struct RecentSession: Codable, Equatable {
  let id: String
  let name: String
  let ranAt: Date
}

/// Records the most recently started watch session to an App Group-shared
/// UserDefaults suite, so the RecentSessionComplication widget extension (a
/// separate process) can read it and offer a one-tap restart. Falls back to
/// `.standard` if the App Group container isn't reachable (e.g. before the
/// entitlement is wired up in Task 3) rather than crashing.
struct RecentSessionStore {
  private let defaults: UserDefaults

  init(defaults: UserDefaults = UserDefaults(suiteName: appGroupSuiteName) ?? .standard) {
    self.defaults = defaults
  }

  func record(id: String, name: String, now: Date = Date()) {
    let recent = RecentSession(id: id, name: name, ranAt: now)
    guard let data = try? JSONEncoder().encode(recent) else { return }
    defaults.set(data, forKey: recentSessionDefaultsKey)
    WidgetCenter.shared.reloadTimelines(ofKind: recentSessionWidgetKind)
  }

  func fetch() -> RecentSession? {
    guard let data = defaults.data(forKey: recentSessionDefaultsKey) else { return nil }
    return try? JSONDecoder().decode(RecentSession.self, from: data)
  }
}
