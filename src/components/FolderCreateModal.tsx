import React, { useMemo, useState } from 'react';
import {
  Modal,
  StyleSheet,
  Text,
  TextInput,
  Pressable,
  View,
  Alert,
} from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../lib/i18n';
import { validateFolderName, type Folder } from '../lib/sessions';

interface FolderCreateModalProps {
  visible: boolean;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (folderName: string) => void;
}

export default function FolderCreateModal({
  visible,
  allFolders,
  onDismiss,
  onSubmit,
}: FolderCreateModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <View style={styles.modalContent}>
          <Text style={styles.title}>{t('folders.createNew')}</Text>
          <TextInput
            style={styles.input}
            placeholder={t('folders.folderNamePlaceholder')}
            placeholderTextColor={T.faintText}
            value={name}
            onChangeText={setName}
            autoFocus
          />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onDismiss}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>{t('common.create')}</Text>
            </Pressable>
          </View>
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
      maxWidth: 320,
      backgroundColor: T.sheetBg,
      borderRadius: 16,
      padding: 20,
    },
    title: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 16,
    },
    input: {
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: T.text,
      marginBottom: 16,
    },
    buttonRow: {
      flexDirection: 'row',
      gap: 8,
    },
    cancelBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.faintText + '20',
    },
    cancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.subText,
    },
    submitBtn: {
      flex: 1,
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
      backgroundColor: T.accent,
    },
    submitText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: '#fff',
    },
  });
}
