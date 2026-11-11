import type { Moment, MomentType } from "@/types/moments";
import {
  MOMENT_FEEDBACK_WINDOW_DAYS,
  MOMENT_FEEDBACK_MAX_RECORDS,
  MOMENT_PROPOSAL_DECLINE_THRESHOLD,
  MOMENT_PROPOSAL_COOLDOWN_HOURS,
  MOMENT_PROPOSAL_MAX_COOLDOWN_HOURS,
} from "@/config/hydroStateModel";

/** Shared Moments preference metadata. No title, location, alcohol context,
 * health data, separate Social memory, or command authority. */
export interface MomentProposalPreferences {
  records: {
    key: string;
    type: MomentType;
    outcome: "shown" | "accepted" | "declined";
    atIso: string;
  }[];
  neverTypes: MomentType[];
  suggestionsAllowedAtIso?: string;
}
const types: MomentType[] = [
  "work",
  "training",
  "travel",
  "recovery",
  "personal",
  "performance",
];
export const EMPTY_MOMENT_PROPOSAL_PREFS: MomentProposalPreferences = {
  records: [],
  neverTypes: [],
};
export const momentProposalKey = (moment: Pick<Moment, "id" | "startAtIso">) =>
  `${moment.id}@${moment.startAtIso}`;
export function sanitizeMomentProposalPreferences(
  raw: unknown,
  nowMs = Date.now(),
): MomentProposalPreferences {
  const value =
    raw && typeof raw === "object"
      ? (raw as Partial<MomentProposalPreferences>)
      : {};
  const records = Array.isArray(value.records)
    ? value.records.filter(
        (r) =>
          r &&
          typeof r.key === "string" &&
          r.key.length <= 300 &&
          types.includes(r.type) &&
          ["shown", "accepted", "declined"].includes(r.outcome) &&
          typeof r.atIso === "string" &&
          Date.parse(r.atIso) <= nowMs &&
          Date.parse(r.atIso) >= nowMs - MOMENT_FEEDBACK_WINDOW_DAYS * 86400000,
      )
    : [];
  return {
    ...(typeof value.suggestionsAllowedAtIso === "string" &&
    Number.isFinite(Date.parse(value.suggestionsAllowedAtIso)) &&
    Date.parse(value.suggestionsAllowedAtIso) <= nowMs
      ? { suggestionsAllowedAtIso: value.suggestionsAllowedAtIso }
      : {}),
    records: [...new Map(records.map((r) => [r.key, r])).values()].slice(
      -MOMENT_FEEDBACK_MAX_RECORDS,
    ),
    neverTypes: Array.isArray(value.neverTypes)
      ? [...new Set(value.neverTypes.filter((t) => types.includes(t)))]
      : [],
  };
}
export function proposalCooldownUntil(
  prefs: MomentProposalPreferences,
): number {
  const resetAt = Date.parse(prefs.suggestionsAllowedAtIso ?? "") || 0;
  const results = [...prefs.records]
    .filter((r) => r.outcome !== "shown" && Date.parse(r.atIso) > resetAt)
    .reverse();
  let declines = 0;
  for (const result of results) {
    if (result.outcome !== "declined") break;
    declines++;
  }
  if (declines < MOMENT_PROPOSAL_DECLINE_THRESHOLD) return 0;
  const hours = Math.min(
    MOMENT_PROPOSAL_MAX_COOLDOWN_HOURS,
    MOMENT_PROPOSAL_COOLDOWN_HOURS *
      2 ** Math.min(10, declines - MOMENT_PROPOSAL_DECLINE_THRESHOLD),
  );
  return Date.parse(results[0]!.atIso) + hours * 3600000;
}
export function reduceMomentProposalPreference(
  prefs: MomentProposalPreferences,
  moment: Moment,
  outcome: "shown" | "accepted" | "declined",
  neverType = false,
  nowMs = Date.now(),
): MomentProposalPreferences {
  const key = momentProposalKey(moment);
  const existing = prefs.records.find((r) => r.key === key);
  const neverTypes = neverType
    ? [...new Set([...prefs.neverTypes, moment.type])]
    : prefs.neverTypes;
  // Re-render, retry or duplicate tap cannot extend a cooldown or mint a vote.
  if (existing && (existing.outcome === outcome || outcome === "shown")) {
    return neverTypes.length === prefs.neverTypes.length
      ? prefs
      : { ...prefs, neverTypes };
  }
  return {
    ...prefs,
    neverTypes,
    records: [
      ...prefs.records.filter((r) => r.key !== key),
      { key, type: moment.type, outcome, atIso: new Date(nowMs).toISOString() },
    ].slice(-MOMENT_FEEDBACK_MAX_RECORDS),
  };
}
