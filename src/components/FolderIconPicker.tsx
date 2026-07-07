import React, { useMemo } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import type { FolderIconName } from '../lib/sessions';
import { FOLDER_ICON_GROUPS, resolveFolderIconColor } from '../lib/folderIcons';
import FolderIcon from './FolderIcon';

interface FolderIconPickerProps {
  value: FolderIconName;
  onChange: (icon: FolderIconName) => void;
}

export default function FolderIconPicker({ value, onChange }: FolderIconPickerProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  return (
    <ScrollView style={styles.scroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
      {FOLDER_ICON_GROUPS.map(group => (
        <View key={group.labelKey} style={styles.group}>
          <Text style={styles.groupLabel}>{t(group.labelKey)}</Text>
          <View style={styles.row}>
            {group.icons.map(icon => {
              const color = resolveFolderIconColor(T, icon);
              const selected = icon === value;
              return (
                <Pressable
                  key={icon}
                  onPress={() => onChange(icon)}
                  style={[
                    styles.swatch,
                    { backgroundColor: color + '1e', borderColor: selected ? color : T.hairline },
                  ]}
                >
                  <FolderIcon name={icon} color={color} size={20} />
                </Pressable>
              );
            })}
          </View>
        </View>
      ))}
    </ScrollView>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    scroll: {
      maxHeight: 240,
      marginBottom: 16,
    },
    group: {
      marginBottom: 12,
    },
    groupLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 10,
      letterSpacing: 0.6,
      textTransform: 'uppercase',
      color: T.faintText,
      marginBottom: 6,
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
