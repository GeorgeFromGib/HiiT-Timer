import { LinearGradient } from 'expo-linear-gradient';
import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  PixelRatio,
  Pressable,
  StyleSheet,
  Text,
  View,
  useWindowDimensions,
} from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useWorkoutSession } from '../hooks/useWorkoutSession';
import { useSettings } from '../lib/settingsContext';
import {
  totalDuration,
  fmtTimer,
} from '../lib/workout';
import { formatSpeed } from '../lib/speedUnit';
import { useTranslation } from '../lib/i18n';
import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, withOpacity, buttonShadow, THEME_TOKENS, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import WorkoutIcon from '../components/WorkoutIcon';
import GhostBtn  from '../components/GhostBtn';
import SessionCompleteScreen from './SessionCompleteScreen';
import { checkAndRequestReview } from '../lib/reviewState';

const GOLD = '#C89B20';
const EXTEND_OPTIONS = [5, 10] as const;

export default function WorkoutScreen({ session, onBack }: { session: Session; onBack: () => void }) {
  const { settings } = useSettings();
  const { t } = useTranslation();

  useEffect(() => {
    if (settings.keepScreenAwake) {
      activateKeepAwakeAsync().catch(() => {});
    }
    return () => { deactivateKeepAwake(); };
  }, [settings.keepScreenAwake]);

  const { T, themeKey } = useTheme();
  const { height: screenHeight } = useWindowDimensions();
  // Scale down when screen is logically smaller (Display Zoom or small device).
  // Also account for the user's Larger Text preference so we don't overflow.
  const uiScale = Math.min(1, (screenHeight / 844) / Math.max(1, PixelRatio.getFontScale()));
  const styles = useMemo(() => makeStyles(T, uiScale), [T, uiScale]);

  const initialSegments = useMemo(() => getSessionSegments(session), [session]);
  const toInsert = useMemo(
    () => initialSegments.filter(s => s.phase !== 'cooldown').slice(-2),
    [initialSegments],
  );
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
    addRound,
  } = useWorkoutSession(segments, settings, () => {
    if (!settings.countdownFlash) return;
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    setFlashing(true);
    flashTimerRef.current = setTimeout(() => setFlashing(false), 250);
  });

  const [skippedCount, setSkippedCount] = useState(0);
  const [skippedSecs,  setSkippedSecs]  = useState(0);

  const reset = useCallback(() => {
    resetEngine();
    setSegments(initialSegments);
    setSkippedCount(0);
    setSkippedSecs(0);
  }, [resetEngine, initialSegments]);

  const handleSkip = useCallback(() => {
    setSkippedCount(c => c + 1);
    setSkippedSecs(s => s + Math.ceil(remainingInSegment));
    skip();
  }, [skip, remainingInSegment]);

  const appendLastTwo = useCallback(() => {
    if (!toInsert.length) return;
    setSegments(addRound(toInsert));
  }, [toInsert, addRound]);

  const progressAnim = useRef(new Animated.Value(1)).current;
  const [flashing, setFlashing] = useState(false);
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => { if (flashTimerRef.current) clearTimeout(flashTimerRef.current); }, []);

  const reviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (status !== 'finished') return;
    reviewTimerRef.current = setTimeout(() => { checkAndRequestReview(); }, 1500);
    return () => { if (reviewTimerRef.current) clearTimeout(reviewTimerRef.current); };
  }, [status]);

  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg            = segments[effectiveIndex];
  const nextSeg        = segments[effectiveIndex + 1];
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
  const countdownFontSize     = Math.round((countdownHasHours ? 88 : 124) * uiScale);
  const intervalNum           = currentIndex >= 0 ? currentIndex + 1 : 1;
  const segStartPct           = `${(seg.startAt / TOTAL_DUR) * 100}%`;
  const segEndPct             = `${(seg.endAt   / TOTAL_DUR) * 100}%`;
  const chevronLeft           = progressAnim.interpolate({
    inputRange:  [0, 1],
    outputRange: [segEndPct, segStartPct],
  });

  if (isDone) {
    return (
      <SessionCompleteScreen
        session={session}
        segments={segments}
        totalDur={TOTAL_DUR}
        congratsMsg={congratsMsg}
        skippedCount={skippedCount}
        skippedSecs={skippedSecs}
        showConfetti={settings.congratsMessage}
        onDone={onBack}
        onRepeat={reset}
      />
    );
  }

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

          {(() => {
            const label = isDone ? t('workout.done') : isPreStart ? t('workout.getReady') : t('workout.phase.' + seg.phase);
            const labelSize = Math.round((label.length > 9 ? 35 : 44) * uiScale);
            return (
              <Text
                allowFontScaling={false}
                style={[styles.phaseLabel, {
                  color:           isDone ? GOLD : isPreStart ? T.accent : phaseColor,
                  textShadowColor: withOpacity(isDone ? GOLD : isPreStart ? T.accent : phaseColor, 0x55),
                  fontSize:        labelSize,
                  letterSpacing:   labelSize * 0.01,
                }]}
              >
                {label}
              </Text>
            );
          })()}

          {seg.speed !== undefined && !isDone && !isPreStart && (
            <View style={[styles.speedPill, {
              backgroundColor: withOpacity(phaseColor, 0x21),
              borderColor:     withOpacity(phaseColor, 0x59),
            }]}>
              <Text style={[styles.speedPillText, { color: phaseColor }]}>
                {formatSpeed(seg.speed, settings.speedUnit)}
              </Text>
            </View>
          )}

          {seg.resistance !== undefined && !isDone && !isPreStart && (
            <View style={[styles.spinPill, {
              backgroundColor: withOpacity(phaseColor, 0x21),
              borderColor:     withOpacity(phaseColor, 0x59),
            }]}>
              <Text style={[styles.spinPillLabel, { color: phaseColor }]}>R</Text>
              <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.resistance}</Text>
              <Text style={[styles.spinPillLabel, { color: phaseColor }]}>·</Text>
              <Text style={[styles.spinPillValue, { color: phaseColor }]}>{seg.power}</Text>
              <Text style={[styles.spinPillLabel, { color: phaseColor }]}>W</Text>
            </View>
          )}

          {seg.activityLabel !== undefined && !isDone && !isPreStart && (
            <View style={[styles.speedPill, {
              backgroundColor: withOpacity(phaseColor, 0x21),
              borderColor:     withOpacity(phaseColor, 0x59),
            }]}>
              <Text style={[styles.speedPillText, { color: phaseColor }]}>
                {seg.activityLabel}
              </Text>
            </View>
          )}

        </View>

        {/* countdown: always rendered to keep layout stable; digits hidden when done */}
        <View style={styles.countdownRow}>
          {displayCountdown.split('').map((ch, i) => (
            <Text
              key={i}
              allowFontScaling={false}
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
            <Text allowFontScaling={false} style={styles.congratsMsg}>{congratsMsg}</Text>
          )}
        </View>

        {/* interval text + bar: anchored to top of bottom half */}
        <View style={styles.phaseBottom}>
          {!isDone && (
            <Text style={[styles.intervalCounter, isPreStart && { opacity: 0 }]}>
              {t('workout.intervalPrefix')}
              <Text style={{ color: T.onBg }}>{intervalNum}</Text>
              {t('workout.intervalSuffix', { total: segments.length })}
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
            session.mode === 'circuit' ? (
              seg.circuitNumber !== undefined ? (
                <Text style={[styles.intervalCounter, { color: T.onBg }]}>
                  {t('workout.circuit')} {seg.circuitNumber} / {session.circuits}
                </Text>
              ) : seg.phase === 'circuitRest' && nextSeg?.circuitNumber !== undefined ? (
                <Text style={[styles.intervalCounter, { color: T.onBg }]}>
                  {t('workout.nextCircuit')} {nextSeg.circuitNumber} / {session.circuits}
                </Text>
              ) : null
            ) : (
              <View style={styles.extendRow}>
                <View style={styles.extendLeft}>
                  {EXTEND_OPTIONS.map((secs) => (
                    <GhostBtn key={secs} onPress={() => setSegments(extend(secs))} disabled={isIdle} color={phaseColor} size={68}>
                      <Text style={[styles.intervalCounter, { color: phaseColor }]}>{`+${secs}s`}</Text>
                    </GhostBtn>
                  ))}
                </View>
                <GhostBtn onPress={appendLastTwo} disabled={isIdle} color={phaseColor} size={68}>
                  <Text style={[styles.intervalCounter, { color: phaseColor }]}>
                    {'+1 '}
                    <Text style={styles.roundAbbr}>{t('workout.roundAbbr')}</Text>
                  </Text>
                </GhostBtn>
              </View>
            )
          )}
        </View>
      </View>

      {/* ── Next up row ── */}
      <View style={[styles.nextUpRow, isDone && { opacity: 0 }]}>
        {nextSeg ? (
          <>
            <Text style={styles.nextLabel}>{t('workout.next')}</Text>
            <Text style={[styles.nextLabel, { marginHorizontal: 4 }]}>→</Text>
            <WorkoutIcon variant="phase" phase={nextSeg.phase} color={nextPhaseColor!} size={20} />
            <Text style={[styles.nextPhase, { color: nextPhaseColor!, marginLeft: 5 }]}>
              {t('workout.phase.' + nextSeg.phase)}
            </Text>
            {nextSeg.speed !== undefined && (
              <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
                {formatSpeed(nextSeg.speed, settings.speedUnit)}
              </Text>
            )}
            {nextSeg.resistance !== undefined && (
              <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
                {`R${nextSeg.resistance} · ${nextSeg.power}W`}
              </Text>
            )}
            {nextSeg.activityLabel !== undefined && (
              <Text style={[styles.nextPhase, { color: nextPhaseColor! }]}>
                {nextSeg.activityLabel}
              </Text>
            )}
          </>
        ) : (
          <Text style={[styles.nextPhase, { color: phaseColor }]}>{t('workout.finish')}</Text>
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
          <Text style={styles.timelineLabelText}>{t('workout.left', { time: displayRemaining })}</Text>
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
              <Svg width={Math.round(26 * uiScale)} height={Math.round(28 * uiScale)} viewBox="0 0 28 30">
                <Rect x="3" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
                <Rect x="17" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
              </Svg>
            ) : (
              <Svg width={Math.round(26 * uiScale)} height={Math.round(28 * uiScale)} viewBox="0 0 28 30">
                <Path d="M5 3 L25 15 L5 27 Z" fill={T.btnGlyph} stroke={T.btnGlyph} strokeWidth={3.5} strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        </Pressable>

        <GhostBtn onPress={handleSkip} disabled={isIdle || isDone || isPreStart}>
          <Svg width={19} height={19} viewBox="0 0 20 20" fill="none">
            <Path d="M4 4l9 6-9 6V4z" fill={T.subText} />
            <Rect x="15" y="4" width="2.5" height="12" rx="1.2" fill={T.subText} />
          </Svg>
        </GhostBtn>
      </View>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens, s: number = 1) { return StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: Math.round(24 * s),
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
    paddingBottom: Math.round(24 * s),
    gap: 4,
  },
  phaseBottom: {
    flex: 1.1,
    alignItems: 'center',
    justifyContent: 'flex-start',
    marginTop: Math.round(-10 * s),
    gap: Math.round(24 * s),
  },
  iconBadge: {
    width: Math.round(52 * s),
    height: Math.round(52 * s),
    borderRadius: Math.round(14 * s),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  phaseLabel: {
    fontFamily: 'Inter_900Black',
    letterSpacing: 1,
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
    fontSize: Math.round(20 * s),
    letterSpacing: 20 * 0.02,
  },
  spinPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  spinPillLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 1,
    textTransform: 'uppercase',
  },
  spinPillValue: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 22,
  },
  congratsMsg: {
    fontFamily: 'Inter_700Bold_Italic',
    fontSize: Math.round(24 * s),
    letterSpacing: 24 * 0.05,
    color: T.onBg,
    opacity: 0.7,
    position: 'absolute',
    top: Math.round(48 * s),
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
    color: T.text,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 34,
  },
  intervalCounter: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(19 * s),
    letterSpacing: 19 * 0.08,
    color: T.onBg,
  },
  roundAbbr: {
    fontSize: Math.round(13 * s),
    letterSpacing: 13 * 0.08,
  },
  extendRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    alignSelf: 'stretch',
    marginHorizontal: 16,
  },
  extendLeft: {
    flexDirection: 'row',
    gap: 12,
  },
  progressTrack: {
    alignSelf: 'stretch',
    marginHorizontal: 16,
    height: Math.round(26 * s),
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
    paddingVertical: Math.round(8 * s),
    marginBottom: Math.round(16 * s),
  },
  nextLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(15 * s),
    letterSpacing: 15 * 0.14,
    color: T.onBg,
  },
  nextPhase: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: Math.round(19 * s),
    letterSpacing: 19 * 0.05,
  },

  timelineWrap: {
    gap: 8,
    marginBottom: Math.round(24 * s),
    marginHorizontal: 16,
  },
  timelineBar: {
    height: Math.round(26 * s),
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
    fontSize: Math.round(19 * s),
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
    width: Math.round(74 * s),
    height: Math.round(74 * s),
    borderRadius: Math.round(37 * s),
    ...buttonShadow(T),
    shadowOffset:  { width: 0, height: 12 },
    shadowOpacity: 0.55,
    shadowRadius:  15,
    elevation: 8,
  },
  playBtnInner: {
    flex: 1,
    borderRadius: Math.round(37 * s),
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },
}); }
