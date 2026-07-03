import Monogram from "../Monogram";

const COLS = [
  { h: "Product", items: ["Cans", "Sticks", "The Science", "pH 8.8"] },
  { h: "Brand", items: ["Why AForce", "The Ritual", "Stories", "AForce OS"] },
  { h: "Company", items: ["About", "Careers", "Contact", "Press"] },
];

export default function Footer() {
  return (
    <footer className="border-t border-white/[0.06] px-6 py-20 sm:px-10 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <div className="grid gap-12 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Monogram className="text-3xl text-bone" />
            <p className="mt-8 max-w-xs font-display text-2xl leading-tight tracking-[-0.01em] text-bone">
              Performance Is Non-Negotiable.
            </p>
            <p className="mt-4 font-mono text-[11px] uppercase tracking-[0.2em] text-bone/40">
              Composure before performance
            </p>
          </div>

          <div className="grid grid-cols-3 gap-8 lg:col-span-7">
            {COLS.map((col) => (
              <div key={col.h}>
                <h4 className="font-mono text-[10px] uppercase tracking-[0.2em] text-bone/35">
                  {col.h}
                </h4>
                <ul className="mt-5 space-y-3">
                  {col.items.map((item) => (
                    <li key={item}>
                      <span className="cursor-default text-sm text-bone/55 transition-colors hover:text-bone">
                        {item}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </div>

        <div className="mt-16 flex flex-col items-center justify-between gap-4 border-t border-white/[0.06] pt-8 sm:flex-row">
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone/40">
            AForce Hydration, Inc.
          </span>
          <span className="font-mono text-[11px] uppercase tracking-[0.16em] text-bone/30">
            © {new Date().getFullYear()} · All rights reserved
          </span>
        </div>
      </div>
    </footer>
  );
}
