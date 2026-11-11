import React from "react";
import { Pressable, StyleSheet, Switch, Text, View } from "react-native";
import { AFCard, AFPrimaryButton, AFSectionLabel } from "@/components/ui";
import { af, afLayout, afType } from "@/theme";
import { GENTLE_HYDRATION_COPY as copy } from "@/services/gentleHydrationCopy";
import {
  DEFAULT_GENTLE_HYDRATION_MODE,
  loadGentleHydrationMode,
  saveGentleHydrationMode,
  type GentleHydrationModeState,
} from "@/services/gentleHydrationMode";

/** Private, presentation-only controls. It makes no network, logging, or commerce call. */
export function GentleHydrationModeCard({
  showGlp1Context,
  onModeChange,
}: {
  showGlp1Context: boolean;
  onModeChange: (mode: GentleHydrationModeState) => void;
}) {
  const [mode, setMode] = React.useState<GentleHydrationModeState>(
    DEFAULT_GENTLE_HYDRATION_MODE,
  );
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void loadGentleHydrationMode().then((saved) => {
      if (!active) return;
      setMode(saved);
      onModeChange(saved);
      setLoaded(true);
    });
    return () => {
      active = false;
    };
  }, [onModeChange]);

  const persist = React.useCallback(
    (next: Omit<GentleHydrationModeState, "updatedAt">) => {
      void saveGentleHydrationMode(next).then((saved) => {
        setMode(saved);
        onModeChange(saved);
      });
    },
    [onModeChange],
  );

  if (!loaded) return null;
  if (!mode.enabled) {
    return (
      <View style={styles.section} testID="gentle-hydration-mode">
        <AFSectionLabel label={copy.sectionLabel} meta={copy.privateMeta} />
        <AFCard style={styles.card}>
          <Text style={styles.title}>{copy.setupTitle}</Text>
          <Text style={styles.body}>{copy.setupBody}</Text>
          {showGlp1Context ? (
            <Text style={styles.body}>{copy.glp1Context}</Text>
          ) : null}
          <Text style={styles.safety}>{copy.safety}</Text>
          <Text style={styles.privateNote}>{copy.privateNote}</Text>
          <AFPrimaryButton
            label={copy.enable}
            onPress={() =>
              persist({
                enabled: true,
                pauseStreakDisplay: false,
                promptsEnabled: false,
              })
            }
            testID="enable-gentle-hydration"
          />
        </AFCard>
      </View>
    );
  }

  return (
    <View style={styles.section} testID="gentle-hydration-mode">
      <AFSectionLabel label={copy.sectionLabel} meta={copy.privateMeta} />
      <AFCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{copy.enabledTitle}</Text>
            <Text style={styles.body}>{copy.enabledBody}</Text>
          </View>
          <Pressable
            onPress={() =>
              persist({
                enabled: false,
                pauseStreakDisplay: false,
                promptsEnabled: false,
              })
            }
            accessibilityRole="button"
            accessibilityLabel={copy.disable}
            hitSlop={8}
          >
            <Text style={styles.turnOff}>{copy.disable.toUpperCase()}</Text>
          </Pressable>
        </View>
        <SettingRow
          label={copy.pauseStreakLabel}
          detail={copy.pauseStreakDetail}
          value={mode.pauseStreakDisplay}
          onChange={(pauseStreakDisplay) =>
            persist({
              enabled: true,
              pauseStreakDisplay,
              promptsEnabled: mode.promptsEnabled,
            })
          }
        />
        <SettingRow
          label={copy.promptsLabel}
          detail={copy.promptsDetail}
          value={mode.promptsEnabled}
          onChange={(promptsEnabled) =>
            persist({
              enabled: true,
              pauseStreakDisplay: mode.pauseStreakDisplay,
              promptsEnabled,
            })
          }
        />
        {showGlp1Context ? (
          <Text style={styles.body}>{copy.glp1Context}</Text>
        ) : null}
        <Text style={styles.safety}>{copy.safety}</Text>
        <Text style={styles.privateNote}>{copy.privateNote}</Text>
      </AFCard>
    </View>
  );
}

function SettingRow({
  label,
  detail,
  value,
  onChange,
}: {
  label: string;
  detail: string;
  value: boolean;
  onChange: (next: boolean) => void;
}) {
  return (
    <View
      style={styles.setting}
      accessible
      accessibilityLabel={`${label}. ${detail}`}
    >
      <View style={styles.headerCopy}>
        <Text style={styles.settingLabel}>{label}</Text>
        <Text style={styles.detail}>{detail}</Text>
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        accessibilityLabel={label}
        trackColor={{ false: af.border, true: af.red }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, gap: 12 },
  card: { gap: 16 },
  header: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  headerCopy: { flex: 1, gap: 6 },
  title: { ...afType.title3, color: af.textPrimary },
  body: { ...afType.body, color: af.textSecondary, lineHeight: 22 },
  safety: { ...afType.caption, color: af.textPrimary, lineHeight: 19 },
  privateNote: { ...afType.caption, color: af.textTertiary, lineHeight: 19 },
  turnOff: { ...afType.eyebrow, color: af.redText, marginTop: 3 },
  setting: {
    flexDirection: "row",
    gap: 12,
    alignItems: "center",
    minHeight: afLayout.controlMinHeight,
    padding: 12,
    borderWidth: 1,
    borderColor: af.border,
    borderRadius: afLayout.radiusButton,
  },
  settingLabel: { ...afType.bodyStrong, color: af.textPrimary },
  detail: { ...afType.caption, color: af.textSecondary, lineHeight: 18 },
});
