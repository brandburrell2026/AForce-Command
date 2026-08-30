/**
 * Wave-2 PR5 — runtime seam proofs: representative prohibited language is
 * blocked AT THE SEAMS (not merely in unit tests of the gate itself).
 *
 * Seams under test (client):
 *   C1 speak()                 → blocked line is never dispatched to either
 *                                TTS backend (silence, no rewrite)
 *   C5 renderTemplate()        → blocked rendered line suppressed whole
 *   C6 buildScanCoachScript()  → external product name carrying a claim
 *                                falls back to the neutral script
 *   C4 composeExplanation()    → a blocked overlay is dropped, the approved
 *                                base command survives
 * (Server seams C2 /voice/tts and C7 smart-capture are proven in
 *  artifacts/api-server/src/__tests__/claimsGateServerSeams.test.ts.)
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';

const speakWithElevenLabsMock = vi.fn(() => Promise.resolve());
const ttsSpeakMock = vi.fn(() => Promise.resolve());

vi.mock('../../services/elevenLabsTts', () => ({
  speakWithElevenLabs: (...a: unknown[]) => speakWithElevenLabsMock(...(a as [])),
  elevenLabsIdFor: () => 'el-voice-1',
}));
vi.mock('../../services/ttsService', () => ({
  speak: (...a: unknown[]) => ttsSpeakMock(...(a as [])),
  stop: () => {},
}));
vi.mock('../../services/i18nService', () => ({
  default: { t: (k: string) => k, language: 'en', changeLanguage: () => {} },
}));

const BLOCKED_LINE = 'This drink cures dehydration and predicts injury.';
const CLEAN_LINE = 'Drink 12 ounces now and recheck in 20 minutes.';

describe('C1 speak() — spoken claims fail closed to silence', () => {
  beforeEach(() => {
    speakWithElevenLabsMock.mockClear();
    ttsSpeakMock.mockClear();
  });

  it('a blocked line reaches NEITHER TTS backend; a clean line still speaks', async () => {
    const tts = await import('../../services/textToSpeech');
    tts.setEffectiveCoachMode('spoken');
    tts.setSelectedVoiceId('el-voice-1');

    tts.speak(BLOCKED_LINE);
    expect(speakWithElevenLabsMock).not.toHaveBeenCalled();
    expect(ttsSpeakMock).not.toHaveBeenCalled();

    tts.speak(CLEAN_LINE);
    expect(speakWithElevenLabsMock.mock.calls.length + ttsSpeakMock.mock.calls.length).toBe(1);
  });
});

describe('C5 renderTemplate() — blocked rendered lines are suppressed whole, never stripped', async () => {
  it('a token fill landing on a claim suppresses the whole line; clean fill speaks', async () => {
    const { renderTemplate } = await import('../../services/voiceTemplateEngine');
    // next_action/balanced is exactly '{action}' — the external-text
    // injection point for voice lines.
    const blocked = renderTemplate('next_action', {
      mode: 'balanced',
      score: 74,
      command_action: 'This cures cramps and predicts injury.',
    } as never);
    expect(blocked.spoken).toBe('');

    const clean = renderTemplate('next_action', {
      mode: 'balanced',
      score: 74,
      command_action: 'Drink 12 ounces now.',
    } as never);
    expect(clean.spoken).toContain('Drink 12 ounces now');
  });
});

describe('C6 buildScanCoachScript() — strict surface with external interpolation', () => {
  it('a scanned product named with a claim yields the neutral script', async () => {
    const { buildScanCoachScript } = await import('../../services/scanCoachVoice');
    const result = {
      product: {
        productName: 'InjuryShield Cure Elixir',
        isAForce: true,
        electrolyteDensity: 80,
        sugarLevel: 10,
        hydrationSpeed: 80,
        recoveryFit: 80,
      },
      verdict: 'optimal',
      evaluatedAgainstState: 'BALANCED',
      currentFitScore: 90,
      efficiency: 0.9,
      recommendation: { command: 'Take 1 now.' },
    } as never;
    const script = buildScanCoachScript(result);
    if (!script) throw new Error('expected a coach script for this fixture'); // RP-1: nullable for uncomparable
    expect(script.headline).toBe('Scan complete.');
    expect(script.transcript).toBe('');
  });

  it('a clean product keeps its real script', async () => {
    const { buildScanCoachScript } = await import('../../services/scanCoachVoice');
    const result = {
      product: {
        productName: 'AForce Watermelon',
        isAForce: true,
        electrolyteDensity: 80,
        sugarLevel: 10,
        hydrationSpeed: 80,
        recoveryFit: 80,
      },
      verdict: 'optimal',
      evaluatedAgainstState: 'BALANCED',
      currentFitScore: 90,
      efficiency: 0.9,
      recommendation: { command: 'Take 1 now.' },
    } as never;
    const script = buildScanCoachScript(result);
    if (!script) throw new Error('expected a coach script for this fixture'); // RP-1: nullable for uncomparable
    expect(script.headline).toContain('AForce Watermelon');
    expect(script.transcript.length).toBeGreaterThan(0);
  });
});

describe('C4 composeExplanation() — blocked overlay drops, base survives', () => {
  it('an overlay resolving to a claim is omitted; the approved base is untouched', async () => {
    vi.resetModules();
    vi.doMock('../../services/i18nService', () => ({
      default: {
        t: (k: string) =>
          k === 'coach.context_heat_high' ? 'Heat cures dehydration fast.' : k,
        language: 'en',
        changeLanguage: () => {},
      },
    }));
    const { composeExplanation } = await import('../scoring/copy');
    const state = {
      heatLoad: 9,
      complianceStreak: 0,
      symptoms: [],
    } as never;
    const out = composeExplanation('BASE_COMMAND.', state, 70, 0.01, 'BALANCED', false, 10);
    expect(out).toContain('BASE_COMMAND.');
    expect(out).not.toContain('cures');
    vi.doUnmock('../../services/i18nService');
  });
});
