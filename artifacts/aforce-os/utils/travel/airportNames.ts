/**
 * Airport names — the names people say for airports and cities, mapped to
 * airport codes, for "Tell AFORCE your trip" (pure).
 *
 * This is a hand-kept list of well-known airports, not a full directory. A
 * name maps to one code only when one airport is plainly meant ("Newark",
 * "Heathrow", "Boston"). A city with more than one airport, or a name shared
 * by two cities ("Portland", "San Jose"), maps to all of them and the member
 * is asked which. Anything not listed stays unknown: nothing is matched
 * loosely. Every code here must exist in `data/airportTimeZones.json`; a test
 * enforces that.
 *
 * The 20 featured cities in `cityRegistry.ts` are resolved there, not here.
 */

/** One airport, and the names that mean it and only it. */
const ONE: ReadonlyArray<readonly [string, ...string[]]> = [
  // United States
  ['BOS', 'boston', 'logan', 'boston logan'],
  ['EWR', 'newark', 'newark liberty'],
  ['JFK', 'kennedy', 'john f kennedy'],
  ['LGA', 'laguardia', 'la guardia'],
  ['ORD', 'ohare', 'o hare', 'chicago ohare'],
  ['MDW', 'midway', 'chicago midway'],
  ['DFW', 'dallas fort worth', 'dallas ft worth'],
  ['DAL', 'love field', 'dallas love field'],
  ['IAH', 'bush intercontinental', 'george bush intercontinental', 'houston intercontinental'],
  ['HOU', 'hobby', 'houston hobby'],
  ['IAD', 'dulles', 'washington dulles'],
  ['DCA', 'reagan', 'reagan national', 'washington national'],
  ['BWI', 'baltimore', 'baltimore washington'],
  ['CLT', 'charlotte'],
  ['DEN', 'denver'],
  ['DTW', 'detroit'],
  ['MSP', 'minneapolis', 'minneapolis st paul', 'minneapolis saint paul', 'twin cities'],
  ['PHL', 'philadelphia', 'philly'],
  ['SLC', 'salt lake city', 'salt lake'],
  ['SAN', 'san diego'],
  ['TPA', 'tampa'],
  ['MCO', 'orlando'],
  ['FLL', 'fort lauderdale', 'ft lauderdale'],
  ['RSW', 'fort myers', 'ft myers'],
  ['JAX', 'jacksonville'],
  ['BNA', 'nashville'],
  ['AUS', 'austin'],
  ['SAT', 'san antonio'],
  ['MSY', 'new orleans'],
  ['STL', 'st louis', 'saint louis'],
  ['MCI', 'kansas city'],
  ['RDU', 'raleigh', 'raleigh durham'],
  ['IND', 'indianapolis'],
  ['CLE', 'cleveland'],
  ['PIT', 'pittsburgh'],
  ['CVG', 'cincinnati'],
  ['MKE', 'milwaukee'],
  ['MEM', 'memphis'],
  ['SDF', 'louisville'],
  ['OKC', 'oklahoma city'],
  ['OMA', 'omaha'],
  ['ABQ', 'albuquerque'],
  ['TUS', 'tucson'],
  ['ELP', 'el paso'],
  ['BOI', 'boise'],
  ['RNO', 'reno'],
  ['SMF', 'sacramento'],
  ['OAK', 'oakland'],
  ['BUR', 'burbank'],
  ['SNA', 'orange county', 'john wayne'],
  ['HNL', 'honolulu'],
  ['OGG', 'maui', 'kahului'],
  ['ANC', 'anchorage'],
  ['BUF', 'buffalo'],
  ['BDL', 'hartford'],
  ['PVD', 'providence'],
  ['RIC', 'richmond'],
  ['ORF', 'norfolk'],
  ['SAV', 'savannah'],
  ['SJU', 'san juan'],
  // Canada, Mexico, Latin America
  ['YVR', 'vancouver'],
  ['YUL', 'montreal'],
  ['YYC', 'calgary'],
  ['YYZ', 'pearson', 'toronto pearson'],
  ['MEX', 'mexico city'],
  ['CUN', 'cancun'],
  ['BOG', 'bogota'],
  ['LIM', 'lima'],
  ['SCL', 'santiago'],
  ['PTY', 'panama city'],
  // Europe
  ['LHR', 'heathrow', 'london heathrow'],
  ['LGW', 'gatwick', 'london gatwick'],
  ['STN', 'stansted', 'london stansted'],
  ['CDG', 'charles de gaulle', 'paris charles de gaulle'],
  ['ORY', 'orly', 'paris orly'],
  ['FCO', 'fiumicino'],
  ['MXP', 'malpensa', 'milan malpensa'],
  ['LIN', 'linate', 'milan linate'],
  ['AMS', 'amsterdam', 'schiphol'],
  ['FRA', 'frankfurt'],
  ['MUC', 'munich'],
  ['BER', 'berlin'],
  ['MAD', 'madrid'],
  ['LIS', 'lisbon'],
  ['DUB', 'dublin'],
  ['ZRH', 'zurich'],
  ['GVA', 'geneva'],
  ['VIE', 'vienna'],
  ['CPH', 'copenhagen'],
  ['OSL', 'oslo'],
  ['HEL', 'helsinki'],
  ['ATH', 'athens'],
  ['BRU', 'brussels'],
  ['EDI', 'edinburgh'],
  ['PRG', 'prague'],
  ['BUD', 'budapest'],
  ['WAW', 'warsaw'],
  ['KEF', 'reykjavik'],
  ['NCE', 'nice'],
  // Middle East and Africa
  ['AUH', 'abu dhabi'],
  ['DOH', 'doha'],
  ['TLV', 'tel aviv'],
  ['CAI', 'cairo'],
  ['JNB', 'johannesburg'],
  ['CPT', 'cape town'],
  ['NBO', 'nairobi'],
  ['CMN', 'casablanca'],
  ['LOS', 'lagos'],
  ['ADD', 'addis ababa'],
  ['ACC', 'accra'],
  // Asia and the Pacific
  ['NRT', 'narita', 'tokyo narita'],
  ['HND', 'haneda', 'tokyo haneda'],
  ['ICN', 'incheon'],
  ['GMP', 'gimpo'],
  ['DEL', 'delhi', 'new delhi'],
  ['BOM', 'mumbai'],
  ['BLR', 'bangalore', 'bengaluru'],
  ['AKL', 'auckland'],
  ['MNL', 'manila'],
  ['KUL', 'kuala lumpur'],
  ['CGK', 'jakarta'],
];

