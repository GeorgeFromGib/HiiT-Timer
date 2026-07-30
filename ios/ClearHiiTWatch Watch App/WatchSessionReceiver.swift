// ios/ClearHiiTWatch Watch App/WatchSessionReceiver.swift
import Combine
import Foundation
import WatchConnectivity

/// Wraps WCSession on the watch side, publishing the phone's most recently
/// broadcast live-session state (if any) so ContentView can offer to resume
/// it. Reads receivedApplicationContext on activation (covers "watch app
/// opened after the phone already broadcast, watch wasn't reachable at the
/// time") as well as on live updates while both apps happen to be open.
final class WatchSessionReceiver: NSObject, ObservableObject, WCSessionDelegate {
  static let shared = WatchSessionReceiver()

  @Published private(set) var liveSession: LiveSessionState?

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
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
}
