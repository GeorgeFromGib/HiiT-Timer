import Foundation

@objc(WorkoutSync)
class WorkoutSync: NSObject {

  @objc
  func syncSessionsData(_ json: String) {
    WorkoutStore.shared.applySessionsDataJSON(json)
  }

  @objc
  func syncPreferences(_ hideFolders: Bool, language: String) {
    WorkoutStore.shared.applyPreferences(hideFolders: hideFolders, language: language)
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
