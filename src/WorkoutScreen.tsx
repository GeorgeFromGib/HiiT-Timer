import React, { useMemo, useEffect } from 'react';
import { View, Text, Pressable, StyleSheet, AppState, Dimensions } from 'react-native';
import { useKeepAwake } from 'expo-keep-awake';
import {
  WorkoutConfig,
  Segment,
  expandWorkout,
  totalDuration,
  PHASE_META,
} from './workout';
import { useTimerEngine } from './timerEngine';
import { useWorkoutAudio, configureAudioSession } from './audio';

const DEMO: WorkoutConfig = {
  warmup: 40,
  high: 20,
  low: 10,
  rounds: 8,
  cooldown: 20,
  dropLastRecovery: true,
};

const { width: SCREEN_W } = Dimensions.get('window');
const CIRCLE_SIZE = SCREEN_W - 16;
const CX = CIRCLE_SIZE / 2;
const CY = CIRCLE_SIZE / 2;
const RING_STROKE = 18;
const RING_R = CX - RING_STROKE / 2 - 6;
const INNER_DIAM = (RING_R - RING_STROKE / 2) * 2;
const N_TICKS = 180;
const TICK_W = (2 * Math.PI * RING_R / N_TICKS) * 1.02;

function fmtCount(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  if (s <= 60) return String(s);
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

function fmt(seconds: number): string {
  const s = Math.max(0, Math.ceil(seconds));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

// ─── Ring components ──────────────────────────────────────────────────────────

interface RingTicksProps {
  segments: Segment[];
  total: number;
  elapsed: number;
}

const RingTicks = React.memo(
  function RingTicks({ segments, total, elapsed }: RingTicksProps) {
    // Positions and colours only depend on segments — recomputed on segment list change only.
    const tickData = useMemo(() => {
      if (!total) return [];
      const out: Array<{
        key: number; left: number; top: number; angle: number; color: string; time: number;
      }> = [];

      for (let i = 0; i < N_TICKS; i++) {
        const f = i / N_TICKS;
        const t = f * total;

        let seg: Segment | null = null;
        for (const s of segments) {
          if (t >= s.startAt && t < s.endAt) { seg = s; break; }
        }
        if (!seg) continue;

        const rad = f * 2 * Math.PI;
        out.push({
          key: i,
          left: CX + RING_R * Math.sin(rad) - TICK_W / 2,
          top: CY - RING_R * Math.cos(rad) - RING_STROKE / 2,
          angle: f * 360,
          color: PHASE_META[seg.phase].color,
          time: t,
        });
      }
      return out;
    }, [segments, total]);

    return (
      <>
        {tickData.map(t => (
          <View
            key={t.key}
            style={{
              position: 'absolute',
              width: TICK_W,
              height: RING_STROKE,
              backgroundColor: t.color,
              opacity: t.time > elapsed ? 1 : 0.35,
              left: t.left,
              top: t.top,
              transform: [{ rotate: `${t.angle}deg` }],
            }}
          />
        ))}
      </>
    );
  },
);

// Marker re-renders every tick but is just one View.
function RingMarker({ elapsed, total }: { elapsed: number; total: number }) {
  const rad = total > 0 ? (elapsed / total) * 2 * Math.PI : 0;
  const angle = total > 0 ? (elapsed / total) * 360 : 0;
  return (
    <View
      style={{
        position: 'absolute',
        width: 4,
        height: RING_STROKE + 8,
        borderRadius: 2,
        backgroundColor: '#fff',
        left: CX + RING_R * Math.sin(rad) - 2,
        top: CY - RING_R * Math.cos(rad) - RING_STROKE / 2 - 4,
        transform: [{ rotate: `${angle}deg` }],
      }}
    />
  );
}

function SegmentRing({
  segments,
  total,
  elapsed,
}: {
  segments: Segment[];
  total: number;
  elapsed: number;
}) {
  return (
    <View style={{ width: CIRCLE_SIZE, height: CIRCLE_SIZE }}>
      <RingTicks segments={segments} total={total} elapsed={elapsed} />
      <RingMarker elapsed={elapsed} total={total} />
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function WorkoutScreen() {
  useKeepAwake();

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
  const meta = seg ? PHASE_META[seg.phase] : null;
  const completedPct = total > 0 ? Math.round((state.elapsed / total) * 100) : 0;

  const handleStart = async () => {
    try {
      await configureAudioSession();
      audio.startKeepAlive();
    } catch (e) {
      console.warn('Audio session setup failed', e);
    }
    engine.start();
  };

  useEffect(() => {
    const sub = AppState.addEventListener('change', (nextState) => {
      if (nextState === 'active') engine.sync();
    });
    return () => sub.remove();
  }, [engine.sync]);

  return (
    <View style={styles.root}>
      {/* Stats row */}
      <View style={styles.statsRow}>
        <View style={styles.statBox}>
          <Text style={styles.statLabel}>Remaining</Text>
          <Text style={styles.statValue}>{fmt(state.remainingTotal)}</Text>
        </View>
        <View style={styles.statBox}>
          <Text style={[styles.statLabel, { color: '#17BF63' }]}>Completed</Text>
          <Text style={[styles.statValue, { color: '#17BF63' }]}>{completedPct}%</Text>
        </View>
      </View>

      {/* Circular segment ring with text inside */}
      <View style={styles.circleArea}>
        <SegmentRing
          segments={segments}
          total={total}
          elapsed={state.elapsed}
        />
        {/* Coloured inner fill */}
        <View
          style={{
            position: 'absolute',
            width: INNER_DIAM,
            height: INNER_DIAM,
            borderRadius: INNER_DIAM / 2,
            backgroundColor: meta?.color ?? '#0D1F2D',
            opacity: 0.25,
          }}
        />
        <View style={[StyleSheet.absoluteFill, styles.innerContent]}>
          {state.status === 'finished' ? (
            <Text style={styles.phaseWord}>DONE</Text>
          ) : seg ? (
            <>
              <Text style={styles.phaseWord}>{meta?.word}</Text>
              <Text style={[styles.count, state.remainingInSegment > 60 && styles.countWide]}>
                {fmtCount(state.remainingInSegment)}
              </Text>
              <Text style={styles.segLabel}>{seg.label}</Text>
            </>
          ) : (
            <Text style={styles.phaseWord}>READY</Text>
          )}
        </View>
      </View>

      {/* Controls */}
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
  root: {
    flex: 1,
    backgroundColor: '#0D1F2D',
    paddingTop: 64,
    paddingBottom: 48,
    paddingHorizontal: 8,
    alignItems: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginBottom: 32,
    width: '100%',
  },
  statBox: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  statLabel: {
    color: 'rgba(255,255,255,0.55)',
    fontSize: 13,
    fontWeight: '500',
    marginBottom: 4,
  },
  statValue: {
    color: '#fff',
    fontSize: 28,
    fontWeight: '700',
    fontVariant: ['tabular-nums'],
  },
  circleArea: {
    width: CIRCLE_SIZE,
    height: CIRCLE_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
  },
  innerContent: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseWord: {
    color: '#fff',
    fontSize: 22,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  count: {
    color: '#fff',
    fontSize: 80,
    fontWeight: '900',
    fontVariant: ['tabular-nums'],
    lineHeight: 88,
  },
  countWide: { fontSize: 52, lineHeight: 60 },
  segLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 16,
    fontWeight: '500',
    marginTop: 4,
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 16,
    marginTop: 40,
  },
  btn: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    paddingVertical: 16,
    paddingHorizontal: 28,
    borderRadius: 12,
    minWidth: 120,
    alignItems: 'center',
  },
  btnText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '700',
    letterSpacing: 1,
  },
});
