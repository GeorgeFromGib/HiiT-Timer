import React, { useState } from 'react';
import {
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { loadSessions, saveSessions, newId, type Session, type Category, type Difficulty } from './sessions';
import { expandWorkout, PHASE_META, totalDuration } from './workout';

const T = {
  bgGradient: ['#0b1d26', '#0e2832'] as const,
  text:      '#eef6f7',
  subText:   'rgba(255,255,255,0.72)',
  faintText: 'rgba(255,255,255,0.44)',
  hairline:  'rgba(255,255,255,0.10)',
  ghostBg:   'rgba(255,255,255,0.05)',
  accent:    '#3ad6c6',
  btnGlyph:  '#06131a',
};

const DIFFICULTY_COLORS: Record<Difficulty, string> = {
  Easy:   '#5fd38a',
  Medium: '#ff8a3d',
  Hard:   '#ff5a5f',
};

const CATEGORIES: Category[]    = ['HIIT', 'Express', 'Steady'];
const DIFFICULTIES: Difficulty[] = ['Easy', 'Medium', 'Hard'];

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

interface Props {
  session?: Session;
  onBack: () => void;
}

export default function EditSessionScreen({ session: existing, onBack }: Props) {
  const isEditing = !!existing;

  const [name,       setName]       = useState(existing?.name                   ?? '');
  const [category,   setCategory]   = useState<Category>(existing?.category     ?? 'HIIT');
  const [difficulty, setDifficulty] = useState<Difficulty>(existing?.difficulty ?? 'Medium');
  const [warmup,     setWarmup]     = useState(String(existing?.config.warmup   ?? 30));
  const [work,       setWork]       = useState(String(existing?.config.high     ?? 30));
  const [rest,       setRest]       = useState(String(existing?.config.low      ?? 15));
  const [rounds,     setRounds]     = useState(String(existing?.config.rounds   ?? 4));
  const [cooldown,   setCooldown]   = useState(String(existing?.config.cooldown ?? 30));

  const toNum = (s: string, min = 0) => Math.max(min, parseInt(s, 10) || 0);

  const previewConfig = {
    warmup:   toNum(warmup),
    high:     toNum(work, 1),
    low:      toNum(rest),
    rounds:   toNum(rounds, 1),
    cooldown: toNum(cooldown),
  };
  const previewSegments = expandWorkout(previewConfig);
  const previewTotal    = totalDuration(previewSegments);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Name required', 'Please enter a session name.');
      return;
    }
    const sessions = await loadSessions();
    const updated: Session = {
      id: existing?.id ?? newId(),
      name: name.trim(),
      category,
      difficulty,
      config: previewConfig,
    };
    const next = isEditing
      ? sessions.map(s => (s.id === updated.id ? updated : s))
      : [...sessions, updated];
    await saveSessions(next);
    onBack();
  };

  const handleDelete = () => {
    if (!existing) return;
    Alert.alert('Delete Session', `Remove "${existing.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          const sessions = await loadSessions();
          await saveSessions(sessions.filter(s => s.id !== existing.id));
          onBack();
        },
      },
    ]);
  };

  const configFields = [
    { label: 'Warmup (s)',   value: warmup,   set: setWarmup   },
    { label: 'Work (s)',     value: work,     set: setWork     },
    { label: 'Rest (s)',     value: rest,     set: setRest     },
    { label: 'Rounds',       value: rounds,   set: setRounds   },
    { label: 'Cooldown (s)', value: cooldown, set: setCooldown },
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

          {/* Category */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.toggleRow}>
              {CATEGORIES.map(cat => {
                const active = category === cat;
                return (
                  <Pressable
                    key={cat}
                    onPress={() => setCategory(cat)}
                    style={[
                      styles.toggleBtn,
                      active
                        ? { backgroundColor: T.accent + '22', borderColor: T.accent }
                        : { backgroundColor: T.ghostBg, borderColor: T.hairline },
                    ]}
                  >
                    <Text style={[styles.toggleBtnText, { color: active ? T.accent : T.subText }]}>
                      {cat}
                    </Text>
                  </Pressable>
                );
              })}
            </View>
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

          {/* Timing config */}
          <View style={styles.fieldGroup}>
            <Text style={styles.fieldLabel}>TIMING</Text>
            <View style={styles.configGrid}>
              {configFields.map(({ label, value, set }) => (
                <View key={label} style={styles.configCell}>
                  <Text style={styles.configCellLabel}>{label}</Text>
                  <TextInput
                    style={styles.configInput}
                    value={value}
                    onChangeText={set}
                    keyboardType="numeric"
                    returnKeyType="done"
                    selectTextOnFocus
                  />
                </View>
              ))}
            </View>
          </View>

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
                          backgroundColor: PHASE_META[seg.phase].color + 'd9',
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
              {isEditing ? 'SAVE CHANGES' : 'CREATE SESSION'}
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
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
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
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 18,
    color: T.text,
    textAlign: 'center',
  },

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

  saveBtn: {
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 14,
    alignItems: 'center',
    shadowColor: '#3ad6c6',
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
});
