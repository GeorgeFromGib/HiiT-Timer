import SwiftUI
import Combine

/// Matches THEME_TOKENS.tidal.phases in src/theme.ts — the watch has no
/// theme system, so it always uses the phone's dark (tidal) palette.
let phaseColor: [Phase: Color] = [
  .warmup:      Color(red: 1.0, green: 0.541, blue: 0.239),
  .work:        Color(red: 1.0, green: 0.353, blue: 0.373),
  .rest:        Color(red: 0.373, green: 0.827, blue: 0.541),
  .cooldown:    Color(red: 0.275, green: 0.651, blue: 1.0),
  .circuitRest: Color(red: 0.690, green: 0.416, blue: 0.941),
  .finish:      Color(red: 0.353, green: 0.478, blue: 0.502),
]

/// Matches src/locales/en.ts's `congrats` list — the watch has no i18n system,
/// so this is a small English-only subset for the done screen.
let congratsMessages = [
  "You crushed it.",
  "That's what you're made of.",
  "Every rep counted.",
  "Earned.",
  "Done. Well done.",
  "Session closed.",
]

struct SessionRunView: View {
  let session: SessionDTO

  @StateObject private var engineHolder: EngineHolder
  @Environment(\.dismiss) private var dismiss

  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(segments: segmentsForSession(session)))
  }

  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    if state.status == .finished {
      SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
    } else {
      VStack(spacing: 8) {
        Text(segment.map { phaseWord[$0.phase] ?? "" } ?? "")
          .font(.headline)
          .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)

        if session.isTreadmill, let speed = segment?.speed {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 50, weight: .bold, design: .rounded))
            .monospacedDigit()

          HStack {
            HStack(alignment: .lastTextBaseline, spacing: 4) {
              Text(String(format: "%.1f", speed))
                .font(.system(size: 30, weight: .semibold, design: .rounded))
                .monospacedDigit()
              Text("km/h")
                .font(.caption2)
                .foregroundStyle(.secondary)
            }
            if let incline = segment?.incline {
              Spacer()
              Text(String(format: "%.0f%% inc", incline))
                .font(.system(size: 20, weight: .medium, design: .rounded))
                .foregroundStyle(.secondary)
            }
          }
        } else {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 46, weight: .bold, design: .rounded))
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
        .controlSize(.small)
      }
      .padding()
    }
  }
}

/// Shown when a session runs to completion, with a randomised congratulatory
/// message. A basic celebration screen — no stats recap (that's phone-only).
struct SessionDoneView: View {
  let congratsMessage: String
  let onDone: () -> Void

  var body: some View {
    VStack(spacing: 12) {
      Image(systemName: "checkmark.circle.fill")
        .font(.system(size: 36))
        .foregroundStyle(.green)
      Text(congratsMessage)
        .font(.headline)
        .multilineTextAlignment(.center)
      Button("Done", action: onDone)
        .controlSize(.small)
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
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
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
