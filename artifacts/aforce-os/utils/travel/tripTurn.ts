/**
 * Trip turns — "Tell AFORCE your trip" as a short exchange (pure).
 *
 * One sentence starts a draft. AFORCE then asks for one missing or ambiguous
 * thing at a time, and takes corrections ("No, Saturday", "it leaves at 9
 * AM", "it's Delta 456") without starting over. Nothing here saves anything:
 * the draft becomes a trip only when the member confirms it on the card.
 *
 * This is not a second voice system. Words arrive from the same capture One
 * Breath uses, the trip is read by `spokenTrip.ts`, and replies are classified
 * and changed with One Breath's own rules (`classifyUtterance`, `changedDate`,
 * `changedTime`). No model and no network. A flight detail is never inferred:
 * what was not said stays missing and becomes the question.
 */
import { classifyUtterance } from '@/utils/oneBreath/confirmationWindow';
import { changedDate, changedTime } from '@/utils/oneBreath/timeChange';
import { parseSpokenTrip, resolveSaidAirport, type SpokenTripFields, type TripOpen } from './spokenTrip';

export type TripField = 'flightNumber' | 'origin' | 'destination' | 'date' | 'time';

export interface TripQuestion {
  leg: 0 | 1;
  field: TripField | 'arrivalTime';
  /** What is asked, in the member's terms. */
  text: string;
  /** Buttons that answer it, when the answer is one of a few. `value` is what the field takes. */
  choices?: { label: string; value: string }[];
}

export interface TripDraft {
  /** The way out, then the way back when the member said there is one. */
  legs: SpokenTripFields[];
  /** The one question waiting, if any. */
  asking?: TripQuestion;
  /** Gaps the parser heard and could not fill, still unanswered. */
  open: TripOpen[];
  /** The airline's code when it was named without a flight number. */
  airline?: string;
  /** Every sentence the member gave, in order. */
  heard: string[];
}

export interface TripStep {
  draft: TripDraft;
  /** False when the words changed nothing: not an answer, not a correction, not a trip. */
  understood: boolean;
}

/** What a leg needs before it can be saved. Arrival details are optional. */
const REQUIRED: readonly TripField[] = ['origin', 'destination', 'date', 'time', 'flightNumber'];

const MONTH = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const WEEKDAY = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

/** "2026-11-21" → "Sat, Nov 21". Built from the parts, so it never shifts with a time zone. */
export function tripDayLabel(date: string): string {
  const [y, m, d] = date.split('-').map(Number);
  const at = new Date(y!, m! - 1, d!);
  return `${WEEKDAY[at.getDay()]}, ${MONTH[at.getMonth()]} ${at.getDate()}`;
}

/** "07:15" → "7:15 AM". */
export function tripTimeLabel(time24: string): string {
  const [h, min] = time24.split(':').map(Number);
  return `${h! % 12 === 0 ? 12 : h! % 12}:${String(min).padStart(2, '0')} ${h! < 12 ? 'AM' : 'PM'}`;
}

const pad = (n: number) => String(n).padStart(2, '0');

export const legComplete = (leg: SpokenTripFields | undefined): boolean => !!leg && REQUIRED.every((f) => !!leg[f]);

/** Every leg has what it needs. Only then can the card offer Confirm. */
export const tripComplete = (draft: TripDraft): boolean => draft.legs.length > 0 && draft.legs.every(legComplete);

/** A name for the trip so the member never types one: "JFK → LAX · Nov 21". Empty until the way out has its airports. */
export function tripTitle(draft: TripDraft): string {
  const out = draft.legs[0];
  if (!out?.origin || !out.destination) return '';
  const when = out.date ? ` · ${tripDayLabel(out.date).split(', ')[1]}` : '';
  return `${out.origin} → ${out.destination}${when}`;
}

const ASK: Record<TripField, (leg: 0 | 1) => string> = {
  origin: () => 'Where are you flying from?',
  destination: () => 'Where are you flying to?',
  date: (leg) => (leg === 0 ? 'What day do you leave?' : 'What day do you come back?'),
  time: (leg) => (leg === 0 ? 'What time does it leave?' : 'What time does the return leave?'),
  flightNumber: (leg) => (leg === 0 ? 'What’s the flight number?' : 'What’s the return flight number?'),
};