/** A name that could mean more than one airport: the member is asked which. */
const SEVERAL: ReadonlyArray<readonly [string, readonly string[], ...string[]]> = [
  ['Houston', ['IAH', 'HOU'], 'houston'],
  ['Washington', ['DCA', 'IAD'], 'washington', 'washington dc', 'dc'],
  ['Portland', ['PDX', 'PWM'], 'portland'],
  ['San Jose', ['SJC', 'SJO'], 'san jose'],
  ['Manchester', ['MAN', 'MHT'], 'manchester'],
  ['Melbourne', ['MEL', 'MLB'], 'melbourne'],
  ['Milan', ['MXP', 'LIN'], 'milan'],
  ['Seoul', ['ICN', 'GMP'], 'seoul'],
  ['Shanghai', ['PVG', 'SHA'], 'shanghai'],
  ['Beijing', ['PEK', 'PKX'], 'beijing'],
  ['Bangkok', ['BKK', 'DMK'], 'bangkok'],
  ['Osaka', ['KIX', 'ITM'], 'osaka'],
  ['Taipei', ['TPE', 'TSA'], 'taipei'],
  ['Istanbul', ['IST', 'SAW'], 'istanbul'],
  ['Stockholm', ['ARN', 'BMA'], 'stockholm'],
  ['Sao Paulo', ['GRU', 'CGH'], 'sao paulo'],
  ['Rio de Janeiro', ['GIG', 'SDU'], 'rio de janeiro', 'rio'],
  ['Buenos Aires', ['EZE', 'AEP'], 'buenos aires'],
];

/** How a said name is compared: lower case, no punctuation or accents, no "airport" / "international". */
export function airportNameKey(said: string): string {
  return said
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[.'’]/g, '')
    .replace(/-/g, ' ')
    .replace(/\b(international|intl|airport)\b/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export interface NamedAirports {
  /** The codes this name can mean. One code: that airport. More: the member chooses. */
  codes: readonly string[];
  /** How to name the place back when asking which airport. */
  name: string;
}

const INDEX: ReadonlyMap<string, NamedAirports> = (() => {
  const map = new Map<string, NamedAirports>();
  for (const [code, ...names] of ONE) for (const n of names) map.set(airportNameKey(n), { codes: [code], name: n });
  for (const [name, codes, ...names] of SEVERAL) for (const n of names) map.set(airportNameKey(n), { codes, name });
  return map;
})();

/** The airports a said name means, or null when the name is not on the list. Exact names only. */
export function airportsNamed(said: string): NamedAirports | null {
  return INDEX.get(airportNameKey(said)) ?? null;
}

/** Every code and name on the list, for tests. */
export const AIRPORT_NAME_ENTRIES: ReadonlyArray<{ key: string; codes: readonly string[] }> = [...INDEX].map(([key, v]) => ({ key, codes: v.codes }));
