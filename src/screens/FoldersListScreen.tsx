import React, { useMemo, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import {
  loadSessions,
  type Session,
  type SessionsData,
  type Folder,
} from '../lib/sessions';
import { useSettings } from '../lib/settingsContext';
import type { Route } from '../navigation';
import { useTheme, ghostBtnStyle, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import { useTranslation } from '../lib/i18n';

interface ExpandedState {
  [folderId: string]: boolean;
}

export default function FoldersListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [data, setData] = useState<SessionsData>({ folders: [], sessions: [] });
  const [expandedFolders, setExpandedFolders] = useState<ExpandedState>({ unfiled: true });

  useEffect(() => {
    loadSessions(settings.language).then(setData);
  }, [settings.language]);

  const sessionsInFolder = (folderId: string) => data.sessions.filter(s => s.folderId === folderId);
  const unfiledFolderId = data.folders.find(f => f.name === 'Unfiled')?.id;
  const unfiledSessions = unfiledFolderId
    ? sessionsInFolder(unfiledFolderId)
    : data.sessions.filter(s => !data.folders.some(f => f.id === s.folderId));

  const toggleFolder = (folderId: string) => {
    setExpandedFolders(prev => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 0.5, y: 0.6 }}
      style={styles.container}
    >
      <ScreenHeader
        title={t('folders.title')}
        subtitle={t('folders.organize')}
        left={<View style={{ width: 36 }} />}
        right={<View style={{ width: 36 }} />}
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Folders */}
        {data.folders.filter(f => f.name !== 'Unfiled').map((folder) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            sessions={sessionsInFolder(folder.id)}
            expanded={expandedFolders[folder.id] ?? false}
            onToggle={() => toggleFolder(folder.id)}
            theme={T}
          />
        ))}

        {/* Unfiled Sessions */}
        {unfiledFolderId && (
          <FolderRow
            folder={{ id: 'unfiled', name: t('folders.unfiledSessions'), createdAt: 0 }}
            sessions={unfiledSessions}
            expanded={expandedFolders.unfiled ?? true}
            onToggle={() => toggleFolder('unfiled')}
            isUnfiled
            theme={T}
          />
        )}
      </ScrollView>
    </LinearGradient>
  );
}

interface FolderRowProps {
  folder: Folder;
  sessions: Session[];
  expanded: boolean;
  onToggle: () => void;
  isUnfiled?: boolean;
  theme: ThemeTokens;
}

function FolderRow({
  folder,
  sessions,
  expanded,
  onToggle,
  isUnfiled,
  theme,
}: FolderRowProps) {
  const styles = useMemo(() => makeFolderRowStyles(theme, isUnfiled), [theme, isUnfiled]);

  return (
    <View style={styles.folderCard}>
      {/* Header Row */}
      <Pressable onPress={onToggle} style={styles.header}>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.sessionCount}>
          {sessions.length}
        </Text>
      </Pressable>

      {/* Expandable Body */}
      {expanded && (
        <View style={styles.body}>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions yet</Text>
          ) : (
            sessions.map(session => (
              <View key={session.id} style={styles.sessionItem}>
                <Text style={styles.sessionName}>{session.name}</Text>
              </View>
            ))
          )}
        </View>
      )}
    </View>
  );
}

const makeStyles = (T: ThemeTokens) =>
  StyleSheet.create({
    container: {
      flex: 1,
    },
    content: {
      flex: 1,
    },
    contentContainer: {
      paddingHorizontal: 20,
      paddingTop: 12,
      paddingBottom: 28,
    },
  });

const makeFolderRowStyles = (T: ThemeTokens, isUnfiled?: boolean) =>
  StyleSheet.create({
    folderCard: {
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: T.hairline,
      backgroundColor: isUnfiled ? 'transparent' : T.card,
      borderStyle: isUnfiled ? ('dashed' as any) : ('solid' as any),
      marginBottom: 10,
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 13,
      paddingHorizontal: 14,
    },
    folderName: {
      fontSize: 15,
      fontWeight: '800',
      color: isUnfiled ? T.subText : T.text,
    },
    sessionCount: {
      fontSize: 12,
      fontWeight: '700',
      color: T.faintText,
    },
    body: {
      paddingTop: 0,
      paddingHorizontal: 14,
      paddingBottom: 12,
      paddingLeft: 28,
      borderLeftWidth: 2,
      borderLeftColor: T.hairline,
      gap: 8,
    },
    sessionItem: {
      paddingVertical: 8,
      paddingHorizontal: 0,
    },
    sessionName: {
      fontSize: 13,
      fontWeight: '600',
      color: T.text,
    },
    emptyText: {
      fontSize: 12.5,
      color: T.faintText,
      fontStyle: 'italic',
      paddingVertical: 4,
    },
  });
