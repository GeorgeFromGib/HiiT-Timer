import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { selectedBg, withOpacity, type ThemeTokens } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import { buildIntervalsFromEasy, intervalsToSegments, computeRoundsForTargetDuration, warmupCooldownForDuration } from '../lib/workout';
import PhaseStrip from './PhaseStrip';

interface Props {
  T: ThemeTokens;
  onDone: (result: { durationMinutes: number; work: number; rest: number; create: boolean }) => void;
}

interface Opt { v: number; subKey: string }

const LENGTH_OPTS: Opt[] = [
  { v: 10, subKey: 'lengthOptQuick' }, { v: 15, subKey: 'lengthOptPopular' },
  { v: 20, subKey: 'lengthOptSolid' }, { v: 30, subKey: 'lengthOptLong' },
];
const WORK_OPTS: Opt[] = [
  { v: 20, subKey: 'workOptShort' }, { v: 30, subKey: 'workOptBalanced' },
  { v: 45, subKey: 'workOptTough' }, { v: 60, subKey: 'workOptFull' },
];
const REST_OPTS: Opt[] = [
  { v: 10, subKey: 'restOptBarely' }, { v: 15, subKey: 'restOptQuick' },
  { v: 30, subKey: 'restOptEqual' }, { v: 45, subKey: 'restOptTakeTime' },
];

const DEFAULTS = { length: 15, work: 30, rest: 15 };

function StageGlyph({ T, kind }: { T: ThemeTokens; kind: 'length' | 'work' | 'rest' }) {
  const color = kind === 'length' ? T.accent : kind === 'work' ? T.phases.work : T.phases.rest;
  return (
    <View style={[styles.glyph, { backgroundColor: withOpacity(color, 0x1e), borderColor: withOpacity(color, 0x44) }]}>
      <Svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        {kind === 'length' && <><Circle cx={12} cy={12} r={9} /><Path d="M12 7v5l3 3" /></>}
        {kind === 'work' && <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" fill={color} stroke="none" />}
        {kind === 'rest' && <><Rect x={7} y={6} width={4} height={12} rx={1.6} fill={color} stroke="none" /><Rect x={13} y={6} width={4} height={12} rx={1.6} fill={color} stroke="none" /></>}
      </Svg>
    </View>
  );
}

function TypingDots({ T }: { T: ThemeTokens }) {
  const anims = useRef([0, 1, 2].map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const loops = anims.map((a, i) =>
      Animated.loop(
        Animated.sequence([
          Animated.delay(i * 160),
          Animated.timing(a, { toValue: 1, duration: 450, useNativeDriver: true }),
          Animated.timing(a, { toValue: 0, duration: 450, useNativeDriver: true }),
        ]),
      ),
    );
    loops.forEach(l => l.start());
    return () => loops.forEach(l => l.stop());
  }, []);
  return (
    <View style={[styles.coachBubble, styles.typingBubble, { backgroundColor: T.card, borderColor: T.hairline }]}>
      {anims.map((a, i) => (
        <Animated.View
          key={i}
          style={[
            styles.typingDot,
            {
              backgroundColor: T.faintText,
              opacity: a.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
              transform: [{ translateY: a.interpolate({ inputRange: [0, 1], outputRange: [0, -3] }) }],
            },
          ]}
        />
      ))}
    </View>
  );
}

function Bubble({ T, mine, children }: { T: ThemeTokens; mine?: boolean; children: React.ReactNode }) {
  const anim = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    Animated.timing(anim, { toValue: 1, duration: 260, useNativeDriver: true }).start();
  }, []);
  return (
    <Animated.View
      style={{
        opacity: anim,
        transform: [{ translateY: anim.interpolate({ inputRange: [0, 1], outputRange: [10, 0] }) }],
        alignSelf: mine ? 'flex-end' : 'flex-start',
      }}
    >
      <View
        style={[
          styles.coachBubble,
          mine
            ? { backgroundColor: T.accent, borderTopLeftRadius: 20, borderTopRightRadius: 6 }
            : { backgroundColor: T.card, borderColor: T.hairline, borderWidth: 1, borderTopLeftRadius: 6, borderTopRightRadius: 20 },
        ]}
      >
        <Text style={[styles.bubbleText, { color: mine ? T.btnGlyph : T.text, fontFamily: mine ? 'Inter_700Bold' : 'Inter_500Medium' }]}>
          {children}
        </Text>
      </View>
    </Animated.View>
  );
}

