/**
 * One Breath interpreter — the seam between words and a structured request
 * (One Breath Final Build Spec, "The engine underneath", steps 2–3).
 *
 * Anything that turns words into a request implements this: today the
 * on-device rules (`rulesInterpreter.ts`); later, if decision C3 is reversed,
 * a model behind a flag. Whatever implements it only names what was asked.
 * It never approves, saves, sends, or decides drink credit: validation and
 * execution belong to the session and the owning services.
 */
import type { OneBreathOutcome, OneBreathRequest } from '@/utils/oneBreath/session';

export interface InterpretContext {
  /** Social One Breath. Messaging, sharing and "Made it back" exist only here. */
  social: boolean;
  /** A sealed Moment is inside its Lock In window. */
  momentInWindow: boolean;
}

export interface Interpretation {
  request: OneBreathRequest;
  /** What the member should get for these words alone, before any approval. */
  outcome: OneBreathOutcome;
}

export type Interpreter = (words: string, context: InterpretContext) => Interpretation;
