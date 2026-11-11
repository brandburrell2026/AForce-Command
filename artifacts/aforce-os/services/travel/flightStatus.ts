import {
  ageTravelFlight, matchesTravelFlight, travelFlightResponseSchema,
  type TravelFlightRequest, type TravelFlightResponse,
} from '@workspace/api-zod';

export class TravelStatusError extends Error {
  constructor(public readonly reason: string) { super(reason); this.name = 'TravelStatusError'; }
}
export type ReportedFlightStatus = Exclude<TravelFlightResponse, { availability: 'unavailable' }>;

/** The mobile session token goes only to AForce's configured API. */
export async function fetchTravelFlightStatus(options: {
  request: TravelFlightRequest; apiBase: string; getToken: () => Promise<string | null>;
  signal: AbortSignal; fetch?: typeof fetch;
}): Promise<ReportedFlightStatus> {
  if (options.signal.aborted) throw new TravelStatusError('cancelled');
  let onAbort!: () => void;
  const aborted = new Promise<never>((_resolve, reject) => {
    onAbort = () => reject(new TravelStatusError('cancelled'));
    options.signal.addEventListener('abort', onAbort, { once: true });
  });
  let token: string | null;
  try { token = await Promise.race([options.getToken(), aborted]); }
  finally { options.signal.removeEventListener('abort', onAbort); }
  if (options.signal.aborted) throw new TravelStatusError('cancelled');
  if (!token) throw new TravelStatusError('unauthorized');
  const response = await (options.fetch ?? fetch)(`${options.apiBase.replace(/\/+$/, '')}/travel/flight-status`, {
    method: 'POST', redirect: 'error', signal: options.signal,
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(options.request),
  });
  if (!response.ok) {
    throw new TravelStatusError(response.status === 401 ? 'unauthorized' : response.status === 403 || response.status === 503 ? 'not_connected' : response.status === 429 ? 'rate_limited' : 'provider_unavailable');
  }
  const parsed = travelFlightResponseSchema.safeParse(await response.json());
  if (!parsed.success) throw new TravelStatusError('invalid_response');
  const result = ageTravelFlight(parsed.data);
  if (result.availability === 'unavailable') throw new TravelStatusError(result.reason);
  if (!matchesTravelFlight(options.request, result.flight)) throw new TravelStatusError('mismatch');
  return result;
}
