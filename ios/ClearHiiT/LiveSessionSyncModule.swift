// ios/ClearHiiT/LiveSessionSyncModule.swift
import Foundation
import React
import WatchConnectivity

@objc(LiveSessionSync)
class LiveSessionSync: RCTEventEmitter, WCSessionDelegate {
  private static var didActivate = false
  private var hasListeners = false
  private var lastForwardedUpdatedAt: Date?

  override func supportedEvents() -> [String]! {
    ["LiveSessionUpdate"]
  }

  override func startObserving() {
    hasListeners = true
    // Activate eagerly here rather than waiting for an outbound broadcast —
    // a phone that only ever *receives* watch-started sessions (never starts
    // its own) would otherwise never activate WCSession at all and could
    // never hear from the watch. This runs as soon as App.tsx mounts its
    // listener, at every app launch.
    ensureActivated()
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

  // JS-callable catch-up for when the app resumes from background/lock.
  // WatchConnectivity only pushes didReceiveApplicationContext while this
  // process is alive to receive it, so a session the watch started while the
  // phone was asleep needs an explicit re-read of receivedApplicationContext
  // (which the OS keeps current regardless) — mirrors the watch's own
  // refreshFromReceivedContext in WatchSessionReceiver.swift.
  @objc
  func refreshFromReceivedContext() {
    guard WCSession.isSupported() else { return }
    forwardToJS(WCSession.default.receivedApplicationContext)
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
    // Reject an out-of-order delivery (see isNewerLiveSessionUpdate) before it
    // ever reaches JS. An empty payload (clearLiveSession) has no updatedAt
    // and always passes through untouched.
    if let state = liveSessionState(fromApplicationContext: payload) {
      guard isNewerLiveSessionUpdate(updatedAt: state.updatedAt, lastAccepted: lastForwardedUpdatedAt) else { return }
      lastForwardedUpdatedAt = state.updatedAt
    }
    DispatchQueue.main.async { [weak self] in
      self?.sendEvent(withName: "LiveSessionUpdate", body: payload)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
    guard activationState == .activated else { return }
    DispatchQueue.main.async { [weak self] in
      self?.forwardToJS(session.receivedApplicationContext)
    }
  }
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
