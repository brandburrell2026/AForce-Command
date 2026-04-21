/**
 * Share message templates. AForce voice rules:
 *   - direct, confident, minimal
 *   - no hype words ("crushing it", "let's go", "feeling great", "awesome")
 *   - no emojis, slang, or hashtags
 *   - no exclamation points
 *
 * Tokens are filled by `services/shareTemplateEngine.ts`:
 *   {score} {state} {delta} {streak} {rank} {protocol}
 */

import type { ShareType } from '../types/share';

export const SHARE_TEMPLATES: Record<ShareType, string[]> = {
  score: [
    '{state} at {score}. Stay on cadence.',
    'Score {score}. System in control.',
    'Holding at {score}. Maintain performance.',
  ],
  state: [
    '{state}. System in control.',
    'Operating in {state}.',
    'Current state: {state}.',
  ],
  gain: [
    '{delta} today. Back in control.',
    'Up {delta}. Performance restored.',
    'Recovered {delta}. Cadence held.',
  ],
  streak: [
    '{streak} day streak. Consistent.',
    'Day {streak}. System stays on.',
    '{streak} days in control.',
  ],
  protocol: [
    '{protocol} complete. Back online.',
    '{protocol} cycle executed.',
    '{protocol} done. System reset.',
  ],
  rank: [
    '{rank}. Holding position.',
    '{rank}. Position earned.',
    '{rank}. Maintained.',
  ],
  heat_save: [
    'Heat risk detected and corrected.',
    'Heat warning held. System intervened.',
    'Heat curve flattened. Back in safe range.',
  ],
  command: [
    'System executed.',
    'Command complete.',
    'Action confirmed.',
  ],
  reset: [
    'Daily reset complete.',
    'System rebased for the day.',
    'Reset cycle executed.',
  ],
};

/**
 * Subtle branding line. Appended to text shares (X / Threads / iMessage)
 * but NOT shown on visual card/story formats — the card already carries the
 * AForce mark.
 */
export const BRAND_TAG = 'Powered by AForce';
