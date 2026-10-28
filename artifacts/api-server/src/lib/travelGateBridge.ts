import {
  ageTravelFlight, matchesTravelFlight, travelFlightResponseSchema, unavailableFlight,
  type TravelFlightRequest, type TravelFlightResponse,
} from '@workspace/api-zod';

// A server-owned destination. A client can never choose an upstream URL and
// redirects are refused, so the integration credential cannot follow a redirect.
export const TRAVELGATE_BRIDGE_URL = 'https://api.travelgateapp.com/api/integrations/aforce/flight-status';
export function bridgeKeyConfigured(key: string | undefined): key is string {
  return typeof key === 'string' && /^[a-f0-9]{64}$/i.test(key);
}

async function boundedJson(response: Response): Promise<unknown> {
  if (!response.body) throw new Error('Empty bridge response');
  const reader = response.body.getReader();
  let text = '', bytes = 0;
  const decoder = new TextDecoder();
  try {
    while (true) {
      const chunk = await reader.read();
      if (chunk.done) break;
      bytes += chunk.value.byteLength;
      if (bytes > 16_384) throw new Error('Oversized bridge response');
      text += decoder.decode(chunk.value, { stream: true });
    }
    text += decoder.decode();
    return JSON.parse(text);
  } finally { await reader.cancel().catch(() => undefined); }
}

export async function lookupTravelGateFlight(
  input: TravelFlightRequest,
  options: { key: string | undefined; fetch?: typeof fetch; now?: number },
): Promise<TravelFlightResponse> {
  if (!bridgeKeyConfigured(options.key)) return unavailableFlight('not_connected');
  try {
    const response = await (options.fetch ?? fetch)(TRAVELGATE_BRIDGE_URL, {
      method: 'POST', redirect: 'error', signal: AbortSignal.timeout(8_000),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${options.key}` },
      body: JSON.stringify(input),
    });
    if (response.status === 429) return unavailableFlight('rate_limited');
    if (!response.ok) return unavailableFlight('provider_unavailable');
    const parsed = travelFlightResponseSchema.safeParse(await boundedJson(response));
    if (!parsed.success) return unavailableFlight('invalid_response');
    if (parsed.data.availability !== 'unavailable' && !matchesTravelFlight(input, parsed.data.flight)) return unavailableFlight('mismatch');
    return ageTravelFlight(parsed.data, options.now ?? Date.now());
  } catch { return unavailableFlight('provider_unavailable'); }
}
