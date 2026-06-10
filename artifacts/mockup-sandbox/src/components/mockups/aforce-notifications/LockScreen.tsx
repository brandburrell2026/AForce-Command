import { motion } from "framer-motion";
import {
  BG,
  RED,
  RED_GLOW,
  WHITE,
  MUTED,
  MUTED_WHITE,
  FONT,
  NotificationCard,
} from "./_shared";

function LockGlyph() {
  return (
    <svg width={15} height={15} viewBox="0 0 24 24" fill="none">
      <rect
        x="4.5"
        y="10.5"
        width="15"
        height="10.5"
        rx="2.5"
        fill={WHITE}
        opacity={0.92}
      />
      <path
        d="M7.5 10.5V8a4.5 4.5 0 0 1 9 0v2.5"
        stroke={WHITE}
        strokeWidth={1.8}
        strokeLinecap="round"
        opacity={0.92}
        fill="none"
      />
    </svg>
  );
}

export function LockScreen() {
  return (
    <div
      style={{
        minHeight: "100vh",
        width: "100%",
        background: BG,
        fontFamily: FONT,
        display: "flex",
        justifyContent: "center",
        color: WHITE,
      }}
    >
      <div
        style={{
          position: "relative",
          width: "100%",
          maxWidth: 390,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Ambient red glow */}
        <div
          style={{
            position: "absolute",
            top: -160,
            left: "50%",
            transform: "translateX(-50%)",
            width: 460,
            height: 460,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,59,48,0.16) 0%, rgba(255,59,48,0) 68%)",
            pointerEvents: "none",
          }}
        />

        {/* Status bar */}
        <div
          style={{
            position: "relative",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "14px 26px 0",
            fontSize: 13,
            fontWeight: 600,
            color: WHITE,
          }}
        >
          <span>9:41</span>
          <span style={{ letterSpacing: "0.06em", color: MUTED_WHITE }}>•••</span>
        </div>

        {/* Clock lockup */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, ease: "easeOut" as const }}
          style={{
            position: "relative",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            paddingTop: 30,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 7,
              marginBottom: 8,
            }}
          >
            <LockGlyph />
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.32em",
                color: MUTED_WHITE,
                textIndent: "0.32em",
              }}
            >
              AFORCE OS
            </span>
          </div>
          <div
            style={{
              fontSize: 78,
              fontWeight: 700,
              letterSpacing: "-0.03em",
              lineHeight: 1,
              color: WHITE,
            }}
          >
            7:14
          </div>
          <div
            style={{
              marginTop: 8,
              fontSize: 15,
              fontWeight: 500,
              color: MUTED_WHITE,
            }}
          >
            Wednesday, June 10
          </div>
        </motion.div>

        {/* Notification stack */}
        <div
          style={{
            position: "relative",
            marginTop: "auto",
            display: "flex",
            flexDirection: "column",
            gap: 12,
            padding: "0 16px 14px",
          }}
        >
          <NotificationCard
            title="Readiness Window Open"
            message={[
              "The next 30 minutes will determine",
              "how you perform today. Begin your protocol.",
            ]}
            action="Begin Protocol"
            time="now"
            count={3}
            delay={0.25}
          />
          <NotificationCard
            title="Hydration Level Dropping"
            message={[
              "Pause. Hydrate. Lock In.",
              "Your readiness score is beginning to decline.",
            ]}
            action="Hydrate Now"
            time="2m ago"
            delay={0.4}
          />
          <NotificationCard
            title="Start Your Readiness Ritual"
            message={[
              "Today's performance begins now.",
              "Pause. Hydrate. Lock In. Perform.",
            ]}
            time="7:00 AM"
            delay={0.55}
          />

          {/* Swipe hint */}
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: 10,
              paddingTop: 8,
            }}
          >
            <span style={{ fontSize: 11, color: MUTED, letterSpacing: "0.04em" }}>
              Swipe up to open
            </span>
            <div
              style={{
                width: 120,
                height: 5,
                borderRadius: 3,
                background: "rgba(245,245,245,0.22)",
              }}
            />
          </div>
        </div>

        {/* Faint baseline accent */}
        <div
          style={{
            position: "absolute",
            bottom: 0,
            left: 0,
            right: 0,
            height: 1,
            background: `linear-gradient(90deg, transparent, ${RED_GLOW}, transparent)`,
            opacity: 0.4,
            boxShadow: `0 0 8px ${RED}`,
          }}
        />
      </div>
    </div>
  );
}
