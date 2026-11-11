/** Web and unsupported platforms keep the complete typed flow. */
export function useOneBreathVoice(_onTranscript: (text: string) => void) {
  return { available: false, busy: false, listening: false, error: '', start: async () => {}, stop: () => {}, cancel: () => {} };
}
