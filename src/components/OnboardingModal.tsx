import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import Svg, { Circle, Path, Rect } from 'react-native-svg';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, withOpacity, THEME_PREVIEWS, type ThemeTokens, type ThemePreview } from '../theme';
import { useSettings } from '../lib/settingsContext';
import { buildSessionFromDraft } from '../lib/sessionDraft';
import { loadSessions, saveSessions, DEFAULT_RUN_SPEEDS, DEFAULT_RUN_INCLINES } from '../lib/sessions';
import { computeRoundsForTargetDuration, warmupCooldownForDuration } from '../lib/workout';
import { MIN_TARGET_DURATION_MINUTES, MAX_TARGET_DURATION_MINUTES } from '../hooks/usePickerState';
import { useTranslation } from '../lib/i18n';
import { SettingsToggle } from './SettingsToggle';

export const CURRENT_ONBOARDING_VERSION = 2;

interface Props {
  visible: boolean;
  onConfirm: (showFolders: boolean) => void;
}

function NumberStepper({ T, value, onChange, min, max, step: incrementBy }: {
  T: ThemeTokens;
  value: number;
  onChange: (next: number) => void;
  min: number;
  max: number;
  step: number;
}) {
  const styles = useMemo(() => makeStepperStyles(T), [T]);
  return (
    <View style={styles.row}>
      <Pressable
        style={styles.btn}
        onPress={() => onChange(Math.max(min, value - incrementBy))}
      >
        <Text style={styles.btnText}>−</Text>
      </Pressable>
      <Text style={styles.value}>{value}</Text>
      <Pressable
        style={styles.btn}
        onPress={() => onChange(Math.min(max, value + incrementBy))}
      >
        <Text style={styles.btnText}>+</Text>
      </Pressable>
    </View>
  );
}

