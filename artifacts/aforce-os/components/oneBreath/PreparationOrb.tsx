import React from "react";
import { AccessibilityInfo, Animated, StyleSheet, View } from "react-native";
import Svg, { ClipPath, Defs, Ellipse, G, LinearGradient, RadialGradient, Stop, Circle, Line } from "react-native-svg";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";
import { PreparationMark } from "./PreparationMark";

export function PreparationOrb({
  day,
  social,
  moon = false,
  size = 150,
  dial,
}: {
  day: boolean;
  social: boolean;
  moon?: boolean;
  /** Diameter in points. The capture screen uses 170 (prototype). */
  size?: number;
  /** Outer diameter of a still ring of tick marks drawn around the orb (prototype One Breath). */
  dial?: number;
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
  // Inside its dial (the One Breath screen), the personal orb is drawn as the
  // approved prototype draws it: a deeper sphere with an edge shade, a soft
  // bloom, one specular highlight and a rim. Geometry below is the prototype's
  // canvas (radius R = 74 in this 150 box), not invented. Social keeps its own.
  const deep = !!dial && !social && !moon;
  const D = T.oneBreathDeep;
  const R = 74;
  const orb = (
    <Animated.View
      accessible={false}
      style={[
        s.orb,
        // Round, so the glow is a halo around the sphere and never a square.
        { width: size, height: size, borderRadius: size / 2, shadowColor: colors[2], transform: [{ scale }] },
        deep && s.orbDeep,
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
        {deep ? (
          <>
            <Defs>
              <RadialGradient id={`${id}d`} gradientUnits="userSpaceOnUse" cx={75 + R * 0.05} cy={75 + R * 0.08} r={R * 1.08} fx={75 - R * 0.25} fy={75 - R * 0.3}>
                {D.ramp.map((color, i) => (
                  <Stop key={color} offset={D.stops[i]} stopColor={color} />
                ))}
              </RadialGradient>
              <RadialGradient id={`${id}s`} gradientUnits="userSpaceOnUse" cx={75} cy={75} r={R * 1.05} fx={75 + R * 0.3} fy={75 + R * 0.38}>
                <Stop offset="0" stopColor={D.shade} stopOpacity={0} />
                <Stop offset=".7" stopColor={D.shade} stopOpacity={0.18} />
                <Stop offset="1" stopColor={D.shade} stopOpacity={0.55} />
              </RadialGradient>
              <RadialGradient id={`${id}b`} gradientUnits="userSpaceOnUse" cx={75 - R * 0.36} cy={75 - R * 0.44} r={R * 0.55}>
                <Stop offset="0" stopColor={D.bloom} stopOpacity={0.2} />
                <Stop offset="1" stopColor={D.bloom} stopOpacity={0} />
              </RadialGradient>
              <RadialGradient id={`${id}h`} cx="50%" cy="50%" r="50%">
                <Stop offset="0" stopColor={D.specular} stopOpacity={0.62} />
                <Stop offset=".5" stopColor={D.specular} stopOpacity={0.14} />
                <Stop offset="1" stopColor={D.specular} stopOpacity={0} />
              </RadialGradient>
              <LinearGradient id={`${id}r`} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={D.rimLight} stopOpacity={0.38} />
                <Stop offset=".45" stopColor={D.rimLight} stopOpacity={0.04} />
                <Stop offset="1" stopColor={D.rimLow} stopOpacity={0.22} />
              </LinearGradient>
              <ClipPath id={`${id}c`}>
                <Circle cx={75} cy={75} r={R} />
              </ClipPath>
            </Defs>
            <Circle cx={75} cy={75} r={R} fill={`url(#${id}d)`} />
            <G clipPath={`url(#${id}c)`}>
              <Circle cx={75} cy={75} r={R} fill={`url(#${id}s)`} />
              <Circle cx={75 - R * 0.36} cy={75 - R * 0.44} r={R * 0.55} fill={`url(#${id}b)`} />
              <Ellipse
                cx={75 - R * 0.42}
                cy={75 - R * 0.52}
                rx={R * 0.2 * 1.6}
                ry={R * 0.2 * 0.75}
                fill={`url(#${id}h)`}
                transform={`rotate(-34 ${75 - R * 0.42} ${75 - R * 0.52})`}
              />
            </G>
            <Circle cx={75} cy={75} r={R - 0.5} fill="none" stroke={`url(#${id}r)`} strokeWidth={1.1} />
          </>
        ) : (
          <Circle cx={75} cy={75} r={74} fill={`url(#${id})`} />
        )}
        {moon && !day ? (
          <Circle cx={104} cy={45} r={61} fill={T.ink} />
        ) : null}
      </Svg>
      {!moon ? <PreparationMark size={Math.round(size * 0.227)} color={T.bone} /> : null}
    </Animated.View>
  );
  if (!dial) return orb;
  const c = dial / 2;
  // The prototype's bezel: 120 ticks, every tenth longer and brighter.
  const ticks = 120;
  return (
    <View style={{ width: dial, height: dial, alignItems: "center", justifyContent: "center" }}>
      <Svg width={dial} height={dial} style={StyleSheet.absoluteFill}>
        {Array.from({ length: ticks }).map((_, i) => {
          const a = (i / ticks) * 2 * Math.PI - Math.PI / 2;
          const major = i % 10 === 0;
          const outer = c - 1;
          const inner = outer - (major ? 10.5 : 7);
          return (
            <Line
              key={i}
              x1={c + Math.cos(a) * inner}
              y1={c + Math.sin(a) * inner}
              x2={c + Math.cos(a) * outer}
              y2={c + Math.sin(a) * outer}
              stroke={T.bone}
              strokeOpacity={major ? 0.38 : 0.14}
              strokeWidth={major ? 1.3 : 0.9}
            />
          );
        })}
      </Svg>
      {orb}
    </View>
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
  // The prototype's glow: a little stronger and tighter than the default orb's.
  orbDeep: { shadowOpacity: 0.5, shadowRadius: 35 },
});
