#!/usr/bin/env node
/**
 * Governance drift check — enforces Founder Decision 3 (2026-07-22):
 * `/governance/` is the sole authoritative governance source.
 *
 * Fails when:
 *   1. any governance .md reappears under artifacts/aforce-os/governance/ (only README.md allowed);
 *   2. a sanctioned duplicate diverges from its canonical original.
 *
 * Background: the mirrored Architecture-Appendix.md silently lost the DR-001 amendment and told
 * in-tree agents that HydroScan may write into HydroState — a Score-Protection breach. The audit
 * caught it; nothing structural prevented it. This check is that structure.
 *
 * Run:  node scripts/src/check-governance-drift.mjs
 */
import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { dirname, resolve, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const failures = [];

// --- 1. No governance copies inside the app tree -----------------------------
const mirrorDir = join(repoRoot, 'artifacts/aforce-os/governance');
if (existsSync(mirrorDir)) {
  const stray = readdirSync(mirrorDir).filter((f) => f.endsWith('.md') && f !== 'README.md');
  for (const f of stray) {
    failures.push(
      `artifacts/aforce-os/governance/${f} — governance copies are forbidden here. ` +
        `Reference /governance/${f} instead (Founder Decision 3).`,
    );
  }
}

// --- 2. Sanctioned duplicates must stay byte-identical ------------------------
// The ONLY permitted duplicate. See governance/SPECIFICATION-AUTHORITY.md §3.
const SANCTIONED = [
  {
    canonical: 'docs/COMPLIANCE_FRAMEWORK.md',
    copy: 'artifacts/aforce-os/legal/COMPLIANCE_FRAMEWORK.md',
    why: 'in-app legal surface must ship inside the bundle',
  },
];

for (const { canonical, copy, why } of SANCTIONED) {
  const a = join(repoRoot, canonical);
  const b = join(repoRoot, copy);
  if (!existsSync(a)) { failures.push(`missing canonical: ${canonical}`); continue; }
  if (!existsSync(b)) { failures.push(`missing sanctioned copy: ${copy}`); continue; }
  if (readFileSync(a, 'utf8') !== readFileSync(b, 'utf8')) {
    failures.push(`${copy} has drifted from ${canonical} (${why}). They must stay byte-identical.`);
  }
}

// --- report -------------------------------------------------------------------
if (failures.length) {
  console.error('\n✖ Governance drift check FAILED\n');
  for (const f of failures) console.error(`  • ${f}`);
  console.error('\nSee governance/SPECIFICATION-AUTHORITY.md §3.\n');
  process.exit(1);
}
console.log('✓ Governance drift check passed');
