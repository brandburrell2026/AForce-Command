import { Lock, Sunrise, CheckCircle, Zap, ArrowRight } from "lucide-react";

const TEAL = "#7CD3E5";
const AMBER = "#F4B23F";

export function Locked() {
  return (
    <div
      className="min-h-screen flex items-start justify-center px-6 py-10"
      style={{ background: "#0A0A0F", fontFamily: "Inter, sans-serif" }}
    >
      <div
        className="w-[360px] rounded-2xl border p-[14px] flex flex-col gap-3"
        style={{
          borderColor: `${TEAL}40`,
          background: "rgba(124,211,229,0.07)",
        }}
        data-testid="recovery-mode-paywall"
      >
        <div className="flex items-start gap-[10px]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${TEAL}26` }}
          >
            <Lock size={18} color={TEAL} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bold mb-[2px]"
              style={{ color: TEAL, fontSize: 10, letterSpacing: 1.6 }}
            >
              RECOVERY MODE
            </div>
            <div className="font-bold" style={{ color: "#fff", fontSize: 16 }}>
              Wake up clear-headed
            </div>
          </div>
        </div>

        <div
          style={{
            color: "rgba(255,255,255,0.75)",
            fontSize: 13,
            lineHeight: "18px",
          }}
        >
          Recovery+ unlocks a personalized post-session plan with a morning
          estimate, hydration steps, and AForce RTD pacing.
        </div>

        <div className="flex flex-col gap-[6px]">
          {[
            { icon: Sunrise, text: "Personalized morning recovery estimate" },
            { icon: CheckCircle, text: "Pre-sleep checklist (water, RTD, sleep)" },
            { icon: Zap, text: "AForce RTD pacing recommendation" },
          ].map(({ icon: Icon, text }, i) => (
            <div key={i} className="flex items-center gap-[10px]">
              <div className="w-[18px] flex items-center">
                <Icon size={14} color={AMBER} />
              </div>
              <div
                className="flex-1"
                style={{
                  color: "rgba(255,255,255,0.85)",
                  fontSize: 13,
                  lineHeight: "18px",
                }}
              >
                {text}
              </div>
            </div>
          ))}
        </div>

        <div className="flex items-baseline gap-[6px] mt-[2px]">
          <div className="font-bold" style={{ color: "#fff", fontSize: 22 }}>
            $9.99
          </div>
          <div
            className="font-medium"
            style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}
          >
            / month
          </div>
        </div>

        <button
          className="flex items-center justify-center gap-2 rounded-xl py-3"
          style={{ background: TEAL }}
        >
          <ArrowRight size={16} color="#0A0A0F" />
          <span
            className="font-bold"
            style={{ color: "#0A0A0F", fontSize: 14, letterSpacing: 0.4 }}
          >
            Subscribe to Recovery+
          </span>
        </button>

        <div
          style={{
            color: "rgba(255,255,255,0.45)",
            fontSize: 10,
            lineHeight: "14px",
          }}
        >
          Estimate only · Not a legal or medical determination.
        </div>
      </div>
    </div>
  );
}
