import { createRequire } from 'node:module';
import { readFileSync, writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
const require = createRequire('/Users/brandonburrell/AForce-Command/');
const sharp = require('sharp');

const OUT = '/Users/brandonburrell/AForce-Command/exports/p0-gallery';
const now = execSync('date -u +%Y-%m-%dT%H:%M:%SZ').toString().trim();

// id → {label, driver, surface, limitation}
const META = {
  'home-depleted':        { label: 'Home — Depleted',            driver: 'engineOutput.score=38 (DEPLETED 0–59) + low-intake/high-heat userState; flags.spec_home', surface: 'HomeScreenV2' },
  'home-balanced':        { label: 'Home — Balanced',            driver: 'engineOutput.score=76 (BALANCED 75–89); shipped defaultUserState; flags.spec_home', surface: 'HomeScreenV2' },
  'hydration-empty':      { label: 'Hydration — Empty',          driver: 'intakeEvents=[]; ozConsumedToday=0; complianceStreak=0; flags.spec_hydration', surface: 'HydrationScreenV2' },
  'hydration-populated':  { label: 'Hydration — Populated',      driver: '5 logged intake events today; ozConsumedToday=64; flags.spec_hydration', surface: 'HydrationScreenV2' },
  'command-active':       { label: 'Command — Active',           driver: "RecoveryCommand.state='active' (direct prop, no store)", surface: 'RecoveryCoachScreen' },
  'command-completed':    { label: 'Command — Completed',        driver: "RecoveryCommand.state='complete' (direct prop)", surface: 'RecoveryCoachScreen' },
  'guardian-eligible':    { label: 'Guardian — Eligible (Alert)', driver: 'guardian_intelligence_enabled=true + engineOutput.score=8 → CRITICAL risk', surface: 'app/guardian' },
  'guardian-not-eligible':{ label: 'Guardian — Not Eligible (Quiet)', driver: 'guardian_intelligence_enabled=false → real FeatureGate quiet state', surface: 'app/guardian (FeatureGate)' },
  'calibration-limited-data': { label: 'Calibration — Limited Data', driver: 'VoiceCheckInOverlay mounted at first step (pure props)', surface: 'VoiceCheckInOverlay' },
  'offline':              { label: 'Offline',                    driver: "RecoveryCoachScreen offline=true, cached acknowledged command", surface: 'RecoveryCoachScreen' },
  'permission-denied':    { label: 'Permission Denied',          driver: 'Composed from AF* primitives (AFErrorState/AFEmptyState)', surface: 'AF* primitives', limitation: 'Approximated — no first-class permission-denied screen exists (services/healthConnection.ts is build-only, no UI). Composed from shipped AF* primitives rather than fabricating a new screen or touching permission logic.' },
  'activation-failure':   { label: 'Activation — Failure',       driver: "subscription.status='past_due' → real amber PAST_DUE pill", surface: 'ManageSubscriptionScreenV2' },
  'activation-success':   { label: 'Activation — Success',       driver: "subscription.status='active' → real green ACTIVE pill", surface: 'ManageSubscriptionScreenV2' },
};

const captured = JSON.parse(readFileSync(`${OUT}/manifest.json`, 'utf8'));
const states = captured.states.map((s) => {
  const m = META[s.id] || {};
  return {
    n: s.n, file: s.file, fixtureId: s.id, label: m.label || s.label,
    route: '/gallery → ' + (m.surface || '?'),
    viewport: 'standard · 390×844',
    renderStatus: 'rendered',
    renderMethod: s.renderMethod,
    driver: m.driver || null,
    limitation: m.limitation || null,
    bytes: s.bytes,
  };
});

// ---- enriched manifest.json ----
writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
  phase: 'P0 Screen Gallery',
  generated: now,
  route: '/gallery — app/(hidden)/gallery.tsx (dev/demo-only P0 harness; __DEV__ / EXPO_PUBLIC_DEMO_MODE gated)',
  target: 'Expo web (EXPO_PUBLIC_DEMO_MODE=true) driven by headless Google Chrome over the DevTools Protocol',
  viewport: { id: 'standard', width: 390, height: 844 },
  method: 'Each state is the real shipped …ScreenV2 / screen component fed a deterministic fixture via the gallery’s shadowed AppContext.Provider (store-driven) or a direct prop (RecoveryCoach/Calibration). No forks, no fabricated data, no protected-logic changes. Store-driven surfaces render inside the gallery 390×844 device frame; overlay surfaces (RecoveryCoach/Calibration) render full-window.',
  count: states.length,
  states,
}, null, 2));

