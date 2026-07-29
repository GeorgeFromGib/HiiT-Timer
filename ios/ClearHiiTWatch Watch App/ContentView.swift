import SwiftUI
import WidgetKit

struct ContentView: View {
  @State private var deepLinkedSession: SessionDTO?

  var body: some View {
    NavigationStack {
      SessionListView()
    }
    .fullScreenCover(item: $deepLinkedSession) { session in
      SessionRunView(session: session, autoStart: true)
    }
    .onOpenURL { url in
      guard let id = sessionId(fromDeepLinkURL: url),
            let session = WorkoutStore.shared.fetchSession(id: id) else { return }
      deepLinkedSession = session
    }
    .onAppear {
      // Ensures the complication reflects the latest installed code/content
      // rather than a stale cached render from before this launch.
      WidgetCenter.shared.reloadTimelines(ofKind: recentSessionWidgetKind)
    }
  }
}

#Preview {
  ContentView()
}
