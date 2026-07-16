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
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <Text style={styles.title}>{t('folders.moveSessionTo')}</Text>
          <ScrollView style={styles.folderList} showsVerticalScrollIndicator={false}>
            {otherFolders.map(folder => (
              <Pressable
                key={folder.id}
                testID={`move-folder-${folder.id}`}
                style={styles.folderOption}
                onPress={() => handleSelectFolder(folder.id)}
              >
                <Text style={styles.folderName}>{folder.name}</Text>
              </Pressable>
            ))}
          </ScrollView>
          <Pressable style={styles.cancelBtn} onPress={onDismiss} testID="move-cancel">
            <Text style={styles.cancelBtnText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      justifyContent: 'center',
      alignItems: 'center',
    },
    card: {
      width: '85%',
      maxWidth: 340,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
      alignItems: 'center',
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      textAlign: 'center',
    },
    folderList: {
      alignSelf: 'stretch',
      maxHeight: 240,
      marginTop: 16,
    },
    folderOption: {
      paddingVertical: 14,
      paddingHorizontal: 8,
      borderBottomWidth: 1,
      borderBottomColor: T.hairline,
    },
    folderName: {
      fontFamily: 'Inter_500Medium',
      fontSize: 15,
      color: T.text,
      textAlign: 'center',
    },
    cancelBtn: {
      marginTop: 18,
      width: '100%',
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.faintText + '20',
    },
    cancelBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.subText,
    },
  });
}
