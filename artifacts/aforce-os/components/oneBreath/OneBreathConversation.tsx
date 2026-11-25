/**
 * OneBreathConversation — One Breath as the approved prototype runs it: one
 * screen with the mark and a status word, the orb in its dial, the exchange
 * (the member's words, AFORCE's reply, what it heard, numbered steps), and the
 * talk-or-type bar. A complete plan brings up the hold-to-seal bar.
 *
 * Presentation only. Layout values are the prototype's own, measured from its
 * source at 390pt. It decides nothing and saves nothing: the items come from
 * `utils/oneBreath/conversation`, and the screen that owns it carries out
 * every effect and tells this view what happened.
 */
import React from "react";
import { AccessibilityInfo, Animated, Pressable, ScrollView, StyleSheet, Text, type TextInput, View } from "react-native";
import { Icon } from "@/components/Icon";
import { AFMark } from "@/components/ui/AFMark";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import type { ConversationItem } from "@/utils/oneBreath/conversation";
import { OperationsLog, ResultCard, TalkTypeBar, UndoStrip } from "./kit";
import { PreparationOrb } from "./PreparationOrb";

/**
 * The stage once the exchange starts. The prototype's is a 176pt square (290pt
 * at rest); the orb is drawn 20% larger than that here at the founder's
 * direction after seeing it on a phone (2026-11-21): 211pt stage, 108pt orb.
 */
export const CONVERSATION_STAGE = Math.round(176 * 1.2);
export const CONVERSATION_ORB = Math.round((149 * CONVERSATION_STAGE) / 290);
export const CONVERSATION_DIAL = Math.round((234 * CONVERSATION_STAGE) / 290);
/** Before the first words the orb rests at its full size, as on the opening screen (290pt stage, 149pt orb, 234pt dial). */
export const RESTING_STAGE = 290;
export const RESTING_ORB = 149;
export const RESTING_DIAL = 234;

export interface OneBreathConversationProps {
  social: boolean;
  /** Standby, Listening, Operating, Quiet. */
  status: string;
  items: readonly ConversationItem[];
  /** A complete plan is waiting: show hold-to-seal. */
  awaitingSeal: boolean;
  onSeal: () => void;
  onChoice: (label: string) => void;
  onUndo: () => void;
  /** A button on an open plan: Lock In, Plans changed, Heading back and so on. */
  onAction?: (id: string) => void;
  /** The plan is locked in: the orb wears its Quiet ring. */
  quiet?: boolean;
  /** Replaces the bar's usual hint, e.g. "What changed?". */
  placeholder?: string;
  onClose: () => void;
  onTalk: () => void;
  voiceAvailable: boolean;
  voiceListening: boolean;
  words: string;
  onChangeWords: (value: string) => void;
  onSend: () => void;
  inputRef?: React.Ref<TextInput>;
  /** Shown before anything has been said. */
  prompt: string;
}

