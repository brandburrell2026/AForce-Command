/**
 * HydrationScreenV2 — offline intake outbox visibility wiring
 * (RC-1 Wave-2B, item 1).
 *
 * `HydrationScreenV2` pulls in `useAppStore` / `expo-router` — the same
 * category of store+router-connected container this repo's existing tests
 * deliberately never mount directly (see
 * `components/home/__tests__/homeScreenV2Wiring.test.ts`'s header, which
 * documents the convention). This file applies that same pattern: a
 * source-text guard asserting the banner is wired to the honest,
 * flag-gated outbox signal, rather than fabricating a store+router harness
 * this suite has no existing pattern for. `AFOfflineBanner` itself is
 * covered directly by `components/ui/__tests__/AFOfflineBanner.render.test.tsx`.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const SOURCE = readFileSync(join(__dirname, '..', 'HydrationScreenV2.tsx'), 'utf8');
const CODE = SOURCE.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/\/\/.*$/gm, '');

describe('HydrationScreenV2 — offline intake outbox visibility (RC-1 Wave-2B, item 1)', () => {
  it('imports AFOfflineBanner and the honest outbox selectors', () => {
    expect(CODE).toContain('AFOfflineBanner');
    expect(CODE).toContain(
      "import { useIntakeOutboxStore, selectPendingCount, selectHasFailedItem } from '@/services/intakeOutbox';",
    );
  });

  it('gates the outbox signal on the offline_intake_outbox_enabled flag (flag-off stays byte-identical/inert)', () => {
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectPendingCount\(outboxState\)\s*:\s*0/);
    expect(CODE).toMatch(/flags\.offline_intake_outbox_enabled\s*\?\s*selectHasFailedItem\(outboxState\)\s*:\s*false/);
  });

  it('mounts <AFOfflineBanner> wired to those exact two computed values, right after the top bar', () => {
    expect(CODE).toMatch(
      /<AFOfflineBanner\s+pendingCount=\{outboxPendingCount\}\s+hasFailedItem=\{outboxHasFailedItem\}\s*\/>/,
    );
    const topBarToBanner = CODE.slice(CODE.indexOf('<AFTopBar'), CODE.indexOf('<AFOfflineBanner'));
    // Nothing else sits between the top bar and the banner.
    expect(topBarToBanner).not.toMatch(/<AFCard/);
  });
});
