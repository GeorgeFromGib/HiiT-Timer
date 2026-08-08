import CoreData
import SwiftUI

struct SessionListView: View {
  var folderId: String? = nil
  var folderName: String? = nil

  @State private var sessions: [SessionDTO] = []
  @State private var folders: [FolderDTO] = []
  @State private var showFolders = false

  var body: some View {
    Group {
      if showFolders {
        List(folders) { folder in
          NavigationLink(destination: SessionListView(folderId: folder.id, folderName: folder.name)) {
            Label(folder.name, systemImage: "folder")
          }
        }
      } else if sessions.isEmpty {
        Text(folderId == nil ? "No sessions synced yet" : "No sessions in this folder")
          .multilineTextAlignment(.center)
          .foregroundStyle(.secondary)
      } else {
        List(sessions, id: \.id) { session in
          NavigationLink(session.name, destination: SessionRunView(session: session))
        }
      }
    }
    .navigationTitle(folderName ?? "Sessions")
    .onAppear(perform: load)
    // CloudKit merges land in the view context while this screen may already
    // be on-screen (no push/pop to re-trigger onAppear) — reload whenever
    // that happens so folder/session edits made on the phone show up live.
    .onReceive(
      NotificationCenter.default.publisher(
        for: .NSManagedObjectContextObjectsDidChange,
        object: WorkoutStore.shared.container.viewContext
      )
    ) { _ in
      load()
    }
  }

  private func load() {
    if let folderId {
      sessions = WorkoutStore.shared.fetchRunnableSessions(inFolder: folderId)
      return
    }

    let hideFolders = WorkoutStore.shared.fetchHideFolders()
    folders = WorkoutStore.shared.fetchFolders()
    // Mirrors App.tsx's root-routing rule (`!settings.hideFolders -> Folders`),
    // which has no folder-count gate — only the phone's nested
    // SessionsListScreen collapses to flat when there's just one folder, and
    // that's a different screen than the watch's root.
    showFolders = !hideFolders

    guard !showFolders else { return }
    if let defaultFolder = folders.first {
      sessions = WorkoutStore.shared.fetchRunnableSessions(inFolder: defaultFolder.id)
    } else {
      sessions = WorkoutStore.shared.fetchRunnableSessions()
    }
  }
}
