import React from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import {
  AFCard,
  AFPrimaryButton,
  AFSecondaryButton,
  AFSectionLabel,
} from "@/components/ui";
import { af, afLayout, afType } from "@/theme";
import {
  DEFAULT_GENTLE_HYDRATION_MODE,
  clearGentleHydrationMode,
  gentleHydrationCheckInCount,
  loadGentleHydrationMode,
  saveGentleHydrationMode,
  type GentleHydrationCadence,
  type GentleHydrationComfort,
  type GentleHydrationModeState,
} from "@/services/gentleHydrationMode";
import {
  createGentleHydrationPlan,
  localDayKey,
} from "@/services/gentleHydrationPlan";

const CADENCES: ReadonlyArray<{
  value: GentleHydrationCadence;
  label: string;
  detail: string;
}> = [
  { value: "gentle", label: "Gentle", detail: "Five smaller check-ins" },
  { value: "steady", label: "Steady", detail: "Four check-ins" },
  { value: "minimal", label: "Minimal", detail: "Three check-ins" },
];

const COMFORTS: ReadonlyArray<{
  value: GentleHydrationComfort;
  label: string;
}> = [
  { value: "fine", label: "Feeling fine" },
  { value: "low_appetite", label: "Low appetite" },
  { value: "mild_nausea", label: "Mild nausea" },
  { value: "stomach_upset", label: "Stomach upset" },
  { value: "prefer_not_to_say", label: "Prefer not to say" },
];

/**
 * A private planning layer, deliberately separate from the intake engine.
 * It provides no diagnosis, medication management, volume prescription,
 * reminder scheduling, score change, analytics event, or Circle projection.
 */
