import React, { useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Path } from 'react-native-svg';
import { useTheme, withOpacity, buttonShadow, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from '../hooks/useTranslation';
import Heatmap from '../components/Heatmap';
import { FeelIcon } from '../components/FeelingPicker';
import { loadHistory, type HistoryEntry } from '../lib/history';
import { currentStreak, longestStreak, totals, completionRate, entriesInRange, localDayNumber, type StatsRange } from '../lib/historyStats';

const MAX_LISTED = 100; // ponytail: plain list is fine at this size; virtualise (FlatList) if history grows large

const RANGES: { key: StatsRange; label: 'week' | 'month' | 'allTime' }[] = [
  { key: 'week', label: 'week' }, { key: 'month', label: 'month' }, { key: 'all', label: 'allTime' },
];

function fmtClock(s: number): string {
  s = Math.round(s);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

function fmtMins(s: number): string {
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m`;
  return `${Math.floor(m / 60)}h ${String(m % 60).padStart(2, '0')}m`;
}

export default function HistoryScreen({ onBack, onChooseSession }: { onBack: () => void; onChooseSession: () => void }) {
  const { T } = useTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [entries, setEntries] = useState<HistoryEntry[] | null>(null);
  const [range, setRange] = useState<StatsRange>('week');

  useEffect(() => { loadHistory().then(setEntries); }, []);

  const sorted = useMemo(() => [...(entries ?? [])].sort((a, b) => b.startedAt - a.startedAt), [entries]);

  const header = (
    <ScreenHeader onBack={onBack} subtitle={t('history.subtitle')} title={t('history.title')} style={styles.header} />
  );

  if (entries === null) {
    return <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>{header}</LinearGradient>;
  }

  if (!entries.length) {
    return (
      <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
        {header}
        <View style={styles.empty}>
          <View style={styles.emptyIcon}><FeelIcon size={26} /></View>
          <Text style={styles.emptyTitle}>{t('history.emptyTitle')}</Text>
          <Text style={styles.emptyBody}>{t('history.emptyBody')}</Text>
          <Pressable onPress={onChooseSession} style={[styles.chooseBtn, buttonShadow(T)]}>
            <Text style={styles.chooseBtnText}>{t('history.chooseSession')}</Text>
          </Pressable>
        </View>
      </LinearGradient>
    );
  }

  const now = Date.now();
  const tot = totals(entries, range, now);
  const rate = completionRate(entriesInRange(entries, range, now));
  const cur = currentStreak(entries, now);
  const longest = longestStreak(entries);

  const dayLabel = (ms: number) => {
    const ago = localDayNumber(now) - localDayNumber(ms);
    if (ago === 0) return t('history.today');
    if (ago === 1) return t('history.yesterday');
    return new Date(ms).toLocaleDateString(locale, { weekday: 'short', day: 'numeric', month: 'short' });
  };
  const feelLabel = (e: HistoryEntry) => e.feeling ? t('history.felt', { label: t('complete.' + { easy: 'feelEasy', right: 'feelRight', hard: 'feelHard' }[e.feeling]).toLowerCase() }) : t('history.noRating');

  const listed = sorted.slice(0, MAX_LISTED);

  return (
    <LinearGradient colors={T.bgGradient} start={{ x: 0, y: 1 }} end={{ x: 1, y: 0 }} style={styles.root}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.content}>
        {header}

        <View style={styles.chipRow}>
          {[[t('history.currentStreak'), cur, true], [t('history.longestStreak'), longest, false]].map(([label, v, hi]) => (
            <View key={label as string} style={[styles.chip, hi ? { backgroundColor: withOpacity(T.accent, 0x14), borderColor: withOpacity(T.accent, 0x55) } : null]}>
              <View style={styles.chipValueRow}>
                <Text style={[styles.chipValue, { color: hi ? T.accent : T.text }]}>{v as number}</Text>
                <Text style={styles.chipUnit}>{t((v as number) === 1 ? 'history.day' : 'history.days')}</Text>
              </View>
              <Text style={styles.label}>{label as string}</Text>
            </View>
          ))}
        </View>

        <View style={[styles.card, { marginTop: 10, padding: 14 }]}>
          <View accessibilityRole="tablist" accessibilityLabel={t('history.rangeA11y')} style={styles.tabs}>
            {RANGES.map(r => {
              const on = range === r.key;
              return (
                <Pressable key={r.key} accessibilityRole="tab" accessibilityState={{ selected: on }} onPress={() => setRange(r.key)} style={[styles.tab, on && { backgroundColor: T.accent }]}>
                  <Text style={[styles.tabText, { color: on ? T.btnGlyph : T.subText }]}>{t('history.' + r.label)}</Text>
                </Pressable>
              );
            })}
          </View>
          <View style={styles.totalsRow}>
            {[[String(tot.count), t('history.workouts')], [fmtMins(tot.activeSecs), t('history.active')], [`${rate}%`, t('history.completed')]].map(([v, l], i) => (
              <View key={l} style={[styles.totalCell, i > 0 && { borderLeftWidth: 1, borderLeftColor: T.hairline }]}>
                <Text style={[styles.totalValue, { color: i === 1 ? T.accent : T.text }]}>{v}</Text>
                <Text style={[styles.label, { fontSize: 9.5, marginTop: 6 }]}>{l}</Text>
              </View>
            ))}
          </View>
        </View>

        <View style={[styles.card, { marginTop: 10, paddingTop: 13, paddingHorizontal: 14, paddingBottom: 11 }]}>
          <View style={styles.heatHeader}>
            <Text style={styles.label}>{t('history.activity')}</Text>
            <Text style={styles.heatSub}>{t('history.byMinutes')}</Text>
          </View>
          <Heatmap entries={entries} />
        </View>

        <Text style={[styles.label, { marginTop: 20, marginBottom: 8, paddingLeft: 2 }]}>{t('history.recent')}</Text>
        <View style={[styles.card, { overflow: 'hidden' }]}>
          {listed.map((e, i) => (
            <View key={e.id} style={[styles.row, i < listed.length - 1 && { borderBottomWidth: 1, borderBottomColor: T.hairline }]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text numberOfLines={1} style={[styles.rowName, { color: e.completed ? T.text : T.subText }]}>{e.sessionName}</Text>
                <Text style={styles.rowMeta}>
                  {dayLabel(e.startedAt)} · {new Date(e.startedAt).toLocaleTimeString(locale, { hour: '2-digit', minute: '2-digit' })}
                  {!e.completed && <Text style={{ color: T.subText }}> · {t('history.stoppedEarly')}</Text>}
                </Text>
              </View>
              <Text style={[styles.rowTime, { color: e.completed ? T.text : T.faintText }]}>{fmtClock(e.activeSecs)}</Text>
              <View accessible accessibilityLabel={e.completed ? feelLabel(e) : t('history.stoppedEarly')} style={styles.rowIcon}>
                {e.completed ? <FeelIcon feeling={e.feeling} size={16} /> : (
                  <Svg width={14} height={14} viewBox="0 0 14 14">
                    <Circle cx={7} cy={7} r={5.5} fill="none" stroke={T.faintText} strokeWidth={1.5} />
                    <Path d="M4.5 7h5" stroke={T.faintText} strokeWidth={1.5} strokeLinecap="round" />
                  </Svg>
                )}
              </View>
            </View>
          ))}
        </View>
      </ScrollView>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  root: { flex: 1, paddingTop: 54, paddingHorizontal: 20 },
  content: { paddingBottom: 28 },
  header: { marginBottom: 20 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 10 * 0.14, textTransform: 'uppercase', color: T.faintText },
  card: { backgroundColor: T.card, borderWidth: 1, borderColor: T.hairline, borderRadius: 18 },
  chipRow: { flexDirection: 'row', gap: 9 },
  chip: { flex: 1, backgroundColor: T.card, borderWidth: 1, borderColor: T.hairline, borderRadius: 16, paddingVertical: 12, paddingHorizontal: 14, gap: 6 },
  chipValueRow: { flexDirection: 'row', alignItems: 'baseline', gap: 5 },
  chipValue: { fontFamily: 'ChakraPetch_700Bold', fontSize: 28, lineHeight: 30 },
  chipUnit: { fontFamily: 'Inter_700Bold', fontSize: 12, color: T.subText },
  tabs: { flexDirection: 'row', gap: 4, padding: 3, borderRadius: 12, backgroundColor: T.ghostBg, borderWidth: 1, borderColor: T.hairline },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: 9 },
  tabText: { fontFamily: 'Inter_800ExtraBold', fontSize: 12, letterSpacing: 12 * 0.03 },
  totalsRow: { flexDirection: 'row', marginTop: 14 },
  totalCell: { flex: 1, alignItems: 'center' },
  totalValue: { fontFamily: 'ChakraPetch_700Bold', fontSize: 22, lineHeight: 24 },
  heatHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 },
  heatSub: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 10 * 0.04, color: T.faintText },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11, paddingHorizontal: 14 },
  rowName: { fontFamily: 'Inter_700Bold', fontSize: 14 },
  rowMeta: { fontFamily: 'Inter_600SemiBold', fontSize: 11.5, color: T.faintText, marginTop: 2 },
  rowTime: { fontFamily: 'ChakraPetch_700Bold', fontSize: 14 },
  rowIcon: { width: 18, alignItems: 'center' },
  empty: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 10, paddingBottom: 40 },
  emptyIcon: { width: 72, height: 72, borderRadius: 36, borderWidth: 1.5, borderStyle: 'dashed', borderColor: T.hairline, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontFamily: 'Inter_800ExtraBold', fontSize: 18, color: T.text },
  emptyBody: { fontFamily: 'Inter_600SemiBold', fontSize: 13, color: T.subText, maxWidth: 210, lineHeight: 19, textAlign: 'center' },
  chooseBtn: { marginTop: 10, paddingVertical: 12, paddingHorizontal: 22, borderRadius: 14, backgroundColor: T.accent },
  chooseBtnText: { fontFamily: 'Inter_800ExtraBold', fontSize: 13.5, letterSpacing: 13.5 * 0.06, color: T.btnGlyph },
}); }
