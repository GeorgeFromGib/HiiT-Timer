import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { useTheme, ghostBtnStyle, THEME_PREVIEWS, type ThemeTokens, type ThemePreview } from '../theme';
import { typography } from '../typography';
import {
  DEFAULT_SETTINGS,
  loadSettings,
  saveSettings,
  type Settings,
  type ThemeKey,
} from '../lib/settings';

// ── Toggle ──────────────────────────────────────────────────────
function Toggle({ value, onChange, disabled = false }: {
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const anim = useRef(new Animated.Value(value ? 1 : 0)).current;

  useEffect(() => {
    Animated.timing(anim, {
      toValue: value ? 1 : 0,
      duration: 180,
      useNativeDriver: false,
    }).start();
  }, [value, anim]);

  const left = anim.interpolate({ inputRange: [0, 1], outputRange: [2, 21] });

  return (
    <Pressable
      onPress={() => { if (!disabled) onChange(!value); }}
      style={[
        styles.toggleTrack,
        {
          backgroundColor: (value && !disabled) ? T.accent : T.ghostBg,
          borderColor: (value && !disabled) ? T.accent : T.hairline,
          shadowColor: (value && !disabled) ? T.accent : 'transparent',
          shadowOpacity: (value && !disabled) ? 0.33 : 0,
          shadowOffset: { width: 0, height: 3 },
          shadowRadius: 5,
        },
      ]}
    >
      <Animated.View
        style={[
          styles.toggleThumb,
          {
            left,
            backgroundColor: (value && !disabled) ? T.btnGlyph : T.subText,
          },
        ]}
      />
    </Pressable>
  );
}

// ── Settings row ────────────────────────────────────────────────
function SRow({
  label,
  sub,
  right,
  last,
  disabled,
}: {
  label: string;
  sub?: string;
  right: React.ReactNode;
  last?: boolean;
  disabled?: boolean;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={[styles.row, !last && styles.rowBorder, disabled && { opacity: 0.4 }]}>
      <View style={styles.rowLabels}>
        <Text style={styles.rowLabel}>{label}</Text>
        {sub ? <Text style={styles.rowSub}>{sub}</Text> : null}
      </View>
      {right}
    </View>
  );
}

// ── Section ─────────────────────────────────────────────────────
function SSection({ title, children }: { title: string; children: React.ReactNode }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>{title}</Text>
      <View style={styles.sectionCard}>{children}</View>
    </View>
  );
}

