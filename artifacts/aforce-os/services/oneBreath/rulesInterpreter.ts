/**
 * One Breath rules interpreter — fixed, on-device rules that name what was
 * asked. No model, no network (decision C3 stands).
 *
 * The rules lean toward asking or declining. When words are ambiguous they
 * return 'ask'; when nothing matches they return the honest limit. They never
 * return a write for words that do not carry a clear instruction: a drink
 * without an amount, a time without morning or evening, a message without a
 * person. Order matters and is part of the behaviour; the phrasing set in
 * `utils/__tests__/oneBreath/` grades it.
 */
import type { Interpretation, Interpreter } from './interpreter';

const say = (request: Interpretation['request'], outcome: Interpretation['outcome']): Interpretation => ({ request, outcome });

const NOTHING = /^(never ?mind|nvm|cancel|stop|forget it|u+m+|u+h+|nothing|hold on|wait|no|ok(ay)?|thanks?( you)?|hello|hi|hey|huh|scratch that|oops.*|testing.*|[.\s]*)$/;
const MADE_IT_BACK = /\b(made it (back|home)|home safe|i'?m home|back home|i am back|i'?m back)\b/;
const LOCK_IN = /\block[\s-]?(me )?in\b|\blockin\b/;
const MEDICAL = /\b(surgery|sprain\w*|pregnan\w*|chest hurts|fracture|dizzy|blood pressure|tore my|acl|concussion|diabetic|faint|c-section|injur\w*|recovering from|my back went out)\b/;
const ALCOHOL = /\b(beers?|wine|margaritas?|whiskey|hard seltzer|white claw|mimosas?|shots?|ipa|vodka|tequila|cocktails?|drinks last night|glass(es)? of red)\b/;
const STATUS = /\b(how am i|hw am i|how'?s my|hows my|where am i at|am i (hydrated|behind|on track|good)|hydrostate|what'?s my (score|status)|how much have i|give me my number|where do i stand|do i need to drink|check my hydration|how many ounces|did i drink enough|how far behind|hydration check)\b|^status$/;
const UPCOMING = /\b(coming up|what do i have|what'?s next|whats on|what'?s on|anything (today|coming|planned)|do i have anything|what moments|next moment|what am i doing|whats tmrw|next up|what have i got|when is my next|what did i plan|list my moments)\b|^upcoming$/;
const PREPARE = /\b(when should i leave|what should i do to get ready|prepare me|when do i need to leave|how do i prep|head out|get me ready|first step|getting ready|what do i do before)\b/;
const OPEN_VERB = /^(pull up|pull|show me|show|open up|open|take me to|take me|go to|go|bring up|i want to see|lemme see|can you open|jump to)\b\s*/;
const OPEN_BARE = /^(hydrat\w* (screen|page)|profile|scan|settings)$/;
const VAGUE = /^(it|that|there|the thing|the other one)?$/;
/** Questions One Breath has no reviewed answer for. Checked before planning so a day or an activity word in them is not mistaken for a plan. */
const NO_ANSWER = /^(should i|what should i eat|how many|how much|how do i|who |is |can you make|give me a|write me|book |find me|remind me|add this|what is |what supplements)/;

const LOG_VERB = /\b(had|log|drank|add|just finished|chugged|put down|knocked back)\b/;
const DRINK = /\b(water|watr|h2o|coffee|espresso|cold brew|joe|tea|gatorade|celsius|lmnt|liquid iv|pedialyte|bodyarmor|red bull|monster|prime|juice|smoothie|aforce|electrolytes?|energy drink|protein shake|shake|drink|something)\b/;
const AMOUNT = /(\b\d+(\.\d+)?|\b(sixteen|twenty|half a|one|a))\s*(fl\.? ?oz|oz|ounces?|ml|liters?|litres?)\b|\b\d+(\.\d+)?\s*cups?\b/;
const BARE_DRINK = /^(water|watr|h2o|a \w+)\b|^\d+(\.\d+)?\s*(oz|ounces?|ml)\b/;

const SHARE = /^(share\b|send \w+ (the|my) (\w+ )?plan|let \w+ see .*plan|can you share)/;
const SEND = /^(let .+ know|tell |message |text |ping |send .+ a message|send a message)/;
const SEND_UNCLEAR = /^(send a message|message someone|text \w+|let (her|him|them) know|tell (them|her|him)\b.*)$/;

const DAY = /\b(today|tonight|tomorrow|tmrw|(mon|tues|wednes|thurs|fri|satur|sun)day)\b/;
const CLEAR_TIME = /\b\d{1,2}(:\d{2})?\s*(a\.?m\.?|p\.?m\.?)(?![a-z])|\bnoon\b|\b[0-2]\d[0-5]\d\b|\b\d{1,2}(:\d{2})?\s+in the (morning|afternoon|evening)\b|\b(morning|afternoon|evening)\b.*\bat \d{1,2}\b/;
const CONFLICT = /\byesterday\b|\bno wait\b| or /;
const PLANNING = /\b(plan|lift\w*|run|workout|work out|gym|yoga|pickleball|tennis|soccer|basketball|golf|swim|hike|spin|pilates|crossfit|boxing|training|presentation|presenting|meeting|interview|exam|flight|game|dinner|legs|squat|leg day|big day|marathon|session|date night|recovery day|get ready)\b|\bat \d{1,2}\b/;

export const interpretByRules: Interpreter = (raw, context) => {
  const t = raw.toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, ' ').trim().replace(/[?!.]+$/, '');

  if (NOTHING.test(t)) return say('none', 'nothing');
  if (context.social && MADE_IT_BACK.test(t)) return say('made_it_back', 'act');
  if (LOCK_IN.test(t)) return say('lock_in', context.momentInWindow ? 'act' : 'not_active');
  if (MEDICAL.test(t) && (DAY.test(t) || PLANNING.test(t))) return say('plan_moment', 'safety');
  if (!context.social && ALCOHOL.test(t) && LOG_VERB.test(t)) return say('log_drink', 'not_counted');

  if (context.social) {
    if (SHARE.test(t)) return say('share_plan', 'read_back');
    if (SEND.test(t)) return say('send_message', SEND_UNCLEAR.test(t) ? 'ask' : 'read_back');
  }

  if (STATUS.test(t)) return say('status', 'act');
  if (UPCOMING.test(t)) return say('upcoming', 'act');
  if (PREPARE.test(t)) return say('prepare', 'ask');

  if ((LOG_VERB.test(t) && (DRINK.test(t) || /\d/.test(t))) || (BARE_DRINK.test(t) && !DAY.test(t))) {
    const clear = DRINK.test(t) && !/\b(drink|something)\b/.test(t.replace(/energy drink|espresso drink/g, '')) && AMOUNT.test(t) && !/ or | and /.test(t);
    return say('log_drink', clear ? 'act' : 'ask');
  }

  if (OPEN_BARE.test(t)) return say('open_screen', 'act');
  if (OPEN_VERB.test(t)) {
    const rest = t.replace(OPEN_VERB, '').replace(/\s*\bup$/, '').replace(/\s*(pls|please)$/, '').trim();
    return say('open_screen', VAGUE.test(rest) ? 'ask' : 'act');
  }

  if (NO_ANSWER.test(t)) return say('none', 'limit');

  if (DAY.test(t) || PLANNING.test(t)) {
    const complete = DAY.test(t) && CLEAR_TIME.test(t) && !CONFLICT.test(t);
    return say('plan_moment', complete ? 'read_back' : 'ask');
  }

  return say('none', 'limit');
};
