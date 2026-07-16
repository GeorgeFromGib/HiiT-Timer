import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, withOpacity, THEME_PREVIEWS, type ThemeTokens, type ThemePreview } from '../theme';
import { useSettings } from '../lib/settingsContext';
import { useTranslation } from '../lib/i18n';
import { SettingsRow } from './SettingsRow';
import { SettingsToggle } from './SettingsToggle';

export const CURRENT_ONBOARDING_VERSION = 1;

interface Props {
  visible: boolean;
  onConfirm: (showFolders?: boolean) => void;
}

export default function OnboardingModal({ visible, onConfirm }: Props) {
  const { T, themeKey } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);

  // Re-sync local state to the loaded settings each time the modal opens,
  // since it mounts once at launch before settings have resolved.
  useEffect(() => {
    if (!visible) return;
    setShowFolders(!settings.hideFolders);
    setVoiceCues(settings.voiceCues);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    onConfirm(showFolders);
  }

  function handleSkip() {
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    onConfirm();
  }

  const FEATURES = [
    {
      titleKey: 'onboarding.feature1Title',
      subKey: 'onboarding.feature1Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={T.accent} />
          <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke={T.accent} strokeWidth={2} strokeLinecap="round" fill="none" />
        </Svg>
      ),
    },
    {
      titleKey: 'onboarding.feature2Title',
      subKey: 'onboarding.feature2Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
        </Svg>
      ),
    },
    {
      titleKey: 'onboarding.feature3Title',
      subKey: 'onboarding.feature3Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Circle cx={15.5} cy={4.6} r={2.1} />
          <Path d="M14.2 8.3 10 13.4l3.6 1.9.5 5M10 13.4 6.2 16.8 4 18.4M13.6 9.6l3.3 1.7 2.7-.6" />
        </Svg>
      ),
    },
  ];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            <View style={styles.headerBlock}>
              <View style={styles.glyph}>
                <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                  <Circle cx={12} cy={14} r={7} />
                  <Path d="M9.7 3.2h4.6M12 3.4V7M18.4 7.6l1.3-1.3M12 14l3 1.8M12 14V10.2" />
                </Svg>
              </View>
              <Text style={styles.title}>{t('onboarding.title')}</Text>
              <Text style={styles.subtitle}>{t('onboarding.subtitle')}</Text>
            </View>

            <Text style={styles.sectionLabel}>{t('onboarding.whatsNew')}</Text>
            <View style={styles.featureList}>
              {FEATURES.map(f => (
                <View key={f.titleKey} style={styles.featureRow}>
                  <View style={styles.featureIcon}>{f.icon}</View>
                  <View style={styles.featureTextBlock}>
                    <Text style={styles.featureTitle}>{t(f.titleKey)}</Text>
                    <Text style={styles.featureSub}>{t(f.subKey)}</Text>
                  </View>
                </View>
              ))}
            </View>

            <Text style={styles.sectionLabel}>{t('onboarding.quickSetup')}</Text>

            <Text style={styles.subsectionLabel}>{t('settings.appearance')}</Text>
            <View style={styles.themeRow}>
              {THEME_PREVIEWS.map(preview => (
                <ThemeSwatch
                  key={preview.key}
                  T={T}
                  preview={preview}
                  selected={themeKey === preview.key}
                  onSelect={() => updateSettings('theme', preview.key)}
                />
              ))}
            </View>

            <View style={styles.settingsCard}>
              <SettingsRow
                label={t('settings.hideFoldersLabel')}
                sub={t('settings.hideFoldersSub')}
                right={<SettingsToggle value={showFolders} onChange={setShowFolders} />}
              />
              <SettingsRow
                label={t('settings.voiceCuesLabel')}
                sub={t('settings.voiceCuesSub')}
                right={<SettingsToggle value={voiceCues} onChange={setVoiceCues} />}
                last
              />
            </View>
          </ScrollView>

          <View style={styles.footer}>
            <Pressable style={styles.confirmBtn} onPress={handleConfirm} testID="onboarding-confirm">
              <Text style={styles.confirmBtnText}>{t('onboarding.confirm')}</Text>
            </Pressable>
            <Pressable style={styles.skipBtn} onPress={handleSkip} testID="onboarding-later">
              <Text style={styles.skipBtnText}>{t('onboarding.later')}</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

