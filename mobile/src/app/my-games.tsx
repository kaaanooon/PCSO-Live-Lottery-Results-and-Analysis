import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, Switch, Text, View } from 'react-native';

import { SettingsPage } from '@/components/settings-page';
import { GAME_BY_CODE } from '@/domain/games';
import type { LogicalGameCode } from '@/domain/types';
import {
  useAppTheme,
  usePreferences,
  type AppThemeColors,
} from '@/providers/preferences-provider';
import { radius, spacing } from '@/theme/tokens';

const RESULT_GAME_CODES = [
  'UL58',
  'GL55',
  'SL49',
  'ML45',
  'LOTTO42',
  '6DL',
  '4DL',
  '3DL',
  '2DL',
] as const satisfies readonly LogicalGameCode[];

export default function MyGamesScreen() {
  const { colors } = useAppTheme();
  const { enabledGames, setGameEnabled, ready } = usePreferences();
  const styles = useMemo(() => makeStyles(colors), [colors]);

  return (
    <SettingsPage
      backLabel="Back to Settings"
      eyebrow="SETTINGS"
      onBack={() => router.back()}
      title="My Games">
      <View style={styles.summaryCard}>
        <View style={styles.summaryIcon}>
          <Ionicons name="options-outline" size={22} color={colors.primary} />
        </View>
        <View style={styles.summaryCopy}>
          <Text style={styles.summaryTitle}>{enabledGames.length} of 9 selected</Text>
          <Text style={styles.summaryText}>
            Turning a game off only hides it from Results. It does not remove archived draws or saved picks.
          </Text>
        </View>
      </View>

      <View style={styles.card}>
        {RESULT_GAME_CODES.map((code, index) => {
          const rule = GAME_BY_CODE[code];
          const enabled = enabledGames.includes(code);
          const description = rule.ordered
            ? `${rule.pickCount}-position exact-order game${rule.slots ? ' · 2 PM, 5 PM, and 9 PM' : ''}`
            : `Choose 6 from 1–${rule.maximum} · order does not matter`;
          return (
            <View
              key={code}
              style={[styles.gameRow, index < RESULT_GAME_CODES.length - 1 && styles.rowBorder]}>
              <View style={styles.gameCopy}>
                <Text style={styles.gameName}>{rule.name}</Text>
                <Text style={styles.gameDescription}>{description}</Text>
              </View>
              <Switch
                accessibilityLabel={`Show ${rule.name} in Results`}
                accessibilityState={{ disabled: !ready, checked: enabled }}
                disabled={!ready}
                ios_backgroundColor={colors.border}
                onValueChange={(value) => setGameEnabled(code, value)}
                thumbColor="#FFFFFF"
                trackColor={{ false: colors.border, true: colors.primary }}
                value={enabled}
              />
            </View>
          );
        })}
      </View>

      {!ready ? (
        <Text accessibilityRole="alert" style={styles.helper}>Loading saved game choices…</Text>
      ) : enabledGames.length === 0 ? (
        <Text accessibilityRole="alert" style={styles.helper}>
          No games are selected. Results will remain empty until you turn at least one game on.
        </Text>
      ) : (
        <Text style={styles.helper}>Changes save automatically on this device.</Text>
      )}
    </SettingsPage>
  );
}

function makeStyles(colors: AppThemeColors) {
  return StyleSheet.create({
    summaryCard: {
      padding: spacing.lg,
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.md,
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surfaceAlt,
    },
    summaryIcon: {
      width: 42,
      height: 42,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.md,
      backgroundColor: colors.surface,
    },
    summaryCopy: { flex: 1, minWidth: 0 },
    summaryTitle: { color: colors.text, fontSize: 16, lineHeight: 21, fontWeight: '900' },
    summaryText: { marginTop: 4, color: colors.textMuted, fontSize: 12, lineHeight: 18 },
    card: {
      paddingHorizontal: spacing.md,
      overflow: 'hidden',
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: radius.lg,
      backgroundColor: colors.surface,
    },
    gameRow: {
      minHeight: 70,
      paddingVertical: spacing.sm,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    rowBorder: { borderBottomWidth: 1, borderBottomColor: colors.border },
    gameCopy: { flex: 1, minWidth: 0 },
    gameName: { color: colors.text, fontSize: 14, lineHeight: 19, fontWeight: '900' },
    gameDescription: { marginTop: 2, color: colors.textMuted, fontSize: 11, lineHeight: 16 },
    helper: {
      paddingHorizontal: spacing.sm,
      color: colors.textMuted,
      fontSize: 11,
      lineHeight: 17,
      textAlign: 'center',
    },
  });
}
