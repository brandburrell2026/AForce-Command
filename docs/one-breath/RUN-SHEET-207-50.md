# Run sheet: iPhone 207 and Android 50 (2026-11-21)

Four recordings per phone, in this order. Record the screen for each and send the file. Results are filled in only from a recording or a tester's note. **Nothing below has been run.**

Result words: **Pass**, **Fail** (say what showed instead), **Blocked** (say what stopped the check).

## Before you start

- iPhone: install build 207 from TestFlight. Check Profile shows build 207. Android: install build 50 from its link.
- Start a screen recording: iPhone, Control Centre › Record. Android, Quick Settings › Screen record.
- Wi-Fi on. Signed in to your own account.

## Recording 1 · Coffee Undo (do this first)

This is also the check that the server's remove-a-drink route is live.

1. Open One Breath. Type `Log a 12 oz coffee` and send.
2. Wait for "LOGGED". Tap **Undo** within six seconds.
3. Stop when the label changes.

| Check | Expected | iPhone 207 | Android 50 |
|---|---|---|---|
| R1.1 Coffee saves at once | "LOGGED", with Undo beside it, no six-second wait | Not run | Not run |
| R1.2 Undo removes it | "REMOVED" | Not run | Not run |
| R1.3 If instead it says "STILL LOGGED" | The server route is not live: record as **Blocked · server** | Not run | Not run |
| R1.4 Hydration after | Today's water total and HydroState did not move for the coffee | Not run | Not run |

## Recording 2 · Quiet, then tap Breath

Needs a plan that starts within 15 minutes.

1. In One Breath type `Walk today at` followed by a time about ten minutes from now (for example `Walk today at 6:40 PM`). Answer anything it asks. Type `seal it`.
2. Tap **Lock In**.
3. Close One Breath. Tap **Breath** in the tab bar.

| Check | Expected | iPhone 207 | Android 50 |
|---|---|---|---|
| R2.1 Lock In | Status "QUIET", a ring round the orb, row says "LOCKED IN", "Go perform. Phone down. We'll be quiet." | Not run | Not run |
| R2.2 Tap Breath again | The same conversation screen in Quiet. Never the older "LOCKED IN" screen | Not run | Not run |
| R2.3 Tab bar | No tab bar inside One Breath | Not run | Not run |

## Recording 3 · Plans changed, "make it 8 pm", Seal

Continue from Recording 2 (still in Quiet).

1. Tap **Plans changed?**
2. Type `make it 8 pm` and send.
3. Hold the seal bar until it fills (or type `seal it`).

| Check | Expected | iPhone 207 | Android 50 |
|---|---|---|---|
| R3.1 After Plans changed? | "What changed?" with "My plan is cancelled", "Back to Quiet", "Emergency? 911" | Not run | Not run |
| R3.2 After "make it 8 pm" | Stays on the conversation. The plan is read back with 8:00 PM and the seal bar | Not run | Not run |
| R3.3 After Seal | "SEALED" with the 8:00 PM time. Moments shows one plan, not two | Not run | Not run |

## Recording 4 · Heading back, Made it back, Replay

Needs a locked-in plan. Make a new one as in Recording 2 and tap **Lock In**.

1. Tap **Heading back?**
2. Tap **Made it back ✓** once.
3. Answer the question (tap **Partly**, then any reason).

| Check | Expected | iPhone 207 | Android 50 |
|---|---|---|---|
| R4.1 Heading back | "Made it back." with "Made it back ✓", "Open Uber", "Open Lyft", "Back to Quiet" | Not run | Not run |
| R4.2 Made it back | Stays on the conversation. "Did that plan work for you?" with four answers | Not run | Not run |
| R4.3 After answering | "Saved as a note." and the answer shown. Never the older Replay screen | Not run | Not run |

## What I can and cannot do

The builder has no phones. Each row stays "Not run" until a recording or a tester's result arrives; then it is marked from what the recording shows.
