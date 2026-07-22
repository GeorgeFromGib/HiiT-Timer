import SwiftUI

struct ContentView: View {
  @State private var counts: (folders: Int, sessions: Int) = (0, 0)

  var body: some View {
    VStack {
      Image(systemName: "icloud")
        .imageScale(.large)
        .foregroundStyle(.tint)
      Text("Folders: \(counts.folders)\nSessions: \(counts.sessions)")
        .multilineTextAlignment(.center)
    }
    .padding()
    .onAppear {
      counts = WorkoutStore.shared.fetchCounts()
    }
  }
}

#Preview {
  ContentView()
}
