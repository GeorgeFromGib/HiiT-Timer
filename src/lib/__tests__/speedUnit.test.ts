import { toDisplay, fromDisplay, formatSpeed, pickerRange } from '../speedUnit';
import { convertKmhToMph } from '../workout';

describe('toDisplay', () => {
  it('returns the value unchanged for km', () => {
    expect(toDisplay(10, 'km')).toBe(10);
  });

  it('converts km/h to mph for miles', () => {
    expect(toDisplay(10, 'miles')).toBeCloseTo(convertKmhToMph(10), 8);
  });

  it('converts zero to zero regardless of unit', () => {
    expect(toDisplay(0, 'km')).toBe(0);
    expect(toDisplay(0, 'miles')).toBe(0);
  });
});

describe('fromDisplay', () => {
  it('returns the value unchanged for km', () => {
    expect(fromDisplay(10, 'km')).toBe(10);
  });

  it('converts mph to km/h for miles', () => {
    expect(fromDisplay(6.21371, 'miles')).toBeCloseTo(10, 3);
  });

  it('round-trips toDisplay -> fromDisplay for miles', () => {
    expect(fromDisplay(toDisplay(10, 'miles'), 'miles')).toBeCloseTo(10, 8);
  });
});

describe('formatSpeed', () => {
  it('formats km/h as-is with unit suffix', () => {
    expect(formatSpeed(10, 'km')).toBe('10 km/h');
  });

  it('formats mph rounded to the nearest 0.5 with one decimal', () => {
    expect(formatSpeed(10, 'miles')).toBe('6.0 mph');
  });

  it('formats zero speed', () => {
    expect(formatSpeed(0, 'km')).toBe('0 km/h');
    expect(formatSpeed(0, 'miles')).toBe('0.0 mph');
  });
});

describe('pickerRange', () => {
  it('returns 0-31 for miles', () => {
    expect(pickerRange('miles')).toEqual({ min: 0, max: 31 });
  });

  it('returns 0-50 for km', () => {
    expect(pickerRange('km')).toEqual({ min: 0, max: 50 });
  });
});
