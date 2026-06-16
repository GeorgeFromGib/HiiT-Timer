import React, { useMemo } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { usePremium } from '../lib/premiumContext';
import { useTranslation } from '../lib/i18n';

interface Props {
  visible: boolean;
  onDismiss: () => void;
}

export default function PaywallModal({ visible, onDismiss }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);
  const { purchase, restore, loading } = usePremium();

  async function handlePurchase() {
    await purchase();
    onDismiss();
  }

  async function handleRestore() {
    await restore();
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
          <Text style={styles.heading}>{t('paywall.title')}</Text>
          <Text style={styles.body}>{t('paywall.body')}</Text>
          <Pressable
            style={[styles.purchaseBtn, loading && styles.disabled]}
            onPress={handlePurchase}
            disabled={loading}
          >
            <Text style={styles.purchaseBtnText}>{t('paywall.purchase')}</Text>
          </Pressable>
          <Pressable
            style={[styles.dismissBtn, loading && styles.disabled]}
            onPress={onDismiss}
            disabled={loading}
          >
            <Text style={styles.dismissBtnText}>{t('paywall.notNow')}</Text>
          </Pressable>
          <Pressable
            style={[styles.restoreBtn, loading && styles.disabled]}
            onPress={handleRestore}
            disabled={loading}
          >
            <Text style={styles.restoreBtnText}>{t('paywall.restore')}</Text>
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
    restoreBtn: {
      paddingVertical: 8,
      width: '100%',
      alignItems: 'center',
    },
    restoreBtnText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 13,
      color: T.subText,
    },
    disabled: {
      opacity: 0.5,
    },
  });
}