import { zoneFor, maxHrFromAge, freshBpm } from '../heartRate';

describe('zoneFor', () => {
  it('is 0 below 50% of max', () => expect(zoneFor(94, 190)).toBe(0));
  it.each([[95, 1], [113, 1], [114, 2], [133, 3], [152, 4], [171, 5], [200, 5]])(
    '%i bpm of 190 -> zone %i', (bpm, zone) => expect(zoneFor(bpm, 190)).toBe(zone),
  );
});

describe('maxHrFromAge', () => {
  it('uses 220 - age', () => expect(maxHrFromAge(30)).toBe(190));
  it('falls back to 190 with no age', () => expect(maxHrFromAge(null)).toBe(190));
});

describe('freshBpm', () => {
  const s = { bpm: 150, ts: 1_000_000 };
  it('returns bpm when fresh', () => expect(freshBpm(s, 1_015_000)).toBe(150));
  it('returns null when stale', () => expect(freshBpm(s, 1_015_001)).toBeNull());
  it('returns null with no sample', () => expect(freshBpm(null, 1_000_000)).toBeNull());
});
