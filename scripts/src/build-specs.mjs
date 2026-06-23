#!/usr/bin/env node
// Compiles all AForce specification documents into a single bundle and renders
// HTML + PDF via pandoc (HTML) and wkhtmltopdf (PDF). Run from repo root:
//   pnpm --filter @workspace/scripts run build-specs
import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(here, '..', '..');
const styleCss = resolve(here, '..', 'assets', 'specs-style.css');
const outDir = resolve(repoRoot, 'exports');
const outMd = resolve(outDir, 'aforce-specs.md');
const outHtml = resolve(outDir, 'aforce-specs.html');
const outPdf = resolve(outDir, 'aforce-specs.pdf');

// Ordered list of specification source documents (paths relative to repo root).
// Grouped: project overview -> comprehensive specs -> core/phase specs ->
// design system -> feature & safety specs -> demo/release -> competitive ->
// backend & scaling. Missing files are skipped gracefully at build time.
const SOURCES = [
  // Project overview + locked product decisions
  'replit.md',
  // Comprehensive, code-verified product & technical specifications
  'artifacts/aforce-os/docs/AForce-OS-Specification.md',
  'artifacts/aforce-os/SPEC-SHEET.md',
  // Core product spec + phase tracking + enhancement layer
  'AFORCE_FINAL_SPEC.md',
  'AFORCE_PHASE_STATUS.md',
  'AFORCE_SOCIAL_CRUISE_ADDON.md',
  // Design system
  'design/aforce-design-tokens.md',
  // Feature & safety specs
  'artifacts/aforce-os/docs/social-mode-safety-spec.md',
  // Demo & release readiness
  'artifacts/aforce-os/docs/investor-demo-readiness.md',
  'artifacts/aforce-os/docs/TESTFLIGHT_CHECKLIST.md',
  // Competitive positioning
  'docs/competitive-moat.md',
  // Validation methodology + backend scaling/resilience
  'docs/validation-methodology.md',
  'artifacts/api-server/docs/scaling-architecture.md',
  'artifacts/api-server/docs/load-testing-plan.md',
  'artifacts/api-server/docs/failover-strategy.md',
  'artifacts/api-server/loadtests/spec.md',
];

const today = new Date().toISOString().slice(0, 10);

const parts = [];
const included = [];
for (const rel of SOURCES) {
  const abs = resolve(repoRoot, rel);
  if (!existsSync(abs)) {
    console.warn(`[build-specs] skipping missing source: ${rel}`);
    continue;
  }
  included.push(rel);
  const body = readFileSync(abs, 'utf8').trim();
  parts.push(`\n\n---\n\n# 📄 ${rel}\n\n${body}\n`);
}

const bundle = `---\ntitle: "AForce — Complete Specifications"\nauthor: "Generated ${today}"\n---\n${parts.join('')}`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outMd, bundle, 'utf8');
console.log(`[build-specs] wrote ${outMd} (${included.length} documents)`);

// Markdown -> styled, self-contained HTML with table of contents.
execFileSync('pandoc', [
  outMd,
  '--from=gfm',
  '--to=html5',
  '--standalone',
  '--toc',
  '--toc-depth=2',
  '--embed-resources',
  `--css=${styleCss}`,
  '--metadata', 'title=AForce — Complete Specifications',
  '-o', outHtml,
], { stdio: 'inherit', cwd: repoRoot });
console.log(`[build-specs] wrote ${outHtml}`);

// HTML -> PDF via wkhtmltopdf (preserves the WHOOP-lime CSS styling).
execFileSync('wkhtmltopdf', [
  '--enable-local-file-access',
  '--print-media-type',
  '--margin-top', '16mm',
  '--margin-bottom', '16mm',
  '--margin-left', '14mm',
  '--margin-right', '14mm',
  '--footer-right', '[page]/[topage]',
  '--footer-font-size', '8',
  '--footer-spacing', '4',
  '--quiet',
  outHtml,
  outPdf,
], { stdio: 'inherit', cwd: repoRoot });
console.log(`[build-specs] wrote ${outPdf}`);
