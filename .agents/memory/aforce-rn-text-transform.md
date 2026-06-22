---
name: RN transform on Text is web-only (mirrored glyph)
description: Why the AForce mirrored-N branding renders on web preview but not on Expo Go (native), and the fix.
---

The AForce brand monogram is "N–И": a normal N, an en-dash, then the SAME N
mirrored (a pure horizontal flip, not a different letter). The "ИEGOTIABLE"
caption uses the same trick. The flip is `transform: [{ scaleX: -1 }]`.

**Gotcha:** applying `transform` directly to a React Native `<Text>` element
works on React Native Web (the in-Replit web preview / screenshots) but is
ignored on native (Expo Go / device) — the glyph renders un-flipped as a plain
"N". This is why the inverted N showed in web screenshots but was missing on the
phone.

**Fix:** wrap the glyph `<Text>` in a `<View>` and put the `scaleX:-1` transform
on the **View**. View transforms are reliably supported on native AND web, so the
reflection renders everywhere. Keep the row's `alignItems:'center'` so the wrapped
glyph still vertically matches its sibling Text.

**Why it matters:** verifying brand visuals only in the web preview hides
native-only rendering bugs. Any flipped/rotated/scaled glyph in this app must flip
on a View, never on the Text itself.

**How to apply:** lives in `components/opening/OpeningSequence.tsx`
(MonogramHero + the NON—NEGOTIABLE caption). Do not "simplify" it back onto the
Text style.
