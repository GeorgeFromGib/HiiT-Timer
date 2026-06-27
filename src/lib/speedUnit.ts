import { convertKmhToMph, convertMphToKmh } from './workout';

export function toDisplay(kmh: number, unit: 'km' | 'miles'): number {
  return unit === 'miles' ? convertKmhToMph(kmh) : kmh;
}

export function fromDisplay(value: number, unit: 'km' | 'miles'): number {
  return unit === 'miles' ? convertMphToKmh(value) : value;
}

// Formats for display during a workout — rounds mph to nearest 0.5 for readability
export function formatSpeed(kmh: number, unit: 'km' | 'miles'): string {
  if (unit === 'miles') {
    const mph = Math.round(convertKmhToMph(kmh) * 2) / 2;
    return `${mph.toFixed(1)} mph`;
  }
  return `${kmh} km/h`;
}

export function pickerRange(unit: 'km' | 'miles'): { min: number; max: number } {
  return unit === 'miles' ? { min: 0, max: 31 } : { min: 0, max: 50 };
}
