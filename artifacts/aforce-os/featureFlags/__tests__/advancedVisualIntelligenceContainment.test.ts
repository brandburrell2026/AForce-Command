import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { DEFAULT_FLAGS, DEMO_ALL_ON_FLAGS } from '../flags';

const ROOT = resolve(__dirname, '..', '..');
const route = readFileSync(join(ROOT, 'app', 'skinia.tsx'), 'utf8');
const service = readFileSync(join(ROOT, 'services', 'advancedVisualIntelligence.ts'), 'utf8');
const screen = readFileSync(join(ROOT, 'components', 'advancedVisual', 'AdvancedVisualIntelligenceScreen.tsx'), 'utf8');
const cohortGate = readFileSync(join(ROOT, 'services', 'skiniaCohortAccess.ts'), 'utf8');

describe('Advanced Visual Intelligence™ containment', () => {
  it('stays disabled in production and generic demo builds', () => {
    expect(DEFAULT_FLAGS.advanced_visual_intelligence_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.advanced_visual_intelligence_enabled).toBe(false);
  });

  it('keeps the route dark unless both internal build and server cohort authorization exist', () => {
    expect(route).toContain('useSkinIACohortAccess');
    expect(route).toContain('isSkinIAAccessAllowed');
    expect(route).toContain("EXPO_PUBLIC_INTERNAL_TESTFLIGHT");
    expect(route).toContain('if (!allowed) return <Redirect');
  });

  it('contains no capture, visual processing, upload, retention, or model code', () => {
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

  it('keeps cohort logic free of image capability', () => {
    expect(cohortGate).not.toContain('expo-camera');
    expect(cohortGate).not.toContain('ImagePicker');
  });
});
