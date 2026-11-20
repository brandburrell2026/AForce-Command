/**
 * Profile → Account → Settings in the app's own look (founder, 2026-11-20:
 * "fix all of the screens … that do not have the new look").
 */
import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
const kit = strip(readFileSync(join(__dirname, '..', 'profileKit.tsx'), 'utf8'));
const pane = strip(readFileSync(join(__dirname, '..', 'panes', 'AccountPane.tsx'), 'utf8'));
const language = strip(readFileSync(join(__dirname, '..', '..', 'LanguageSelector.tsx'), 'utf8'));
const block = (src: string, name: string) => {
  const start = src.indexOf(`  ${name}: {`);
  return src.slice(start, src.indexOf('},', start));
};
const voiceBlock = pane.slice(pane.indexOf('const notificationsBlock'), pane.indexOf('styles.phaseCard'));

describe('Settings look like the rest of the app', () => {
  it('a selected unit is the warm-white pill, not red', () => {
    expect(block(kit, 'unitPrefPillActive')).toContain('backgroundColor: af.primaryFill');
    expect(block(kit, 'unitPrefPillTextActive')).toContain('color: af.onPrimaryFill');
  });

  it('voice options are one neutral pill; the choice is not colour-coded', () => {
    expect(voiceBlock).not.toMatch(/af\.(green|cyan|red|amber|blue)\b/);
    expect(voiceBlock).not.toMatch(/const accent/);
    expect(voiceBlock.match(/selected && voicePickerStyles\.segmentSelected/g)).toHaveLength(2);
    expect(kit).toMatch(/segmentSelected: \{ backgroundColor: af\.primaryFill, borderColor: af\.primaryFill \}/);
    expect(block(kit, 'segmentLabel')).not.toContain('Inter_700Bold');
  });

  it('a selected voice or language is a warm-white edge and a check', () => {
    expect(block(kit, 'rowSelected')).toContain('borderColor: af.textPrimary');
    expect(language).toMatch(/rowActive: \{ borderColor: af\.textPrimary \}/);
    expect(language).toContain('accessibilityState={{ selected: isCurrent }}');
  });

  it('the language list carries no hard-coded colours', () => {
    expect(language).not.toMatch(/#[0-9a-fA-F]{3,8}\b|rgba?\(/);
  });

  it('option words are written in sentence case, from the same locale strings', () => {
    expect(voiceBlock).toContain('sentenceCase(t(`profile.v2.vintensity_${opt}`))');
    expect(voiceBlock).toContain('{sentenceCase(label)}');
    expect(voiceBlock).toContain("sentenceCase(getLastCommand() ? t('profile.v2.replay_last') : t('profile.v2.nothing_to_replay'))");
    // What a screen reader hears is unchanged.
    expect(voiceBlock).toContain('accessibilityLabel={t(`profile.v2.vintensity_${opt}`)}');
  });

  it('a long setting label cannot push its switch off the edge', () => {
    expect(kit).toMatch(/settingLeft: \{[^}]*flex: 1, flexShrink: 1/);
  });
});
