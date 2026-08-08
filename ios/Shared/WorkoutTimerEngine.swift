import Foundation
import Combine

struct TimerState: Equatable {
  enum Status: Equatable { case idle, running, paused, finished }
  var status: Status = .idle
  var elapsed: Double = 0
  var currentIndex: Int = -1
  var remainingInSegment: Double = 0
  var remainingTotal: Double = 0
  var segmentEndDate: Date? = nil
}

final class WorkoutTimerEngine: ObservableObject {
  @Published private(set) var state: TimerState

  var onTransition: ((Segment?, Segment?) -> Void)?
  var onFinish: (() -> Void)?
  /// Fires once per genuine status change (never on a no-op start/pause/resume).
  /// WorkoutSessionCoordinator subscribes to this to keep a HealthKit session
  /// mirrored to this engine without every call site needing to say so twice.
  var onStatusChange: ((TimerState.Status) -> Void)?

  private var segments: [Segment]
  private let total: Double
  private let now: () -> Date
  private var accumulated: Double = 0
  private var resumeEpoch: Date = Date()
  private var timer: Timer?
  private var lastIndex: Int = -1

  init(segments: [Segment], now: @escaping () -> Date = Date.init) {
    self.segments = segments
    self.total = segments.last?.endAt ?? 0
    self.now = now
    self.state = TimerState(remainingTotal: total)
  }

  deinit {
    timer?.invalidate()
  }

  private func computeElapsed() -> Double {
    state.status == .running ? accumulated + now().timeIntervalSince(resumeEpoch) : accumulated
  }

  func start(atElapsed: Double = 0) {
    accumulated = atElapsed
    resumeEpoch = now()
    lastIndex = -1
    state.status = .running
    onStatusChange?(.running)
    scheduleTimer()
    tick()
  }

  func pause() {
    guard state.status == .running else { return }
    accumulated = computeElapsed()
    state.status = .paused
    state.segmentEndDate = nil
    timer?.invalidate()
    timer = nil
    onStatusChange?(.paused)
  }

  func resume() {
    guard state.status == .paused else { return }
    resumeEpoch = now()
    state.status = .running
    scheduleTimer()
    onStatusChange?(.running)
  }

  func reset() {
    timer?.invalidate()
    timer = nil
    accumulated = 0
    lastIndex = -1
    state = TimerState(remainingTotal: total)
  }

  /// Jumps elapsed to a value reported by the other device (e.g. a remote
  /// skip) without changing running/paused status — that's applied
  /// separately via pause()/resume() so a status-only update doesn't also
  /// yank elapsed. No-ops when idle/finished, matching skip()'s guard.
  func applyRemoteElapsed(_ elapsed: Double) {
    guard state.status == .running || state.status == .paused else { return }
    accumulated = elapsed
    resumeEpoch = now()
    tick()
  }

  func skip() {
    guard state.status == .running || state.status == .paused else { return }
    let elapsed = computeElapsed()
    guard let seg = segments.first(where: { elapsed >= $0.startAt && elapsed < $0.endAt }) else { return }
    accumulated = seg.endAt
    resumeEpoch = now()
    tick()
  }

  private func scheduleTimer() {
    timer?.invalidate()
    timer = Timer.scheduledTimer(withTimeInterval: 0.2, repeats: true) { [weak self] _ in self?.tick() }
  }

  func tick() {
    guard state.status != .finished else { return }
    let elapsed = min(computeElapsed(), total)

    guard let seg = segments.first(where: { elapsed >= $0.startAt && elapsed < $0.endAt }) else {
      if state.status != .finished {
        let prev = lastIndex >= 0 ? segments.first(where: { $0.index == lastIndex }) : nil
        state.status = .finished
        timer?.invalidate()
        timer = nil
        onTransition?(prev, nil)
        onStatusChange?(.finished)
        onFinish?()
      }
      state.elapsed = elapsed
      state.currentIndex = -1
      state.remainingInSegment = 0
      state.remainingTotal = 0
      state.segmentEndDate = nil
      lastIndex = -1
      return
    }

    if seg.index != lastIndex {
      let from = lastIndex >= 0 ? segments.first(where: { $0.index == lastIndex }) : nil
      onTransition?(from, seg)
      lastIndex = seg.index
    }

    state.elapsed = elapsed
    state.currentIndex = seg.index
    state.remainingInSegment = seg.endAt - elapsed
    state.remainingTotal = total - elapsed
    state.segmentEndDate = state.status == .running ? now().addingTimeInterval(state.remainingInSegment) : nil
  }
}
