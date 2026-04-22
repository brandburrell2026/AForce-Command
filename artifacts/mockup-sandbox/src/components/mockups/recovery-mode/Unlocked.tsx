import { Sunrise, Droplet, Zap, Moon } from "lucide-react";

const TEAL = "#7CD3E5";
const AMBER = "#F4B23F";

export function Unlocked() {
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
        data-testid="recovery-mode-card"
      >
        <div className="flex items-start gap-[10px]">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center shrink-0"
            style={{ background: `${TEAL}26` }}
          >
            <Sunrise size={18} color={TEAL} />
          </div>
          <div className="flex-1 min-w-0">
            <div
              className="font-bold mb-[2px]"
              style={{ color: TEAL, fontSize: 10, letterSpacing: 1.6 }}
            >
              RECOVERY MODE
            </div>
            <div
              className="font-medium"
              style={{ color: "rgba(255,255,255,0.65)", fontSize: 12 }}
            >
              Estimated time to clear
            </div>
            <div
              className="font-bold mt-[2px]"
              style={{ color: "#fff", fontSize: 18 }}
            >
              3h 20m
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-[6px]">
          <div
            className="font-bold mb-1"
            style={{ color: AMBER, fontSize: 10, letterSpacing: 1.6 }}
          >
            BEFORE BED
          </div>
          {[
            { icon: Droplet, text: "Drink 20 oz of water before bed." },
            { icon: Zap, text: "Take 1 AForce RTD now." },
            { icon: Moon, text: "Aim for 7+ hours of sleep." },
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
