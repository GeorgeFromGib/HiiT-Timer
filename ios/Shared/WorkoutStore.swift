// ios/Shared/WorkoutStore.swift
import CoreData

final class WorkoutStore {
  static let shared = WorkoutStore()

  let container: NSPersistentCloudKitContainer

  private init() {
    container = NSPersistentCloudKitContainer(name: "WorkoutModel")
    guard let description = container.persistentStoreDescriptions.first else {
      fatalError("WorkoutStore: no persistent store description found")
    }
    description.setOption(true as NSNumber, forKey: NSPersistentHistoryTrackingKey)
    description.cloudKitContainerOptions = NSPersistentCloudKitContainerOptions(
      containerIdentifier: "iCloud.com.georgefromgib.hiittimer"
    )
    container.loadPersistentStores { _, error in
      if let error = error {
        fatalError("WorkoutStore: failed to load persistent store: \(error)")
      }
    }
    container.viewContext.automaticallyMergesChangesFromParent = true
  }

  func applySessionsDataJSON(_ json: String) {
    let context = container.newBackgroundContext()
    context.perform {
      guard let data = json.data(using: .utf8),
            let decoded = try? JSONSerialization.jsonObject(with: data) as? [String: Any],
            let folders = decoded["folders"] as? [[String: Any]],
            let sessions = decoded["sessions"] as? [[String: Any]] else {
        print("[WorkoutStore] applySessionsDataJSON: failed to parse JSON")
        return
      }

      for folder in folders {
        guard let id = folder["id"] as? String else { continue }
        let record = self.fetchOrCreate(entityName: "FolderRecord", id: id, in: context)
        record.setValue(folder["name"] as? String, forKey: "name")
        record.setValue(folder["icon"] as? String, forKey: "icon")
        if let createdAt = folder["createdAt"] as? Double {
          record.setValue(Date(timeIntervalSince1970: createdAt / 1000), forKey: "createdAt")
        }
        if let folderJSON = try? JSONSerialization.data(withJSONObject: folder),
           let folderJSONString = String(data: folderJSON, encoding: .utf8) {
          record.setValue(folderJSONString, forKey: "json")
        }
      }

      for session in sessions {
        guard let id = session["id"] as? String, let folderId = session["folderId"] as? String else { continue }
        let record = self.fetchOrCreate(entityName: "SessionRecord", id: id, in: context)
        record.setValue(folderId, forKey: "folderId")
        record.setValue(session["name"] as? String, forKey: "name")
        record.setValue(Date(), forKey: "updatedAt")
        if let sessionJSON = try? JSONSerialization.data(withJSONObject: session),
           let sessionJSONString = String(data: sessionJSON, encoding: .utf8) {
          record.setValue(sessionJSONString, forKey: "json")
        }
      }

      do {
        try context.save()
      } catch {
        print("[WorkoutStore] applySessionsDataJSON: save failed: \(error)")
      }
    }
  }

  private func fetchOrCreate(entityName: String, id: String, in context: NSManagedObjectContext) -> NSManagedObject {
    let request = NSFetchRequest<NSManagedObject>(entityName: entityName)
    request.predicate = NSPredicate(format: "id == %@", id)
    request.fetchLimit = 1
    if let existing = try? context.fetch(request).first {
      return existing
    }
    let entity = NSEntityDescription.entity(forEntityName: entityName, in: context)!
    let record = NSManagedObject(entity: entity, insertInto: context)
    record.setValue(id, forKey: "id")
    return record
  }

  func fetchCounts() -> (folders: Int, sessions: Int) {
    let context = container.viewContext
    let folderCount = (try? context.count(for: NSFetchRequest<NSManagedObject>(entityName: "FolderRecord"))) ?? 0
    let sessionCount = (try? context.count(for: NSFetchRequest<NSManagedObject>(entityName: "SessionRecord"))) ?? 0
    return (folderCount, sessionCount)
  }
}

extension WorkoutStore {
  func fetchRunnableSessions() -> [SessionDTO] {
    let context = container.viewContext
    let request = NSFetchRequest<NSManagedObject>(entityName: "SessionRecord")
    let records = (try? context.fetch(request)) ?? []
    let blobs = records.compactMap { $0.value(forKey: "json") as? String }
    return decodeRunnableSessions(fromJSONBlobs: blobs)
  }

  func fetchSession(id: String) -> SessionDTO? {
    fetchRunnableSessions().first { $0.id == id }
  }
}
