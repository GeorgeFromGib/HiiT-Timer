// ios/ClearHiiT/LiveSessionSyncModule.swift
import Foundation
import WatchConnectivity

@objc(LiveSessionSync)
class LiveSessionSync: NSObject, WCSessionDelegate {
  private static var didActivate = false

  private func ensureActivated() {
    guard WCSession.isSupported(), !LiveSessionSync.didActivate else { return }
    LiveSessionSync.didActivate = true
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  @objc
  func updateLiveSession(_ sessionId: String, name: String, elapsed: Double, status: String) {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    let context: [String: Any] = [
      "sessionId": sessionId,
      "name": name,
      "elapsed": elapsed,
      "status": status,
      "updatedAt": Date().timeIntervalSince1970,
    ]
    try? WCSession.default.updateApplicationContext(context)
  }

  @objc
  func clearLiveSession() {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }

  @objc
  static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
