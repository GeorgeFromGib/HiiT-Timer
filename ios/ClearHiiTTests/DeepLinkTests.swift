import XCTest

final class DeepLinkTests: XCTestCase {
  func test_sessionId_parsesValidRunURL() {
    let url = URL(string: "hiitwatch://run?id=abc123")!
    XCTAssertEqual(sessionId(fromDeepLinkURL: url), "abc123")
  }

  func test_sessionId_nilForWrongScheme() {
    let url = URL(string: "https://run?id=abc123")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }

  func test_sessionId_nilForWrongHost() {
    let url = URL(string: "hiitwatch://open?id=abc123")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }

  func test_sessionId_nilWhenIdMissing() {
    let url = URL(string: "hiitwatch://run")!
    XCTAssertNil(sessionId(fromDeepLinkURL: url))
  }
}
