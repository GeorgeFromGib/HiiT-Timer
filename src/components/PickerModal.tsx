import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import WheelColumn from './WheelColumn';
import type { EditSessionPicker, PickerValues } from '../hooks/useEditSession';
import { useTranslation } from '../lib/i18n';

const EMPTY_VALUES: PickerValues = { selected: [] };

interface Props {
  picker:    EditSessionPicker | null;
  onDismiss: () => void;
  onCommit:  (values: PickerValues) => void;
}

export default function PickerModal({ picker, onDismiss, onCommit }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const [local, setLocal] = useState<PickerValues>(EMPTY_VALUES);

  useEffect(() => {
    if (picker) {
      setLocal({ selected: picker.selected });
    }
  // Re-initialize whenever the picker opens (null → non-null) or a different picker opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker !== null, picker?.title]);

  function setColumnValue(column: number, value: number) {
    setLocal(prev => {
      const next = [...prev.selected];
      next[column] = value;
      return { selected: next };
    });
  }

  return (
    <Modal
      visible={picker !== null}
      transparent
      animationType="slide"
      onRequestClose={onDismiss}
    >
      <View style={styles.modalOverlay}>
        <Pressable style={styles.modalDismiss} onPress={onDismiss} />
        <View style={styles.modalSheet}>
          <View style={styles.modalHeader}>
            <Pressable onPress={onDismiss} style={styles.modalCancelBtn}>
              <Text style={styles.modalCancelText}>{t('common.cancel')}</Text>
            </Pressable>
            <Text style={styles.modalTitle}>{picker?.title}</Text>
            <Pressable onPress={() => onCommit(local)} style={styles.modalDoneBtn}>
              <Text style={styles.modalDoneText}>{t('common.done')}</Text>
            </Pressable>
          </View>

          {picker && (
            <>
              <View style={styles.pickerUnits}>
                {picker.columns.map((col, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && picker.separator && <View style={{ flex: 0, width: 24 }} />}
                    <Text style={styles.pickerUnitLabel}>{col.unitLabel}</Text>
                  </React.Fragment>
                ))}
              </View>
              <View style={styles.pickerRow}>
                {picker.columns.map((col, i) => (
                  <React.Fragment key={i}>
                    {i > 0 && picker.separator && (
                      <View style={styles.pickerSeparator}>
                        <Text style={styles.pickerSeparatorText}>{picker.separator}</Text>
                      </View>
                    )}
                    <WheelColumn
                      values={col.values}
                      selected={local.selected[i] ?? 0}
                      onChange={v => setColumnValue(i, v)}
                    />
                  </React.Fragment>
                ))}
              </View>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    modalOverlay: {
      flex: 1,
      justifyContent: 'flex-end',
    },
    modalDismiss: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.5)',
    },
    modalSheet: {
      backgroundColor: T.sheetBg,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      paddingBottom: 34,
      borderTopWidth: 1,
      borderColor: T.hairline,
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingTop: 16,
      paddingBottom: 12,
      borderBottomWidth: StyleSheet.hairlineWidth,
      borderBottomColor: T.hairline,
    },
    modalTitle: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
    },
    modalCancelBtn: {
      paddingVertical: 4,
      minWidth: 60,
    },
    modalCancelText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 16,
      color: T.subText,
    },
    modalDoneBtn: {
      paddingVertical: 4,
      minWidth: 60,
      alignItems: 'flex-end',
    },
    modalDoneText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.accent,
    },
    pickerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingHorizontal: 20,
      paddingBottom: 8,
    },
    pickerSeparator: {
      width: 24,
      alignItems: 'center',
    },
    pickerSeparatorText: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 28,
      color: T.subText,
    },
    pickerUnits: {
      flexDirection: 'row',
      paddingHorizontal: 20,
      paddingTop: 8,
    },
    pickerUnitLabel: {
      flex: 1,
      textAlign: 'center',
      fontFamily: 'Inter_600SemiBold',
      fontSize: 11,
      color: T.faintText,
      letterSpacing: 11 * 0.12,
      textTransform: 'uppercase',
    },
  });
}
