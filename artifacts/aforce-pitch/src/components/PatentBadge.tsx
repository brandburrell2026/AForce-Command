type PatentBadgeProps = {
  className?: string;
};

export default function PatentBadge({ className = "" }: PatentBadgeProps) {
  return (
    <div
      className={`inline-flex items-center gap-[0.6vw] ${className}`}
    >
      <span
        className="inline-flex items-center whitespace-nowrap px-[0.8vw] py-[0.4vh] rounded-full font-body uppercase tracking-[0.32em] text-[0.65vw] font-semibold"
        style={{
          color: "#E25C5C",
          border: "1px solid rgba(226,92,92,0.55)",
          background: "rgba(226,92,92,0.08)",
        }}
      >
        Proprietary IP &amp; Patent Applications Filed
      </span>
      <span className="font-body uppercase tracking-[0.28em] text-[0.65vw] text-text/55 font-semibold">
        U.S. Prov. 64/057,695
      </span>
    </div>
  );
}
