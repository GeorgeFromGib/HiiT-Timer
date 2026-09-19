// Golden-fixture parity check: src/lib/sessions.ts's getSessionSegments() is
// hand-ported to ios/Shared/SegmentBuilder.swift's segmentsForSession() (see
// SegmentExpansionParityTests.swift, which reads this same fixture file).
// This side just guards the JS implementation against the recorded baseline;
// the Swift side is what actually catches cross-language drift.
import { getSessionSegments, type Session } from '../sessions';
import fixture from '../__fixtures__/segmentExpansionParity.json';

describe('segment expansion parity fixture', () => {
  for (const { name, session, expectedSegments } of fixture) {
    it(`${name}: matches the recorded baseline`, () => {
      expect(getSessionSegments(session as Session)).toEqual(expectedSegments);
    });
  }
});
