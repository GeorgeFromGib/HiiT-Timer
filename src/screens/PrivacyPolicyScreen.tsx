import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, type ThemeTokens } from '../theme';
import { useTranslation } from '../hooks/useTranslation';
import ScreenHeader from '../components/ScreenHeader';

export default function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const styles = useMemo(() => makeStyles(T), [T]);

  const POLICY_SECTIONS = [
    { heading: t('privacyPolicy.title'), body: t('privacyPolicy.lastUpdated') },
    { heading: null, body: t('privacyPolicy.section1') },
    { heading: null, body: t('privacyPolicy.section2') },
    { heading: null, body: t('privacyPolicy.section3') },
    { heading: null, body: t('privacyPolicy.section4') },
    { heading: null, body: t('privacyPolicy.section5') },
  ];

  return (
    <LinearGradient
      colors={T.bgGradient}
      start={{ x: 0, y: 1 }}
      end={{ x: 1, y: 0 }}
      style={styles.root}
    >
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader onBack={onBack} title={t('settings.privacyPolicy')} style={styles.header} />
        {POLICY_SECTIONS.map((section, i) => (
          <React.Fragment key={i}>
            {section.heading && (
              <Text style={styles.heading}>{section.heading}</Text>
            )}
            <Text style={styles.body}>{section.body}</Text>
          </React.Fragment>
        ))}
      </ScrollView>
    </LinearGradient>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    root: { flex: 1 },
    scroll: { flex: 1 },
    content: {
      paddingTop: 54,
      paddingHorizontal: 20,
      paddingBottom: 40,
    },
    header: { marginBottom: 28 },
    heading: {
      fontFamily: 'Inter_700Bold',
      fontSize: 16,
      color: T.text,
      marginBottom: 8,
    },
    body: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 14,
      color: T.subText,
      lineHeight: 22,
      marginBottom: 16,
    },
  });
}