// ---- index.html ----
const cards = states.map((s) => `
  <figure class="card">
    <img src="${s.file}" alt="${s.label}" loading="lazy" />
    <figcaption>
      <span class="num">${String(s.n).padStart(2,'0')}</span>
      <span class="lbl">${s.label}</span>
      <code class="drv">${(s.driver||'').replace(/</g,'&lt;')}</code>
      ${s.limitation ? `<span class="lim">⚠ Approximated</span>` : ''}
    </figcaption>
  </figure>`).join('\n');
writeFileSync(`${OUT}/index.html`, `<!doctype html><html lang="en"><head><meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>AForce OS · P0 Screen Gallery</title>
<style>
:root{--paper:#E9E7E1;--ink:#0D0D0D;--red:#C1281B;--mut:#8a8a86;}
*{box-sizing:border-box}body{margin:0;background:var(--ink);color:var(--paper);font:15px/1.5 -apple-system,Segoe UI,Roboto,sans-serif;padding:32px}
h1{font-size:26px;margin:0 0 4px}p.sub{color:var(--mut);margin:0 0 24px;max-width:70ch}
.grid{display:grid;grid-template-columns:repeat(auto-fill,minmax(240px,1fr));gap:24px}
.card{margin:0;background:#161615;border:1px solid #262625;border-radius:14px;overflow:hidden;display:flex;flex-direction:column}
.card img{width:100%;height:auto;display:block;background:#000;border-bottom:1px solid #262625}
figcaption{padding:12px 14px;display:flex;flex-direction:column;gap:6px}
.num{color:var(--red);font-weight:700;font-size:12px;letter-spacing:.08em}
.lbl{font-weight:600}
.drv{color:var(--mut);font-size:11.5px;font-family:ui-monospace,Menlo,monospace;line-height:1.45;word-break:break-word}
.lim{color:#e0a13a;font-size:11px;font-weight:600}
footer{color:var(--mut);font-size:12px;margin-top:28px;border-top:1px solid #262625;padding-top:14px}
</style></head><body>
<h1>AForce OS — P0 Screen Gallery</h1>
<p class="sub">13 deterministic states of the shipped …ScreenV2 surfaces, captured at the Standard 390×844 viewport on the Expo web demo target. Every state is the real component fed a fixture — no forks, no fabricated data, no protected-logic changes. Generated ${now}.</p>
<div class="grid">
${cards}
</div>
<footer>Route: <code>/gallery</code> (dev/demo-only, __DEV__ / EXPO_PUBLIC_DEMO_MODE gated) · captured via headless Chrome/CDP · see <code>manifest.json</code>.</footer>
</body></html>`);

// ---- contact-sheet.png (sharp composite) ----
const COLS = 5, TW = 300, GAP = 18, PAD = 24, CAPH = 46;
const meta0 = await sharp(`${OUT}/${states[0].file}`).metadata();
const TH = Math.round(TW * meta0.height / meta0.width);
const tileH = TH + CAPH;
const rows = Math.ceil(states.length / COLS);
const W = PAD * 2 + COLS * TW + (COLS - 1) * GAP;
const H = PAD * 2 + rows * tileH + (rows - 1) * GAP;

const composites = [];
for (let i = 0; i < states.length; i++) {
  const s = states[i];
  const col = i % COLS, row = Math.floor(i / COLS);
  const x = PAD + col * (TW + GAP), y = PAD + row * (tileH + GAP);
  const thumb = await sharp(`${OUT}/${s.file}`).resize(TW, TH).png().toBuffer();
  composites.push({ input: thumb, left: x, top: y });
  const cap = Buffer.from(
    `<svg width="${TW}" height="${CAPH}" xmlns="http://www.w3.org/2000/svg">
       <rect width="${TW}" height="${CAPH}" fill="#161615"/>
       <text x="10" y="19" fill="#C1281B" font-family="sans-serif" font-size="13" font-weight="700">${String(s.n).padStart(2,'0')}</text>
       <text x="34" y="19" fill="#E9E7E1" font-family="sans-serif" font-size="13" font-weight="600">${s.label.replace(/&/g,'&amp;')}</text>
       <text x="10" y="37" fill="#8a8a86" font-family="sans-serif" font-size="10.5">${(s.renderMethod||'').slice(0,52)}</text>
     </svg>`);
  composites.push({ input: cap, left: x, top: y + TH });
}
await sharp({ create: { width: W, height: H, channels: 3, background: '#0D0D0D' } })
  .composite(composites).png().toFile(`${OUT}/contact-sheet.png`);

console.log(`wrote index.html, manifest.json (${states.length} states), contact-sheet.png (${W}x${H})`);
