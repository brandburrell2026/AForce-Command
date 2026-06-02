/**
 * Intent classifier — small, deterministic keyword matcher.
 *
 * No LLM. Voice is a command interface, so a tight regex layer keeps
 * latency near-zero and behaviour predictable. Returns the strongest
 * intent + extracted entities + a confidence score.
 *
 * Order of precedence (most specific first):
 *   UPDATE_SYMPTOMS → START_PROTOCOL → COMPARE_PRODUCTS →
 *   COMPLETE_CYCLE → SET_AUTOPILOT → ACTIVATE_SOCIAL → DEACTIVATE_SOCIAL →
 *   REORDER → OPEN_SCREEN → LOG_INTAKE → GET_STATUS → GET_COMMAND → UNKNOWN
 *
 * Specificity matters: SET_AUTOPILOT must beat "what should I do" GET_COMMAND
 * patterns when the user says "performance mode on", and OPEN_SCREEN must
 * beat LOG_INTAKE when the user says "open store" (don't log a stick).
 */

import type {
  VoiceClassification, VoiceIntent, VoiceEntities, VoiceSymptomId,
  VoiceScreenTarget,
} from '../types/voice';
import type { FluidType } from '../types';

interface Rule {
  intent: VoiceIntent;
  patterns: RegExp[];
  /** Higher confidence wins ties. */
  weight: number;
}

const SYMPTOM_KEYWORDS: Record<VoiceSymptomId, RegExp> = {
  dizziness:  /\b(dizz|dizzy|lightheaded|spinning|woozy)\b/,
  headache:   /\b(headache|head\s*hurts|migraine|throbbing\s+head)\b/,
  nausea:     /\b(nause|sick(\s+to\s+my\s+stomach)?|queasy|throw\s*up|vomit)\b/,
  cramping:   /\b(cramp|cramping|muscle\s*tight)\b/,
  chills:     /\b(chills?|cold\s*sweat|shivering)\b/,
  confusion:  /\b(confused|foggy|fuzzy|can'?t\s+think|disoriented)\b/,
  fatigue:    /\b(tired|exhausted|fatigued|drained|wiped|burnt\s*out)\b/,
};

const FLUID_KEYWORDS: Array<{ fluid: FluidType; pattern: RegExp }> = [
  { fluid: 'aforce_stick', pattern: /\b(aforce\s*stick|a\s*force\s*stick|stick|packet|sachet)\b/ },
  { fluid: 'aforce_rtd',   pattern: /\b(rtd|ready\s*to\s*drink|bottle|can(?!ister))\b/ },
  { fluid: 'aforce_canister', pattern: /\b(canister|tub|jar)\b/ },
  { fluid: 'water',        pattern: /\b(water|h2o|sip|drank)\b/ },
];

/** Word→digit mapping for "log two sticks" / "drink twelve ounces". */
const NUMBER_WORDS: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6, seven: 7, eight: 8,
  nine: 9, ten: 10, eleven: 11, twelve: 12, sixteen: 16, twenty: 20, thirty: 30,
  half: 0.5, dozen: 12,
};

/** Friendly handle → display name; voiceService maps to the actual route. */
const SCREEN_KEYWORDS: Array<{ screen: VoiceScreenTarget; pattern: RegExp }> = [
  { screen: 'rewards',     pattern: /\b(rewards?|achievements?|badges?|trophies)\b/ },
  { screen: 'circles',     pattern: /\b(circles?|squad|crew|friends?|teammates?)\b/ },
  { screen: 'territory',   pattern: /\b(territory|map|leader\s*board|leaderboard)\b/ },
  { screen: 'competition', pattern: /\b(competition|compete|contest|tournament)\b/ },
  { screen: 'share',       pattern: /\b(share(\s+(my\s+)?status)?|brag|post)\b/ },
  { screen: 'profile',     pattern: /\b(profile|my\s+account|settings)\b/ },
  { screen: 'journal',     pattern: /\b(journal|history|timeline|log\s+book)\b/ },
  { screen: 'store',       pattern: /\b(store|shop|catalog|catalogue)\b/ },
  { screen: 'cart',        pattern: /\b(cart|basket|checkout)\b/ },
  { screen: 'protocol',    pattern: /\b(protocol|recovery\s+screen)\b/ },
  { screen: 'scan',        pattern: /\b(scan(ner)?|hydroscan|barcode)\b/ },
  { screen: 'ring',        pattern: /\b(ring|calm\s+coach|sport\s+mode)\b/ },
  { screen: 'sweat',       pattern: /\b(sweat\s+(rate\s+)?calculator|sweat\s+screen)\b/ },
  { screen: 'science',     pattern: /\b(science|research\s+screen)\b/ },
  { screen: 'heat',        pattern: /\b(heat\s+(risk|guard|screen))\b/ },
  { screen: 'cruise',      pattern: /\b(cruise(\s+mode)?)\b/ },
  { screen: 'subscription',pattern: /\b(subscription|membership|plan|billing)\b/ },
  { screen: 'home',        pattern: /\b(home|dashboard|control\s+center|main\s+screen)\b/ },
];

