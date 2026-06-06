import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { totalDuration, fmtDuration } from '../lib/workout';
import { getSessionSegments, DIFFICULTY_COLORS } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, type ThemeTokens } from '../theme';
import PhaseStrip from './PhaseStrip';



interface Props {
  session:     Session;
  selected:    boolean;
  onPress:     () => void;
  onLongPress: () => void;
  onEdit:      () => void;
  onStart:     () => void;
  onDrag?:     () => void;
  isActive?:   boolean;
}

export default function SessionCard({ session, selected, onPress, onLongPress, onEdit, onStart, onDrag, isActive }: Props) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const segments  = getSessionSegments(session);
  const total     = totalDuration(segments);
  const diffColor = DIFFICULTY_COLORS[session.difficulty] ?? T.accent;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, selected && styles.cardSelected, isActive && styles.cardActive]}
    >
      {onDrag && (
        <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
          <Svg width={14} height={14} viewBox="0 0 24 24" fill="none">
            <Path d="M8 6h.01M16 6h.01M8 12h.01M16 12h.01M8 18h.01M16 18h.01" stroke={T.faintText} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
      )}

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <View style={styles.left}>
            <Text style={styles.title}>{session.name}</Text>
            <View style={styles.pillRow}>
              <View style={[styles.pill, { backgroundColor: diffColor + '22', borderColor: diffColor + '44' }]}>
                <Text style={[styles.pillText, { color: diffColor }]}>{session.difficulty.toUpperCase()}</Text>
              </View>
            </View>
          </View>
          <Pressable onPress={onEdit} style={styles.editBtn} hitSlop={8}>
            <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
              <Path
                d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
                stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              />
              <Path
                d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
                stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        </View>

        <PhaseStrip session={session} />

        <View style={styles.statsRow}>
          <Text style={styles.statValue}>{fmtDuration(total)}</Text>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{segments.length}</Text>
            <Text style={styles.statLabel}> intervals</Text>
          </View>
        </View>

        {selected && (
          <Pressable onPress={onStart} style={styles.startBtn}>
            <Text style={styles.startBtnText}>SELECT</Text>
          </Pressable>
        )}
      </View>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    card: {
      flexDirection: 'row',
      borderRadius: 20,
      paddingVertical: 16,
      paddingLeft: 12,
      paddingRight: 16,
      paddingBottom: 14,
      backgroundColor: T.ghostBg,
      borderWidth: 1.5,
      borderColor: T.hairline,
    },
    cardSelected: {
      backgroundColor: T.accent + '14',
      borderColor: T.accent,
      shadowColor: T.accent,
      shadowOpacity: 0.2,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 0 },
      elevation: 4,
    },
    cardActive: {
      borderColor: T.accent,
      backgroundColor: T.accent + '14',
      shadowColor: T.accent,
      shadowOpacity: 0.25,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 0 },
      elevation: 6,
    },
    dragHandle: {
      alignSelf: 'stretch',
      alignItems: 'center',
      justifyContent: 'center',
      paddingRight: 10,
    },
    cardBody: {
      flex: 1,
    },
    topRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      justifyContent: 'space-between',
    },
    left: {
      flex: 1,
      gap: 6,
    },
    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 16,
      letterSpacing: 16 * -0.01,
      color: T.text,
    },
    pillRow: {
      flexDirection: 'row',
      gap: 6,
    },
    pill: {
      paddingVertical: 3,
      paddingHorizontal: 9,
      borderRadius: 999,
      borderWidth: 1,
    },
    pillText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 10.5,
      letterSpacing: 10.5 * 0.1,
    },
    editBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
      marginLeft: 8,
    },
    statsRow: {
      flexDirection: 'row',
      justifyContent: 'flex-start',
      alignItems: 'center',
      gap: 28,
      marginTop: 10,
    },
    statItem: {
      flexDirection: 'row',
      alignItems: 'center',
    },
    statValue: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 15,
      color: T.text,
    },
    statLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.faintText,
    },
    startBtn: {
      marginTop: 12,
      backgroundColor: T.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      shadowColor: T.accent,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.33,
      shadowRadius: 14,
      elevation: 6,
    },
    startBtnText: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 14,
      letterSpacing: 14 * 0.06,
      textTransform: 'uppercase',
      color: T.btnGlyph,
    },
  });
}
