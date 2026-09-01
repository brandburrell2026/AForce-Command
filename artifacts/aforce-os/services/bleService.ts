/**
 * BLE adapter for the Phantom Band.
 *
 * Provides two implementations behind a single `BleAdapter` interface:
 *   - createMockBleAdapter() — deterministic simulator used on web /
 *     Expo Go (no native BLE) and as a fallback when the dev client
 *     wasn't built with `react-native-ble-plx`. Auto-fires a sip event
 *     every 90s when paired so demo flows work without hardware.
 *   - createRealBleAdapter() — wraps `react-native-ble-plx` against the
 *     Phantom GATT service when available. Imported via dynamic require
 *     so the bundle still loads when the native module isn't present.
 *
 * Phantom GATT service (custom UUIDs):
 *   Service        : 0000A4C5-0000-1000-8000-00805F9B34FB
 *   Battery (read) : 0000A4C6-0000-1000-8000-00805F9B34FB  uint8 percent
 *   Sip    (notify): 0000A4C7-0000-1000-8000-00805F9B34FB
 *     payload (3 bytes):
 *       byte 0..1  uint16 little-endian, oz × 10  (e.g. 0x00C8 = 20.0 oz)
 *       byte 2     flavor enum: 0=unflavored, 1=watermelon, 2=berry, 3=soursop
 *
 * Sip ingest flow on the client:
 *   real BLE notification → BleAdapter.onSip(cb) → phantomBandService
 *   emits 'sip' → useAppStore mounts a listener that calls
 *   logIntake(fluidType, { source: 'phantom_band', ozOverride, flavor })
 *   so each detected sip auto-creates an intake event AND chains the
 *   journal snapshot writer that watches engineOutput.
 */

import { Platform } from 'react-native';
import type { HardwareDevice, HardwareCommand } from '../types/hardware';
import type { ProductFlavor, FluidType } from '../types';

// ─── Phantom GATT identifiers ────────────────────────────────────────────────
export const PHANTOM_GATT = {
  service:     '0000A4C5-0000-1000-8000-00805F9B34FB',
  batteryChar: '0000A4C6-0000-1000-8000-00805F9B34FB',
  sipChar:     '0000A4C7-0000-1000-8000-00805F9B34FB',
} as const;

const FLAVOR_BY_BYTE: Record<number, ProductFlavor | undefined> = {
  0: 'unflavored',
  1: 'watermelon',
  2: 'berry',
  3: 'soursop',
};

export interface SipEvent {
  /** Detected oz consumed in this sip (0.1 oz resolution from the band). */
  oz: number;
  /** Flavor hint from the band (smart cap reads the cartridge). */
  flavor?: ProductFlavor;
  /** AForce fluid family — the band only ships with AForce-compatible carriers. */
  fluidType: FluidType;
  /** Epoch ms when the band fired the notification. */
  at: number;
  /** Which adapter produced the event (analytics / debug surface). */
  source: 'phantom_band:real' | 'phantom_band:simulator';
}

export interface BleAdapter {
  pair(): Promise<HardwareDevice>;
  disconnect(): Promise<void>;
  sync(): Promise<{ at: number; batteryLevel: number }>;
  sendCommand(cmd: HardwareCommand): Promise<void>;
  /** Subscribe to sip notifications. Returns an unsubscribe fn. */
  onSip(cb: (sip: SipEvent) => void): () => void;
  /**
   * Manually fire a fake sip — used by the "Simulate sip" dev button on
   * PhantomBandScreen and the auto-tick on the simulator. Real adapters
   * implement it as a no-op (the band is the only legitimate source).
   */
  simulateSip(opts?: Partial<Pick<SipEvent, 'oz' | 'flavor' | 'fluidType'>>): void;
}

const MOCK_DEVICE: HardwareDevice = {
  deviceId: 'phantom_001',
  name: 'PHANTOM Band',
  kind: 'phantom_band',
  firmwareVersion: '1.2.4',
  batteryLevel: 82,
  signalStrengthDb: -54,
};

