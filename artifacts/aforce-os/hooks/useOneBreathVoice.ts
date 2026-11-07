const unavailableVoice = { available: false, busy: false, listening: false, error: '', start: async () => {}, stop: () => {}, cancel: () => {} };

/** Web and unsupported platforms keep the complete typed flow. Stable methods
 * prevent an unrelated render from cancelling an active Seal hold. */
export function useOneBreathVoice(_onTranscript: (text: string) => void) {
  return unavailableVoice;
}
