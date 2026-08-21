import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, type ThemeTokens } from '../theme';
import { usePremium } from '../lib/premiumContext';
import { useTranslation } from '../hooks/useTranslation';

interface TrialStatusPillProps {
  onUpgrade: () => void;
}

export default function TrialStatusPill({ onUpgrade }: TrialStatusPillProps) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { isPremium, trialDaysRemaining } = usePremium();
  const styles = useMemo(() => makeStyles(T), [T]);
  const [expanded, setExpanded] = useState(false);

  if (isPremium) return null;

  if (trialDaysRemaining > 0) {
    return (
      <View style={styles.trialCard}>
        <Pressable style={styles.trialCardHeader} onPress={() => setExpanded(p => !p)}>
          <Text style={styles.trialChipText}>{t('sessions.trialActive')}</Text>
        </Pressable>
        {expanded && (
          <>
            <View style={styles.trialDivider} />
            <View style={styles.trialExpandedRow}>
              <Text style={styles.trialDaysText}>{t('sessions.trialBadge', { days: trialDaysRemaining })}</Text>
              <Pressable onPress={() => { setExpanded(false); onUpgrade(); }}>
                <Text style={styles.trialUpgradeBtn}>{t('sessions.trialUpgrade')}</Text>
              </Pressable>
            </View>
          </>
        )}
      </View>
    );
  }

  return (
    <Pressable style={styles.trialChip} onPress={onUpgrade}>
      <Text style={styles.trialChipText}>{t('sessions.trialExpiredBadge')}</Text>
    </Pressable>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    trialChip: {
      alignSelf: 'center',
      paddingHorizontal: 14,
      paddingVertical: 6,
      borderRadius: 20,
      borderWidth: 1,
      borderColor: T.accent,
      marginBottom: 14,
    },
    trialChipText: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 12,
      color: T.accent,
      letterSpacing: 0.2,
    },
    trialCard: {
      alignSelf: 'center',
      borderRadius: 14,
      borderWidth: 1,
      borderColor: T.accent,
      marginBottom: 14,
      minWidth: 140,
    },
    trialCardHeader: {
      paddingHorizontal: 14,
      paddingVertical: 6,
      alignItems: 'center',
    },
    trialDivider: {
      height: StyleSheet.hairlineWidth,
      backgroundColor: T.accent,
      opacity: 0.4,
    },
    trialExpandedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 14,
      paddingVertical: 8,
      gap: 16,
    },
    trialDaysText: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
      color: T.subText,
      letterSpacing: 0.2,
    },
    trialUpgradeBtn: {
      fontFamily: 'Inter_700Bold',
      fontSize: 12,
      color: T.accent,
      letterSpacing: 0.3,
    },
  });
}
