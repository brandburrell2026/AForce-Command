import { useAuth } from '@clerk/expo';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { journeyRepository } from '@/services/travel/storage';
import { travelRuntime } from '@/services/travel/runtime';
import { isTravelCacheForOwner } from '@/services/travel/cache';
import type { DepartureInput, TravelJourney } from '@/services/travel/journey';

export function useTravelJourney(enabled = true) {
  const { userId, isSignedIn, isLoaded } = useAuth();
  const owner = isLoaded && isSignedIn && userId ? userId : null;
  const queryClient = useQueryClient();
  const queryKey = ['travel-journey-v1', owner] as const;
  const query = useQuery({ queryKey, queryFn: () => journeyRepository.load(owner!), enabled: enabled && !!owner, retry: false });
  const mutation = useMutation({
    mutationKey: queryKey,
    mutationFn: async (action: { kind: 'save' | 'update'; input: DepartureInput } | { kind: 'finish' } | { kind: 'remove' } | { kind: 'clear' }) => {
      if (!owner) throw new Error('Sign in to manage your journey.');
      const current = travelRuntime.captureOwner(owner);
      let journey: TravelJourney | null;
      try {
        if (action.kind === 'clear') { await travelRuntime.clear(owner); journey = null; }
        else journey = await travelRuntime.changeJourney(owner, action);
      } catch (error) {
        if (action.kind === 'clear') {
          // Clearing can partially succeed. Discard cached status regardless,
          // and re-read disk so the screen never claims a removed trip remains.
          await queryClient.cancelQueries({ predicate: query => isTravelCacheForOwner(query.queryKey, owner) });
          queryClient.removeQueries({ predicate: query => query.queryKey[0] === 'travel-flight-status-v1' && query.queryKey[1] === owner });
          if (current()) await queryClient.invalidateQueries({ queryKey, exact: true });
        }
        throw error;
      }
      if (!current()) return journey;
      await queryClient.cancelQueries({ queryKey, exact: true });
      if (!current()) return journey;
      queryClient.setQueryData<TravelJourney | null>(queryKey, journey);
      if (action.kind === 'clear' || action.kind === 'remove' || action.kind === 'finish') {
        const predicate = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] === 'travel-flight-status-v1' && query.queryKey[1] === owner;
        await queryClient.cancelQueries({ predicate });
        queryClient.removeQueries({ predicate });
      }
      return journey;
    },
  });
  return { owner, query, mutation };
}
