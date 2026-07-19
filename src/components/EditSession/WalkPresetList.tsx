import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useTheme, selectedBg, type ThemeTokens } from '../../theme';
import { useTranslation } from '../../lib/i18n';
import { useSettings } from '../../lib/settingsContext';
import { fmtDuration } from '../../lib/workout';
import { toDisplay } from '../../lib/speedUnit';
import { type PresetLevel } from '../../lib/presets';
import { WALK_PRESETS, walkPresetTotalSeconds } from '../../lib/walkPresets';

const LEVELS: PresetLevel[] = ['1', '2', '3', '4', '5', '6'];

interface Props {
  activePreset: PresetLevel | null;
  onApply: (level: PresetLevel) => void;
}

export default function WalkPresetList({ activePreset, onApply }: Props) {
  const { T } = useTheme();
  const { t } = useTranslation();
  const { settings } = useSettings();
  const isMiles = settings.speedUnit === 'miles';
  const styles = useMemo(() => makeStyles(T), [T]);

  const fmtPace = (kmh: number) =>
    `${toDisplay(kmh, isMiles ? 'miles' : 'km').toFixed(1)} ${isMiles ? 'mph' : 'km/h'}`;

  return (
    <View style={styles.list}>
      {LEVELS.map(level => {
        const preset = WALK_PRESETS[level];
        const { structure, runSpeeds } = preset;
        const isActive = level === activePreset;
        const structureText = structure.continuous
          ? t('edit.walkPresetContinuous')
          : t('edit.walkPresetRounds', { count: structure.rounds });
        const intervalDetail = structure.continuous
          ? undefined
          : t('edit.walkPresetIntervalDetail', {
              warmup: fmtDuration(structure.warmup),
              rounds: structure.rounds,
              work: fmtDuration(structure.work),
              rest: fmtDuration(structure.rest),
              cooldown: fmtDuration(structure.cooldown),
            });
        const speedDetail = structure.continuous
          ? fmtPace(runSpeeds.workSpeed)
          : `${t('workout.effort.easy')} ${fmtPace(runSpeeds.restSpeed)} · ${t('workout.effort.brisk')} ${fmtPace(runSpeeds.workSpeed)}`;
        return (
          <Pressable
            key={level}
            style={[styles.card, isActive && { borderColor: T.accent, backgroundColor: selectedBg(T.accent) }]}
            onPress={() => onApply(level)}
          >
            <View style={styles.cardTop}>
              <Text style={[styles.cardName, { color: isActive ? T.accent : T.text }]}>
                {t('edit.walkPresetLevel', { level, name: t(`walkPresets.l${level}.name`) })}
              </Text>
              <Text style={[styles.cardMeta, { color: T.subText }]}>
                {fmtDuration(walkPresetTotalSeconds(level))} · {structureText}
              </Text>
            </View>
            {intervalDetail && (
              <Text style={[styles.cardDetail, { color: T.subText }]}>{intervalDetail}</Text>
            )}
            <Text style={[styles.cardDetail, { color: T.subText }]}>{speedDetail}</Text>
            <Text style={[styles.cardCue, { color: T.faintText }]}>{t(`walkPresets.l${level}.cue`)}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

function makeStyles(T: ThemeTokens) {
  return StyleSheet.create({
    list: { gap: 8 },
    card: {
      borderWidth: 1.5,
      borderColor: T.hairline,
      backgroundColor: T.ghostBg,
      borderRadius: 12,
      padding: 12,
      gap: 4,
    },
    cardTop: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
      gap: 8,
    },
    cardName: {
      fontFamily: 'Inter_700Bold',
      fontSize: 14,
    },
    cardMeta: {
      fontFamily: 'ChakraPetch_700Bold',
      fontSize: 13,
    },
    cardDetail: {
      fontFamily: 'Inter_600SemiBold',
      fontSize: 13,
    },
    cardCue: {
      fontFamily: 'Inter_400Regular',
      fontSize: 12,
    },
  });
}
