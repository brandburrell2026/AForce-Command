import { Link, Stack } from "expo-router";
import { StyleSheet, Text, View } from "react-native";

// VS 3.0 foundation: retired the navy/lime scaffold palette (useColors →
// constants/colors) for the brand af.* tokens, mapped by role — screen bg =
// canvas, title = primary text, link affordance = redText (the AA text-role
// Signal Red, NOT the fill red af.red).
import { af } from "@/theme/afTokens";

export default function NotFoundScreen() {
  return (
    <>
      <Stack.Screen options={{ title: "Oops!" }} />
      <View style={[styles.container, { backgroundColor: af.canvas }]}>
        <Text style={[styles.title, { color: af.textPrimary }]}>
          This screen doesn&apos;t exist.
        </Text>

        <Link href="/" style={styles.link}>
          <Text style={[styles.linkText, { color: af.redText }]}>
            Go to home screen!
          </Text>
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  title: {
    fontSize: 20,
    fontWeight: "bold",
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
  },
  linkText: {
    fontSize: 14,
  },
});
