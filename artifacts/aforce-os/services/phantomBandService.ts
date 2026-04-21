/**
 * Phantom Band orchestrator.
 *
 * Singleton that owns:
 *   - the BLE adapter
 *   - the band's connection lifecycle
 *   - the LED pattern derived from current performance level
 *   - a small pub/sub layer so screens + the Home overlay can react to
 *     band events without prop-drilling
 *
 * Gesture mapping → emitted events:
 *   single_tap       → 'gesture'            (acknowledge / wake)
 *   double_tap       → 'gesture' + 'voice_trigger' (priority=normal)
 *   long_press       → 'gesture' + 'status_request'
 *   press_and_hold   → 'gesture' + 'voice_trigger' (priority=emergency)
 *
 * The band itself never processes audio — voice processing always happens
 * on the phone. The band's only voice role is to TRIGGER the overlay and
 * confirm completion via haptic.
 */

import type { PerformanceLevel } from '../types';
import type {
  PhantomBandState, BandGesture, BandSignal, HardwareCommand,
  LedPattern, HapticPattern,
} from '../types/hardware';
import { ledForLevel, ledOff } from './ledSignalService';
import { playHaptic } from './hapticService';
import { createMockBleAdapter, type BleAdapter } from './bleService';
import { GESTURE_ACTION } from '../types/hardware';

type EventName =
  | 'state'           // connection / battery / led changes
  | 'gesture'         // any gesture observed
  | 'voice_trigger'   // voice mode should open
  | 'status_request'  // user requested a silent status pulse
  | 'signal';         // any new BandSignal entry

type Listener<T> = (payload: T) => void;

interface VoiceTriggerPayload {
  priority: 'normal' | 'emergency';
  source: 'gesture';
  gesture: BandGesture;
}

interface ServiceEvents {
  state: PhantomBandState;
  gesture: BandGesture;
  voice_trigger: VoiceTriggerPayload;
  status_request: undefined;
  signal: BandSignal;
}

/** Foreground / background sync intervals per spec. */
const SYNC_INTERVAL_FG_MS = 30_000;
const SYNC_INTERVAL_BG_MS = 5 * 60_000;

class PhantomBandService {
  private ble: BleAdapter = createMockBleAdapter();
  private state: PhantomBandState = {
    device: null,
    connection: 'unpaired',
    ledPattern: ledOff(),
    mirroredLevel: null,
    lastSyncAt: null,
    cachedLed: null,
  };

  private signals: BandSignal[] = [];
  private syncTimer: ReturnType<typeof setInterval> | null = null;
  private appForeground = true;
  /** Bumped on every disconnect/pair so in-flight async sync results can be ignored. */
  private sessionToken = 0;

  // ─── Pub/Sub ────────────────────────────────────────────────────────────
  private listeners: { [K in EventName]: Set<Listener<ServiceEvents[K]>> } = {
    state: new Set(),
    gesture: new Set(),
    voice_trigger: new Set(),
    status_request: new Set(),
    signal: new Set(),
  };

  on<K extends EventName>(event: K, fn: Listener<ServiceEvents[K]>): () => void {
    this.listeners[event].add(fn);
    return () => this.listeners[event].delete(fn);
  }

  private emit<K extends EventName>(event: K, payload: ServiceEvents[K]): void {
    this.listeners[event].forEach((fn) => {
      try { fn(payload); } catch { /* swallow listener errors */ }
    });
  }

  // ─── Public state accessors ─────────────────────────────────────────────
  getState(): PhantomBandState { return this.state; }
  getSignals(): BandSignal[]   { return this.signals.slice(0, 12); }

