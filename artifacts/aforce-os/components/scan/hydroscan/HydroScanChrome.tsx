/**
 * HydroScan chrome — the Scan screen laid out as the approved HydroScan
 * prototype lays it out: the reader edge to edge, a top bar (close, the name,
 * the light), a frame of four corner marks, one hint, the two ways in
 * (Barcode, Type it), and results in a sheet that rises over the reader.
 *
 * Barcode only (founder decision, 2026-11-20). The prototype's Drink mode,
 * its round capture button and its Container / Size / Level / Match panel are
 * left out on purpose: the app reads a barcode and measures nothing, and the
 * screen must not look as if it does. The frame does not move: a sweeping
 * line would read as analysing something.
 *
 * Presentation only. Sizes are the prototype's, measured at 368pt wide.
 */
import React from "react";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Icon, type IconName } from "@/components/Icon";
import { af, withAlpha } from "@/theme/afTokens";

const MONO = "IBMPlexMono_500Medium";
const VEIL = withAlpha(af.canvas, 0.6);
const MARK = withAlpha(af.textPrimary, 0.92);

function RoundButton({ icon, label, onPress, active, testID }: { icon: IconName; label: string; onPress: () => void; active?: boolean; testID?: string }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={active === undefined ? undefined : { selected: active }}
      onPress={onPress}
      style={[s.round, active && s.roundOn]}
      testID={testID}
    >
      <Icon name={icon} size={18} color={active ? af.onPrimaryFill : af.textPrimary} />
    </Pressable>
  );
}

/** Close, the name, and the light. The light is offered only where a reader is running. */
export function HydroScanTopBar({ onClose, torch, onTorch }: { onClose: () => void; torch: boolean; onTorch?: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[s.top, { paddingTop: Math.max(insets.top, 12) + 4 }]}>
      <RoundButton icon="x" label="Close HydroScan" onPress={onClose} testID="hydroscan-close" />
      <Text accessibilityRole="header" style={s.title}>HYDROSCAN</Text>
      {onTorch ? (
        <RoundButton icon="zap" label={torch ? "Turn the light off" : "Turn the light on"} onPress={onTorch} active={torch} testID="hydroscan-light" />
      ) : (
        <View style={s.roundSpace} />
      )}
    </View>
  );
}

/** Four corner marks and the one line that says what to do. */
export function HydroScanFrame({ hint, note }: { hint: string; note?: string }) {
  return (
    <View pointerEvents="none" style={s.frameWrap} accessible accessibilityRole="image" accessibilityLabel={note ? `${hint}. ${note}` : hint}>
      <View style={s.frame}>
        <View style={[s.corner, s.tl]} />
        <View style={[s.corner, s.tr]} />
        <View style={[s.corner, s.bl]} />
        <View style={[s.corner, s.br]} />
      </View>
      <View style={s.hint}>
        <View style={s.hintDot} />
        <Text style={s.hintText}>{hint}</Text>
      </View>
      {note ? <Text style={s.note}>{note}</Text> : null}
    </View>
  );
}

export interface HydroScanMode {
  key: string;
  label: string;
  accessibilityLabel?: string;
  onPress: () => void;
}

/** The ways in, as one pill. The selected one is the reader that is running. */
export function HydroScanModes({ modes, selected }: { modes: readonly HydroScanMode[]; selected: string }) {
  return (
    <View style={s.seg} accessibilityRole="tablist">
      {modes.map((m) => {
        const on = m.key === selected;
        return (
          <Pressable
            key={m.key}
            accessibilityRole="button"
            accessibilityLabel={m.accessibilityLabel ?? m.label}
            accessibilityState={{ selected: on }}
            onPress={m.onPress}
            hitSlop={{ top: 4, bottom: 4 }}
            style={[s.segBtn, on && s.segOn]}
            testID={`hydroscan-mode-${m.key}`}
          >
            <Text style={[s.segText, on && s.segTextOn]}>{m.label}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

/** The foot of the reader: the modes, then whatever else the screen offers. */
export function HydroScanFoot({ children }: { children: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[s.foot, { paddingBottom: Math.max(insets.bottom, 14) + 8 }]}>{children}</View>;
}

/** A result rises over the reader in a sheet; the reader stays behind it. */
export function HydroScanSheet({ children, testID }: { children: React.ReactNode; testID?: string }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.sheet} testID={testID}>
      <ScrollView contentContainerStyle={[s.sheetContent, { paddingBottom: Math.max(insets.bottom, 14) + 18 }]} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled">
        {children}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  top: { position: "absolute", top: 0, left: 0, right: 0, paddingHorizontal: 18, flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  round: { width: 46, height: 46, borderRadius: 23, backgroundColor: VEIL, alignItems: "center", justifyContent: "center" },
  roundOn: { backgroundColor: af.primaryFill },
  roundSpace: { width: 46, height: 46 },
  title: { fontFamily: MONO, fontSize: 11, letterSpacing: 2.2, color: af.textPrimary },
  frameWrap: { ...StyleSheet.absoluteFillObject, alignItems: "center", justifyContent: "center" },
  frame: { width: 180, aspectRatio: 0.5, maxHeight: "44%" },
  corner: { position: "absolute", width: 22, height: 22, borderColor: MARK },
  tl: { top: 0, left: 0, borderTopWidth: 1.5, borderLeftWidth: 1.5, borderTopLeftRadius: 10 },
  tr: { top: 0, right: 0, borderTopWidth: 1.5, borderRightWidth: 1.5, borderTopRightRadius: 10 },
  bl: { bottom: 0, left: 0, borderBottomWidth: 1.5, borderLeftWidth: 1.5, borderBottomLeftRadius: 10 },
  br: { bottom: 0, right: 0, borderBottomWidth: 1.5, borderRightWidth: 1.5, borderBottomRightRadius: 10 },
  hint: { marginTop: 22, flexDirection: "row", alignItems: "center", gap: 9, paddingHorizontal: 14, minHeight: 34, borderRadius: 999, backgroundColor: VEIL },
  hintDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: af.textPrimary },
  hintText: { fontFamily: MONO, fontSize: 11, letterSpacing: 1.6, color: af.textPrimary },
  note: { marginTop: 10, fontFamily: MONO, fontSize: 9.5, letterSpacing: 1.4, color: af.textSecondary },
  foot: { position: "absolute", left: 0, right: 0, bottom: 0, paddingTop: 16, paddingHorizontal: 18, alignItems: "center", backgroundColor: withAlpha(af.canvas, 0.72) },
  seg: { flexDirection: "row", padding: 4, borderRadius: 999, backgroundColor: withAlpha(af.canvas, 0.62) },
  segBtn: { minHeight: 38, minWidth: 84, paddingHorizontal: 16, borderRadius: 999, alignItems: "center", justifyContent: "center" },
  segOn: { backgroundColor: af.primaryFill },
  segText: { fontFamily: "Inter_600SemiBold", fontSize: 13, color: af.textPrimary },
  segTextOn: { color: af.onPrimaryFill },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "82%", backgroundColor: af.surface, borderTopLeftRadius: 28, borderTopRightRadius: 28, borderWidth: 1, borderColor: af.divider },
  sheetContent: { paddingTop: 22, paddingHorizontal: 20 },
});
