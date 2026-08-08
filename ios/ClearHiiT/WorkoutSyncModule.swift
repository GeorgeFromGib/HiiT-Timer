import Foundation

@objc(WorkoutSync)
class WorkoutSync: NSObject {

  @objc
  func ping() {
    print("[WorkoutSync] ping() called from JS")
  }

  @objc
  func syncSessionsData(_ json: String) {
    WorkoutStore.shared.applySessionsDataJSON(json)
  }

  @objc
  func syncPreferences(_ hideFolders: Bool) {
    WorkoutStore.shared.applyPreferences(hideFolders: hideFolders)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
