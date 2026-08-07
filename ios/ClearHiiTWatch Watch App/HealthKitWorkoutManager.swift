// ios/ClearHiiTWatch Watch App/HealthKitWorkoutManager.swift
import HealthKit

/// Live-session recorder used on-device. See WorkoutSessionCoordinatorTests
/// (ios/Shared/WorkoutSessionRecording.swift) for the tested start/pause/
/// resume/end call sequencing — this class wraps the untestable HealthKit
/// APIs themselves and is verified manually on a paired watch.
final class HealthKitWorkoutManager: NSObject, WorkoutSessionRecording, HKLiveWorkoutBuilderDelegate {
  static let isAvailable = HKHealthStore.isHealthDataAvailable()

  private let healthStore = HKHealthStore()
  private var session: HKWorkoutSession?
  private var builder: HKLiveWorkoutBuilder?
  private var latestStats = WorkoutLiveStats()
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
    builder.delegate = self
    self.session = session
    self.builder = builder
    self.latestStats = WorkoutLiveStats()
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

  // MARK: - HKLiveWorkoutBuilderDelegate

  func workoutBuilder(_ workoutBuilder: HKLiveWorkoutBuilder, didCollectDataOf collectedTypes: Set<HKSampleType>) {
    var heartRate: Double?
    var activeEnergy: Double?
    for type in collectedTypes {
      guard let quantityType = type as? HKQuantityType,
            let statistics = workoutBuilder.statistics(for: quantityType) else { continue }
      switch quantityType.identifier {
      case HKQuantityTypeIdentifier.heartRate.rawValue:
        heartRate = statistics.mostRecentQuantity()?.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      case HKQuantityTypeIdentifier.activeEnergyBurned.rawValue:
        activeEnergy = statistics.sumQuantity()?.doubleValue(for: .kilocalorie())
      default:
        break
      }
    }
    latestStats = mergingLiveStats(latestStats, heartRate: heartRate, activeEnergy: activeEnergy)
    let stats = latestStats
    DispatchQueue.main.async { [weak self] in self?.onStatsUpdate?(stats) }
  }

  func workoutBuilderDidCollectEvent(_ workoutBuilder: HKLiveWorkoutBuilder) {}
}
