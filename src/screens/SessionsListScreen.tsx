import React, { useRef, useImperativeHandle, useMemo, useState, useEffect } from 'react';
import {
  Alert,
  Animated,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import {
  loadSessions,
  saveSessions,
  newId,
  createFolder,
  renameFolder,
  deleteFolder,
  moveSessionToFolder,
  type Session,
  type SessionsData,
  type Folder,
} from '../lib/sessions';
import { useGatedAction } from '../hooks/useGatedAction';
import { usePremium } from '../lib/premiumContext';
import PaywallModal from '../components/PaywallModal';
import { useSettings } from '../lib/settingsContext';
import { confirmDeleteSession } from '../lib/alerts';
import type { Route } from '../navigation';
import { useTheme, ghostBtnStyle, buttonShadow, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import SessionCard from '../components/SessionCard';
import ActivityTypeIcon from '../components/ActivityTypeIcon';
import FolderHeader from '../components/FolderHeader';
import FolderCreateModal from '../components/FolderCreateModal';
import FolderRenameModal from '../components/FolderRenameModal';
import DeleteFolderModal from '../components/DeleteFolderModal';
import MoveToFolderSheet from '../components/MoveToFolderSheet';
import { useTranslation } from '../lib/i18n';

export default function SessionsListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [data, setData] = useState<SessionsData>({ folders: [], sessions: [] });
  const [expandedFolderIds, setExpandedFolderIds] = useState<Set<string>>(new Set());
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const [trialExpanded, setTrialExpanded] = useState(false);

  // Folder modals — state, handlers, and rendering.
  const [showCreateFolderModal, setShowCreateFolderModal] = useState(false);
  const [showRenameFolderModal, setShowRenameFolderModal] = useState(false);
  const [renamingFolder, setRenamingFolder] = useState<Folder | null>(null);
  const [showDeleteFolderModal, setShowDeleteFolderModal] = useState(false);
  const [deletingFolder, setDeletingFolder] = useState<Folder | null>(null);
  const [showMoveSheet, setShowMoveSheet] = useState(false);
  const [movingSession, setMovingSession] = useState<Session | null>(null);

  const menuAnim = useRef(new Animated.Value(0)).current;

  // TODO(6b): settings.hideFolders is added to the Settings type in a later task.
  const shouldHideFolders =
    Boolean((settings as { hideFolders?: boolean }).hideFolders) && data.folders.length === 1;

  const sessionsInFolder = (folderId: string) => data.sessions.filter(s => s.folderId === folderId);

  useEffect(() => {
    if (showTypeMenu) {
      menuAnim.setValue(0);
      Animated.spring(menuAnim, {
        toValue: 1,
        useNativeDriver: true,
        damping: 18,
        stiffness: 280,
        mass: 0.8,
      }).start();
    }
  }, [showTypeMenu]);

  const { isPremium, trialDaysRemaining } = usePremium();
  const gate = useGatedAction(() => setShowPaywall(true));

  React.useEffect(() => {
    loadSessions(settings.language).then(setData);
  }, [settings.language]);

  const handleCreateSession = (activityType?: string) => {
    const defaultFolderId = data.folders[0]?.id || 'default';
    setShowTypeMenu(false);
    onNavigate({
      name: 'EditSession',
      activityType: activityType as any,
      folderId: defaultFolderId,
    });
  };

  const handleDuplicate = (session: Session) => {
    const idx = data.sessions.findIndex(s => s.id === session.id);
    const copy: Session = { ...session, id: newId(), name: t('sessions.copyOf', { name: session.name }) };
    const nextSessions = [...data.sessions.slice(0, idx + 1), copy, ...data.sessions.slice(idx + 1)];
    const next = { ...data, sessions: nextSessions };
    setData(next);
    saveSessions(next);
  };

  const handleDeleteSession = (session: Session, swipeable: { close: () => void }) => {
    confirmDeleteSession(
      session.name,
      async () => {
        swipeable.close();
        const newData = {
          ...data,
          sessions: data.sessions.filter(s => s.id !== session.id),
        };
        setData(newData);
        await saveSessions(newData);
        if (selectedSessionId === session.id) setSelectedSessionId(null);
      },
      () => swipeable.close(),
    );
  };

  const handleCreateFolder = (folderName: string) => {
    const folder = createFolder(folderName);
    const newData = {
      ...data,
      folders: [...data.folders, folder],
    };
    setData(newData);
    saveSessions(newData);
    setShowCreateFolderModal(false);
  };

  const handleRenameFolder = (newName: string) => {
    if (!renamingFolder) return;

    const result = renameFolder(renamingFolder.id, newName, data.folders);
    if (!result.success) {
      Alert.alert(t('folders.error'), result.error);
      return;
    }

    const newData = {
      ...data,
      folders: result.folders!,
    };
    setData(newData);
    saveSessions(newData);
    setShowRenameFolderModal(false);
    setRenamingFolder(null);
  };

  const handleDeleteFolder = (moveToFolderId: string | null) => {
    if (!deletingFolder) return;

    try {
      const newData = deleteFolder(deletingFolder.id, moveToFolderId, data);
      setData(newData);
      saveSessions(newData);
      setShowDeleteFolderModal(false);
      setDeletingFolder(null);
    } catch (e: any) {
      Alert.alert(t('folders.error'), e.message);
    }
  };

  const handleMoveSessionToFolder = (folderId: string) => {
    if (!movingSession) return;

    const newData = moveSessionToFolder(movingSession.id, folderId, data);
    setData(newData);
    saveSessions(newData);
    setShowMoveSheet(false);
    setMovingSession(null);
  };

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <ScreenHeader
        title={t('sessions.title')}
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
          <Pressable style={styles.addBtn} onPress={gate(() => {
            if (shouldHideFolders) {
              setShowTypeMenu(true);
            } else {
              setShowCreateFolderModal(true);
            }
          })}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
        }
      />

      {!isPremium && (
        trialDaysRemaining > 0 ? (
          <View style={styles.trialCard}>
            <Pressable style={styles.trialCardHeader} onPress={() => setTrialExpanded(p => !p)}>
              <Text style={styles.trialChipText}>{t('sessions.trialActive')}</Text>
            </Pressable>
            {trialExpanded && (
              <>
                <View style={styles.trialDivider} />
                <View style={styles.trialExpandedRow}>
                  <Text style={styles.trialDaysText}>{t('sessions.trialBadge', { days: trialDaysRemaining })}</Text>
                  <Pressable onPress={() => { setTrialExpanded(false); setShowPaywall(true); }}>
                    <Text style={styles.trialUpgradeBtn}>{t('sessions.trialUpgrade')}</Text>
                  </Pressable>
                </View>
              </>
            )}
          </View>
        ) : (
          <Pressable style={styles.trialChip} onPress={() => setShowPaywall(true)}>
            <Text style={styles.trialChipText}>{t('sessions.trialExpiredBadge')}</Text>
          </Pressable>
        )
      )}

      {!shouldHideFolders && data.folders.length > 0 ? (
        <ScrollView style={styles.list} contentContainerStyle={styles.listContent} showsVerticalScrollIndicator={false}>
          {data.folders.map(folder => {
            const isExpanded = expandedFolderIds.has(folder.id);
            const sessionsInThisFolder = sessionsInFolder(folder.id);

            return (
              <View key={folder.id}>
                <FolderHeader
                  folder={folder}
                  isExpanded={isExpanded}
                  sessionCount={sessionsInThisFolder.length}
                  onToggleExpand={() => {
                    const next = new Set(expandedFolderIds);
                    if (isExpanded) {
                      next.delete(folder.id);
                    } else {
                      next.add(folder.id);
                    }
                    setExpandedFolderIds(next);
                  }}
                  onRename={() => {
                    setRenamingFolder(folder);
                    setShowRenameFolderModal(true);
                  }}
                  onDelete={() => {
                    setDeletingFolder(folder);
                    setShowDeleteFolderModal(true);
                  }}
                />

                {isExpanded && sessionsInThisFolder.length > 0 && (
                  <View style={styles.sessionsList}>
                    {sessionsInThisFolder.map(session => (
                      <SessionSwipeRow
                        key={session.id}
                        session={session}
                        styles={styles}
                        drag={() => {}}
                        isActive={false}
                        selectedId={selectedSessionId}
                        onDuplicate={gate(() => handleDuplicate(session))}
                        onDelete={(swipeable) => handleDeleteSession(session, swipeable)}
                        onSelect={() => setSelectedSessionId(prev => prev === session.id ? null : session.id)}
                        onEdit={gate(() => onNavigate({ name: 'EditSession', session }))}
                        onStart={gate(() => onNavigate({ name: 'Workout', session }))}
                        onMove={() => {
                          setMovingSession(session);
                          setShowMoveSheet(true);
                        }}
                      />
                    ))}
                  </View>
                )}

                {isExpanded && sessionsInThisFolder.length === 0 && (
                  <Text style={styles.emptyFolderText}>{t('sessions.empty')}</Text>
                )}
              </View>
            );
          })}
        </ScrollView>
      ) : shouldHideFolders && data.sessions.length > 0 ? (
        <DraggableFlatList
          data={data.sessions.filter(s => s.folderId === data.folders[0]?.id)}
          keyExtractor={s => s.id}
          containerStyle={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          onDragEnd={({ data: reorderedSessions }) => {
            const next = {
              ...data,
              sessions: [
                ...data.sessions.filter(s => s.folderId !== data.folders[0]?.id),
                ...reorderedSessions,
              ],
            };
            setData(next);
            saveSessions(next);
          }}
          ListHeaderComponent={
            data.sessions.length > 0
              ? <Text style={styles.hintText}>{t('sessions.hint')}</Text>
              : null
          }
          ListEmptyComponent={<Text style={styles.emptyText}>{t('sessions.empty')}</Text>}
          renderItem={({ item: session, drag, isActive }: RenderItemParams<Session>) => (
            <SessionSwipeRow
              session={session}
              styles={styles}
              drag={drag}
              isActive={isActive}
              selectedId={selectedSessionId}
              onDuplicate={gate(() => handleDuplicate(session))}
              onDelete={(swipeable) => handleDeleteSession(session, swipeable)}
              onSelect={() => setSelectedSessionId(prev => prev === session.id ? null : session.id)}
              onEdit={gate(() => onNavigate({ name: 'EditSession', session }))}
              onStart={gate(() => onNavigate({ name: 'Workout', session }))}
              onMove={() => {
                setMovingSession(session);
                setShowMoveSheet(true);
              }}
            />
          )}
        />
      ) : (
        <Text style={styles.emptyText}>{t('sessions.empty')}</Text>
      )}
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />

      <FolderCreateModal
        visible={showCreateFolderModal}
        allFolders={data.folders}
        onDismiss={() => setShowCreateFolderModal(false)}
        onSubmit={handleCreateFolder}
      />

      <FolderRenameModal
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
        sessionCount={deletingFolder ? sessionsInFolder(deletingFolder.id).length : 0}
        otherFolders={deletingFolder ? data.folders.filter(f => f.id !== deletingFolder.id) : []}
        onDismiss={() => {
          setShowDeleteFolderModal(false);
          setDeletingFolder(null);
        }}
        onDeleteWithMove={handleDeleteFolder}
        onDeleteAll={() => handleDeleteFolder(null)}
      />

      <MoveToFolderSheet
        visible={showMoveSheet}
        session={movingSession}
        allFolders={data.folders}
        onDismiss={() => {
          setShowMoveSheet(false);
          setMovingSession(null);
        }}
        onSelectFolder={handleMoveSessionToFolder}
      />

      {showTypeMenu && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 9 }]}
            onPress={() => setShowTypeMenu(false)}
          />
          <Animated.View style={[styles.typeMenuWrapper, {
            opacity: menuAnim,
            transform: [
              { translateY: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [-10, 0] }) },
              { scale: menuAnim.interpolate({ inputRange: [0, 1], outputRange: [0.9, 1] }) },
            ],
          }]}>
          <View style={styles.typeMenu}>
            <View style={styles.typeMenuHeader}>
              <Text style={styles.typeMenuHeaderText}>{t('sessions.typeMenuHeader')}</Text>
            </View>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => handleCreateSession('general')}
            >
              <ActivityTypeIcon mode="easy" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.general')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => handleCreateSession('run')}
            >
              <ActivityTypeIcon mode="easy" activityType="run" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.run')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => handleCreateSession('circuit')}
            >
              <ActivityTypeIcon mode="circuit" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.circuit')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => handleCreateSession('spinning')}
            >
              <ActivityTypeIcon mode="easy" activityType="spinning" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.spinning')}</Text>
            </Pressable>
          </View>
          </Animated.View>
        </>
      )}
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

    header: { marginBottom: 20 },
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

    trialChip: {
      alignSelf: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: T.accent,
      marginBottom: 14,
    },
    trialChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.accent,
      letterSpacing: 0.2,
    },
    trialCard: {
      alignSelf: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: T.accent,
      marginBottom: 14,
      minWidth: 140,
    },
    trialCardHeader: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      alignItems: 'center',
    },
    trialDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: T.accent,
      opacity: 0.4,
    },
    trialExpandedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 16,
    },
    trialDaysText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: T.subText,
      letterSpacing: 0.2,
    },
    trialUpgradeBtn: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: T.accent,
      letterSpacing: 0.3,
    },

    list: { flex: 1 },
    listContent: {
      paddingBottom: 28,
      gap: 12,
    },

    sessionsList: {
      gap: 8,
      marginLeft: 16,
      marginRight: 16,
      marginBottom: 8,
    },
    emptyFolderText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: T.faintText,
      textAlign: 'center',
      paddingVertical: 12,
    },

    emptyText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
      color: T.faintText,
      textAlign: 'center',
      marginTop: 48,
    },

    hintText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: T.faintText,
      textAlign: 'center',
    },

    typeMenuWrapper: {
      position: 'absolute',
      top: 98,
      right: 20,
      borderRadius: 14,
      minWidth: 160,
      zIndex: 10,
      ...buttonShadow(T),
    },
    typeMenu: {
      backgroundColor: T.sheetBg,
      borderWidth: 1.5,
      borderColor: T.hairline,
      borderRadius: 14,
      overflow: 'hidden',
    },
    typeMenuHeader: {
      paddingVertical: 10,
      paddingHorizontal: 16,
    },
    typeMenuHeaderText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.faintText,
      textTransform: 'uppercase',
      letterSpacing: 0.8,
    },
    typeMenuRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 16,
    },
    typeMenuSeparator: {
      height: 1,
      backgroundColor: T.hairline,
      marginHorizontal: 12,
    },
    typeMenuText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 15,
      color: T.text,
    },

    swipeContainer: {
      borderRadius: 20,
    },
    swipeDuplicateAction: {
      backgroundColor: '#3b82f6',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 88,
      borderRadius: 20,
      marginRight: 8,
    },
    swipeDuplicateText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      letterSpacing: 0.5,
      color: '#fff',
    },
    swipeDeleteAction: {
      backgroundColor: '#ff5a5f',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 88,
      borderRadius: 20,
      marginLeft: 8,
    },
    swipeDeleteText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 13,
      letterSpacing: 0.5,
      color: '#fff',
    },
    rightActionsContainer: {
      flexDirection: 'row',
      gap: 0,
    },
    swipeMoveAction: {
      backgroundColor: '#8b5cf6',
      justifyContent: 'center',
      alignItems: 'center',
      gap: 4,
      width: 80,
      borderRadius: 20,
      marginRight: 8,
    },
    swipeMoveText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 11,
      letterSpacing: 0.3,
      color: '#fff',
    },
  });
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
    Animated.timing(opacity, { toValue: 0, duration: 150, useNativeDriver: true }).start(
      () => swipeable.close(),
    );
  };

  return (
    <Animated.View style={{ opacity, alignSelf: 'stretch' }}>
      <Pressable onPress={handlePress} style={[styles.swipeDuplicateAction, { flex: 1 }]}>
        <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
          <Path d="M8 4H6a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-2" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
          <Path d="M10 2h8a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-8a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2z" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        </Svg>
        <Text style={styles.swipeDuplicateText}>{t('common.duplicate')}</Text>
      </Pressable>
    </Animated.View>
  );
});

