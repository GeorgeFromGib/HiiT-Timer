import XCTest

final class RecentSessionStoreTests: XCTestCase {
  private var defaults: UserDefaults!
  private var store: RecentSessionStore!

  override func setUp() {
    super.setUp()
    defaults = UserDefaults(suiteName: "RecentSessionStoreTests")
    defaults.removePersistentDomain(forName: "RecentSessionStoreTests")
    store = RecentSessionStore(defaults: defaults)
  }

  override func tearDown() {
    defaults.removePersistentDomain(forName: "RecentSessionStoreTests")
    super.tearDown()
  }

  func test_fetch_returnsNilWhenNothingRecorded() {
    XCTAssertNil(store.fetch())
  }

  func test_recordThenFetch_roundTripsIdNameAndTimestamp() {
    let now = Date(timeIntervalSince1970: 1_700_000_000)
    store.record(id: "1", name: "Tabata", now: now)

    let recent = store.fetch()
    XCTAssertEqual(recent?.id, "1")
    XCTAssertEqual(recent?.name, "Tabata")
    XCTAssertEqual(recent?.ranAt, now)
  }

  func test_record_overwritesPreviousRecentSession() {
    store.record(id: "1", name: "First", now: Date(timeIntervalSince1970: 1))
    store.record(id: "2", name: "Second", now: Date(timeIntervalSince1970: 2))

    XCTAssertEqual(store.fetch()?.id, "2")
  }
}
