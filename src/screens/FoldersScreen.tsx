import React, { useMemo, useState, useEffect } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, ghostBtnStyle, buttonShadow, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { useSettings } from '../lib/settingsContext';
import { useTranslation } from '../lib/i18n';
import { loadSessions } from '../lib/sessions';
import type { Route } from '../navigation';
import Svg, { Path } from 'react-native-svg';

export default function FoldersScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [folders, setFolders] = useState<any[]>([]);
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    loadSessions(settings.language).then(data => {
      setFolders(data.folders);
      const counts: Record<string, number> = {};
      data.folders.forEach(folder => {
        counts[folder.id] = data.sessions.filter(s => s.folderId === folder.id).length;
      });
      setSessionCounts(counts);
    });
  }, [settings.language]);

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <ScreenHeader
        title={t('folders.title')}
        style={styles.header}
        left={
          <Pressable style={ghostBtnStyle(T)} onPress={() => onNavigate({ name: 'Settings' })}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" fill="none" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        }
        right={
          <Pressable style={styles.addBtn} onPress={() => onNavigate({ name: 'Sessions' })}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
        }
      />

      <FlatList
        style={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        data={folders}
        keyExtractor={(folder) => folder.id}
        renderItem={({ item: folder }) => (
          <Pressable
            style={styles.folderCard}
            onPress={() => onNavigate({ name: 'Sessions', folderId: folder.id })}
          >
            <Text style={styles.folderName}>{folder.name}</Text>
            <Text style={styles.sessionCount}>
              {sessionCounts[folder.id] || 0} {t('common.intervals')}
            </Text>
          </Pressable>
        )}
      />
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1, paddingHorizontal: 20 },
    header: { paddingTop: 54, marginBottom: 28 },
    addBtn: {
      width: 36,
      height: 36,
      borderRadius: 18,
      backgroundColor: T.accent,
      alignItems: 'center',
      justifyContent: 'center',
      ...buttonShadow(T),
      shadowOffset: { width: 0, height: 6 },
      shadowRadius: 11,
    },
    list: { flex: 1 },
    listContent: {
      paddingHorizontal: 0,
      paddingTop: 0,
      paddingBottom: 28,
      gap: 8,
    },
    folderCard: {
      backgroundColor: T.card,
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: T.hairline,
      paddingVertical: 20,
      paddingHorizontal: 20,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
    },
    folderName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: T.text,
      flex: 1,
    },
    sessionCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
    },
  });
}