function SessionSwipeRow({
  session, styles, drag, isActive, selectedId,
  onDuplicate, onDelete, onSelect, onEdit, onStart, onMove,
}: {
  session:    Session;
  styles:     ReturnType<typeof makeStyles>;
  drag:       () => void;
  isActive:   boolean;
  selectedId: string | null;
  onDuplicate: () => void;
  onDelete:    (swipeable: { close: () => void }) => void;
  onSelect:    () => void;
  onEdit:      () => void;
  onStart:     () => void;
  onMove:      () => void;
}) {
  const { t } = useTranslation();
  const duplicateRef = useRef<{ reset: () => void } | null>(null);

  return (
    <ScaleDecorator>
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
            <Pressable onPress={() => { onMove(); swipeable.close(); }} style={styles.swipeMoveAction}>
              <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
                <Path d="M5 9l7-7 7 7M5 15l7 7 7-7" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              </Svg>
              <Text style={styles.swipeMoveText}>{t('common.move')}</Text>
            </Pressable>
            <Pressable onPress={() => onDelete(swipeable)} style={styles.swipeDeleteAction}>
              <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
                <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
                <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
              </Svg>
              <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
            </Pressable>
          </View>
        )}
      >
        <SessionCard
          session={session}
          selected={selectedId === session.id}
          isActive={isActive}
          onDrag={drag}
          onPress={onSelect}
          onLongPress={() => onDelete({ close: () => {} })}
          onEdit={onEdit}
          onStart={onStart}
        />
      </ReanimatedSwipeable>
    </ScaleDecorator>
  );
}
