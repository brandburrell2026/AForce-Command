import { QueryClient } from "@tanstack/react-query";

/**
 * Shared QueryClient for the founder Command Center.
 *
 * `retry: false` because the founder endpoints fail closed with 401/403
 * for non-founders — retrying a forbidden request is pointless and would
 * just delay the access-denied state. Founder analytics are low-frequency
 * so an aggressive refetch policy buys nothing.
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
      refetchOnWindowFocus: false,
      staleTime: 30_000,
    },
  },
});
