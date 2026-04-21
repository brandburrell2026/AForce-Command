/**
 * useResponsiveLayout — Bridge hook that turns the current device
 * class into a flat set of layout tokens (orbSize, contentMaxWidth,
 * gutter, etc.) ready to spread into StyleSheet objects.
 *
 * Components consume this instead of querying width directly so all
 * scaling decisions live in one place (utils/layoutBreakpoints) and
 * stay consistent across screens.
 */

import { useMemo } from 'react';
import { useDeviceClass } from './useDeviceClass';
import {
  tokensForDeviceClass,
  type LayoutTokens,
  type DeviceClass,
} from '../utils/layoutBreakpoints';

export interface ResponsiveLayout extends LayoutTokens {
  deviceClass: DeviceClass;
  width: number;
  height: number;
  isPortrait: boolean;
}

export function useResponsiveLayout(): ResponsiveLayout {
  const { deviceClass, width, height, isPortrait } = useDeviceClass();
  return useMemo(
    () => ({
      ...tokensForDeviceClass(deviceClass),
      deviceClass,
      width,
      height,
      isPortrait,
    }),
    [deviceClass, width, height, isPortrait],
  );
}
