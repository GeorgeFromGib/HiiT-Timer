import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { usePremium } from '../lib/premiumContext';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function PaywallModal({ visible, onDismiss }: Props) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { purchase, loading } = usePremium();

  async function handlePurchase() {
    await purchase();
    onDismiss();
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onDismiss}
    >
      <Pressable style={styles.overlay} onPress={onDismiss}>
        <Pressable style={styles.card} onPress={e => e.stopPropagation()}>
          <Text style={styles.heading}>Trial Ended</Text>
          <Text style={styles.body}>
            Your 30-day free trial has ended. Purchase to keep using all features.
          </Text>
          <Pressable
            style={[styles.purchaseBtn, loading && styles.disabled]}
            onPress={handlePurchase}
            disabled={loading}
          >
            <Text style={styles.purchaseBtnText}>Purchase</Text>
          </Pressable>
          <Pressable
            style={[styles.dismissBtn, loading && styles.disabled]}
            onPress={onDismiss}
            disabled={loading}
          >
            <Text style={styles.dismissBtnText}>Not now</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    overlay: {
      flex: 1,
      backgroundColor: 'rgba(0,0,0,0.6)',
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: 32,
    },
    card: {
      backgroundColor: T.sheetBg,
      borderRadius: 20,
      padding: 28,
      width: '100%',
      borderWidth: 1,
      borderColor: T.hairline,
      alignItems: 'center',
    },
    heading: {
      fontFamily: 'Inter_700Bold',
      fontSize: 22,
      color: T.text,
      marginBottom: 12,
      textAlign: 'center',
    },
    body: {
      fontFamily: 'Inter_400Regular',
      fontSize: 15,
      color: T.subText,
      textAlign: 'center',
      lineHeight: 22,
      marginBottom: 28,
    },
    purchaseBtn: {
      backgroundColor: T.accent,
      borderRadius: 14,
      paddingVertical: 14,
      width: '100%',
      alignItems: 'center',
      marginBottom: 12,
    },
    purchaseBtnText: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.btnGlyph,
    },
    dismissBtn: {
      paddingVertical: 10,
      width: '100%',
      alignItems: 'center',
    },
    dismissBtnText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 15,
      color: T.subText,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}