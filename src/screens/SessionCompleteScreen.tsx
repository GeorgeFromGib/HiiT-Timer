import React, { useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, PixelRatio, Pressable, StyleSheet, Text, View, useWindowDimensions } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme, withOpacity, buttonShadow, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import PhaseStrip from '../components/PhaseStrip';
import { fmtTimer, type Segment } from '../lib/workout';
import type { Session } from '../lib/sessions';

interface Props {
  session:      Session;
  segments:     Segment[];
  totalDur:     number;
  congratsMsg:  string;
  skippedCount: number;
  skippedSecs:  number;
  showConfetti: boolean;
  onDone:       () => void;
  onRepeat:     () => void;
}

function StatCard({ label, value, accent, T, uiScale }: { label: string; value: string; accent?: string; T: ThemeTokens; uiScale: number }) {
  const styles = useMemo(() => makeStyles(T, uiScale), [T, uiScale]);
  return (
    <View style={[styles.statCard, { backgroundColor: T.card, borderColor: T.hairline }]}>
      <Text allowFontScaling={false} style={[styles.statValue, { color: accent ?? T.text }]}>{value}</Text>
      <Text allowFontScaling={false} style={[styles.statLabel, { color: T.faintText }]}>{label}</Text>
    </View>
  );
}

export default function SessionCompleteScreen({ session, segments, totalDur, congratsMsg, skippedCount, skippedSecs, showConfetti, onDone, onRepeat }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { height: screenHeight } = useWindowDimensions();
  const uiScale = Math.min(1, (screenHeight / 844) / Math.max(1, PixelRatio.getFontScale()));
  const styles = useMemo(() => makeStyles(T, uiScale), [T, uiScale]);

  const workSecs = segments
    .filter(s => s.phase === 'work')
    .reduce((sum, s) => sum + s.duration, 0);

  const checkAnim    = useRef(new Animated.Value(0)).current;
  const eyebrowAnim  = useRef(new Animated.Value(0)).current;
  const headlineAnim = useRef(new Animated.Value(0)).current;
  const statsAnim    = useRef(new Animated.Value(0)).current;
  const recapAnim    = useRef(new Animated.Value(0)).current;

  const NUM_CONFETTI = 14;
  const confettiAnims = useRef(
    Array.from({ length: NUM_CONFETTI }, () => new Animated.Value(0)),
  ).current;
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion);
  }, []);

  useEffect(() => {
    Animated.spring(checkAnim, { toValue: 1, tension: 100, friction: 8, useNativeDriver: true }).start();
    [
      { anim: eyebrowAnim,  delay: 0   },
      { anim: headlineAnim, delay: 100 },
      { anim: statsAnim,    delay: 180 },
      { anim: recapAnim,    delay: 260 },
    ].forEach(({ anim, delay }) =>
      Animated.timing(anim, { toValue: 1, duration: 500, delay, useNativeDriver: true }).start(),
    );
  }, []);

  useEffect(() => {
    if (!showConfetti || reduceMotion) return;
    const loops = confettiAnims.map((anim, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 180),
          Animated.timing(anim, {
            toValue: 1,
            duration: 2600 + (i % 5) * 400,
            useNativeDriver: true,
          }),
          Animated.timing(anim, { toValue: 0, duration: 0, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, [showConfetti, reduceMotion]);

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* Accent glow */}
      <View style={[styles.accentGlow, { backgroundColor: withOpacity(T.accent, 0x22) }]} />

      {/* Confetti */}
      {showConfetti && !reduceMotion && confettiAnims.map((anim, i) => {
        const PHASES = ['warmup', 'work', 'rest', 'cooldown'] as const;
        const color  = T.phases[PHASES[i % PHASES.length]];
        const sz     = 5 + (i % 3) * 2;
        return (
          <Animated.View
            key={i}
            style={[
              styles.confetti,
              {
                left:            `${(i * 37 + 11) % 100}%`,
                width:           sz,
                height:          sz,
                borderRadius:    i % 2 === 0 ? sz / 2 : 2,
                backgroundColor: color,
                opacity:         anim.interpolate({ inputRange: [0, 0.08, 0.9, 1], outputRange: [0, 0.9, 0.9, 0] }),
                transform:       [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [-12, 640] }) }],
              },
            ]}
          />
        );
      })}

      {/* Eyebrow */}
      <Animated.View style={{ marginTop: Math.round(48 * uiScale), opacity: eyebrowAnim, transform: [{ translateY: eyebrowAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }}>
        <Text allowFontScaling={false} style={[styles.eyebrow, { color: T.accent }]}>
          {skippedCount > 0 ? t('complete.eyebrowPartial') : t('complete.eyebrow')}
        </Text>
      </Animated.View>

      {/* Hero checkmark */}
      <View style={styles.heroWrap}>
        <Animated.View style={{
          opacity:   checkAnim,
          transform: [{ scale: checkAnim.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1] }) }],
        }}>
          <View style={[styles.checkCircle, { backgroundColor: T.accent, shadowColor: T.accent }]}>
            <Svg width={Math.round(58 * uiScale)} height={Math.round(58 * uiScale)} viewBox="0 0 48 48" fill="none">
              <Path d="M10 25l9.5 9.5L38 15" stroke={T.btnGlyph} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </View>
        </Animated.View>
      </View>

      {/* Headline */}
      <Animated.View style={[styles.headlineWrap, { opacity: headlineAnim, transform: [{ translateY: headlineAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        {skippedCount === 0 && (
          <Text allowFontScaling={false} style={[styles.headline, { color: T.text }]}>{congratsMsg}</Text>
        )}
        <Text allowFontScaling={false} style={[styles.subline, { color: T.subText }]}>
          {t('complete.sublinePrefix')}{' '}
          <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold' }}>{session.name}</Text>
        </Text>
      </Animated.View>

      {/* Stats */}
      <Animated.View style={[styles.statsRow, { opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <StatCard label={t('complete.totalTime')} value={fmtTimer(totalDur)} accent={T.accent} T={T} uiScale={uiScale} />
        <StatCard label={t('complete.intervals')} value={String(segments.length)} T={T} uiScale={uiScale} />
        <StatCard label={t('complete.workTime')} value={fmtTimer(workSecs)} T={T} uiScale={uiScale} />
      </Animated.View>

      {/* Skipped stats */}
      {skippedCount > 0 && (
        <Animated.View style={[styles.statsRow, { marginTop: 9, opacity: statsAnim, transform: [{ translateY: statsAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
          <StatCard label={t('complete.skippedIntervals')} value={String(skippedCount)} T={T} uiScale={uiScale} />
          <StatCard label={t('complete.skippedTime')} value={fmtTimer(skippedSecs)} T={T} uiScale={uiScale} />
        </Animated.View>
      )}

      {/* Phase recap */}
      <Animated.View style={[styles.recapWrap, { opacity: recapAnim, transform: [{ translateY: recapAnim.interpolate({ inputRange: [0, 1], outputRange: [12, 0] }) }] }]}>
        <Text style={[styles.recapLabel, { color: T.faintText }]}>{t('complete.sessionRecap')}</Text>
        <PhaseStrip segments={segments} />
      </Animated.View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable onPress={onDone} style={[styles.doneBtn, { backgroundColor: T.accent, ...buttonShadow(T) }]}>
          <Text style={[styles.doneBtnText, { color: T.btnGlyph }]}>{t('complete.done')}</Text>
        </Pressable>
        <Pressable onPress={onRepeat} style={[styles.repeatBtn, { backgroundColor: T.ghostBg, borderColor: T.hairline }]}>
          <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
            <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
            <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.repeatBtnText, { color: T.subText }]}>{t('complete.repeat')}</Text>
        </Pressable>
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
  accentGlow: {
    position: 'absolute',
    top: -120,
    left: '50%',
    marginLeft: -180,
    width: 360,
    height: 360,
    borderRadius: 180,
  },
  eyebrow: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: Math.round(22 * s),
    letterSpacing: 22 * 0.24,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: Math.round(32 * s),
    marginBottom: Math.round(32 * s),
  },
  checkCircle: {
    width: Math.round(96 * s),
    height: Math.round(96 * s),
    borderRadius: Math.round(48 * s),
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 34,
    elevation: 8,
  },
  headlineWrap: {
    alignItems: 'center',
    marginTop: 0,
  },
  headline: {
    fontFamily: 'Inter_900Black',
    fontSize: Math.round(30 * s),
    letterSpacing: 30 * -0.02,
    lineHeight: Math.round(32 * s),
    textAlign: 'center',
  },
  subline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: Math.round(13.5 * s),
    marginTop: Math.round(6 * s),
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: Math.round(22 * s),
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: Math.round(16 * s),
    paddingHorizontal: Math.round(14 * s),
    paddingTop: Math.round(14 * s),
    paddingBottom: Math.round(13 * s),
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: Math.round(25 * s),
    lineHeight: Math.round(25 * s),
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.max(8, Math.round(9.5 * s)),
    letterSpacing: 9.5 * 0.12,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  recapWrap: {
    marginTop: Math.round(16 * s),
  },
  recapLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.max(8, Math.round(10 * s)),
    letterSpacing: 10 * 0.14,
    textTransform: 'uppercase',
    marginBottom: Math.round(8 * s),
    paddingLeft: 2,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: Math.round(20 * s),
    gap: 10,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: Math.round(14 * s),
    borderRadius: Math.round(16 * s),
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 8,
  },
  doneBtnText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: Math.round(14.5 * s),
    letterSpacing: 14.5 * 0.05,
    textTransform: 'uppercase',
  },
  repeatBtn: {
    width: '100%',
    paddingVertical: Math.round(13 * s),
    borderRadius: Math.round(16 * s),
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  repeatBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: Math.round(13.5 * s),
    letterSpacing: 13.5 * 0.05,
    textTransform: 'uppercase',
  },
  confetti: {
    position: 'absolute',
    top: 0,
  },
}); }
