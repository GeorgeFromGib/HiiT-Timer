import React, { useMemo } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  Pressable,
  View,
  ScrollView,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { type Folder } from '../lib/sessions';

interface DeleteFolderModalProps {
  visible: boolean;
  folder: Folder | null;
  sessionCount: number;
  otherFolders: Folder[];
  onDismiss: () => void;
  onDeleteWithMove: (moveToFolderId: string) => void;
  onDeleteAll: () => void;
}

export default function DeleteFolderModal({
  visible,
  folder,
  sessionCount,
  otherFolders,
  onDismiss,
  onDeleteWithMove,
  onDeleteAll,
}: DeleteFolderModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  if (!folder) return null;

  const isLastFolder = otherFolders.length === 0;

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('folders.deleteFolder')}</Text>

          {isLastFolder ? (
            <Text style={styles.message}>
              {t('folders.cannotDeleteLastFolder')}
            </Text>
          ) : (
            <>
              <Text style={styles.message}>
                {sessionCount > 0
                  ? t('folders.deleteWithSessions', { count: sessionCount })
                  : t('folders.deleteEmpty')}
              </Text>

              {sessionCount > 0 && otherFolders.length > 0 && (
                <>
                  <ScrollView style={styles.folderList}>
                    {otherFolders.map(f => (
                      <Pressable
                        key={f.id}
                        style={styles.folderOption}
                        onPress={() => onDeleteWithMove(f.id)}
                      >
                        <Text style={styles.folderOptionText}>{f.name}</Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                  <Pressable style={styles.deleteAllBtn} onPress={onDeleteAll}>
                    <Text style={styles.deleteAllText}>
                      {t('folders.deleteWithoutMove')}
                    </Text>
                  </Pressable>
                </>
              )}

              {sessionCount > 0 && otherFolders.length === 0 && (
                <Pressable style={styles.deleteAllBtn} onPress={onDeleteAll}>
                  <Text style={styles.deleteAllText}>
                    {t('common.delete')}
                  </Text>
                </Pressable>
              )}

              {sessionCount === 0 && (
                <Pressable style={styles.deleteAllBtn} onPress={onDeleteAll}>
                  <Text style={styles.deleteAllText}>
                    {t('common.delete')}
                  </Text>
                </Pressable>
              )}
            </>
          )}

          <Pressable style={styles.cancelBtn} onPress={onDismiss}>
            <Text style={styles.cancelText}>{t('common.cancel')}</Text>
          </Pressable>
        </View>
      </Pressable>
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
    modalContent: {
      width: '85%',
      maxWidth: 340,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
      maxHeight: '80%',
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 8,
    },
    message: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
      marginBottom: 16,
      lineHeight: 18,
    },
    folderList: {
      maxHeight: 150,
      marginBottom: 12,
    },
    folderOption: {
      paddingVertical: 10,
      paddingHorizontal: 12,
      borderRadius: 8,
      backgroundColor: T.card,
      marginBottom: 6,
    },
    folderOptionText: {
      fontFamily: 'Inter_500Medium',
      fontSize: 14,
      color: T.text,
    },
    deleteAllBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: '#ef4444',
      marginBottom: 8,
    },
    deleteAllText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
      color: '#fff',
    },
    cancelBtn: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.hairline,
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.text,
    },
  });
}
