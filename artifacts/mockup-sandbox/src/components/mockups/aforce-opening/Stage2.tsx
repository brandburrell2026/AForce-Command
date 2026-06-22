/**
 * Static replica of AForce OS opening-cinematic — Stage 2 (Brand reveal),
 * captured at its resting final frame for visual verification on the canvas.
 *
 * This is a faithful 1:1 still of
 * artifacts/aforce-os/components/opening/OpeningSequence.tsx → StageBrand,
 * using the SAME tokens: BONE #F5F0E8 (monogram + wordmark + caption),
 * signal red #C1281B (caption hairlines + brand rule only), pure black
 * cinematic canvas. Fonts: Archivo Black (display) + IBM Plex Mono (mono).
 *
 * Mirror approach: the second monogram "N" and the leading "N" of
 * NEGOTIABLE are real "N" glyphs flipped with transform: scaleX(-1) — never
 * a Cyrillic character — so the row reads N – И and the caption reads
 * NON — ИEGOTIABLE. The halo is a soft bone radial glow (no hard edge / disc).
 */

const BG = "#0D0D0D";
const BONE = "#F5F0E8";
const BRAND = "#C1281B";

const FONT_DISPLAY = "'Archivo Black', sans-serif";
const FONT_MONO = "'IBM Plex Mono', monospace";

export function Stage2() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        backgroundColor: BG,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 32px",
        boxSizing: "border-box",
      }}
    >
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {/* Eyebrow — IBM Plex Mono, bone, tracked */}
        <div
          style={{
            fontFamily: FONT_MONO,
            fontWeight: 500,
            fontSize: 12,
            letterSpacing: 3,
            color: BONE,
            textTransform: "uppercase",
            marginBottom: 16,
          }}
        >
          PERFORMANCE IS
        </div>

        {/* Wordmark — Archivo Black, bone */}
        <div
          style={{
            fontFamily: FONT_DISPLAY,
            fontSize: 40,
            letterSpacing: 6,
            color: BONE,
            lineHeight: 1,
          }}
        >
          AFORCE
        </div>

        {/* Brand rule — signal red */}
        <div
          style={{
            width: 40,
            height: 2,
            borderRadius: 1,
            backgroundColor: BRAND,
            margin: "18px 0",
          }}
        />

        {/* Monogram hero — N – И over soft bone radial glow */}
        <div
          style={{
            position: "relative",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 2,
            marginBottom: 4,
          }}
        >
          {/* Soft bone/silver radial glow — no hard edge, no visible disc */}
          <div
            aria-hidden
            style={{
              position: "absolute",
              width: 320,
              height: 320,
              borderRadius: "50%",
              background:
                "radial-gradient(circle, rgba(245,240,232,0.09) 0%, rgba(245,240,232,0.035) 55%, rgba(245,240,232,0) 72%)",
              pointerEvents: "none",
            }}
          />
          <div
            style={{
              position: "relative",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 76,
                lineHeight: "84px",
                color: BONE,
              }}
            >
              N
            </span>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 52,
                lineHeight: "84px",
                color: BONE,
                opacity: 0.8,
                margin: "0 8px",
              }}
            >
              –
            </span>
            <span
              style={{
                fontFamily: FONT_DISPLAY,
                fontSize: 76,
                lineHeight: "84px",
                color: BONE,
                display: "inline-block",
                transform: "scaleX(-1)",
              }}
            >
              N
            </span>
          </div>
        </div>

        {/* Caption — NON — ИEGOTIABLE between two red hairlines */}
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            marginTop: 18,
          }}
        >
          <div style={{ width: 26, height: 1, backgroundColor: BRAND, margin: "9px 0" }} />
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontFamily: FONT_MONO,
              fontWeight: 500,
              fontSize: 14,
              letterSpacing: 4,
              color: BONE,
              textTransform: "uppercase",
            }}
          >
            <span>NON&nbsp;—&nbsp;</span>
            <span style={{ display: "inline-block", transform: "scaleX(-1)" }}>N</span>
            <span>EGOTIABLE</span>
          </div>
          <div style={{ width: 26, height: 1, backgroundColor: BRAND, margin: "9px 0" }} />
        </div>
      </div>
    </div>
  );
}
