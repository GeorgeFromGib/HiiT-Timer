import SwiftUI

struct SessionListView: View {
  @State private var sessions: [SessionDTO] = []

  var body: some View {
    Group {
      if sessions.isEmpty {
        Text("No sessions synced yet")
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      } else {
        List(sessions, id: \.id) { session in
          NavigationLink(session.name, destination: SessionRunView(session: session))
        }
      }
    }
    .navigationTitle("Sessions")
    .onAppear {
      sessions = WorkoutStore.shared.fetchRunnableSessions()
    }
  }
}
