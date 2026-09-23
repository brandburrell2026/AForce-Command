import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(join(ROOT, 'app', 'skinia.tsx'), 'utf8');
const service = readFileSync(join(ROOT, 'services', 'advancedVisualIntelligence.ts'), 'utf8');
const screen = readFileSync(join(ROOT, 'components', 'advancedVisual', 'AdvancedVisualIntelligenceScreen.tsx'), 'utf8');
const captureScreen = readFileSync(join(ROOT, 'components', 'advancedVisual', 'SkinIACameraCaptureScreen.tsx'), 'utf8');
// Both halves of the gate. The decision was split out of the hook so a unit
// test could import it without `@clerk/expo`; the containment property has to
// follow it rather than staying on whichever file it started in.
const cohortGate =
  readFileSync(join(ROOT, 'services', 'skiniaCohortAccess.ts'), 'utf8') +
  readFileSync(join(ROOT, 'services', 'skiniaCohortGate.ts'), 'utf8');

describe('Advanced Visual Intelligence™ containment', () => {
  it('stays disabled in production and generic demo builds', () => {
    expect(DEFAULT_FLAGS.advanced_visual_intelligence_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.advanced_visual_intelligence_enabled).toBe(false);
  });

  it('keeps the route dark unless both internal build and server cohort authorization exist', () => {
    expect(route).toContain('useSkinIACohortAccess');
    expect(route).toContain('resolveSkinIARouteDecision');
    expect(route).toContain("EXPO_PUBLIC_INTERNAL_TESTFLIGHT");
    expect(route).toContain("if (decision === 'WAIT') return <SkinIAAccessCheck />;");
    expect(route).toContain("if (decision === 'DENY') return <Redirect");
    expect(route.indexOf("if (decision === 'DENY')")).toBeLessThan(route.indexOf('if (captureOpen) return <SkinIACameraCaptureScreen'));
  });

  it('keeps the consent shell free of capture, visual processing, upload, retention, or model code', () => {
    const implementation = `${service}\n${screen}`
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .replace(/^\s*\/\/.*$/gm, '');
    const prohibitedImplementation = [
      'expo-camera', 'CameraView', 'expo-image-picker', 'ImagePicker',
      'fetch(', 'postJson(', 'AsyncStorage', 'SecureStore',
    ];
    for (const marker of prohibitedImplementation) {
      expect(implementation, `containment must not include ${marker}`).not.toContain(marker);
    }
  });

  it('keeps native capture behind the gated route and free of persistent or network paths', () => {
    expect(route).toContain('SkinIACameraCaptureScreen');
    expect(captureScreen).toContain("pictureRef: true");
    const captureImplementation = captureScreen.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
    for (const marker of ['fetch(', 'AsyncStorage', 'SecureStore', 'FileSystem', 'base64:', 'exif:', 'uri:', 'upload']) {
      expect(captureImplementation, `capture surface must not include ${marker}`).not.toContain(marker);
    }
  });

  it('keeps cohort logic free of image capability', () => {
    expect(cohortGate).not.toContain('expo-camera');
    expect(cohortGate).not.toContain('ImagePicker');
  });
});
