import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { totalDuration, fmtDuration } from '../lib/workout';
import DragHandle from './DragHandle';
import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, withOpacity, buttonShadow, glowShadow, selectedBg, type ThemeTokens } from '../theme';
import PhaseStrip from './PhaseStrip';
import { useTranslation } from '../lib/i18n';



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
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const segments = useMemo(() => getSessionSegments(session), [session]);
  const total    = totalDuration(segments);

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, selected && styles.cardSelected, isActive && styles.cardActive]}
    >
      {onDrag && (
        <Pressable onLongPress={onDrag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
          <DragHandle color={T.subText} />
        </Pressable>
      )}

      <View style={styles.cardBody}>
        <View style={styles.topRow}>
          <View style={styles.left}>
            <Text style={styles.title}>{session.name}</Text>
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

        <PhaseStrip segments={segments} />

        <View style={styles.statsRow}>
          <Text style={styles.statValue}>{fmtDuration(total)}</Text>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{segments.length}</Text>
            <Text style={styles.statLabel}> {t('common.intervalsAbbr')}</Text>
          </View>
          <Text style={styles.modeLabel}>{session.activityType ?? 'generic'}</Text>
        </View>

        {selected && (
          <Pressable onPress={onStart} style={styles.startBtn}>
            <Text style={styles.startBtnText}>{t('sessions.select')}</Text>
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
      backgroundColor: selectedBg(T.accent),
      borderColor: T.accent,
      ...glowShadow(T),
    },
    cardActive: {
      borderColor: T.accent,
      backgroundColor: selectedBg(T.accent),
      ...glowShadow(T),
      shadowOpacity: 0.25,
      shadowRadius: 12,
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
      fontSize: 18,
      letterSpacing: 18 * -0.01,
      color: T.text,
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
    modeLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: T.subText,
      textTransform: 'capitalize',
      marginLeft: 'auto',
    },
    startBtn: {
      marginTop: 12,
      backgroundColor: T.accent,
      borderRadius: 14,
      paddingVertical: 12,
      alignItems: 'center',
      ...buttonShadow(T),
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
