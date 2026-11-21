# One Breath: sealed, Lock In, Quiet, Plans changed and Heading back in the conversation screen

Reported 2026-11-21 from a screen recording of iPhone build 204: with a
locked-in plan still open, tapping Breath opened the older Lock In and
"What changed?" screens, not the approved prototype's single screen.

| File | What it shows |
|---|---|
| `before-build-204-quiet.jpg`, `before-build-204-plans-changed.jpg` | Frames from the recording (build 204 on an iPhone). |
| `sealed-lock-in.jpg`, `quiet.jpg`, `plans-changed.jpg`, `heading-back.jpg` | The new states, rendered from the app's own components in a browser harness at 390×844 with sample data. |

The "after" images are **not** from a phone. No device check has been run.
Compare with `reference/one-breath/screenshots/sheet-03-lockin-drinks-quiet.jpg` (fifth phone).

Known differences from the prototype:

- The prototype shows source chips under the status word; the app does not, because no source connection is read here.
- The prototype says "Quiet until 6:00 PM." The app never ends Quiet on a clock, so it uses the existing "Go perform. Phone down. We'll be quiet."
- The prototype starts Quiet at Seal. By founder decision Quiet starts at Lock In.
- The tab bar still shows under One Breath.
- Describing what changed, and Replay after "Made it back", open the existing screens.
