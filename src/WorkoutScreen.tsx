import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import {
  useFonts,
  Inter_700Bold,
  Inter_800ExtraBold,
  Inter_900Black,
} from '@expo-google-fonts/inter';
import { ChakraPetch_700Bold } from '@expo-google-fonts/chakra-petch';
import React, { useEffect, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
  LayoutChangeEvent,
} from 'react-native';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { configureAudioSession, useWorkoutAudio } from './audio';
import { useTimerEngine } from './timerEngine';
import {
  type Interval,
  type Phase,
  intervalsToSegments,
  PHASE_META,
  totalDuration,
} from './workout';

// ─── Tidal (dark) theme ───────────────────────────────────────────────────────
const T = {
  bgGradient: ['#0b1d26', '#0e2832'] as const,
  text:      '#eef6f7',
  subText:   'rgba(255,255,255,0.72)',
  faintText: 'rgba(255,255,255,0.44)',
  hairline:  'rgba(255,255,255,0.10)',
  ghostBg:   'rgba(255,255,255,0.05)',
  accent:    '#3ad6c6',
  btnGlyph:  '#06131a',
};

// ─── Demo workout (Tabata Burnout — 285 s total) ──────────────────────────────
const DEMO_INTERVALS: Interval[] = [
  { type: 'warmup',   dur: 45 },
  { type: 'work',     dur: 30 },
  { type: 'rest',     dur: 15 },
  { type: 'blast',    dur: 30 },
  { type: 'rest',     dur: 15 },
  { type: 'work',     dur: 30 },
  { type: 'rest',     dur: 15 },
  { type: 'blast',    dur: 30 },
  { type: 'rest',     dur: 15 },
  { type: 'cooldown', dur: 60 },
];
const DEMO_NAME = 'Tabata Burnout';
const SEGMENTS  = intervalsToSegments(DEMO_INTERVALS);
const TOTAL_DUR = totalDuration(SEGMENTS);

// Phase icons — exact paths from design/themed-core.jsx (TIcon)
// All stroke-based: fill none, strokeWidth 2.2, round caps/joins
function PhaseIcon({ phase, color, size = 23 }: { phase: Phase; color: string; size?: number }) {
  const p = { fill: 'none', stroke: color, strokeWidth: 2.2, strokeLinecap: 'round' as const, strokeLinejoin: 'round' as const };
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      {phase === 'warmup' || phase === 'cooldown' ? (
        <G {...p}>
          <Circle cx="12" cy="12" r="4.2" />
          <Path d="M12 2v2.5M12 19.5V22M2 12h2.5M19.5 12H22M4.9 4.9l1.8 1.8M17.3 17.3l1.8 1.8M19.1 4.9l-1.8 1.8M6.7 17.3l-1.8 1.8" />
        </G>
      ) : phase === 'work' ? (
        <Path {...p} d="M12 2.5c3 4 6 5.5 6 10a6 6 0 0 1-12 0c0-2 1-3.4 2.4-4.6.2 1.6 1 2.4 2 2.6-1.2-3 .3-6.4 1.6-8z" />
      ) : phase === 'blast' ? (
        <Path {...p} d="M13 2 4 13h6l-1 9 9-12h-6l1-8z" />
      ) : (
        // rest — pause bars
        <G {...p}>
          <Rect x="6" y="5" width="4" height="14" rx="1.5" />
          <Rect x="14" y="5" width="4" height="14" rx="1.5" />
        </G>
      )}
    </Svg>
  );
}

const tfmt = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

// ─── Ghost button (Reset / Skip) ─────────────────────────────────────────────
function GhostBtn({
  onPress,
  disabled,
  children,
}: {
  onPress: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      style={[styles.ghostBtn, disabled && { opacity: 0.3 }]}
    >
      {children}
    </Pressable>
  );
}

