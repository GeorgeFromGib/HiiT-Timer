import WatchKit

enum HapticsController {
  static func play(for phase: Phase) {
    let device = WKInterfaceDevice.current()
    switch phase {
    case .work:
      device.play(.start)
    case .rest, .circuitRest:
      device.play(.stop)
    case .warmup, .cooldown:
      device.play(.click)
    case .finish:
      device.play(.success)
    }
  }
}
