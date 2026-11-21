# One Breath, HydroScan and Travel hand-off: device test

For internal builds made from `feat/one-breath-conversation-routed` (draft PR #1309).
Run every row on **iPhone** and on **Android**. Write Pass or Fail and the build number.
Nothing here has been run on a device by the build author. A row is not passed until a person has done it on a phone.

| # | Do this | Expect | iPhone | Android |
|---|---|---|---|---|
| **A. The two fixes** | | | | |
| A1 | Open One Breath with no plan open. Say nothing. | The orb is full size with its dial. | | |
| A2 | Type "Lift tomorrow" and send. | The orb shrinks. AFORCE asks "What time?" | | |
| A3 | Type "seal it". | AFORCE asks "What time?" again. Nothing is saved. Moments has no new Moment. | | |
| A4 | Type "6:30 in the morning". | Read-back, the plan steps on a light card, and "Hold to seal". | | |
| **B. Seal** | | | | |
| B1 | Hold the seal bar and let go early. | Nothing is sealed. | | |
| B2 | Hold the seal bar until it fills. | "01 · SEALED". The Moment is in Moments. No Undo (a held seal has none). | | |
| B3 | New plan, then type "seal it". | "SEALED" with Undo for 5 seconds. | | |
| B4 | Tap Undo inside 5 seconds. | "SEAL UNDONE". The seal bar is back. Moments shows one Moment, not two. | | |
| B5 | Close One Breath and open it again. | The conversation screen with the sealed plan's row (see section H). | | |
| **C. Water: logged at once, Undo for six seconds** | | | | |
| C1 | Type "Log 16 oz of water". | "LOGGED" at once. Hydration shows 16 oz more. Undo is offered. | | |
| C2 | Tap Undo inside six seconds. | "REMOVED". Hydration no longer counts it. | | |
| C3 | Log 16 oz of water and wait seven seconds. | Undo is gone. The log stays. | | |
| C4 | Log 16 oz of water, then close One Breath inside two seconds. | The log stays. An Undo bar shows on the next screen with the seconds left. | | |
| C5 | Tap Undo on that bar. | "Removed from today." Hydration no longer counts it. | | |
| C6 | Repeat C4 and do not tap Undo. | The bar goes on its own. The log stays, once. | | |
| C7 | Log water, close, reopen One Breath. | No second log. Hydration shows the drink once. | | |
| C8 | Type "I drank some water". When asked "How much?", close One Breath. | Nothing is logged. No Undo bar. | | |
| C9 | Airplane mode on. Type "Log 16 oz of water". | "NOT LOGGED". Nothing is added. No Undo. | | |
| **D. Other drinks** | | | | |
| D1 | Type "Log a 12 oz coffee". | "12 oz coffee. Logging in 6 seconds." with Undo. | | |
| D2 | Tap Undo inside six seconds. | "Not logged." Nothing in the drink log. | | |
| D3 | Log a 12 oz coffee and wait. | "LOGGED" after six seconds. HydroState does not move. | | |
| D4 | Log a 12 oz coffee and close One Breath inside two seconds. | The coffee is in the drink log once. No Undo bar (it cannot be taken back). | | |
| **E. HydroScan** | | | | |
| E1 | Open Scan. | The camera fills the screen. HYDROSCAN, close, light. "Barcode" and "Type it". | | |
| E2 | Tap the light. | The phone's torch turns on, then off. | | |
| E3 | Scan a barcode the app does not know (any grocery item). | "I don't know this product yet." with five drink types and "Type it". "Nothing is logged." | | |
| E4 | Close the sheet without picking. | Nothing is logged. | | |
| E5 | Scan it again, tap "Water", tap "16 oz", tap "Log it". | "Logged 16 oz water." with Done and Undo. Hydration shows 16 oz more. | | |
| E6 | Tap Undo. | "Removed from today." Hydration no longer counts it. | | |
| E7 | Scan again, tap "Coffee", "12 oz", "Log it". | "Logged 12 oz coffee." and the saved-to-your-log line. Done only. HydroState does not move. | | |
| E8 | Tap "Log it" twice fast. | One log. | | |
| E9 | Deny the camera permission and open Scan. | The camera-off card. "Type it" still works. | | |
| E10 | Scan an AFORCE product. | The product result in the sheet, as before. "Scan again" returns to the camera. | | |
| **F. Travel hand-off** | | | | |
| F1 | In One Breath type "I'm flying to Miami Friday". | Travel opens with Miami and Friday already filled. It asks only for what is missing. | | |
| F2 | Answer what it asks. Do not confirm. Go back. | No trip is saved. | | |
| F3 | Do it again and confirm. | One trip is saved. | | |
| F4 | In One Breath type "Dinner in Miami Friday at 7 PM". | Stays in One Breath as an ordinary plan. | | |
| F5 | Type "Lift at 6:30", and when asked morning or evening type "I'm flying to Miami Friday". | It is not sent to Travel in the middle of a question. | | |
| **G. Accessibility** | | | | |
| G1 | VoiceOver / TalkBack: plan and seal a Moment. | Each reply is read. The seal bar seals on double tap. | | |
| G2 | Largest text size. | Nothing is cut off on the conversation, the Scan sheet or the Undo bar. | | |
| **H. Sealed, Lock In and Quiet in the conversation (added Nov 21, needs a build after 204 / 47)** | | | | |
| H1 | With a plan sealed for later, tap Breath. | The conversation screen, not the older screen. A row with the plan's name, time and "SEALED". "Your plan is yours. Lock In opens 15 minutes before it starts." No Lock In button. | | |
| H2 | With a plan sealed and inside 15 minutes of its start, tap Breath. | The same row with a "Lock In" button. | | |
| H3 | Tap "Lock In". Tap it twice fast. | Status reads "QUIET", a ring sits round the orb, the row says "LOCKED IN", and "Go perform. Phone down. We'll be quiet." One Lock In only. Ordinary reminders stop. | | |
| H4 | Close One Breath and tap Breath again. | Still the conversation screen in Quiet. Never the older "LOCKED IN" screen. | Pass · 205 | |
| H5 | In Quiet tap "Plans changed?" then "Back to Quiet". | "What changed?" with "My plan is cancelled", "Back to Quiet", "Emergency? 911". Back returns to Quiet. Nothing is saved. | | |
| H6 | Tap "Plans changed?", type "make it 8 pm" and send. (Needs 206 / 49.) | Stays on the conversation. The plan is read back with the new time and "Hold to seal". Nothing is saved until you seal. | | |
| H7 | Tap "Plans changed?" then "My plan is cancelled". | "Plan cancelled. Your plan has ended. This does not record a return or check-in." The row is gone. Moments shows it as cancelled, with no return. | | |
| H8 | In Quiet tap "Heading back?". | "Made it back." with "Made it back ✓", "Open Uber", "Open Lyft", "Back to Quiet". | Pass · 205 | |
| H9 | Tap "Open Uber". | Uber (or its web page) opens. Nothing is sent from AFORCE. | | |
| H10 | Tap "Made it back ✓". Tap it twice fast. (Needs 206 / 49.) | Stays on the conversation. "Did that plan work for you?" with the plan and four answers. One return is recorded. | | |
| H11 | During Quiet type "log 16 oz water". | Logged once with Undo, as in section C. Quiet does not end. | | |
| H12 | With a sealed plan open, type a new plan ("Lift tomorrow at 6:30 AM"). | "[Plan name] is still open. One plan at a time." No second plan is saved. | Pass · 205 | |
| H13 | Turn on airplane mode and tap "Lock In". | "Could not enter Quiet. Please try Lock In again." The row still says "SEALED". | | |
| **I. Added Nov 21, second round (needs iPhone 206 / Android 49 or later)** | | | | |
| I1 | Tap Breath from Home, from Hydration and from Moments. | No tab bar inside One Breath, in any state. | | |
| I2 | Tap the close button each time. | Back on the tab you came from. | | |
| I3 | Open One Breath from the Home card (not the tab) and close it. | Back on Home. | | |
| I4 | Type "Log 16 oz of water", then close inside two seconds. | The Undo bar shows on the screen you land on for the time left. Undo removes the water. | | |
| I5 | Once the exchange has started, look at the orb. | About a fifth larger than on 205 / 48. Nothing overlaps it. | | |
| I6 | In Quiet tap "Plans changed?" and type "I've been drinking and I'm driving home". | "AFORCE can't assess whether you're able to drive." with "Get a ride", "Contact someone", "Stay here", "Emergency? 911". Nothing is saved. | | |
| I7 | Tap "Contact someone", type a phone number and send. | The phone app opens on that number. No message is sent. | | |
| I8 | Type "can't breathe" under "What changed?". | "Get emergency help now." with "Call 911" first. | | |
| I9 | Type "my friend is late" under "What changed?". | "What should change: the day or the time?" Nothing is saved. | | |
| I10 | After H6, hold to seal. | The same Moment has the new time (Moments shows one, not two). It reads SEALED and needs Lock In again. | | |
| I11 | After "Made it back ✓", tap "Partly", then "Something else", type a note and send. | "Saved as a note." and "You said: Partly · “your note”". | | |
| I12 | Tap "Write a rule for next time", type a rule and send. | "Your rule for next time: …". It is listed in What AFORCE remembers. | | |
| I13 | Tap "Change answer", then "Yes, it worked". | "Same plan next time." The note is gone. | | |
| I14 | Seal a plan by typing "seal it", tap Undo, close the app fully and open One Breath. | The conversation opens on that plan's read-back with "Hold to seal". Sealing it leaves one Moment, not two. | | |
| I15 | Open a Moment from the Moments list. | The existing screen for that Moment, unchanged. | | |

## Results recorded so far

| Build | Device | What was checked | Result |
|---|---|---|---|
| iPhone 205 | Founder's iPhone, screen recording 2026-11-21 12:17 | H4, H8, H12 | Pass (seen in the recording). |
| iPhone 205 | Same recording | Home score card after logging 34 oz then 16 oz | HydroState went 31 → 51 and stayed at 51. Reported to the founders; see PR #1309. Not a One Breath row. |
| iPhone 205 | — | All other rows | Not run. |
| Android 48 | — | All rows | Blocked: no Android phone was available to the build author. |
| iPhone 206 / Android 49 | — | Sections A–I | Not run. |