function ChoiceCard({ T, label, sub, onPick }: { T: ThemeTokens; label: string; sub: string; onPick: () => void }) {
  return (
    <Pressable
      onPress={onPick}
      style={({ pressed }) => [
        styles.choiceCard,
        {
          backgroundColor: pressed ? selectedBg(T.accent) : T.ghostBg,
          borderColor: pressed ? T.accent : T.hairline,
        },
      ]}
    >
      <Text style={[styles.choiceLabel, { color: T.text }]}>{label}</Text>
      <Text style={[styles.choiceSub, { color: T.faintText }]}>{sub}</Text>
    </Pressable>
  );
}

export default function SessionSetupChat({ T, onDone }: Props) {
  const { t } = useTranslation();
  const [subStep, setSubStep] = useState(0);
  const [typing, setTyping] = useState(true);
  const [answers, setAnswers] = useState<{ length: number | null; work: number | null; rest: number | null }>({ length: null, work: null, rest: null });
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    setTyping(true);
    const timer = setTimeout(() => setTyping(false), 700);
    return () => clearTimeout(timer);
  }, [subStep]);

  const QUESTIONS: { key: 'length' | 'work' | 'rest'; q: string; opts: Opt[]; unit: string }[] = [
    { key: 'length', q: t('onboarding.sessionSetup.lengthQuestion'), opts: LENGTH_OPTS, unit: 'min' },
    { key: 'work', q: t('onboarding.sessionSetup.workQuestion'), opts: WORK_OPTS, unit: 's' },
    { key: 'rest', q: t('onboarding.sessionSetup.restQuestion'), opts: REST_OPTS, unit: 's' },
  ];

  function replyText(key: 'length' | 'work' | 'rest', v: number) {
    return key === 'length' ? t('onboarding.sessionSetup.replyMinutes', { v }) : t('onboarding.sessionSetup.replySeconds', { v });
  }

  function pick(key: 'length' | 'work' | 'rest', v: number) {
    setAnswers(prev => ({ ...prev, [key]: v }));
    setSubStep(s => s + 1);
  }

  function skipQuestions() {
    setAnswers({ length: DEFAULTS.length, work: DEFAULTS.work, rest: DEFAULTS.rest });
    setSubStep(3);
  }

  const len = answers.length ?? DEFAULTS.length;
  const work = answers.work ?? DEFAULTS.work;
  const rest = answers.rest ?? DEFAULTS.rest;
  const warmupCooldown = warmupCooldownForDuration(len);
  const rounds = computeRoundsForTargetDuration(warmupCooldown, work, rest, warmupCooldown, len * 60);
  const actualMinutes = Math.round((warmupCooldown * 2 + rounds * (work + rest)) / 60);
  const segments = useMemo(
    () => intervalsToSegments(buildIntervalsFromEasy({ warmup: warmupCooldown, high: work, low: rest, rounds, cooldown: warmupCooldown })),
    [warmupCooldown, work, rest, rounds],
  );

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.dotsRow}>
          {Array.from({ length: 4 }).map((_, i) => (
            <View key={i} style={[styles.dot, i === Math.min(subStep, 3) ? { backgroundColor: T.accent, width: 16 } : { backgroundColor: T.hairline }]} />
          ))}
        </View>
        {subStep < 3 && (
          <Pressable onPress={skipQuestions}>
            <Text style={[styles.skipHeaderText, { color: T.faintText }]}>{t('onboarding.sessionSetup.skipQuestions')}</Text>
          </Pressable>
        )}
      </View>

      <ScrollView
        ref={scrollRef}
        style={styles.scroll}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
        onContentSizeChange={() => scrollRef.current?.scrollToEnd({ animated: true })}
      >
        {QUESTIONS.slice(0, subStep + 1).map((question, i) => (
          <React.Fragment key={i}>
            {(i < subStep || !typing) && (
              i === subStep ? (
                <View style={styles.glyphRow}>
                  <StageGlyph T={T} kind={question.key} />
                  <View style={{ flex: 1 }}><Bubble T={T}>{question.q}</Bubble></View>
                </View>
              ) : (
                <Bubble T={T}>{question.q}</Bubble>
              )
            )}
            {i < subStep && answers[question.key] != null && (
              <Bubble T={T} mine>{replyText(question.key, answers[question.key]!)}</Bubble>
            )}
          </React.Fragment>
        ))}

        {subStep === 3 && !typing && (
          <>
            <Bubble T={T}>{t('onboarding.sessionSetup.reviewIntro')}</Bubble>
            <View style={[styles.reviewCard, { backgroundColor: T.card, borderColor: T.hairline }]}>
              <View style={styles.reviewHeaderRow}>
                <Text style={[styles.reviewTitle, { color: T.text }]}>{t('onboarding.firstSessionName')}</Text>
                <Text style={[styles.reviewDuration, { color: T.accent }]}>{len}:00</Text>
              </View>
              <Text style={[styles.reviewMeta, { color: T.faintText }]}>
                {t('onboarding.sessionSetupSummary', { rounds, minutes: actualMinutes })}
              </Text>
              <PhaseStrip segments={segments} />
              <View style={styles.legendRow}>
                {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => (
                  <View key={phase} style={styles.legendItem}>
                    <View style={[styles.legendDot, { backgroundColor: T.phases[phase] }]} />
                    <Text style={[styles.legendText, { color: T.subText }]}>{t(`phases.${phase}`)}</Text>
                  </View>
                ))}
              </View>
            </View>
          </>
        )}

        {typing && <TypingDots T={T} />}
      </ScrollView>

      <View style={[styles.tray, { borderTopColor: T.hairline }]}>
        {!typing && subStep < 3 && (
          <View style={styles.choiceGrid}>
            {QUESTIONS[subStep].opts.map(opt => (
              <ChoiceCard
                key={opt.v}
                T={T}
                label={`${opt.v}${QUESTIONS[subStep].unit}`}
                sub={t(`onboarding.sessionSetup.${opt.subKey}`)}
                onPick={() => pick(QUESTIONS[subStep].key, opt.v)}
              />
            ))}
          </View>
        )}
        {!typing && subStep === 3 && (
          <View style={{ gap: 10 }}>
            <Pressable style={[styles.primaryBtn, { backgroundColor: T.accent }]} onPress={() => onDone({ durationMinutes: len, work, rest, create: true })}>
              <Text style={[styles.primaryBtnText, { color: T.btnGlyph }]}>{t('onboarding.sessionSetup.saveCta')}</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => setSubStep(0)}>
              <Text style={[styles.ghostBtnText, { color: T.subText }]}>{t('onboarding.sessionSetup.tweakCta')}</Text>
            </Pressable>
            <Pressable style={styles.ghostBtn} onPress={() => onDone({ durationMinutes: DEFAULTS.length, work: DEFAULTS.work, rest: DEFAULTS.rest, create: false })}>
              <Text style={[styles.ghostBtnText, { color: T.faintText }]}>{t('onboarding.sessionSetupSkip')}</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 4,
    paddingBottom: 10,
  },
  dotsRow: { flexDirection: 'row', gap: 6, alignItems: 'center' },
  dot: { width: 6, height: 6, borderRadius: 3 },
  skipHeaderText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
  scroll: { flex: 1 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 12, gap: 12 },
  glyphRow: { flexDirection: 'row', gap: 10, alignItems: 'flex-start' },
  glyph: {
    width: 44, height: 44, borderRadius: 15, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  coachBubble: {
    maxWidth: '85%',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 13,
  },
  typingBubble: { flexDirection: 'row', gap: 5, borderWidth: 1, paddingVertical: 15, paddingHorizontal: 18, alignSelf: 'flex-start' },
  typingDot: { width: 7, height: 7, borderRadius: 3.5 },
  bubbleText: { fontSize: 15, lineHeight: 21 },
  reviewCard: { borderWidth: 1, borderRadius: 22, padding: 18 },
  reviewHeaderRow: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 4 },
  reviewTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 18 },
  reviewDuration: { fontFamily: 'Inter_700Bold', fontSize: 16 },
  reviewMeta: { fontFamily: 'Inter_600SemiBold', fontSize: 12.5, marginBottom: 14 },
  legendRow: { flexDirection: 'row', gap: 14, marginTop: 12, flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontFamily: 'Inter_700Bold', fontSize: 11 },
  tray: { paddingHorizontal: 20, paddingTop: 14, paddingBottom: 22, borderTopWidth: 1 },
  choiceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 10 },
  choiceCard: { width: '47%', borderRadius: 18, borderWidth: 1.5, padding: 14, gap: 3 },
  choiceLabel: { fontFamily: 'Inter_800ExtraBold', fontSize: 19 },
  choiceSub: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5 },
  primaryBtn: { paddingVertical: 15, borderRadius: 16, alignItems: 'center' },
  primaryBtnText: { fontFamily: 'Inter_800ExtraBold', fontSize: 14.5, letterSpacing: 14.5 * 0.03 },
  ghostBtn: { paddingVertical: 10, alignItems: 'center' },
  ghostBtnText: { fontFamily: 'Inter_700Bold', fontSize: 13 },
});
