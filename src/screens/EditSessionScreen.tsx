import React, { useMemo } from 'react';
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { NestableScrollContainer, NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';
import { loadSessions, saveSessions, type Session, type RunSpeeds, type RunInclines, type SpinValues, speedForPhase, spinValueForPhase, inclineForPhase } from '../lib/sessions';
import { fmtDuration, type Phase } from '../lib/workout';
import { toDisplay } from '../lib/speedUnit';
import { useTheme, withOpacity, buttonShadow, selectedBorder, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { typography } from '../typography';
import PickerModal from '../components/PickerModal';
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';
import { MIN_TARGET_DURATION_MINUTES } from '../hooks/usePickerState';
import { useSettings } from '../lib/settingsContext';
import { i18n, type Language } from '../lib/i18n';
import { useTranslation } from '../hooks/useTranslation';
import { appAlert } from '../lib/appAlert';
import PresetStrip from '../components/EditSession/PresetStrip';
import TimePresetStrip from '../components/EditSession/TimePresetStrip';
import IntervalSwipeRow from '../components/EditSession/IntervalSwipeRow';
import ActivityTypeIcon from '../components/ActivityTypeIcon';
import { SettingsToggle } from '../components/SettingsToggle';

function getIntervalDisplaySpeed(iv: LocalInterval, runSpeeds: RunSpeeds, isMiles: boolean): { value: string; unit: string } {
  const unit = isMiles ? 'miles' : 'km';
  const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
  return { value: toDisplay(kmh, unit).toFixed(1), unit: isMiles ? 'mi' : 'km' };
}

interface Props {
  session?: Session;
  activityType?: 'general' | 'run' | 'circuit' | 'spinning';
  folderId?: string;
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, activityType, folderId, onBack }: Props) {
  const { T } = useTheme();
  const { settings } = useSettings();
  const { t } = useTranslation();
  const isMiles = settings.speedUnit === 'miles';
  const styles = useMemo(() => makeStyles(T), [T]);
  const isEditing = !!existing;

  const {
    draft, picker,
    setName,
    toggleMode,
    openFieldPicker, setFieldEnabled, openRoundsPicker, openIntervalPicker, openSpeedPicker,
    openIntervalSpeedPicker, clearIntervalSpeed,
    openCircuitWarmupPicker, openCircuitCooldownPicker, openCircuitRestPicker, openCircuitsPicker, setTabataMode,
    openSpinResistancePicker, openSpinPowerPicker,
    openIntervalResistancePicker, openIntervalPowerPicker,
    clearIntervalResistance, clearIntervalPower,
    openInclinePicker, openIntervalInclinePicker, clearIntervalIncline, setInclineEnabled,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    commitPicker, dismissPicker,
    applyDurationPreset, openCustomLengthPicker, applySpeedPreset, applyInclinePreset, applySpinPreset,
    setActivityLabel,
    buildSavePayload,
  } = useEditSession(existing, onBack, activityType, folderId);

  const {
    name, isAdvanced, isCircuit, isSpinning, fieldValues, rounds, intervals,
    previewSegments, previewTotal,
    activityType: draftActivityType, runSpeeds, runInclines, inclineEnabled, spinValues,
    activeTimingPreset, targetLengthMinutes, activeSpeedPreset, activeInclinePreset, activeSpinPreset, hasChanges,
    circuitWarmup, circuitCooldown, circuitRest, circuitCount, tabataMode,
  } = draft;
  const isRun = draftActivityType === 'run';
  const circuitLocked = isCircuit && tabataMode;

  const [showAddPhasePicker, setShowAddPhasePicker] = React.useState(false);
  const [showTabataInfo, setShowTabataInfo] = React.useState(false);
  const addPhaseOptions: Phase[] = isCircuit
    ? ['work', 'rest']
    : ['work', 'rest', 'warmup', 'cooldown'];

  const editorTitle = isEditing
    ? t('edit.editTitle')
    : isCircuit
      ? t('edit.newCircuitTitle')
      : isSpinning
        ? t('edit.newSpinningTitle')
        : t('edit.newTitle');

  // Warm-up and cool-down get their own toggleable rows (see easy-mode block below); this grid is work/rest only.
  const timeFields: { label: string; field: TimeField }[] = [
    { label: t('phases.work'),     field: 'work'     },
    { label: t('phases.rest'),     field: 'rest'     },
  ];

  const speedFields: { label: string; field: keyof RunSpeeds }[] = [
    { label: t('phases.warmup'),   field: 'warmupSpeed'   },
    { label: t('phases.work'),     field: 'workSpeed'     },
    { label: t('phases.rest'),     field: 'restSpeed'     },
    { label: t('phases.cooldown'), field: 'cooldownSpeed' },
  ];

  async function handleSave() {
    const payload = buildSavePayload();
    if (!payload.ok) {
      appAlert('error', i18n.t(payload.titleKey), i18n.t(payload.messageKey));
      return;
    }
    const data = await loadSessions(i18n.locale as Language);
    const nextSessions = payload.isNew
      ? [...data.sessions, payload.session]
      : data.sessions.map(s => (s.id === payload.session.id ? payload.session : s));
    await saveSessions({ ...data, sessions: nextSessions });
    onBack();
  }

  function handleCancel() {
    if (!draft.hasChanges) { onBack(); return; }
    appAlert(
      'warning',
      i18n.t('alerts.unsavedTitle'),
      i18n.t('alerts.unsavedMessage'),
      [
        { text: i18n.t('alerts.saveBtn'), onPress: handleSave },
        { text: i18n.t('alerts.discard'), style: 'destructive', onPress: onBack },
        { text: i18n.t('alerts.keepEditing'), style: 'cancel' },
      ],
    );
  }

  function renderAddIntervalBar() {
    if (showAddPhasePicker) {
      return (
        <View style={styles.intervalActions}>
          {addPhaseOptions.map(phase => {
            const phaseColor = T.phases[phase];
            return (
              <Pressable
                key={phase}
                style={[styles.phasePill, { backgroundColor: withOpacity(phaseColor, 0x22), borderColor: phaseColor, flex: 1 }]}
                onPress={() => {
                  addInterval(phase);
                  setShowAddPhasePicker(false);
                }}
              >
                <Text style={[styles.phasePillText, { color: phaseColor }]}>{t('phasesAbbr.' + phase)}</Text>
              </Pressable>
            );
          })}
          <Pressable
            style={[styles.phasePill, { borderColor: T.hairline, flex: 0, paddingHorizontal: 14 }]}
            onPress={() => setShowAddPhasePicker(false)}
          >
            <Text style={[styles.phasePillText, { color: T.subText }]}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      );
    }
    return (
      <View style={styles.intervalActions}>
        <Pressable onPress={() => setShowAddPhasePicker(true)} style={styles.addIntervalBtn}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
          </Svg>
          <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>{t('edit.addInterval')}</Text>
        </Pressable>
        {intervals.length > 0 && (
          <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
            <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>{t('edit.clearAll')}</Text>
          </Pressable>
        )}
      </View>
    );
  }

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScreenHeader
          onBack={handleCancel}
          title={editorTitle}
          style={styles.header}
          right={
            <ActivityTypeIcon
              mode={isCircuit ? 'circuit' : 'easy'}
              activityType={draftActivityType}
              size={32}
            />
          }
        />

        <NestableScrollContainer
          style={styles.scroll}
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Name */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit.nameLabel')}</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder={t('edit.namePlaceholder')}
              placeholderTextColor={T.faintText}
              returnKeyType="done"
            />
          </View>

          {/* Preview */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>{t('edit.preview')}</Text>
            <View style={styles.previewCard}>
              {previewTotal > 0 && (
                <View style={styles.previewStrip}>
                  {previewSegments.map((seg, i) => (
                    <View
                      key={i}
                      style={[
                        styles.previewStripSeg,
                        {
                          flex: seg.duration / previewTotal,
                          backgroundColor: withOpacity(T.phases[seg.phase], 0xd9),
                        },
                      ]}
                    />
                  ))}
                </View>
              )}
              <View style={styles.previewMetaRow}>
                <Text style={styles.previewMeta}>
                  {fmtDuration(previewTotal)} · {previewSegments.length} {t('common.intervals')}
                </Text>
                <Text style={styles.previewMeta}>
                  {isCircuit ? t('edit.circuit') : isRun ? t('edit.run') : isSpinning ? t('edit.spinning') : t('edit.general')}
                </Text>
              </View>
            </View>
          </View>

          {/* Mode toggle — hidden for circuit sessions; Use Incline toggle shares the line, right-aligned, Treadmill only */}
          {!isCircuit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.setupMode')}</Text>
              <View style={[styles.modeToggleRow, { justifyContent: 'space-between' }]}>
                <View style={styles.modeToggleRow}>
                  <Text style={[styles.modeToggleLabel, { color: !isAdvanced ? T.accent : T.subText }]}>{t('edit.easy')}</Text>
                  <Switch
                    value={isAdvanced}
                    onValueChange={toggleMode}
                    trackColor={{ false: selectedBorder(T.accent), true: selectedBorder(T.accent) }}
                    thumbColor={T.accent}
                  />
                  <Text style={[styles.modeToggleLabel, { color: isAdvanced ? T.accent : T.subText }]}>{t('edit.advanced')}</Text>
                </View>
                {isRun && (
                  <View style={styles.modeToggleRow}>
                    <Text style={[styles.modeToggleLabel, { color: inclineEnabled ? T.accent : T.subText }]}>{t('edit.useIncline')}</Text>
                    <Switch
                      value={inclineEnabled}
                      onValueChange={setInclineEnabled}
                      trackColor={{ false: selectedBorder(T.accent), true: selectedBorder(T.accent) }}
                      thumbColor={T.accent}
                    />
                  </View>
                )}
              </View>
            </View>
          )}

          {isCircuit ? (
            <>
              {/* Tabata mode — locks every timing/count to the canonical 8×(20s/10s) config */}
              <View style={styles.fieldGroup}>
                <View style={[styles.modeToggleRow, { justifyContent: 'space-between' }]}>
                  <View style={styles.modeToggleRow}>
                    <Text style={[styles.modeToggleLabel, { color: tabataMode ? T.accent : T.subText }]}>{t('edit.tabataMode')}</Text>
                    <Pressable
                      onPress={() => setShowTabataInfo(true)}
                      hitSlop={10}
                      accessibilityRole="button"
                      accessibilityLabel={t('edit.tabataInfoTitle')}
                      style={styles.helpBtn}
                    >
                      <Text style={styles.helpBtnText}>?</Text>
                    </Pressable>
                  </View>
                  <Switch
                    value={tabataMode}
                    onValueChange={setTabataMode}
                    trackColor={{ false: selectedBorder(T.accent), true: selectedBorder(T.accent) }}
                    thumbColor={T.accent}
                  />
                </View>
                {circuitLocked && (
                  <Text style={styles.intervalsHint}>{t('edit.tabataHint')}</Text>
                )}
              </View>

              {/* Circuit config grid */}
              <View style={styles.fieldGroup}>
                <View style={[styles.configGrid, circuitLocked && { opacity: 0.45 }]}>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitWarmup')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitWarmupPicker} disabled={circuitLocked}>
                      <Text style={styles.configInputText}>{fmtDuration(circuitWarmup)}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitCooldown')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitCooldownPicker} disabled={circuitLocked}>
                      <Text style={styles.configInputText}>{fmtDuration(circuitCooldown)}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitRest')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitRestPicker} disabled={circuitLocked}>
                      <Text style={styles.configInputText}>{circuitRest > 0 ? fmtDuration(circuitRest) : '—'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuits')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitsPicker} disabled={circuitLocked}>
                      <Text style={styles.configInputText}>{circuitCount}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

              {/* Circuit interval list */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.setIntervals')}</Text>
                {intervals.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{t('edit.noIntervals')}</Text>
                  </View>
                )}
              </View>

              <NestableDraggableFlatList
                style={{ marginTop: -14 }}
                data={intervals}
                keyExtractor={iv => iv._key}
                onDragEnd={({ data }) => reorderIntervals(data)}
                renderItem={({ item: iv, drag, isActive }: RenderItemParams<LocalInterval>) => (
                  <IntervalSwipeRow
                    interval={iv}
                    isActive={isActive}
                    drag={drag}
                    locked={circuitLocked}
                    onDuplicate={() => duplicateInterval(iv._key)}
                    onRemove={() => removeInterval(iv._key)}
                    onCyclePhase={() => cyclePhase(iv._key)}
                    onOpenPicker={() => openIntervalPicker(iv._key)}
                    activityLabel={iv.activityLabel}
                    onLabelChange={iv.type === 'work' ? (label) => setActivityLabel(iv._key, label) : undefined}
                  />
                )}
              />

              {!circuitLocked && renderAddIntervalBar()}
            </>
          ) : isAdvanced ? (
            <>
              {/* Intervals */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.intervalPresets')}</Text>
                <PresetStrip onApply={applyDurationPreset} activePreset={activeTimingPreset} />
                {isRun && (
                  <>
                    <Text style={styles.fieldLabel}>{t('edit.speedPresets')}</Text>
                    <PresetStrip
                      onApply={applySpeedPreset}
                      activePreset={activeSpeedPreset}
                      lowLabel={t('edit.presetBriskWalk')}
                      highLabel={t('edit.presetHardRun')}
                    />
                  </>
                )}
                {isRun && inclineEnabled && (
                  <>
                    <Text style={styles.fieldLabel}>{t('edit.inclinePresets')}</Text>
                    <PresetStrip onApply={applyInclinePreset} activePreset={activeInclinePreset} />
                  </>
                )}
                {isSpinning && (
                  <>
                    <Text style={styles.fieldLabel}>{t('edit.spinPresets')}</Text>
                    <PresetStrip onApply={applySpinPreset} activePreset={activeSpinPreset} />
                  </>
                )}
                {intervals.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>{t('edit.noIntervals')}</Text>
                  </View>
                )}
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.sessionIntervals')}</Text>
                <Text style={styles.intervalsHint}>{t('edit.intervalsHint')}</Text>
              </View>

              <NestableDraggableFlatList
                style={{ marginTop: -14 }}
                data={intervals}
                keyExtractor={iv => iv._key}
                onDragEnd={({ data }) => reorderIntervals(data)}
                renderItem={({ item: iv, drag, isActive }: RenderItemParams<LocalInterval>) => (
                  <IntervalSwipeRow
                    interval={iv}
                    isActive={isActive}
                    drag={drag}
                    onDuplicate={() => duplicateInterval(iv._key)}
                    onRemove={() => removeInterval(iv._key)}
                    onCyclePhase={() => cyclePhase(iv._key)}
                    onOpenPicker={() => openIntervalPicker(iv._key)}
                    displaySpeed={isRun ? getIntervalDisplaySpeed(iv, runSpeeds, isMiles) : undefined}
                    onOpenSpeedPicker={isRun ? () => openIntervalSpeedPicker(iv._key, isMiles) : undefined}
                    onClearSpeed={isRun ? () => clearIntervalSpeed(iv._key) : undefined}
                    displayResistance={isSpinning ? (iv.resistance ?? spinValueForPhase(iv.type, spinValues).resistance) : undefined}
                    onOpenResistancePicker={isSpinning ? () => openIntervalResistancePicker(iv._key) : undefined}
                    onClearResistance={isSpinning ? () => clearIntervalResistance(iv._key) : undefined}
                    displayPower={isSpinning ? (iv.power ?? spinValueForPhase(iv.type, spinValues).power) : undefined}
                    onOpenPowerPicker={isSpinning ? () => openIntervalPowerPicker(iv._key) : undefined}
                    onClearPower={isSpinning ? () => clearIntervalPower(iv._key) : undefined}
                    displayIncline={isRun && inclineEnabled ? (iv.incline ?? inclineForPhase(iv.type, runInclines)) : undefined}
                    onOpenInclinePicker={isRun && inclineEnabled ? () => openIntervalInclinePicker(iv._key) : undefined}
                    onClearIncline={isRun && inclineEnabled ? () => clearIntervalIncline(iv._key) : undefined}
                  />
                )}
              />

              {renderAddIntervalBar()}
            </>
          ) : (
            <>
              {/* Easy mode timing */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.sessionLength')}</Text>
                <TimePresetStrip
                  minutes={targetLengthMinutes}
                  belowMin={previewTotal > 0 && previewTotal < MIN_TARGET_DURATION_MINUTES * 60}
                  onCustom={openCustomLengthPicker}
                />
              </View>

              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.intervalPresets')}</Text>
                <PresetStrip onApply={applyDurationPreset} activePreset={activeTimingPreset} />

                <Text style={[styles.fieldLabel, { marginTop: 8 }]}>
                  {t('edit.intervalSetup')}{previewTotal > 0 ? <Text style={styles.intervalSetupTotal}>{' '}[{fmtDuration(previewTotal)}]</Text> : null}
                </Text>
                <View style={styles.configRow}>
                  <Text style={styles.configCellLabel}>{t('phases.warmup')}</Text>
                  <View style={styles.configRowInline}>
                    <Pressable
                      style={[styles.configInput, { flex: 1 }, fieldValues.warmup === 0 && styles.configInputDisabled]}
                      onPress={() => openFieldPicker('warmup')}
                      disabled={fieldValues.warmup === 0}
                    >
                      <Text style={styles.configInputText}>
                        {fieldValues.warmup > 0 ? fmtDuration(fieldValues.warmup) : '—'}
                      </Text>
                    </Pressable>
                    <SettingsToggle
                      value={fieldValues.warmup > 0}
                      onChange={v => setFieldEnabled('warmup', v)}
                    />
                  </View>
                </View>

                <View style={styles.configGrid}>
                  {timeFields.map(({ label, field }) => (
                    <View key={field} style={styles.configCell}>
                      <Text style={styles.configCellLabel}>{label}</Text>
                      <Pressable
                        style={styles.configInput}
                        onPress={() => openFieldPicker(field)}
                      >
                        <Text style={styles.configInputText}>
                          {fmtDuration(fieldValues[field])}
                        </Text>
                      </Pressable>
                    </View>
                  ))}
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.rounds')}</Text>
                    <Pressable style={styles.configInput} onPress={openRoundsPicker}>
                      <Text style={styles.configInputText}>{rounds}</Text>
                    </Pressable>
                  </View>
                </View>

                <View style={styles.configRow}>
                  <Text style={styles.configCellLabel}>{t('phases.cooldown')}</Text>
                  <View style={styles.configRowInline}>
                    <Pressable
                      style={[styles.configInput, { flex: 1 }, fieldValues.cooldown === 0 && styles.configInputDisabled]}
                      onPress={() => openFieldPicker('cooldown')}
                      disabled={fieldValues.cooldown === 0}
                    >
                      <Text style={styles.configInputText}>
                        {fieldValues.cooldown > 0 ? fmtDuration(fieldValues.cooldown) : '—'}
                      </Text>
                    </Pressable>
                    <SettingsToggle
                      value={fieldValues.cooldown > 0}
                      onChange={v => setFieldEnabled('cooldown', v)}
                    />
                  </View>
                </View>
              </View>

              {isSpinning && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinPresets')}</Text>
                    <PresetStrip onApply={applySpinPreset} activePreset={activeSpinPreset} />
                  </View>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinResistance')}</Text>
                    <View style={styles.configGrid}>
                      {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                        const field = `${phase}Resistance` as keyof SpinValues;
                        const isPhaseDisabled = (phase === 'warmup' && fieldValues.warmup === 0)
                          || (phase === 'cooldown' && fieldValues.cooldown === 0);
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable
                              style={[styles.configInput, isPhaseDisabled && styles.configInputDisabled]}
                              onPress={() => openSpinResistancePicker(field)}
                              disabled={isPhaseDisabled}
                            >
                              <Text style={styles.configInputText}>{isPhaseDisabled ? '—' : spinValues[field]}</Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinPower')}</Text>
                    <View style={styles.configGrid}>
                      {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                        const field = `${phase}Power` as keyof SpinValues;
                        const isPhaseDisabled = (phase === 'warmup' && fieldValues.warmup === 0)
                          || (phase === 'cooldown' && fieldValues.cooldown === 0);
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable
                              style={[styles.configInput, isPhaseDisabled && styles.configInputDisabled]}
                              onPress={() => openSpinPowerPicker(field)}
                              disabled={isPhaseDisabled}
                            >
                              <Text style={styles.configInputText}>
                                {isPhaseDisabled ? '—' : <>{spinValues[field]}<Text style={styles.speedUnitText}>W</Text></>}
                              </Text>
                            </Pressable>
                          </View>
                        );
                      })}
                    </View>
                  </View>
                </>
              )}
            </>
          )}

          {/* Speeds — only shown in Easy mode (Advanced mode has speed presets inline above intervals) */}
          {isRun && !isAdvanced && !isCircuit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.speedPresets')}</Text>
              <PresetStrip
                onApply={applySpeedPreset}
                activePreset={activeSpeedPreset}
                lowLabel={t('edit.presetBriskWalk')}
                highLabel={t('edit.presetHardRun')}
              />
              <View style={styles.configGrid}>
                {speedFields.map(({ label, field }) => {
                  const isPhaseDisabled = (field === 'warmupSpeed' && fieldValues.warmup === 0)
                    || (field === 'cooldownSpeed' && fieldValues.cooldown === 0);
                  return (
                    <View key={field} style={styles.configCell}>
                      <Text style={styles.configCellLabel}>{label}</Text>
                      <Pressable
                        style={[styles.configInput, isPhaseDisabled && styles.configInputDisabled]}
                        onPress={() => openSpeedPicker(field, toDisplay(runSpeeds[field], isMiles ? 'miles' : 'km'), isMiles)}
                        disabled={isPhaseDisabled}
                      >
                        <Text style={styles.configInputText}>
                          {isPhaseDisabled ? '—' : (
                            <>
                              {toDisplay(runSpeeds[field], isMiles ? 'miles' : 'km').toFixed(1)}
                              <Text style={styles.speedUnitText}>{' '}{isMiles ? 'mph' : 'km/h'}</Text>
                            </>
                          )}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Treadmill incline — independent preset dial + per-phase editing */}
          {isRun && inclineEnabled && !isAdvanced && !isCircuit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.inclinePresets')}</Text>
              <PresetStrip onApply={applyInclinePreset} activePreset={activeInclinePreset} />
            </View>
          )}

          {isRun && inclineEnabled && !isAdvanced && !isCircuit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.treadmillIncline')}</Text>
              <View style={styles.configGrid}>
                {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                  const field = `${phase}Incline` as keyof RunInclines;
                  const isPhaseDisabled = (phase === 'warmup' && fieldValues.warmup === 0)
                    || (phase === 'cooldown' && fieldValues.cooldown === 0);
                  return (
                    <View key={field} style={styles.configCell}>
                      <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                      <Pressable
                        style={[styles.configInput, isPhaseDisabled && styles.configInputDisabled]}
                        onPress={() => openInclinePicker(field)}
                        disabled={isPhaseDisabled}
                      >
                        <Text style={styles.configInputText}>
                          {isPhaseDisabled ? '—' : <>{runInclines[field]}<Text style={styles.speedUnitText}>%</Text></>}
                        </Text>
                      </Pressable>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Save / Cancel */}
          <Pressable onPress={handleSave} style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]} disabled={!hasChanges}>
            <Text style={styles.saveBtnText}>
              {isEditing ? t('edit.saveChanges') : t('edit.save')}
            </Text>
          </Pressable>
          <Pressable onPress={handleCancel} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </Pressable>

        </NestableScrollContainer>
      </KeyboardAvoidingView>

      <PickerModal
        picker={picker}
        onDismiss={dismissPicker}
        onCommit={commitPicker}
      />

      <Modal
        visible={showTabataInfo}
        transparent
        animationType="fade"
        onRequestClose={() => setShowTabataInfo(false)}
      >
        <View style={styles.infoOverlay}>
          <View style={styles.infoCard}>
            <Text style={styles.infoTitle}>{t('edit.tabataInfoTitle')}</Text>
            <ScrollView style={styles.infoScroll} contentContainerStyle={styles.infoScrollContent}>
              <Text style={styles.infoBody}>{t('edit.tabataInfoBody')}</Text>
              <Text style={[styles.infoBody, styles.infoCaution]}>{t('edit.tabataInfoCaution')}</Text>
            </ScrollView>
            <Pressable onPress={() => setShowTabataInfo(false)} style={styles.infoCloseBtn}>
              <Text style={styles.infoCloseBtnText}>{t('common.done')}</Text>
            </Pressable>
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  root: { flex: 1 },
  kav:  { flex: 1 },

  header: {
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 22,
  },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    ...typography.sectionLabel,
    color: T.faintText,
  },
  intervalsHint: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.faintText,
  },

  textInput: {
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.text,
  },

  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeToggleLabel: {
    ...typography.controlLabel,
  },
  helpBtn: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.subText,
    alignItems: 'center',
    justifyContent: 'center',
  },
  helpBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    lineHeight: 14,
    color: T.subText,
  },
  infoOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.4)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  infoCard: {
    width: '100%',
    maxWidth: 380,
    maxHeight: '80%',
    backgroundColor: T.sheetBg,
    borderRadius: 16,
    padding: 20,
  },
  infoScroll: {
    marginTop: 12,
  },
  infoScrollContent: {
    paddingBottom: 4,
  },
  infoTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 17,
    color: T.text,
  },
  infoBody: {
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    lineHeight: 21,
    color: T.subText,
  },
  infoCaution: {
    marginTop: 16,
    color: T.phases.warmup,
    fontFamily: 'Inter_600SemiBold',
  },
  infoCloseBtn: {
    marginTop: 16,
    paddingVertical: 11,
    borderRadius: 8,
    backgroundColor: T.accent,
    alignItems: 'center',
  },
  infoCloseBtnText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
    color: '#fff',
  },

  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },

  intervalSetupTotal: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 13,
    color: T.subText,
  },

  configRow: {
    gap: 4,
  },
  configRowInline: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  configCell: {
    minWidth: '28%',
    flexGrow: 1,
    gap: 4,
  },
  configCellLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.faintText,
  },
  configInput: {
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 10,
    paddingVertical: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  configInputDisabled: {
    opacity: 0.5,
  },
  configInputText: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 18,
    color: T.text,
    textAlign: 'center',
  },
  speedUnitText: {
    fontFamily: 'Inter_400Regular',
    fontSize: 11,
    color: T.subText,
  },

  // ── Interval list ──────────────────────────────────────────────────────────
  emptyState: {
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 12,
    paddingVertical: 18,
    alignItems: 'center',
  },
  emptyStateText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
    color: T.faintText,
  },

  phasePill: {
    paddingVertical: 5,
    paddingHorizontal: 8,
    borderRadius: 999,
    borderWidth: 1.5,
    minWidth: 56,
    alignItems: 'center',
  },
  phasePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.06,
  },

  intervalActions: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 2,
  },
  addIntervalBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: selectedBorder(T.accent),
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  clearIntervalsBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    borderWidth: 1.5,
    borderColor: withOpacity(T.subText, 0x44),
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 12,
  },
  addIntervalBtnText: {
    ...typography.controlLabel,
  },

  // ── Preview ────────────────────────────────────────────────────────────────
  previewCard: {
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 14,
    padding: 14,
    gap: 10,
  },
  previewStrip: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 4,
    gap: 2,
  },
  previewStripSeg: {
    height: '100%',
    borderRadius: 4,
  },
  previewMeta: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 13,
    color: T.subText,
  },

  // ── Save / Cancel ─────────────────────────────────────────────────────────
  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    ...buttonShadow(T),
  },
  saveBtnDisabled: {
    opacity: 0.35,
  },
  saveBtnText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    letterSpacing: 15 * 0.06,
    textTransform: 'uppercase',
    color: T.btnGlyph,
  },
  cancelBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  cancelBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 14 * 0.06,
    textTransform: 'uppercase',
    color: T.subText,
  },
}); }
