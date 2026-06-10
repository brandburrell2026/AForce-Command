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
  type NotificationCardProps,
} from "./_shared";

type Entry = { label: string } & NotificationCardProps;

const ENTRIES: Entry[] = [
  {
    label: "Signature",
    title: "Readiness Window Open",
    message: [
      "The next 30 minutes will determine",
      "how you perform today. Begin your protocol.",
    ],
    action: "Begin Protocol",
    time: "now",
    count: 8,
  },
  {
    label: "Hydration Alert",
    title: "Hydration Level Dropping",
    message: [
      "Pause. Hydrate. Lock In.",
      "Your readiness score is beginning to decline.",
    ],
    action: "Hydrate Now",
    time: "1m ago",
  },
  {
    label: "Morning Protocol",
    title: "Start Your Readiness Ritual",
    message: [
      "Today's performance begins now.",
      "Pause. Hydrate. Lock In. Perform.",
    ],
    time: "7:00 AM",
  },
  {
    label: "Midday Alert",
    title: "Maintain Your Edge",
    message: [
      "Hydration consistency drives performance.",
      "Complete your midday protocol.",
    ],
    time: "12:30 PM",
  },
  {
    label: "Evening Alert",
    title: "Recovery Starts Now",
    message: ["Today's recovery determines tomorrow's readiness."],
    time: "9:00 PM",
  },
  {
    label: "Athlete Mode",
    title: "Athlete Mode Unlocked",
    message: [
      "21 days of consistency achieved.",
      "Your ritual is becoming a habit.",
    ],
    time: "Today",
  },
  {
    label: "Membership",
    title: "You're Closer to Membership",
    message: ["Complete today's protocol to continue your progression."],
    time: "Today",
  },
  {
    label: "Readiness Alert",
    title: "Readiness Score Updated",
    message: ["Your readiness score is now 92.", "You're ready to perform."],
    time: "6:45 AM",
  },
  {
    label: "Streak Alert",
    title: "Don't Break The Chain",
    message: ["You have a 14-day performance streak.", "Stay consistent."],
    time: "Yesterday",
  },
  {
    label: "Product Scan",
    title: "Product Analyzed",
    message: [
      "AForce Hydration performed 32% better",
      "than the category average.",
    ],
    action: "View Comparison",
    time: "Yesterday",
  },
];

function SectionLabel({ children }: { children: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        marginTop: 22,
        marginBottom: 10,
      }}
    >
      <span
        style={{
          fontSize: 9.5,
          fontWeight: 600,
          letterSpacing: "0.34em",
          color: RED,
          textIndent: "0.34em",
          textTransform: "uppercase",
        }}
      >
        {children}
      </span>
      <div
        style={{
          flex: 1,
          height: 1,
          background:
            "linear-gradient(90deg, rgba(255,59,48,0.35), rgba(255,255,255,0.04))",
        }}
      />
    </div>
  );
}

export function Catalog() {
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
          padding: "40px 18px 48px",
          boxSizing: "border-box",
          overflow: "hidden",
        }}
      >
        {/* Ambient glow */}
        <div
          style={{
            position: "absolute",
            top: -180,
            left: "50%",
            transform: "translateX(-50%)",
            width: 480,
            height: 480,
            borderRadius: "50%",
            background:
              "radial-gradient(circle, rgba(255,59,48,0.13) 0%, rgba(255,59,48,0) 70%)",
            pointerEvents: "none",
          }}
        />

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" as const }}
          style={{ position: "relative", marginBottom: 8 }}
        >
          <div
            style={{
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: "0.36em",
              color: RED,
              textIndent: "0.36em",
              marginBottom: 14,
            }}
          >
            NOTIFICATION SYSTEM
          </div>
          <h1
            style={{
              margin: 0,
              fontSize: 26,
              fontWeight: 800,
              letterSpacing: "-0.015em",
              lineHeight: 1.12,
              color: WHITE,
            }}
          >
            Performance is
            <br />
            non-negotiable.
          </h1>
          <div
            style={{
              marginTop: 12,
              fontSize: 13,
              fontWeight: 600,
              letterSpacing: "0.04em",
              color: MUTED_WHITE,
            }}
          >
            Pause<span style={{ color: MUTED }}> · </span>Hydrate
            <span style={{ color: MUTED }}> · </span>Lock In
            <span style={{ color: MUTED }}> · </span>Perform
          </div>
          <div
            style={{
              marginTop: 18,
              height: 1,
              background: `linear-gradient(90deg, ${RED_GLOW}, transparent)`,
              opacity: 0.5,
            }}
          />
        </motion.div>

        {/* Entries */}
        {ENTRIES.map((e, i) => (
          <div key={e.title}>
            <SectionLabel>{e.label}</SectionLabel>
            <NotificationCard
              title={e.title}
              message={e.message}
              action={e.action}
              time={e.time}
              count={e.count}
              delay={0.15 + i * 0.06}
            />
          </div>
        ))}

        {/* Footer mantra */}
        <div
          style={{
            position: "relative",
            marginTop: 30,
            textAlign: "center",
            fontSize: 11,
            letterSpacing: "0.2em",
            color: MUTED,
          }}
        >
          A PERSONAL PERFORMANCE COACH
        </div>
      </div>
    </div>
  );
}