function delay(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// ─── Mock adapter ─────────────────────────────────────────────────────────────
const SIM_FLAVORS: ProductFlavor[] = ['watermelon', 'berry', 'soursop', 'unflavored'];
const SIM_AUTO_INTERVAL_MS = 90_000;

// Production safety: never auto-fire fake sip events in a release
// build. If a user pairs and the real BLE module isn't available,
// the simulator still satisfies the API but stays silent — manual
// `simulateSip()` calls (dev button) still work for support flows,
// but no data will be silently injected into intake_logs.
// __DEV__ is a global injected by the React Native packager.
declare const __DEV__: boolean | undefined;
const AUTO_SIP_ENABLED = typeof __DEV__ !== 'undefined' ? __DEV__ : false;

export function createMockBleAdapter(): BleAdapter {
  let battery = MOCK_DEVICE.batteryLevel;
  let paired = false;
  let autoSipTimer: ReturnType<typeof setInterval> | null = null;
  const sipListeners = new Set<(sip: SipEvent) => void>();

  function emitSip(sip: SipEvent) {
    sipListeners.forEach((fn) => {
      try { fn(sip); } catch { /* swallow */ }
    });
  }

  function startAutoSip() {
    if (autoSipTimer || !AUTO_SIP_ENABLED) return;
    autoSipTimer = setInterval(() => {
      if (!paired) return;
      // Random 4–10 oz with rotating flavor — keeps the demo varied.
      const oz = 4 + Math.round(Math.random() * 60) / 10; // 4.0–10.0 oz
      const flavor = SIM_FLAVORS[Math.floor(Math.random() * SIM_FLAVORS.length)];
      emitSip({
        at: Date.now(),
        oz,
        ...(flavor ? { flavor } : {}),
        // Simulate what the real device can actually establish (RP-8b).
        fluidType: 'water',
        source: 'phantom_band:simulator',
      });
    }, SIM_AUTO_INTERVAL_MS);
  }

  function stopAutoSip() {
    if (autoSipTimer) { clearInterval(autoSipTimer); autoSipTimer = null; }
  }

  return {
    async pair() {
      await delay(600);
      paired = true;
      startAutoSip();
      return { ...MOCK_DEVICE, batteryLevel: battery };
    },
    async disconnect() {
      paired = false;
      stopAutoSip();
      await delay(120);
    },
    async sync() {
      await delay(120);
      battery = Math.max(5, battery - 0.05);
      return { at: Date.now(), batteryLevel: Math.round(battery) };
    },
    async sendCommand(_cmd: HardwareCommand) {
      await delay(20);
    },
    onSip(cb) {
      sipListeners.add(cb);
      return () => sipListeners.delete(cb);
    },
    simulateSip(opts = {}) {
      emitSip({
        at: Date.now(),
        oz: opts.oz ?? 8,
        ...(opts.flavor ? { flavor: opts.flavor } : { flavor: 'watermelon' }),
        // Explicit override only — no brand default (RP-8b).
        fluidType: opts.fluidType ?? 'water',
        source: 'phantom_band:simulator',
      });
    },
  };
}

// ─── Real adapter (react-native-ble-plx) ─────────────────────────────────────
/**
 * Decode a 3-byte sip notification payload.
 * Keeping the parser separate makes it unit-testable without the BLE stack.
 */
export function decodeSipPayload(bytes: Uint8Array): Omit<SipEvent, 'at' | 'source' | 'fluidType'> {
  if (bytes.length < 3) return { oz: 0 };
  // Little-endian uint16: low byte first, high byte second.
  const ozTenths = bytes[0]! | (bytes[1]! << 8);
  const oz = ozTenths / 10;
  const flavor = FLAVOR_BY_BYTE[bytes[2]!];
  return flavor ? { oz, flavor } : { oz };
}

/**
 * Best-effort base64 → Uint8Array. expo / react-native-ble-plx delivers
 * characteristic values as base64 strings.
 */
function base64ToBytes(b64: string): Uint8Array {
  // atob exists on web + recent Hermes/RN runtimes (via @stardazed polyfill).
  const bin = typeof atob === 'function'
    ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i += 1) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Try to load `react-native-ble-plx` — returns null when:
 *   - the package isn't installed (web / Expo Go)
 *   - we're running on web (no native BLE)
 *
 * The require is wrapped in `try/catch` AND hidden behind an indirection
 * so Metro doesn't statically resolve it at bundle time on platforms
 * where the native module is absent.
 */
function tryLoadBlePlx(): { BleManager: new () => unknown } | null {
  if (Platform.OS === 'web') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports, @typescript-eslint/no-var-requires
    const dynamicRequire = (eval('require') as NodeRequire);
    return dynamicRequire('react-native-ble-plx') as { BleManager: new () => unknown };
  } catch {
    return null;
  }
}

/**
 * Real BLE adapter against the Phantom GATT service. Returns null when
 * the native module isn't available so the caller falls back to mock.
 *
 * NOTE: this function is intentionally untyped against the ble-plx API
 * (uses `any` in narrow places) because the package is an optional
 * native peer that may not be installed in this workspace's lockfile.
 * The runtime contract is stable (BleManager, Device, Characteristic).
 */
