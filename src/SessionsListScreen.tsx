import React, { useState } from 'react';
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { loadSessions, saveSessions, type Session, type Category } from './sessions';
import { expandWorkout, PHASE_META, totalDuration } from './workout';
import type { Route } from './navigation';

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

const DIFFICULTY_COLORS: Record<string, string> = {
  Easy:   '#5fd38a',
  Medium: '#ff8a3d',
  Hard:   '#ff5a5f',
};

const FILTER_TABS: Array<'All' | Category> = ['All', 'HIIT', 'Express', 'Steady'];

function fmtDuration(s: number): string {
  const m = Math.floor(s / 60);
  const sec = s % 60;
  if (m === 0) return `${sec}s`;
  if (sec === 0) return `${m}m`;
  return `${m}m ${sec}s`;
}

function PhaseStrip({ session }: { session: Session }) {
  const segments = expandWorkout(session.config);
  const total = totalDuration(segments);
  if (total === 0) return null;
  return (
    <View style={styles.strip}>
      {segments.map((seg, i) => (
        <View
          key={i}
          style={[
            styles.stripSeg,
            {
              flex: seg.duration / total,
              backgroundColor: PHASE_META[seg.phase].color + 'd9',
            },
          ]}
        />
      ))}
    </View>
  );
}

function SessionCard({
  session,
  selected,
  onPress,
  onLongPress,
  onEdit,
  onStart,
}: {
  session: Session;
  selected: boolean;
  onPress: () => void;
  onLongPress: () => void;
  onEdit: () => void;
  onStart: () => void;
}) {
  const segments = expandWorkout(session.config);
  const total = totalDuration(segments);
  const diffColor = DIFFICULTY_COLORS[session.difficulty] ?? T.accent;

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      style={[styles.card, selected && styles.cardSelected]}
    >
      <View style={styles.cardTopRow}>
        <View style={styles.cardLeft}>
          <Text style={styles.cardTitle}>{session.name}</Text>
          <View style={styles.pillRow}>
            <View style={[styles.pill, { backgroundColor: T.accent + '22', borderColor: T.accent + '44' }]}>
              <Text style={[styles.pillText, { color: T.accent }]}>{session.category.toUpperCase()}</Text>
            </View>
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
        <View>
          <Text style={styles.statValue}>{fmtDuration(total)}</Text>
          <Text style={styles.statLabel}>total</Text>
        </View>
        <View>
          <Text style={styles.statValue}>{segments.length}</Text>
          <Text style={styles.statLabel}>intervals</Text>
        </View>
      </View>

      {selected && (
        <Pressable onPress={onStart} style={styles.startBtn}>
          <Text style={styles.startBtnText}>START SESSION</Text>
        </Pressable>
      )}
    </Pressable>
  );
}

export default function SessionsListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const [sessions, setSessions]   = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter]       = useState<'All' | Category>('All');

  // Load on mount
  React.useEffect(() => {
    loadSessions().then(setSessions);
  }, []);

  const visible = filter === 'All' ? sessions : sessions.filter(s => s.category === filter);

  const handleDelete = (session: Session) => {
    Alert.alert('Delete Session', `Remove "${session.name}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          const next = sessions.filter(s => s.id !== session.id);
          setSessions(next);
          saveSessions(next);
          if (selectedId === session.id) setSelectedId(null);
        },
      },
    ]);
  };

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <View style={styles.header}>
        <View>
          <Text style={styles.headerLabel}>CHOOSE</Text>
          <Text style={styles.headerTitle}>My Sessions</Text>
        </View>
        <Pressable
          style={styles.addBtn}
          onPress={() => onNavigate({ name: 'EditSession' })}
        >
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        {FILTER_TABS.map(tab => {
          const active = filter === tab;
          return (
            <Pressable
              key={tab}
              onPress={() => setFilter(tab)}
              style={[
                styles.filterTab,
                active
                  ? { backgroundColor: T.accent + '18', borderColor: T.accent }
                  : { backgroundColor: T.ghostBg, borderColor: T.hairline },
              ]}
            >
              <Text style={[styles.filterTabText, { color: active ? T.accent : T.subText }]}>
                {tab.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {visible.map(session => (
          <SessionCard
            key={session.id}
            session={session}
            selected={selectedId === session.id}
            onPress={() => setSelectedId(prev => prev === session.id ? null : session.id)}
            onLongPress={() => handleDelete(session)}
            onEdit={() => onNavigate({ name: 'EditSession', session })}
            onStart={() => onNavigate({ name: 'Workout', session })}
          />
        ))}
        {visible.length === 0 && (
          <Text style={styles.emptyText}>
            {sessions.length === 0
              ? 'No sessions yet. Tap + to add one.'
              : 'No sessions in this category.'}
          </Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    paddingTop: 54,
    paddingHorizontal: 20,
  },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
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
  addBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: T.accent,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: T.accent,
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.33,
    shadowRadius: 11,
    elevation: 6,
  },

  filterRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 18,
  },
  filterTab: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  filterTabText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 12,
    letterSpacing: 12 * 0.06,
  },

  list: { flex: 1 },
  listContent: {
    paddingBottom: 28,
    gap: 12,
  },

  card: {
    borderRadius: 20,
    padding: 16,
    paddingBottom: 14,
    backgroundColor: T.ghostBg,
    borderWidth: 1.5,
    borderColor: T.hairline,
  },
  cardSelected: {
    backgroundColor: '#3ad6c614',
    borderColor: '#3ad6c6',
    shadowColor: '#3ad6c6',
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    elevation: 4,
  },
  cardTopRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  cardLeft: {
    flex: 1,
    gap: 6,
  },
  cardTitle: {
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

  strip: {
    flexDirection: 'row',
    height: 9,
    borderRadius: 4,
    marginTop: 10,
    gap: 2,
  },
  stripSeg: {
    height: '100%',
    borderRadius: 4,
  },

  statsRow: {
    flexDirection: 'row',
    gap: 16,
    marginTop: 10,
  },
  statValue: {
    fontFamily: 'ChakraPetch_700Bold',
    fontSize: 14,
    color: T.text,
  },
  statLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 11,
    color: T.faintText,
    marginTop: 1,
  },

  startBtn: {
    marginTop: 12,
    backgroundColor: T.accent,
    borderRadius: 14,
    paddingVertical: 12,
    alignItems: 'center',
    shadowColor: '#3ad6c6',
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

  emptyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: T.faintText,
    textAlign: 'center',
    marginTop: 48,
  },
});
