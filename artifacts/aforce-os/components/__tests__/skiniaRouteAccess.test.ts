import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = readFileSync(join(__dirname, '..', '..', 'app', 'skinia.tsx'), 'utf8');

describe('SkinIA route access', () => {
  it('waits for a pending cohort decision before redirecting or rendering the camera flow', () => {
    expect(source).toContain('const decision = resolveSkinIARouteDecision({');
    const wait = source.indexOf("if (decision === 'WAIT') return <SkinIAAccessCheck />;");
    const deny = source.indexOf("if (decision === 'DENY') return <Redirect");
    const capture = source.indexOf('if (captureOpen) return <SkinIACameraCaptureScreen');
    expect(wait).toBeGreaterThan(-1);
    expect(deny).toBeGreaterThan(wait);
    expect(capture).toBeGreaterThan(deny);
  });
});
