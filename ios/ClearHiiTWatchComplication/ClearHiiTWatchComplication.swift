// ClearHiiTWatchComplication/ClearHiiTWatchComplication.swift
import WidgetKit
import SwiftUI

struct RecentSessionEntry: TimelineEntry {
  let date: Date
  let recentSession: RecentSession?
}

struct RecentSessionProvider: TimelineProvider {
  func placeholder(in context: Context) -> RecentSessionEntry {
    RecentSessionEntry(date: Date(), recentSession: RecentSession(id: "placeholder", name: "Tabata", ranAt: Date()))
  }

  func getSnapshot(in context: Context, completion: @escaping (RecentSessionEntry) -> Void) {
    if context.isPreview {
      completion(placeholder(in: context))
      return
    }
    completion(RecentSessionEntry(date: Date(), recentSession: RecentSessionStore().fetch()))
  }

  func getTimeline(in context: Context, completion: @escaping (Timeline<RecentSessionEntry>) -> Void) {
    let entry = RecentSessionEntry(date: Date(), recentSession: RecentSessionStore().fetch())
    completion(Timeline(entries: [entry], policy: .never))
  }
}

struct RecentSessionWidgetEntryView: View {
  @Environment(\.widgetFamily) private var family
  let entry: RecentSessionEntry

  var body: some View {
    Group {
      switch family {
      case .accessoryInline:
        Text(entry.recentSession?.name ?? "Start a workout")
      default:
        Image("ComplicationIcon")
          .renderingMode(.original)
          .resizable()
          .scaledToFit()
          .clipShape(Circle())
      }
    }
    .widgetURL(deepLinkURL)
    .containerBackground(.clear, for: .widget)
  }

  private var deepLinkURL: URL? {
    guard let id = entry.recentSession?.id else { return nil }
    var components = URLComponents()
    components.scheme = "hiitwatch"
    components.host = "run"
    components.queryItems = [URLQueryItem(name: "id", value: id)]
    return components.url
  }
}

struct ClearHiiTWatchComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: recentSessionWidgetKind, provider: RecentSessionProvider()) { entry in
      RecentSessionWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("Last Workout")
    .description("One-tap restart for your most recently run session.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryCorner, .accessoryInline])
  }
}
