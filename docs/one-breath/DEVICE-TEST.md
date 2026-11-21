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
| B5 | Close One Breath and open it again. | The existing Lock In screen for the sealed Moment. | | |
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
