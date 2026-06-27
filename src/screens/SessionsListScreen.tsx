import React, { useRef, useImperativeHandle, useMemo, useState } from 'react';
import {
  Animated,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import DraggableFlatList, { ScaleDecorator, type RenderItemParams } from 'react-native-draggable-flatlist';
import ReanimatedSwipeable from 'react-native-gesture-handler/ReanimatedSwipeable';
import { loadSessions, saveSessions, deleteSessionById, newId, type Session } from '../lib/sessions';
import { useGatedAction } from '../hooks/useGatedAction';
import PaywallModal from '../components/PaywallModal';
import { useSettings } from '../lib/settingsContext';
import { confirmDeleteSession } from '../lib/alerts';
import type { Route } from '../navigation';
import { useTheme, ghostBtnStyle, buttonShadow, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';
import SessionCard from '../components/SessionCard';
import ActivityTypeIcon from '../components/ActivityTypeIcon';
import { useTranslation } from '../lib/i18n';

export default function SessionsListScreen({ onNavigate }: { onNavigate: (route: Route) => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [sessions, setSessions]     = useState<Session[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showTypeMenu, setShowTypeMenu] = useState(false);
  const gate = useGatedAction(() => setShowPaywall(true));

  React.useEffect(() => {
    loadSessions(settings.language).then(setSessions);
  }, [settings.language]);

  const handleDuplicate = (session: Session) => {
    const idx = sessions.findIndex(s => s.id === session.id);
    const copy: Session = { ...session, id: newId(), name: t('sessions.copyOf', { name: session.name }) };
    const next = [...sessions.slice(0, idx + 1), copy, ...sessions.slice(idx + 1)];
    setSessions(next);
    saveSessions(next);
  };

  const handleDelete = (session: Session, swipeable: { close: () => void }) => {
    confirmDeleteSession(
      session.name,
      async () => {
        swipeable.close();
        const next = await deleteSessionById(session.id);
        setSessions(next);
        if (selectedId === session.id) setSelectedId(null);
      },
      () => swipeable.close(),
    );
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
          <Pressable style={styles.addBtn} onPress={gate(() => setShowTypeMenu(true))}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M12 5v14M5 12h14" stroke={T.btnGlyph} strokeWidth={2.5} strokeLinecap="round" />
            </Svg>
          </Pressable>
        }
      />

      <DraggableFlatList
        data={sessions}
        keyExtractor={s => s.id}
        containerStyle={styles.list}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
        onDragEnd={({ data }) => {
          setSessions(data);
          saveSessions(data);
        }}
        ListHeaderComponent={
          sessions.length > 0
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
            selectedId={selectedId}
            onDuplicate={gate(() => handleDuplicate(session))}
            onDelete={(swipeable) => handleDelete(session, swipeable)}
            onSelect={() => setSelectedId(prev => prev === session.id ? null : session.id)}
            onEdit={gate(() => onNavigate({ name: 'EditSession', session }))}
            onStart={gate(() => onNavigate({ name: 'Workout', session }))}
          />
        )}
      />
      <PaywallModal visible={showPaywall} onDismiss={() => setShowPaywall(false)} />

      {showTypeMenu && (
        <>
          <Pressable
            style={[StyleSheet.absoluteFill, { zIndex: 9 }]}
            onPress={() => setShowTypeMenu(false)}
          />
          <View style={styles.typeMenu}>
            <View style={styles.typeMenuHeader}>
              <Text style={styles.typeMenuHeaderText}>{t('sessions.typeMenuHeader')}</Text>
            </View>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'general' }); }}
            >
              <ActivityTypeIcon mode="easy" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.general')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'run' }); }}
            >
              <ActivityTypeIcon mode="easy" activityType="run" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.run')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'circuit' }); }}
            >
              <ActivityTypeIcon mode="circuit" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.circuit')}</Text>
            </Pressable>
            <View style={styles.typeMenuSeparator} />
            <Pressable
              style={styles.typeMenuRow}
              onPress={() => { setShowTypeMenu(false); onNavigate({ name: 'EditSession', activityType: 'spinning' }); }}
            >
              <ActivityTypeIcon mode="easy" activityType="spinning" size={18} />
              <Text style={styles.typeMenuText}>{t('edit.spinning')}</Text>
            </Pressable>
          </View>
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

    hintText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 11,
      color: T.faintText,
      textAlign: 'center',
    },

    typeMenu: {
      position: 'absolute',
      top: 98,
      right: 20,
      backgroundColor: T.sheetBg,
      borderWidth: 1.5,
      borderColor: T.hairline,
      borderRadius: 14,
      minWidth: 160,
      zIndex: 10,
      overflow: 'hidden',
      ...buttonShadow(T),
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
  onDuplicate, onDelete, onSelect, onEdit, onStart,
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
          <Pressable onPress={() => onDelete(swipeable)} style={styles.swipeDeleteAction}>
            <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
              <Path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6" stroke="#fff" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
              <Path d="M10 11v6M14 11v6" stroke="#fff" strokeWidth={2} strokeLinecap="round" />
            </Svg>
            <Text style={styles.swipeDeleteText}>{t('common.delete')}</Text>
          </Pressable>
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