export default function OnboardingModal({ visible, onConfirm }: Props) {
  const { T, themeKey } = useTheme();
  const { settings, updateSettings } = useSettings();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [showFolders, setShowFolders] = useState(!settings.hideFolders);
  const [voiceCues, setVoiceCues] = useState(settings.voiceCues);
  const [name, setName] = useState(settings.name);
  const [createFirstSession, setCreateFirstSession] = useState(false);
  const [sessionDurationMinutes, setSessionDurationMinutes] = useState(15);
  const [sessionWork, setSessionWork] = useState(30);
  const [sessionRest, setSessionRest] = useState(15);
  const [step, setStep] = useState(0);
  const [confirming, setConfirming] = useState(false);

  // Fresh installs (never onboarded) see the full wizard, including the 1.1 setup
  // steps. Upgraders from 1.1 already made these choices during their original
  // onboarding, so appearance/folders/voice cues are skipped entirely — they go
  // straight from what's-new to done.
  const isFreshInstall = settings.onboardingVersion === 0;
  const STEPS = ['whatsNew', ...(isFreshInstall ? ['appearance', 'folders', 'voiceCues', 'name', 'sessionDuration', 'sessionWork', 'sessionRecover'] : []), 'done'] as const;
  const STEP_COUNT = STEPS.length;
  const lastStep = step === STEP_COUNT - 1;
  const currentStep = STEPS[step];

  const sessionWarmupCooldown = warmupCooldownForDuration(sessionDurationMinutes);
  const sessionRounds = computeRoundsForTargetDuration(
    sessionWarmupCooldown, sessionWork, sessionRest, sessionWarmupCooldown, sessionDurationMinutes * 60,
  );
  const sessionActualMinutes = Math.round(
    (sessionWarmupCooldown * 2 + sessionRounds * (sessionWork + sessionRest)) / 60,
  );

  // Re-sync local state to the loaded settings each time the modal opens,
  // since it mounts once at launch before settings have resolved.
  useEffect(() => {
    if (!visible) return;
    setShowFolders(!settings.hideFolders);
    setVoiceCues(settings.voiceCues);
    setName(settings.name);
    setSessionDurationMinutes(15);
    setSessionWork(30);
    setSessionRest(15);
    setStep(0);
    setConfirming(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  async function handleConfirm() {
    updateSettings('hideFolders', !showFolders);
    updateSettings('voiceCues', voiceCues);
    updateSettings('name', name.trim());
    updateSettings('onboardingVersion', CURRENT_ONBOARDING_VERSION);
    if (createFirstSession) {
      const session = buildSessionFromDraft({
        mode: 'easy',
        name: t('onboarding.firstSessionName'),
        existingId: undefined,
        folderId: 'default',
        intervals: [],
        easyConfig: { warmup: sessionWarmupCooldown, high: sessionWork, low: sessionRest, rounds: sessionRounds, cooldown: sessionWarmupCooldown },
        activityType: undefined,
        runSpeeds: DEFAULT_RUN_SPEEDS,
        runInclines: DEFAULT_RUN_INCLINES,
        inclineEnabled: true,
        spinValues: undefined,
        circuitData: undefined,
      });
      const data = await loadSessions();
      await saveSessions({ ...data, sessions: [...data.sessions, session] });
    }
    onConfirm(showFolders);
  }

  const isNameStepValid = currentStep !== 'name' || name.trim().length > 0;

  async function handleNext() {
    if (!isNameStepValid || confirming) return;
    if (currentStep === 'sessionRecover') setCreateFirstSession(true);
    if (lastStep) {
      setConfirming(true);
      await handleConfirm();
    } else {
      setStep(s => s + 1);
    }
  }

  function handleSkipSessionSetup() {
    setCreateFirstSession(false);
    setStep(STEP_COUNT - 1);
  }

  function handleBack() {
    setStep(s => Math.max(0, s - 1));
  }

  // v1 (1.1) features — only shown to installs that never onboarded before (onboardingVersion === 0),
  // stacked with the v2 features below. Upgraders who already saw v1 skip straight to what's new in v2.
  const FEATURES_V1 = [
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

  // v2 (1.2) features — always shown, since they're new to every install.
  const FEATURES_V2 = [
    {
      titleKey: 'onboarding.feature4Title',
      subKey: 'onboarding.feature4Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M3 20 9 8l4 6 3-5 5 11" />
        </Svg>
      ),
    },
    {
      titleKey: 'onboarding.feature5Title',
      subKey: 'onboarding.feature5Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Path d="M11 5 6 9H3v6h3l5 4V5z" />
          <Path d="M16.5 12h4" />
        </Svg>
      ),
    },
    {
      titleKey: 'onboarding.feature6Title',
      subKey: 'onboarding.feature6Sub',
      icon: (
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none" stroke={T.accent} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
          <Rect x={6} y={6} width={12} height={12} rx={3} />
          <Path d="M9 6V4h6v2M9 20v-2h6v2M12 10v3l1.5 1" />
        </Svg>
      ),
    },
  ];

  const FEATURES = isFreshInstall ? [...FEATURES_V1, ...FEATURES_V2] : FEATURES_V2;

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={() => {}}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <View style={styles.handleRow}>
            <View style={styles.handle} />
          </View>

          <View style={styles.dotsRow}>
            {Array.from({ length: STEP_COUNT }).map((_, i) => (
              <View
                key={i}
                style={[styles.dot, i === step ? styles.dotActive : styles.dotInactive]}
              />
            ))}
          </View>

          <ScrollView
            style={styles.scroll}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
          >
            {currentStep === 'whatsNew' && (
              <>
                <View style={styles.headerBlock}>
                  <View style={styles.glyph}>
                    <Svg width={26} height={26} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round">
                      <Circle cx={12} cy={14} r={7} />
                      <Path d="M9.7 3.2h4.6M12 3.4V7M18.4 7.6l1.3-1.3M12 14l3 1.8M12 14V10.2" />
                    </Svg>
                  </View>
                  <Text style={styles.title}>{t('onboarding.title')}</Text>
                  <Text style={styles.subtitle}>{t(isFreshInstall ? 'onboarding.subtitle' : 'onboarding.subtitleMinimal')}</Text>
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
              </>
            )}

            {currentStep === 'appearance' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={4} />
                    <Path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('settings.appearance')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.appearanceSub')}</Text>
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
              </View>
            )}

            {currentStep === 'folders' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('settings.hideFoldersLabel')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.foldersSub')}</Text>
                <View style={styles.optionToggleRow}>
                  <SettingsToggle value={showFolders} onChange={setShowFolders} />
                </View>
              </View>
            )}

            {currentStep === 'voiceCues' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M4 9v6h4l5 4V5L8 9H4z" fill={T.btnGlyph} />
                    <Path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" fill="none" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('settings.voiceCuesLabel')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.voiceCuesSub')}</Text>
                <View style={styles.optionToggleRow}>
                  <SettingsToggle value={voiceCues} onChange={setVoiceCues} />
                </View>
              </View>
            )}

            {currentStep === 'name' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={8} r={4} />
                    <Path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.nameTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.nameSub')}</Text>
                <TextInput
                  style={styles.nameInput}
                  value={name}
                  onChangeText={setName}
                  placeholder={t('onboarding.namePlaceholder')}
                  placeholderTextColor={T.faintText}
                  autoCapitalize="words"
                  autoCorrect={false}
                  maxLength={40}
                />
              </View>
            )}

            {currentStep === 'sessionDuration' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Circle cx={12} cy={12} r={9} />
                    <Path d="M12 7v5l3 3" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionDurationTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionDurationSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionDurationMinutes} onChange={setSessionDurationMinutes} min={MIN_TARGET_DURATION_MINUTES} max={MAX_TARGET_DURATION_MINUTES} step={5} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}

            {currentStep === 'sessionWork' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <Path d="M13 2 4 14h6l-1 8 9-12h-6l1-8z" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionWorkTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionWorkSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionWork} onChange={setSessionWork} min={5} max={300} step={5} />
                </View>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}

            {currentStep === 'sessionRecover' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Rect x={7} y={6} width={4} height={12} rx={2} fill={T.btnGlyph} />
                    <Rect x={13} y={6} width={4} height={12} rx={2} fill={T.btnGlyph} />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.sessionRecoverTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.sessionRecoverSub')}</Text>
                <View style={styles.stepperCentered}>
                  <NumberStepper T={T} value={sessionRest} onChange={setSessionRest} min={5} max={120} step={5} />
                </View>
                <Text style={styles.sessionSummary}>
                  {t('onboarding.sessionSetupSummary', { rounds: sessionRounds, minutes: sessionActualMinutes })}
                </Text>
                <Pressable style={styles.skipLink} onPress={handleSkipSessionSetup}>
                  <Text style={styles.skipLinkText}>{t('onboarding.sessionSetupSkip')}</Text>
                </Pressable>
              </View>
            )}

            {currentStep === 'done' && (
              <View style={styles.optionBlock}>
                <View style={styles.glyph}>
                  <Svg width={24} height={24} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
                    <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={T.btnGlyph} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                  </Svg>
                </View>
                <Text style={styles.optionTitle}>{t('onboarding.settingsTitle')}</Text>
                <Text style={styles.optionSub}>{t('onboarding.settingsSub')}</Text>
              </View>
            )}
          </ScrollView>

          <View style={styles.footer}>
            <View style={styles.footerRow}>
              {step > 0 && (
                <Pressable style={styles.backBtn} onPress={handleBack}>
                  <Text style={styles.backBtnText}>{t('onboarding.back')}</Text>
                </Pressable>
              )}
              <Pressable
                style={[styles.confirmBtn, (!isNameStepValid || confirming) && styles.confirmBtnDisabled]}
                onPress={handleNext}
                disabled={!isNameStepValid || confirming}
              >
                <Text style={styles.confirmBtnText}>{lastStep ? t('onboarding.confirm') : currentStep === 'sessionRecover' ? t('onboarding.sessionSetupCreate') : t('onboarding.next')}</Text>
              </Pressable>
            </View>
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
    themeRow: {
      flexDirection: 'row',
      gap: 8,
      marginBottom: 16,
    },
    dotsRow: {
      flexDirection: 'row',
      justifyContent: 'center',
      gap: 6,
      paddingTop: 14,
    },
    dot: {
      width: 6,
      height: 6,
      borderRadius: 3,
    },
    dotActive: {
      backgroundColor: T.accent,
      width: 16,
    },
    dotInactive: {
      backgroundColor: T.hairline,
    },
    optionBlock: {
      alignItems: 'center',
      paddingTop: 24,
      paddingBottom: 12,
    },
    optionTitle: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 19,
      color: T.text,
      textAlign: 'center',
      marginTop: 4,
    },
    optionSub: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: T.subText,
      textAlign: 'center',
      marginTop: 8,
      maxWidth: 280,
      lineHeight: 19,
    },
    optionToggleRow: {
      marginTop: 22,
    },
    nameInput: {
      marginTop: 22,
      width: '100%',
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 14,
      paddingHorizontal: 16,
      paddingVertical: 14,
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
      backgroundColor: T.card,
    },
    stepperCentered: {
      marginTop: 22,
    },
    sessionSummary: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.subText,
      textAlign: 'center',
      marginTop: 16,
    },
    skipLink: {
      marginTop: 24,
      paddingVertical: 6,
    },
    skipLinkText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      color: T.faintText,
      textDecorationLine: 'underline',
    },
    footer: {
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 22,
      borderTopWidth: 1,
      borderTopColor: T.hairline,
      backgroundColor: T.sheetBg,
    },
    footerRow: {
      flexDirection: 'row',
      gap: 10,
    },
    backBtn: {
      paddingVertical: 15,
      paddingHorizontal: 20,
      borderRadius: 16,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    backBtnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 14.5,
      color: T.text,
    },
    confirmBtn: {
      flex: 1,
      paddingVertical: 15,
      borderRadius: 16,
      backgroundColor: T.accent,
      alignItems: 'center',
      shadowColor: T.accent,
      shadowOffset: { width: 0, height: 10 },
      shadowOpacity: 0.33,
      shadowRadius: 26,
    },
    confirmBtnDisabled: {
      opacity: 0.45,
    },
    confirmBtnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 14.5,
      letterSpacing: 14.5 * 0.03,
      color: T.btnGlyph,
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

function makeStepperStyles(T: ThemeTokens) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 14,
    },
    btn: {
      width: 34,
      height: 34,
      borderRadius: 10,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    btnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
      color: T.text,
    },
    value: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 16,
      color: T.text,
      minWidth: 36,
      textAlign: 'center',
    },
  });
}
