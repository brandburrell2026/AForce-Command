import { describe, expect, it } from 'vitest';
import { acceptTravelProposal, flightChanges, travelProposal, travelTripsSchema, type TravelLeg, type TravelSnapshot } from '../travelIntelligence';
const now = Date.parse('2026-11-01T10:00:00Z');
const leg: TravelLeg = { id:'leg_1', flight:{flightNumber:'DL1181', departureDate:'2026-11-01',origin:'LGA',destination:'FLL'},departureAt:'2026-11-01T15:45:00Z',arrivalAt:null,originTimeZone:'America/New_York',destinationTimeZone:'America/New_York' };
const snapshot = (): TravelSnapshot => ({version:2,provider:'flightaware',availability:'available',fetchedAt:new Date(now).toISOString(),flight:{...leg.flight,status:'delayed',scheduledDeparture:leg.departureAt,estimatedDeparture:'2026-11-01T16:45:00Z',departureGate:'82',departureTerminal:'C',scheduledArrival:'2026-11-01T19:48:00Z',estimatedArrival:'2026-11-01T20:48:00Z',actualArrival:null,actualDeparture:null,originTimeZone:leg.originTimeZone,destinationTimeZone:leg.destinationTimeZone}});
const trip = () => ({id:'trip_1',title:'Florida',legs:[leg],completedAt:null,createdAt:new Date(now).toISOString()});
describe('reviewed travel intelligence',()=>{
 it('creates a change proposal without changing an itinerary, and applies only the reviewed value',()=>{
  const source=trip(),observed=snapshot(),proposal=travelProposal(leg,observed,now)!;
  expect(source.legs[0].departureAt).toBe(leg.departureAt);
  const accepted=acceptTravelProposal([source],leg.id,observed,proposal.key,now);
  expect(accepted[0].legs[0].departureAt).toBe(observed.flight.estimatedDeparture);
  expect(accepted[0].legs[0].flight.departureDate).toBe('2026-11-01');
  expect(()=>acceptTravelProposal([source],leg.id,observed,'old-proposal',now)).toThrow();
 });
 it('withholds stale, mismatched, cancelled and diverted proposals',()=>{
  const s=snapshot();s.availability='stale';expect(travelProposal(leg,s,now)).toBeNull();
  s.availability='available';s.flight.destination='MIA';expect(travelProposal(leg,s,now)).toBeNull();
  s.flight.destination='FLL';s.flight.status='cancelled';expect(travelProposal(leg,s,now)?.canAccept).toBe(false);
  s.flight.status='diverted';expect(travelProposal(leg,s,now)?.canAccept).toBe(false);
 });
 it('does not send a first-observation or timestamp-only change and detects gate changes',()=>{
  const s=snapshot();expect(flightChanges(null,s)).toEqual([]);
  const second={...s,fetchedAt:new Date(now+30_000).toISOString()};expect(flightChanges(s,second)).toEqual([]);
  second.flight={...s.flight,departureGate:'83'};expect(flightChanges(s,second)).toEqual([{field:'departureGate',before:'82',after:'83'}]);
 });
 it('rejects disconnected, duplicate and overlapping legs',()=>{
  const second={...leg,id:'leg_2',flight:{...leg.flight,origin:'MIA',destination:'BOS'}};
  expect(travelTripsSchema.safeParse([{...trip(),legs:[leg,second]}]).success).toBe(false);
  expect(travelTripsSchema.safeParse([trip(),trip()]).success).toBe(false);
  second.flight.origin='FLL';second.departureAt='2026-11-01T15:00:00Z';expect(travelTripsSchema.safeParse([{...trip(),legs:[leg,second]}]).success).toBe(false);
 });
});
