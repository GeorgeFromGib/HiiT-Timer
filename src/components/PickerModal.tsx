import React, { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import WheelColumn from './WheelColumn';
import type { EditSessionPicker, PickerValues } from '../hooks/useEditSession';
import { useTranslation } from '../lib/i18n';
import { pickerRange } from '../lib/speedUnit';

const MINUTE_LABELS   = Array.from({ length: 60 }, (_, i) => String(i));
const SECOND_LABELS   = Array.from({ length: 60 }, (_, i) => String(i).padStart(2, '0'));
const ROUND_LABELS    = Array.from({ length: 99 }, (_, i) => String(i + 1));
const KMH_WHOLE       = Array.from({ length: pickerRange('km').max + 1 }, (_, i) => String(i));
const MPH_WHOLE       = Array.from({ length: pickerRange('miles').max + 1 }, (_, i) => String(i));
const DECIMAL_LABELS  = Array.from({ length: 10 }, (_, i) => String(i));

const EMPTY_VALUES: PickerValues = { minutes: 0, seconds: 0, rounds: 0, speedWhole: 0, speedDecimal: 0 };

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
      setLocal({
        minutes:      picker.minutes,
        seconds:      picker.seconds,
        rounds:       picker.rounds,
        speedWhole:   picker.speedWhole,
        speedDecimal: picker.speedDecimal,
      });
    }
  // Re-initialize whenever the picker opens (null → non-null) or a different picker opens
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [picker !== null, picker?.title]);

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

          {picker?.isRounds ? (
            <>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{picker.roundsLabel ?? t('picker.rounds')}</Text>
              </View>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={ROUND_LABELS}
                  selected={local.rounds}
                  onChange={v => setLocal(prev => ({ ...prev, rounds: v }))}
                />
              </View>
            </>
          ) : picker?.isSpeed ? (
            <>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{picker.speedUnit === 'miles' ? 'mph' : 'km/h'}</Text>
                <View style={{ flex: 0, width: 24 }} />
                <Text style={styles.pickerUnitLabel}>{t('picker.dec')}</Text>
              </View>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={picker.speedUnit === 'miles' ? MPH_WHOLE : KMH_WHOLE}
                  selected={local.speedWhole}
                  onChange={v => setLocal(prev => ({ ...prev, speedWhole: v }))}
                />
                <View style={styles.pickerSeparator}>
                  <Text style={styles.pickerSeparatorText}>.</Text>
                </View>
                <WheelColumn
                  values={DECIMAL_LABELS}
                  selected={local.speedDecimal}
                  onChange={v => setLocal(prev => ({ ...prev, speedDecimal: v }))}
                />
              </View>
            </>
          ) : (
            <>
              <View style={styles.pickerUnits}>
                <Text style={styles.pickerUnitLabel}>{t('picker.min')}</Text>
                <View style={{ flex: 0, width: 24 }} />
                <Text style={styles.pickerUnitLabel}>{t('picker.sec')}</Text>
              </View>
              <View style={styles.pickerRow}>
                <WheelColumn
                  values={MINUTE_LABELS}
                  selected={local.minutes}
                  onChange={v => setLocal(prev => ({ ...prev, minutes: v }))}
                />
                <View style={styles.pickerSeparator}>
                  <Text style={styles.pickerSeparatorText}>:</Text>
                </View>
                <WheelColumn
                  values={SECOND_LABELS}
                  selected={local.seconds}
                  onChange={v => setLocal(prev => ({ ...prev, seconds: v }))}
                />
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
