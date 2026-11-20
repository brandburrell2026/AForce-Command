/**
 * One Breath phrasing set — written requests with the result each should get
 * (One Breath Final Build Spec, "Quality and privacy plan").
 *
 * DRAFT expectations, written by the builder for founder review. They follow
 * the spec's request table: read-only requests act without approval; a clear
 * drink and amount logs with Undo; anything that plans, sends or shares stops
 * at a read-back; a bare hour ("at 3") gets one question; alcohol outside
 * Social is not counted; injury, surgery or a medical issue gets timing only.
 *
 * Context for every phrase: personal One Breath, no Moment in its window, no
 * plan pending. Flags change that: S = Social One Breath, W = a Moment is in
 * its Lock In window.
 *
 * Ids are positions (P001…). Add new phrases to the END of a new group at the
 * bottom so existing ids never move. `phrasingHeldOut.ts` is graded only and
 * must never be used to tune rules or prompts.
 */
import type { OneBreathOutcome, OneBreathRequest } from '@/utils/oneBreath/session';

export interface Phrase {
  id: string;
  text: string;
  request: OneBreathRequest;
  outcome: OneBreathOutcome;
  social: boolean;
  inWindow: boolean;
  /** Writes this single utterance may cause. Anything more is an unintended write. */
  writes: 0 | 1;
}

type Group = [OneBreathRequest, OneBreathOutcome, '' | 'S' | 'W', string[]];

/** A single utterance writes only when it is itself the member's instruction. */
const WRITES: Partial<Record<OneBreathRequest, true>> = { log_drink: true, lock_in: true, made_it_back: true };

export function build(groups: Group[], prefix: string): Phrase[] {
  let n = 0;
  return groups.flatMap(([request, outcome, flag, texts]) =>
    texts.map((text) => ({
      id: `${prefix}${String(++n).padStart(3, '0')}`,
      text,
      request,
      outcome,
      social: flag === 'S',
      inWindow: flag === 'W',
      writes: outcome === 'act' && WRITES[request] ? 1 : 0,
    })),
  );
}

