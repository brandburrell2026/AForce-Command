/**
 * Activation anchor + Day-7 offer emit — the on-device side of the
 * consumer "Activation Journey".
 *
 * The Day-7 subscription offer opens a fixed number of days after the
 * user's activation ANCHOR: the first coach command they actually follow
 * (the owner-annotated start of the habit loop). We stamp that instant
 * ONCE, idempotently, the first time `command_followed` fires — it is never
 * moved afterwards, so the countdown is stable across relaunches.
 *
 * The anchor is local display metadata only (AsyncStorage, off to the side
 * of the slice store). Score-Protection: nothing here awards, mutates, or
 * fabricates score; an absent anchor simply yields an `unanchored` offer.
 */
import { scopedStorage } from '@/services/scopedStorage';

import { emit } from './event_dispatcher';
import { isConsentGranted } from './privacy_manager';

const FIRST_COMMAND_KEY = '@aforce/first-command-at';
const DAY7_EMITTED_KEY = '@aforce/day7-offer-emitted';

/**
 * In-memory guards collapse concurrent calls within a single JS session
 * (e.g. React 18 strict-mode double-invoking an effect) so the get-then-set
 * AsyncStorage dedupe below can't race itself into a double write / double
 * emit. Cross-session dedupe still relies on AsyncStorage.
 */
let firstCommandStamped = false;
let day7EmitInFlight: Promise<void> | null = null;

/**
 * Idempotently stamp the first followed command as the Day-7 anchor.
 * Safe to call on every command — only the FIRST write sticks, so the
 * offer window never shifts once it has started. Best-effort.
 */
export async function markFirstCommandCompleted(
  nowIso: string = new Date().toISOString(),
): Promise<void> {
  if (firstCommandStamped) return;
  try {
    const existing = await scopedStorage.getItem(FIRST_COMMAND_KEY);
    if (existing) {
      firstCommandStamped = true;
      return;
    }
    await scopedStorage.setItem(FIRST_COMMAND_KEY, nowIso);
    firstCommandStamped = true;
  } catch {
    /* non-fatal — best-effort anchor */
  }
}

/** Read the activation anchor (ISO), or null when no command has been followed. */
export async function getFirstCommandAt(): Promise<string | null> {
  try {
    return await scopedStorage.getItem(FIRST_COMMAND_KEY);
  } catch {
    return null;
  }
}

/**
 * Emit `day7_subscription_offer` at most once — the first time the offer is
 * actually SHOWN to the user (the Activation Journey card renders its open
 * phase). Consent is checked FIRST so the dedupe key is only burned once the
 * event can truly go out; if consent is later granted the still-open offer
 * re-triggers this and fires. Best-effort and fire-and-forget.
 */
export async function recordDay7OfferShown(): Promise<void> {
  // Collapse concurrent invocations (e.g. a strict-mode double effect) onto a
  // single in-flight attempt so the get-then-set dedupe can't double-emit.
  if (day7EmitInFlight) return day7EmitInFlight;
  day7EmitInFlight = (async () => {
    if (!(await isConsentGranted())) return;
    try {
      if (await scopedStorage.getItem(DAY7_EMITTED_KEY)) return;
    } catch {
      /* fall through — better to emit than silently drop */
    }
    await emit('day7_subscription_offer');
    try {
      await scopedStorage.setItem(DAY7_EMITTED_KEY, new Date().toISOString());
    } catch {
      /* non-fatal — best-effort dedupe */
    }
  })();
  try {
    await day7EmitInFlight;
  } finally {
    day7EmitInFlight = null;
  }
}
