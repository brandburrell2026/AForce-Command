/**
 * useAFEyebrowType — the live half of the S2-14b micro-label ruling.
 *
 * Reads the member's current font scale and returns `afEyebrowAt`'s
 * letterSpacing override for tracked uppercase micro-labels (owner token:
 * afType.eyebrow). Append it AFTER the static label style in a style
 * array; it never caps Dynamic Type and never clamps lines — tracking is
 * the only thing that yields.
 */
import { useWindowDimensions } from 'react-native';
import { afEyebrowAt } from '@/theme';

export function useAFEyebrowType(): { letterSpacing: number } {
  const { fontScale } = useWindowDimensions();
  return afEyebrowAt(fontScale);
}
