import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import type { Tab } from '../navigation';

const ICONS: Record<Tab, string[]> = {
  home:     ['M3 11l9-8 9 8', 'M5 10v10h14V10', 'M10 20v-6h4v6'],
  history:  ['M4 20V10M10 20V4M16 20v-8M22 20H2'],
  settings: ['M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z', 'M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z'],
};
const TABS: Tab[] = ['home', 'history', 'settings'];

export default function TabBar({ active, onSelect }: { active: Tab; onSelect: (tab: Tab) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  return (
    <View
      accessibilityRole="tablist"
      accessibilityLabel={t('tabs.a11y')}
      style={[styles.bar, { backgroundColor: T.bgGradient[1], borderTopColor: T.hairline }]}
    >
      {TABS.map(tab => {
        const on = tab === active;
        const color = on ? T.accent : T.faintText;
        return (
          <Pressable
            key={tab}
            style={styles.tab}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t(`tabs.${tab}`)}
            onPress={() => onSelect(tab)}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24" fill="none">
              {ICONS[tab].map(d => (
                <Path key={d} d={d} stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              ))}
            </Svg>
            <Text style={[styles.label, { color }]}>{t(`tabs.${tab}`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // No SafeAreaProvider is mounted, so the home-indicator inset is a fixed padding.
  bar: { flexDirection: 'row', borderTopWidth: StyleSheet.hairlineWidth, paddingTop: 8, paddingBottom: 26 },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  label: { fontFamily: 'Inter_700Bold', fontSize: 10, letterSpacing: 0.4 },
});
