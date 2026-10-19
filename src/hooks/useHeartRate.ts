import { useEffect, useState } from 'react';
import {
  freshBpm, getAge, maxHrFromAge, startHeartRate, zoneFor, type HrSample,
} from '../lib/heartRate';

/** Live `{ bpm, zone }` while `enabled`, or null when there's no recent sample. */
export function useHeartRate(enabled: boolean): { bpm: number; zone: number } | null {
  const [sample, setSample] = useState<HrSample | null>(null);
  const [now, setNow] = useState(Date.now());
  const [maxHr, setMaxHr] = useState(maxHrFromAge(null));

  useEffect(() => {
    if (!enabled) { setSample(null); return; }
    let cancelled = false;
    getAge().then(age => { if (!cancelled) setMaxHr(maxHrFromAge(age)); });
    const stop = startHeartRate(setSample);
    const tick = setInterval(() => setNow(Date.now()), 2000); // lets a silent watch age the sample out
    return () => { cancelled = true; stop(); clearInterval(tick); };
  }, [enabled]);

  const bpm = freshBpm(sample, now);
  return bpm === null ? null : { bpm, zone: zoneFor(bpm, maxHr) };
}
