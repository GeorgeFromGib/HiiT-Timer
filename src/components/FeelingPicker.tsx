import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Rect } from 'react-native-svg';
import { useTheme, withOpacity, type ThemeTokens } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import type { Feeling } from '../lib/history';

const FEELINGS: { key: Feeling; bars: number; label: 'feelEasy' | 'feelRight' | 'feelHard' }[] = [
  { key: 'easy',  bars: 1, label: 'feelEasy' },
  { key: 'right', bars: 2, label: 'feelRight' },
  { key: 'hard',  bars: 3, label: 'feelHard' },
];

export function feelColor(T: ThemeTokens, f: Feeling): string {
  if (f === 'easy') return T.phases.warmup;
  if (f === 'hard') return T.phases.work;
  return T.accent;
}

// Three ascending bars — fill count encodes the feeling.
export function FeelIcon({ feeling, size = 16 }: { feeling?: Feeling; size?: number }) {
  const { T } = useTheme();
  const bars = FEELINGS.find(f => f.key === feeling)?.bars ?? 0;
  return (
    <Svg width={size} height={size} viewBox="0 0 16 16">
      {[0, 1, 2].map(i => (
        <Rect key={i} x={1 + i * 5.2} y={11 - i * 4} width={3.6} height={4 + i * 4} rx={1.2}
          fill={feeling && i < bars ? feelColor(T, feeling) : T.hairline} />
      ))}
    </Svg>
  );
}

interface Props {
  value?:   Feeling;
  onChange: (f: Feeling | undefined) => void;
}

export default function FeelingPicker({ value, onChange }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  if (value) {
    const col = feelColor(T, value);
    const label = t('complete.' + FEELINGS.find(f => f.key === value)!.label);
    return (
      <View accessibilityRole="summary" style={[styles.logged, { backgroundColor: withOpacity(col, 0x14), borderColor: withOpacity(col, 0x44) }]}>
        <FeelIcon feeling={value} size={18} />
        <Text style={styles.loggedText}>
          {t('complete.feelLogged')} <Text style={{ color: col }}>{label}</Text>
        </Text>
        <Pressable onPress={() => onChange(undefined)} accessibilityRole="button" accessibilityLabel={t('complete.feelChangeA11y')} hitSlop={8}>
          <Text style={styles.change}>{t('complete.feelChange')}</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View>
      <View style={styles.header}>
        <Text style={styles.title}>{t('complete.feelTitle')}</Text>
        <Text style={styles.optional}>{t('complete.feelOptional')}</Text>
      </View>
      <View accessibilityRole="radiogroup" accessibilityLabel={t('complete.feelGroupA11y')} style={styles.row}>
        {FEELINGS.map(f => {
          const label = t('complete.' + f.label);
          return (
            <Pressable
              key={f.key}
              onPress={() => onChange(f.key)}
              accessibilityRole="button"
              accessibilityLabel={t('complete.feelA11y', { label: label.toLowerCase() })}
              style={styles.btn}
            >
              <FeelIcon feeling={f.key} size={18} />
              <Text style={styles.btnText}>{label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, paddingLeft: 2 },
  title: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 10 * 0.14, textTransform: 'uppercase', color: T.faintText },
  optional: { fontFamily: 'Inter_600SemiBold', fontSize: 10, letterSpacing: 10 * 0.06, color: T.faintText },
  row: { flexDirection: 'row', gap: 8 },
  btn: {
    flex: 1, minHeight: 56, borderRadius: 14, borderWidth: 1, borderColor: T.hairline, backgroundColor: T.card,
    alignItems: 'center', justifyContent: 'center', gap: 6, paddingHorizontal: 4,
  },
  btnText: { fontFamily: 'Inter_700Bold', fontSize: 12, color: T.text, textAlign: 'center' },
  logged: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 11, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1 },
  loggedText: { flex: 1, fontFamily: 'Inter_700Bold', fontSize: 13, color: T.text },
  change: { fontFamily: 'Inter_700Bold', fontSize: 12, color: T.subText, textDecorationLine: 'underline' },
}); }
