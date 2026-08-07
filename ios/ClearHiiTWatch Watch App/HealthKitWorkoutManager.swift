// ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift
import HealthKit

/// Live-session recorder used on-device. See WorkoutSessionCoordinatorTests
/// (ios/Shared/WorkoutSessionRecording.swift) for the tested start/pause/
/// resume/end call sequencing — this class wraps the untestable HealthKit
/// APIs themselves and is verified manually on a paired watch.
final class HealthKitWorkoutManager: WorkoutSessionRecording {
  static let isAvailable = HKHealthStore.isHealthDataAvailable()

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  var onStatsUpdate: ((WorkoutLiveStats) -> Void)?

  func requestAuthorization(_ completion: @escaping (Bool) -> Void) {
    guard Self.isAvailable,
          let heartRate = HKObjectType.quantityType(forIdentifier: .heartRate),
          let energy = HKObjectType.quantityType(forIdentifier: .activeEnergyBurned) else {
      completion(false)
      return
    }
    let toShare: Set<HKSampleType> = [HKObjectType.workoutType()]
    let toRead: Set<HKObjectType> = [heartRate, energy]
    healthStore.requestAuthorization(toShare: toShare, read: toRead) { success, _ in
      DispatchQueue.main.async { completion(success) }
    }
  }

  func start(activityType: HKWorkoutActivityType) {
    guard Self.isAvailable else { return }
    let config = HKWorkoutConfiguration()
    config.activityType = activityType
    config.locationType = .indoor
    guard let session = try? HKWorkoutSession(healthStore: healthStore, configuration: config) else { return }
    let builder = session.associatedWorkoutBuilder()
    builder.dataSource = HKLiveWorkoutDataSource(healthStore: healthStore, workoutConfiguration: config)
    self.session = session
    self.builder = builder
    let startDate = Date()
    session.startActivity(with: startDate)
    builder.beginCollection(withStart: startDate) { _, _ in }
  }

  func pause() {
    session?.pause()
  }

  func resume() {
    session?.resume()
  }

  func end(save: Bool) {
    guard let session, let builder else { return }
    session.end()
    builder.endCollection(withEnd: Date()) { [weak self] _, _ in
      guard save else {
        self?.session = nil
        self?.builder = nil
        return
      }
      builder.finishWorkout { _, _ in
        self?.session = nil
        self?.builder = nil
      }
    }
  }
}
