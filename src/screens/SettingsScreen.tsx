import React, { useMemo } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, THEME_PREVIEWS, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { useSettings } from '../lib/settingsContext';
import { useTranslation } from '../lib/i18n';
import { usePremium } from '../lib/premiumContext';
import { setForceNextReview } from '../lib/reviewState';
import { SettingsToggle } from '../components/SettingsToggle';
import { SettingsRow } from '../components/SettingsRow';
import { SettingsSection } from '../components/SettingsSection';
import { ThemeCard } from '../components/ThemeCard';
import { VolumeRow } from '../components/VolumeRow';

// ══════════════════════════════════════════════════════════════
// SETTINGS SCREEN
// ══════════════════════════════════════════════════════════════
export default function SettingsScreen({ onBack }: { onBack: () => void }) {
  const { T, themeKey } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const { settings, updateSettings } = useSettings();
  const { t } = useTranslation();
  const { isPremium, trialDaysRemaining, setMockPremium, expireTrialForTesting, resetTrialForTesting } = usePremium();
  const [forceReview, setForceReview] = React.useState(false);

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
        <ScreenHeader onBack={onBack} subtitle={t('settings.subtitle')} title={t('settings.title')} style={styles.header} />

        {/* ── Appearance ── */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>{t('settings.appearance')}</Text>
          <View style={styles.themeRow}>
            {THEME_PREVIEWS.map(th => (
              <ThemeCard
                key={th.key}
                theme={th}
                selected={themeKey === th.key}
                onSelect={() => updateSettings('theme', th.key)}
              />
            ))}
          </View>
        </View>

        {/* ── Workout ── */}
        <SettingsSection title={t('settings.sectionWorkout')}>
          <SettingsRow
            label={t('settings.congratsLabel')}
            sub={t('settings.congratsSub')}
            right={<SettingsToggle value={settings.congratsMessage} onChange={v => updateSettings('congratsMessage', v)} />}
          />
          <SettingsRow
            label={t('settings.countdownFlashLabel')}
            sub={t('settings.countdownFlashSub')}
            right={<SettingsToggle value={settings.countdownFlash} onChange={v => updateSettings('countdownFlash', v)} />}
          />
          <SettingsRow
            label={t('settings.keepAwakeLabel')}
            sub={t('settings.keepAwakeSub')}
            right={<SettingsToggle value={settings.keepScreenAwake} onChange={v => updateSettings('keepScreenAwake', v)} />}
            last
          />
        </SettingsSection>

        {/* ── Units ── */}
        <SettingsSection title={t('settings.units')}>
          <SettingsRow
            label={t('settings.speedUnitLabel')}
            sub={t('settings.speedUnitSub')}
            last
            right={
              <View style={styles.segControl}>
                {(['km', 'miles'] as const).map(unit => (
                  <Pressable
                    key={unit}
                    onPress={() => updateSettings('speedUnit', unit)}
                    style={[
                      styles.segBtn,
                      settings.speedUnit === unit && { backgroundColor: T.accent },
                    ]}
                  >
                    <Text style={[
                      styles.segBtnText,
                      { color: settings.speedUnit === unit ? T.btnGlyph : T.subText },
                    ]}>
                      {unit === 'km' ? 'km/h' : 'mph'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </SettingsSection>

        {/* ── Language ── */}
        <SettingsSection title={t('settings.language')}>
          <SettingsRow
            label={t('settings.language')}
            sub={t('settings.languageSub')}
            last
            right={
              <View style={styles.segControl}>
                {(['en', 'es'] as const).map(lng => (
                  <Pressable
                    key={lng}
                    onPress={() => updateSettings('language', lng)}
                    style={[
                      styles.segBtn,
                      settings.language === lng && { backgroundColor: T.accent },
                    ]}
                  >
                    <Text style={[
                      styles.segBtnText,
                      { color: settings.language === lng ? T.btnGlyph : T.subText },
                    ]}>
                      {lng === 'en' ? 'English' : 'Español'}
                    </Text>
                  </Pressable>
                ))}
              </View>
            }
          />
        </SettingsSection>

        {/* ── Audio ── */}
        <SettingsSection title={t('settings.audio')}>
          <SettingsRow
            label={t('settings.soundOffLabel')}
            sub={t('settings.soundOffSub')}
            right={<SettingsToggle value={settings.soundOff} onChange={v => updateSettings('soundOff', v)} />}
          />
          <VolumeRow
            value={settings.soundVolume}
            onChange={v => updateSettings('soundVolume', v)}
            disabled={settings.soundOff}
          />
          <SettingsRow
            label={t('settings.soundCuesLabel')}
            sub={t('settings.soundCuesSub')}
            disabled={settings.soundOff}
            right={<SettingsToggle value={settings.soundCues} onChange={v => updateSettings('soundCues', v)} disabled={settings.soundOff} />}
          />
          <SettingsRow
            label={t('settings.finalBeepLabel')}
            sub={t('settings.finalBeepSub')}
            disabled={settings.soundOff}
            right={<SettingsToggle value={settings.finalCountdownBeep} onChange={v => updateSettings('finalCountdownBeep', v)} disabled={settings.soundOff} />}
            last
          />
        </SettingsSection>

        {/* ── Developer (dev builds only) ── */}
        {__DEV__ && (
          <SettingsSection title="Developer">
            <SettingsRow
              label="Mock Premium"
              sub="Simulate premium unlock"
              right={<SettingsToggle value={isPremium} onChange={setMockPremium} />}
            />
            <SettingsRow
              label="Trial days remaining"
              right={<Text style={styles.versionText}>{trialDaysRemaining}</Text>}
            />
            <SettingsRow
              label="Expire trial"
              sub="Set trial start to 31 days ago"
              right={<Pressable onPress={expireTrialForTesting} style={styles.devBtn}><Text style={styles.devBtnText}>Expire</Text></Pressable>}
            />
            <SettingsRow
              label="Reset trial"
              sub="Restart the 30-day trial window"
              right={<Pressable onPress={resetTrialForTesting} style={styles.devBtn}><Text style={styles.devBtnText}>Reset</Text></Pressable>}
            />
            <SettingsRow
              label="Trigger review prompt"
              sub="Show review dialog after next workout"
              right={<SettingsToggle value={forceReview} onChange={v => { setForceReview(v); setForceNextReview(v); }} />}
              last
            />
          </SettingsSection>
        )}

        {/* ── About ── */}
        <SettingsSection title={t('settings.about')}>
          <SettingsRow
            label={t('settings.version')}
            right={<Text style={styles.versionText}>1.0.0</Text>}
          />
          <SettingsRow
            label={t('settings.rateApp')}
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
        </SettingsSection>
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
    header: { marginBottom: 28 },

    // Appearance section (uses local themeRow layout, not SettingsSection)
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
    themeRow: {
      flexDirection: 'row',
      gap: 10,
    },

    // About
    versionText: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 13,
      color: T.faintText,
    },

    // Dev buttons
    devBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
      borderRadius: 8,
      borderWidth: 1.5,
      borderColor: T.accent,
    },
    devBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.accent,
    },

    // Segmented control
    segControl: {
      flexDirection: 'row',
      borderRadius: 8,
      overflow: 'hidden',
      borderWidth: 1.5,
      borderColor: T.hairline,
    },
    segBtn: {
      paddingHorizontal: 12,
      paddingVertical: 6,
    },
    segBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      letterSpacing: 12 * 0.04,
    },
  });
}
