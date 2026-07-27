import SwiftUI
import Combine

struct SessionRunView: View {
  let session: SessionDTO

  @StateObject private var engineHolder: EngineHolder

  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(segments: segmentsForSession(session)))
  }

  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    VStack(spacing: 8) {
      Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
        .font(.headline)

      if session.isTreadmill, let speed = segment?.speed {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 44, weight: .bold, design: .rounded))
          .monospacedDigit()

        Text(String(format: "%.1f", speed))
          .font(.system(size: 22, weight: .semibold, design: .rounded))
          .monospacedDigit()
        Text("km/h")
          .font(.caption2)
          .foregroundStyle(.secondary)

        if let incline = segment?.incline {
          Text(String(format: "%.0f%% incline", incline))
            .font(.footnote)
            .foregroundStyle(.secondary)
        }
      } else {
        Text(fmtTimer(state.remainingInSegment))
          .font(.system(size: 40, weight: .bold, design: .rounded))
          .monospacedDigit()
      }

      HStack {
        Button(state.status == .running ? "Pause" : "Start") {
          switch state.status {
          case .idle: engineHolder.engine.start()
          case .running: engineHolder.engine.pause()
          case .paused: engineHolder.engine.resume()
          case .finished: break
          }
        }
        Button("Skip") { engineHolder.engine.skip() }
          .disabled(state.status == .idle || state.status == .finished)
      }
    }
    .padding()
  }
}

/// Owns the WorkoutTimerEngine and republishes its @Published state so
/// SwiftUI re-renders on every tick, while also tracking the current
/// segment for haptics and the speed/incline display.
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  @Published private(set) var currentSegment: Segment?
  private var cancellable: AnyCancellable?

  init(segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.currentSegment = segments.first
    engine.onTransition = { [weak self] _, to in
      self?.currentSegment = to
      if let phase = to?.phase {
        HapticsController.play(for: phase)
      }
    }
    engine.onFinish = { [weak self] in
      HapticsController.play(for: .finish)
    }
    cancellable = engine.objectWillChange.sink { [weak self] in
      self?.objectWillChange.send()
    }
  }
}
