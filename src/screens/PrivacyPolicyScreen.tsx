import React, { useMemo } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme, type ThemeTokens } from '../theme';
import ScreenHeader from '../components/ScreenHeader';

const POLICY_SECTIONS = [
  {
    heading: 'Privacy Statement for ClearHiiT',
    body: 'Last updated: June 19, 2026',
  },
  {
    heading: null,
    body: 'ClearHiiT does not collect, store, or share any personal data.',
  },
  {
    heading: null,
    body: 'All app data — including your workout settings, timers, and preferences — is stored locally on your device and is never transmitted to us or to any third party. We do not use analytics, advertising, or tracking services of any kind.',
  },
  {
    heading: null,
    body: 'Since ClearHiiT does not collect any personal information, there is no data to access, delete, or transfer. If you delete the app, all locally stored data is removed from your device.',
  },
  {
    heading: null,
    body: 'ClearHiiT does not integrate with any third-party services that would receive your data.',
  },
  {
    heading: null,
    body: 'If you have any questions about this policy, please contact me at george.gaskin.gg@gmail.com.',
  },
];

export default function PrivacyPolicyScreen({ onBack }: { onBack: () => void }) {
  const { T } = useTheme();
  const styles = useMemo(() => makeStyles(T), [T]);

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
        <ScreenHeader onBack={onBack} title="Privacy Statement" style={styles.header} />
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
