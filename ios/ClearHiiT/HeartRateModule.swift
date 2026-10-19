// ios/ClearHiiT/HeartRateModule.swift
import Foundation
import HealthKit
import React

/// Streams heart-rate samples from HealthKit. Live data only flows while a
/// workout session is running on the watch (e.g. the Workout app) — outside one,
/// the watch writes sparse, delayed samples, which JS discards as stale.
@objc(HeartRate)
class HeartRate: RCTEventEmitter {
  private let store = HKHealthStore()
  private let hrType = HKQuantityType(.heartRate)
  private var query: HKAnchoredObjectQuery?
  private var hasListeners = false

  override func supportedEvents() -> [String]! { ["HeartRateSample"] }
  override func startObserving() { hasListeners = true }
  override func stopObserving() { hasListeners = false }

  // HealthKit hides whether read access was granted; `true` means the request
  // completed, and a denied user simply never produces samples.
  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else { resolve(false); return }
    store.requestAuthorization(toShare: nil, read: [hrType, HKCharacteristicType(.dateOfBirth)]) { ok, error in
      if let error { reject("healthkit_auth", error.localizedDescription, error) } else { resolve(ok) }
    }
  }

  @objc
  func getAge(_ resolve: @escaping RCTPromiseResolveBlock,
              rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard let dob = try? store.dateOfBirthComponents(),
          let years = Calendar.current.dateComponents([.year], from: dob.date ?? Date(), to: Date()).year,
          years > 0 else { resolve(nil); return }
    resolve(years)
  }

  @objc
  func start() {
    stop()
    // Only samples from just before now; older history isn't "live".
    let predicate = HKQuery.predicateForSamples(withStart: Date().addingTimeInterval(-30), end: nil)
    let handler: (HKAnchoredObjectQuery, [HKSample]?, [HKDeletedObject]?, HKQueryAnchor?, Error?) -> Void = { [weak self] _, samples, _, _, _ in
      guard let self, self.hasListeners,
            let latest = (samples as? [HKQuantitySample])?.max(by: { $0.endDate < $1.endDate }) else { return }
      let bpm = latest.quantity.doubleValue(for: HKUnit.count().unitDivided(by: .minute()))
      self.sendEvent(withName: "HeartRateSample",
                     body: ["bpm": Int(bpm.rounded()), "ts": latest.endDate.timeIntervalSince1970 * 1000])
    }
    let q = HKAnchoredObjectQuery(type: hrType, predicate: predicate, anchor: nil, limit: HKObjectQueryNoLimit, resultsHandler: handler)
    q.updateHandler = handler
    store.execute(q)
    query = q
  }

  @objc
  func stop() {
    if let q = query { store.stop(q) }
    query = nil
  }

  @objc
  override static func requiresMainQueueSetup() -> Bool { false }
}
