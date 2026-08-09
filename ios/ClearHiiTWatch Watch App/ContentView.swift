import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var mutedSessionId: String?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(
        session: session,
        autoStart: deepLinkedResumeElapsed == nil,
        resumeElapsed: deepLinkedResumeElapsed,
        onDismiss: {
          mutedSessionId = session.id
        }
      )
    }
    .onOpenURL { url in
      guard let id = sessionId(fromDeepLinkURL: url),
            let session = WorkoutStore.shared.fetchSession(id: id) else { return }
      deepLinkedResumeElapsed = nil
      deepLinkedSession = session
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
  }

  private func checkForLiveSession() {
    guard let live = connectivity.liveSession else { mutedSessionId = nil; return }
    guard live.status != "finished" else { return } // never auto-launch a session that's already over
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