// ─── Main screen ─────────────────────────────────────────────────────────────
export default function WorkoutScreen() {
  useKeepAwake();

  const [fontsLoaded] = useFonts({
    Inter_700Bold,
    Inter_800ExtraBold,
    Inter_900Black,
    ChakraPetch_700Bold,
  });

  const audio = useWorkoutAudio();

  const { state, start, pause, resume, reset, skip } = useTimerEngine(SEGMENTS, {
    onTransition: (_from, to) => { if (to) audio.cueForPhase(to.phase); },
    onCountdown:  ()          => audio.playTick(),
    onFinish:     ()          => { audio.playFinish(); audio.stopKeepAlive(); },
  });

  useEffect(() => { configureAudioSession(); }, []);

  const progressAnim  = useRef(new Animated.Value(1)).current;
  const playheadAnim  = useRef(new Animated.Value(0)).current;

  const effectiveIndex = state.currentIndex >= 0 ? state.currentIndex : 0;
  const seg            = SEGMENTS[effectiveIndex];
  const nextSeg        = SEGMENTS[effectiveIndex + 1];
  const meta           = PHASE_META[seg.phase];
  const nextMeta       = nextSeg ? PHASE_META[nextSeg.phase] : null;

  useEffect(() => {
    const fraction = state.status === 'idle'
      ? 1
      : seg.duration > 0 ? state.remainingInSegment / seg.duration : 0;
    Animated.timing(progressAnim, {
      toValue: Math.max(0, Math.min(1, fraction)),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [state.remainingInSegment, state.currentIndex, state.status]);

  useEffect(() => {
    const pct = TOTAL_DUR > 0 ? state.elapsed / TOTAL_DUR : 0;
    Animated.timing(playheadAnim, {
      toValue: Math.max(0, Math.min(1, pct)),
      duration: 250,
      useNativeDriver: false,
    }).start();
  }, [state.elapsed]);

  const handlePlayPause = () => {
    if (state.status === 'idle' || state.status === 'finished') {
      audio.startKeepAlive();
      start();
    } else if (state.status === 'running') {
      pause();
    } else {
      resume();
    }
  };

  const pct              = TOTAL_DUR > 0 ? Math.round((state.elapsed / TOTAL_DUR) * 100) : 0;
  const isPlaying        = state.status === 'running';
  const isIdle           = state.status === 'idle';
  const isDone           = state.status === 'finished';
  const displayRemaining = isIdle ? tfmt(TOTAL_DUR) : tfmt(state.remainingTotal);
  const displayCountdown = isIdle ? tfmt(SEGMENTS[0].duration) : tfmt(state.remainingInSegment);
  const intervalNum      = state.currentIndex >= 0 ? state.currentIndex + 1 : 1;

  if (!fontsLoaded) return null;

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>INTERVAL SESSION</Text>
          <Text style={styles.headerTitle}>{DEMO_NAME}</Text>
        </View>
        <Pressable style={styles.closeBtn}>
          <Svg width={14} height={14} viewBox="0 0 15 15">
            <Path d="M2 2l11 11M13 2L2 13" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      {/* ── Phase center block ── */}
      <View style={styles.phaseBlock}>
        <View style={[styles.iconBadge, { backgroundColor: meta.color + '22', borderColor: meta.color + '55' }]}>
          <PhaseIcon phase={seg.phase} color={meta.color} size={23} />
        </View>

        <Text style={[styles.phaseLabel, { color: meta.color, textShadowColor: meta.color + '55' }]}>
          {meta.word}
        </Text>

        <Text style={[styles.countdown, { textShadowColor: meta.color + '3a' }]}>
          {displayCountdown}
        </Text>

        <Text style={styles.intervalCounter}>
          {'INTERVAL '}
          <Text style={{ color: meta.color }}>{intervalNum}</Text>
          {` OF ${SEGMENTS.length}`}
        </Text>

        <View style={styles.progressTrack}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: meta.color,
                shadowColor:     meta.color,
                width: progressAnim.interpolate({
                  inputRange:  [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
      </View>

      {/* ── Next up row ── */}
      <View style={styles.nextUpRow}>
        {nextMeta ? (
          <>
            <Text style={styles.nextLabel}>NEXT</Text>
            <Text style={[styles.nextLabel, { marginHorizontal: 4 }]}>→</Text>
            <PhaseIcon phase={nextSeg!.phase} color={nextMeta.color} size={15} />
            <Text style={[styles.nextPhase, { color: nextMeta.color, marginLeft: 5 }]}>
              {nextMeta.word}
            </Text>
          </>
        ) : (
          <Text style={[styles.nextPhase, { color: meta.color }]}>FINISH</Text>
        )}
      </View>

      {/* ── Timeline strip ── */}
      <View style={styles.timelineWrap}>
        <View
          style={styles.timelineBar}
          onLayout={(e: LayoutChangeEvent) => { /* width captured for future use */ }}
        >
          {SEGMENTS.map((s, i) => {
            const widthPct    = (s.duration / TOTAL_DUR) * 100;
            const isActive    = i === state.currentIndex;
            const isCompleted = state.currentIndex > 0 && i < state.currentIndex;
            const phColor     = PHASE_META[s.phase].color;
            return (
              <View
                key={i}
                style={[
                  styles.timelineSeg,
                  {
                    width:           `${widthPct}%`,
                    backgroundColor: phColor,
                    opacity:         isCompleted ? 0.28 : isActive ? 1 : 0.5,
                    shadowColor:     phColor,
                    shadowOpacity:   isActive ? 0.7 : 0,
                    shadowRadius:    isActive ? 6 : 0,
                    shadowOffset:    { width: 0, height: 0 },
                    elevation:       isActive ? 4 : 0,
                  },
                ]}
              />
            );
          })}

          {/* Playhead */}
          <Animated.View
            style={[
              styles.playhead,
              {
                left: playheadAnim.interpolate({
                  inputRange:  [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          >
            <View style={styles.playheadCircle} />
            <View style={styles.playheadBar} />
          </Animated.View>
        </View>

        <View style={styles.timelineLabels}>
          <Text style={styles.timelineLabelText}>{pct}%</Text>
          <Text style={styles.timelineLabelText}>{displayRemaining} left</Text>
        </View>
      </View>

      {/* ── Controls row ── */}
      <View style={styles.controls}>
        {/* Reset — from design ResetIcon */}
        <GhostBtn onPress={reset} disabled={isIdle}>
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
            <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </GhostBtn>

        {/* Play/Pause — from design PlayBtnT */}
        <Pressable onPress={handlePlayPause} style={styles.playBtn}>
          <View style={styles.playBtnInner}>
            {isPlaying ? (
              <Svg width={26} height={28} viewBox="0 0 28 30">
                <Rect x="3" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
                <Rect x="17" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
              </Svg>
            ) : (
              <Svg width={26} height={28} viewBox="0 0 28 30">
                <Path d="M5 3 L25 15 L5 27 Z" fill={T.btnGlyph} stroke={T.btnGlyph} strokeWidth={3.5} strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        </Pressable>

        {/* Skip — from design SkipIcon */}
        <GhostBtn onPress={skip} disabled={isIdle || isDone}>
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path d="M4 4l9 6-9 6V4z" fill={T.subText} />
            <Rect x="15" y="4" width="2.5" height="12" rx="1.2" fill={T.subText} />
          </Svg>
        </GhostBtn>
      </View>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  headerLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10.5,
    letterSpacing: 10.5 * 0.18,
    textTransform: 'uppercase',
    color: T.faintText,
  },
  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: 18 * -0.01,
    color: T.text,
    marginTop: 2,
  },
  closeBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.ghostBg,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },

  // Phase center block
  phaseBlock: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  iconBadge: {
    width: 40,
    height: 40,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontFamily: 'Inter_900Black',
    fontSize: 36,
    letterSpacing: 36 * 0.01,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  countdown: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 86,
    lineHeight: 86,
    color: T.text,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 34,
  },
  intervalCounter: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    letterSpacing: 13.5 * 0.08,
    color: T.faintText,
  },
  progressTrack: {
    width: '100%',
    maxWidth: 240,
    height: 22,
    borderRadius: 6,
    backgroundColor: T.hairline,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius:  6,
  },

  // Next up
  nextUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 8,
  },
  nextLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.14,
    color: T.faintText,
  },
  nextPhase: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 14,
    letterSpacing: 14 * 0.05,
  },

  // Timeline
  timelineWrap: {
    gap: 8,
    marginBottom: 6,
  },
  timelineBar: {
    height: 22,
    flexDirection: 'row',
    gap: 2,
    position: 'relative',
  },
  timelineSeg: {
    height: '100%',
    borderRadius: 5,
    minWidth: 2,
  },
  playhead: {
    position: 'absolute',
    top: -4,
    bottom: -4,
    marginLeft: -1.5,
    alignItems: 'center',
  },
  playheadCircle: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: T.text,
    position: 'absolute',
    top: -2,
    shadowColor: T.text,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius:  4,
  },
  playheadBar: {
    width: 3,
    flex: 1,
    borderRadius: 3,
    backgroundColor: T.text,
    shadowColor: T.text,
    shadowOffset:  { width: 0, height: 0 },
    shadowOpacity: 0.8,
    shadowRadius:  4,
    marginTop: 6,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineLabelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12.5,
    letterSpacing: 12.5 * 0.04,
    color: T.subText,
  },

  // Controls
  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    marginTop: 6,
  },
  ghostBtn: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: T.ghostBg,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  playBtn: {
    width: 74,
    height: 74,
    borderRadius: 37,
    shadowColor: T.accent,
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius:  15,
    elevation: 8,
  },
  playBtnInner: {
    flex: 1,
    borderRadius: 37,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