// ── Theme card ──────────────────────────────────────────────────
function ThemeCard({
  theme,
  selected,
  onSelect,
}: {
  theme: ThemePreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  return (
    <Pressable
      onPress={onSelect}
      style={[
        styles.themeCard,
        {
          borderColor: selected ? T.accent : T.hairline,
          shadowColor: selected ? T.accent : 'transparent',
          shadowOpacity: selected ? 0.2 : 0,
          shadowOffset: { width: 0, height: 6 },
          shadowRadius: 9,
        },
      ]}
    >
      {/* gradient preview */}
      <LinearGradient
        colors={[theme.bg[1], theme.bg[0]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.themePreview}
      >
        <View style={[styles.themeAccentDot, { backgroundColor: theme.accent, shadowColor: theme.accent }]} />
        {theme.phases.map((c, i) => (
          <View key={i} style={[styles.themePhaseDot, { backgroundColor: c }]} />
        ))}
      </LinearGradient>

      {/* label row */}
      <View style={[styles.themeLabel, { borderTopColor: T.hairline, backgroundColor: T.card }]}>
        <View>
          <Text style={styles.themeName}>{theme.name}</Text>
          <Text style={styles.themeNote}>{theme.note}</Text>
        </View>
        <View
          style={[
            styles.themeCheck,
            {
              backgroundColor: selected ? T.accent : 'transparent',
              borderColor: selected ? T.accent : T.hairline,
            },
          ]}
        >
          {selected && (
            <Svg width={10} height={10} viewBox="0 0 10 10">
              <Path
                d="M2 5.5l2.2 2.2L8 3"
                stroke={T.btnGlyph}
                strokeWidth={1.7}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            </Svg>
          )}
        </View>
      </View>
    </Pressable>
  );
}

// ══════════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ══════════════════════════════════════════════════════════════
export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { T, themeKey, setTheme } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);

  useEffect(() => {
    loadSettings().then(setSettings);
  }, []);

  function update<K extends keyof Settings>(key: K, value: Settings[K]) {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
    if (key === 'theme') setTheme(value as ThemeKey);
  }

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.ghostBtn}>
            <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <Path
                d="M10 13L5 8l5-5"
                stroke={T.subText}
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <View style={styles.headerCenter}>
            <Text style={styles.headerLabel}>Preferences</Text>
            <Text style={styles.headerTitle}>Settings</Text>
          </View>
          <View style={{ width: 36 }} />
        </View>

        {/* ── Appearance ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Appearance</Text>
          <View style={styles.themeRow}>
            {THEME_PREVIEWS.map(th => (
              <ThemeCard
                key={th.key}
                theme={th}
                selected={themeKey === th.key}
                onSelect={() => update('theme', th.key)}
              />
            ))}
          </View>
        </View>

        {/* ── Workout ── */}
        <SSection title="Workout">
          <SRow
            label="Congratulatory message"
            sub="Full-screen celebration at workout end"
            right={<Toggle value={settings.congratsMessage} onChange={v => update('congratsMessage', v)} />}
          />
          <SRow
            label="Keep screen awake"
            sub="Prevent display sleep during workout"
            right={<Toggle value={settings.keepScreenAwake} onChange={v => update('keepScreenAwake', v)} />}
            last
          />
        </SSection>

        {/* ── Audio & Haptics ── */}
        <SSection title="Audio & Haptics">
          <SRow
            label="Sound off"
            sub="Mute all audio"
            right={<Toggle value={settings.soundOff} onChange={v => update('soundOff', v)} />}
          />
          <SRow
            label="Sound cues"
            sub="Play tones on phase changes"
            disabled={settings.soundOff}
            right={<Toggle value={settings.soundCues} onChange={v => update('soundCues', v)} disabled={settings.soundOff} />}
          />
          <SRow
            label="Final countdown beep"
            sub="Audio cue in last 3 seconds"
            disabled={settings.soundOff}
            right={<Toggle value={settings.finalCountdownBeep} onChange={v => update('finalCountdownBeep', v)} disabled={settings.soundOff} />}
          />
          <SRow
            label="Haptic feedback"
            sub="Vibrate on interval transitions"
            disabled={settings.soundOff}
            right={<Toggle value={settings.hapticFeedback} onChange={v => update('hapticFeedback', v)} disabled={settings.soundOff} />}
            last
          />
        </SSection>

        {/* ── About ── */}
        <SSection title="About">
          <SRow
            label="Version"
            right={<Text style={styles.versionText}>1.0.0</Text>}
          />
          <SRow
            label="Rate the app"
            right={
              <Svg width={16} height={16} viewBox="0 0 16 16" fill="none">
                <Path
                  d="M6 12L10 8 6 4"
                  stroke={T.faintText}
                  strokeWidth={1.8}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </Svg>
            }
            last
          />
        </SSection>
      </ScrollView>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: {
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 28,
    },

    // Header
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 28,
    },
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    headerLabel: {
      ...typography.sectionLabel,
      color: T.faintText,
    },
    headerTitle: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 20,
      letterSpacing: -0.2,
      color: T.text,
      marginTop: 1,
    },
    ghostBtn: ghostBtnStyle(T),

    // Section
    section: { marginBottom: 24 },
    sectionTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 11 * 0.12,
      textTransform: 'uppercase',
      color: T.faintText,
      marginBottom: 8,
      paddingLeft: 4,
    },
    sectionCard: {
      backgroundColor: T.card,
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 18,
      overflow: 'hidden',
    },

    // Theme cards
    themeRow: {
      flexDirection: 'row',
      gap: 10,
    },
    themeCard: {
      flex: 1,
      borderRadius: 16,
      overflow: 'hidden',
      borderWidth: 2,
    },
    themePreview: {
      height: 64,
      flexDirection: 'row',
      alignItems: 'flex-end',
      paddingHorizontal: 12,
      paddingBottom: 10,
      gap: 5,
    },
    themeAccentDot: {
      width: 12,
      height: 12,
      borderRadius: 6,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 4,
    },
    themePhaseDot: {
      width: 6,
      height: 6,
      borderRadius: 3,
      opacity: 0.7,
    },
    themeLabel: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 12,
      paddingVertical: 10,
      borderTopWidth: 1,
    },
    themeName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.text,
    },
    themeNote: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: T.faintText,
      marginTop: 1,
    },
    themeCheck: {
      width: 20,
      height: 20,
      borderRadius: 10,
      borderWidth: 1.5,
      alignItems: 'center',
      justifyContent: 'center',
    },

    // Row
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 13,
      paddingHorizontal: 16,
    },
    rowBorder: {
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    rowLabels: { flex: 1, marginRight: 12 },
    rowLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
      lineHeight: 20,
    },
    rowSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.faintText,
      marginTop: 2,
    },

    // Toggle
    toggleTrack: {
      width: 46,
      height: 27,
      borderRadius: 999,
      borderWidth: 1.5,
      justifyContent: 'center',
    },
    toggleThumb: {
      position: 'absolute',
      top: 2,
      width: 19,
      height: 19,
      borderRadius: 9.5,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.25,
      shadowRadius: 2,
      elevation: 2,
    },

    // About
    versionText: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 13,
      color: T.faintText,
    },
  });
}
