import { describe, expect, it } from 'vitest';
import {
  DEFAULT_FLAGS,
  DEMO_ALL_ON_FLAGS,
  INTERNAL_TIER_FLAGS,
  demoUnlockAllFlags,
  hydroscanLabelReaderAvailable,
} from '../flags';

describe('hydroscan_label_reader_enabled', () => {
  const internal = { dev: false, internalTestflight: true };
  const local = { dev: true, internalTestflight: false };
  const publicBuild = { dev: false, internalTestflight: false };

  it('is off by default and listed as an internal-tier flag', () => {
    expect(DEFAULT_FLAGS.hydroscan_label_reader_enabled).toBe(false);
    expect(DEMO_ALL_ON_FLAGS.hydroscan_label_reader_enabled).toBe(true);
    expect(INTERNAL_TIER_FLAGS).toContain('hydroscan_label_reader_enabled');
  });

  it('is available only when on, in a local or internal build', () => {
    const on = { hydroscan_label_reader_enabled: true };
    expect(hydroscanLabelReaderAvailable(DEFAULT_FLAGS, internal)).toBe(false);
    expect(hydroscanLabelReaderAvailable(on, internal)).toBe(true);
    expect(hydroscanLabelReaderAvailable(on, local)).toBe(true);
    expect(hydroscanLabelReaderAvailable(on, publicBuild)).toBe(false);
  });

  it('a hostile stored flag or a generic unlock never exposes it in a public build', () => {
    expect(demoUnlockAllFlags(DEMO_ALL_ON_FLAGS, publicBuild).hydroscan_label_reader_enabled).toBe(false);
    expect(demoUnlockAllFlags(DEMO_ALL_ON_FLAGS, internal).hydroscan_label_reader_enabled).toBe(true);
  });
});
