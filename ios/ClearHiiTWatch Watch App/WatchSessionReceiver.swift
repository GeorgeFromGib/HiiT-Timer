// ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift
import Combine
import Foundation
import WatchConnectivity

/// Wraps WCSession on the watch side: publishes the phone's most recently
/// broadcast live-session state (if any) so ContentView/SessionRunView can
/// react to it, and sends the watch's own live-session updates back to the
/// phone. Reads receivedApplicationContext on activation (covers "watch app
/// opened after the phone already broadcast, watch wasn't reachable at the
/// time") as well as live updates while both apps happen to be open.
final class WatchSessionReceiver: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchSessionReceiver()

  @Published private(set) var liveSession: LiveSessionState?

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func sendLiveSession(sessionId: String, name: String, elapsed: Double, status: String) {
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

  func clearLiveSession() {
    guard WCSession.isSupported() else { return }
    try? WCSession.default.updateApplicationContext([:])
    if WCSession.default.isReachable {
      WCSession.default.sendMessage([:], replyHandler: nil, errorHandler: nil)
    }
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: session.receivedApplicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: applicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.liveSession = liveSessionState(fromApplicationContext: message)
    }
  }
}