export function GentleHydrationModeCard({
  onLogWater,
  ozConsumedToday,
  ozTarget,
}: {
  onLogWater: () => void;
  ozConsumedToday: number;
  ozTarget: number;
}) {
  const [mode, setMode] = React.useState<GentleHydrationModeState>(
    DEFAULT_GENTLE_HYDRATION_MODE,
  );
  const [loaded, setLoaded] = React.useState(false);
  const [safetyGuidanceOpen, setSafetyGuidanceOpen] = React.useState(false);

  React.useEffect(() => {
    let active = true;
    void loadGentleHydrationMode().then((saved) => {
      if (active) {
        setMode(saved);
        setLoaded(true);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const persist = React.useCallback(
    async (next: Omit<GentleHydrationModeState, "updatedAt">) => {
      const saved = await saveGentleHydrationMode(next);
      setMode(saved);
    },
    [],
  );

  const selectCadence = React.useCallback(
    (cadence: GentleHydrationCadence) => {
      void persist({
        enabled: true,
        cadence,
        comfort: mode.comfort,
        pausedOnDayKey: mode.pausedOnDayKey,
        deferredUntil: mode.deferredUntil,
      });
    },
    [mode.comfort, persist],
  );

  const selectComfort = React.useCallback(
    (comfort: GentleHydrationComfort) => {
      void persist({
        enabled: true,
        cadence: mode.cadence,
        comfort,
        pausedOnDayKey: mode.pausedOnDayKey,
        deferredUntil: mode.deferredUntil,
      });
    },
    [mode.cadence, persist],
  );

  if (!loaded) return null;

  if (!mode.enabled) {
    return (
      <View style={styles.section} testID="gentle-hydration-mode">
        <AFSectionLabel label="Gentle hydration" meta="Private" />
        <AFCard style={styles.card}>
          <Text style={styles.title}>A gentler hydration rhythm</Text>
          <Text style={styles.body}>
            Optional support for days when hydration feels harder, including
            while using a GLP-1 medicine.
          </Text>
          <Text style={styles.privateNote}>
            Private to your account. It is never shared with Circle.
          </Text>
          <AFPrimaryButton
            label="Set up gentle hydration"
            onPress={() => void persist({ enabled: true, cadence: "gentle" })}
            testID="enable-gentle-hydration"
          />
        </AFCard>
      </View>
    );
  }

  const plan = createGentleHydrationPlan({
    cadence: mode.cadence,
    ozConsumedToday,
    ozTarget,
    pausedOnDayKey: mode.pausedOnDayKey,
    deferredUntil: mode.deferredUntil,
  });
  const checkIns = plan.checkIns;
  const needsSafetyGuidance =
    safetyGuidanceOpen || mode.comfort === "stomach_upset";

  return (
    <View style={styles.section} testID="gentle-hydration-mode">
      <AFSectionLabel label="Gentle hydration" meta="Private" />
      <AFCard style={styles.card}>
        <View style={styles.headerRow}>
          <View style={styles.headerCopy}>
            <Text style={styles.title}>{plan.headline}</Text>
            <Text style={styles.body}>
              {plan.detail} This does not change your target or score.
            </Text>
          </View>
          <Pressable
            onPress={() => {
              void clearGentleHydrationMode().then(() =>
                setMode(DEFAULT_GENTLE_HYDRATION_MODE),
              );
            }}
            accessibilityRole="button"
            accessibilityLabel="Turn off gentle hydration"
            hitSlop={8}
          >
            <Text style={styles.turnOff}>TURN OFF</Text>
          </Pressable>
        </View>

        <Text style={styles.fieldLabel}>Choose today&apos;s pace</Text>
        <View style={styles.optionRow}>
          {CADENCES.map((option) => {
            const selected = mode.cadence === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectCadence(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={`${option.label}. ${option.detail}`}
                style={[styles.option, selected && styles.optionSelected]}
              >
                <Text
                  style={[
                    styles.optionLabel,
                    selected && styles.optionLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
                <Text
                  style={[
                    styles.optionDetail,
                    selected && styles.optionDetailSelected,
                  ]}
                >
                  {option.detail}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.fieldLabel}>Private comfort check-in</Text>
        <View style={styles.comfortWrap}>
          {COMFORTS.map((option) => {
            const selected = mode.comfort === option.value;
            return (
              <Pressable
                key={option.value}
                onPress={() => selectComfort(option.value)}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                style={[
                  styles.comfortOption,
                  selected && styles.comfortOptionSelected,
                ]}
              >
                <Text
                  style={[
                    styles.comfortLabel,
                    selected && styles.comfortLabelSelected,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Pressable
          onPress={() => setSafetyGuidanceOpen((open) => !open)}
          accessibilityRole="button"
          accessibilityState={{ expanded: needsSafetyGuidance }}
          accessibilityLabel="When to contact your clinician"
          hitSlop={8}
        >
          <Text style={styles.guidanceLink}>
            WHEN TO CONTACT YOUR CLINICIAN
          </Text>
        </Pressable>
        {needsSafetyGuidance ? (
          <View style={styles.guidance} accessibilityRole="alert">
            <Text style={styles.guidanceTitle}>
              Pause and get support if symptoms persist
            </Text>
            <Text style={styles.guidanceBody}>
              Drink fluids as you are able. If nausea, vomiting, diarrhea, or
              stomach symptoms persist, contact your prescribing clinician or
              another healthcare professional. For urgent or severe symptoms,
              seek urgent medical care.
            </Text>
          </View>
        ) : null}

        <Text style={styles.privateNote}>
          This check-in stays private. It is not shared with Circle or used for
          ranking.
        </Text>
        {plan.nextMove === "log" || plan.nextMove === "complete" ? (
          <AFSecondaryButton
            label="Log water"
            onPress={onLogWater}
            testID="gentle-hydration-log-water-context"
          />
        ) : null}
        {plan.nextMove === "log" ? (
          <View style={styles.pacingActions}>
            <Pressable
              onPress={() =>
                void persist({
                  enabled: true,
                  cadence: mode.cadence,
                  comfort: mode.comfort,
                  deferredUntil: new Date(
                    Date.now() + 30 * 60_000,
                  ).toISOString(),
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.pacingAction}>NOT NOW</Text>
            </Pressable>
            <Pressable
              onPress={() =>
                void persist({
                  enabled: true,
                  cadence: mode.cadence,
                  comfort: mode.comfort,
                  pausedOnDayKey: localDayKey(),
                })
              }
              accessibilityRole="button"
            >
              <Text style={styles.pacingAction}>PAUSE TODAY</Text>
            </Pressable>
          </View>
        ) : null}
        {plan.nextMove === "wait" ? (
          <AFSecondaryButton
            label="I’m ready now"
            onPress={() =>
              void persist({
                enabled: true,
                cadence: mode.cadence,
                comfort: mode.comfort,
                pausedOnDayKey: mode.pausedOnDayKey,
              })
            }
            testID="gentle-hydration-resume"
          />
        ) : null}
        {plan.nextMove === "rest" ? (
          <AFSecondaryButton
            label="Resume gentle hydration"
            onPress={() =>
              void persist({
                enabled: true,
                cadence: mode.cadence,
                comfort: mode.comfort,
                deferredUntil: mode.deferredUntil,
              })
            }
            testID="gentle-hydration-unpause"
          />
        ) : null}
      </AFCard>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { marginTop: 28, gap: 12 },
  card: { gap: 16 },
  headerRow: { flexDirection: "row", gap: 16, alignItems: "flex-start" },
  headerCopy: { flex: 1, gap: 6 },
  title: { ...afType.title3, color: af.textPrimary },
  body: { ...afType.body, color: af.textSecondary, lineHeight: 22 },
  privateNote: { ...afType.caption, color: af.textTertiary, lineHeight: 19 },
  turnOff: { ...afType.eyebrow, color: af.redText, marginTop: 3 },
  fieldLabel: { ...afType.eyebrow, color: af.textTertiary, marginTop: 2 },
  optionRow: { flexDirection: "row", gap: 8 },
  option: {
    flex: 1,
    minHeight: 82,
    padding: 12,
    borderRadius: afLayout.radiusButton,
    borderWidth: 1,
    borderColor: af.border,
    gap: 4,
  },
  optionSelected: { borderColor: af.red, backgroundColor: af.surfaceAlert },
  optionLabel: { ...afType.bodyStrong, color: af.textPrimary },
  optionLabelSelected: { color: af.redText },
  optionDetail: { ...afType.caption, color: af.textTertiary },
  optionDetailSelected: { color: af.textSecondary },
  comfortWrap: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  comfortOption: {
    minHeight: 40,
    justifyContent: "center",
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: af.border,
  },
  comfortOptionSelected: {
    borderColor: af.red,
    backgroundColor: af.surfaceAlert,
  },
  comfortLabel: { ...afType.caption, color: af.textSecondary },
  comfortLabelSelected: { color: af.redText },
  guidanceLink: { ...afType.eyebrow, color: af.redText, paddingVertical: 4 },
  guidance: {
    gap: 6,
    padding: 14,
    borderRadius: afLayout.radiusButton,
    backgroundColor: af.surfaceAlert,
    borderWidth: 1,
    borderColor: af.borderAlert,
  },
  guidanceTitle: { ...afType.bodyStrong, color: af.textPrimary },
  guidanceBody: { ...afType.caption, color: af.textSecondary, lineHeight: 19 },
  pacingActions: { flexDirection: "row", gap: 20 },
  pacingAction: { ...afType.eyebrow, color: af.redText, paddingVertical: 6 },
});
