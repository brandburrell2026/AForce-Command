/**
 * Invalidates an in-flight ephemeral capture when its screen closes or the app
 * leaves the foreground. This holds only a generation number, never an image.
 */
export function createSkinIACaptureAttemptGate() {
  let generation = 0;
  let foreground = true;
  let closed = false;

  return Object.freeze({
    begin(): number | null {
      if (!foreground || closed) return null;
      generation += 1;
      return generation;
    },
    isCurrent(attempt: number): boolean {
      return foreground && !closed && Number.isSafeInteger(attempt) && attempt > 0 && attempt === generation;
    },
    foregrounded(): void {
      if (!closed) foreground = true;
    },
    interrupted(): void {
      generation += 1;
      foreground = false;
    },
    close(): void {
      generation += 1;
      foreground = false;
      closed = true;
    },
  });
}
