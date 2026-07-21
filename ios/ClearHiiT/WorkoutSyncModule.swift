import Foundation

@objc(WorkoutSync)
class WorkoutSync: NSObject {

  @objc
  func ping() {
    print("[WorkoutSync] ping() called from JS")
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
