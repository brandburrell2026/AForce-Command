/** Kept internal until all Social v0.4 real-device acceptance gates pass. */
export function preparationPreviewEnabled(): boolean {
  return process.env['EXPO_PUBLIC_INTERNAL_TESTFLIGHT'] === 'true'
    && process.env['EXPO_PUBLIC_SOCIAL_V04'] === 'true';
}
