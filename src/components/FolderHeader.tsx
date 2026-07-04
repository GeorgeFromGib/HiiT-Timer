import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type ThemeTokens } from '../theme';

interface FolderHeaderProps {
  folder: { id: string; name: string };
  isExpanded: boolean;
  sessionCount: number;
  onToggleExpand: () => void;
  onRename: () => void;
  onDelete: () => void;
}

export default function FolderHeader({
  folder,
  isExpanded,
  sessionCount,
  onToggleExpand,
  onRename,
  onDelete,
}: FolderHeaderProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  const handleLongPress = () => {
    // Show action menu (rename/delete)
    // For now, use a simple approach: show delete confirmation
    // This will be wired to a menu in SessionsListScreen
  };

  return (
    <Pressable
      style={styles.container}
      onPress={onToggleExpand}
      onLongPress={handleLongPress}
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
      <View style={styles.actionButtons}>
        <Pressable onPress={onRename} hitSlop={8}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
            <Path
              d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
        <Pressable onPress={onDelete} hitSlop={8} style={styles.deleteBtn}>
          <Svg width={16} height={16} viewBox="0 0 24 24" fill="none">
            <Path
              d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"
              stroke={T.subText}
              strokeWidth={2}
              strokeLinecap="round"
            />
          </Svg>
        </Pressable>
      </View>
    </Pressable>
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
      borderRadius: 12,
      backgroundColor: T.card,
      marginVertical: 8,
      marginHorizontal: 0,
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
    actionButtons: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 12,
    },
    deleteBtn: {},
  });
}
