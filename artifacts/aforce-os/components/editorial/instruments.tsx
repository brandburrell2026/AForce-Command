/**
 * Editorial OS signature instruments (E1 foundation) — the four approved
 * Direction-C signatures at PRIMITIVE level only: pressure field, node
 * spine, paper-within-black stock turn, plus the settle motion hook they
 * share. Usage law lives in the spec (docs/aforce-editorial-os-spec-v1.html):
 * each signature appears once per surface at most, and only where it says
 * something true.
 *
 * Motion honors Reduce Motion: `useEdSettle` resolves to the final frame
 * instantly when the OS setting is on, and EdStockTurn's sweep collapses
 * to a static composition. All animations are transform/opacity settles —
 * nothing loops, nothing pulses.
 */
import React from 'react';
import { AccessibilityInfo, Animated, Easing, StyleSheet, View, type ViewStyle } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

import { edAccent, edStock, type EdStockName } from '@/theme/editorialTokens';

import { EdStockContext, useEdInk } from './core';

/**
 * Live OS Reduce Motion preference, with its RESOLUTION state.
 *
 * `AccessibilityInfo.isReduceMotionEnabled()` is async, so for the first
 * frames the answer is genuinely unknown — not "false". Seeding `false` and
 * animating immediately is exactly the race the E2 review caught: a
 * reduce-motion member saw the entrance play (or half-play, then snap)
 * before the promise resolved. `null` means "not answered yet"; callers
 * that animate must WAIT rather than assume.
 */
export function useReduceMotionState(): boolean | null {
  const [reduce, setReduce] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    let mounted = true;
    AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduce(v);
    });
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduce);
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  return reduce;
}

/**
 * Live OS Reduce Motion preference. Unknown resolves to the SAFE answer —
 * `true` (assume reduce) — so nothing decorative can start on a hunch.
 */
export function useReduceMotion(): boolean {
  return useReduceMotionState() ?? true;
}

/**
 * useEdSettle — the system's one entrance: content settles into place
 * (8pt rise + fade, 420ms, decelerating). Returns an animated style to
 * spread onto an Animated.View. With Reduce Motion on, the value starts
 * at 1 — the final frame, no movement.
 */
export function useEdSettle(delayMs = 0): { opacity: Animated.Value; transform: { translateY: Animated.AnimatedInterpolation<number> }[] } {
  const reduce = useReduceMotionState();
  // Start at the FINAL frame and hold there until the OS has actually
  // answered: an unresolved preference must never animate, and content is
  // never invisible while we wait.
  const t = React.useRef(new Animated.Value(1)).current;
  const playedRef = React.useRef(false);
  React.useEffect(() => {
    if (reduce === null) return; // not answered yet — stay on the final frame
    if (reduce || playedRef.current) {
      t.setValue(1);
      return;
    }
    playedRef.current = true;
    t.setValue(0);
    const anim = Animated.timing(t, {
      toValue: 1,
      duration: 420,
      delay: delayMs,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    });
    anim.start();
    return () => anim.stop();
  }, [t, reduce, delayMs]);
  return {
    opacity: t,
    transform: [{ translateY: t.interpolate({ inputRange: [0, 1], outputRange: [8, 0] }) }],
  };
}

/**
 * EdPressureField — the depth instrument: a static radial pressure
 * gradient with hairline isobars, sitting BEHIND a hero numeral. Purely
 * decorative (hidden from accessibility); the numeral it frames carries
 * the information. `intensity` 0..1 scales the field's presence.
 */
