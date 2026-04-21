/**
 * In-process store for AForce OS server-side persistence.
 *
 * Keyed by deviceId (sent by the mobile client as `x-device-id`).
 * In production this would be a real database scoped by user; in this
 * environment we keep the same shape so the swap is mechanical.
 */

export interface ScanRecord {
  id: string;
  deviceId: string;
  loggedAt: string;
  source: "barcode" | "qr" | "manual" | "camera";
  rawValue: string;
  productId: string | null;
  productName: string;
  brand: string | null;
  verdict: string;
  fitScore: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
  recommendedProductId: string | null;
}

export interface CycleRecord {
  id: string;
  deviceId: string;
  loggedAt: string;
  fluidType: string;
  ozAmount: number;
  scoreBefore: number;
  scoreAfter: number;
  performanceState: string;
}

const scansByDevice = new Map<string, ScanRecord[]>();
const cyclesByDevice = new Map<string, CycleRecord[]>();

const MAX_RECORDS_PER_DEVICE = 500;

function pushBounded<T>(list: T[], item: T): T[] {
  const next = [item, ...list];
  return next.length > MAX_RECORDS_PER_DEVICE
    ? next.slice(0, MAX_RECORDS_PER_DEVICE)
    : next;
}

export function appendScan(record: ScanRecord): void {
  const existing = scansByDevice.get(record.deviceId) ?? [];
  scansByDevice.set(record.deviceId, pushBounded(existing, record));
}

export function listScans(deviceId: string, limit = 50): ScanRecord[] {
  return (scansByDevice.get(deviceId) ?? []).slice(0, limit);
}

export function appendCycle(record: CycleRecord): void {
  const existing = cyclesByDevice.get(record.deviceId) ?? [];
  cyclesByDevice.set(record.deviceId, pushBounded(existing, record));
}

export function listCycles(deviceId: string, limit = 50): CycleRecord[] {
  return (cyclesByDevice.get(deviceId) ?? []).slice(0, limit);
}

export function getStats(deviceId: string): {
  totalScans: number;
  totalCycles: number;
  last7DaysScans: number;
} {
  const scans = scansByDevice.get(deviceId) ?? [];
  const cycles = cyclesByDevice.get(deviceId) ?? [];
  const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const last7 = scans.filter((s) => Date.parse(s.loggedAt) >= cutoff).length;
  return {
    totalScans: scans.length,
    totalCycles: cycles.length,
    last7DaysScans: last7,
  };
}
