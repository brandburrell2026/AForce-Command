/**
 * OneBreathStatusAnswer — "How am I doing?" on the One Breath screen.
 *
 * It reads HydroState exactly where Home reads it (the engine slice and the
 * same evidence gate) and hands the values to the One Breath pipeline, which
 * only repeats them. It computes no score and changes nothing. While Home
 * would still show "Collecting", this says so and states no number.
 *
 * Mounted only when the member asks, so the One Breath screen itself does not
 * depend on the hydration slices.
 */
import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { countRealHistoryEntries, resolveHomeEvidence } from "@/components/home/homeBaselineState";
import { normalizeBand } from "@/components/home/homePresentation";
import { useBootstrapSlice, useEngineSlice, useHistorySlice, useUserSlice } from "@/store/slices";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { emptyOneBreathState, ONE_BREATH_LINES, oneBreathTurn } from "@/utils/oneBreath/session";
import { ResultCard } from "./kit";

/** "DEPLETED" → "Depleted": the app's own band name, in sentence case. */
export const bandWord = (level: string | null | undefined): string => {
  const band = normalizeBand(level);
  return band.charAt(0) + band.slice(1).toLowerCase();
};

export interface StatusAnswerModel {
  text: string;
  card: { value: number; word: string } | null;
}

/** Pure: the reply for a resolved HydroState, or the collecting line when there is not enough evidence yet. */
export function statusAnswer(args: { ready: boolean; score: number; level: string | null | undefined; social: boolean }): StatusAnswerModel {
  if (!args.ready || !Number.isFinite(args.score)) return { text: ONE_BREATH_LINES.statusCollecting, card: null };
  const value = Math.max(0, Math.min(100, Math.round(args.score)));
  const word = bandWord(args.level);
  const turn = oneBreathTurn(emptyOneBreathState(), { kind: "say", words: "How am I doing?", via: "typed" }, {
    nowIso: new Date().toISOString(),
    social: args.social,
    momentInWindow: false,
    learningOn: false,
    interpreterReachable: true,
    networkUp: true,
    // HydroState is worked out from what the member logged, so it is an estimate.
    hydroState: { value, word, estimated: true, source: "what you’ve logged" },
  });
  return { text: turn.reply.text, card: { value, word } };
}

export function OneBreathStatusAnswer({ social }: { social: boolean }) {
  const engine = useEngineSlice();
  const user = useUserSlice();
  const history = useHistorySlice();
  const { isHydrated } = useBootstrapSlice();
  const evidence = resolveHomeEvidence({
    intakeEventCount: user.intakeEvents?.length ?? 0,
    loggedDayCount: isHydrated ? countRealHistoryEntries(history) : null,
  });
  const model = statusAnswer({
    ready: evidence !== "pending" && evidence !== "building",
    score: engine.score,
    level: engine.performanceState?.level,
    social,
  });
  return (
    <View style={s.root}>
      <Text accessibilityRole="text" accessibilityLiveRegion="polite" style={s.text}>
        {model.text}
      </Text>
      {model.card ? (
        <ResultCard value={model.card.value} word={model.card.word} estimated position={model.card.value / 100} social={social} />
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  root: { gap: 12, alignSelf: "stretch" },
  text: { fontFamily: "Inter_400Regular", fontSize: 16.5, lineHeight: 24, color: T.bone },
});
