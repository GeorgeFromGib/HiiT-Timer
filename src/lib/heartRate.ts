import { NativeEventEmitter, NativeModules } from 'react-native';

export interface HrSample { bpm: number; ts: number } // ts: epoch ms

const STALE_MS = 10_000;
const ZONE_FLOORS = [0.5, 0.6, 0.7, 0.8, 0.9]; // fraction of max HR where zones 1–5 begin
/** Colour by zone (index = zone): grey, blue, green, yellow, orange, red. */
export const ZONE_COLORS = ['#8a9ba0', '#46a6ff', '#5fd38a', '#f5c542', '#ff8a3d', '#ff5a5f'];
const FALLBACK_MAX_HR = 190; // used when HealthKit has no date of birth

/** Zone 1–5, or 0 when below zone 1. */
export function zoneFor(bpm: number, maxHr: number): number {
  const frac = bpm / maxHr;
  return ZONE_FLOORS.filter(f => frac >= f).length;
}

export function maxHrFromAge(age: number | null): number {
  return age ? 220 - age : FALLBACK_MAX_HR;
}

/** The sample's bpm, or null if it's too old to show as live. */
export function freshBpm(sample: HrSample | null, now: number): number | null {
  return sample && now - sample.ts <= STALE_MS ? sample.bpm : null;
}

export async function requestHeartRateAccess(): Promise<boolean> {
  try {
    return (await NativeModules.HeartRate?.requestAuthorization()) ?? false;
  } catch (e) {
    console.warn('heartRate: requestAuthorization failed', e);
    return false;
  }
}

export async function getAge(): Promise<number | null> {
  try {
    return (await NativeModules.HeartRate?.getAge()) ?? null;
  } catch {
    return null;
  }
}

/** Subscribes to the watch's live heart rate (relayed by LiveSessionSync); returns an unsubscribe. */
export function startHeartRate(onSample: (s: HrSample) => void): () => void {
  const native = NativeModules.LiveSessionSync;
  if (!native) return () => {};
  const sub = new NativeEventEmitter(native).addListener('WatchHeartRate', onSample);
  return () => sub.remove();
}
