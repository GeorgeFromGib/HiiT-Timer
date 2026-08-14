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
          .padding(4)
          // Full-color faces use the original artwork as-is; the gallery
          // picker and any watch face that renders this complication in
          // vibrant/accented (monochrome) mode need this opt-in or the
          // image draws as nothing at all, even though the asset itself
          // is valid — SwiftUI won't synthesize a vibrant version of a
          // non-template image without it.
          .widgetAccentable()
      }
    }
    .containerBackground(.clear, for: .widget)
  }
}

struct ClearHiiTWatchComplication: Widget {
  var body: some WidgetConfiguration {
    StaticConfiguration(kind: recentSessionWidgetKind, provider: RecentSessionProvider()) { entry in
      RecentSessionWidgetEntryView(entry: entry)
    }
    .configurationDisplayName("ClearHiiT")
    .description("Tap to open the app.")
    .supportedFamilies([.accessoryCircular, .accessoryRectangular, .accessoryCorner, .accessoryInline])
  }
}
