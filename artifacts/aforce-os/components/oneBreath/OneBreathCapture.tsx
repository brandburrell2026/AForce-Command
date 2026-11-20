/**
 * OneBreathCapture — the opening screen of One Breath, laid out as the
 * approved prototype's One Breath: the mark and a status word, a round Close
 * button, the orb inside its ring of ticks with "Tap to talk", one line of
 * prompt, example chips, and the bar to talk or type at the foot.
 *
 * Presentation only. It records nothing and decides nothing: the screen owns
 * the words, the voice session and what Send does (it goes to review). No AI
 * model is involved and nothing here seals.
 *
 * Left out on purpose, because the app has no real data for them here: the
 * prototype's "Health · Phantom · Calendar · Synced" row (simulated sample
 * data) and its "Operations" log (the conversational engine, off for beta).
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { AFMark } from "@/components/ui/AFMark";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { PreparationOrb } from "./PreparationOrb";

// The prototype's stage: a 290pt square holding a 149pt orb inside a 234pt
// dial (its canvas is 660 units for 290pt; orb radius 170, bezel radius 266).
export const ONE_BREATH_ORB_SIZE = 149;
export const ONE_BREATH_DIAL_SIZE = 234;
const STAGE_HEIGHT = 290;

/** Things One Breath can plan today. Tapping one fills the bar; nothing is sent. */
export const ONE_BREATH_EXAMPLES = [
  "Lift tomorrow at 6:30 AM, want my legs fresh",
  "Dinner with Lilia Friday at 8",
  "Pickleball Saturday at 3",
] as const;

export interface OneBreathCaptureProps {
  social: boolean;
  headingProps?: Record<string, unknown>;
  /** A notice above the bar (for example an ended Moment). */
  alert?: string | null;
  voiceAvailable: boolean;
  voiceListening: boolean;
  voiceBusy: boolean;
  voiceError?: string;
  onTalk: () => void;
  onClose: () => void;
  words: string;
  onChangeWords: (value: string) => void;
  onFocusWords: () => void;
  inputRef?: React.Ref<TextInput>;
  sendDisabled: boolean;
  onSend: () => void;
  examples?: readonly string[];
  /** Wraps a press with the screen's haptic rule. */
  press?: (action: () => void) => () => void;
}

export function oneBreathStatus(listening: boolean, busy: boolean): string {
  if (listening) return "Listening";
  if (busy) return "Starting";
  return "Standby";
}

export function oneBreathHint(available: boolean, listening: boolean, busy: boolean): string {
  if (!available) return "Type your moment";
  if (listening) return "Tap to stop";
  if (busy) return "Tap to cancel";
  return "Tap to talk";
}