const RULES: Rule[] = [
  // ── Symptoms — highest specificity so "I feel dizzy" never trips GET_STATUS.
  {
    intent: 'UPDATE_SYMPTOMS',
    weight: 1.0,
    patterns: [
      /\bi\s+feel\s+(off|bad|weird|sick|dizzy|tired|nauseous|hot|cold|fuzzy|foggy|drained)/,
      /\bi\s+(have|got|am\s+having)\s+(a\s+)?(headache|migraine|cramp|chills|nausea)/,
      /\bupdate\s+(my\s+)?symptoms?\b/,
      /\bsymptoms?\b/,
    ],
  },
  // ── Protocol triggers
  {
    intent: 'START_PROTOCOL',
    weight: 0.95,
    patterns: [
      /\b(start|begin|run|activate)\s+(the\s+)?(recovery|protocol|reset)/,
      /\b(reset\s+me|fix\s+(this|me)|recover\s+me)/,
      /\bemergency\s+(cooldown|recovery)/,
    ],
  },
  // ── Comparison
  {
    intent: 'COMPARE_PRODUCTS',
    weight: 0.92,
    patterns: [
      /\bcompare\b/,
      /\bwhat\s+should\s+i\s+drink\b/,
      /\b(best|which)\s+(option|drink|product)\b/,
    ],
  },
  // ── Complete a hydration cycle
  {
    intent: 'COMPLETE_CYCLE',
    weight: 0.93,
    patterns: [
      /\b(complete|finish|close|end)\s+(my\s+|the\s+|this\s+)?(hydration\s+)?cycle\b/,
      /\bcycle\s+(complete|done|finished)\b/,
      /\bclose\s+the\s+loop\b/,
    ],
  },
  // ── Performance / Autopilot toggles (must beat GET_COMMAND patterns)
  {
    intent: 'SET_AUTOPILOT',
    weight: 0.96,
    patterns: [
      /\b(activate|turn\s+on|enable|engage|start)\s+(the\s+)?(autopilot|performance\s+mode|auto\s+pilot)\b/,
      /\b(autopilot|performance\s+mode|auto\s+pilot)\s+(on|activate|engage|start)\b/,
      /\b(deactivate|turn\s+off|disable|stop|kill)\s+(the\s+)?(autopilot|performance\s+mode|auto\s+pilot)\b/,
      /\b(autopilot|performance\s+mode|auto\s+pilot)\s+(off|deactivate|stop)\b/,
    ],
  },
  // ── Social mode toggles
  {
    intent: 'ACTIVATE_SOCIAL',
    weight: 0.94,
    patterns: [
      /\b(activate|turn\s+on|enable|engage|start)\s+(the\s+)?social\s+(mode|night|setting)?\b/,
      /\bsocial\s+(mode\s+)?(on|activate|engage|start)\b/,
      /\bgoing\s+out\s+(tonight|now)\b/,
      /\b(night\s+out|drinking\s+tonight)\b/,
    ],
  },
  {
    intent: 'DEACTIVATE_SOCIAL',
    weight: 0.94,
    patterns: [
      /\b(deactivate|turn\s+off|disable|stop|exit|end)\s+(the\s+)?social\s+(mode|night)?\b/,
      /\bsocial\s+(mode\s+)?(off|deactivate|exit|end)\b/,
      /\bi'?m\s+done\s+drinking\b/,
    ],
  },
  // ── Reorder
  {
    intent: 'REORDER',
    weight: 0.92,
    patterns: [
      /\b(reorder|re\s*order|order\s+more|buy\s+more|restock|refill\s+my\s+order)\b/,
      /\b(send\s+me\s+more|ship\s+me\s+more|order\s+(another|some\s+more))\b/,
      /\bi\s+need\s+more\s+(sticks|aforce)\b/,
    ],
  },
  // ── Open / navigate to a screen
  {
    intent: 'OPEN_SCREEN',
    weight: 0.9,
    patterns: [
      /\b(open|show(\s+me)?|go\s+to|take\s+me\s+to|launch|pull\s+up|view)\s+/,
      /\b(my\s+)?(rewards?|achievements?|badges?|streak)\b/,
      /\bview\s+(my\s+)?(circles?|crew|squad)\b/,
    ],
  },
  // ── Intake logging (after OPEN_SCREEN so "open store" doesn't log a stick)
  {
    intent: 'LOG_INTAKE',
    weight: 0.85,
    patterns: [
      /\bi\s+(just\s+)?(drank|had|took|finished)\b/,
      /\blog\s+(a\s+|an\s+|my\s+|\d+\s+|two\s+|three\s+|four\s+)?(stick|water|drink|intake|aforce|oz|ounces?)/,
      /\b(record|add|track)\s+(a\s+|an\s+|\d+\s+)?(stick|water|drink|intake|oz|ounces?)/,
      /\b(drank|had|took)\s+(some\s+|a\s+|an\s+|\d+\s+)?(water|aforce|oz|ounces?)/,
    ],
  },
  // ── Status
  {
    intent: 'GET_STATUS',
    weight: 0.8,
    patterns: [
      /\bhow\s+am\s+i(\s+doing)?\b/,
      /\bwhat'?s?\s+my\s+(score|status|state|level|hydration)\b/,
      /\bwhere\s+am\s+i\s+at\b/,
      /\bcheck\s+(my\s+)?(hydration\s+)?score\b/,
      /\b(give\s+me\s+)?(a\s+)?status\s+(check|update|report)?\b/,
    ],
  },
  // ── Next command / coach me
  {
    intent: 'GET_COMMAND',
    weight: 0.78,
    patterns: [
      /\bwhat\s+(should|do)\s+i\s+do\b/,
      /\bwhat'?s?\s+(next|the\s+next\s+(step|move|action))\b/,
      /\b(give\s+me\s+)?(my\s+)?(next\s+)?(command|recommendation|advice)\b/,
      /\btell\s+me\s+what\s+to\s+do\b/,
      /\bcoach\s+me\b/,
    ],
  },
];

