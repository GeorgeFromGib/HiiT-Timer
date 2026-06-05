import React, { useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { loadSessions, saveSessions, type Session, type Category } from './sessions';
import { Alert } from 'react-native';
import type { Route } from './navigation';
import { T } from './theme';
import SessionCard from './components/SessionCard';

const FILTER_TABS: Array<'All' | Category> = ['All', 'HIIT', 'Express', 'Steady'];

export default function SessionsListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [filter, setFilter]         = useState<'All' | Category>('All');

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

  emptyText: {
    fontFamily: 'Inter_700Bold',
    fontSize: 14,
    color: T.faintText,
    textAlign: 'center',
    marginTop: 48,
  },
});
