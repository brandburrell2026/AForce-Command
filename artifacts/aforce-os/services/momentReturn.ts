/**
 * A tap on the AFORCE mark that arrived while signed out.
 *
 * The member is sent to sign in; this remembers, for this run of the app only,
 * that they were on their way back to a Moment, so sign-in can take them there
 * instead of to Home. Nothing about the Moment is stored: only the intent.
 */
let pending = false;

export function rememberMomentReturn(): void {
  pending = true;
}

/** True once, then cleared. */
export function takeMomentReturn(): boolean {
  const was = pending;
  pending = false;
  return was;
}

export function momentReturnPending(): boolean {
  return pending;
}

/** Where sign-in goes when it finishes. */
export function afterSignInRoute(): '/moment-return' | '/(tabs)' {
  return pending ? '/moment-return' : '/(tabs)';
}
