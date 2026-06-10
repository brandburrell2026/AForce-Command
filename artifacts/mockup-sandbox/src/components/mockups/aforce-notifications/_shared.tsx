import { motion } from "framer-motion";

export const BG = "#000000";
export const RED = "#FF3B30";
export const RED_DIM = "rgba(255,59,48,0.45)";
export const RED_GLOW = "rgba(255,59,48,0.55)";
export const RED_SUBTLE = "rgba(255,59,48,0.12)";
export const WHITE = "#F5F5F5";
export const MUTED = "#6B6B6B";
export const MUTED_WHITE = "rgba(245,245,245,0.55)";
export const GLASS_BG = "rgba(255,255,255,0.055)";
export const GLASS_BORDER = "rgba(255,255,255,0.10)";

export const FONT =
  "Inter, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";

export function Drop({ size = 22, color = WHITE }: { size?: number; color?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M12 2.4C12 2.4 5 10.1 5 15.1a7 7 0 0 0 14 0C19 10.1 12 2.4 12 2.4Z"
        fill={color}
      />
    </svg>
  );
}

export function AppIcon({ count }: { count?: number }) {
  return (
    <div
      style={{
        position: "relative",
        width: 42,
        height: 42,
        borderRadius: 12,
        background: "radial-gradient(circle at 30% 22%, #1c1c1c 0%, #050505 80%)",
        border: `1px solid ${GLASS_BORDER}`,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        boxShadow: `0 0 16px rgba(255,59,48,0.16)`,
        flexShrink: 0,
      }}
    >
      <Drop size={22} color={WHITE} />
      {count != null && (
        <div
          style={{
            position: "absolute",
            top: -6,
            right: -6,
            minWidth: 18,
            height: 18,
            padding: "0 5px",
            borderRadius: 9,
            background: RED,
            color: "#fff",
            fontSize: 11,
            fontWeight: 700,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            border: "2px solid #000",
            boxSizing: "border-box",
            boxShadow: `0 0 10px ${RED_GLOW}`,
          }}
        >
          {count}
        </div>
      )}
    </div>
  );
}

export type NotificationCardProps = {
  title: string;
  message: string[];
  action?: string;
  time?: string;
  count?: number;
  accent?: boolean;
  delay?: number;
};

export function NotificationCard({
  title,
  message,
  action,
  time = "now",
  count,
  accent = true,
  delay = 0,
}: NotificationCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.7, ease: "easeOut" as const, delay }}
      style={{
        position: "relative",
        borderRadius: 22,
        padding: "14px 16px",
        background: GLASS_BG,
        backdropFilter: "blur(26px)",
        WebkitBackdropFilter: "blur(26px)",
        border: `1px solid ${GLASS_BORDER}`,
        boxShadow: "0 10px 34px rgba(0,0,0,0.55)",
        overflow: "hidden",
      }}
    >
      {accent && (
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 16,
            bottom: 16,
            width: 3,
            borderRadius: 3,
            background: RED,
            boxShadow: `0 0 10px ${RED_GLOW}`,
          }}
        />
      )}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <AppIcon count={count} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 6,
            }}
          >
            <span
              style={{
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: "0.2em",
                color: MUTED_WHITE,
              }}
            >
              AFORCE OS
            </span>
            <span style={{ fontSize: 11, color: MUTED }}>{time}</span>
          </div>
          <div
            style={{
              fontSize: 15,
              fontWeight: 700,
              color: WHITE,
              letterSpacing: "-0.01em",
              marginBottom: 4,
              lineHeight: 1.25,
            }}
          >
            {title}
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
            {message.map((line, i) => (
              <div
                key={i}
                style={{
                  fontSize: 13,
                  lineHeight: 1.42,
                  color: MUTED_WHITE,
                }}
              >
                {line}
              </div>
            ))}
          </div>
          {action && (
            <button
              style={{
                marginTop: 13,
                padding: "9px 16px",
                borderRadius: 11,
                background: RED_SUBTLE,
                border: `1px solid ${RED_DIM}`,
                color: RED,
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: "0.08em",
                fontFamily: FONT,
                cursor: "pointer",
              }}
            >
              {action}
            </button>
          )}
        </div>
      </div>
    </motion.div>
  );
}
