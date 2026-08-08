import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var mutedSessionId: String?
  @State private var mutedAsOf: Date?

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
          mutedAsOf = connectivity.liveSession?.updatedAt
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
    guard deepLinkedSession == nil, let live = connectivity.liveSession,
          let session = WorkoutStore.shared.fetchSession(id: live.sessionId) else { return }
    if live.sessionId == mutedSessionId, let mutedAsOf, live.updatedAt <= mutedAsOf { return }
    let action = nextLiveSessionAction(currentSessionId: nil, lastAppliedUpdatedAt: nil, incoming: live, now: Date())
    guard case let .launchNew(_, resumeElapsed) = action else { return }
    deepLinkedResumeElapsed = resumeElapsed
    deepLinkedSession = session
  }
}

#Preview {
  ContentView()
}
