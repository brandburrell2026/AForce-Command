/**
 * Mock BLE adapter for the Phantom Band.
 *
 * Real implementation would wrap react-native-ble-plx (or web bluetooth).
 * This module simulates the surface API so the rest of the OS can be built
 * and tested without hardware. The behaviour is deterministic:
 *   - pair() resolves after ~600ms with a fake device
 *   - sync() resolves after ~120ms and updates lastSyncAt
 *   - sendCommand() resolves immediately
 *
 * Keep this file SMALL and pure of UI concerns — phantomBandService composes
 * it with state + event emission.
 */

import type { HardwareDevice, HardwareCommand } from '../types/hardware';

const MOCK_DEVICE: HardwareDevice = {
  deviceId: 'phantom_001',
  name: 'PHANTOM Band',
  kind: 'phantom_band',
  firmwareVersion: '1.2.4',
  batteryLevel: 82,
  signalStrengthDb: -54,
};

export interface BleAdapter {
  pair(): Promise<HardwareDevice>;
  disconnect(): Promise<void>;
  sync(): Promise<{ at: number; batteryLevel: number }>;
  sendCommand(cmd: HardwareCommand): Promise<void>;
}

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

export function createMockBleAdapter(): BleAdapter {
  let battery = MOCK_DEVICE.batteryLevel;
  return {
    async pair() {
      await delay(600);
      return { ...MOCK_DEVICE, batteryLevel: battery };
    },
    async disconnect() {
      await delay(120);
    },
    async sync() {
      await delay(120);
      // Drop battery slightly per sync for realism, floored at 5%.
      battery = Math.max(5, battery - 0.05);
      return { at: Date.now(), batteryLevel: Math.round(battery) };
    },
    async sendCommand(_cmd: HardwareCommand) {
      // No-op in mock; real impl would write to a GATT characteristic.
      await delay(20);
    },
  };
}
