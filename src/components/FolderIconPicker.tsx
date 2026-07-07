import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import type { FolderIconName } from '../lib/sessions';
import { FOLDER_ICON_GROUPS, resolveFolderIconColor, folderIconTint } from '../lib/folderIcons';
import FolderIcon from './FolderIcon';

interface FolderIconPickerProps {
  value: FolderIconName;
  onChange: (icon: FolderIconName) => void;
}

const ICONS: FolderIconName[] = FOLDER_ICON_GROUPS.flatMap(group => group.icons);

export default function FolderIconPicker({ value, onChange }: FolderIconPickerProps) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      <View style={styles.row}>
        {ICONS.map(icon => {
          const color = resolveFolderIconColor(T, icon);
          const selected = icon === value;
          return (
            <Pressable
              key={icon}
              onPress={() => onChange(icon)}
              style={[
                styles.swatch,
                { backgroundColor: folderIconTint(color), borderColor: selected ? color : T.hairline },
              ]}
            >
              <FolderIcon name={icon} color={color} size={20} />
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    scroll: {
      maxHeight: 240,
      marginBottom: 16,
    },
    row: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: 8,
    },
    swatch: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
