import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import WheelColumn from './WheelColumn';
import type { EditSessionPicker } from '../hooks/useEditSession';
import { useTranslation } from '../lib/i18n';

const MINUTE_LABELS   = Array.from({ length: 60 }, (_, i) => String(i));
const SECOND_LABELS   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ROUND_LABELS    = Array.from({ length: 99 }, (_, i) => String(i + 1));
const KMH_WHOLE       = Array.from({ length: 51 }, (_, i) => String(i));
const MPH_WHOLE       = Array.from({ length: 32 }, (_, i) => String(i));
const DECIMAL_LABELS  = Array.from({ length: 10 }, (_, i) => String(i));

interface Props {
  picker:    EditSessionPicker | null;
  onDismiss: () => void;
  onCommit:  () => void;
  onUpdate:  (partial: { minutes?: number; seconds?: number; rounds?: number; speedWhole?: number; speedDecimal?: number }) => void;
}

export default function PickerModal({ picker, onDismiss, onCommit, onUpdate }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

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
            <Pressable onPress={onCommit} style={styles.modalDoneBtn}>
              <Text style={styles.modalDoneText}>{t('common.done')}</Text>
            </Pressable>
          </View>

          {picker?.isRounds ? (
            <>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={ROUND_LABELS}
                  selected={picker.rounds}
                  onChange={v => onUpdate({ rounds: v })}
                />
              </View>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{picker.roundsLabel ?? t('picker.rounds')}</Text>
              </View>
            </>
          ) : picker?.isSpeed ? (
            <>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={picker.speedUnit === 'miles' ? MPH_WHOLE : KMH_WHOLE}
                  selected={picker.speedWhole}
                  onChange={v => onUpdate({ speedWhole: v })}
                />
                <View style={styles.pickerSeparator}>
                  <Text style={styles.pickerSeparatorText}>.</Text>
                </View>
                <WheelColumn
                  values={DECIMAL_LABELS}
                  selected={picker.speedDecimal}
                  onChange={v => onUpdate({ speedDecimal: v })}
                />
              </View>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{picker.speedUnit === 'miles' ? 'mph' : 'km/h'}</Text>
                <View style={{ flex: 0, width: 24 }} />
                <Text style={styles.pickerUnitLabel}>{t('picker.dec')}</Text>
              </View>
            </>
          ) : (
            <>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={MINUTE_LABELS}
                  selected={picker?.minutes ?? 0}
                  onChange={v => onUpdate({ minutes: v })}
                />
                <View style={styles.pickerSeparator}>
                  <Text style={styles.pickerSeparatorText}>:</Text>
                </View>
                <WheelColumn
                  values={SECOND_LABELS}
                  selected={picker?.seconds ?? 0}
                  onChange={v => onUpdate({ seconds: v })}
                />
              </View>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{t('picker.min')}</Text>
                <View style={{ flex: 0, width: 24 }} />
                <Text style={styles.pickerUnitLabel}>{t('picker.sec')}</Text>
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
      paddingTop: 8,
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
      paddingBottom: 8,
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
