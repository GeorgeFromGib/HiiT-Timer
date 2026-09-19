// ios/ClearHiiTTests/SegmentExpansionParityTests.swift
//
// segmentsForSession() here is a hand-port of src/lib/sessions.ts's
// getSessionSegments() (see SegmentBuilder.swift's header comments) — there is
// no shared runtime between the phone (JS) and the watch (Swift), so nothing
// enforces the two stay in sync beyond comment discipline.
//
// This test reads the SAME fixture file that
// src/lib/__tests__/segmentExpansionParity.test.ts asserts against (recorded
// from the trusted JS implementation), decodes each session into a SessionDTO,
// and checks that segmentsForSession() produces byte-identical output. If a
// future change ports a rule to one side and not the other, this fails.
import XCTest

final class SegmentExpansionParityTests: XCTestCase {
  private struct ExpectedSegment: Decodable {
    let phase: Phase
    let duration: Double
    let startAt: Double
    let endAt: Double
    let index: Int
    let speed: Double?
    let incline: Double?
    let activityLabel: String?
    let circuitNumber: Int?
    let resistance: Double?
    let power: Double?
    let cooldownTaper: Bool?

    var asSegment: Segment {
      var seg = Segment(phase: phase, duration: duration, startAt: startAt, endAt: endAt, index: index)
      seg.speed = speed
      seg.incline = incline
      seg.activityLabel = activityLabel
      seg.circuitNumber = circuitNumber
      seg.resistance = resistance
      seg.power = power
      seg.cooldownTaper = cooldownTaper ?? false
      return seg
    }
  }

  private struct FixtureCase: Decodable {
    let name: String
    let session: SessionDTO
    let expectedSegments: [ExpectedSegment]
  }

  private func loadFixture() throws -> [FixtureCase] {
    // #filePath -> .../ios/ClearHiiTTests/SegmentExpansionParityTests.swift
    // Walk up to the repo root and into the fixture the JS side also reads,
    // rather than keeping a second, separately-maintained copy of the data.
    let repoRoot = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent() // ClearHiiTTests/
      .deletingLastPathComponent() // ios/
      .deletingLastPathComponent() // repo root
    let fixtureURL = repoRoot.appendingPathComponent("src/lib/__fixtures__/segmentExpansionParity.json")
    let data = try Data(contentsOf: fixtureURL)
    return try JSONDecoder().decode([FixtureCase].self, from: data)
  }

  func test_segmentsForSession_matchesJSBaselineForEveryFixtureCase() throws {
    let fixture = try loadFixture()
    XCTAssertFalse(fixture.isEmpty, "fixture should not be empty — check the path in loadFixture()")
    for fixtureCase in fixture {
      let actual = segmentsForSession(fixtureCase.session)
      let expected = fixtureCase.expectedSegments.map(\.asSegment)
      XCTAssertEqual(actual, expected, "\(fixtureCase.name): Swift output diverged from the JS baseline")
    }
  }
}
