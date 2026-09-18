import Foundation
import WatchConnectivity

@objc(WorkoutSync)
class WorkoutSync: NSObject {

  @objc
  func syncSessionsData(_ json: String) {
    WorkoutStore.shared.applySessionsDataJSON(json)
  }

  @objc
  func syncPreferences(_ hideFolders: Bool, language: String) {
    WorkoutStore.shared.applyPreferences(hideFolders: hideFolders, language: language)
    // CloudKit sync (above) is eventually-consistent and can lag by seconds to
    // minutes — push over WatchConnectivity too so a reachable watch picks up
    // the change immediately instead of waiting on iCloud.
    guard WCSession.isSupported(), WCSession.default.activationState == .activated,
          WCSession.default.isReachable else { return }
    WCSession.default.sendMessage(
      ["kind": "preferences", "hideFolders": hideFolders, "language": language],
      replyHandler: nil, errorHandler: nil
    )
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
