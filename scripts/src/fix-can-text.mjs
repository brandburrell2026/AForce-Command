import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";

const BASE = process.env.AI_INTEGRATIONS_OPENAI_BASE_URL.replace(/\/$/, "");
const KEY = process.env.AI_INTEGRATIONS_OPENAI_API_KEY;

const CANS = [
  "artifacts/aforce-pitch/public/can-berry.png",
  "artifacts/aforce-pitch/public/can-soursop.png",
  "artifacts/aforce-pitch/public/can-watermelon.png",
];

const PROMPT =
  "This is a product photo of an AFORCE beverage can on a transparent background. " +
  "Near the bottom of the can label there is a small line of text that currently reads " +
  "'Perfomance Alkaline Hydration' — it is misspelled. Correct ONLY that single word so the " +
  "line reads exactly 'Performance Alkaline Hydration', matching the same font, size, color, " +
  "weight, letter-spacing and position as the original text. Do not change anything else: keep " +
  "the can shape, colors, the AFORCE logo, the flavor name, the fruit imagery, the pH badge, " +
  "the 'NO ADDED SUGAR' top text, the side 'FUEL YOUR BODY WITH ALKALINE POWER' text, the net " +
  "weight line, lighting, reflections and the transparent background all exactly identical.";

async function editCan(relPath) {
  const abs = path.resolve(relPath);
  const buf = await readFile(abs);
  const form = new FormData();
  form.append("model", "gpt-image-1");
  form.append("prompt", PROMPT);
  form.append("size", "1024x1024");
  form.append("input_fidelity", "high");
  form.append(
    "image",
    new Blob([buf], { type: "image/png" }),
    path.basename(relPath),
  );

  const res = await fetch(`${BASE}/images/edits`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}` },
    body: form,
  });

  if (!res.ok) {
    const t = await res.text();
    throw new Error(`${relPath}: HTTP ${res.status} ${t.slice(0, 500)}`);
  }
  const json = await res.json();
  const b64 = json.data?.[0]?.b64_json;
  if (!b64) throw new Error(`${relPath}: no b64_json in response`);
  await writeFile(abs, Buffer.from(b64, "base64"));
  console.log(`fixed: ${relPath}`);
}

for (const c of CANS) {
  await editCan(c);
}
console.log("done");
