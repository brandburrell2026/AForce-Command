import React from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import Svg, { Defs, RadialGradient, Stop, Circle } from "react-native-svg";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { PreparationMark } from "./PreparationMark";

export function PreparationOrb({
  day,
  social,
  moon = false,
}: {
  day: boolean;
  social: boolean;
  moon?: boolean;
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
  const colors = day ? T.sun : social ? T.social : T.orange;
  return (
    <Animated.View
      accessible={false}
      style={[s.orb, { transform: [{ scale }] }]}
    >
      <Svg width={150} height={150} style={StyleSheet.absoluteFill}>
        <Defs>
          <RadialGradient id={id} cx="34%" cy="28%" rx="75%" ry="75%">
            <Stop offset="0" stopColor={colors[0]} />
            <Stop offset=".34" stopColor={colors[1]} />
            <Stop offset=".68" stopColor={colors[2]} />
            <Stop offset="1" stopColor={colors[3]} />
          </RadialGradient>
        </Defs>
        <Circle cx={75} cy={75} r={74} fill={`url(#${id})`} />
        {moon && !day ? (
          <Circle cx={104} cy={45} r={61} fill={T.midnight} />
        ) : null}
      </Svg>
      {!moon ? <PreparationMark size={34} color={T.bone} /> : null}
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
  },
});
