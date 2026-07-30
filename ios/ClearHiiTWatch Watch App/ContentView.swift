import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?
  @State private var deepLinkedResumeElapsed: Double?
  @StateObject private var connectivity = WatchSessionReceiver.shared
  @State private var resumeOffer: LiveSessionState?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(session: session, autoStart: deepLinkedResumeElapsed == nil, resumeElapsed: deepLinkedResumeElapsed)
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
      checkForResumableSession()
    }
    .onChange(of: connectivity.liveSession) { _, _ in
      checkForResumableSession()
    }
    .confirmationDialog(
      "Resume \"\(resumeOffer?.name ?? "")\" from iPhone?",
      isPresented: Binding(get: { resumeOffer != nil }, set: { if !$0 { resumeOffer = nil } }),
      presenting: resumeOffer
    ) { offer in
      Button("Resume") {
        guard let session = WorkoutStore.shared.fetchSession(id: offer.sessionId) else {
          resumeOffer = nil
          return
        }
        deepLinkedResumeElapsed = resumeElapsed(for: offer, now: Date())
        deepLinkedSession = session
        resumeOffer = nil
      }
      Button("Dismiss", role: .cancel) { resumeOffer = nil }
    }
  }

  private func checkForResumableSession() {
    guard resumeOffer == nil, deepLinkedSession == nil,
          let live = connectivity.liveSession, isLiveSessionFresh(live, now: Date()) else { return }
    resumeOffer = live
  }
}

#Preview {
  ContentView()
}
