import CoreData
import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var mutedSessionId: String?
  @Environment(\.scenePhase) private var scenePhase

  var body: some View {
    NavigationStack {
      SessionListView()
        // Pushed onto the same stack as the list-tap path (not
        // .fullScreenCover) — watchOS always renders its own system dismiss
        // chrome on sheet/fullScreenCover presentations with no way to
        // suppress it, so a real push is the only way to get a single,
        // hideable back button for both launch paths.
        .navigationDestination(item: $deepLinkedSession) { session in
          SessionRunView(
            session: session,
            autoStart: deepLinkedResumeElapsed == nil,
            resumeElapsed: deepLinkedResumeElapsed,
            onDismiss: {
              // Only worth muting if the phone is still broadcasting this same
              // session as of this dismiss — otherwise (e.g. its own broadcast
              // already cleared) there's no live heartbeat left to guard
              // against, and leaving the mute set would just block the very
              // next legitimate start of this same session.
              mutedSessionId = connectivity.liveSession?.sessionId == session.id ? session.id : nil
            }
          )
        }
    }
    .onAppear {
      // Ensures the complication reflects the latest installed code/content
      // rather than a stale cached render from before this launch.
      WidgetCenter.shared.reloadTimelines(ofKind: recentSessionWidgetKind)
      checkForLiveSession()
    }
    .onChange(of: connectivity.liveSession) { _, _ in
      checkForLiveSession()
    }
    .onChange(of: scenePhase) { _, newPhase in
      guard newPhase == .active else { return }
      connectivity.refreshFromReceivedContext()
      checkForLiveSession()
    }
    // The live-session heartbeat (WatchConnectivity) usually lands well before
    // CloudKit finishes merging the corresponding session onto the watch's own
    // store, so the fetchSession lookup below can miss on the first pass —
    // retry once that merge actually lands, same pattern SessionListView uses.
    .onReceive(
      NotificationCenter.default.publisher(
        for: .NSManagedObjectContextObjectsDidChange,
        object: WorkoutStore.shared.container.viewContext
      )
    ) { _ in
      checkForLiveSession()
    }
  }

  private func checkForLiveSession() {
    guard let live = connectivity.liveSession else { mutedSessionId = nil; return }
    guard live.status != "finished", live.status != "terminated" else { return } // never auto-launch a session that's already over
    guard deepLinkedSession == nil,
          let session = WorkoutStore.shared.fetchSession(id: live.sessionId) else { return }
    // Stay muted for this sessionId no matter how new the incoming updatedAt gets —
    // the phone's heartbeat keeps advancing updatedAt every ~2s, which would otherwise
    // immediately defeat a dismiss. The mute only lifts once this broadcast clears
    // (handled above) or a different session starts broadcasting.
    if live.sessionId == mutedSessionId { return }
    let action = nextLiveSessionAction(currentSessionId: connectivity.activeSessionId, lastAppliedUpdatedAt: nil, incoming: live, now: Date())
    guard case let .launchNew(_, resumeElapsed) = action else { return }
    deepLinkedResumeElapsed = resumeElapsed
    deepLinkedSession = session
  }
}

#Preview {
  ContentView()
}
