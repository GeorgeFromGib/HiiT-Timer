import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import { loadSessions, saveSessions, type Session } from '../lib/sessions';
import { Alert } from 'react-native';
import type { Route } from '../navigation';
import { useTheme, type ThemeTokens } from '../theme';
import SessionCard from '../components/SessionCard';

export default function SessionsListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [sessions, setSessions]     = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  React.useEffect(() => {
    loadSessions().then(setSessions);
  }, []);

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
        <Pressable
          style={styles.ghostBtn}
          onPress={() => onNavigate({ name: 'Settings' })}
        >
          <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
            <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
            <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          </Svg>
        </Pressable>
        <View style={styles.headerCenter}>
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

      <ScrollView
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      >
        {sessions.map(session => (
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
        {sessions.length === 0 && (
          <Text style={styles.emptyText}>No sessions yet. Tap + to add one.</Text>
        )}
      </ScrollView>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
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
    headerCenter: {
      flex: 1,
      alignItems: 'center',
    },
    ghostBtn: {
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
}