/** Extract a single fluid type if the user mentioned one (first match wins). */
function extractFluid(text: string): FluidType | undefined {
  for (const { fluid, pattern } of FLUID_KEYWORDS) {
    if (pattern.test(text)) return fluid;
  }
  return undefined;
}

/** Extract any symptom keywords present in the transcript. */
function extractSymptoms(text: string): VoiceSymptomId[] {
  const found: VoiceSymptomId[] = [];
  (Object.keys(SYMPTOM_KEYWORDS) as VoiceSymptomId[]).forEach((id) => {
    if (SYMPTOM_KEYWORDS[id].test(text)) found.push(id);
  });
  return found;
}

/** Pull a leading number (digit or word) out of phrases like "12 oz" or "two sticks". */
function readNumber(input: string): number | null {
  const trimmed = input.trim().toLowerCase();
  if (!trimmed) return null;
  const digit = /^(\d+(?:\.\d+)?)/.exec(trimmed);
  if (digit && digit[1]) return Number(digit[1]);
  const word = /^([a-z]+)/.exec(trimmed);
  if (word && word[1] && NUMBER_WORDS[word[1]] !== undefined) {
    return NUMBER_WORDS[word[1]] ?? null;
  }
  return null;
}

/** Find an oz/ounces quantity anywhere in the text. */
function extractOz(text: string): number | undefined {
  const m = /([\d]+(?:\.\d+)?|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|sixteen|twenty|thirty)\s*(?:fl\s*)?(?:oz|ounces?|fluid\s*ounces?)\b/.exec(text);
  if (!m || !m[1]) return undefined;
  const n = readNumber(m[1]);
  return n ?? undefined;
}

/** "log two sticks" → repeat=2; default 1. */
function extractRepeat(text: string): number | undefined {
  const m = /\b(\d+|two|three|four|five|six|seven|eight|nine|ten)\s+(sticks|packets|sachets)\b/.exec(text);
  if (!m || !m[1]) return undefined;
  const n = readNumber(m[1]);
  return n && n > 1 ? Math.min(n, 6) : undefined;
}

