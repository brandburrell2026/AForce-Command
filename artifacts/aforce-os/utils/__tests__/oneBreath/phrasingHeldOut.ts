/**
 * One Breath held-out phrasing set — graded only, never used for tuning
 * (One Breath Final Build Spec, "Test sets"). Do not read these phrases while
 * writing rules, hints or prompts. Draft expectations, for founder review.
 */
import { build, type Phrase } from './phrasingSet';

export const PHRASING_HELD_OUT: Phrase[] = build(
  [
    ['open_screen', 'act', '', ['bring up hydration for me', 'jump to my circle', 'open up the moments page', 'settings please', 'show hydroscan']],
    ['status', 'act', '', ['how are my numbers', 'am I behind on water today', 'quick hydration check', 'how am I tracking', 'what does my hydrostate say']],
    ['upcoming', 'act', '', ["what's on deck", 'anything on my plate tomorrow', 'what do I have going on this week', 'next moment?']],
    ['log_drink', 'act', '', ['knocked back 16 oz of water', 'log a 10 oz tea', 'had a 12 oz LMNT just now', 'drank 750 ml of water', 'add a 16 oz Monster', 'log 20 ounces of Gatorade']],
    ['log_drink', 'ask', '', ['had a Liquid IV', 'log some coffee', 'drank a bunch of water', 'had a tall water', 'a Pedialyte']],
    ['log_drink', 'not_counted', '', ['had a beer with dinner', 'log two glasses of red', 'drank a vodka soda']],
    ['plan_moment', 'read_back', '', ['deadlifts tomorrow at 6:45 AM', 'pickleball Sunday at 10 in the morning', 'pitch meeting Thursday at 3 pm', 'easy run Friday 6 a.m.', 'climbing Saturday at 2 PM']],
    ['plan_moment', 'ask', '', ['pickleball Sunday at 10', 'squat day', 'something big on Thursday', 'run at 5', 'lift this weekend']],
    ['lock_in', 'not_active', '', ['lock me in please', 'go time, lock in']],
    ['lock_in', 'act', 'W', ['alright lock me in', 'lock in now']],
    ['send_message', 'read_back', 'S', ['let Annette know I got home late', 'tell Brandon I am five minutes out', 'message Lilia see you at 8']],
    ['share_plan', 'read_back', 'S', ['share the plan for tonight with Lilia', 'send Brandon my dinner plan']],
    ['made_it_back', 'act', 'S', ['made it back safe', 'I am back']],
    ['none', 'limit', '', ['should I take magnesium at night', 'what is a good pre-workout', 'find me a gym nearby', 'how do I fix my squat']],
    ['plan_moment', 'safety', '', ['lift tomorrow at 6 am, my back went out yesterday', 'run Saturday at 7 am, I am recovering from surgery']],
    ['none', 'nothing', '', ['scratch that', 'no', 'huh']],
  ],
  'H',
);
