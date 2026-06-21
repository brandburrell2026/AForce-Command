/**
 * Activation tracker — records the ACQUISITION QR / activation deep-link
 * that brought a user to AForce, then emits the `qr_scanned` analytics
 * event that feeds the founder activation funnel.
 *
 * Privacy before collection: a scan is parsed and buffered ON-DEVICE
 * only. Nothing is sent until the user grants analytics consent — the
 * buffered scan is held and flushed the moment consent exists, stamped
 * with the ORIGINAL scan time so funnel chronology stays honest. The
 * acquisition QR is distinct from the in-app HydroScan product scan
 * (`receipt_scanned`); this module only acts on trusted activation links
 * (scheme + host-allowlist + exact `/activate` path), all enforced by
 * `@workspace/activation-core`.
 *
 * Score-Protection: attribution is descriptive metadata only — it never
 * awards or mutates score. No navigation: recording a scan never
 * redirects, so it cannot fight onboarding or the opening overlay.
 */
import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  activationDedupeKey,
  activationEventPayload,
  isActivationLink,
  parseActivationLink,
} from "@workspace/activation-core";

import { emit } from "./event_dispatcher";
import { isConsentGranted } from "./privacy_manager";

const PENDING_KEY = "@aforce/activation-pending";
const EMITTED_KEY = "@aforce/activation-emitted";
/** Bound both lists so a pathological link storm can't grow storage. */
const MAX_PENDING = 20;
const MAX_EMITTED = 50;

interface PendingActivation {
  /** Stable dedupe key (per-QR id or url hash). */
  key: string;
  /** Canonical qr_scanned payload (attribution dimensions present). */
  payload: Record<string, string>;
  /** ISO time the link was received (the real scan time). */
  occurredAt: string;
}

async function readList<T>(key: string): Promise<T[]> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? (parsed as T[]) : [];
  } catch {
    return [];
  }
}

async function writeList<T>(key: string, list: T[]): Promise<void> {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(list));
  } catch {
    /* non-fatal — best-effort buffering */
  }
}

/**
 * Record a scanned link. No-ops for any non-activation / untrusted link.
 * Buffers the scan on-device and attempts an immediate (consent-gated)
 * flush. Safe to call from a deep-link listener on every URL.
 */
export async function recordActivationLink(url: string): Promise<void> {
  if (!isActivationLink(url)) return;
  const attribution = parseActivationLink(url);
  const key = activationDedupeKey(attribution, url);

  // Already counted this physical QR (across relaunches) — nothing to do.
  const emitted = await readList<string>(EMITTED_KEY);
  if (emitted.includes(key)) return;

  const pending = await readList<PendingActivation>(PENDING_KEY);
  if (!pending.some((p) => p.key === key)) {
    pending.push({
      key,
      payload: activationEventPayload(attribution),
      occurredAt: new Date().toISOString(),
    });
    await writeList(PENDING_KEY, pending.slice(-MAX_PENDING));
  }
  await flushPendingActivation();
}

/**
 * Emit any buffered scans once consent exists. Holds everything until
 * consent (privacy) and stamps each event with its original scan time so
 * `qr_scanned` correctly precedes the later app-open / activation events.
 * Idempotent: re-flushing never re-emits a key that already went out.
 */
export async function flushPendingActivation(): Promise<void> {
  const pending = await readList<PendingActivation>(PENDING_KEY);
  if (pending.length === 0) return;
  // Privacy gate: nothing leaves the device pre-consent; keep buffering.
  if (!(await isConsentGranted())) return;

  const emittedSet = new Set(await readList<string>(EMITTED_KEY));
  for (const p of pending) {
    if (emittedSet.has(p.key)) continue;
    // Persisted to the durable outbox by emit(); safe to clear pending after.
    await emit("qr_scanned", p.payload, p.occurredAt);
    emittedSet.add(p.key);
  }
  await writeList(EMITTED_KEY, [...emittedSet].slice(-MAX_EMITTED));
  await writeList<PendingActivation>(PENDING_KEY, []);
}