/** Find the first matching screen target for OPEN_SCREEN. */
function extractScreen(text: string): VoiceScreenTarget | undefined {
  for (const { screen, pattern } of SCREEN_KEYWORDS) {
    if (pattern.test(text)) return screen;
  }
  return undefined;
}

/** "performance mode on/off" or "autopilot on/off" → toggle + phrasing label. */
function extractAutopilotToggle(text: string): {
  toggle: 'on' | 'off';
  modePhrasing: 'autopilot' | 'performance';
} | null {
  const off = /\b(deactivate|turn\s+off|disable|stop|kill)\b/.test(text)
    || /\b(autopilot|performance\s+mode|auto\s+pilot)\s+off\b/.test(text);
  const phrasing: 'autopilot' | 'performance' =
    /\bperformance\s+mode\b/.test(text) ? 'performance' : 'autopilot';
  if (/\b(autopilot|performance\s+mode|auto\s+pilot)\b/.test(text)) {
    return { toggle: off ? 'off' : 'on', modePhrasing: phrasing };
  }
  return null;
}

export function classifyTranscript(rawTranscript: string): VoiceClassification {
  const text = (rawTranscript || '').toLowerCase().trim();

  if (!text) {
    return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
  }

  const symptoms = extractSymptoms(text);
  const fluidType = extractFluid(text);
  const ozOverride = extractOz(text);
  const repeat = extractRepeat(text);
  const screen = extractScreen(text);
  const autoToggle = extractAutopilotToggle(text);

  // Run rules and keep the strongest match.
  let best: { rule: Rule; matches: number } | null = null;
  for (const rule of RULES) {
    let matches = 0;
    for (const pat of rule.patterns) if (pat.test(text)) matches++;
    if (matches === 0) continue;
    if (!best || matches * rule.weight > best.matches * best.rule.weight) {
      best = { rule, matches };
    }
  }

  // Heuristic upgrades:
  // - "I drank water" → LOG_INTAKE wins over a stray symptom token
  // - "I feel dizzy" → UPDATE_SYMPTOMS wins even if "feel" loosely matches status
  if (best && symptoms.length > 0 && /\bi\s+feel\b|\bi\s+have\b|\bi\s+got\b/.test(text)) {
    best = { rule: RULES.find((r) => r.intent === 'UPDATE_SYMPTOMS')!, matches: Math.max(best.matches, 1) };
  }
  if (!best && fluidType) {
    best = { rule: RULES.find((r) => r.intent === 'LOG_INTAKE')!, matches: 1 };
  }
  // If no rule fired but the user clearly named a screen, treat as OPEN_SCREEN.
  if (!best && screen) {
    best = { rule: RULES.find((r) => r.intent === 'OPEN_SCREEN')!, matches: 1 };
  }

  if (!best) {
    return {
      intent: 'UNKNOWN',
      entities: {
        ...(fluidType ? { fluidType } : {}),
        ...(symptoms.length ? { symptoms } : {}),
      },
      confidence: 0.2,
    };
  }

  // Build entity payload tailored to the chosen intent.
  const entities: VoiceEntities = {};
  if (best.rule.intent === 'LOG_INTAKE') {
    if (fluidType) entities.fluidType = fluidType;
    if (ozOverride !== undefined) entities.ozOverride = ozOverride;
    if (repeat !== undefined) entities.repeat = repeat;
  } else if (best.rule.intent === 'OPEN_SCREEN') {
    if (screen) entities.screen = screen;
    else if (fluidType === 'aforce_stick') {
      // "open store" with no clearer signal — bias to /store.
      entities.screen = 'store';
    }
  } else if (best.rule.intent === 'SET_AUTOPILOT') {
    if (autoToggle) {
      entities.toggle = autoToggle.toggle;
      entities.modePhrasing = autoToggle.modePhrasing;
    } else {
      entities.toggle = 'on';
      entities.modePhrasing = 'autopilot';
    }
  } else if (best.rule.intent === 'UPDATE_SYMPTOMS' && symptoms.length) {
    entities.symptoms = symptoms;
  } else {
    if (fluidType) entities.fluidType = fluidType;
    if (symptoms.length) entities.symptoms = symptoms;
  }

  // Confidence = bounded function of matches × weight.
  const confidence = Math.min(1, 0.55 + 0.15 * best.matches * best.rule.weight);

  return { intent: best.rule.intent, entities, confidence };
}
