import React, { useMemo, useState, useEffect } from 'react';
import {
  ScrollView,
  StyleSheet,
  Text,
  View,
  Pressable,
  TextInput,
  Alert,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Line } from 'react-native-svg';
import {
  loadSessions,
  saveSessions,
  createFolder,
  renameFolder,
  deleteFolder,
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

interface EditingState {
  folderId: string;
  name: string;
}

const FOLDER_COLORS = ['#46a6ff', '#ff8a3d', '#ff5a5f']; // rest, work, blast

export default function FoldersListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [data, setData] = useState<SessionsData>({ folders: [], sessions: [] });
  const [expandedFolders, setExpandedFolders] = useState<ExpandedState>({ unfiled: true });
  const [creating, setCreating] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [editingFolder, setEditingFolder] = useState<EditingState | null>(null);

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

  const handleCreateFolder = () => {
    const name = newFolderName.trim() || t('folders.newFolder');
    const newFolder = createFolder(name);
    const updatedData: SessionsData = {
      folders: [...data.folders, newFolder],
      sessions: data.sessions,
    };
    setData(updatedData);
    saveSessions(updatedData);
    setNewFolderName('');
    setCreating(false);
    setExpandedFolders(prev => ({ ...prev, [newFolder.id]: true }));
  };

  const handleRenameFolder = (folderId: string, newName: string) => {
    const trimmedName = newName.trim();
    if (!trimmedName) return;

    const result = renameFolder(folderId, trimmedName, data.folders);
    if (!result.success || !result.folders) {
      Alert.alert(t('folders.error'), result.error);
      return;
    }

    const updatedData: SessionsData = { folders: result.folders, sessions: data.sessions };
    setData(updatedData);
    saveSessions(updatedData);
    setEditingFolder(null);
  };

  const handleDeleteFolder = (folderId: string) => {
    Alert.alert(
      t('folders.deleteFolder'),
      t('folders.deleteFolderConfirm'),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('common.delete'),
          style: 'destructive',
          onPress: () => {
            const unfiledFolder = data.folders.find(f => f.name === 'Unfiled');
            const moveToFolderId = unfiledFolder?.id || null;

            try {
              const updatedData = deleteFolder(folderId, moveToFolderId, data);
              setData(updatedData);
              saveSessions(updatedData);
            } catch (e) {
              Alert.alert(t('folders.error'), (e as Error).message);
            }
          },
        },
      ]
    );
  };

  const handleRemoveSessionFromFolder = (folderId: string, sessionId: string) => {
    const unfiledFolder = data.folders.find(f => f.name === 'Unfiled');
    if (!unfiledFolder) return;

    const updatedSessions = data.sessions.map(s =>
      s.id === sessionId && s.folderId === folderId
        ? { ...s, folderId: unfiledFolder.id }
        : s
    );
    const updatedData: SessionsData = {
      folders: data.folders,
      sessions: updatedSessions,
    };
    setData(updatedData);
    saveSessions(updatedData);
  };

  const getFolderColor = (index: number) => {
    const colors = [...FOLDER_COLORS, T.accent];
    return colors[index % colors.length];
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
        onBack={() => onNavigate({ name: 'Sessions' })}
        left={
          <Pressable style={ghostBtnStyle(T)} onPress={() => onNavigate({ name: 'Settings' })}>
            <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
              <Path d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" stroke={T.subText} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
          </Pressable>
        }
        right={
          <Pressable style={ghostBtnStyle(T)} onPress={() => setCreating(true)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
        }
      />

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Create folder panel */}
        {creating && (
          <View style={styles.createPanel}>
            <Text style={styles.panelLabel}>{t('folders.newFolder')}</Text>
            <TextInput
              autoFocus
              value={newFolderName}
              onChangeText={setNewFolderName}
              placeholder={t('folders.folderNamePlaceholder')}
              placeholderTextColor={T.faintText}
              style={styles.input}
            />
            <View style={styles.panelButtons}>
              <Pressable
                style={styles.cancelBtn}
                onPress={() => {
                  setCreating(false);
                  setNewFolderName('');
                }}
              >
                <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
              </Pressable>
              <Pressable
                style={styles.createBtn}
                onPress={handleCreateFolder}
              >
                <Text style={styles.createBtnText}>{t('common.create')}</Text>
              </Pressable>
            </View>
          </View>
        )}

        {/* Folders */}
        {data.folders.filter(f => f.name !== 'Unfiled').map((folder, idx) => (
          <FolderRow
            key={folder.id}
            folder={folder}
            sessions={sessionsInFolder(folder.id)}
            expanded={expandedFolders[folder.id] ?? false}
            onToggle={() => toggleFolder(folder.id)}
            onRename={(newName) => handleRenameFolder(folder.id, newName)}
            onDelete={() => handleDeleteFolder(folder.id)}
            onRemoveSession={(sessionId) => handleRemoveSessionFromFolder(folder.id, sessionId)}
            color={getFolderColor(idx)}
            isEditing={editingFolder?.folderId === folder.id}
            editingName={editingFolder?.folderId === folder.id ? editingFolder.name : ''}
            onStartEdit={(name) => setEditingFolder({ folderId: folder.id, name })}
            onCancelEdit={() => setEditingFolder(null)}
            onCommitEdit={(name) => handleRenameFolder(folder.id, name)}
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
            color={T.faintText}
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
  onRename?: (newName: string) => void;
  onDelete?: () => void;
  onRemoveSession?: (sessionId: string) => void;
  onStartEdit?: (name: string) => void;
  onCancelEdit?: () => void;
  onCommitEdit?: (name: string) => void;
  color: string;
  isUnfiled?: boolean;
  isEditing?: boolean;
  editingName?: string;
  theme: ThemeTokens;
}

function FolderRow({
  folder,
  sessions,
  expanded,
  onToggle,
  onRename,
  onDelete,
  onRemoveSession,
  onStartEdit,
  onCancelEdit,
  onCommitEdit,
  color,
  isUnfiled,
  isEditing,
  editingName,
  theme,
}: FolderRowProps) {
  const [localEditName, setLocalEditName] = useState(editingName || folder.name);
  const styles = useMemo(() => makeFolderRowStyles(theme, color, isUnfiled), [theme, color, isUnfiled]);

  return (
    <View style={styles.folderCard}>
      {/* Header Row */}
      <View style={styles.header}>
        <Pressable onPress={onToggle} style={styles.chevronBtn}>
          <Chevron open={expanded} color={theme.faintText} />
        </Pressable>

        <View style={styles.iconBadge}>
          <FolderIcon color={isUnfiled ? theme.faintText : color} />
        </View>

        {isEditing ? (
          <TextInput
            autoFocus
            value={localEditName}
            onChangeText={setLocalEditName}
            onBlur={() => {
              if (onCommitEdit) onCommitEdit(localEditName);
            }}
            onSubmitEditing={() => {
              if (onCommitEdit) onCommitEdit(localEditName);
            }}
            style={styles.editInput}
          />
        ) : (
          <Pressable
            onPress={() => {
              if (!isUnfiled && onStartEdit) {
                onStartEdit(folder.name);
              }
            }}
            style={{ flex: 1 }}
          >
            <Text
              style={[
                styles.folderName,
                isUnfiled && styles.unfiledName,
              ]}
            >
              {folder.name}
            </Text>
          </Pressable>
        )}

        <Text style={styles.sessionCount}>
          {sessions.length} {sessions.length === 1 ? 'session' : 'sessions'}
        </Text>

        {!isUnfiled && (
          <Pressable onPress={onDelete} style={styles.deleteBtn}>
            <Svg width={12} height={12} viewBox="0 0 16 16" fill="none">
              <Path
                d="M3 4h10M6.5 4V2.8a1 1 0 0 1 1-1h1a1 1 0 0 1 1 1V4M4.5 4l.6 9a1 1 0 0 0 1 .9h3.8a1 1 0 0 0 1-.9l.6-9"
                stroke={theme.faintText}
                strokeWidth="1.6"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </Svg>
          </Pressable>
        )}
      </View>

      {/* Expandable Body */}
      {expanded && (
        <View style={styles.body}>
          {sessions.length === 0 ? (
            <Text style={styles.emptyText}>No sessions yet</Text>
          ) : (
            sessions.map(session => (
              <SessionRow
                key={session.id}
                session={session}
                isUnfiled={isUnfiled}
                onRemove={onRemoveSession}
                theme={theme}
              />
            ))
          )}
        </View>
      )}
    </View>
  );
}

interface SessionRowProps {
  session: Session;
  isUnfiled?: boolean;
  onRemove?: (sessionId: string) => void;
  theme: ThemeTokens;
}

function SessionRow({ session, isUnfiled, onRemove, theme }: SessionRowProps) {
  const styles = useMemo(() => makeSessionRowStyles(theme), [theme]);

  return (
    <View style={styles.sessionItem}>
      <View style={styles.sessionContent}>
        <Text style={styles.sessionName}>{session.name}</Text>
        <View style={styles.phaseStrip} />
      </View>
      {!isUnfiled && (
        <Pressable onPress={() => onRemove?.(session.id)} style={styles.removeBtn}>
          <Svg width={11} height={11} viewBox="0 0 12 12" fill="none">
            <Path
              d="M1 6h10"
              stroke={theme.faintText}
              strokeWidth="1.8"
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      )}
    </View>
  );
}

function FolderIcon({ color }: { color: string }) {
  return (
    <Svg width={17} height={17} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7z"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

function Chevron({ open, color }: { open: boolean; color: string }) {
  return (
    <Svg
      width={13}
      height={13}
      viewBox="0 0 16 16"
      fill="none"
      style={{
        transform: [{ rotate: open ? '90deg' : '0deg' }],
      }}
    >
      <Path
        d="M6 3l5 5-5 5"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

// Dashed border component for unfiled folders
function DashedBorder({ color, borderRadius }: { color: string; borderRadius: number }) {
  const dashSize = 4;
  const circumference = borderRadius * 2 * Math.PI;

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        borderRadius,
        borderWidth: 1.5,
        borderColor: color,
        borderStyle: 'dashed',
        pointerEvents: 'none',
      }}
    />
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
      paddingBottom: 28,
      gap: 10,
    },
    createPanel: {
      borderRadius: 16,
      borderWidth: 1.5,
      borderColor: `${T.accent}55`,
      backgroundColor: `${T.accent}0e`,
      padding: 14,
      gap: 10,
      marginTop: 12,
    },
    panelLabel: {
      fontSize: 11,
      fontWeight: '700',
      letterSpacing: 0.12,
      textTransform: 'uppercase',
      color: T.faintText,
    },
    input: {
      width: '100%',
      backgroundColor: T.card,
      borderWidth: 1.5,
      borderColor: T.hairline,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
      fontSize: 15,
      fontWeight: '700',
      color: T.text,
    },
    panelButtons: {
      flexDirection: 'row',
      gap: 8,
      justifyContent: 'flex-end',
    },
    cancelBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      borderWidth: 1,
      borderColor: T.hairline,
      backgroundColor: T.ghostBg,
    },
    cancelBtnText: {
      fontSize: 12.5,
      fontWeight: '700',
      color: T.subText,
    },
    createBtn: {
      paddingHorizontal: 16,
      paddingVertical: 8,
      borderRadius: 999,
      backgroundColor: T.accent,
    },
    createBtnText: {
      fontSize: 12.5,
      fontWeight: '800',
      color: T.btnGlyph,
    },
  });

const makeFolderRowStyles = (T: ThemeTokens, color: string, isUnfiled?: boolean) =>
  StyleSheet.create({
    folderCard: {
      borderRadius: 18,
      borderWidth: 1.5,
      borderColor: T.hairline,
      backgroundColor: isUnfiled ? 'transparent' : T.card,
      padding: 13,
      paddingHorizontal: 14,
      borderStyle: isUnfiled ? ('dashed' as any) : ('solid' as any),
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
    },
    chevronBtn: {
      padding: 4,
      marginLeft: -4,
    },
    iconBadge: {
      width: 30,
      height: 30,
      borderRadius: 9,
      backgroundColor: `${color}1e`,
      justifyContent: 'center',
      alignItems: 'center',
    },
    folderName: {
      fontSize: 15,
      fontWeight: '800',
      letterSpacing: -0.01,
      color: T.text,
    },
    unfiledName: {
      color: T.subText,
    },
    editInput: {
      flex: 1,
      backgroundColor: T.ghostBg,
      borderWidth: 1.5,
      borderColor: T.accent,
      borderRadius: 8,
      paddingHorizontal: 9,
      paddingVertical: 5,
      fontSize: 15,
      fontWeight: '800',
      color: T.text,
    },
    sessionCount: {
      fontSize: 11.5,
      fontWeight: '700',
      color: T.faintText,
    },
    deleteBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: T.hairline,
      backgroundColor: T.ghostBg,
      justifyContent: 'center',
      alignItems: 'center',
      marginLeft: 4,
    },
    body: {
      marginTop: 12,
      marginLeft: 14,
      paddingLeft: 14,
      borderLeftWidth: 2,
      borderLeftColor: T.hairline,
      gap: 8,
    },
    emptyText: {
      fontSize: 12.5,
      color: T.faintText,
      fontStyle: 'italic',
      paddingVertical: 4,
    },
  });

const makeSessionRowStyles = (T: ThemeTokens) =>
  StyleSheet.create({
    sessionItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 14,
      paddingHorizontal: 12,
      paddingVertical: 11,
    },
    sessionContent: {
      flex: 1,
      gap: 6,
    },
    sessionName: {
      fontSize: 14,
      fontWeight: '800',
      letterSpacing: -0.01,
      color: T.text,
    },
    phaseStrip: {
      height: 6,
      backgroundColor: T.hairline,
      borderRadius: 3,
    },
    removeBtn: {
      width: 26,
      height: 26,
      borderRadius: 13,
      borderWidth: 1,
      borderColor: T.hairline,
      backgroundColor: T.ghostBg,
      justifyContent: 'center',
      alignItems: 'center',
    },
  });