export function OneBreathCapture(p: OneBreathCaptureProps) {
  const press = p.press ?? ((a: () => void) => a);
  const examples = p.examples ?? ONE_BREATH_EXAMPLES;
  const orb = (
    <PreparationOrb social={p.social} day={false} size={ONE_BREATH_ORB_SIZE} dial={ONE_BREATH_DIAL_SIZE} />
  );
  return (
    <View style={s.root}>
      <View style={s.top}>
        <View style={s.mark}>
          <AFMark size={15} decorative />
          <View style={s.statusDot} />
          <Text style={s.status}>{oneBreathStatus(p.voiceListening, p.voiceBusy)}</Text>
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Close"
          onPress={press(p.onClose)}
          style={s.round}
        >
          <Icon name="x" size={16} color={T.bone} />
        </Pressable>
      </View>

      <View style={s.stage}>
        {p.voiceAvailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.voiceListening ? "Stop listening" : "Speak your moment"}
            onPress={p.onTalk}
            onAccessibilityTap={p.onTalk}
          >
            {orb}
          </Pressable>
        ) : (
          orb
        )}
        <Text style={s.hint}>{oneBreathHint(p.voiceAvailable, p.voiceListening, p.voiceBusy)}</Text>
      </View>

      <Text {...p.headingProps} style={s.prompt}>
        Plan a Moment. Just say it.
      </Text>
      {p.alert ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {p.alert}
        </Text>
      ) : null}
      {p.voiceError ? (
        <Text accessibilityRole="alert" style={s.alert}>
          {p.voiceError}
        </Text>
      ) : null}

      <View style={s.spacer} />

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={s.chips}
        style={s.chipsBleed}
      >
        {examples.map((c) => (
          <Pressable
            key={c}
            accessibilityRole="button"
            accessibilityLabel={c}
            onPress={press(() => p.onChangeWords(c))}
            style={s.chip}
          >
            <Text style={s.chipText}>{c}</Text>
          </Pressable>
        ))}
      </ScrollView>

      <View style={s.composer}>
        <TextInput
          ref={p.inputRef}
          accessibilityLabel="Your moment"
          value={p.words}
          onFocus={p.onFocusWords}
          onChangeText={p.onChangeWords}
          maxLength={160}
          placeholder={p.voiceAvailable ? "Talk or type to AFORCE" : "Type to AFORCE"}
          placeholderTextColor={T.dim}
          returnKeyType="send"
          onSubmitEditing={p.sendDisabled ? undefined : p.onSend}
          style={s.input}
        />
        {p.voiceAvailable ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={p.voiceListening ? "Stop" : "Speak"}
            onPress={p.onTalk}
            style={[s.round40, s.mic]}
          >
            <Icon name="mic" size={18} color={T.bone} />
          </Pressable>
        ) : null}
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Send"
          accessibilityState={{ disabled: p.sendDisabled }}
          aria-disabled={p.sendDisabled}
          disabled={p.sendDisabled}
          onPress={press(p.onSend)}
          style={[
            s.round40,
            // Warm white is the primary; blue belongs to Social only.
            { backgroundColor: p.social ? T.blue : T.bone },
            // The prototype's send button is always the same warm white; its
            // disabled state is carried for assistive tech, not by fading it.
          ]}
        >
          <Icon name="arrow-up" size={18} color={p.social ? T.onBlue : T.ink} />
        </Pressable>
      </View>
    </View>
  );
}

const MONO = "IBMPlexMono_500Medium";

const s = StyleSheet.create({
  root: { flexGrow: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mark: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.muted },
  status: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: T.bone, textTransform: "uppercase" },
  round: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: T.panel,
    alignItems: "center",
    justifyContent: "center",
  },
  stage: { height: STAGE_HEIGHT, alignItems: "center", justifyContent: "center", marginTop: 4 },
  hint: {
    position: "absolute",
    bottom: 4,
    left: 0,
    right: 0,
    textAlign: "center",
    fontFamily: MONO,
    fontSize: 9.5,
    letterSpacing: 2.1,
    color: T.dim,
    textTransform: "uppercase",
  },
  prompt: {
    fontFamily: "Inter_400Regular",
    fontSize: 15,
    lineHeight: 21,
    color: T.bone,
    opacity: 0.8,
    textAlign: "center",
    marginTop: 18,
    paddingHorizontal: 6,
  },
  alert: { ...T.body, fontSize: 14, lineHeight: 20, color: T.bone, textAlign: "center", marginTop: 12 },
  spacer: { flexGrow: 1, minHeight: 20 },
  chipsBleed: { flexGrow: 0, marginHorizontal: -28 },
  chips: { gap: 8, paddingHorizontal: 28, paddingBottom: 12 },
  chip: {
    minHeight: 40,
    paddingHorizontal: 15,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: T.panel,
    justifyContent: "center",
  },
  chipText: { fontFamily: "Inter_500Medium", fontSize: 13, color: T.bone },
  composer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 6,
    paddingRight: 6,
    paddingLeft: 16,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: T.rule,
    backgroundColor: T.panel,
    // The prototype's bar is 344pt wide in a 390pt screen: 5pt wider each side than the text column.
    marginHorizontal: -5,
  },
  input: { flex: 1, minWidth: 0, minHeight: 40, fontFamily: "Inter_400Regular", fontSize: 16, color: T.bone },
  round40: { width: 40, height: 40, borderRadius: 20, alignItems: "center", justifyContent: "center" },
  mic: { borderWidth: 1, borderColor: T.rule },
  disabled: { opacity: 0.4 },
});