export function OneBreathConversation(p: OneBreathConversationProps) {
  const scroll = React.useRef<ScrollView>(null);
  React.useEffect(() => {
    scroll.current?.scrollToEnd({ animated: true });
  }, [p.items.length, p.awaitingSeal]);

  const resting = p.items.length === 0;
  const orb = resting ? RESTING_ORB : CONVERSATION_ORB;
  const dial = resting ? RESTING_DIAL : CONVERSATION_DIAL;
  const orbView = (
    <View style={s.orbWrap}>
      <PreparationOrb social={p.social} day={false} size={orb} dial={dial} />
      {/* Quiet, as the prototype draws it: a still ring close around the orb. */}
      {p.quiet ? <View pointerEvents="none" style={[s.quietRing, { width: orb + 12, height: orb + 12, borderRadius: (orb + 12) / 2 }]} testID="one-breath-quiet-ring" /> : null}
    </View>
  );

  return (
    <View style={s.root}>
      <View style={s.top}>
        <View style={s.mark}>
          <AFMark size={15} decorative />
          <View style={[s.statusDot, p.status !== "Standby" && { backgroundColor: p.social ? T.blue : T.red }]} />
          <Text accessibilityLiveRegion="polite" style={s.status}>{p.status}</Text>
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={p.onClose} style={s.round}>
          <Icon name="x" size={16} color={T.bone} />
        </Pressable>
      </View>

      <View style={[s.stage, resting && { height: RESTING_STAGE }]}>
        {p.voiceAvailable ? (
          <Pressable accessibilityRole="button" accessibilityLabel={p.voiceListening ? "Stop listening" : "Speak to AFORCE"} onPress={p.onTalk}>
            {orbView}
          </Pressable>
        ) : (
          orbView
        )}
      </View>

      <ScrollView
        ref={scroll}
        style={s.flow}
        contentContainerStyle={s.flowContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        // The latest line is always in view, including when the screen first opens on a long exchange.
        onContentSizeChange={() => scroll.current?.scrollToEnd({ animated: false })}
      >
        {p.items.length === 0 ? <Text style={s.prompt}>{p.prompt}</Text> : null}
        {p.items.map((item) => {
          if (item.kind === "me") {
            return (
              <View key={item.key} style={s.me} accessible accessibilityLabel={`You said: ${item.text}`}>
                <Text style={s.meText}>{item.text}</Text>
              </View>
            );
          }
          if (item.kind === "ai") {
            return (
              <View key={item.key} style={s.ai} accessibilityLiveRegion="polite">
                <Text style={[s.who, p.social && { color: T.blueHi }]}>AFORCE</Text>
                <Text style={s.aiText}>{item.text}</Text>
                {item.choices?.length ? (
                  <View style={s.choices}>
                    {item.choices.map((c) => (
                      <Pressable key={c} accessibilityRole="button" accessibilityLabel={c} onPress={() => p.onChoice(c)} style={s.choice}>
                        <Text style={s.choiceText}>{c}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          }
          if (item.kind === "heard") {
            return (
              <View key={item.key} style={s.heard} accessible accessibilityLabel={`What I heard. ${item.rows.map((r) => `${r.label}: ${r.value}`).join(". ")}`}>
                {item.rows.map((r) => (
                  <View key={r.label} style={s.heardCell}>
                    <Text style={s.heardLabel}>{r.label}</Text>
                    <Text style={s.heardValue}>{r.value}</Text>
                  </View>
                ))}
              </View>
            );
          }
          if (item.kind === "step") return <OperationsLog key={item.key} lines={[item.line]} social={p.social} />;
          if (item.kind === "result") {
            return (
              <View key={item.key} style={s.block}>
                <ResultCard value={item.value} word={item.word} estimated={item.estimated} position={item.value / 100} social={p.social} />
              </View>
            );
          }
          if (item.kind === "moment") {
            return (
              <View key={item.key} style={s.moment} accessible accessibilityLabel={`${item.title}. ${item.when}. ${item.pill}.`} testID="one-breath-open-plan">
                <View style={s.momentWords}>
                  <Text style={s.momentTitle}>{item.title}</Text>
                  <Text style={s.momentWhen}>{item.when}</Text>
                </View>
                <View style={s.pill}>
                  <Text style={s.pillText}>{item.pill}</Text>
                </View>
              </View>
            );
          }
          if (item.kind === "actions") {
            return (
              <View key={item.key} style={s.block}>
                <View style={s.actions}>
                  {item.actions.map((a) => (
                    <Pressable
                      key={a.id}
                      accessibilityRole="button"
                      accessibilityLabel={a.label}
                      accessibilityState={{ disabled: !!a.disabled }}
                      disabled={a.disabled}
                      onPress={() => p.onAction?.(a.id)}
                      style={[s.action, a.primary && s.actionPrimary, a.disabled && s.actionWaiting]}
                      testID={`one-breath-action-${a.id}`}
                    >
                      <Text style={[s.actionText, a.primary && s.actionTextPrimary]}>{a.label}</Text>
                    </Pressable>
                  ))}
                </View>
                {item.note ? <Text style={s.actionNote}>{item.note}</Text> : null}
              </View>
            );
          }
          if (item.kind === "plan") {
            return (
              <View
                key={item.key}
                style={s.plan}
                accessible
                accessibilityLabel={`Your plan. ${item.rows.map((r) => `${r.at}: ${r.text}`).join(". ")}${item.note ? `. ${item.note}` : ""}`}
              >
                {item.rows.map((r, i) => (
                  <View key={`${r.at}-${i}`} style={[s.planRow, i === item.rows.length - 1 && !item.note && s.planRowLast]}>
                    <Text style={s.planAt}>{r.at}</Text>
                    <Text style={s.planText}>{r.text}</Text>
                  </View>
                ))}
                {item.note ? <Text style={s.planNote}>{item.note}</Text> : null}
              </View>
            );
          }
          return (
            <View key={item.key} style={s.block}>
              <UndoStrip reverses={item.reverses} lasts={item.lasts} onUndo={p.onUndo} />
            </View>
          );
        })}
      </ScrollView>

      {p.awaitingSeal ? <SealBar social={p.social} onSeal={p.onSeal} /> : null}

      <TalkTypeBar
        social={p.social}
        value={p.words}
        onChangeText={p.onChangeWords}
        inputRef={p.inputRef}
        inputLabel="Talk or type to AFORCE"
        placeholder={p.placeholder ?? (p.voiceAvailable ? "Talk or type to AFORCE" : "Type to AFORCE")}
        voiceAvailable={p.voiceAvailable}
        voiceListening={p.voiceListening}
        onTalk={p.onTalk}
        sendDisabled={!p.words.trim()}
        onSend={p.onSend}
      />
    </View>
  );
}

/**
 * Hold to seal: the bar fills over the hold and seals only when the hold
 * completes. Letting go early cancels and seals nothing. With Reduce Motion
 * the fill does not animate; the hold still has to be completed.
 */
function SealBar({ social, onSeal }: { social: boolean; onSeal: () => void }) {
  const fill = React.useRef(new Animated.Value(0)).current;
  const timer = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const [reduced, setReduced] = React.useState(false);
  React.useEffect(() => {
    let live = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => { if (live) setReduced(v); });
    return () => { live = false; if (timer.current) clearTimeout(timer.current); };
  }, []);
  const cancel = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    fill.stopAnimation();
    fill.setValue(0);
  };
  const start = () => {
    cancel();
    Animated.timing(fill, { toValue: 1, duration: reduced ? 0 : T.holdMs, useNativeDriver: false }).start();
    timer.current = setTimeout(() => { timer.current = null; onSeal(); }, T.holdMs);
  };
  return (
    <View style={s.seal}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to seal"
        accessibilityHint="Hold until the bar fills. Letting go early seals nothing."
        onPressIn={start}
        onPressOut={cancel}
        // A screen reader's double tap is the member's explicit approval.
        onAccessibilityTap={onSeal}
        style={s.sealButton}
        testID="one-breath-seal"
      >
        <Animated.View
          pointerEvents="none"
          style={[s.sealFill, { backgroundColor: social ? T.blue : T.red, width: fill.interpolate({ inputRange: [0, 1], outputRange: ["0%", "100%"] }) }]}
        />
        <Text style={s.sealText}>Hold to seal</Text>
      </Pressable>
      <Text style={s.sealNote}>Or say “seal it”</Text>
    </View>
  );
}

const MONO = "IBMPlexMono_500Medium";

const s = StyleSheet.create({
  root: { flex: 1 },
  top: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  mark: { flexDirection: "row", alignItems: "center", gap: 10 },
  statusDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: T.muted },
  status: { fontFamily: MONO, fontSize: 10, letterSpacing: 2, color: T.bone, textTransform: "uppercase" },
  round: { width: 42, height: 42, borderRadius: 21, borderWidth: 1, borderColor: T.rule, backgroundColor: T.panel, alignItems: "center", justifyContent: "center" },
  stage: { height: CONVERSATION_STAGE, alignItems: "center", justifyContent: "center" },
  flow: { flex: 1 },
  flowContent: { paddingTop: 6, paddingBottom: 18 },
  prompt: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 21, color: T.bone, opacity: 0.8, textAlign: "center", paddingHorizontal: 6 },
  // The member's words: right-aligned bubble (18 / 18 / 6 / 18).
  me: { alignSelf: "flex-end", maxWidth: "82%", marginTop: 6, marginBottom: 14, paddingVertical: 10, paddingHorizontal: 14, borderRadius: 18, borderBottomRightRadius: 6, backgroundColor: T.panel, borderWidth: 1, borderColor: T.rule },
  meText: { fontFamily: "Inter_400Regular", fontSize: 15.5, lineHeight: 21.5, color: T.bone },
  ai: { marginBottom: 16 },
  who: { fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.9, color: T.redText, marginBottom: 7 },
  aiText: { fontFamily: "Inter_400Regular", fontSize: 16.5, lineHeight: 24, color: T.bone },
  choices: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginTop: 10 },
  choice: { minHeight: 44, paddingHorizontal: 15, borderRadius: 999, borderWidth: 1, borderColor: T.rule, justifyContent: "center" },
  choiceText: { fontFamily: "Inter_500Medium", fontSize: 13, color: T.bone },
  // "What I heard": two columns of mono label over value.
  heard: { flexDirection: "row", flexWrap: "wrap", rowGap: 8, columnGap: 14, marginBottom: 14 },
  heardCell: { width: "46%", gap: 3 },
  heardLabel: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: T.dim, textTransform: "uppercase" },
  heardValue: { fontFamily: "Inter_400Regular", fontSize: 15, lineHeight: 19, color: T.bone },
  block: { marginBottom: 14 },
  orbWrap: { alignItems: "center", justifyContent: "center" },
  quietRing: { position: "absolute", borderWidth: 1.5, borderColor: T.blueHi },
  // An open plan (the prototype's sealed row): name over time, state pill at the right.
  moment: { flexDirection: "row", alignItems: "center", gap: 12, marginBottom: 14, paddingVertical: 12, paddingHorizontal: 14, borderRadius: 14, borderWidth: 1, borderColor: T.rule, backgroundColor: T.panel },
  momentWords: { flex: 1, gap: 4 },
  momentTitle: { fontFamily: "Inter_600SemiBold", fontSize: 15, lineHeight: 20, color: T.bone },
  momentWhen: { fontFamily: MONO, fontSize: 10, letterSpacing: 1.2, color: T.dim, textTransform: "uppercase" },
  pill: { minHeight: 24, paddingHorizontal: 10, borderRadius: 999, borderWidth: 1, borderColor: T.rule, justifyContent: "center" },
  pillText: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: T.bone, textTransform: "uppercase" },
  // The prototype's buttons under a step: a bone pill for the main one, outlined for the rest.
  actions: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
  action: { minHeight: 44, paddingHorizontal: 18, borderRadius: 999, borderWidth: 1, borderColor: T.rule, justifyContent: "center" },
  actionPrimary: { backgroundColor: T.bone, borderColor: T.bone },
  actionWaiting: { opacity: 0.5 },
  actionText: { fontFamily: "Inter_600SemiBold", fontSize: 13.5, color: T.bone },
  actionTextPrimary: { color: T.ink },
  actionNote: { marginTop: 10, fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, color: T.dim },
  // The plan card (the prototype's `.plan`): bone, 14 radius, time at the left, hairline between rows.
  plan: { marginTop: 8, marginBottom: 14, borderRadius: 14, backgroundColor: T.bone, paddingVertical: 4, paddingHorizontal: 14 },
  planRow: { flexDirection: "row", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: T.onBoneRule },
  planRowLast: { borderBottomWidth: 0 },
  planAt: { width: 64, fontFamily: MONO, fontSize: 11, lineHeight: 18, letterSpacing: 0.66, color: T.ink },
  planText: { flex: 1, fontFamily: "Inter_400Regular", fontSize: 14.5, lineHeight: 20, color: T.ink },
  planNote: { fontFamily: "Inter_400Regular", fontSize: 12, lineHeight: 17, color: T.onBoneMuted, paddingVertical: 10 },
  seal: { alignItems: "center", gap: 8, marginBottom: 10 },
  sealButton: { alignSelf: "stretch", minHeight: 58, borderRadius: 999, backgroundColor: T.bone, alignItems: "center", justifyContent: "center", overflow: "hidden" },
  sealFill: { position: "absolute", left: 0, top: 0, bottom: 0, opacity: 0.95 },
  sealText: { fontFamily: "Inter_600SemiBold", fontSize: 16, color: T.ink },
  sealNote: { fontFamily: MONO, fontSize: 9, letterSpacing: 1.4, color: T.dim, textTransform: "uppercase" },
});
