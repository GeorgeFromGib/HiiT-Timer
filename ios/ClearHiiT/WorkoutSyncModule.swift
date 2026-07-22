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
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
