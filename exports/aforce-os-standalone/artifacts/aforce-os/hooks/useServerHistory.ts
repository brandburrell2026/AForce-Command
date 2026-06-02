/**
 * React Query hooks over the AForce OS API server.
 *
 * Reads are cached and auto-refreshed; writes invalidate the relevant
 * query keys so the history UI stays in sync without manual plumbing.
 */

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

import {
  fetchCycles,
  fetchScans,
  postCycle,
  postScan,
  type ServerCycle,
  type ServerScan,
  type CycleStats,
} from "../lib/api";

const SCANS_KEY = ["aforce", "scans"] as const;
const CYCLES_KEY = ["aforce", "cycles"] as const;

export function useScanHistory(limit = 50) {
  return useQuery<ServerScan[]>({
    queryKey: [...SCANS_KEY, limit],
    queryFn: () => fetchScans(limit),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function useCycleHistory(limit = 50) {
  return useQuery<{ cycles: ServerCycle[]; stats: CycleStats }>({
    queryKey: [...CYCLES_KEY, limit],
    queryFn: () => fetchCycles(limit),
    staleTime: 30 * 1000,
    retry: 1,
  });
}

export function usePostScan() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postScan,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: SCANS_KEY });
    },
  });
}

export function usePostCycle() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: postCycle,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: CYCLES_KEY });
    },
  });
}
