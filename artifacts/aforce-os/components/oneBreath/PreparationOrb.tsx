import React from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { PreparationMark } from "./PreparationMark";

export function PreparationOrb({
  day,
  social,
  moon = false,
  size = 150,
}: {
  day: boolean;
  social: boolean;
  moon?: boolean;
  /** Diameter in points. The capture screen uses 170 (prototype). */
  size?: number;
}) {
  const scale = React.useRef(new Animated.Value(1)).current;
  const [reduced, setReduced] = React.useState(true);
  const id = React.useId().replace(/:/g, "");
  React.useEffect(() => {
    let mounted = true;
    void AccessibilityInfo.isReduceMotionEnabled().then((v) => {
      if (mounted) setReduced(v);
    });
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduced,
    );
    return () => {
      mounted = false;
      sub.remove();
    };
  }, []);
  React.useEffect(() => {
    if (reduced) {
      scale.setValue(1);
      return;
    }
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(scale, {
          toValue: 1.06,
          duration: T.breathMs / 2,
          useNativeDriver: true,
        }),
        Animated.timing(scale, {
          toValue: 1,
          duration: T.breathMs / 2,
          useNativeDriver: true,
        }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [reduced, scale]);
  // Master Brief §2: the One Breath orb is Signal Red and the Social orb is
  // Proof Blue. The orange orb and the daytime sun orb are retired, so `day`
  // no longer changes the colour; it only decides whether the moon is drawn.
  const colors = social ? T.social : T.oneBreath;
  return (
    <Animated.View
      accessible={false}
      style={[
        s.orb,
        { width: size, height: size, shadowColor: colors[2], transform: [{ scale }] },
      ]}
    >
      <Svg width={size} height={size} viewBox="0 0 150 150" style={StyleSheet.absoluteFill}>
        <Defs>
          {/* The Master Brief gradient is "circle at 34% 28%" running to the
              farthest corner (about 98% of the width) with stops at 0 / 32 /
              62 / 100. A 75% radius ended early and left a hard dark edge. */}
          <RadialGradient id={id} cx="34%" cy="28%" r="98%">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset=".32" stopColor={colors[1]} />
            <Stop offset=".62" stopColor={colors[2]} />
            <Stop offset="1" stopColor={colors[3]} />
          </RadialGradient>
        </Defs>
        <Circle cx={75} cy={75} r={74} fill={`url(#${id})`} />
        {moon && !day ? (
          <Circle cx={104} cy={45} r={61} fill={T.ink} />
        ) : null}
      </Svg>
      {!moon ? <PreparationMark size={Math.round(size * 0.227)} color={T.bone} /> : null}
    </Animated.View>
  );
}
const s = StyleSheet.create({
  orb: {
    width: 150,
    height: 150,
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginVertical: 24,
    // The orb is the one glowing object in the app (Master Brief §2).
    shadowOpacity: 0.4,
    shadowRadius: 40,
    shadowOffset: { width: 0, height: 0 },
  },
});