  private setState(patch: Partial<PhantomBandState>): void {
    this.state = { ...this.state, ...patch };
    this.emit('state', this.state);
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────
  async pair(): Promise<void> {
    if (this.state.connection === 'connected' || this.state.connection === 'pairing') return;
    this.sessionToken += 1;
    const token = this.sessionToken;
    this.setState({ connection: 'pairing' });
    try {
      const device = await this.ble.pair();
      // Bail if the user disconnected while we were pairing.
      if (token !== this.sessionToken) return;

      // Restore the LED to whatever the OS believes it should be: prefer the
      // cached pattern, otherwise derive from the current mirrored level.
      const restoredLed = this.state.cachedLed
        ?? (this.state.mirroredLevel ? ledForLevel(this.state.mirroredLevel) : this.state.ledPattern);

      this.setState({
        device,
        connection: 'connected',
        lastSyncAt: Date.now(),
        ledPattern: restoredLed,
      });
      // Push the LED to the band so display matches OS state immediately.
      void this.ble.sendCommand({ type: 'set_led', pattern: restoredLed }).catch(() => {});
      this.startSyncLoop();
      this.pushSignal({ at: Date.now(), source: 'system', note: 'Paired with PHANTOM Band' });
      void this.sendHaptic('voice_open'); // gentle pairing confirmation
    } catch {
      if (token === this.sessionToken) this.setState({ connection: 'disconnected' });
    }
  }

  async disconnect(): Promise<void> {
    this.sessionToken += 1; // invalidate any in-flight syncs / pair callbacks
    this.stopSyncLoop();
    await this.ble.disconnect().catch(() => { /* ignore */ });
    this.setState({
      connection: 'disconnected',
      cachedLed: this.state.ledPattern, // cache last known LED while offline
      ledPattern: ledOff(),
    });
    this.pushSignal({ at: Date.now(), source: 'system', note: 'Band disconnected' });
  }

  async reconnect(): Promise<void> {
    await this.disconnect();
    await this.pair();
  }

  // ─── Sync loop ──────────────────────────────────────────────────────────
  setForegroundMode(foreground: boolean): void {
    if (this.appForeground === foreground) return;
    this.appForeground = foreground;
    if (this.state.connection === 'connected') this.startSyncLoop();
  }

  private startSyncLoop(): void {
    this.stopSyncLoop();
    const interval = this.appForeground ? SYNC_INTERVAL_FG_MS : SYNC_INTERVAL_BG_MS;
    this.syncTimer = setInterval(() => { void this.syncNow(); }, interval);
  }

  private stopSyncLoop(): void {
    if (this.syncTimer) { clearInterval(this.syncTimer); this.syncTimer = null; }
  }

  async syncNow(): Promise<void> {
    if (this.state.connection !== 'connected') return;
    const token = this.sessionToken;
    this.setState({ connection: 'syncing' });
    try {
      const { at, batteryLevel } = await this.ble.sync();
      // Drop the result if the user disconnected (or re-paired) while we were
      // waiting on the BLE round-trip. Without this the stale resolution would
      // flip the UI back to "connected" after an explicit disconnect.
      if (token !== this.sessionToken) return;
      this.setState({
        connection: 'connected',
        lastSyncAt: at,
        device: this.state.device ? { ...this.state.device, batteryLevel } : null,
      });
    } catch {
      if (token !== this.sessionToken) return;
      // Sync failed — give up on this connection: stop the loop and report
      // disconnected so the next user action is an explicit re-pair.
      this.stopSyncLoop();
      this.setState({
        connection: 'disconnected',
        cachedLed: this.state.ledPattern,
        ledPattern: ledOff(),
      });
    }
  }

  // ─── Performance-state mirroring ────────────────────────────────────────
  /** Called by the OS whenever the engine emits a new performance level. */
  mirrorPerformance(level: PerformanceLevel): void {
    if (this.state.mirroredLevel === level) return;
    const ledPattern = ledForLevel(level);
    this.setState({ mirroredLevel: level, ledPattern, cachedLed: ledPattern });

    // Push the LED command if connected; otherwise the cachedLed will be
    // re-sent on next pair/reconnect.
    if (this.state.connection === 'connected') {
      void this.sendCommand({ type: 'set_led', pattern: ledPattern });
    }

    // Auto-haptic for transitions into urgent states.
    if (level === 'RECOVERING') void this.sendHaptic('recovery_needed');
    if (level === 'DEPLETED')   void this.sendHaptic('depleted');
  }

  // ─── Outbound BLE commands ──────────────────────────────────────────────
  async sendCommand(cmd: HardwareCommand): Promise<void> {
    if (this.state.connection !== 'connected' && this.state.connection !== 'syncing') return;
    await this.ble.sendCommand(cmd).catch(() => { /* ignore */ });
  }

  async sendHaptic(pattern: HapticPattern): Promise<void> {
    // Replay locally so the user feels the band beat even on phone-only demo.
    playHaptic(pattern);
    await this.sendCommand({ type: 'haptic', pattern });
  }

  /** Push a custom LED pattern (e.g., critical heat override). */
  async setLed(pattern: LedPattern): Promise<void> {
    this.setState({ ledPattern: pattern, cachedLed: pattern });
    await this.sendCommand({ type: 'set_led', pattern });
  }

  // ─── Gesture ingest (real BLE would push these via notification) ───────
  /**
   * Inject a gesture event. In the demo this is called from the settings
   * screen test buttons; on real hardware, the BLE notification handler
   * would call this with the gesture parsed off the band.
   */
  reportGesture(gesture: BandGesture): void {
    this.pushSignal({ at: Date.now(), source: 'gesture', gesture });
    this.emit('gesture', gesture);

    // Local haptic confirmation per gesture mapping.
    const mapping = GESTURE_ACTION[gesture];
    void this.sendHaptic(mapping.haptic);

    switch (gesture) {
      case 'double_tap':
        this.emit('voice_trigger', { priority: 'normal', source: 'gesture', gesture });
        return;
      case 'press_and_hold':
        this.emit('voice_trigger', { priority: 'emergency', source: 'gesture', gesture });
        return;
      case 'long_press':
        this.emit('status_request', undefined);
        return;
      case 'single_tap':
      default:
        return;
    }
  }

  private pushSignal(signal: BandSignal): void {
    this.signals = [signal, ...this.signals].slice(0, 24);
    this.emit('signal', signal);
  }
}

// Exported singleton — the band is global, so the service is too.
export const phantomBandService = new PhantomBandService();
