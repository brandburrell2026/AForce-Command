/**
 * TalkTypeBar — "Talk or type to AFORCE": the text box, the microphone and
 * send, in one rounded bar (the approved prototype's composer). Built once and
 * used by every One Breath state.
 *
 * Presentation only. It records nothing: the screen owns the words, the voice
 * session and what Send does.
 */
import React from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

export interface TalkTypeBarProps {
  social: boolean;
  value: string;
  onChangeText: (value: string) => void;
  onFocus?: () => void;
  inputRef?: React.Ref<TextInput>;
  /** What the text box is called to a screen reader. */
  inputLabel: string;
  placeholder: string;
  voiceAvailable: boolean;
  voiceListening: boolean;
  onTalk: () => void;
  sendDisabled: boolean;
  onSend: () => void;
  /** Wraps a press with the screen's haptic rule. */
  press?: (action: () => void) => () => void;
}

export function TalkTypeBar(p: TalkTypeBarProps) {
  const press = p.press ?? ((a: () => void) => a);
  return (
    <View style={s.composer}>
      <TextInput
        ref={p.inputRef}
        accessibilityLabel={p.inputLabel}
        value={p.value}
        onFocus={p.onFocus}
        onChangeText={p.onChangeText}
        maxLength={160}
        placeholder={p.placeholder}
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
          // 40pt as drawn in the prototype; the touch area is 44pt.
          hitSlop={2}
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
        hitSlop={2}
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
  );
}

const s = StyleSheet.create({
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
});
