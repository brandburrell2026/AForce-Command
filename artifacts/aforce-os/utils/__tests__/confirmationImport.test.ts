import { describe, expect, it } from 'vitest';
import { MAX_CONFIRMATION_LENGTH, reviewConfirmation } from '../travel/confirmationImport';

const details = `From: New York (JFK)
To: Los Angeles (LAX)
Departure: December 3, 2026 at 9:05 AM
Arrival: December 3, 2026 at 12:20 PM`;
const text = (flight = 'Flight: AA123') => `${flight}\n${details}`;

describe('confirmation text becomes a review, never a booking or a save', () => {
  it.each([
    ['American Airlines Flight 123', 'AA123'], ['Delta Air Lines 123', 'DL123'],
    ['United Airlines 123', 'UA123'], ['Southwest Airlines Flight #123', 'WN123'],
    ['JetBlue 123', 'B6123'], ['Alaska Airlines 123', 'AS123'],
    ['Spirit Airlines 123', 'NK123'], ['Frontier Airlines 123', 'F9123'],
    ['Flight: B6 123', 'B6123'], ['Flight UA 123', 'UA123'],
  ])('reads a clearly named flight: %s', (header, flightNumber) => {
    const result = reviewConfirmation(text(header));
    expect(result.legs).toEqual([{ flightNumber, origin: 'JFK', destination: 'LAX', date: '2026-12-03', time: '09:05', arrivalDate: '2026-12-03', arrivalTime: '12:20' }]);
    expect(result.notes.join(' ')).toContain('Nothing has been checked with the airline');
  });
  it('reads a separate airline heading only when one carrier is explicitly named', () => {
    expect(reviewConfirmation(`Southwest Airlines\nFlight #123\n${details}`).legs[0]!.flightNumber).toBe('WN123');
    expect(() => reviewConfirmation(`Southwest Airlines and Delta\nFlight #123\n${details}`)).toThrow('No clear flight number');
  });
  it('does not infer the airline from a payment card or address footer', () => {
    expect(() => reviewConfirmation(`Flight #123\n${details}\nPaid with American Express\nUNITED STATES`)).toThrow('No clear flight number');
  });
  it('reads explicit airport codes beside names without choosing between conflicting airport codes', () => {
    const result = reviewConfirmation(text().replace('New York (JFK)', 'JFK — New York').replace('Los Angeles (LAX)', 'Los Angeles — LAX'));
    expect(result.legs[0]).toMatchObject({ origin: 'JFK', destination: 'LAX' });
    expect(reviewConfirmation(text().replace('New York (JFK)', 'JFK / LGA')).legs[0]!.origin).toBe('');
  });
  it('preserves connecting flights separately and does not carry a date or arrival into the next leg', () => {
    const result = reviewConfirmation(`${text()}\nFlight AA456\nFrom: LAX\nTo: SFO\nDeparture: December 4, 2026 at 14:30`);
    expect(result.legs).toHaveLength(2);
    expect(result.legs[1]).toMatchObject({ flightNumber: 'AA456', origin: 'LAX', destination: 'SFO', date: '2026-12-04', time: '14:30', arrivalDate: '', arrivalTime: '' });
  });
  it('accepts a stated route, but clears conflicting route and labeled airport information', () => {
    expect(reviewConfirmation('AA123\nJFK → LAX\nDeparture: 2026-12-03 9 AM').legs[0]).toMatchObject({ origin: 'JFK', destination: 'LAX' });
    expect(reviewConfirmation(`${text()}\nEWR → LAX`).legs[0]).toMatchObject({ origin: '', destination: '' });
  });
  it.each(['December 3', '12/03/2026', '2026-02-30', 'tomorrow'])('leaves ambiguous or invalid dates blank: %s', date => {
    expect(reviewConfirmation(text().replace('December 3, 2026 at 9:05 AM', `${date} at 9:05 AM`)).legs[0]!.date).toBe('');
  });
  it('does not confuse purchase dates, confirmation numbers or addresses with flight fields', () => {
    const result = reviewConfirmation(`Confirmation number: UA123\nTicket number: DL456\nPurchased: November 25, 2026\n${text().replace('Departure: December 3, 2026 at 9:05 AM', 'Departure: December 3 at 9:05 AM')}\nPassenger: Test Person\nEmail: test@example.invalid`);
    expect(result.legs).toHaveLength(1);
    expect(result.legs[0]!.flightNumber).toBe('AA123');
    expect(result.legs[0]!.date).toBe('');
    expect(JSON.stringify(result)).not.toContain('test@example.invalid');
    expect(JSON.stringify(result)).not.toContain('Test Person');
  });
  it.each(['9:05', '2026-12-03T09:05:00Z', '09:05 UTC', '09:05 -05:00'])('leaves unclear/local-vs-UTC departure times blank: %s', value => {
    expect(reviewConfirmation(text().replace('December 3, 2026 at 9:05 AM', value)).legs[0]!.time).toBe('');
  });
  it('reads separate date/time labels, including midnight and noon, without using the device time zone', () => {
    const result = reviewConfirmation('DL123\nFrom: JFK\nTo: LAX\nDeparture date: 2026-12-03\nDeparture time: 12:00 AM\nArrival date: 2026-12-03\nArrival time: 12:00 PM');
    expect(result.legs[0]).toMatchObject({ date: '2026-12-03', time: '00:00', arrivalDate: '2026-12-03', arrivalTime: '12:00' });
  });
  it('retains an arrival time with a missing date for explicit correction, rather than assuming the same day', () => {
    const result = reviewConfirmation(text().replace('December 3, 2026 at 12:20 PM', '2:20 AM'));
    expect(result.legs[0]).toMatchObject({ arrivalDate: '', arrivalTime: '02:20' });
    expect(result.notes.join(' ')).toContain('complete both arrival date and time');
  });
  it('keeps unknown or ambiguous airports blank for review', () => {
    const result = reviewConfirmation(text().replace('New York (JFK)', 'New York').replace('Los Angeles (LAX)', 'ZZZ'));
    expect(result.legs[0]).toMatchObject({ origin: '', destination: '' });
  });
  it('rejects oversized/empty/unrecognized input and too many legs without truncating flights', () => {
    expect(() => reviewConfirmation('')).toThrow('Paste');
    expect(() => reviewConfirmation('x'.repeat(MAX_CONFIRMATION_LENGTH + 1))).toThrow('too long');
    expect(() => reviewConfirmation('Confirmation AA123\nPurchased December 3, 2026')).toThrow('No clear flight number');
    expect(() => reviewConfirmation(Array.from({ length: 9 }, (_, i) => text(`AA${i + 1}`)).join('\n'))).toThrow('more than eight');
  });
});