function ThemeSwatch({ T, preview, selected, onSelect }: {
  T: ThemeTokens;
  preview: ThemePreview;
  selected: boolean;
  onSelect: () => void;
}) {
  const styles = useMemo(() => makeSwatchStyles(T), [T]);
  return (
    <Pressable
      onPress={onSelect}
      style={[styles.swatch, { borderColor: selected ? T.accent : T.hairline }]}
    >
      <LinearGradient
        colors={[preview.bg[1], preview.bg[0]]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
        style={styles.swatchPreview}
      >
        <View style={[styles.dot, { backgroundColor: preview.accent, shadowColor: preview.accent }]} />
      </LinearGradient>
      <View style={styles.swatchLabelRow}>
        <Text style={styles.swatchLabel}>{preview.name}</Text>
        {selected && (
          <View style={[styles.check, { backgroundColor: T.accent }]}>
            <Svg width={8} height={8} viewBox="0 0 10 10">
              <Path d="M2 5.5l2.2 2.2L8 3" stroke={T.btnGlyph} strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            </Svg>
          </View>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(6,10,13,0.55)',
      justifyContent: 'flex-end',
    },
    sheet: {
      maxHeight: '91%',
      backgroundColor: T.sheetBg,
      borderTopLeftRadius: 26,
      borderTopRightRadius: 26,
      borderWidth: 1,
      borderBottomWidth: 0,
      borderColor: T.hairline,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: -20 },
      shadowOpacity: 0.35,
      shadowRadius: 50,
    },
    handleRow: {
      alignItems: 'center',
      paddingTop: 10,
    },
    handle: {
      width: 36,
      height: 4,
      borderRadius: 999,
      backgroundColor: T.hairline,
    },
    scroll: { flexGrow: 0 },
    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 14,
    },
    headerBlock: {
      alignItems: 'center',
      marginBottom: 20,
    },
    glyph: {
      width: 52,
      height: 52,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: T.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: T.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.33,
      shadowRadius: 24,
    },
    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 21,
      color: T.text,
      textAlign: 'center',
    },
    subtitle: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: T.subText,
      textAlign: 'center',
      marginTop: 6,
      maxWidth: 260,
      lineHeight: 19,
    },
    sectionLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 11 * 0.12,
      textTransform: 'uppercase',
      color: T.faintText,
      marginBottom: 12,
      paddingLeft: 2,
    },
    featureList: {
      gap: 16,
      marginBottom: 26,
    },
    featureRow: {
      flexDirection: 'row',
      gap: 12,
      alignItems: 'flex-start',
    },
    featureIcon: {
      width: 38,
      height: 38,
      borderRadius: 12,
      backgroundColor: withOpacity(T.accent, 0x1e),
      borderWidth: 1,
      borderColor: withOpacity(T.accent, 0x44),
      alignItems: 'center',
      justifyContent: 'center',
    },
    featureTextBlock: { flex: 1, paddingTop: 2 },
    featureTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: T.text,
      lineHeight: 18,
    },
    featureSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12.5,
      color: T.faintText,
      marginTop: 2,
      lineHeight: 17,
    },
    subsectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.subText,
      marginBottom: 8,
      paddingLeft: 2,
    },
    themeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    settingsCard: {
      backgroundColor: T.card,
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 16,
      overflow: 'hidden',
      marginBottom: 22,
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 22,
      borderTopWidth: 1,
      borderTopColor: T.hairline,
      backgroundColor: T.sheetBg,
      gap: 10,
    },
    confirmBtn: {
      width: '100%',
      paddingVertical: 15,
      borderRadius: 16,
      backgroundColor: T.accent,
      alignItems: 'center',
      shadowColor: T.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.33,
      shadowRadius: 26,
    },
    confirmBtnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 14.5,
      letterSpacing: 14.5 * 0.03,
      color: T.btnGlyph,
    },
    skipBtn: {
      alignItems: 'center',
      paddingVertical: 2,
    },
    skipBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12.5,
      color: T.faintText,
    },
  });
}

function makeSwatchStyles(T: ThemeTokens) {
  return StyleSheet.create({
    swatch: {
      flex: 1,
      borderRadius: 14,
      overflow: 'hidden',
      borderWidth: 2,
    },
    swatchPreview: {
      height: 34,
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 10,
    },
    dot: {
      width: 9,
      height: 9,
      borderRadius: 4.5,
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0.6,
      shadowRadius: 6,
    },
    swatchLabelRow: {
      paddingHorizontal: 10,
      paddingTop: 7,
      paddingBottom: 8,
      backgroundColor: T.card,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 6,
    },
    swatchLabel: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: T.text,
    },
    check: {
      width: 15,
      height: 15,
      borderRadius: 7.5,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
