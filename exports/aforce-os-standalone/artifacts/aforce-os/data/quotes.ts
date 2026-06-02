/**
 * AForce quote pools — high-conversion, context-triggered.
 *
 * These are NOT motivational quotes. They are:
 *   - commands         → "Take 1 now."
 *   - identity signals → "Clean AF."
 *   - performance triggers → "Cycle complete."
 *
 * Hard rules (every entry):
 *   - max 4 words
 *   - no filler ("just", "really", "very", "maybe")
 *   - no motivational language ("believe in yourself", "go for it")
 *   - no generic fitness language ("crush it", "no pain no gain")
 *   - no exclamation marks (AForce never shouts)
 *
 * Five orthogonal types — the engine picks the pool based on live
 * context (hydration state / behavior / time of day / social mode).
 */

import type { Quote } from '../types/quote';

/**
 * COMMAND — direct action triggers. Fired when the user needs to act
 * (depleted state, morning window, post-cycle prompt). Imperative voice.
 */
export const COMMAND_QUOTES: Quote[] = [
  { id: 'cmd-take-now',  type: 'command', text: 'Take 1 now.' },
  { id: 'cmd-hydrate',   type: 'command', text: 'Hydrate. Then go.' },
  { id: 'cmd-restore',   type: 'command', text: 'Restore the system.' },
  { id: 'cmd-pop-move',  type: 'command', text: 'Pop one. Move.' },
  { id: 'cmd-cycle-now', type: 'command', text: 'Cycle now.' },
  { id: 'cmd-protocol',  type: 'command', text: 'Run protocol.' },
  { id: 'cmd-activate',  type: 'command', text: 'Open. Activate.' },
  { id: 'cmd-reset',     type: 'command', text: 'Reset incoming.' },
  { id: 'cmd-rehydrate', type: 'command', text: 'Rehydrate. Now.' },
  { id: 'cmd-preload',   type: 'command', text: 'Pre-load.' },
];

/**
 * RESULT — outcome confirmation. Fired right after a logged action so
 * the user feels their input landed. Past-tense / state-of-being.
 */
export const RESULT_QUOTES: Quote[] = [
  { id: 'res-back-online', type: 'result', text: 'System back online.' },
  { id: 'res-restored',    type: 'result', text: 'Performance restored.' },
  { id: 'res-cycle',       type: 'result', text: 'Cycle complete.' },
  { id: 'res-locked',      type: 'result', text: 'Locked in.' },
  { id: 'res-clean',       type: 'result', text: 'Operating clean.' },
  { id: 'res-posted',      type: 'result', text: 'Recovery posted.' },
  { id: 'res-you-ran',     type: 'result', text: 'You ran it.' },
];

/**
 * IDENTITY — who you are now. Fired on Peak + streak, late-night
 * sessions, and high-confidence states. First-person declarative.
 */
export const IDENTITY_QUOTES: Quote[] = [
  { id: 'id-i-run',       type: 'identity', text: 'I run this.' },
  { id: 'id-clean-af',    type: 'identity', text: 'Clean AF.' },
  { id: 'id-effective',   type: 'identity', text: 'Effective AF.' },
  { id: 'id-inside',      type: 'identity', text: 'AForce inside.' },
  { id: 'id-built',       type: 'identity', text: 'Built to perform.' },
  { id: 'id-i-am',        type: 'identity', text: 'I am the system.' },
  { id: 'id-mine',        type: 'identity', text: 'Performance is mine.' },
];

/**
 * PRODUCT — the system itself. Fired in default / steady-state
 * conditions to reinforce what AForce is.
 */
export const PRODUCT_QUOTES: Quote[] = [
  { id: 'prod-not-drink', type: 'product', text: 'Not a drink.' },
  { id: 'prod-system',    type: 'product', text: 'A system.' },
  { id: 'prod-clean',     type: 'product', text: 'Engineered clean.' },
  { id: 'prod-brothers',  type: 'product', text: 'Designed by brothers.' },
  { id: 'prod-built',     type: 'product', text: 'Built for performance.' },
  { id: 'prod-one-can',   type: 'product', text: 'One can. Reset.' },
  { id: 'prod-activate',  type: 'product', text: 'Take 1. Activate.' },
];

/**
 * SOCIAL — high-conversion social-mode triggers. Fired only when the
 * user is in (or about to enter) social mode. Strongest call-to-action
 * pool — most likely to drive a re-up purchase before a night out.
 */
export const SOCIAL_QUOTES: Quote[] = [
  { id: 'soc-on',        type: 'social', text: 'Social mode on.' },
  { id: 'soc-clean',     type: 'social', text: 'Stay clean tonight.' },
  { id: 'soc-preload',   type: 'social', text: 'Pre-load now.' },
  { id: 'soc-take-go',   type: 'social', text: 'Take 1. Go out.' },
  { id: 'soc-night',     type: 'social', text: 'Run the night.' },
  { id: 'soc-exit',      type: 'social', text: 'Clean exit. Always.' },
  { id: 'soc-then',      type: 'social', text: 'Hydrate. Then drink.' },
  { id: 'soc-no-regret', type: 'social', text: 'No regret tomorrow.' },
];

export const ALL_QUOTES: Quote[] = [
  ...COMMAND_QUOTES,
  ...RESULT_QUOTES,
  ...IDENTITY_QUOTES,
  ...PRODUCT_QUOTES,
  ...SOCIAL_QUOTES,
];