export function createRealBleAdapter(): BleAdapter | null {
  const mod = tryLoadBlePlx();
  if (!mod) return null;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const manager: any = new mod.BleManager();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let device: any | null = null;
  let sipSub: { remove: () => void } | null = null;
  const sipListeners = new Set<(sip: SipEvent) => void>();

  function emitSip(sip: SipEvent) {
    sipListeners.forEach((fn) => {
      try { fn(sip); } catch { /* swallow */ }
    });
  }

  return {
    async pair() {
      // Scan for ~5s for any device advertising the Phantom service.
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const found: any = await new Promise((resolve, reject) => {
        const timeout = setTimeout(() => {
          manager.stopDeviceScan();
          reject(new Error('phantom_scan_timeout'));
        }, 5_000);
        manager.startDeviceScan(
          [PHANTOM_GATT.service],
          null,
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (err: any, dev: any) => {
            if (err) { clearTimeout(timeout); manager.stopDeviceScan(); reject(err); return; }
            if (dev) { clearTimeout(timeout); manager.stopDeviceScan(); resolve(dev); }
          },
        );
      });

      device = await found.connect();
      await device.discoverAllServicesAndCharacteristics();

      // Subscribe to sip notifications. Each callback receives a base64
      // encoded value which we decode and forward to listeners.
      sipSub = device.monitorCharacteristicForService(
        PHANTOM_GATT.service,
        PHANTOM_GATT.sipChar,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (err: any, ch: any) => {
          if (err || !ch?.value) return;
          try {
            const bytes = base64ToBytes(ch.value as string);
            const decoded = decodeSipPayload(bytes);
            if (decoded.oz <= 0) return;
            emitSip({
              at: Date.now(),
              oz: decoded.oz,
              ...(decoded.flavor ? { flavor: decoded.flavor } : {}),
              // RP-8b (founder ruling 2026-08-31): the band measures VOLUME.
              // Its wire payload carries no product identity at all — the
              // decoder's own signature omits `fluidType` — so naming an
              // AForce format here was an assertion the hardware cannot
              // support. It also silently incremented `aforceUnitsToday`,
              // manufacturing a product fact from a plain sip. Unattributed
              // fluid is logged as 'water'; under volume parity that is
              // score-identical, and it claims nothing untrue.
              fluidType: 'water',
              source: 'phantom_band:real',
            });
          } catch { /* malformed payload — ignore */ }
        },
      );

      // Read the battery characteristic so the UI shows a real %.
      let batteryLevel = MOCK_DEVICE.batteryLevel;
      try {
        const batteryCh = await device.readCharacteristicForService(
          PHANTOM_GATT.service,
          PHANTOM_GATT.batteryChar,
        );
        if (batteryCh?.value) {
          const bytes = base64ToBytes(batteryCh.value as string);
          if (bytes.length > 0) batteryLevel = bytes[0]!;
        }
      } catch { /* battery is best-effort */ }

      return {
        deviceId: device.id ?? MOCK_DEVICE.deviceId,
        name: device.name ?? MOCK_DEVICE.name,
        kind: 'phantom_band',
        firmwareVersion: MOCK_DEVICE.firmwareVersion,
        batteryLevel,
        signalStrengthDb: device.rssi ?? MOCK_DEVICE.signalStrengthDb,
      };
    },
    async disconnect() {
      try { sipSub?.remove(); } catch { /* ignore */ }
      sipSub = null;
      try { await device?.cancelConnection?.(); } catch { /* ignore */ }
      device = null;
    },
    async sync() {
      let batteryLevel = MOCK_DEVICE.batteryLevel;
      try {
        const ch = await device?.readCharacteristicForService(
          PHANTOM_GATT.service,
          PHANTOM_GATT.batteryChar,
        );
        if (ch?.value) {
          const bytes = base64ToBytes(ch.value as string);
          if (bytes.length > 0) batteryLevel = bytes[0]!;
        }
      } catch { /* tolerate transient read failure */ }
      return { at: Date.now(), batteryLevel };
    },
    async sendCommand(_cmd: HardwareCommand) {
      // Outbound writes (LED / haptic) would target additional Phantom
      // characteristics here; left as a no-op for v1 since the spec
      // only requires inbound sip auto-log.
    },
    onSip(cb) {
      sipListeners.add(cb);
      return () => sipListeners.delete(cb);
    },
    simulateSip() {
      // Real adapter does not synthesize sips — the band is the source
      // of truth. Use the simulator adapter for manual testing.
    },
  };
}

/**
 * Pick the right adapter for the current runtime. Native dev clients
 * with `react-native-ble-plx` installed get the real one; everywhere
 * else we fall back to the simulator so the OS still works end-to-end.
 */
export function createBleAdapter(): BleAdapter {
  const real = createRealBleAdapter();
  return real ?? createMockBleAdapter();
}