function questionFor(gap: TripOpen): TripQuestion {
  if (gap.kind === 'several') {
    return {
      leg: gap.leg,
      field: gap.field,
      text: `Which ${gap.name} airport?`,
      choices: gap.codes.map((code) => ({ label: code, value: code })),
    };
  }
  if (gap.kind === 'unknown') {
    return { leg: gap.leg, field: gap.field, text: `I don’t know “${gap.said}”. What’s the airport or its three-letter code?` };
  }
  if (gap.kind === 'am_pm') {
    const shown = `${gap.hour}:${pad(gap.minute)}`;
    return {
      leg: gap.leg,
      field: gap.field,
      text: `${shown} in the morning or evening?`,
      choices: [
        { label: `${shown} AM`, value: `${pad(gap.hour % 12)}:${pad(gap.minute)}` },
        { label: `${shown} PM`, value: `${pad((gap.hour % 12) + 12)}:${pad(gap.minute)}` },
      ],
    };
  }
  return {
    leg: gap.leg,
    field: 'date',
    text: `Which ${gap.said.replace(/^next\s+/i, '')}?`,
    choices: gap.options.map((date) => ({ label: tripDayLabel(date), value: date })),
  };
}

/**
 * The one thing to ask next, or nothing when every leg is complete. A gap the
 * member already spoke about comes before a field they never mentioned, and
 * the way out is finished before the way back is asked about.
 */
export function nextTripQuestion(draft: TripDraft): TripQuestion | undefined {
  for (let leg = 0 as 0 | 1; leg < draft.legs.length; leg = (leg + 1) as 0 | 1) {
    const fields = draft.legs[leg]!;
    for (const field of REQUIRED) {
      if (fields[field]) continue;
      const gap = draft.open.find((g) => g.leg === leg && g.field === field);
      if (gap) return questionFor(gap);
      const text = field === 'flightNumber' && leg === 0 && draft.airline ? `What’s the ${draft.airline} flight number?` : ASK[field](leg);
      return { leg, field, text };
    }
    if (leg === 1) break;
  }
  // Optional, but if the member gave an arrival time that could be morning or evening, settle it.
  const arrival = draft.open.find((g) => g.field === 'arrivalTime');
  return arrival ? questionFor(arrival) : undefined;
}

const withQuestion = (draft: TripDraft): TripDraft => ({ ...draft, asking: nextTripQuestion(draft) });

const setField = (draft: TripDraft, leg: 0 | 1, field: TripQuestion['field'], value: string): TripDraft => {
  const legs = draft.legs.map((l, i) => (i === leg ? { ...l, [field]: value } : l));
  // The way back mirrors the way out's airports until the member says otherwise.
  if (leg === 0 && (field === 'origin' || field === 'destination') && legs[1]) {
    const out = legs[0]!;
    if (out.origin && out.destination && !draft.legs[1]!.origin && !draft.legs[1]!.destination) {
      legs[1] = { ...legs[1], origin: out.destination, destination: out.origin };
    }
  }
  return { ...draft, legs, open: draft.open.filter((g) => !(g.leg === leg && g.field === field)) };
};

/** Starts a draft from one sentence. Returns `understood: false` when the words held nothing about a trip. */
export function tripFromWords(words: string, now: Date): TripStep {
  const trip = parseSpokenTrip(words, now);
  const legs = trip.returnLeg ? [trip.fields, trip.returnLeg] : [trip.fields];
  const understood = Object.keys(trip.fields).length > 0 || !!trip.returnLeg || !!trip.airline || (trip.open?.length ?? 0) > 0;
  const draft: TripDraft = { legs, open: trip.open ?? [], airline: trip.airline, heard: [words] };
  return { draft: understood ? withQuestion(draft) : draft, understood };
}

const FLIGHT_ONLY = /^(?:flight\s+)?(?:number\s+)?(\d{1,4})$/;

