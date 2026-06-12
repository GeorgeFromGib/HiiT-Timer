import React, { useRef, useImperativeHandle, useMemo } from 'react';
import {
  Animated,
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
import { NestableScrollContainer, NestableDraggableFlatList, ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { type Session, type RunSpeeds, speedForPhase } from '../lib/sessions';
import { fmtDuration, convertKmhToMph } from '../lib/workout';
import { useTheme, withOpacity, buttonShadow, glowShadow, selectedBg, selectedBorder, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { typography } from '../typography';
import PickerModal from '../components/PickerModal';
import IntervalRow from '../components/IntervalRow';
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';
import { type PresetLevel } from '../lib/presets';
import { useSettings } from '../lib/settingsContext';

function getIntervalDisplaySpeed(iv: LocalInterval, runSpeeds: RunSpeeds, isMiles: boolean): { value: string; unit: string } {
  const kmh = iv.speed ?? speedForPhase(iv.type, runSpeeds);
  return isMiles
    ? { value: convertKmhToMph(kmh).toFixed(1), unit: 'mph' }
    : { value: kmh.toFixed(1), unit: 'km/h' };
}

interface Props {
  session?: Session;
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, onBack }: Props) {
  const { T } = useTheme();
  const { settings } = useSettings();
  const isMiles = settings.speedUnit === 'miles';
  const styles = useMemo(() => makeStyles(T), [T]);
  const isEditing = !!existing;

  const {
    draft, picker,
    setName,
    setActivityType,
    toggleMode,
    openFieldPicker, openRoundsPicker, openIntervalPicker, openSpeedPicker,
    openIntervalSpeedPicker, clearIntervalSpeed,
    cyclePhase, addInterval, duplicateInterval, removeInterval, clearIntervals, reorderIntervals,
    updatePicker, commitPicker, dismissPicker,
    applyDurationPreset, applySpeedPreset,
    save, cancel, deleteSession,
  } = useEditSession(existing, onBack);

  const { name, isAdvanced, fieldValues, rounds, intervals, previewSegments, previewTotal, activityType, runSpeeds, activeTimingPreset, activeSpeedPreset, hasChanges } = draft;
  const isRun = activityType === 'run';

  const timeFields: { label: string; field: TimeField }[] = [
    { label: 'Warmup',   field: 'warmup'   },
    { label: 'Work',     field: 'work'     },
    { label: 'Rest',     field: 'rest'     },
    { label: 'Cooldown', field: 'cooldown' },
  ];

  const speedFields: { label: string; field: keyof RunSpeeds }[] = [
    { label: 'Warmup',   field: 'warmupSpeed'   },
    { label: 'Work',     field: 'workSpeed'     },
    { label: 'Rest',     field: 'restSpeed'     },
    { label: 'Cooldown', field: 'cooldownSpeed' },
  ];

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <ScreenHeader
          onBack={cancel}
          title={isEditing ? 'Edit Session' : 'New Session'}
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
            <Text style={styles.fieldLabel}>SESSION NAME</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="e.g. Morning Blast"
              placeholderTextColor={T.faintText}
              returnKeyType="done"
            />
          </View>

          {/* Activity Type */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>ACTIVITY TYPE</Text>
            <View style={styles.activityTypeRow}>
              <Pressable
                style={[styles.activityTypeBtn, !isRun && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                onPress={() => setActivityType(undefined)}
              >
                <Text style={[styles.activityTypeBtnText, { color: !isRun ? T.accent : T.subText }]}>General</Text>
              </Pressable>
              <Pressable
                style={[styles.activityTypeBtn, isRun && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
                onPress={() => setActivityType('run')}
              >
                <Text style={[styles.activityTypeBtnText, { color: isRun ? T.accent : T.subText }]}>Run</Text>
              </Pressable>
            </View>
          </View>

          {/* Mode toggle — always visible; back-conversion to easy is validated by tryConvertToEasy */}
          {(
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SETUP MODE</Text>
              <View style={styles.modeToggleRow}>
                <Text style={[styles.modeToggleLabel, { color: !isAdvanced ? T.accent : T.subText }]}>Easy</Text>
                <Switch
                  value={isAdvanced}
                  onValueChange={toggleMode}
                  trackColor={{ false: selectedBorder(T.accent), true: selectedBorder(T.accent) }}
                  thumbColor={T.accent}
                />
                <Text style={[styles.modeToggleLabel, { color: isAdvanced ? T.accent : T.subText }]}>Advanced</Text>
              </View>
            </View>
          )}

          {isAdvanced ? (
            <>
              {/* Intervals */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>INTERVAL PRESETS</Text>
                <PresetStrip onApply={applyDurationPreset} T={T} styles={styles} activePreset={activeTimingPreset} />
                {isRun && (
                  <>
                    <Text style={styles.fieldLabel}>SPEED PRESETS</Text>
                    <PresetStrip onApply={applySpeedPreset} T={T} styles={styles} activePreset={activeSpeedPreset} />
                  </>
                )}
                {intervals.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No intervals yet. Add one below.</Text>
                  </View>
                )}
              </View>

              <NestableDraggableFlatList
                data={intervals}
                keyExtractor={iv => iv._key}
                onDragEnd={({ data }) => reorderIntervals(data)}
                renderItem={({ item: iv, drag, isActive }: RenderItemParams<LocalInterval>) => (
                  <IntervalSwipeRow
                    interval={iv}
                    T={T}
                    styles={styles}
                    isActive={isActive}
                    drag={drag}
                    onDuplicate={() => duplicateInterval(iv._key)}
                    onRemove={() => removeInterval(iv._key)}
                    onCyclePhase={() => cyclePhase(iv._key)}
                    onOpenPicker={() => openIntervalPicker(iv._key)}
                    displaySpeed={isRun ? getIntervalDisplaySpeed(iv, runSpeeds, isMiles) : undefined}
                    onOpenSpeedPicker={isRun ? () => openIntervalSpeedPicker(iv._key, isMiles) : undefined}
                    onClearSpeed={isRun ? () => clearIntervalSpeed(iv._key) : undefined}
                  />
                )}
              />

              <View style={styles.intervalActions}>
                <Pressable onPress={addInterval} style={styles.addIntervalBtn}>
                  <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                    <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
                  </Svg>
                  <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>Add Interval</Text>
                </Pressable>
                {intervals.length > 0 && (
                  <Pressable onPress={clearIntervals} style={styles.clearIntervalsBtn}>
                    <Text style={[styles.addIntervalBtnText, { color: T.subText }]}>Clear All</Text>
                  </Pressable>
                )}
              </View>
            </>
          ) : (
            <>
              {/* Easy mode timing */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldLabel}>INTERVAL PRESETS</Text>
                <PresetStrip onApply={applyDurationPreset} T={T} styles={styles} activePreset={activeTimingPreset} />
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
                    <Text style={styles.configCellLabel}>Rounds</Text>
                    <Pressable style={styles.configInput} onPress={openRoundsPicker}>
                      <Text style={styles.configInputText}>{rounds}</Text>
                    </Pressable>
                  </View>
                </View>
              </View>

            </>
          )}

          {/* Speeds — only shown in Easy mode (Advanced mode has speed presets inline above intervals) */}
          {isRun && !isAdvanced && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SPEED PRESETS</Text>
              <PresetStrip onApply={applySpeedPreset} T={T} styles={styles} activePreset={activeSpeedPreset} />
              <View style={styles.configGrid}>
                {speedFields.map(({ label, field }) => (
                  <View key={field} style={styles.configCell}>
                    <Text style={styles.configCellLabel}>{label}</Text>
                    <Pressable
                      style={styles.configInput}
                      onPress={() => {
                        const displayVal = isMiles
                          ? convertKmhToMph(runSpeeds[field])
                          : runSpeeds[field];
                        openSpeedPicker(field, displayVal, isMiles);
                      }}
                    >
                      <Text style={styles.configInputText}>
                        {isMiles
                          ? convertKmhToMph(runSpeeds[field]).toFixed(1)
                          : runSpeeds[field].toFixed(1)}
                        <Text style={styles.speedUnitText}>{' '}{isMiles ? 'mph' : 'km/h'}</Text>
                      </Text>
                    </Pressable>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Preview */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>PREVIEW</Text>
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
              <Text style={styles.previewMeta}>
                {fmtDuration(previewTotal)} · {previewSegments.length} intervals
              </Text>
            </View>
          </View>

          {/* Save / Cancel */}
          <Pressable onPress={save} style={[styles.saveBtn, !hasChanges && styles.saveBtnDisabled]} disabled={!hasChanges}>
            <Text style={styles.saveBtnText}>
              {isEditing ? 'SAVE CHANGES' : 'SAVE'}
            </Text>
          </Pressable>
          <Pressable onPress={cancel} style={styles.cancelBtn}>
            <Text style={styles.cancelBtnText}>Cancel</Text>
          </Pressable>


        </NestableScrollContainer>
      </KeyboardAvoidingView>

      <PickerModal
        picker={picker}
        onDismiss={dismissPicker}
        onCommit={commitPicker}
        onUpdate={updatePicker}
      />
    </LinearGradient>
  );
}

// ── Preset strip ─────────────────────────────────────────────────────────────

const PRESET_LEVELS: { label: string; level: PresetLevel }[] = [
  { label: 'Easy',   level: 'easy'   },
  { label: 'Medium', level: 'medium' },
  { label: 'Hard',   level: 'hard'   },
];

function PresetStrip({
  onApply,
  T,
  styles,
  activePreset,
}: {
  onApply: (level: PresetLevel) => void;
  T: ThemeTokens;
  styles: ReturnType<typeof makeStyles>;
  activePreset?: PresetLevel | null;
}) {
  return (
    <View style={styles.presetStrip}>
      {PRESET_LEVELS.map(({ label, level }) => {
        const isActive = level === activePreset;
        return (
          <Pressable
            key={level}
            style={({ pressed }) => [
              styles.presetPill,
              (pressed || isActive) && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) },
            ]}
            onPress={() => onApply(level)}
          >
            <Text style={[styles.presetPillText, { color: isActive ? T.accent : T.subText }]}>{label}</Text>
          </Pressable>
        );
      })}
    </View>
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

  activityTypeRow: {
    flexDirection: 'row',
    gap: 10,
  },
  activityTypeBtn: {
    flex: 1,
    paddingVertical: 11,
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.ghostBg,
  },
  activityTypeBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
  },

  configGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },

  presetStrip: {
    flexDirection: 'row',
    gap: 8,
  },
  presetPill: {
    flex: 1,
    paddingVertical: 8,
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: T.hairline,
    backgroundColor: T.ghostBg,
  },
  presetPillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 12 * 0.04,
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

  advancedHeader: { gap: 22 },
  advancedFooter: { gap: 22 },
  intervalSwipeContainer: { marginBottom: 6 },
  intervalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  intervalRowActive: {
    borderColor: T.accent,
    backgroundColor: selectedBg(T.accent),
    ...glowShadow(T),
    shadowRadius: 8,
  },
  dragHandle: {
    alignSelf: 'stretch',
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
    minWidth: 84,
    alignItems: 'center',
  },
  phasePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.06,
  },
  intervalSpeed: {
    flex: 1,
    alignItems: 'center',
  },
  intervalSpeedUnit: {
    fontSize: 11,
    fontFamily: 'Inter_400Regular',
  },
  intervalDuration: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  intervalDurationText: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 18,
    color: T.text,
  },
  swipeDuplicateAction: {
    backgroundColor: '#3b82f6',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: 80,
    borderRadius: 12,
    marginRight: 6,
  },
  swipeDuplicateText: {
    ...typography.controlLabel,
    color: '#fff',
  },
  swipeDeleteAction: {
    backgroundColor: '#ff5a5f',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 4,
    width: 80,
    borderRadius: 12,
  },
  swipeDeleteText: {
    ...typography.controlLabel,
    color: '#fff',
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

  // ── Save / Delete ──────────────────────────────────────────────────────────
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

  deleteBtn: {
    paddingVertical: 14,
    alignItems: 'center',
  },
  deleteBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    letterSpacing: 14 * 0.06,
    textTransform: 'uppercase',
    color: '#ff5a5f',
  },
}); }

const IntervalSwipeDuplicateAction = React.forwardRef<
  { reset: () => void },
  { styles: ReturnType<typeof makeStyles>; onDuplicate: () => void; swipeable: { close: () => void } }
>(function IntervalSwipeDuplicateAction({ styles, onDuplicate, swipeable }, ref) {
  const opacity = useRef(new Animated.Value(1)).current;

  useImperativeHandle(ref, () => ({ reset: () => opacity.setValue(1) }));

  const handlePress = () => {
    onDuplicate();
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => swipeable.close(),
    );
  };

  return (
    <Animated.View style={{ opacity, alignSelf: 'stretch' }}>
      <Pressable onPress={handlePress} style={[styles.swipeDuplicateAction, { flex: 1 }]}>
        <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
          <Path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.swipeDuplicateText}>Duplicate</Text>
      </Pressable>
    </Animated.View>
  );
});

function IntervalSwipeRow({
  interval, T, styles, isActive, drag,
  onDuplicate, onRemove, onCyclePhase, onOpenPicker,
  displaySpeed, onOpenSpeedPicker, onClearSpeed,
}: {
  interval:           LocalInterval;
  T:                  ThemeTokens;
  styles:             ReturnType<typeof makeStyles>;
  isActive:           boolean;
  drag:               () => void;
  onDuplicate:        () => void;
  onRemove:           () => void;
  onCyclePhase:       () => void;
  onOpenPicker:       () => void;
  displaySpeed?:      { value: string; unit: string };
  onOpenSpeedPicker?: () => void;
  onClearSpeed?:      () => void;
}) {
  const duplicateRef = useRef<{ reset: () => void } | null>(null);

  return (
    <ScaleDecorator>
      <ReanimatedSwipeable
        containerStyle={styles.intervalSwipeContainer}
        onSwipeableClose={() => duplicateRef.current?.reset()}
        renderLeftActions={(_p, _d, swipeable) => (
          <IntervalSwipeDuplicateAction
            ref={duplicateRef}
            styles={styles}
            onDuplicate={onDuplicate}
            swipeable={swipeable}
          />
        )}
        renderRightActions={(_p, _d, swipeable) => (
          <Pressable
            onPress={() => { swipeable.close(); onRemove(); }}
            style={styles.swipeDeleteAction}
          >
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={styles.swipeDeleteText}>Delete</Text>
          </Pressable>
        )}
      >
        <IntervalRow
          interval={interval}
          isActive={isActive}
          onCyclePhase={onCyclePhase}
          onOpenPicker={onOpenPicker}
          onDrag={drag}
          displaySpeed={displaySpeed}
          onOpenSpeedPicker={onOpenSpeedPicker}
          onClearSpeed={onClearSpeed}
        />
      </ReanimatedSwipeable>
    </ScaleDecorator>
  );
}
