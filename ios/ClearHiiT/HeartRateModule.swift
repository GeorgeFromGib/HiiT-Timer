// ios/ClearHiiT/HeartRateModule.swift
import Foundation
import HealthKit
import React

/// Date-of-birth access for max-HR (zones). Live heart rate itself comes from the
/// watch over WatchConnectivity (LiveSessionSync's "WatchHeartRate" event) —
/// HealthKit syncs watch samples to the phone in slow batches, so it can't be live.
@objc(HeartRate)
class HeartRate: NSObject {
  private let store = HKHealthStore()

  // HealthKit hides whether read access was granted; `true` means the request
  // completed. A denied user just gets the fallback max HR.
  @objc
  func requestAuthorization(_ resolve: @escaping RCTPromiseResolveBlock,
                            rejecter reject: @escaping RCTPromiseRejectBlock) {
    guard HKHealthStore.isHealthDataAvailable() else { resolve(false); return }
    store.requestAuthorization(toShare: nil, read: [HKCharacteristicType(.dateOfBirth)]) { ok, error in
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
  static func requiresMainQueueSetup() -> Bool { false }
}
