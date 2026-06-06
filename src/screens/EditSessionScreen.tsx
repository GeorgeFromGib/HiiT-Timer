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
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { DIFFICULTY_COLORS, type Session, type Difficulty } from '../lib/sessions';
import { fmtDuration, type Interval, type Phase } from '../lib/workout';
import { useTheme, type ThemeTokens } from '../theme';
import WheelColumn from '../components/WheelColumn';
import { useEditSession, type LocalInterval, type TimeField } from '../hooks/useEditSession';

const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];
const PHASE_LABELS: Record<Phase, string> = {
  warmup:   'Warm Up',
  work:     'Work',
  rest:     'Rest',
  cooldown: 'Cool Down',
};

const MINUTE_LABELS = Array.from({ length: 60 }, (_, i) => String(i));
const SECOND_LABELS = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ROUND_LABELS  = Array.from({ length: 99 }, (_, i) => String(i + 1));

interface Props {
  session?: Session;
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, onBack }: Props) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const isEditing = !!existing;

  const {
    name, difficulty, isAdvanced,
    warmup, work, rest, rounds, cooldown,
    intervals, setIntervals,
    activePicker, pickerMinutes, pickerSeconds, pickerRounds,
    previewSegments, previewTotal,
    fieldValues, pickerTitle,
    setName, setDifficulty,
    handleModeToggle,
    openFieldPicker, openRoundsPicker, openIntervalPicker,
    cyclePhase, addInterval, removeInterval,
    setPickerMinutes, setPickerSeconds, setPickerRounds,
    handlePickerDone, dismissPicker,
    handleSave, handleDelete,
  } = useEditSession(existing, onBack);

  const timeFields: { label: string; field: TimeField }[] = [
    { label: 'Warmup',   field: 'warmup'   },
    { label: 'Work',     field: 'work'     },
    { label: 'Rest',     field: 'rest'     },
    { label: 'Cooldown', field: 'cooldown' },
  ];

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.kav}>
        <View style={styles.header}>
          <Pressable onPress={onBack} style={styles.backBtn}>
            <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
              <Path
                d="M15 18l-6-6 6-6"
                stroke={T.subText} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
          <View>
            <Text style={styles.headerLabel}>{isEditing ? 'EDIT' : 'NEW'}</Text>
            <Text style={styles.headerTitle}>{isEditing ? 'Edit Session' : 'New Session'}</Text>
          </View>
        </View>

        <ScrollView
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

          {/* Difficulty */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>DIFFICULTY</Text>
            <View style={styles.toggleRow}>
              {DIFFICULTIES.map(diff => {
                const active = difficulty === diff;
                const color  = DIFFICULTY_COLORS[diff];
                return (
                  <Pressable
                    key={diff}
                    onPress={() => setDifficulty(diff)}
                    style={[
                      styles.toggleBtn,
                      active
                        ? { backgroundColor: color + '22', borderColor: color }
                        : { backgroundColor: T.ghostBg, borderColor: T.hairline },
                    ]}
                  >
                    <Text style={[styles.toggleBtnText, { color: active ? color : T.subText }]}>
                      {diff}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
          </View>

          {/* Mode toggle — new sessions, or editing an easy session (upgrade to advanced) */}
          {(!isEditing || existing?.mode === 'easy') && (
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>SETUP MODE</Text>
              <View style={styles.modeToggleRow}>
                <Text style={[styles.modeToggleLabel, { color: !isAdvanced ? T.accent : T.subText }]}>Easy</Text>
                <Switch
                  value={isAdvanced}
                  onValueChange={handleModeToggle}
                  trackColor={{ false: T.accent + '55', true: T.accent + '55' }}
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
                <Text style={styles.fieldLabel}>INTERVALS</Text>
                {intervals.length === 0 && (
                  <View style={styles.emptyState}>
                    <Text style={styles.emptyStateText}>No intervals yet. Add one below.</Text>
                  </View>
                )}
              </View>

              <DraggableFlatList
                scrollEnabled={false}
                data={intervals}
                keyExtractor={iv => iv._key}
                onDragEnd={({ data }) => setIntervals(data)}
                renderItem={({ item: iv, drag, isActive }: RenderItemParams<LocalInterval>) => (
                  <ScaleDecorator>
                    <ReanimatedSwipeable
                      containerStyle={styles.intervalSwipeContainer}
                      renderRightActions={() => (
                        <Pressable
                          onPress={() => removeInterval(iv._key)}
                          style={styles.swipeDeleteAction}
                        >
                          <Text style={styles.swipeDeleteText}>Delete</Text>
                        </Pressable>
                      )}
                    >
                      <IntervalRow
                        interval={iv}
                        T={T}
                        styles={styles}
                        isActive={isActive}
                        onCyclePhase={() => cyclePhase(iv._key)}
                        onOpenPicker={() => openIntervalPicker(iv._key)}
                        onDrag={drag}
                      />
                    </ReanimatedSwipeable>
                  </ScaleDecorator>
                )}
              />

              <Pressable onPress={addInterval} style={styles.addIntervalBtn}>
                <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
                  <Path d="M12 5v14M5 12h14" stroke={T.accent} strokeWidth={2.2} strokeLinecap="round" />
                </Svg>
                <Text style={[styles.addIntervalBtnText, { color: T.accent }]}>Add Interval</Text>
              </Pressable>
            </>
          ) : (
            /* Easy mode timing */
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>TIMING</Text>
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
                          backgroundColor: T.phases[seg.phase] + 'd9',
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

          {/* Save */}
          <Pressable onPress={handleSave} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>
              {isEditing ? 'SAVE CHANGES' : 'SAVE'}
            </Text>
          </Pressable>

          {/* Delete (edit mode only) */}
          {isEditing && (
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>DELETE SESSION</Text>
            </Pressable>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      {/* Duration picker modal */}
      <Modal
        visible={activePicker !== null}
        transparent
        animationType="slide"
        onRequestClose={dismissPicker}
      >
        <View style={styles.modalOverlay}>
          <Pressable style={styles.modalDismiss} onPress={dismissPicker} />
          <View style={styles.modalSheet}>
            <View style={styles.modalHeader}>
              <Pressable onPress={dismissPicker} style={styles.modalCancelBtn}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Text style={styles.modalTitle}>{pickerTitle}</Text>
              <Pressable onPress={handlePickerDone} style={styles.modalDoneBtn}>
                <Text style={styles.modalDoneText}>Done</Text>
              </Pressable>
            </View>

            {activePicker?.type === 'rounds' ? (
              <>
                <View style={styles.pickerRow}>
                  <WheelColumn
                    values={ROUND_LABELS}
                    selected={pickerRounds}
                    onChange={setPickerRounds}
                  />
                </View>
                <View style={styles.pickerUnits}>
                  <Text style={styles.pickerUnitLabel}>rounds</Text>
                </View>
              </>
            ) : (
              <>
                <View style={styles.pickerRow}>
                  <WheelColumn
                    values={MINUTE_LABELS}
                    selected={pickerMinutes}
                    onChange={setPickerMinutes}
                  />
                  <View style={styles.pickerSeparator}>
                    <Text style={styles.pickerSeparatorText}>:</Text>
                  </View>
                  <WheelColumn
                    values={SECOND_LABELS}
                    selected={pickerSeconds}
                    onChange={setPickerSeconds}
                  />
                </View>
                <View style={styles.pickerUnits}>
                  <Text style={styles.pickerUnitLabel}>min</Text>
                  <View style={{ flex: 0, width: 24 }} />
                  <Text style={styles.pickerUnitLabel}>sec</Text>
                </View>
              </>
            )}
          </View>
        </View>
      </Modal>
    </LinearGradient>
  );
}

// ── Interval row component ───────────────────────────────────────────────────

interface IntervalRowProps {
  interval:     Interval;
  T:            ThemeTokens;
  styles:       ReturnType<typeof makeStyles>;
  isActive:     boolean;
  onCyclePhase: () => void;
  onOpenPicker: () => void;
  onDrag:       () => void;
}

function IntervalRow({
  interval, T, styles, isActive,
  onCyclePhase, onOpenPicker, onDrag,
}: IntervalRowProps) {
  const phaseColor = T.phases[interval.type];
  return (
    <View style={[styles.intervalRow, isActive && styles.intervalRowActive]}>
      <Pressable onPressIn={onDrag} style={styles.dragHandle} hitSlop={8}>
        <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
          <Path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke={T.faintText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
      </Pressable>

      <Pressable onPress={onCyclePhase} style={[styles.phasePill, { backgroundColor: phaseColor + '22', borderColor: phaseColor }]}>
        <Text style={[styles.phasePillText, { color: phaseColor }]}>{PHASE_LABELS[interval.type]}</Text>
      </Pressable>

      <Pressable onPress={onOpenPicker} style={styles.intervalDuration}>
        <Text style={styles.intervalDurationText}>{fmtDuration(interval.dur)}</Text>
      </Pressable>
    </View>
  );
}

// ── Styles ───────────────────────────────────────────────────────────────────

function makeStyles(T: ThemeTokens) { return StyleSheet.create({
  root: { flex: 1 },
  kav:  { flex: 1 },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingTop: 54,
    paddingHorizontal: 20,
    paddingBottom: 18,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.ghostBg,
    borderWidth: 1,
    borderColor: T.hairline,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,
    textTransform: 'uppercase',
    color: T.faintText,
  },
  headerTitle: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 22,
    color: T.text,
    marginTop: 2,
  },

  scroll: { flex: 1 },
  scrollContent: {
    paddingHorizontal: 20,
    paddingBottom: 40,
    gap: 22,
  },

  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.18,
    textTransform: 'uppercase',
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

  toggleRow: {
    flexDirection: 'row',
    gap: 8,
  },
  toggleBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1.5,
    alignItems: 'center',
  },
  toggleBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
  },
  modeToggleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  modeToggleLabel: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
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
    fontSize: 11,
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
    backgroundColor: T.accent + '14',
    shadowColor: T.accent,
    shadowOpacity: 0.2,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  dragHandle: {
    paddingHorizontal: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  phasePill: {
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  phasePillText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 11,
    letterSpacing: 11 * 0.06,
  },
  intervalDuration: {
    flex: 1,
    alignItems: 'flex-end',
    paddingRight: 4,
  },
  intervalDurationText: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 16,
    color: T.text,
  },
  swipeDeleteAction: {
    backgroundColor: '#ff5a5f',
    justifyContent: 'center',
    alignItems: 'center',
    width: 80,
    borderRadius: 12,
  },
  swipeDeleteText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    color: '#fff',
    letterSpacing: 13 * 0.04,
  },

  addIntervalBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderColor: T.accent + '55',
    borderRadius: 12,
    borderStyle: 'dashed',
    paddingVertical: 12,
    marginTop: 2,
  },
  addIntervalBtnText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 13,
    letterSpacing: 13 * 0.04,
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
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.33,
    shadowRadius: 14,
    elevation: 6,
  },
  saveBtnText: {
    fontFamily: 'Inter_800ExtraBold',
    fontSize: 15,
    letterSpacing: 15 * 0.06,
    textTransform: 'uppercase',
    color: T.btnGlyph,
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

  // ── Duration picker modal ─────────────────────────────────────────────────
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalDismiss: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  modalSheet: {
    backgroundColor: T.sheetBg,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: 34,
    borderTopWidth: 1,
    borderColor: T.hairline,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: T.hairline,
  },
  modalTitle: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.text,
  },
  modalCancelBtn: {
    paddingVertical: 4,
    minWidth: 60,
  },
  modalCancelText: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    color: T.subText,
  },
  modalDoneBtn: {
    paddingVertical: 4,
    minWidth: 60,
    alignItems: 'flex-end',
  },
  modalDoneText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 16,
    color: T.accent,
  },

  pickerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 8,
  },
  pickerSeparator: {
    width: 24,
    alignItems: 'center',
  },
  pickerSeparatorText: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 28,
    color: T.subText,
  },
  pickerUnits: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingBottom: 8,
  },
  pickerUnitLabel: {
    flex: 1,
    textAlign: 'center',
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: T.faintText,
    letterSpacing: 11 * 0.12,
    textTransform: 'uppercase',
  },
}); }
