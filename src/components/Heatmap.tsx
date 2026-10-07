import React, { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useTheme, withOpacity, type ThemeTokens } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import { heatmapBuckets, type HeatmapCell } from '../lib/historyStats';
import type { HistoryEntry } from '../lib/history';

const LEVEL_ALPHA = [0, 0x38, 0x66, 0xa8, 0xff];
const GAP = 3;

function cellColor(T: ThemeTokens, level: HeatmapCell['level']): string {
  return level > 0 ? withOpacity(T.accent, LEVEL_ALPHA[level]) : T.ghostBg;
}

export default function Heatmap({ entries, weeks = 11 }: { entries: HistoryEntry[]; weeks?: number }) {
  const { T } = useTheme();
  const { t, locale } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const grid = useMemo(() => heatmapBuckets(entries, weeks), [entries, weeks]);

  // Mon–Sun row labels, 3 chars, in the user's language (5 Oct 2026 is a Monday).
  const dayLabel = (dow: number) => new Date(2026, 9, 5 + dow).toLocaleDateString(locale, { weekday: 'short' }).slice(0, 3);

  return (
    <View>
      <View style={styles.grid}>
        <View style={styles.dayCol}>
          {[0, 1, 2, 3, 4, 5, 6].map(d => (
            <View key={d} style={styles.dayCell}>
              <Text style={styles.dayText}>{dayLabel(d)}</Text>
            </View>
          ))}
        </View>
        {grid.map((col, w) => (
          <View key={w} style={styles.col}>
            {col.map((c, dow) => (
              <View
                key={dow}
                accessible={!c.future}
                accessibilityLabel={c.future ? undefined : t('history.cellA11y', { mins: Math.round(c.mins) })}
                style={[
                  styles.cell,
                  c.future
                    ? null
                    : { backgroundColor: cellColor(T, c.level), borderWidth: c.level === 0 ? 1 : 0, borderColor: T.hairline },
                  c.daysAgo === 0 && styles.today,
                ]}
              />
            ))}
          </View>
        ))}
      </View>
      <View style={styles.legendRow}>
        <Text style={styles.legendText}>{t('history.weeksAgo', { count: weeks })}</Text>
        <View style={styles.legend}>
          <Text style={styles.legendText}>{t('history.less')}</Text>
          {[0, 1, 2, 3, 4].map(l => (
            <View key={l} style={[styles.swatch, { backgroundColor: cellColor(T, l as HeatmapCell['level']), borderWidth: l ? 0 : 1, borderColor: T.hairline }]} />
          ))}
          <Text style={styles.legendText}>{t('history.more')}</Text>
        </View>
      </View>
    </View>
  );
}

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  grid: { flexDirection: 'row', gap: GAP },
  dayCol: { width: 22, gap: GAP },
  dayCell: { flex: 1, justifyContent: 'center' },
  dayText: { fontFamily: 'Inter_700Bold', fontSize: 8, color: T.faintText },
  col: { flex: 1, gap: GAP },
  cell: { aspectRatio: 1, borderRadius: 3 },
  today: { borderWidth: 1.5, borderColor: T.text },
  legendRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 },
  legend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  legendText: { fontFamily: 'Inter_600SemiBold', fontSize: 10, color: T.faintText },
  swatch: { width: 9, height: 9, borderRadius: 2 },
}); }
