import React, { useMemo, useState, useEffect } from 'react';
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
import { validateFolderName, type Folder, type FolderIconName } from '../lib/sessions';
import { DEFAULT_FOLDER_ICON, resolveFolderIconColor, folderIconTint } from '../lib/folderIcons';
import FolderIcon from './FolderIcon';
import FolderIconPicker from './FolderIconPicker';

interface FolderRenameModalProps {
  visible: boolean;
  folder: Folder | null;
  allFolders: Folder[];
  onDismiss: () => void;
  onSubmit: (newName: string, icon: FolderIconName) => void;
}

export default function FolderRenameModal({
  visible,
  folder,
  allFolders,
  onDismiss,
  onSubmit,
}: FolderRenameModalProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [name, setName] = useState('');
  const [icon, setIcon] = useState<FolderIconName>(DEFAULT_FOLDER_ICON);
  const iconColor = resolveFolderIconColor(T, icon);

  useEffect(() => {
    if (visible && folder) {
      setName(folder.name);
      setIcon(folder.icon ?? DEFAULT_FOLDER_ICON);
    }
  }, [visible, folder]);

  const handleSubmit = () => {
    if (!validateFolderName(name, allFolders, folder?.id)) {
      Alert.alert(t('folders.invalidName'), t('folders.nameExists'));
      return;
    }
    onSubmit(name, icon);
    setName('');
  };

  return (
    <Modal visible={visible} transparent animationType="fade">
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.modalContent} onPress={() => {}}>
          <Text style={styles.title}>{t('folders.rename')}</Text>
          <View style={styles.nameRow}>
            <View style={[styles.iconBtn, { backgroundColor: folderIconTint(iconColor), borderColor: T.hairline }]}>
              <FolderIcon name={icon} color={iconColor} size={20} />
            </View>
            <TextInput
              style={styles.input}
              placeholder={t('folders.folderNamePlaceholder')}
              placeholderTextColor={T.faintText}
              value={name}
              onChangeText={setName}
              autoFocus
            />
          </View>
          <Text style={styles.sectionLabel}>{t('folders.icon')}</Text>
          <FolderIconPicker value={icon} onChange={setIcon} />
          <View style={styles.buttonRow}>
            <Pressable style={styles.cancelBtn} onPress={onDismiss}>
              <Text style={styles.cancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Pressable style={styles.submitBtn} onPress={handleSubmit}>
              <Text style={styles.submitText}>{t('common.save')}</Text>
            </Pressable>
          </View>
        </Pressable>
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
    nameRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 10,
      marginBottom: 16,
    },
    iconBtn: {
      width: 40,
      height: 40,
      borderRadius: 12,
      borderWidth: 2,
      alignItems: 'center',
      justifyContent: 'center',
    },
    input: {
      flex: 1,
      borderWidth: 1,
      borderColor: T.hairline,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 10,
      fontFamily: 'Inter_400Regular',
      fontSize: 14,
      color: T.text,
    },
    sectionLabel: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      letterSpacing: 0.4,
      textTransform: 'uppercase',
      color: T.subText,
      marginBottom: 8,
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
