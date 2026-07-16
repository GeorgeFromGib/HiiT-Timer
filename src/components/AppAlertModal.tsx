import React, { useMemo } from 'react';
import { Modal, StyleSheet, Text, Pressable, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { useAppAlert, dismissAppAlert, type AppAlertButton } from '../lib/appAlert';
import AppAlertIcon from './AppAlertIcon';

export default function AppAlertModal() {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const request = useAppAlert();

  if (!request) return null;

  const handlePress = (button: AppAlertButton) => {
    dismissAppAlert();
    button.onPress?.();
  };

  const stacked = request.buttons.length > 2;

  return (
    <Modal visible transparent animationType="fade" onRequestClose={dismissAppAlert}>
      <View style={styles.overlay}>
        <View style={styles.card}>
          <AppAlertIcon kind={request.kind} />
          <Text style={styles.title}>{request.title}</Text>
          {request.message ? <Text style={styles.message}>{request.message}</Text> : null}
          <View style={stacked ? styles.buttonsColumn : styles.buttonsRow}>
            {request.buttons.map((button, i) => (
              <Pressable
                key={`${button.text}-${i}`}
                style={[styles.button, stacked ? styles.buttonFullWidth : styles.buttonFlex, buttonBg(T, button.style)]}
                onPress={() => handlePress(button)}
              >
                <Text style={[styles.buttonText, buttonTextColor(T, button.style)]}>{button.text}</Text>
              </Pressable>
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

function buttonBg(T: ThemeTokens, style: AppAlertButton['style']) {
  if (style === 'destructive') return { backgroundColor: '#ef4444' };
  if (style === 'cancel') return { backgroundColor: T.faintText + '20' };
  return { backgroundColor: T.accent };
}

function buttonTextColor(T: ThemeTokens, style: AppAlertButton['style']) {
  if (style === 'cancel') return { color: T.subText };
  return { color: '#fff' };
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
      marginTop: 12,
      textAlign: 'center',
    },
    message: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
      marginTop: 8,
      textAlign: 'center',
      lineHeight: 18,
    },
    buttonsRow: {
      flexDirection: 'row',
      gap: 8,
      marginTop: 18,
      width: '100%',
    },
    buttonsColumn: {
      marginTop: 18,
      width: '100%',
      gap: 8,
    },
    button: {
      paddingVertical: 10,
      alignItems: 'center',
      borderRadius: 8,
    },
    buttonFlex: {
      flex: 1,
    },
    buttonFullWidth: {
      width: '100%',
    },
    buttonText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
    },
  });
}
