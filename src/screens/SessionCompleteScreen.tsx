import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme, withOpacity, buttonShadow, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import PhaseStrip from '../components/PhaseStrip';
import { fmtTimer, type Segment } from '../lib/workout';
import type { Session } from '../lib/sessions';

interface Props {
  session:  Session;
  segments: Segment[];
  totalDur: number;
  onDone:   () => void;
  onRepeat: () => void;
}

function StatCard({ label, value, accent, T }: { label: string; value: string; accent?: string; T: ThemeTokens }) {
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={[styles.statCard, { backgroundColor: T.card, borderColor: T.hairline }]}>
      <Text style={[styles.statValue, { color: accent ?? T.text }]}>{value}</Text>
      <Text style={[styles.statLabel, { color: T.faintText }]}>{label}</Text>
    </View>
  );
}

export default function SessionCompleteScreen({ session, segments, totalDur, onDone, onRepeat }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const workSecs = segments
    .filter(s => s.phase === 'work')
    .reduce((sum, s) => sum + s.duration, 0);

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      {/* Radial accent glow at top */}
      <View style={[styles.accentGlow, { backgroundColor: withOpacity(T.accent, 0x22) }]} />

      {/* Eyebrow */}
      <Text style={[styles.eyebrow, { color: T.accent }]}>
        {t('complete.eyebrow')}
      </Text>

      {/* Hero checkmark */}
      <View style={styles.heroWrap}>
        <View style={[styles.checkCircle, { backgroundColor: T.accent, shadowColor: T.accent }]}>
          <Svg width={58} height={58} viewBox="0 0 48 48" fill="none">
            <Path
              d="M10 25l9.5 9.5L38 15"
              stroke={T.btnGlyph}
              strokeWidth={5}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </View>
      </View>

      {/* Headline */}
      <View style={styles.headlineWrap}>
        <Text style={[styles.headline, { color: T.text }]}>
          {t('complete.headline')}
        </Text>
        <Text style={[styles.subline, { color: T.subText }]}>
          {t('complete.sublinePrefix')}{' '}
          <Text style={{ color: T.text, fontFamily: 'Inter_800ExtraBold' }}>{session.name}</Text>
        </Text>
      </View>

      {/* Stats row */}
      <View style={styles.statsRow}>
        <StatCard label={t('complete.totalTime')} value={fmtTimer(totalDur)} accent={T.accent} T={T} />
        <StatCard label={t('complete.intervals')} value={String(segments.length)} T={T} />
        <StatCard label={t('complete.workTime')} value={fmtTimer(workSecs)} T={T} />
      </View>

      {/* Phase recap */}
      <View style={styles.recapWrap}>
        <Text style={[styles.recapLabel, { color: T.faintText }]}>
          {t('complete.sessionRecap')}
        </Text>
        <PhaseStrip segments={segments} />
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        <Pressable
          onPress={onDone}
          style={[styles.doneBtn, { backgroundColor: T.accent, ...buttonShadow(T) }]}
        >
          <Text style={[styles.doneBtnText, { color: T.btnGlyph }]}>
            {t('complete.done')}
          </Text>
        </Pressable>
        <Pressable
          onPress={onRepeat}
          style={[styles.repeatBtn, { backgroundColor: T.ghostBg, borderColor: T.hairline }]}
        >
          <Svg width={16} height={16} viewBox="0 0 20 20" fill="none">
            <Path d="M3 10a7 7 0 1 1 2.3 5.2" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
            <Path d="M3 5v4h4" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
          <Text style={[styles.repeatBtnText, { color: T.subText }]}>
            {t('complete.repeat')}
          </Text>
        </Pressable>
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
    fontSize: 11,
    letterSpacing: 11 * 0.24,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  heroWrap: {
    alignItems: 'center',
    marginTop: 14,
    marginBottom: 4,
  },
  checkCircle: {
    width: 96,
    height: 96,
    borderRadius: 48,
    alignItems: 'center',
    justifyContent: 'center',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.4,
    shadowRadius: 34,
    elevation: 8,
  },
  headlineWrap: {
    alignItems: 'center',
    marginTop: 6,
  },
  headline: {
    fontFamily: 'Inter_900Black',
    fontSize: 30,
    letterSpacing: 30 * -0.02,
    lineHeight: 32,
  },
  subline: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13.5,
    marginTop: 6,
    textAlign: 'center',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 22,
  },
  statCard: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 16,
    paddingHorizontal: 14,
    paddingTop: 14,
    paddingBottom: 13,
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 25,
    lineHeight: 25,
    fontVariant: ['tabular-nums'],
  },
  statLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 9.5,
    letterSpacing: 9.5 * 0.12,
    textTransform: 'uppercase',
    textAlign: 'center',
  },
  recapWrap: {
    marginTop: 16,
  },
  recapLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 10,
    letterSpacing: 10 * 0.14,
    textTransform: 'uppercase',
    marginBottom: 8,
    paddingLeft: 2,
  },
  actions: {
    marginTop: 'auto',
    paddingTop: 20,
    gap: 10,
  },
  doneBtn: {
    width: '100%',
    paddingVertical: 14,
    borderRadius: 16,
    alignItems: 'center',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.55,
    shadowRadius: 26,
    elevation: 8,
  },
  doneBtnText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 14.5,
    letterSpacing: 14.5 * 0.05,
    textTransform: 'uppercase',
  },
  repeatBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 16,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 9,
  },
  repeatBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13.5,
    letterSpacing: 13.5 * 0.05,
    textTransform: 'uppercase',
  },
}); }
