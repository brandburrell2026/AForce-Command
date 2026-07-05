import { describe, it, expect, vi } from 'vitest';
import { guardCoachLine, speakGuarded } from '../intelligence/conversationalLanguage';

describe('Section 64 Step 2 — guardCoachLine / speakGuarded (fail-closed before TTS)', () => {
  it('guardCoachLine returns compliant lines and blocks non-compliant + empty', () => {
    expect(guardCoachLine("Recovery window's open. Drink 16 oz water.")).toBe(
      "Recovery window's open. Drink 16 oz water.",
    );
    expect(guardCoachLine('this lowers your risk')).toBeNull(); // forbidden word
    expect(guardCoachLine('you are ahead of most people')).toBeNull(); // population comparison
    expect(guardCoachLine('   ')).toBeNull(); // empty
  });

  it('speaks a compliant line exactly once, verbatim', () => {
    const speaker = vi.fn();
    expect(speakGuarded('Now — drink 16 oz water.', speaker)).toBe(true);
    expect(speaker).toHaveBeenCalledTimes(1);
    expect(speaker).toHaveBeenCalledWith('Now — drink 16 oz water.');
  });

  it('SUPPRESSES a non-compliant line — the speaker is NEVER called (stays silent)', () => {
    const speaker = vi.fn();

    expect(speakGuarded('this helps prevent injury', speaker)).toBe(false);
    // a forbidden word reaching the actual spoken string (e.g. via interpolation)
    expect(speakGuarded('You are at risk today', speaker)).toBe(false);
    expect(speakGuarded('compared to other users you lag', speaker)).toBe(false);

    expect(speaker).not.toHaveBeenCalled();
  });
});
