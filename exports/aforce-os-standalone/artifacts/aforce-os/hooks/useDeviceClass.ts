/**
 * useDeviceClass — Subscribe to window dimension changes and return
 * the bucketed device class (compact / standard / large / foldOpen /
 * tablet) plus the raw width.
 *
 * Implemented with `useWindowDimensions` so it re-renders on
 * orientation flips, foldable open/close, split-screen resizes, and
 * multi-window mode on Android tablets.
 */

import { useWindowDimensions } from 'react-native';
import {
  deviceClassForWidth,
  type DeviceClass,
} from '../utils/layoutBreakpoints';

export interface DeviceClassResult {
  deviceClass: DeviceClass;
  width: number;
  height: number;
  /** True when height > width — useful for orientation-aware layouts. */
  isPortrait: boolean;
}

export function useDeviceClass(): DeviceClassResult {
  const { width, height } = useWindowDimensions();
  return {
    deviceClass: deviceClassForWidth(width),
    width,
    height,
    isPortrait: height >= width,
  };
}
