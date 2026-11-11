/**
 * useAFGutter — the live half of the D6 gutter rule (Black Issue): 32pt on a
 * standard phone, 24pt at or below afLayout.compactWidthMax. Reads the window
 * width and delegates to the pure `afGutterAt`, so there is one authority.
 */
import { useWindowDimensions } from 'react-native';
import { afGutterAt } from '@/theme';

export function useAFGutter(): number {
  const { width } = useWindowDimensions();
  return afGutterAt(width);
}
