import { LinearGradient } from 'expo-linear-gradient';
import { useKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import {
  PHASE_META,
  totalDuration,
} from '../lib/workout';
import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, ghostBtnStyle, type ThemeTokens } from '../theme';
import PhaseIcon from '../components/PhaseIcon';
import ReadyIcon from '../components/ReadyIcon';
import FinishedIcon from '../components/FinishedIcon';
import GhostBtn  from '../components/GhostBtn';

const GOLD = '#C89B20';

const tfmt = (s: number) => {
  s = Math.max(0, Math.ceil(s));
  if (s >= 3600) {
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = s % 60;
    return `${h}:${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
  }
  if (s < 60) return `${s}`;
  return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
};

export default function WorkoutScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  useKeepAwake();
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const SEGMENTS  = useMemo(() => getSessionSegments(session), []);
  const TOTAL_DUR = useMemo(() => totalDuration(SEGMENTS), [SEGMENTS]);

  const {
    status,
    preStartCount,
    elapsed,
    currentIndex,
    remainingInSegment,
    remainingTotal,
    congratsMsg,
    handlePlayPause,
    reset,
    skip,
  } = useWorkoutSession(SEGMENTS);

  const progressAnim = useRef(new Animated.Value(1)).current;

  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg            = SEGMENTS[effectiveIndex];
  const nextSeg        = SEGMENTS[effectiveIndex + 1];
  const meta           = PHASE_META[seg.phase];
  const nextMeta       = nextSeg ? PHASE_META[nextSeg.phase] : null;
  const phaseColor     = T.phases[seg.phase];
  const nextPhaseColor = nextSeg ? T.phases[nextSeg.phase] : null;

  useEffect(() => {
    progressAnim.setValue(1);
  }, [currentIndex]);

  useEffect(() => {
    if (status === 'idle') { progressAnim.setValue(1); return; }
    const fraction = seg.duration > 0 ? remainingInSegment / seg.duration : 0;
    Animated.timing(progressAnim, {
      toValue: Math.max(0, Math.min(1, fraction)),
      duration: 200,
      useNativeDriver: false,
    }).start();
  }, [remainingInSegment, status]);

  const isPlaying        = status === 'running';
  const isIdle           = status === 'idle';
  const isDone           = status === 'finished';
  const isPreStart       = status === 'preStart';
  const pct              = TOTAL_DUR > 0 ? Math.round((elapsed / TOTAL_DUR) * 100) : 0;
  const displayRemaining      = isIdle ? tfmt(TOTAL_DUR) : tfmt(remainingTotal);
  const remainingForCountdown = Math.max(0, Math.ceil(isIdle ? SEGMENTS[0].duration : remainingInSegment));
  const displayCountdown      = isPreStart ? String(preStartCount) : tfmt(remainingForCountdown);
  const countdownHasHours     = !isPreStart && remainingForCountdown >= 3600;
  const countdownFontSize     = countdownHasHours ? 88 : 124;
  const intervalNum           = currentIndex >= 0 ? currentIndex + 1 : 1;
  const segStartPct           = `${(seg.startAt / TOTAL_DUR) * 100}%`;
  const segEndPct             = `${(seg.endAt   / TOTAL_DUR) * 100}%`;
  const chevronLeft           = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [segEndPct, segStartPct],
  });

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* ── Header ── */}
      <View style={styles.header}>
        <Pressable style={styles.closeBtn} onPress={onBack}>
          <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
            <Path d="M10 13L5 8l5-5" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={{ flex: 1, alignItems: 'center' }}>
          <Text style={styles.headerLabel}>INTERVAL SESSION</Text>
          <Text style={styles.headerTitle}>{session.name}</Text>
        </View>
        <View style={{ width: 36 }} />
      </View>

      {/* ── Phase center block ── */}
      <View style={styles.phaseBlock}>
        {/* icon + label: anchored to bottom of top half */}
        <View style={styles.phaseTop}>
          <View style={[styles.iconBadge, {
            backgroundColor: (isDone ? GOLD : isPreStart ? T.accent : phaseColor) + '22',
            borderColor:     (isDone ? GOLD : isPreStart ? T.accent : phaseColor) + '55',
          }]}>
            {isDone
              ? <FinishedIcon color={GOLD} size={30} />
              : isPreStart
                ? <ReadyIcon color={T.accent} size={30} />
                : <PhaseIcon phase={seg.phase} color={phaseColor} size={30} />
            }
          </View>

          <Text style={[styles.phaseLabel, {
            color:           isDone ? GOLD : isPreStart ? T.accent : phaseColor,
            textShadowColor: (isDone ? GOLD : isPreStart ? T.accent : phaseColor) + '55',
          }]}>
            {isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}
          </Text>

        </View>

        {/* countdown: always rendered to keep layout stable; digits hidden when done */}
        <View style={styles.countdownRow}>
          {displayCountdown.split('').map((ch, i) => (
            <Text
              key={i}
              style={[styles.countdown, {
                opacity: isDone ? 0 : 1,
                textShadowColor: (isPreStart ? T.accent : phaseColor) + '3a',
                fontSize: countdownFontSize,
                lineHeight: countdownFontSize,
                width: ch === ':' ? countdownFontSize * 0.28 : countdownFontSize * 0.62,
              }]}
            >
              {ch}
            </Text>
          ))}
          {isDone && (
            <Text style={styles.congratsMsg}>{congratsMsg}</Text>
          )}
        </View>

        {/* interval text + bar: anchored to top of bottom half */}
        <View style={styles.phaseBottom}>
          {!isDone && (
            <Text style={[styles.intervalCounter, isPreStart && { opacity: 0 }]}>
              {'INTERVAL '}
              <Text style={{ color: T.onBg }}>{intervalNum}</Text>
              {` OF ${SEGMENTS.length}`}
            </Text>
          )}

          {!isDone && (
            <View style={[styles.progressTrack, isPreStart && { opacity: 0 }]}>
              <Animated.View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: phaseColor,
                    shadowColor:     phaseColor,
                    width: progressAnim.interpolate({
                      inputRange:  [0, 1],
                      outputRange: ['0%', '100%'],
                    }),
                  },
                ]}
              />
            </View>
          )}
        </View>
      </View>

      {/* ── Next up row ── */}
      <View style={[styles.nextUpRow, isDone && { opacity: 0 }]}>
        {nextMeta ? (
          <>
            <Text style={styles.nextLabel}>NEXT</Text>
            <Text style={[styles.nextLabel, { marginHorizontal: 4 }]}>→</Text>
            <PhaseIcon phase={nextSeg!.phase} color={nextPhaseColor!} size={20} />
            <Text style={[styles.nextPhase, { color: nextPhaseColor!, marginLeft: 5 }]}>
              {nextMeta.word}
            </Text>
          </>
        ) : (
          <Text style={[styles.nextPhase, { color: phaseColor }]}>FINISH</Text>
        )}
      </View>

      {/* ── Timeline strip ── */}
      <View style={styles.timelineWrap}>
        <View style={styles.timelineBar}>
          <View style={styles.segmentsClip}>
            {SEGMENTS.map((s, i) => {
              const widthPct    = (s.duration / TOTAL_DUR) * 100;
              const isActive    = !isDone && i === currentIndex;
              const isCompleted = isDone || (currentIndex > 0 && i < currentIndex);
              const phColor     = T.phases[s.phase];

              if (isActive) {
                return (
                  <View
                    key={i}
                    style={[styles.timelineSeg, { width: `${widthPct}%`, overflow: 'hidden' }]}
                  >
                    <View style={[StyleSheet.absoluteFill, { backgroundColor: phColor, opacity: 0.28 }]} />
                    <Animated.View
                      style={{
                        position: 'absolute',
                        right: 0, top: 0, bottom: 0,
                        backgroundColor: phColor,
                        shadowColor: phColor,
                        shadowOpacity: 0.7,
                        shadowRadius: 6,
                        shadowOffset: { width: 0, height: 0 },
                        elevation: 4,
                        width: progressAnim.interpolate({
                          inputRange: [0, 1],
                          outputRange: ['0%', '100%'],
                        }),
                      }}
                    />
                  </View>
                );
              }

              return (
                <View
                  key={i}
                  style={[styles.timelineSeg, {
                    width:           `${widthPct}%`,
                    backgroundColor: phColor,
                    opacity:         isCompleted ? 0.28 : 1.0,
                  }]}
                />
              );
            })}
          </View>
          {!isDone && <Animated.View style={[styles.markerLine, { left: chevronLeft }]} />}
        </View>

        <View style={styles.timelineLabels}>
          <Text style={styles.timelineLabelText}>{pct}%</Text>
          <Text style={styles.timelineLabelText}>{displayRemaining} left</Text>
        </View>
      </View>

      {/* ── Controls row ── */}
      <View style={styles.controls}>
        <GhostBtn onPress={reset} disabled={isIdle || isPreStart}>
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
            <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </GhostBtn>

        <Pressable onPress={handlePlayPause} style={styles.playBtn}>
          <View style={styles.playBtnInner}>
            {(isPlaying || isPreStart) ? (
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

        <GhostBtn onPress={skip} disabled={isIdle || isDone || isPreStart}>
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path d="M4 4l9 6-9 6V4z" fill={T.subText} />
            <Rect x="15" y="4" width="2.5" height="12" rx="1.2" fill={T.subText} />
          </Svg>
        </GhostBtn>
      </View>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 24,
  },

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
  closeBtn: ghostBtnStyle(T),

  phaseBlock: {
    flex: 1,
  },
  phaseTop: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
    gap: 8,
  },
  phaseBottom: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: -10,
    gap: 24,
  },
  iconBadge: {
    width: 52,
    height: 52,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  phaseLabel: {
    fontFamily: 'Inter_900Black',
    fontSize: 44,
    letterSpacing: 44 * 0.01,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  congratsMsg: {
    fontFamily: 'Inter_700Bold_Italic',
    fontSize: 24,
    letterSpacing: 24 * 0.05,
    color: T.onBg,
    opacity: 0.7,
    position: 'absolute',
    top: 48,
    left: 0,
    right: 0,
    textAlign: 'center',
  },
  countdownRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  countdown: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 120,
    lineHeight: 120,
    color: T.text,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 34,
  },
  intervalCounter: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    letterSpacing: 19 * 0.08,
    color: T.onBg,
  },
  progressTrack: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    height: 26,
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

  nextUpRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
    paddingVertical: 8,
    marginBottom: 16,
  },
  nextLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 15,
    letterSpacing: 15 * 0.14,
    color: T.onBg,
  },
  nextPhase: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 19,
    letterSpacing: 19 * 0.05,
  },

  timelineWrap: {
    gap: 8,
    marginBottom: 24,
    marginHorizontal: 16,
  },
  timelineBar: {
    height: 26,
    position: 'relative',
  },
  segmentsClip: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    borderRadius: 6,
    overflow: 'hidden',
  },
  markerLine: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    width: 2,
    marginLeft: -1,
    backgroundColor: T.onBg,
    borderRadius: 1,
  },
  timelineSeg: {
    height: '100%',
    borderRadius: 5,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 10,
  },
  timelineLabelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 19,
    letterSpacing: 19 * 0.04,
    color: T.subText,
  },

  controls: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 22,
    marginTop: 6,
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
}); }
