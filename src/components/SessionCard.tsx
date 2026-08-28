import { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { totalDuration, fmtDuration } from '../lib/workout';
import DragHandle from './DragHandle';
import { getSessionSegments } from '../lib/sessions';
import type { Session } from '../lib/sessions';
import { useTheme, withOpacity, buttonShadow, glowShadow, selectedBg, type ThemeTokens } from '../theme';
import PhaseStrip from './PhaseStrip';
import { useTranslation } from '../hooks/useTranslation';
import ActivityTypeIcon from './ActivityTypeIcon';



interface Props {
  session:     Session;
  selected:    boolean;
  onPress:     () => void;
  onLongPress: () => void;
  onStart:     () => void;
  onDrag?:     () => void;
  isActive?:   boolean;
}

export default function SessionCard({ session, selected, onPress, onLongPress, onStart, onDrag, isActive }: Props) {
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
            <View style={styles.titleRow}>
              <ActivityTypeIcon
                activityType={session.mode !== 'circuit' ? session.activityType : undefined}
                mode={session.mode}
                tabata={session.mode === 'circuit' && !!session.tabata}
                size={20}
              />
              <Text style={styles.title}>{session.name}</Text>
            </View>
          </View>
        </View>

        <PhaseStrip segments={segments} />

        <View style={styles.statsRow}>
          <Text style={styles.statValue}>{fmtDuration(total)}</Text>
          <View style={styles.statItem}>
            <Text style={styles.statValue}>{segments.length}</Text>
            <Text style={styles.statLabel}> {t('common.intervalsAbbr')}</Text>
          </View>
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
    titleRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
    },
    title: {
      fontFamily: 'Inter_800ExtraBold',
      fontSize: 18,
      letterSpacing: 18 * -0.01,
      color: T.text,
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
