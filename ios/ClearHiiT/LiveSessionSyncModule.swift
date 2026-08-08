// ios/ClearHiiT/LiveSessionSyncModule.swift
import Foundation
import React
import WatchConnectivity

@objc(LiveSessionSync)
class LiveSessionSync: RCTEventEmitter, WCSessionDelegate {
  private static var didActivate = false
  private var hasListeners = false

  override func supportedEvents() -> [String]! {
    ["LiveSessionUpdate"]
  }

  override func startObserving() {
    hasListeners = true
  }

  override func stopObserving() {
    hasListeners = false
  }

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
    if WCSession.default.isReachable {
      WCSession.default.sendMessage(context, replyHandler: nil, errorHandler: nil)
    }
  }

  @objc
  func clearLiveSession() {
    ensureActivated()
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
    if WCSession.default.isReachable {
      WCSession.default.sendMessage([:], replyHandler: nil, errorHandler: nil)
    }
  }

  private func forwardToJS(_ payload: [String: Any]) {
    guard hasListeners else { return }
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(withName: "LiveSessionUpdate", body: payload)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {}
  func sessionDidBecomeInactive(_ session: WCSession) {}
  func sessionDidDeactivate(_ session: WCSession) {
    WCSession.default.activate()
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    forwardToJS(applicationContext)
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    forwardToJS(message)
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