export function EdPressureField({
  size = 260,
  intensity = 0.6,
  children,
}: {
  size?: number;
  intensity?: number;
  children?: React.ReactNode;
}) {
  const clamped = Math.min(1, Math.max(0, intensity));
  const half = size / 2;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <View
        accessibilityElementsHidden
        importantForAccessibility="no-hide-descendants"
        pointerEvents="none"
        style={StyleSheet.absoluteFill}
      >
        <Svg width={size} height={size}>
          <Defs>
            <RadialGradient id="edPressure" cx="50%" cy="50%" r="50%">
              <Stop offset="0%" stopColor={edAccent.red} stopOpacity={0.32 * clamped} />
              <Stop offset="55%" stopColor={edAccent.red} stopOpacity={0.1 * clamped} />
              <Stop offset="100%" stopColor={edAccent.red} stopOpacity={0} />
            </RadialGradient>
          </Defs>
          <Rect x={0} y={0} width={size} height={size} fill="url(#edPressure)" />
          {[0.94, 0.72, 0.5].map((r) => (
            <Circle
              key={r}
              cx={half}
              cy={half}
              r={half * r}
              fill="none"
              stroke={edAccent.red}
              strokeOpacity={0.16 * clamped}
              strokeWidth={StyleSheet.hairlineWidth}
            />
          ))}
        </Svg>
      </View>
      {children}
    </View>
  );
}

export type EdNodeState = 'done' | 'live' | 'next';

/**
 * EdNodeSpine — the day as a vertical instrument: a hairline spine with
 * one node per row. Node form (filled / red / hollow) is redundant with
 * the row's own state text — color is never the sole carrier.
 */
export function EdNodeSpine({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  const ink = useEdInk();
  return (
    <View style={[styles.spineWrap, style]}>
      <View style={[styles.spineLine, { backgroundColor: ink.rule }]} />
      <View style={styles.spineRows}>{children}</View>
    </View>
  );
}

export function EdSpineNode({ state }: { state: EdNodeState }) {
  const ink = useEdInk();
  if (state === 'live') {
    return <View style={[styles.node, { backgroundColor: edAccent.red }]} />;
  }
  if (state === 'done') {
    return <View style={[styles.node, { backgroundColor: ink.quiet }]} />;
  }
  return <View style={[styles.node, styles.nodeHollow, { borderColor: ink.quiet }]} />;
}

/** One spine row: the node column + the row's content. */
export function EdSpineRow({ state, children }: { state: EdNodeState; children: React.ReactNode }) {
  return (
    <View style={styles.spineRow}>
      <View style={styles.nodeCol}>
        <EdSpineNode state={state} />
      </View>
      <View style={styles.spineContent}>{children}</View>
    </View>
  );
}

/**
 * EdStockTurn — paper-within-black: a paper plate set into the black OS
 * ground (the deck's page-turn moment, reserved for Feature content).
 * Children render ON PAPER — the component re-establishes the stock
 * context so every editorial primitive inside picks paper inks. Enters
 * with the settle (final frame instantly under Reduce Motion).
 */
export function EdStockTurn({
  children,
  style,
  stock = 'paper',
}: {
  children: React.ReactNode;
  style?: ViewStyle;
  stock?: EdStockName;
}) {
  const settle = useEdSettle();
  return (
    <Animated.View
      style={[
        styles.stockTurn,
        { backgroundColor: stock === 'paper' ? edStock.paper : edStock.black },
        settle,
        style,
      ]}
    >
      <EdStockContext.Provider value={stock}>{children}</EdStockContext.Provider>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  spineWrap: {
    flexDirection: 'row',
  },
  spineLine: {
    position: 'absolute',
    left: 4.5,
    top: 6,
    bottom: 6,
    width: StyleSheet.hairlineWidth,
  },
  spineRows: {
    flex: 1,
    rowGap: 22,
  },
  spineRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  nodeCol: {
    width: 24,
    paddingTop: 5,
    alignItems: 'flex-start',
  },
  node: {
    width: 9,
    height: 9,
    borderRadius: 4.5,
    marginLeft: 0.5,
  },
  nodeHollow: {
    backgroundColor: 'transparent',
    borderWidth: 1,
  },
  spineContent: {
    flex: 1,
  },
  stockTurn: {
    padding: 20,
  },
});
