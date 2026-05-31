// audio.ts
// Same two jobs as before, but tones are synthesised from PCM rather than
// loaded from asset files, so no .wav files are required in assets/.
//
// How it works: each cue is a sine-wave (or silence) rendered into a Float32
// buffer, packed into a WAV container, and base64-encoded as a data URI.
// expo-audio accepts data URIs as an AudioSource on web and on native
// (AVFoundation/ExoPlayer both support the data: scheme).  If you find that
// a particular native target rejects data URIs, the fix is one extra step:
// write the base64 string to a temp file with expo-file-system and pass that
// file:// URI instead.

import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { useEffect, useRef } from 'react';
import type { Phase } from './workout';

// ── WAV synthesis ──────────────────────────────────────────────────────────

const SR = 22050; // sample rate — adequate for tones, keeps buffers small

function buildWavDataUri(samples: Float32Array): string {
  const n = samples.length;
  const buf = new ArrayBuffer(44 + n * 2);
  const v = new DataView(buf);

  const str = (off: number, s: string) => {
    for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i));
  };

  str(0,  'RIFF');  v.setUint32(4,  36 + n * 2,   true);
  str(8,  'WAVE');  str(12, 'fmt ');
  v.setUint32(16, 16,       true);   // PCM subchunk size
  v.setUint16(20, 1,        true);   // PCM = 1
  v.setUint16(22, 1,        true);   // mono
  v.setUint32(24, SR,       true);
  v.setUint32(28, SR * 2,   true);   // byte rate
  v.setUint16(32, 2,        true);   // block align
  v.setUint16(34, 16,       true);   // bits per sample
  str(36, 'data'); v.setUint32(40, n * 2, true);

  for (let i = 0; i < n; i++) {
    v.setInt16(44 + i * 2, Math.round(samples[i] * 32767), true);
  }

  // Chunk to avoid call-stack overflow on large buffers
  const bytes = new Uint8Array(buf);
  let binary = '';
  for (let i = 0; i < bytes.length; i += 8192) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 8192));
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

function tone(hz: number, sec: number, vol = 0.7): string {
  const n = Math.floor(SR * sec);
  const fade = Math.min(Math.floor(SR * 0.015), Math.floor(n / 4)); // 15 ms ramp
  const s = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    let amp = vol;
    if (i < fade) amp *= i / fade;
    else if (i > n - fade) amp *= (n - i) / fade;
    s[i] = amp * Math.sin((2 * Math.PI * hz * i) / SR);
  }
  return buildWavDataUri(s);
}

function silence(sec: number): string {
  return buildWavDataUri(new Float32Array(Math.floor(SR * sec)));
}

// ── Cue definitions — generated once at module load ────────────────────────
// Frequencies chosen for easy distinction under exercise conditions:
//   A5 (880 Hz)  — urgent, high-energy "go"
//   C5 (523 Hz)  — softer "recover"
//   C6 (1047 Hz) — short blip for the 3-2-1 tick
//   E5 (659 Hz)  — pleasant completion tone

const CUES = {
  keepalive: silence(2),        // 2 s silence, looped to hold the iOS audio session open
  high:      tone(880,  0.25),
  low:       tone(523,  0.25),
  tick:      tone(1047, 0.07),
  finish:    tone(659,  0.50),
} as const;

type CueKey = keyof typeof CUES;

// ── Public API (unchanged from the file-based version) ─────────────────────

export async function configureAudioSession() {
  await setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'mixWithOthers',
  });
}

export function useWorkoutAudio() {
  const playersRef = useRef<Partial<Record<CueKey, AudioPlayer>>>({});
  const keepAliveRef = useRef<AudioPlayer | null>(null);

  const getPlayer = (key: CueKey): AudioPlayer => {
    if (!playersRef.current[key]) {
      playersRef.current[key] = createAudioPlayer({ uri: CUES[key] });
    }
    return playersRef.current[key]!;
  };

  const playCue = (key: CueKey) => {
    try {
      const p = getPlayer(key);
      p.seekTo(0);
      p.play();
    } catch (e) {
      console.warn('cue failed', key, e);
    }
  };

  const startKeepAlive = () => {
    if (keepAliveRef.current) return;
    const p = createAudioPlayer({ uri: CUES.keepalive });
    p.loop = true;
    p.volume = 0;
    p.play();
    keepAliveRef.current = p;
  };

  const stopKeepAlive = () => {
    keepAliveRef.current?.pause();
    keepAliveRef.current?.remove();
    keepAliveRef.current = null;
  };

  const cueForPhase = (phase: Phase) => playCue(phase === 'high' ? 'high' : 'low');

  useEffect(() => () => {
    stopKeepAlive();
    Object.values(playersRef.current).forEach((p) => p?.remove());
    playersRef.current = {};
  }, []);

  return {
    playCue,
    cueForPhase,
    playTick:   () => playCue('tick'),
    playFinish: () => playCue('finish'),
    startKeepAlive,
    stopKeepAlive,
  };
}
