/**
 * Intent classifier — small, deterministic keyword matcher.
 *
 * No LLM. Voice is a command interface, so a tight regex layer keeps
 * latency near-zero and behaviour predictable. Returns the strongest
 * intent + extracted entities + a confidence score.
 *
 * Order of precedence (most specific first):
 *   UPDATE_SYMPTOMS → START_PROTOCOL → COMPARE_PRODUCTS →
 *   LOG_INTAKE → GET_STATUS → GET_COMMAND → UNKNOWN
 */

import type {
  VoiceClassification, VoiceIntent, VoiceEntities, VoiceSymptomId,
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

const RULES: Rule[] = [
  // Symptoms — must come first so "I feel dizzy" never matches GET_STATUS.
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
  // Protocol triggers
  {
    intent: 'START_PROTOCOL',
    weight: 0.95,
    patterns: [
      /\b(start|begin|run|activate)\s+(the\s+)?(recovery|protocol|reset)/,
      /\b(reset\s+me|fix\s+(this|me)|recover\s+me)/,
      /\bemergency\s+(cooldown|recovery)/,
    ],
  },
  // Comparison
  {
    intent: 'COMPARE_PRODUCTS',
    weight: 0.9,
    patterns: [
      /\bcompare\b/,
      /\bwhat\s+should\s+i\s+drink\b/,
      /\b(best|which)\s+(option|drink|product)\b/,
    ],
  },
  // Intake logging
  {
    intent: 'LOG_INTAKE',
    weight: 0.85,
    patterns: [
      /\bi\s+(just\s+)?(drank|had|took|finished)\b/,
      /\blog\s+(a\s+|an\s+|my\s+)?(stick|water|drink|intake|aforce)/,
      /\b(record|add|track)\s+(a\s+|an\s+)?(stick|water|drink|intake)/,
      /\b(drank|had|took)\s+(some\s+)?(water|aforce)/,
    ],
  },
  // Status
  {
    intent: 'GET_STATUS',
    weight: 0.8,
    patterns: [
      /\bhow\s+am\s+i(\s+doing)?\b/,
      /\bwhat'?s?\s+my\s+(score|status|state|level)\b/,
      /\bwhere\s+am\s+i\s+at\b/,
      /\b(give\s+me\s+)?(a\s+)?status\s+(check|update|report)?\b/,
    ],
  },
  // Next command
  {
    intent: 'GET_COMMAND',
    weight: 0.78,
    patterns: [
      /\bwhat\s+(should|do)\s+i\s+do\b/,
      /\bwhat'?s?\s+(next|the\s+next\s+(step|move|action))\b/,
      /\b(give\s+me\s+)?(my\s+)?(next\s+)?command\b/,
      /\btell\s+me\s+what\s+to\s+do\b/,
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

export function classifyTranscript(rawTranscript: string): VoiceClassification {
  const text = (rawTranscript || '').toLowerCase().trim();

  if (!text) {
    return { intent: 'UNKNOWN', entities: {}, confidence: 0 };
  }

  const symptoms = extractSymptoms(text);
  const fluidType = extractFluid(text);

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

  if (!best) {
    return {
      intent: 'UNKNOWN',
      entities: { fluidType, symptoms: symptoms.length ? symptoms : undefined },
      confidence: 0.2,
    };
  }

  const entities: VoiceEntities = {};
  if (fluidType) entities.fluidType = fluidType;
  if (symptoms.length) entities.symptoms = symptoms;

  // Confidence = bounded function of matches × weight.
  const confidence = Math.min(1, 0.55 + 0.15 * best.matches * best.rule.weight);

  return { intent: best.rule.intent, entities, confidence };
}
