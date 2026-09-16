/**
 * Morning Board — the trainer's one screen.
 *
 * Phase 2 of `docs/TRAINER-DASHBOARD-BRIEF.md`. Opens to today, sorted by who
 * needs the trainer, never alphabetically. Flagged athletes are above the
 * fold; everyone fine collapses behind a single "N clear" row.
 *
 * Decisions this screen implements:
 *   - Ordering, grouping and the "why" line live in `utils/trainerBoard.ts`
 *     as pure functions, so the board's judgement is testable without a
 *     renderer. This file is layout only.
 *   - Tiers come from the protected engine via `clutchTier`. ONE band system
 *     (Phase 0 ruling), so a row can never disagree with the command it shows.
 *   - Colors are `af.*` tokens only. `af.red` is a FILL, `af.redText` is the
 *     AA-clean red for text — which is exactly the founder's decision-2
 *     constraint, already encoded in the token set.
 *   - `FlatList` virtualizes. The brief's 120-athlete target cannot be met by
 *     a ScrollView, and FlashList would be a new runtime dependency this
 *     phase does not need: FlatList ships with React Native.
 *
 * Two taps to change availability: the status chip on a row opens the sheet,
 * the sheet's option commits. Nothing else is between a trainer and a status.
 */

import React, { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
  type ListRenderItemInfo,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { af, afAlpha, afLayout, afType, withAlpha } from "@/theme/afTokens";
import {
  applyFilters,
  commandFor,
  flagReasons,
  isFlagged,
  partitionBoard,
  rosterCounts,
  tierFor,
  whyLine,
  type Availability,
  type BoardAthlete,
  type BoardFilters,
} from "@/utils/trainerBoard";

/**
 * Phase 7: "Touch targets >= 48px. Works with tape or gloves."
 *
 * `afLayout.controlMinHeight` is 44, the iOS minimum. A gloved or taped hand
 * on a sideline is not the iOS minimum's use case, so this surface uses 48
 * throughout. Not a new design token — a local floor for one surface, with
 * the reason attached.
 */
const TRAINER_TOUCH_MIN = 48;

const AVAILABILITY_OPTIONS: Availability[] = ["available", "limited", "out"];

const AVAILABILITY_LABEL: Record<Availability, string> = {
  available: "AVAILABLE",
  limited: "LIMITED",
  out: "OUT",
  unset: "NOT SET",
};

/** Tone, not hue coding. Red carries urgency; everything else is neutral. */
function availabilityTone(status: Availability): string {
  if (status === "out") return af.redText;
  if (status === "limited") return af.amber;
  if (status === "unset") return af.textTertiary;
  return af.textSecondary;
}

export interface TrainerBoardScreenProps {
  athletes: BoardAthlete[];
  /** Venue conditions for today. Null renders "no local reading". */
  heatIndexF?: number | null;
  ambientMeasured?: boolean;
  onChangeAvailability?: (athleteUserId: string, status: Availability) => void;
  /** One tap from a row to the record — inside the brief's 2-tap budget. */
  onOpenAthlete?: (athleteUserId: string) => void;
  /**
   * What the outbox currently holds. Rendered verbatim: the indicator states
   * queue state and nothing else, because this app has no connectivity signal
   * and a green tick would be a claim nothing can back.
   */
  syncLabel?: string;
  syncNeedsAttention?: boolean;
  onPressSync?: () => void;
}

interface RowProps {
  athlete: BoardAthlete;
  onPressStatus: (a: BoardAthlete) => void;
  onOpen?: (athleteUserId: string) => void;
}

/**
 * Memoized row. The board re-renders on every filter change and every status
 * write; without this each of those costs 120 row renders instead of one.
 */
const AthleteRow = React.memo(function AthleteRow({ athlete, onPressStatus, onOpen }: RowProps) {
  const tier = tierFor(athlete);
  const command = commandFor(athlete);
  const flagged = isFlagged(athlete);
  const reasons = flagReasons(athlete);
  const urgent = reasons.includes("out") || reasons.includes("depleted");

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Open the record for ${athlete.displayName}`}
      onPress={() => onOpen?.(athlete.athleteUserId)}
      style={[styles.row, urgent && styles.rowUrgent]}
    >
      <View style={styles.rowTop}>
        <Text style={styles.name} numberOfLines={1} ellipsizeMode="tail">
          {athlete.displayName}
        </Text>
        <Text style={styles.position}>{athlete.position}</Text>
        {athlete.isSimulated ? <Text style={styles.simulated}>SIMULATED</Text> : null}
        <View style={styles.rowTopSpacer} />
        <Text style={[styles.score, flagged ? styles.scoreFlagged : null]}>
          {athlete.hydrationScore ?? "--"}
        </Text>
        <Text style={styles.scoreUnit}>{tier ?? "NO DATA"}</Text>
      </View>

      <Text style={styles.why} numberOfLines={1}>
        {whyLine(athlete)}
      </Text>

      {command ? (
        <Text style={styles.command} numberOfLines={1}>
          {command}
        </Text>
      ) : null}

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`Change availability for ${athlete.displayName}, currently ${AVAILABILITY_LABEL[athlete.availability]}`}
        onPress={() => onPressStatus(athlete)}
        style={styles.statusChip}
        hitSlop={8}
      >
        <Text style={[styles.statusChipText, { color: availabilityTone(athlete.availability) }]}>
          {AVAILABILITY_LABEL[athlete.availability]}
        </Text>
      </Pressable>
    </Pressable>
  );
});

export default function TrainerBoardScreen({
  athletes,
  heatIndexF = null,
  ambientMeasured = false,
  onChangeAvailability,
  onOpenAthlete,
  syncLabel,
  syncNeedsAttention = false,
  onPressSync,
}: TrainerBoardScreenProps) {
  const insets = useSafeAreaInsets();
  const [filters, setFilters] = useState<BoardFilters>({});
  const [clearExpanded, setClearExpanded] = useState(false);
  const [sheetFor, setSheetFor] = useState<BoardAthlete | null>(null);

  const counts = useMemo(() => rosterCounts(athletes), [athletes]);
  const filtered = useMemo(() => applyFilters(athletes, filters), [athletes, filters]);
  const { flagged, clear } = useMemo(() => partitionBoard(filtered), [filtered]);

  // The clear group is one row until expanded. That collapse is the whole
  // point of exception-first: 100 fine athletes cost one line, not 100.
  const data = useMemo(
    () => (clearExpanded ? [...flagged, ...clear] : flagged),
    [flagged, clear, clearExpanded],
  );

  const onPressStatus = useCallback((a: BoardAthlete) => setSheetFor(a), []);

  const renderItem = useCallback(
    ({ item }: ListRenderItemInfo<BoardAthlete>) => (
      <AthleteRow athlete={item} onPressStatus={onPressStatus} onOpen={onOpenAthlete} />
    ),
    [onPressStatus, onOpenAthlete],
  );

  const keyExtractor = useCallback((a: BoardAthlete) => a.athleteUserId, []);

  const toggleFilter = useCallback((next: BoardFilters) => {
    setFilters((prev) => ({ ...prev, ...next }));
  }, []);

  return (
    <View style={[styles.screen, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>MORNING BOARD / TODAY</Text>
        <Text style={styles.title}>Who needs you</Text>

        <View style={styles.countRow}>
          <CountCell label="AVAILABLE" value={counts.available} />
          <CountCell label="LIMITED" value={counts.limited} tone={af.amber} />
          <CountCell label="OUT" value={counts.out} tone={af.redText} />
          <CountCell label="FLAGGED" value={counts.flagged} tone={af.redText} />
        </View>

        <Text style={styles.venue}>
          {heatIndexF === null
            ? "No local temperature reading."
            : `Heat index ${heatIndexF} F · ${ambientMeasured ? "measured on site" : "not measured on site"}`}
        </Text>

        <View style={styles.filterRow}>
          <FilterChip
            label="FLAGGED ONLY"
            active={filters.flaggedOnly === true}
            onPress={() => toggleFilter({ flaggedOnly: !filters.flaggedOnly })}
          />
          <FilterChip
            label="NO CHECK-IN"
            active={filters.missingCheckInOnly === true}
            onPress={() => toggleFilter({ missingCheckInOnly: !filters.missingCheckInOnly })}
          />
          <FilterChip
            label="OFFENSE"
            active={filters.positionGroup === "Offense"}
            onPress={() =>
              toggleFilter({ positionGroup: filters.positionGroup === "Offense" ? null : "Offense" })
            }
          />
          <FilterChip
            label="DEFENSE"
            active={filters.positionGroup === "Defense"}
            onPress={() =>
              toggleFilter({ positionGroup: filters.positionGroup === "Defense" ? null : "Defense" })
            }
          />
        </View>
      </View>

      {syncLabel ? (
        <Pressable
          accessibilityRole={onPressSync ? "button" : "text"}
          accessibilityLabel={syncLabel}
          onPress={onPressSync}
          style={[styles.syncBar, syncNeedsAttention && styles.syncBarAttention]}
        >
          <Text style={[styles.syncText, syncNeedsAttention && styles.syncTextAttention]}>
            {syncLabel}
          </Text>
        </Pressable>
      ) : null}

      <FlatList
        data={data}
        renderItem={renderItem}
        keyExtractor={keyExtractor}
        initialNumToRender={12}
        maxToRenderPerBatch={12}
        windowSize={7}
        removeClippedSubviews
        contentContainerStyle={{ paddingBottom: insets.bottom + afLayout.sectionGap }}
        ListFooterComponent={
          clear.length > 0 ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`${clear.length} athletes clear. ${clearExpanded ? "Collapse" : "Expand"}.`}
              onPress={() => setClearExpanded((v) => !v)}
              style={styles.clearRow}
            >
              <Text style={styles.clearText}>
                {clearExpanded ? "HIDE" : "SHOW"} {clear.length} CLEAR
              </Text>
            </Pressable>
          ) : null
        }
      />

      <Modal visible={sheetFor !== null} transparent animationType="fade" onRequestClose={() => setSheetFor(null)}>
        <Pressable style={styles.sheetScrim} onPress={() => setSheetFor(null)}>
          <View style={styles.sheet}>
            <Text style={styles.sheetTitle} numberOfLines={1}>
              {sheetFor?.displayName ?? ""}
            </Text>
            {AVAILABILITY_OPTIONS.map((option) => (
              <Pressable
                key={option}
                accessibilityRole="button"
                accessibilityLabel={`Set ${AVAILABILITY_LABEL[option]}`}
                style={styles.sheetOption}
                onPress={() => {
                  if (sheetFor && onChangeAvailability) {
                    onChangeAvailability(sheetFor.athleteUserId, option);
                  }
                  setSheetFor(null);
                }}
              >
                <Text style={[styles.sheetOptionText, { color: availabilityTone(option) }]}>
                  {AVAILABILITY_LABEL[option]}
                </Text>
              </Pressable>
            ))}
            <Text style={styles.sheetNote}>
              Recommendation — clinical decision remains with licensed staff.
            </Text>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

function CountCell({ label, value, tone }: { label: string; value: number; tone?: string }) {
  return (
    <View style={styles.countCell}>
      <Text style={styles.countLabel}>{label}</Text>
      <Text style={[styles.countValue, tone ? { color: tone } : null]}>{value}</Text>
    </View>
  );
}

function FilterChip({
  label,
  active,
  onPress,
}: {
  label: string;
  active: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={8}
      style={[styles.filterChip, active && styles.filterChipActive]}
    >
      <Text style={[styles.filterChipText, active && styles.filterChipTextActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: af.canvas },
  header: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingTop: afLayout.cardPadding,
    paddingBottom: afLayout.cardGap,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  eyebrow: { ...afType.eyebrow, color: af.redText },
  title: { ...afType.title1, color: af.textPrimary, marginTop: 6 },
  countRow: { flexDirection: "row", marginTop: afLayout.cardPadding },
  countCell: { flex: 1 },
  countLabel: { ...afType.tab, color: af.textTertiary },
  countValue: { ...afType.title2, color: af.textPrimary, marginTop: 2 },
  venue: { ...afType.caption, color: af.textSecondary, marginTop: afLayout.cardGap },
  filterRow: { flexDirection: "row", flexWrap: "wrap", marginTop: afLayout.cardGap },
  filterChip: {
    minHeight: TRAINER_TOUCH_MIN,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginRight: 8,
    marginTop: 8,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  filterChipActive: { borderColor: af.red, backgroundColor: af.redDim },
  filterChipText: { ...afType.tab, color: af.textSecondary },
  filterChipTextActive: { color: af.textPrimary },

  syncBar: {
    minHeight: TRAINER_TOUCH_MIN,
    justifyContent: "center",
    paddingHorizontal: afLayout.screenPaddingX,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  syncBarAttention: { backgroundColor: af.redDim },
  syncText: { ...afType.tab, color: af.textSecondary },
  syncTextAttention: { color: af.redText },

  row: {
    paddingHorizontal: afLayout.screenPaddingX,
    paddingVertical: afLayout.cardPadding,
    borderBottomWidth: afLayout.hairline,
    borderBottomColor: af.divider,
  },
  rowUrgent: { backgroundColor: withAlpha(af.red, afAlpha.a06) },
  rowTop: { flexDirection: "row", alignItems: "baseline" },
  name: { ...afType.bodyStrong, color: af.textPrimary, flexShrink: 1, maxWidth: "52%" },
  position: { ...afType.tab, color: af.textTertiary, marginLeft: 8 },
  simulated: { ...afType.tab, color: af.amber, marginLeft: 8 },
  rowTopSpacer: { flex: 1 },
  score: { ...afType.title2, color: af.textPrimary },
  scoreFlagged: { color: af.redText },
  scoreUnit: { ...afType.tab, color: af.textTertiary, marginLeft: 6 },
  why: { ...afType.secondary, color: af.textSecondary, marginTop: 6 },
  command: { ...afType.caption, color: af.textTertiary, marginTop: 4 },
  statusChip: {
    alignSelf: "flex-start",
    minHeight: TRAINER_TOUCH_MIN,
    justifyContent: "center",
    paddingHorizontal: 14,
    marginTop: afLayout.cardGap,
    borderRadius: afLayout.radiusPill,
    borderWidth: afLayout.hairline,
    borderColor: af.border,
  },
  statusChipText: { ...afType.tab },

  clearRow: {
    minHeight: TRAINER_TOUCH_MIN,
    justifyContent: "center",
    paddingHorizontal: afLayout.screenPaddingX,
    paddingVertical: afLayout.cardPadding,
  },
  clearText: { ...afType.tab, color: af.textSecondary },

  sheetScrim: {
    flex: 1,
    backgroundColor: withAlpha(af.canvasFocused, afAlpha.a67),
    justifyContent: "flex-end",
  },
  sheet: {
    backgroundColor: af.surface,
    borderTopLeftRadius: afLayout.radiusHero,
    borderTopRightRadius: afLayout.radiusHero,
    padding: afLayout.cardPaddingLarge,
  },
  sheetTitle: { ...afType.title3, color: af.textPrimary, marginBottom: afLayout.cardGap },
  sheetOption: {
    minHeight: afLayout.buttonHeight,
    justifyContent: "center",
    borderTopWidth: afLayout.hairline,
    borderTopColor: af.divider,
  },
  sheetOptionText: { ...afType.bodyStrong },
  sheetNote: { ...afType.caption, color: af.textTertiary, marginTop: afLayout.cardGap },
});
