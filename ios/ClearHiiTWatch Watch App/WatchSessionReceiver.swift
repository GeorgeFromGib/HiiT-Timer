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
  /// The session id currently on-screen anywhere on the watch (pushed from
  /// the list or presented as an auto-launch/deep-link cover) — lets
  /// ContentView tell a real incoming peer update apart from its own
  /// broadcast bouncing back via the phone's heartbeat, which would
  /// otherwise present a duplicate cover for the session already running.
  @Published var activeSessionId: String?
  private var lastAcceptedUpdatedAt: Date?
  // On a freshly-installed watch app, first-time WCSession pairing/activation
  // is measurably slower than on later launches — a session started before
  // it completes would otherwise have its broadcast silently dropped
  // (updateApplicationContext throws WCErrorCodeSessionNotActivated, and
  // that throw was being swallowed by `try?`). Hold the latest context here
  // and flush it once activation actually completes instead of losing it.
  private var pendingOutgoingContext: [String: Any]?

  private override init() {
    super.init()
    guard WCSession.isSupported() else { return }
    WCSession.default.delegate = self
    WCSession.default.activate()
  }

  func sendLiveSession(sessionId: String, name: String, elapsed: Double, status: String) {
    send([
      "sessionId": sessionId,
      "name": name,
      "elapsed": elapsed,
      "status": status,
      "updatedAt": Date().timeIntervalSince1970,
    ])
  }

  private func send(_ context: [String: Any]) {
    guard WCSession.isSupported() else { return }
    guard WCSession.default.activationState == .activated else {
      pendingOutgoingContext = context
      return
    }
    try? WCSession.default.updateApplicationContext(context)
    if WCSession.default.isReachable {
      WCSession.default.sendMessage(context, replyHandler: nil, errorHandler: nil)
    }
  }

  // WatchConnectivity only pushes didReceiveApplicationContext while this
  // process is alive to receive it — a watch app resumed from suspension
  // (not cold-launched) can miss every update the phone sent while it was
  // backgrounded. Re-reading the session's own receivedApplicationContext
  // (which the OS keeps current regardless of watch reachability) on every
  // foreground transition catches up on whatever was missed.
  func refreshFromReceivedContext() {
    guard WCSession.isSupported() else { return }
    applyIncoming(WCSession.default.receivedApplicationContext)
  }

  func clearLiveSession() {
    send([:])
  }

  func session(_ session: WCSession, activationDidCompleteWith activationState: WCSessionActivationState, error: (any Error)?) {
    DispatchQueue.main.async {
      self.applyIncoming(session.receivedApplicationContext)
      guard activationState == .activated, let pending = self.pendingOutgoingContext else { return }
      self.pendingOutgoingContext = nil
      self.send(pending)
    }
  }

  func session(_ session: WCSession, didReceiveApplicationContext applicationContext: [String: Any]) {
    DispatchQueue.main.async {
      self.applyIncoming(applicationContext)
    }
  }

  func session(_ session: WCSession, didReceiveMessage message: [String: Any]) {
    DispatchQueue.main.async {
      self.applyIncoming(message)
    }
  }

  // Rejects an out-of-order delivery (see isNewerLiveSessionUpdate) before it
  // ever reaches @Published state. An empty payload (clearLiveSession) has no
  // updatedAt and always clears through untouched.
  private func applyIncoming(_ context: [String: Any]) {
    guard let state = liveSessionState(fromApplicationContext: context) else {
      liveSession = nil
      return
    }
    guard isNewerLiveSessionUpdate(updatedAt: state.updatedAt, lastAccepted: lastAcceptedUpdatedAt) else { return }
    lastAcceptedUpdatedAt = state.updatedAt
    liveSession = state
  }
}
