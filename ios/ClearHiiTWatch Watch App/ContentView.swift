import SwiftUI

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
  }
}

#Preview {
  ContentView()
}