/** An answer to the question that is waiting. Null when the words do not answer it. */
function answer(draft: TripDraft, q: TripQuestion, words: string, now: Date): TripDraft | null {
  const said = words.trim();
  const lower = said.toLowerCase().replace(/[.!?]+$/, '');
  const picked = q.choices?.find((c) => c.label.toLowerCase() === lower || c.value.toLowerCase() === lower);
  if (picked) return setField(draft, q.leg, q.field, picked.value);

  if (q.field === 'origin' || q.field === 'destination') {
    const place = resolveSaidAirport(lower.replace(/^(?:from|to|it'?s|the)\s+/, ''));
    if (!place) return null;
    if ('code' in place) return setField(draft, q.leg, q.field, place.code);
    // Still not one airport: keep asking, now about what they just said.
    const gap: TripOpen = 'several' in place
      ? { field: q.field, leg: 0, kind: 'several', name: place.several.name, codes: place.several.codes }
      : { field: q.field, leg: 0, kind: 'unknown', said: place.unknown };
    return { ...draft, open: [...draft.open.filter((g) => !(g.leg === q.leg && g.field === q.field)), { ...gap, leg: q.leg as 0 }] };
  }

  const heard = parseSpokenTrip(said, now);
  if (q.field === 'date') {
    if (q.choices && /^(the\s+)?(first|sooner|earlier|this one)$/.test(lower)) return setField(draft, q.leg, 'date', q.choices[0]!.value);
    if (q.choices && /^(the\s+)?(second|later|week after|one after)$/.test(lower)) return setField(draft, q.leg, 'date', q.choices[1]!.value);
    return heard.fields.date ? setField(draft, q.leg, 'date', heard.fields.date) : null;
  }
  if (q.field === 'time' || q.field === 'arrivalTime') {
    if (q.choices?.length === 2) {
      if (/^(a\.?m\.?|morning|in the morning)$/.test(lower)) return setField(draft, q.leg, q.field, q.choices[0]!.value);
      if (/^(p\.?m\.?|evening|in the evening|night|at night|afternoon)$/.test(lower)) return setField(draft, q.leg, q.field, q.choices[1]!.value);
    }
    const t = heard.fields.time ?? parseSpokenTrip(`at ${said}`, now).fields.time;
    return t ? setField(draft, q.leg, q.field, t) : null;
  }
  // Flight number: a full one, or just the digits when the airline was already named.
  if (heard.fields.flightNumber) return setField(draft, q.leg, 'flightNumber', heard.fields.flightNumber);
  const digits = FLIGHT_ONLY.exec(lower);
  if (digits && draft.airline) return setField(draft, q.leg, 'flightNumber', `${draft.airline}${digits[1]}`);
  return null;
}

const ABOUT_RETURN = /\b(return|returning|way back|coming back|flying back|back on)\b/;

/**
 * A correction to what is already on the card. Only what the words clearly
 * name is changed; everything else stays. Null when nothing was named.
 */
function change(draft: TripDraft, words: string, now: Date): TripDraft | null {
  const lower = words.toLowerCase().replace(/[.!?]+$/, '').trim();
  const leg: 0 | 1 = draft.legs[1] && ABOUT_RETURN.test(lower) ? 1 : 0;
  const current = draft.legs[leg]!;
  let next = draft;
  let changed = false;
  const put = (field: TripQuestion['field'], value: string | undefined | null) => {
    if (!value || current[field as keyof SpokenTripFields] === value) return;
    next = setField(next, leg, field, value);
    changed = true;
  };

  // A different airport: "to Boston", "from Newark", "no, it's to LaGuardia".
  const to = /\bto\s+(?!the\b)([a-z .'-]+?)(?=\s+(?:on|at|not|instead)\b|$)/.exec(lower);
  const from = /\bfrom\s+(?!the\b)([a-z .'-]+?)(?=\s+(?:on|at|to|not|instead)\b|$)/.exec(lower);
  for (const [m, field] of [[from, 'origin'], [to, 'destination']] as const) {
    if (!m) continue;
    const place = resolveSaidAirport(m[1]!);
    if (place && 'code' in place) put(field, place.code);
  }

  const heard = parseSpokenTrip(words, now);
  put('flightNumber', heard.fields.flightNumber);
  // A new day: One Breath's own rule first ("No, Saturday"), then a full date.
  put('date', heard.fields.date ?? changedDate(words, now));
  // A new time: said in full, or relative to the time already there ("make it 9").
  // Digits that were a flight number or part of a date are not a time.
  const relative = current.time && !heard.fields.flightNumber && !heard.fields.date && /\d|noon|midnight/.test(lower);
  put('time', heard.fields.time ?? (relative ? changedTime(current.time!, words) : null));
  put('arrivalTime', heard.fields.arrivalTime);

  return changed ? next : null;
}

const ONE_WAY = /\b(one way|no return|not coming back|skip the return|just one way|drop the return)\b/;

/**
 * One turn of the exchange. With no draft, the words start one. With a draft,
 * they are first tried as the answer to the waiting question, then as a
 * correction. Words that are neither leave the draft exactly as it was.
 */
export function tripTurn(draft: TripDraft | null, words: string, now: Date): TripStep {
  if (!draft) return tripFromWords(words, now);
  const heard = [...draft.heard, words];
  const done = (next: TripDraft): TripStep => ({ draft: withQuestion({ ...next, heard }), understood: true });

  if (draft.legs[1] && ONE_WAY.test(words.toLowerCase())) {
    return done({ ...draft, legs: [draft.legs[0]!], open: draft.open.filter((g) => g.leg === 0) });
  }

  if (draft.asking) {
    const answered = answer(draft, draft.asking, words, now);
    if (answered) return done(answered);
  }

  // "Undo", "no", "cancel" on their own change nothing here; the card has its own controls.
  const said = classifyUtterance(words);
  if (said.kind === 'undo' || said.kind === 'hear_again') return { draft, understood: false };

  const changedDraft = change(draft, words, now);
  if (changedDraft) return done(changedDraft);

  return { draft, understood: false };
}
