import React, { useMemo } from 'react';
import {
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
  Modal,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { type Folder } from '../lib/sessions';

interface MoveToFolderSheetProps {
  visible: boolean;
  session: { id: string; name: string; folderId: string } | null;
  allFolders: Folder[];
  onDismiss: () => void;
  onSelectFolder: (folderId: string) => void;
}

export default function MoveToFolderSheet({
  visible,
  session,
  allFolders,
  onDismiss,
  onSelectFolder,
}: MoveToFolderSheetProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const otherFolders = session
    ? allFolders.filter(f => f.id !== session.folderId)
    : allFolders;

  const handleSelectFolder = (folderId: string) => {
    onSelectFolder(folderId);
    onDismiss();
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.sheetContainer} onPress={e => e.stopPropagation()}>
          <View style={styles.header}>
            <Text style={styles.title}>{t('folders.moveSessionTo')}</Text>
            <Pressable onPress={onDismiss} hitSlop={8}>
              <Text style={styles.closeBtn}>✕</Text>
            </Pressable>
          </View>
          <ScrollView style={styles.folderList}>
            {otherFolders.map(folder => (
              <Pressable
                key={folder.id}
                style={styles.folderOption}
                onPress={() => handleSelectFolder(folder.id)}
              >
                <Text style={styles.folderName}>{folder.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.3)',
      justifyContent: 'flex-end',
    },
    sheetContainer: {
      backgroundColor: T.sheetBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      maxHeight: '70%',
    },
    header: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      paddingVertical: 16,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
    },
    closeBtn: {
      fontSize: 20,
      color: T.subText,
    },
    folderList: {
      paddingVertical: 8,
    },
    folderOption: {
      paddingVertical: 14,
      paddingHorizontal: 20,
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    folderName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: T.text,
    },
  });
}
