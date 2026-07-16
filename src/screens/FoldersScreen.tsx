import React, { useMemo, useState, useEffect, useRef, useImperativeHandle } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import { useTheme, ghostBtnStyle, buttonShadow, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import DragHandle from '../components/DragHandle';
import { useSettings } from '../lib/settingsContext';
import { useTranslation } from '../lib/i18n';
import { appAlert } from '../lib/appAlert';
import {
  loadSessions,
  saveSessions,
  createFolder,
  renameFolder,
  deleteFolder,
  newId,
  type SessionsData,
  type Folder,
  type FolderIconName,
} from '../lib/sessions';
import { DEFAULT_FOLDER_ICON, resolveFolderIconColor, folderIconTint } from '../lib/folderIcons';
import FolderIcon from '../components/FolderIcon';
import FolderEditModal from '../components/FolderEditModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
import PaywallModal from '../components/PaywallModal';
import TrialStatusPill from '../components/TrialStatusPill';
import type { Route } from '../navigation';
import Svg, { Path } from 'react-native-svg';

export default function FoldersScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [data, setData] = useState<SessionsData>({ folders: [], sessions: [] });
  const [sessionCounts, setSessionCounts] = useState<Record<string, number>>({});
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  useEffect(() => {
    loadSessions(settings.language).then(loadedData => {
      setData(loadedData);
      const counts: Record<string, number> = {};
      loadedData.folders.forEach(folder => {
        counts[folder.id] = loadedData.sessions.filter(s => s.folderId === folder.id).length;
      });
      setSessionCounts(counts);
    });
  }, [settings.language]);

  const handleCreateFolder = (folderName: string, icon: FolderIconName) => {
    const folder = createFolder(folderName, icon);
    const newData = { ...data, folders: [...data.folders, folder] };
    setData(newData);
    setSessionCounts(prev => ({ ...prev, [folder.id]: 0 }));
    saveSessions(newData);
    setShowCreateFolderModal(false);
  };

  const handleRenameFolder = (newName: string, icon: FolderIconName) => {
    if (!renamingFolder) return;

    const result = renameFolder(renamingFolder.id, newName, icon, data.folders);
    if (!result.success) {
      appAlert('error', t('folders.error'), result.error);
      return;
    }

    const newData = { ...data, folders: result.folders! };
    setData(newData);
    saveSessions(newData);
    setShowRenameFolderModal(false);
    setRenamingFolder(null);
  };

  const handleDuplicateFolder = (folder: Folder) => {
    const idx = data.folders.findIndex(f => f.id === folder.id);
    const newFolder: Folder = {
      id: newId(),
      name: t('sessions.copyOf', { name: folder.name }),
      createdAt: Date.now(),
      icon: folder.icon ?? DEFAULT_FOLDER_ICON,
    };
    const duplicatedSessions = data.sessions
      .filter(s => s.folderId === folder.id)
      .map(s => ({ ...s, id: newId(), folderId: newFolder.id }));

    const newData = {
      folders: [...data.folders.slice(0, idx + 1), newFolder, ...data.folders.slice(idx + 1)],
      sessions: [...data.sessions, ...duplicatedSessions],
    };
    setData(newData);
    setSessionCounts(prev => ({ ...prev, [newFolder.id]: duplicatedSessions.length }));
    saveSessions(newData);
  };

  const handleDeleteFolder = (moveToFolderId: string | null) => {
    if (!deletingFolder) return;

    try {
      const newData = deleteFolder(deletingFolder.id, moveToFolderId, data);
      setData(newData);
      const counts: Record<string, number> = {};
      newData.folders.forEach(folder => {
        counts[folder.id] = newData.sessions.filter(s => s.folderId === folder.id).length;
      });
      setSessionCounts(counts);
      saveSessions(newData);
      setShowDeleteFolderModal(false);
      setDeletingFolder(null);
    } catch (e: any) {
      appAlert('error', t('folders.error'), e.message);
    }
  };

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
          <Pressable style={styles.addBtn} onPress={() => setShowCreateFolderModal(true)}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
        }
      />

      <TrialStatusPill onUpgrade={() => setShowPaywall(true)} />

      <DraggableFlatList
        data={data.folders}
        keyExtractor={(folder) => folder.id}
        containerStyle={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onDragEnd={({ data: reorderedFolders }) => {
          const newData = { ...data, folders: reorderedFolders };
          setData(newData);
          saveSessions(newData);
        }}
        ListHeaderComponent={
          data.folders.length > 0
            ? <Text style={styles.hintText}>{t('folders.hint')}</Text>
            : null
        }
        renderItem={({ item: folder, drag, isActive }: RenderItemParams<Folder>) => (
          <ScaleDecorator>
            <FolderSwipeRow
              folder={folder}
              sessionCount={sessionCounts[folder.id] || 0}
              styles={styles}
              drag={drag}
              isActive={isActive}
              onPress={() => onNavigate({ name: 'Sessions', folderId: folder.id })}
              onDuplicate={() => handleDuplicateFolder(folder)}
              onRename={() => {
                setRenamingFolder(folder);
                setShowRenameFolderModal(true);
              }}
              onDelete={() => {
                setDeletingFolder(folder);
                setShowDeleteFolderModal(true);
              }}
            />
          </ScaleDecorator>
        )}
      />

      <FolderEditModal
        visible={showCreateFolderModal}
        folder={null}
        allFolders={data.folders}
        onDismiss={() => setShowCreateFolderModal(false)}
        onSubmit={handleCreateFolder}
      />

      <FolderEditModal
        visible={showRenameFolderModal}
        folder={renamingFolder}
        allFolders={data.folders}
        onDismiss={() => {
          setShowRenameFolderModal(false);
          setRenamingFolder(null);
        }}
        onSubmit={handleRenameFolder}
      />

      <DeleteFolderModal
        visible={showDeleteFolderModal}
        folder={deletingFolder}
        sessionCount={deletingFolder ? sessionCounts[deletingFolder.id] || 0 : 0}
        otherFolders={deletingFolder ? data.folders.filter(f => f.id !== deletingFolder.id) : []}
        onDismiss={() => {
          setShowDeleteFolderModal(false);
          setDeletingFolder(null);
        }}
        onDeleteWithMove={handleDeleteFolder}
        onDeleteAll={() => handleDeleteFolder(null)}
      />

      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />
    </LinearGradient>
  );
}

