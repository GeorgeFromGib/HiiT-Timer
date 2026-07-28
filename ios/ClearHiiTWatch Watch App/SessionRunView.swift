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

/// Matches THEME_TOKENS.tidal's button tokens in src/theme.ts (accent,
/// btnGlyph, ghostBg, hairline, subText) — same rationale as phaseColor above.
private let controlAccent = Color(red: 0.229, green: 0.839, blue: 0.776)
private let controlGlyph = Color(red: 0.024, green: 0.075, blue: 0.102)
private let controlGhostBg = Color.white.opacity(0.05)
private let controlHairline = Color.white.opacity(0.10)
private let controlSubText = Color.white.opacity(0.72)

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

private enum RunningPage: Hashable {
  case controls
  case timer
}

struct SessionRunView: View {
  let session: SessionDTO

  @StateObject private var engineHolder: EngineHolder
  @State private var countdown: Int?
  @State private var countdownTask: Task<Void, Never>?
  @State private var runningPage: RunningPage = .timer
  @Environment(\.dismiss) private var dismiss

  init(session: SessionDTO) {
    self.session = session
    _engineHolder = StateObject(wrappedValue: EngineHolder(session: session, segments: segmentsForSession(session)))
  }

  var body: some View {
    let state = engineHolder.engine.state
    let segment = engineHolder.currentSegment

    Group {
      if state.status == .finished {
        SessionDoneView(congratsMessage: engineHolder.congratsMessage, onDone: { dismiss() })
      } else if let countdown {
        CountdownView(count: countdown)
      } else if state.status == .idle {
        readyView
      } else {
        runningView(state: state, segment: segment)
      }
    }
    .onDisappear {
      countdownTask?.cancel()
      engineHolder.discardIfUnfinished()
    }
  }

  private var readyView: some View {
    VStack(spacing: 12) {
      Text(session.name)
        .font(.headline)
        .multilineTextAlignment(.center)
      Button(action: beginCountdown) {
        Text("Start")
          .font(.headline)
          .foregroundStyle(controlGlyph)
          .padding(.horizontal, 20)
          .padding(.vertical, 8)
          .background(controlAccent)
          .clipShape(Capsule())
      }
      .buttonStyle(.plain)
    }
    .padding()
  }

  private func runningView(state: TimerState, segment: Segment?) -> some View {
    TabView(selection: $runningPage) {
      HStack(spacing: 16) {
        Button {
          switch state.status {
          case .running: engineHolder.pause()
          case .paused: engineHolder.resume()
          case .idle, .finished: break
          }
        } label: {
          Image(systemName: state.status == .running ? "pause.fill" : "play.fill")
            .font(.title3)
            .foregroundStyle(controlGlyph)
            .frame(width: 50, height: 50)
            .background(controlAccent)
            .clipShape(Circle())
        }
        .buttonStyle(.plain)

        Button {
          engineHolder.engine.skip()
        } label: {
          Image(systemName: "forward.end.fill")
            .font(.title3)
            .foregroundStyle(controlSubText)
            .frame(width: 44, height: 44)
            .background(controlGhostBg)
            .clipShape(Circle())
            .overlay(Circle().stroke(controlHairline, lineWidth: 1))
        }
        .buttonStyle(.plain)
      }
      .padding()
      .tag(RunningPage.controls)

      VStack(spacing: 8) {
        Text(segment?.activityLabel ?? segment.map { phaseWord[$0.phase] ?? "" } ?? "")
          .font(.system(size: 22, weight: .bold, design: .rounded))
          .foregroundStyle(segment.flatMap { phaseColor[$0.phase] } ?? .primary)
          .multilineTextAlignment(.center)

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
        } else if session.isSpinning, let resistance = segment?.resistance, let power = segment?.power {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 50, weight: .bold, design: .rounded))
            .monospacedDigit()

          HStack(alignment: .lastTextBaseline, spacing: 4) {
            Text("R\(Int(resistance))")
              .font(.system(size: 24, weight: .semibold, design: .rounded))
              .monospacedDigit()
            Text("·")
              .foregroundStyle(.secondary)
            Text("\(Int(power))W")
              .font(.system(size: 24, weight: .semibold, design: .rounded))
              .monospacedDigit()
          }
        } else {
          Text(fmtTimer(state.remainingInSegment))
            .font(.system(size: 46, weight: .bold, design: .rounded))
            .monospacedDigit()
        }

