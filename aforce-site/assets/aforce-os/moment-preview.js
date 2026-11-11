/* Local illustrative demo: no microphone, network, storage, calendar or notifications. */
(() => {
  "use strict";
  const root = document.querySelector(".os-page");
  if (!root) return;
  const screen = root.querySelector("#demo-screen"),
    input = root.querySelector("#moment-input"),
    error = root.querySelector("#moment-error");
  const examples = {
    presentation: "Presentation tomorrow at 10 AM",
    lift: "Morning lift tomorrow at 6:30 AM",
    flight: "Flight Saturday at 9:05 AM",
  };
  let moment = null,
    holdStart = 0,
    frame = 0,
    stage = "start";
  const esc = (s) =>
    s.replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function time(total) {
    total = ((total % 1440) + 1440) % 1440;
    const h = Math.floor(total / 60),
      m = total % 60;
    return `${h % 12 || 12}:${String(m).padStart(2, "0")} ${h >= 12 ? "PM" : "AM"}`;
  }
  function parse(text) {
    const match = text.match(/\b(1[0-2]|0?[1-9])(?::([0-5]\d))?\s*(am|pm)\b/i);
    if (!match) return null;
    const start = match.index,
      hour =
        (Number(match[1]) % 12) + (match[3].toLowerCase() === "pm" ? 12 : 0);
    const dayMatch = text.match(
      /\b(today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    );
    const title = text
      .slice(0, dayMatch ? Math.min(start, dayMatch.index) : start)
      .replace(/\s+(at|on)\s*$/i, "")
      .trim();
    if (!title) return null;
    return {
      text,
      title,
      day: dayMatch ? dayMatch[0] : "Day not specified",
      minutes: hour * 60 + Number(match[2] || 0),
    };
  }
  function button(label, action, cls = "primary") {
    return `<button type="button" class="button ${cls}" data-action="${action}">${label}</button>`;
  }
  function render(html, next) {
    const hadContent = !!screen.firstElementChild;
    cancelHold();
    stage = next;
    screen.innerHTML = `<div class="screen">${html}</div>`;
    if (hadContent) {
      const heading = screen.querySelector("h3");
      if (heading) {
        heading.tabIndex = -1;
        heading.focus({ preventScroll: true });
      }
    }
  }
  function showStart() {
    moment = null;
    render(
      `<p class="screen-label">One Breath · Sample moment</p><h3>What’s coming?</h3><p>Try a sample presentation, then review the words.</p><button type="button" class="sample-orb" data-action="sample" aria-label="Try the sample moment; no microphone recording"><span class="nn-logo" aria-hidden="true"><span class="nn-n">N</span><span class="nn-bar"></span><span class="nn-n nn-flip">N</span></span></button><p class="muted">Tap to try a scripted sample moment.<br>No audio is recorded.</p><div class="spacer"></div>${button("Use a sample moment", "sample")}${button("Type my moment", "type", "secondary")}`,
      "start",
    );
  }
  function mirror(text) {
    const parsed = parse(text);
    if (!parsed) {
      moment = null;
      render(
        `<p class="screen-label">More detail needed</p><h3>When is your Moment?</h3><p>Add a time with AM or PM in the field beside this preview, then try again.</p><div class="spacer"></div>${button("Use a sample instead", "sample", "secondary")}`,
        "invalid",
      );
      error.textContent =
        "For this demo, include a moment and a 12-hour time with AM or PM, such as “Presentation tomorrow at 10 AM”.";
      input.focus();
      return false;
    }
    moment = parsed;
    error.textContent = "";
    render(
      `<p class="screen-label">What I heard · Review</p><h3>${esc(moment.text)}</h3><div class="heard"><p class="muted">AFORCE UNDERSTOOD</p><p>${esc(moment.title)}</p><p>${esc(moment.day)} · ${time(moment.minutes)}</p></div><p class="muted">Review the moment and time before trying the sample plan.</p><div class="spacer"></div>${button("Looks right", "plan")}${button("Adjust my words", "adjust", "secondary")}`,
      "mirror",
    );
    return true;
  }
  function schedule(early = false) {
    const prep = moment.minutes - (early ? 60 : 45);
    const prior = (t) => (t < 0 ? " (previous day)" : "");
    return `<ul class="demo-schedule"><li><time>${time(prep)}${prior(prep)}</time><span>Prepare what you need<small>${early ? "Changed · from your Replay" : "Illustrative preparation time"}</small></span></li><li><time>${time(moment.minutes - 15)}${prior(moment.minutes - 15)}</time><span>A quiet reset<small>A pause before your Moment</small></span></li><li><time>${time(moment.minutes)}</time><span>${esc(moment.title)}<small>Your Moment</small></span></li></ul>`;
  }
  function plan() {
    render(
      `<p class="screen-label">Review your sample plan</p><h3>${esc(moment.title)}</h3>${schedule()}<p class="privacy-note">Fixed example intervals—not personalized guidance or calculated travel times. Sealing changes this demo only.</p><div class="spacer"></div><button class="button primary seal-hold" type="button" data-action="hold" aria-label="Hold to seal the demo, or hold Space or Enter">Hold to seal</button>${button("Seal with one tap instead", "seal", "secondary")}${button("Back to my words", "adjust", "secondary")}`,
      "plan",
    );
  }
  function seal() {
    if (stage !== "plan") return;
    render(
      `<p class="screen-label">Sealed · Demo only</p><h3>Make room for<br>your Moment.</h3>${schedule()}<p>Your sample plan is ready. No reminder or calendar event was created.</p><div class="spacer"></div>${button("Preview reflection afterward", "reflect")}${button("Try another moment", "reset", "secondary")}`,
      "sealed",
    );
  }
  function reflect() {
    render(
      `<p class="screen-label">After your Moment · Replay preview</p><h3>How did the preparation feel?</h3><p>Imagine returning after ${esc(moment.title.toLowerCase())}. Reflect if you want, or skip.</p><div class="reflect-options"><button type="button" data-action="worked">The preparation worked for me</button><button type="button" data-action="earlier">I wanted more time to prepare</button></div><div class="spacer"></div>${button("Skip reflection", "skip", "secondary")}`,
      "reflect",
    );
  }
  function replay() {
    render(
      `<p class="screen-label">Your Replay · Proposed change</p><h3>A little more room next time?</h3><p>You chose: “I wanted more time to prepare.”</p><div class="heard"><p>For the next similar Moment, try starting preparation 15 minutes earlier.</p></div><p class="muted">Your own experiment. Review it before keeping it in this preview.</p><div class="spacer"></div>${button("Approve example change", "next")}${button("Dismiss change", "skip", "secondary")}`,
      "replay",
    );
  }
  function next() {
    render(
      `<p class="screen-label">Next time · Illustrative plan</p><h3>Your choice,<br>carried forward.</h3>${schedule(true)}<p class="approved-badge">Preparation starts 15 minutes earlier because you approved that change.</p><p class="muted">Preview only. Nothing is saved for future visits.</p><div class="spacer"></div>${button("Edit my choice", "reflect", "secondary")}${button("Reset preview", "reset")}`,
      "next",
    );
  }
  function cancelHold() {
    cancelAnimationFrame(frame);
    frame = 0;
    holdStart = 0;
    const b = screen.querySelector(".seal-hold");
    if (b) b.style.setProperty("--hold", "0");
  }
  function beginHold(b) {
    if (stage !== "plan" || holdStart) return;
    holdStart = performance.now();
    function tick(now) {
      const progress = Math.min((now - holdStart) / 850, 1);
      b.style.setProperty("--hold", String(progress));
      if (progress === 1) {
        seal();
        return;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
  }
  root.querySelectorAll("[data-preset]").forEach((b) =>
    b.addEventListener("click", () => {
      root
        .querySelectorAll("[data-preset]")
        .forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
      input.value = examples[b.dataset.preset];
      mirror(input.value);
    }),
  );
  root.querySelector("#moment-form").addEventListener("submit", (e) => {
    e.preventDefault();
    const text = input.value.trim();
    root
      .querySelectorAll("[data-preset]")
      .forEach((b) => b.setAttribute("aria-pressed", "false"));
    mirror(text);
  });
  function reset() {
    input.value = "";
    error.textContent = "";
    root
      .querySelectorAll("[data-preset]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.preset === "presentation"),
        ),
      );
    showStart();
  }
  root.querySelector("#reset-demo").addEventListener("click", reset);
  screen.addEventListener("click", (e) => {
    const b = e.target.closest("[data-action]");
    if (!b) return;
    switch (b.dataset.action) {
      case "sample":
        input.value = examples.presentation;
        mirror(examples.presentation);
        break;
      case "type":
        input.focus();
        break;
      case "plan":
        plan();
        break;
      case "adjust":
        input.value = moment.text;
        input.focus();
        break;
      case "seal":
        seal();
        break;
      case "reflect":
        reflect();
        break;
      case "earlier":
        replay();
        break;
      case "next":
        next();
        break;
      case "worked":
      case "skip":
        render(
          `<p class="screen-label">Replay · Demo only</p><h3>No change needed.</h3><p>Your sample plan stays as it is. Reflection is optional.</p><div class="spacer"></div>${button("Reset preview", "reset")}`,
          "skipped",
        );
        break;
      case "reset":
        reset();
    }
  });
  screen.addEventListener("pointerdown", (e) => {
    const b = e.target.closest('[data-action="hold"]');
    if (b && e.button === 0) {
      b.setPointerCapture(e.pointerId);
      beginHold(b);
    }
  });
  for (const event of ["pointerup", "pointercancel", "lostpointercapture"])
    screen.addEventListener(event, cancelHold);
  screen.addEventListener("keydown", (e) => {
    if (
      e.target.matches('[data-action="hold"]') &&
      [" ", "Enter"].includes(e.key)
    ) {
      e.preventDefault();
      beginHold(e.target);
    }
  });
  screen.addEventListener("keyup", (e) => {
    if ([" ", "Enter"].includes(e.key)) cancelHold();
  });
  screen.addEventListener("focusout", (e) => {
    if (e.target.matches('[data-action="hold"]')) cancelHold();
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) cancelHold();
  });
  root.querySelector("#approve-change").addEventListener("click", (e) => {
    root.querySelector("#change-status").textContent =
      "Example approved: preparation at 9:45, quiet reset at 10:15, presentation at 10:30. No calendar was changed.";
    e.target.textContent = "Example adjustment approved";
    e.target.disabled = true;
  });
  window.addEventListener("pagehide", reset);
  showStart();
})();
