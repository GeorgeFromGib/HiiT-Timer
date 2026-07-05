import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { useTheme, type ThemeTokens } from '../theme';

interface FolderHeaderProps {
  folder: { id: string; name: string };
  isExpanded: boolean;
  sessionCount: number;
  onToggleExpand: () => void;
}

export default function FolderHeader({
  folder,
  isExpanded,
  sessionCount,
  onToggleExpand,
}: FolderHeaderProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <Pressable
      style={styles.container}
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
  });
}
