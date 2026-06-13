import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { useSettings } from '../lib/settingsContext';
import {
  PHASE_META,
  totalDuration,
  fmtTimer,
  fmtSpeed,
} from '../lib/workout';
import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, withOpacity, buttonShadow, THEME_TOKENS, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import WorkoutIcon from '../components/WorkoutIcon';
import GhostBtn  from '../components/GhostBtn';

const GOLD = '#C89B20';
const EXTEND_OPTIONS = [5, 10, 15] as const;

export default function WorkoutScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const { settings } = useSettings();

  useEffect(() => {
    if (settings.keepScreenAwake) {
      activateKeepAwakeAsync().catch(() => {});
    }
    return () => { deactivateKeepAwake(); };
  }, [settings.keepScreenAwake]);

  const { T, themeKey } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const initialSegments = useMemo(() => getSessionSegments(session), []);
  const [segments, setSegments] = useState(initialSegments);
  const TOTAL_DUR = useMemo(() => totalDuration(segments), [segments]);

  const {
    status,
    preStartCount,
    elapsed,
    currentIndex,
    remainingInSegment,
    remainingTotal,
    congratsMsg,
    handlePlayPause,
    reset: resetEngine,
    skip,
    extend,
  } = useWorkoutSession(segments, settings, () => {
    if (!settings.countdownFlash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashing(true);
    flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
  });

  const reset = () => { resetEngine(); setSegments(initialSegments); };

  const progressAnim = useRef(new Animated.Value(1)).current;
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg            = segments[effectiveIndex];
  const nextSeg        = segments[effectiveIndex + 1];
  const meta           = PHASE_META[seg.phase];
  const nextMeta       = nextSeg ? PHASE_META[nextSeg.phase] : null;
  const phaseColor     = T.phases[seg.phase];
  const nextPhaseColor = nextSeg ? T.phases[nextSeg.phase] : null;

  useEffect(() => {
    progressAnim.setValue(1);
  }, [currentIndex]);

  useEffect(() => {
    if (status === 'idle' || status === 'preStart') { progressAnim.setValue(1); return; }
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
  const displayRemaining      = isIdle ? fmtTimer(TOTAL_DUR) : fmtTimer(remainingTotal);
  const remainingForCountdown = Math.max(0, Math.ceil(isIdle ? segments[0].duration : remainingInSegment));
  const displayCountdown      = isPreStart ? String(preStartCount) : fmtTimer(remainingForCountdown);
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
      <ScreenHeader
        onBack={onBack}
        title={session.name}
        titleStyle={styles.headerTitle}
      />

      {/* ── Phase center block ── */}
      <View style={styles.phaseBlock}>
        {/* icon + label: anchored to bottom of top half */}
        <View style={styles.phaseTop}>
          <View style={[styles.iconBadge, {
            backgroundColor: withOpacity(isDone ? GOLD : isPreStart ? T.accent : phaseColor, 0x22),
            borderColor:     withOpacity(isDone ? GOLD : isPreStart ? T.accent : phaseColor, 0x55),
          }]}>
            {isDone
              ? <WorkoutIcon variant="finished" color={GOLD} size={30} />
              : isPreStart
                ? <WorkoutIcon variant="ready" color={T.accent} size={30} />
                : <WorkoutIcon variant="phase" phase={seg.phase} color={phaseColor} size={30} />
            }
          </View>

          <Text style={[styles.phaseLabel, {
            color:           isDone ? GOLD : isPreStart ? T.accent : phaseColor,
            textShadowColor: withOpacity(isDone ? GOLD : isPreStart ? T.accent : phaseColor, 0x55),
          }]}>
            {isDone ? 'DONE' : isPreStart ? 'GET READY' : meta.word}
          </Text>

          {seg.speed !== undefined && !isDone && !isPreStart && (
            <View style={[styles.speedPill, {
              backgroundColor: withOpacity(phaseColor, 0x21),
              borderColor:     withOpacity(phaseColor, 0x59),
            }]}>
              <Text style={[styles.speedPillText, { color: phaseColor }]}>
                {fmtSpeed(seg.speed, settings.speedUnit)}
              </Text>
            </View>
          )}

        </View>

        {/* countdown: always rendered to keep layout stable; digits hidden when done */}
        <View style={styles.countdownRow}>
          {displayCountdown.split('').map((ch, i) => (
            <Text
              key={i}
              style={[styles.countdown, {
                opacity: isDone ? 0 : flashing ? 0 : 1,
                textShadowColor: withOpacity(isPreStart ? T.accent : phaseColor, 0x3a),
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
              {` OF ${segments.length}`}
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

          {!isDone && !isPreStart && (
            <View style={styles.extendRow}>
              {EXTEND_OPTIONS.map((secs) => (
                <GhostBtn key={secs} onPress={() => setSegments(extend(secs))} disabled={isIdle} color={phaseColor} size={68}>
                  <Text style={[styles.intervalCounter, { color: phaseColor }]}>{`+${secs}s`}</Text>
                </GhostBtn>
              ))}
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
            <WorkoutIcon variant="phase" phase={nextSeg!.phase} color={nextPhaseColor!} size={20} />
            <Text style={[styles.nextPhase, { color: nextPhaseColor!, marginLeft: 5 }]}>
              {nextMeta.word}
            </Text>
            {nextSeg!.speed !== undefined && (
              <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
                {fmtSpeed(nextSeg!.speed, settings.speedUnit)}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.nextPhase, { color: phaseColor }]}>FINISH</Text>
        )}
      </View>

      {/* ── Timeline strip ── */}
      <View style={styles.timelineWrap}>
        <View style={styles.timelineBar}>
          <View style={styles.segmentsClip}>
            {segments.map((s, i) => {
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

  headerTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 18,
    letterSpacing: 18 * -0.01,
    color: T.text,
  },

  phaseBlock: {
    flex: 1,
  },
  phaseTop: {
    flex: 0.9,
    alignItems: 'center',
    justifyContent: 'flex-end',
    paddingBottom: 24,
    gap: 4,
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
    marginBottom: 4,
  },
  phaseLabel: {
    fontFamily: 'Inter_900Black',
    fontSize: 44,
    letterSpacing: 44 * 0.01,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 30,
  },
  speedPill: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 5,
  },
  speedPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 20,
    letterSpacing: 20 * 0.02,
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
  extendRow: {
    flexDirection: 'row',
    gap: 12,
  },
  progressTrack: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    height: 26,
    borderRadius: 6,
    backgroundColor: T.hairline,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
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
    ...buttonShadow(T),
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