const GROUPS: Group[] = [
  ['open_screen', 'act', '', [
    'Pull up hydration', 'Show my Circle', 'open moments', 'take me to my profile', 'go to settings',
    'show me the scanner', 'open hydroscan', 'pull up my moments', 'hydration screen', 'open the store',
    'show sleep', 'take me home', 'go home', 'open my circle', 'pull up recovery',
    'show me what aforce remembers', 'open settings pls', 'hydraton page', 'bring up my profile', 'can you open moments',
    'I want to see my hydration', 'show the weekly report', 'open travel', 'scan', 'open the scanner so I can scan this',
    'lemme see my circle', 'profile', 'pull up performance signal', 'go to the moments tab', 'open devices',
  ]],
  ['open_screen', 'ask', '', [
    'open it', 'pull that up', 'show me the thing', 'go there', 'open the other one',
  ]],
  ['status', 'act', '', [
    'How am I doing?', "how's my hydration", 'where am I at', 'am I hydrated', 'hydrostate?',
    "what's my hydrostate", 'how am i doing today', 'am I behind', 'how much have I had today', 'hows my water',
    'status', 'give me my number', "what's my score", 'am i on track', 'where do I stand',
    'how am I looking', 'hw am i doing', 'do I need to drink more', 'am I good', 'check my hydration',
    'how many ounces so far', 'did I drink enough today', "what's my status right now", 'how far behind am I', 'hydration check',
  ]],
  ['upcoming', 'act', '', [
    "What's coming up this week?", 'what do I have tomorrow', "what's next", 'anything today', 'whats on saturday',
    'what moments do I have', 'show me what is coming up', 'do I have anything this weekend', "what's my next moment", 'what am I doing friday',
    'anything coming up', "what's on the schedule", 'whats tmrw', 'next up?', 'what have I got this week',
    'is there anything planned for tonight', 'when is my next workout', 'what did I plan for sunday', 'list my moments', 'upcoming',
  ]],
  ['log_drink', 'act', '', [
    'Had 16 ounces of water', 'log 16 ounces of water', 'Log a 12 oz coffee', 'Drank a 20 oz Gatorade', 'Had a 12 oz Celsius',
    'drank 8 oz of water', 'just had 24 oz water', 'log 500 ml of water', 'I had a 16 oz LMNT', 'add 12 ounces of tea',
    '32 oz of water', 'water 20 oz', 'log 10oz water', 'had 16oz of watr', 'drank twenty ounces of water',
    'had a 12 ounce coffee', 'log an 8 oz espresso drink', 'had a 16 oz Liquid IV', 'drank 12 oz of Pedialyte', 'had a 16 ounce BodyArmor',
    'log a 12 oz Red Bull', 'had a 16 oz Monster', 'drank a 20oz Prime', 'log 12 oz of green tea', 'had 8 ounces of orange juice',
    'put down 16 oz of water', 'i drank 1 liter of water', 'log half a liter of water', 'had a 16 oz smoothie', 'log 12 oz iced coffee',
    'add a 16.9 oz bottle of water', 'log 8.5 fl oz of water', 'had 2 cups of water', 'just finished 40 oz of water', 'had a 16 oz AFORCE',
    'log one AFORCE stick in 16 oz', 'drank 12 ounces of sparkling water', 'had a 20 oz Gatorade Zero', 'log a 12 oz Starbucks cold brew', 'add 16 oz of electrolytes',
    'water, 12 ounces', 'had sixteen ounces of water just now', 'log 16 oz h2o', 'had 16 oz of water at lunch', 'chugged 24 ounces of water',
  ]],
  ['log_drink', 'ask', '', [
    'Had an LMNT', 'had some water', 'log a coffee', 'drank a Gatorade', 'I had a glass of water',
    'had a bottle of water', 'log water', 'just had a drink', 'had a Celsius', 'drank something',
    'log my drink', 'I had tea', 'had a sip of water', 'log a big water', 'had a few glasses of water',
    'drank a smoothie', 'had a Red Bull', 'log 16', 'had water and a coffee', 'add a drink',
    'had a cup of joe', 'drank a Prime', 'had like a lot of water', 'log a Liquid IV', 'had a large iced tea',
    'log 16 or 20 oz of water', 'had 12 oz', 'water', 'had an energy drink', 'i drank a protein shake',
  ]],
  ['log_drink', 'not_counted', '', [
    'Had two beers', 'log a glass of wine', 'had a margarita', 'drank 12 oz of beer', 'had a couple of drinks last night',
    'log a whiskey', 'had a hard seltzer', 'log 2 glasses of wine', 'had a White Claw', 'drank a mimosa at brunch',
    'had three shots', 'log an IPA',
  ]],
  ['plan_moment', 'read_back', '', [
    'Lift tomorrow at 6:30 AM', 'Lift tomorrow at 6:30 AM, legs fresh', 'Pickleball Saturday at 3 pm', 'run tomorrow at 7am', 'yoga Sunday at 9 in the morning',
    'presentation Monday at 10 AM', 'I have a flight Friday at 6:15 am', 'soccer game Saturday at 5:30 PM', 'leg day tomorrow at 6:30 in the morning', 'lifting friday 6pm',
    'big meeting tomorrow at 2 pm', 'boxing class tonight at 7 pm', 'hike Sunday at 8 AM', 'I want to lift tomorrow at 6:30 in the morning, legs need to be fresh', 'swim Wednesday at noon',
    'plan a run for tomorrow morning at 6', 'golf Saturday 7:40 am', 'interview Thursday at 11 am', 'spin class tmrw 5:45am', 'tennis Friday at 4 in the afternoon',
    'plan my workout for tomorrow at 6 am', 'recovery day Sunday at 10 am', 'exam Tuesday at 9 AM', 'basketball tonight at 8pm', 'long run Saturday at 6:30 a.m.',
    'set up a lift for Monday at 5:30 pm', 'I am presenting Wednesday at 1 PM', 'crossfit tomorrow 0600', 'date night Friday at 7:30 pm', 'morning lift tomorrow at 6',
    'half marathon Sunday at 7 am', 'strength session Thursday 6:15 PM', 'plan pickleball for saturday afternoon at 3', 'workout tomorrow at 5 in the evening', 'pilates Tuesday at 12:30 pm',
  ]],
  ['plan_moment', 'ask', '', [
    'Lift at 6:30', 'Pickleball Saturday at 3', 'I want to lift tomorrow, legs need to be fresh', 'plan a workout', 'run tomorrow',
    'lift', 'I have a thing on Friday', 'workout at 7', 'plan something for Saturday', 'dinner Friday at 8',
    'gym later', 'I want to work out this week', 'presentation next week', 'run at 6', 'big day tomorrow',
    'plan my run', 'lift tomorrow or saturday at 6 am', 'workout tomorrow at 6 am no wait 7 pm', 'game on the 14th', 'training soon',
    'Lift Monday at 6:30', 'tennis at 4', 'plan a moment', 'I need to get ready for something', 'yoga this weekend',
    'flight on Friday', 'meeting at 2', 'legs tomorrow', 'plan a lift for 25 o clock tomorrow', 'run yesterday at 6 am',
  ]],
  ['lock_in', 'not_active', '', [
    'Lock me in', 'lock in', 'lets lock in', 'start lock in', 'time to lock in',
    'lock-in', 'lockin', 'begin lock in now', 'I am ready, lock me in', 'lock in for my lift',
  ]],
  ['lock_in', 'act', 'W', [
    'Lock me in', 'lock in', "let's go, lock in", 'start lock in', 'lock me in now', 'ok lock in',
  ]],
  ['prepare', 'ask', '', [
    'When should I leave the house?', 'what should I do to get ready', 'prepare me', 'when do I need to leave', 'how do I prep',
    'what time should I head out', 'get me ready', 'what is my first step', 'when should I start getting ready', 'what do I do before',
  ]],
  ['send_message', 'read_back', 'S', [
    "Let Annette know I'm heading home", 'tell Annette I made it to dinner', 'message Brandon that I am running late', 'text Lilia I am on my way', 'let my circle know I am leaving now',
    'send Annette a message saying thanks for tonight', 'tell Brandon we are heading out', 'let Tasha know plans changed', 'message Annette: be there in 10', 'tell Lilia I will be late',
    'ping Brandon that I am outside', 'let annete know im heading home', 'tell Annette heading home now', 'message my Circle that dinner moved to 8:30', 'let Brandon know I left',
  ]],
  ['send_message', 'ask', 'S', [
    'send a message', 'tell them I am leaving', 'message someone', 'let her know', 'text Annette',
  ]],
  ['share_plan', 'read_back', 'S', [
    "Share tonight's plan with Brandon", 'share my plan with Annette', 'send Lilia the plan for tonight', 'share the dinner plan with my Circle', 'let Brandon see tonights plan',
    'share this plan with Tasha', 'share plan w/ Annette', 'can you share tonight with Brandon',
  ]],
  ['made_it_back', 'act', 'S', [
    'Made it back', 'I made it back', 'home safe', "I'm home", 'made it home', 'back home now',
  ]],
  ['none', 'limit', '', [
    'Should I take creatine before I lift?', 'what should I eat before my run', 'is this a good drink for me', 'how many calories should I eat', 'what supplements should I take',
    'should I do squats or deadlifts', 'tell me a joke', "what's the weather", 'who won the game last night', 'write me a workout',
    'how much protein do I need', 'is coffee bad for me', 'should I fast before my lift', 'what is the best electrolyte', 'order more AFORCE',
    'book me a table for Friday', 'add this to my Google calendar', 'call Annette', 'play some music', 'what is the meaning of life',
    'how much should I weigh', 'can you make me lose 10 pounds', 'give me a meal plan', 'how many reps should I do', 'remind me to call mom',
  ]],
  ['plan_moment', 'safety', '', [
    'Leg day tomorrow at 6:30 AM. I had knee surgery three weeks ago but I feel fine.', 'run tomorrow at 7 am, my ankle is sprained', 'lift Friday at 6 pm, I am 20 weeks pregnant', 'workout tomorrow at 6 am even though my chest hurts', 'lifting Saturday at 9 am, I just had shoulder surgery',
    'run Sunday at 8 am, I have a stress fracture', 'hike Saturday at 7 am, I have been dizzy all week', 'spin tomorrow at 6 am, doctor said I have high blood pressure', 'lift tomorrow at 6:30 am, I tore my ACL last month', 'play soccer Saturday at 5 pm on a concussion',
    'long run Sunday at 7 am, I am diabetic and felt faint yesterday', 'workout tomorrow at 7 am two weeks after my c-section',
  ]],
  ['none', 'nothing', '', [
    'never mind', 'cancel', 'um', 'forget it', 'stop',
    'nothing', 'hold on', 'wait', 'nvm', 'oops wrong app',
    'hello', 'thanks', 'ok', 'testing testing', '...',
  ]],
];

export const PHRASING_SET: Phrase[] = build(GROUPS, 'P');
