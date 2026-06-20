/**
 * Command Center — LOCAL typed client for the founder Retention Gates.
 *
 * Same isolation rules as commandCenter.ts: founder analytics must never
 * ship in the consumer bundles, so this talks to the hand-written,
 * OpenAPI-excluded `GET /api/admin/command-center/retention-gates` route
 * with cookie-based auth. The DTO mirrors the server `RetentionGatesDTO`
 * 1:1.
 *
 * Honesty / Score-Protection: a gate with `status: "awaiting"` has no
 * cohort yet — render its target + awaiting note, never a fabricated 0%.
 */

import { useQuery, type UseQueryResult } from "@tanstack/react-query";
import { CommandCenterApiError } from "./commandCenter";

export type GateStatus = "passing" | "failing" | "awaiting";
export type GateKind = "rate" | "duration";

export interface GateTarget {
  comparator: "gte" | "lte";
  value: number;
  display: string;
}

export interface RetentionGate {
  id: string;
  index: number;
  label: string;
  fromLabel: string;
  toLabel: string;
  kind: GateKind;
  target: GateTarget;
  /** Denominator — identities that entered the gate. */
  sampleSize: number;
  /** Numerator for rate gates; null for the duration gate. */
  converted: number | null;
  /** 0..1 rate (rate gates) or median seconds (duration); null when awaiting. */
  measured: number | null;
  status: GateStatus;
  awaitingNote: string;
}

export interface RetentionGatesDTO {
  generatedAt: string;
  gates: RetentionGate[];
}

const RETENTION_GATES_URL = "/api/admin/command-center/retention-gates";

export async function fetchRetentionGates(): Promise<RetentionGatesDTO> {
  const res = await fetch(RETENTION_GATES_URL, {
    credentials: "include",
    headers: { Accept: "application/json" },
  });
  if (!res.ok) {
    let message = res.statusText || `Request failed (${res.status})`;
    try {
      const body = (await res.json()) as { error?: unknown };
      if (body && typeof body.error === "string") message = body.error;
    } catch {
      // non-JSON error body — keep the status text
    }
    throw new CommandCenterApiError(res.status, message);
  }
  return (await res.json()) as RetentionGatesDTO;
}

export const retentionGatesQueryKey = [
  "command-center",
  "retention-gates",
] as const;

export function useRetentionGates(
  options?: { enabled?: boolean },
): UseQueryResult<RetentionGatesDTO, CommandCenterApiError> {
  return useQuery({
    queryKey: retentionGatesQueryKey,
    queryFn: fetchRetentionGates,
    enabled: options?.enabled ?? true,
  });
}

/**
 * Render a gate's measured value: a percent for rate gates, seconds for the
 * duration gate, or null when the gate is awaiting (no cohort yet).
 */
export function formatGateMeasured(gate: RetentionGate): string | null {
  if (gate.measured == null) return null;
  if (gate.kind === "duration") return `${Math.round(gate.measured)}s`;
  return `${(gate.measured * 100).toFixed(1)}%`;
}

/** Human subtitle describing the cohort behind a gate. */
export function gateSampleLabel(gate: RetentionGate): string {
  if (gate.sampleSize === 0) return "No cohort yet";
  if (gate.kind === "duration") {
    return `${gate.sampleSize.toLocaleString()} timed conversions`;
  }
  return `${(gate.converted ?? 0).toLocaleString()} / ${gate.sampleSize.toLocaleString()} identities`;
}
