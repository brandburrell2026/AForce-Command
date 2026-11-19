/**
 * OneBreathCapture — the Capture step of One Breath, laid out as the approved
 * short version (App Spec v1.8.2, Appendix G · One Breath; prototype
 * "One Breath (short approved version)"):
 *
 *   orb view     one question, the orb, one line, "Type instead"
 *   typing view  the question's field ("A few words is enough") and Continue
 *
 * Presentation only. It records nothing and decides nothing: the screen owns
 * the words, the voice session and what Continue does. Nothing here seals.
 *
 * Gesture: the orb is tap to start, tap to stop. The prototype's hold-to-speak
 * is not built (it needs the safeguards in the orb gesture audit), so the line
 * under the orb says what the control really does.
 */
import React from "react";
import { Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { PreparationOrb } from "./PreparationOrb";

export const ONE_BREATH_CAPTURE_ORB_SIZE = 170;

export interface OneBreathCaptureProps {
  social: boolean;
  /** "What matters tonight?" */
  question: string;
  /** Larger-text mode swaps the display size for a readable one. */
  compactHeading?: boolean;
  headingProps?: Record<string, unknown>;
  /** A notice above the controls (for example an ended Moment). */
  alert?: string | null;

  typingView: boolean;
  voiceAvailable: boolean;
  voiceListening: boolean;
  voiceBusy: boolean;
  voiceError?: string;
  onOrb: () => void;
  onTypeInstead: () => void;
  onBack: () => void;

  words: string;
  onChangeWords: (value: string) => void;
  onFocusWords: () => void;
  inputRef?: React.Ref<TextInput>;
  continueDisabled: boolean;
  onContinue: () => void;
  onReservation: () => void;
  /** Wraps a press with the screen's haptic and saving rules. */
  press?: (action: () => void) => () => void;
}

export function oneBreathOrbLine(listening: boolean, busy: boolean): string {
  if (listening) return "Listening… Tap to stop.";
  if (busy) return "Starting voice… Tap to cancel.";
  return "Tap to speak. Tap again when done.";
}

export function OneBreathCapture(p: OneBreathCaptureProps) {
  const press = p.press ?? ((a: () => void) => a);
  const textButton = (label: string, action: () => void) => (
    <Pressable accessibilityRole="button" hitSlop={6} onPress={press(action)} style={s.textButton}>
      <Text style={s.textButtonText}>{label}</Text>
    </Pressable>
  );
  return (
    <>
      <Text {...p.headingProps} style={[s.title, p.compactHeading && s.compactHeading]}>
        {p.question}
      </Text>
      {p.alert ? (
        <Text accessibilityRole="alert" style={s.body}>
          {p.alert}
        </Text>
      ) : null}

      {!p.typingView ? (
        <>
          {/* The orb sits in the middle of the space; the line and "Type
              instead" stay at the foot, as in the reference. */}
          <View style={s.orbStage}>
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={p.voiceListening ? "Stop listening" : "Speak your moment"}
              onPress={p.onOrb}
              onAccessibilityTap={p.onOrb}
            >
              <PreparationOrb social={p.social} day={false} size={ONE_BREATH_CAPTURE_ORB_SIZE} />
            </Pressable>
          </View>
          <Text style={[s.muted, s.centered]}>{oneBreathOrbLine(p.voiceListening, p.voiceBusy)}</Text>
          {p.voiceError ? (
            <Text accessibilityRole="alert" style={s.body}>
              {p.voiceError}
            </Text>
          ) : null}
          {textButton("Type instead", p.onTypeInstead)}
        </>
      ) : (
        <>
          {p.voiceAvailable ? textButton("Back", p.onBack) : null}
          <Text style={s.muted}>{p.voiceAvailable ? "Your moment" : "Type your moment"}</Text>
          <TextInput
            ref={p.inputRef}
            accessibilityLabel="Your moment"
            value={p.words}
            onFocus={p.onFocusWords}
            onChangeText={p.onChangeWords}
            multiline
            maxLength={160}
            placeholder="A few words is enough"
            placeholderTextColor={T.muted}
            style={s.words}
          />
          {p.voiceError ? (
            <Text accessibilityRole="alert" style={s.body}>
              {p.voiceError}
            </Text>
          ) : null}
          <Pressable
            accessibilityRole="button"
            accessibilityState={{ disabled: p.continueDisabled }}
            aria-disabled={p.continueDisabled}
            disabled={p.continueDisabled}
            onPress={press(p.onContinue)}
            style={[
              s.primary,
              // Warm white is the primary; blue belongs to Social only.
              { backgroundColor: p.social ? T.blue : T.bone },
              p.continueDisabled && s.disabled,
            ]}
          >
            <Text style={[s.primaryText, { color: p.social ? T.onBlue : T.ink }]}>Continue</Text>
          </Pressable>
          {textButton("Use reservation details", p.onReservation)}
        </>
      )}
    </>
  );
}

const s = StyleSheet.create({
  title: { ...T.headline, color: T.bone, marginTop: 24, textAlign: "center" },
  compactHeading: { fontSize: 18, lineHeight: 24, letterSpacing: 0 },
  body: { ...T.body, color: T.bone },
  muted: { ...T.body, color: T.muted, fontSize: 14, lineHeight: 21 },
  centered: { textAlign: "center" },
  orbStage: { flexGrow: 1, minHeight: 260, alignItems: "center", justifyContent: "center" },
  textButton: { minHeight: 44, justifyContent: "center", alignSelf: "center", paddingHorizontal: 12 },
  textButtonText: { fontFamily: "Inter_500Medium", fontSize: 14, color: T.muted, textAlign: "center" },
  words: {
    ...T.body,
    color: T.bone,
    minHeight: 110,
    fontSize: 21,
    lineHeight: 29,
    borderWidth: 1,
    borderColor: T.rule,
    borderRadius: 14,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  primary: { minHeight: 52, borderRadius: 999, paddingHorizontal: 20, justifyContent: "center" },
  primaryText: { fontFamily: "Inter_600SemiBold", fontSize: 16, textAlign: "center" },
  disabled: { opacity: 0.4 },
});
