import { LinearGradient } from 'expo-linear-gradient';
import React, { useMemo, useState } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path, Rect } from 'react-native-svg';
import { useTranslation } from '../hooks/useTranslation';
import type { Session } from '../lib/sessions';
import { useSettings } from '../lib/settingsContext';
import { formatSpeed } from '../lib/speedUnit';
import type { Segment } from '../lib/workout';
import { fmtTimer } from '../lib/workout';
import { buttonShadow, useTheme, withOpacity, type ThemeTokens } from '../theme';
import GhostBtn from '../components/GhostBtn';
import WorkoutIcon from '../components/WorkoutIcon';
import ExtendControls from '../components/ExtendControls';
import CircuitSetCounter from '../components/CircuitSetCounter';

type Status = 'idle' | 'preStart' | 'running' | 'paused' | 'finished';

export default function WorkoutScreenLandscape({
  session,
  segments,
  currentIndex,
  totalDur,
  status,
  displayCountdown,
  flashing,
  intervalNum,
  pct,
  displayRemaining,
  progress,
  scale,
  screenWidth,
  onPlayPause,
  onSkip,
  onSkipBack,
  onReset,
  onExtend,
  onAddRound,
  onBack,
}: {
  session: Session;
  segments: Segment[];
  currentIndex: number;
  totalDur: number;
  status: Status;
  displayCountdown: string;
  flashing: boolean;
  intervalNum: number;
  pct: number;
  displayRemaining: string;
  progress: Animated.Value;
  scale: number;
  screenWidth: number;
  onPlayPause: () => void;
  onSkip: () => void;
  onSkipBack: () => void;
  onReset: () => void;
  onExtend: (secs: number) => void;
  onAddRound: () => void;
  onBack: () => void;
}) {
  const { settings } = useSettings();
  const { t } = useTranslation();
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T, scale), [T, scale]);

  // Measure the area the digits get, then size the font to nearly fill it.
  const [digitsBox, setDigitsBox] = useState({ w: 0, h: 0 });

  const isPreStart = status === 'preStart';
  const isIdle = status === 'idle';
  const isPlaying = status === 'running';

  const effectiveIndex = currentIndex >= 0 ? currentIndex : 0;
  const seg = segments[effectiveIndex];
  const nextSeg = segments[effectiveIndex + 1];
  const phaseColor = isPreStart ? T.accent : T.phases[seg.phase];
  const nextPhaseColor = nextSeg ? T.phases[nextSeg.phase] : T.phases.finish;

  const label = isPreStart ? t('workout.getReady') : t('workout.phase.' + seg.phase);
  // Size the digits to fill the measured centre band. ChakraPetch_700Bold advance:
  // ~0.66em per digit, ~0.34em per colon. adjustsFontSizeToFit is the safety net.
  const charUnits = displayCountdown
    .split('')
    .reduce((sum, ch) => sum + (ch === ':' ? 0.28 : 0.62), 0);
  const boxW = digitsBox.w > 0 ? digitsBox.w : (screenWidth || 700) * 0.6;
  const boxH = digitsBox.h > 0 ? digitsBox.h : 200;
  const countdownFontSize = Math.round(
    Math.max(24, Math.min((boxW * 0.98) / charUnits, boxH * 0.92)),
  );

  const segPill = (color: string) => ({
    backgroundColor: withOpacity(color, 0x21),
    borderColor: withOpacity(color, 0x59),
  });

  // Smooth in-phase marker, same as portrait: travels across the active
  // segment as `progress` depletes 1 -> 0.
  const segStartPct = `${(seg.startAt / totalDur) * 100}%`;
  const segEndPct   = `${(seg.endAt / totalDur) * 100}%`;
  const chevronLeft = progress.interpolate({
    inputRange: [0, 1],
    outputRange: [segEndPct, segStartPct],
  });

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* ── Back: top-left ── */}
      <View style={styles.backBtn}>
        <GhostBtn onPress={onBack} size={Math.round(48 * scale)}>
          <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
            <Path d="M12 4l-6 6 6 6" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </GhostBtn>
      </View>

      {/* ── Left control column ── */}
      <View style={styles.controlCol}>
        {isPlaying ? (
          <GhostBtn onPress={onSkipBack} size={Math.round(48 * scale)}>
            <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
              <Rect x="2.5" y="4" width="2.5" height="12" rx="1.2" fill={T.subText} />
              <Path d="M16 4l-9 6 9 6V4z" fill={T.subText} />
            </Svg>
          </GhostBtn>
        ) : (
          <GhostBtn onPress={onReset} disabled={isIdle || isPreStart} size={Math.round(48 * scale)}>
            <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
              <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
              <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </GhostBtn>
        )}

        <Pressable onPress={onPlayPause} style={styles.playBtn}>
          <View style={styles.playBtnInner}>
            {(isPlaying || isPreStart) ? (
              <Svg width={Math.round(22 * scale)} height={Math.round(24 * scale)} viewBox="0 0 28 30">
                <Rect x="3" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
                <Rect x="17" y="2" width="8" height="26" rx="2.6" fill={T.btnGlyph} />
              </Svg>
            ) : (
              <Svg width={Math.round(22 * scale)} height={Math.round(24 * scale)} viewBox="0 0 28 30">
                <Path d="M5 3 L25 15 L5 27 Z" fill={T.btnGlyph} stroke={T.btnGlyph} strokeWidth={3.5} strokeLinejoin="round" />
              </Svg>
            )}
          </View>
        </Pressable>

        <GhostBtn onPress={onSkip} disabled={isIdle || isPreStart} size={Math.round(48 * scale)}>
          <Svg width={18} height={18} viewBox="0 0 20 20" fill="none">
            <Path d="M4 4l9 6-9 6V4z" fill={T.subText} />
            <Rect x="15" y="4" width="2.5" height="12" rx="1.2" fill={T.subText} />
          </Svg>
        </GhostBtn>
      </View>

      {/* ── Main column: phase, giant digits, then info rail below ── */}
      <View style={styles.mainCol}>
        <View style={styles.centerZone}>
        <View style={styles.phaseRow}>
          <View style={[styles.iconBadge, {
            backgroundColor: withOpacity(phaseColor, 0x22),
            borderColor: withOpacity(phaseColor, 0x55),
          }]}>
            {isPreStart
              ? <WorkoutIcon variant="ready" color={T.accent} size={Math.round(25 * scale)} />
              : <WorkoutIcon variant="phase" phase={seg.phase} color={phaseColor} size={Math.round(25 * scale)} />}
          </View>
          <Text allowFontScaling={false} style={[styles.phaseLabel, {
            color: phaseColor,
            textShadowColor: withOpacity(phaseColor, 0x55),
          }]}>
            {label}
          </Text>

          {!isPreStart && seg.speed !== undefined && (
            <View style={[styles.pill, segPill(phaseColor)]}>
              <Text style={[styles.pillText, { color: phaseColor }]}>
                {formatSpeed(seg.speed, settings.speedUnit)}
                {seg.incline !== undefined ? ` · ${seg.incline}%` : ''}
              </Text>
            </View>
          )}
          {!isPreStart && seg.resistance !== undefined && seg.power !== undefined && (
            <View style={[styles.pill, segPill(phaseColor)]}>
              <Text style={[styles.pillText, { color: phaseColor }]}>
                {`R${seg.resistance} · ${seg.power}W`}
              </Text>
            </View>
          )}
          {!isPreStart && seg.activityLabel !== undefined && (
            <View style={[styles.pill, segPill(phaseColor)]}>
              <Text style={[styles.pillText, { color: phaseColor }]}>{seg.activityLabel}</Text>
            </View>
          )}
        </View>

        <View
          style={styles.digitsWrap}
          onLayout={e => setDigitsBox({ w: e.nativeEvent.layout.width, h: e.nativeEvent.layout.height })}
        >
          {/* Per-character fixed-width cells (matches portrait) so the string is
              symmetric about the centre colon. */}
          <View style={styles.digitsRow}>
            {displayCountdown.split('').map((ch, i) => (
              <Text
                key={i}
                allowFontScaling={false}
                style={[styles.bigTime, {
                  opacity: flashing ? 0 : 1,
                  fontSize: countdownFontSize,
                  lineHeight: countdownFontSize,
                  textShadowColor: withOpacity(phaseColor, 0x3a),
                  width: ch === ':' ? countdownFontSize * 0.28 : countdownFontSize * 0.62,
                }]}
              >
                {ch}
              </Text>
            ))}
          </View>
        </View>

        <Text allowFontScaling={false} style={[styles.intervalCounter, styles.intervalUnderDigits, isPreStart && { opacity: 0 }]}>
          {t('workout.intervalPrefix')}
          <Text style={{ color: T.onBg }}>{intervalNum}</Text>
          {t('workout.intervalSuffix', { total: segments.length })}
        </Text>

        <View style={[styles.progressTrack, isPreStart && { opacity: 0 }]}>
          <Animated.View
            style={[
              styles.progressFill,
              {
                backgroundColor: phaseColor,
                shadowColor: phaseColor,
                width: progress.interpolate({
                  inputRange: [0, 1],
                  outputRange: ['0%', '100%'],
                }),
              },
            ]}
          />
        </View>
        </View>

        <View style={[styles.nextLine, isPreStart && { opacity: 0 }]}>
          <Text style={styles.eyebrow}>{t('workout.next')}</Text>
          {nextSeg ? (
            <>
              <WorkoutIcon variant="phase" phase={nextSeg.phase} color={nextPhaseColor} size={Math.round(18 * scale)} />
              <Text style={[styles.nextLabel, { color: nextPhaseColor }]}>
                {t('workout.phase.' + nextSeg.phase)}
              </Text>
              <Text style={[styles.nextDur, { color: T.subText }]}>{fmtTimer(nextSeg.duration)}</Text>
            </>
          ) : (
            <Text style={[styles.nextLabel, { color: phaseColor }]}>{t('workout.finish')}</Text>
          )}
        </View>

        <View style={[styles.infoRail, isPreStart && { opacity: 0 }]}>
          <View style={styles.railLeft}>
            <CircuitSetCounter
              session={session}
              seg={seg}
              nextSeg={nextSeg}
              style={[styles.intervalCounter, { color: T.onBg }]}
            />
            {session.mode !== 'circuit' && (
              <ExtendControls
                onExtend={onExtend}
                onAddRound={onAddRound}
                color={phaseColor}
                disabled={isIdle}
                addRoundDisabled={seg.phase === 'cooldown'}
                size={Math.round(56 * scale)}
              />
            )}
          </View>

          <View style={styles.timelineBlock}>
            <View style={styles.timelineBar}>
              <View style={styles.segmentsClip}>
                {segments.map((s, i) => {
                  const widthPct = (s.duration / totalDur) * 100;
                  const isActive = i === currentIndex;
                  const isCompleted = currentIndex > 0 && i < currentIndex;
                  const phColor = T.phases[s.phase];

                  if (isActive) {
                    return (
                      <View key={i} style={[styles.timelineSeg, { width: `${widthPct}%`, overflow: 'hidden' }]}>
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
                            width: progress.interpolate({
                              inputRange: [0, 1],
                              outputRange: ['0%', '100%'],
                            }),
                          }}
                        />
                      </View>
                    );
                  }

                  return (
                    <View key={i} style={[styles.timelineSeg, {
                      width: `${widthPct}%`,
                      backgroundColor: phColor,
                      opacity: isCompleted ? 0.28 : 1,
                    }]} />
                  );
                })}
              </View>
              <Animated.View style={[styles.markerLine, { left: chevronLeft }]} />
            </View>
            <View style={styles.timelineLabels}>
              <Text style={styles.timelineLabelText}>{pct}%</Text>
              <Text style={styles.timelineLabelText}>{t('workout.left', { time: displayRemaining })}</Text>
            </View>
          </View>
        </View>
      </View>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens, s: number) { return StyleSheet.create({
  root: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: Math.round(14 * s),
    // Wide enough to clear the notch / camera housing on both landscape edges.
    paddingHorizontal: Math.round(46 * s),
    // Nudge content a few px in from the right edge.
    paddingRight: Math.round(54 * s),
    gap: Math.round(24 * s),
  },
  backBtn: {
    position: 'absolute',
    top: Math.round(12 * s),
    left: Math.round(46 * s),
    zIndex: 10,
  },
  controlCol: {
    justifyContent: 'center',
    alignItems: 'center',
    gap: Math.round(14 * s),
  },
  playBtn: {
    width: Math.round(66 * s),
    height: Math.round(66 * s),
    borderRadius: Math.round(33 * s),
    ...buttonShadow(T),
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.5,
    shadowRadius: 14,
    elevation: 8,
  },
  playBtnInner: {
    flex: 1,
    borderRadius: Math.round(33 * s),
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
  },

  mainCol: {
    flex: 1,
    height: '100%',
    gap: Math.round(6 * s),
  },
  // Fills the space above the pinned next / timeline rows and centres the
  // phase label, digits, interval counter and countdown bar within it.
  centerZone: {
    flex: 1,
    alignSelf: 'stretch',
    justifyContent: 'center',
    gap: Math.round(6 * s),
  },
  phaseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: Math.round(10 * s),
    minHeight: Math.round(40 * s),
  },
  digitsWrap: {
    flex: 1,
    // Cap the digit band so it stops eating the whole column — the leftover
    // slack then centres the phase/digits/counter/bar block as one unit
    // instead of stranding the digits with a gap above and below.
    maxHeight: Math.round(170 * s),
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'flex-end',
    overflow: 'hidden',
    paddingTop: Math.round(10 * s),
  },
  digitsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'flex-start',
    alignSelf: 'stretch',
  },
  iconBadge: {
    width: Math.round(42 * s),
    height: Math.round(42 * s),
    borderRadius: Math.round(12 * s),
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phaseLabel: {
    fontFamily: 'Inter_900Black',
    fontSize: Math.round(28 * s),
    letterSpacing: 28 * 0.03,
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 24,
  },
  pill: {
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  pillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(15 * s),
    letterSpacing: 15 * 0.02,
  },
  bigTime: {
    fontFamily: 'ChakraPetch_700Bold',
    color: T.text,
    textAlign: 'center',
    fontVariant: ['tabular-nums'],
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 34,
  },
  intervalCounter: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(17 * s),
    letterSpacing: 17 * 0.06,
    color: T.faintText,
    textAlign: 'center',
  },
  // Pull the "INTERVAL n of x" line up snug against the countdown digits
  // (cancels the centerZone gap plus the digit line-box descender space).
  intervalUnderDigits: {
    marginTop: Math.round(-24 * s),
  },
  progressTrack: {
    alignSelf: 'stretch',
    height: Math.round(20 * s),
    borderRadius: 6,
    backgroundColor: T.hairline,
    overflow: 'hidden',
    flexDirection: 'row-reverse',
    marginTop: Math.round(4 * s),
  },
  progressFill: {
    height: '100%',
    borderRadius: 6,
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.6,
    shadowRadius: 6,
  },

  infoRail: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Math.round(20 * s),
    paddingTop: Math.round(10 * s),
    borderTopWidth: 1,
    borderTopColor: T.hairline,
  },
  nextLine: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    flexWrap: 'wrap',
    width: '100%',
    gap: Math.round(9 * s),
    marginTop: Math.round(2 * s),
  },
  railLeft: {
    alignItems: 'center',
    gap: Math.round(8 * s),
  },
  timelineBlock: {
    flex: 1,
    gap: Math.round(8 * s),
  },
  eyebrow: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(14 * s),
    letterSpacing: 14 * 0.14,
    color: T.faintText,
  },
  nextLabel: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: Math.round(23 * s),
    letterSpacing: 23 * 0.03,
  },
  nextDur: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: Math.round(18 * s),
  },
  timelineBar: {
    height: Math.round(18 * s),
    position: 'relative',
  },
  segmentsClip: {
    flex: 1,
    flexDirection: 'row',
    height: '100%',
    borderRadius: 4,
    overflow: 'hidden',
  },
  timelineSeg: {
    height: '100%',
    borderRadius: 4,
  },
  markerLine: {
    position: 'absolute',
    top: -3,
    bottom: -3,
    width: 3,
    marginLeft: -1.5,
    backgroundColor: T.text,
    borderRadius: 3,
  },
  timelineLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  timelineLabelText: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(12 * s),
    letterSpacing: 12 * 0.04,
    color: T.subText,
  },
}); }