const SwipeDuplicateAction = React.forwardRef<
  { reset: () => void },
  { styles: ReturnType<typeof makeStyles>; onDuplicate: () => void; swipeable: { close: () => void } }
>(function SwipeDuplicateAction({ styles, onDuplicate, swipeable }, ref) {
  const { t } = useTranslation();
  const opacity = useRef(new Animated.Value(1)).current;

  useImperativeHandle(ref, () => ({ reset: () => opacity.setValue(1) }));

  const handlePress = () => {
    onDuplicate();
    swipeable.close();
  };

  return (
    <Animated.View style={{ opacity, alignSelf: 'stretch' }}>
      <Pressable onPress={handlePress} style={[styles.swipeDuplicateAction, { flex: 1 }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke={styles.swipeDuplicateText.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke={styles.swipeDuplicateText.color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.swipeDuplicateText}>{t('common.duplicate')}</Text>
      </Pressable>
    </Animated.View>
  );
});

function FolderSwipeRow({
  folder, sessionCount, styles, drag, isActive, onPress, onDuplicate, onRename, onDelete,
}: {
  folder: Folder;
  sessionCount: number;
  styles: ReturnType<typeof makeStyles>;
  drag: () => void;
  isActive: boolean;
  onPress: () => void;
  onDuplicate: () => void;
  onRename: () => void;
  onDelete: () => void;
}) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const duplicateRef = useRef<{ reset: () => void } | null>(null);
  const iconName = folder.icon ?? DEFAULT_FOLDER_ICON;
  const iconColor = resolveFolderIconColor(T, iconName);

  return (
    <ReanimatedSwipeable
      containerStyle={styles.swipeContainer}
      onSwipeableClose={() => duplicateRef.current?.reset()}
      renderLeftActions={(_p, _d, swipeable) => (
        <SwipeDuplicateAction
          ref={duplicateRef}
          styles={styles}
          onDuplicate={onDuplicate}
          swipeable={swipeable}
        />
      )}
      renderRightActions={(_p, _d, swipeable) => (
        <View style={styles.rightActionsContainer}>
          <Pressable onPress={() => { onDelete(); swipeable.close(); }} style={styles.swipeDeleteAction}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
          </Pressable>
          <Pressable onPress={() => { onRename(); swipeable.close(); }} style={styles.swipeEditAction}>
            <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
              <Path d="M12 20h9M16.5 3.5a2.12 2.12 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
            </Svg>
            <Text style={styles.swipeEditText}>{t('common.edit')}</Text>
          </Pressable>
        </View>
      )}
    >
      <Pressable
        style={[styles.folderCard, isActive && styles.folderCardActive]}
        onPress={onPress}
      >
        <Pressable onLongPress={drag} delayLongPress={150} style={styles.dragHandle} hitSlop={8}>
          <DragHandle color={T.subText} />
        </Pressable>
        <View style={[styles.folderIconChip, { backgroundColor: folderIconTint(iconColor) }]}>
          <FolderIcon name={iconName} color={iconColor} size={17} />
        </View>
        <Text style={styles.folderName}>{folder.name}</Text>
        <Text style={styles.sessionCount}>
          {sessionCount} {t('common.intervalsAbbr')}
        </Text>
      </Pressable>
    </ReanimatedSwipeable>
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
    folderCardActive: {
      borderColor: T.accent,
    },
    dragHandle: {
      paddingRight: 8,
    },
    folderIconChip: {
      width: 30,
      height: 30,
      borderRadius: 9,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 8,
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
    hintText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: T.faintText,
      textAlign: 'center',
      marginBottom: 8,
    },
    swipeContainer: {
      borderRadius: 18,
    },
    swipeDuplicateAction: {
      backgroundColor: 'transparent',
      borderWidth: 1.5,
      borderColor: '#3b82f6',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 88,
      borderRadius: 18,
      marginRight: 8,
    },
    swipeDuplicateText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      letterSpacing: 0.5,
      color: '#3b82f6',
    },
    rightActionsContainer: {
      flexDirection: 'row',
      gap: 0,
    },
    swipeEditAction: {
      backgroundColor: '#3b82f6',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 80,
      borderRadius: 18,
    },
    swipeEditText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 0.3,
      color: '#fff',
    },
    swipeDeleteAction: {
      backgroundColor: '#ff5a5f',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 88,
      borderRadius: 18,
    },
    swipeDeleteText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      letterSpacing: 0.5,
      color: '#fff',
    },
  });
}
