import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, buttonShadow, type ThemeTokens } from '../theme';

interface FolderHeaderProps {
  folder: { id: string; name: string };
  isExpanded: boolean;
  sessionCount: number;
  onToggleExpand: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onAddSession: (layout: { y: number; height: number }) => void;
}

export default function FolderHeader({
  folder,
  isExpanded,
  sessionCount,
  onToggleExpand,
  onEdit,
  onDelete,
  onAddSession,
}: FolderHeaderProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <View style={styles.container}>
      <Pressable
        style={styles.expandArea}
        onPress={onToggleExpand}
      >
        <View style={styles.leftContent}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d={isExpanded ? 'M6 9l6 6 6-6' : 'M9 6l6 6-6 6'}
              stroke={T.text}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
          <Text style={styles.folderName}>{folder.name}</Text>
          <Text style={styles.sessionCount}>{sessionCount}</Text>
        </View>
      </Pressable>

      <View style={styles.buttonsContainer}>
        <Pressable
          style={styles.addSessionBtn}
          onLayout={(e) => {
            // Store layout for later use if needed
          }}
          onPress={(e) => {
            // Get the button's position and pass it to onAddSession
            e.currentTarget.measure((x, y, width, height, pageX, pageY) => {
              onAddSession({ y: pageY, height });
            });
          }}>
          <Svg width={18} height={18} viewBox="0 0 24 24" fill="none">
            <Path d="M12 5v14M5 12h14" stroke="#fff" strokeWidth={2.5} strokeLinecap="round" />
          </Svg>
        </Pressable>
        <Pressable style={styles.editBtn} onPress={onEdit} hitSlop={8}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path
              d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </Svg>
        </Pressable>
        <Pressable style={styles.deleteBtn} onPress={onDelete} hitSlop={8}>
          <Svg width={15} height={15} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <Path d="M10 11v6M14 11v6" stroke={T.subText} strokeWidth={2} strokeLinecap="round" />
          </Svg>
        </Pressable>
      </View>
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    container: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingVertical: 12,
      paddingHorizontal: 16,
    },
    expandArea: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
    },
    leftContent: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 8,
      flex: 1,
    },
    folderName: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.text,
    },
    sessionCount: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
    },
    buttonsContainer: {
      flexDirection: 'row',
      gap: 8,
      alignItems: 'center',
    },
    addSessionBtn: {
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
    editBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
    deleteBtn: {
      width: 34,
      height: 34,
      borderRadius: 17,
      backgroundColor: T.ghostBg,
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
