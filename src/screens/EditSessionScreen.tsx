import React, { useMemo } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { NestableScrollContainer, NestableDraggableFlatList, type RenderItemParams } from 'react-native-draggable-flatlist';
import { loadSessions, saveSessions, type Session, type RunSpeeds, type SpinValues, speedForPhase, spinValueForPhase } from '../lib/sessions';
import { fmtDuration, type Phase } from '../lib/workout';
import { toDisplay } from '../lib/speedUnit';
import { useTheme, withOpacity, buttonShadow, selectedBorder, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { typography } from '../typography';
import PickerModal from '../components/PickerModal';
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';
import { useSettings } from '../lib/settingsContext';
import { i18n, type Language, useTranslation } from '../lib/i18n';
import PresetStrip from '../components/EditSession/PresetStrip';
import IntervalSwipeRow from '../components/EditSession/IntervalSwipeRow';

function getIntervalDisplaySpeed(iv: LocalInterval, runSpeeds: RunSpeeds, isMiles: boolean): { value: string; unit: string } {
  const unit = isMiles ? 'miles' : 'km';
  const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
  return { value: toDisplay(kmh, unit).toFixed(1), unit: isMiles ? 'mph' : 'km/h' };
}

interface Props {
  session?: Session;
  activityType?: 'general' | 'run' | 'circuit' | 'spinning';
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, activityType, onBack }: Props) {
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
    openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
    openIntervalSpeedPicker, clearIntervalSpeed,
    openCircuitWarmupPicker, openCircuitCooldownPicker, openCircuitRestPicker, openCircuitsPicker,
    openSpinResistancePicker, openSpinPowerPicker,
    openIntervalResistancePicker, openIntervalPowerPicker,
    clearIntervalResistance, clearIntervalPower,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    commitPicker, dismissPicker,
    applyDurationPreset, applySpeedPreset,
    setActivityLabel,
    buildSavePayload,
  } = useEditSession(existing, onBack, activityType);

  const {
    name, isAdvanced, isCircuit, isSpinning, fieldValues, rounds, intervals,
    previewSegments, previewTotal,
    activityType: draftActivityType, runSpeeds, spinValues,
    activeTimingPreset, activeSpeedPreset, hasChanges,
    circuitWarmup, circuitCooldown, circuitRest, circuitCount,
  } = draft;
  const isRun = draftActivityType === 'run';

  const [showAddPhasePicker, setShowAddPhasePicker] = React.useState(false);
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

  const timeFields: { label: string; field: TimeField }[] = [
    { label: t('phases.warmup'),   field: 'warmup'   },
    { label: t('phases.work'),     field: 'work'     },
    { label: t('phases.rest'),     field: 'rest'     },
    { label: t('phases.cooldown'), field: 'cooldown' },
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
      Alert.alert(i18n.t(payload.titleKey), i18n.t(payload.messageKey));
      return;
    }
    const sessions = await loadSessions(i18n.locale as Language);
    const next = payload.isNew
      ? [...sessions, payload.session]
      : sessions.map(s => (s.id === payload.session.id ? payload.session : s));
    await saveSessions(next);
    onBack();
  }

  function handleCancel() {
    if (!draft.hasChanges) { onBack(); return; }
    Alert.alert(
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

          {/* Mode toggle — hidden for circuit sessions */}
          {!isCircuit && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>{t('edit.setupMode')}</Text>
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
            </View>
          )}

          {isCircuit ? (
            <>
              {/* Circuit config grid */}
              <View style={styles.fieldGroup}>
                <View style={styles.configGrid}>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitWarmup')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitWarmupPicker}>
                      <Text style={styles.configInputText}>{fmtDuration(circuitWarmup)}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitCooldown')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitCooldownPicker}>
                      <Text style={styles.configInputText}>{fmtDuration(circuitCooldown)}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuitRest')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitRestPicker}>
                      <Text style={styles.configInputText}>{circuitRest > 0 ? fmtDuration(circuitRest) : '—'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{t('edit.circuits')}</Text>
                    <Pressable style={styles.configInput} onPress={openCircuitsPicker}>
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
                    onDuplicate={() => duplicateInterval(iv._key)}
                    onRemove={() => removeInterval(iv._key)}
                    onCyclePhase={() => cyclePhase(iv._key)}
                    onOpenPicker={() => openIntervalPicker(iv._key)}
                    activityLabel={iv.activityLabel}
                    onLabelChange={iv.type === 'work' ? (label) => setActivityLabel(iv._key, label) : undefined}
                  />
                )}
              />

              {renderAddIntervalBar()}
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
                    <PresetStrip onApply={applySpeedPreset} activePreset={activeSpeedPreset} />
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
                  />
                )}
              />

              {renderAddIntervalBar()}
            </>
          ) : (
            <>
              {/* Easy mode timing */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>{t('edit.intervalPresets')}</Text>
                <PresetStrip onApply={applyDurationPreset} activePreset={activeTimingPreset} />
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
              </View>

              {isSpinning && (
                <>
                  <View style={styles.fieldGroup}>
                    <Text style={styles.fieldLabel}>{t('edit.spinResistance')}</Text>
                    <View style={styles.configGrid}>
                      {(['warmup', 'work', 'rest', 'cooldown'] as const).map(phase => {
                        const field = `${phase}Resistance` as keyof SpinValues;
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable style={styles.configInput} onPress={() => openSpinResistancePicker(field)}>
                              <Text style={styles.configInputText}>{spinValues[field]}</Text>
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
                        return (
                          <View key={field} style={styles.configCell}>
                            <Text style={styles.configCellLabel}>{t('phases.' + phase)}</Text>
                            <Pressable style={styles.configInput} onPress={() => openSpinPowerPicker(field)}>
                              <Text style={styles.configInputText}>
                                {spinValues[field]}<Text style={styles.speedUnitText}>W</Text>
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
              <PresetStrip onApply={applySpeedPreset} activePreset={activeSpeedPreset} />
              <View style={styles.configGrid}>
                {speedFields.map(({ label, field }) => (
                  <View key={field} style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{label}</Text>
                    <Pressable
                      style={styles.configInput}
                      onPress={() => openSpeedPicker(field, toDisplay(runSpeeds[field], isMiles ? 'miles' : 'km'), isMiles)}
                    >
                      <Text style={styles.configInputText}>
                        {toDisplay(runSpeeds[field], isMiles ? 'miles' : 'km').toFixed(1)}
                        <Text style={styles.speedUnitText}>{' '}{isMiles ? 'mph' : 'km/h'}</Text>
                      </Text>
                    </Pressable>
                  </View>
                ))}
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

  previewMetaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
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
