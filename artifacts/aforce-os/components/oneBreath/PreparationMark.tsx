import React from "react";
import { StyleSheet, Text, View } from "react-native";
import { preparationTokens as T } from "@/theme/DESIGN-TOKENS";

/** Website .nn-logo geometry. The second letter is transformed, not substituted. */
export function PreparationMark({
  size = 34,
  color = T.red,
}: {
  size?: number;
  color?: string;
}) {
  return (
    <View accessible accessibilityLabel="AFORCE" style={s.row}>
      <Text
        style={{
          fontFamily: "Inter_300Light",
          fontSize: size,
          lineHeight: size,
          color,
        }}
      >
        N
      </Text>
      <View
        style={{
          width: size * 0.4,
          height: size * 0.056,
          backgroundColor: color,
          marginHorizontal: size * 0.05,
          transform: [{ translateY: -size * 0.015 }],
        }}
      />
      <Text
        style={{
          fontFamily: "Inter_300Light",
          fontSize: size,
          lineHeight: size,
          color,
          transform: [{ scaleX: -1 }],
        }}
      >
        N
      </Text>
    </View>
  );
}
const s = StyleSheet.create({
  row: { flexDirection: "row", alignItems: "center" },
});
