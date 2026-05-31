// WorkoutScreen.tsx
// Wires the engine and audio together and renders the glanceable display:
//   - a big PHASE WORD (text, not just colour -> colourblind-safe)
//   - a huge countdown number for the current segment
//   - a "you are here" TIMELINE across the whole session (the thing most
//     apps don't do) with proportional segment widths and a sweeping marker
//   - the "next up" label so you can prepare without staring
//
// The screen reacts to engine callbacks for audio so cues stay tied to the
// single wall-clock source of truth.

import React, { useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, AppState } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake'; // keeps screen on in foreground
import {
  WorkoutConfig,
  expandWorkout,
  totalDuration,
  PHASE_META,
} from './workout';
import { useTimerEngine } from './timerEngine';
import { useWorkoutAudio, configureAudioSession } from './audio';

const DEMO: WorkoutConfig = {
  warmup: 120,
  high: 40,
  low: 20,
  rounds: 8,
  cooldown: 120,
  dropLastRecovery: true,
};

function fmt(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export default function WorkoutScreen() {
  useKeepAwake(); // optional: respect a user setting if you make it toggleable

  const segments = useMemo(() => expandWorkout(DEMO), []);
  const total = useMemo(() => totalDuration(segments), [segments]);

  const audio = useWorkoutAudio();

  const engine = useTimerEngine(segments, {
    onTransition: (_from, to) => {
      if (to) audio.cueForPhase(to.phase);
    },
    onCountdown: () => audio.playTick(),
    onFinish: () => {
      audio.playFinish();
      audio.stopKeepAlive();
    },
  });

  const { state } = engine;
  const seg = state.currentIndex >= 0 ? segments[state.currentIndex] : null;
  const next = seg && segments[seg.index + 1] ? segments[seg.index + 1] : null;

  const meta = seg ? PHASE_META[seg.phase] : null;
  const bg = state.status === 'finished' ? '#222' : meta?.color ?? '#222';

  const handleStart = async () => {
    await configureAudioSession();
    audio.startKeepAlive();
    engine.start();
  };

  // Re-sync the display the instant we return to foreground (engine already
  // reads the wall clock, but force an immediate visual update).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (s) => {
      // No-op hook point; the 200ms tick will refresh, this is where you'd
      // call an explicit resync if you add one.
    });
    return () => sub.remove();
  }, []);

  return (
    <View style={[styles.root, { backgroundColor: bg }]}>
      <View style={styles.center}>
        {state.status === 'finished' ? (
          <Text style={styles.phaseWord}>DONE</Text>
        ) : seg ? (
          <>
            <Text style={styles.phaseWord}>{meta?.word}</Text>
            <Text style={styles.count}>{fmt(state.remainingInSegment)}</Text>
            <Text style={styles.label}>{seg.label}</Text>
            {next ? (
              <Text style={styles.next}>
                NEXT: {PHASE_META[next.phase].word} · {fmt(next.duration)}
              </Text>
            ) : (
              <Text style={styles.next}>LAST ONE</Text>
            )}
          </>
        ) : (
          <Text style={styles.phaseWord}>READY</Text>
        )}
      </View>

      {/* The whole-session timeline -------------------------------------- */}
      <View style={styles.timelineWrap}>
        <View style={styles.timeline}>
          {segments.map((s) => (
            <View
              key={s.index}
              style={{
                flex: s.duration, // proportional width by duration
                backgroundColor: PHASE_META[s.phase].color,
                opacity: state.currentIndex === s.index ? 1 : 0.45,
                borderRightWidth: 1,
                borderRightColor: 'rgba(0,0,0,0.25)',
              }}
            />
          ))}
          {/* sweeping progress marker */}
          <View
            style={[
              styles.marker,
              { left: `${total ? (state.elapsed / total) * 100 : 0}%` },
            ]}
          />
        </View>
        <View style={styles.timelineLabels}>
          <Text style={styles.tlabel}>{fmt(state.elapsed)}</Text>
          <Text style={styles.tlabel}>-{fmt(state.remainingTotal)}</Text>
        </View>
      </View>

      {/* Controls -------------------------------------------------------- */}
      <View style={styles.controls}>
        {state.status === 'idle' || state.status === 'finished' ? (
          <Btn label="START" onPress={handleStart} />
        ) : state.status === 'running' ? (
          <>
            <Btn label="PAUSE" onPress={engine.pause} />
            <Btn label="SKIP" onPress={engine.skip} />
          </>
        ) : (
          <>
            <Btn label="RESUME" onPress={engine.resume} />
            <Btn label="RESET" onPress={engine.reset} />
          </>
        )}
      </View>
    </View>
  );
}

function Btn({ label, onPress }: { label: string; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, pressed && { opacity: 0.6 }]}
    >
      <Text style={styles.btnText}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, paddingTop: 80, paddingBottom: 48, paddingHorizontal: 20 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  phaseWord: { color: '#fff', fontSize: 44, fontWeight: '800', letterSpacing: 2 },
  count: { color: '#fff', fontSize: 120, fontWeight: '900', fontVariant: ['tabular-nums'] },
  label: { color: 'rgba(255,255,255,0.85)', fontSize: 22, fontWeight: '600' },
  next: { color: 'rgba(255,255,255,0.7)', fontSize: 16, marginTop: 16, letterSpacing: 1 },
  timelineWrap: { marginVertical: 24 },
  timeline: {
    flexDirection: 'row',
    height: 28,
    borderRadius: 6,
    overflow: 'hidden',
    position: 'relative',
  },
  marker: {
    position: 'absolute',
    top: -4,
    width: 3,
    height: 36,
    backgroundColor: '#fff',
  },
  timelineLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
  tlabel: { color: 'rgba(255,255,255,0.8)', fontSize: 13, fontVariant: ['tabular-nums'] },
  controls: { flexDirection: 'row', justifyContent: 'center', gap: 16 },
  btn: {
    backgroundColor: 'rgba(0,0,0,0.35)',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontSize: 18, fontWeight: '700', letterSpacing: 1 },
});