        if session.mode == "circuit", let circuitNumber = segment?.circuitNumber {
          Text("Circuit \(circuitNumber) / \(session.circuits ?? circuitNumber)")
            .font(.caption2)
            .foregroundStyle(.secondary)
        }

        if session.mode == "circuit" {
          let upNext = upNextExercises(engineHolder.segments, currentIndex: state.currentIndex)
          if !upNext.isEmpty {
            ScrollView {
              VStack(alignment: .leading, spacing: 2) {
                ForEach(Array(upNext.enumerated()), id: \.offset) { index, name in
                  Text(index == 0 ? "Nxt: \(name)" : name)
                    .font(.caption2)
                    .foregroundStyle(.secondary)
                }
              }
            }
            .frame(maxHeight: 50)
          }
        }
      }
      .padding()
      .tag(RunningPage.timer)
    }
    .tabViewStyle(.page)
  }

  /// Shows 3, 2, 1 (one second each) purely as watch-local UI, then starts
  /// the engine — HealthKit recording and the timer both begin only once the
  /// countdown reaches zero, matching what the wearer sees on screen.
  private func beginCountdown() {
    countdown = 3
    countdownTask = Task { @MainActor in
      for n in [2, 1] {
        try? await Task.sleep(nanoseconds: 1_000_000_000)
        guard !Task.isCancelled else { return }
        countdown = n
      }
      try? await Task.sleep(nanoseconds: 1_000_000_000)
      guard !Task.isCancelled else { return }
      countdown = nil
      engineHolder.start()
    }
  }
}

private struct CountdownView: View {
  let count: Int

  var body: some View {
    Text("\(count)")
      .font(.system(size: 60, weight: .bold, design: .rounded))
      .monospacedDigit()
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
      Button(action: onDone) {
        Text("Done")
          .font(.headline)
          .foregroundStyle(controlGlyph)
          .padding(.horizontal, 20)
          .padding(.vertical, 8)
          .background(controlAccent)
          .clipShape(Capsule())
      }
      .buttonStyle(.plain)
    }
    .padding()
  }
}

/// Owns the WorkoutTimerEngine and republishes its @Published state so
/// SwiftUI re-renders on every tick, while also tracking the current
/// segment for haptics and the speed/incline display.
private final class EngineHolder: ObservableObject {
  let engine: WorkoutTimerEngine
  let segments: [Segment]
  @Published private(set) var currentSegment: Segment?
  let congratsMessage: String = congratsMessages.randomElement() ?? ""
  private var cancellable: AnyCancellable?
  private let workoutSession: WorkoutSessionCoordinator

  init(session: SessionDTO, segments: [Segment]) {
    let engine = WorkoutTimerEngine(segments: segments)
    self.engine = engine
    self.segments = segments
    self.currentSegment = segments.first
    self.workoutSession = WorkoutSessionCoordinator(
      recorder: HealthKitWorkoutManager(),
      activityType: hkActivityType(for: session),
      engine: engine
    )
    workoutSession.requestAuthorization { _ in }
    engine.onTransition = { [weak self] _, to in
      self?.currentSegment = to
      if let phase = to?.phase {
        HapticsController.play(for: phase)
      }
    }
    engine.onFinish = {
      HapticsController.play(for: .finish)
    }
    cancellable = engine.objectWillChange.sink { [weak self] in
      self?.objectWillChange.send()
    }
  }

  func start() {
    engine.start()
  }

  func pause() {
    engine.pause()
  }

  func resume() {
    engine.resume()
  }

  func discardIfUnfinished() {
    workoutSession.discardIfUnfinished()
  }
}
