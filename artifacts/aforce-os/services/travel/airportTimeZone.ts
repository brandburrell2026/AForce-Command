import airportTimeZones from '@/data/airportTimeZones.json';

export type DepartureZone = { timeZone: string | null; utcOffset: string | null; error: string | null; invalidLocalTime?: boolean };

/** Resolve local wall time with the device's IANA rules, never its own zone.
 * Reject DST gaps and require an explicit choice for repeated wall times. */
export function resolveDepartureZone(airport: string, date: string, time: string): DepartureZone {
  const timeZone = (airportTimeZones as Record<string, string>)[airport.trim().toUpperCase()] ?? null;
  if (!timeZone) return { timeZone, utcOffset: null, error: 'Airport time zone unavailable. Enter the UTC offset from your itinerary.' };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) {
    return { timeZone, utcOffset: null, error: null };
  }
  const wall = Date.parse(`${date}T${time}:00Z`);
  if (!Number.isFinite(wall) || new Date(wall).toISOString().slice(0, 10) !== date) return { timeZone, utcOffset: null, error: null };
  try {
    const formatter = new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23',
    });
    const localStamp = (at: number) => {
      const parts = Object.fromEntries(formatter.formatToParts(new Date(at)).map(part => [part.type, part.value]));
      return Date.parse(`${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}Z`);
    };
    const offsets = new Set([-36, 0, 36].map(hours => {
      const at = wall + hours * 3_600_000;
      return (localStamp(at) - at) / 60_000;
    }));
    const matches = [...offsets].filter(offset => localStamp(wall - offset * 60_000) === wall);
    if (matches.length !== 1) return { timeZone, utcOffset: null, invalidLocalTime: matches.length === 0, error: matches.length
      ? 'This time occurs twice when clocks change. Enter the UTC offset confirmed by your airline.'
      : 'This local time does not exist when clocks change. Check the departure time with your airline.' };
    const minutes = matches[0];
    const absolute = Math.abs(minutes);
    return { timeZone, utcOffset: `${minutes < 0 ? '-' : '+'}${String(Math.floor(absolute / 60)).padStart(2, '0')}:${String(absolute % 60).padStart(2, '0')}`, error: null };
  } catch {
    return { timeZone, utcOffset: null, error: 'Time zone rules unavailable on this device. Enter the UTC offset from your itinerary.' };
  }
}
