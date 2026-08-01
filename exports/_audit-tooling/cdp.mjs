// Minimal CDP driver for the AForce OS screen audit.
// Zero external deps beyond `ws` (present). Drives a headless Google Chrome
// over the DevTools Protocol: boots the demo web app, grabs the app's own
// expo-router navigation ref via a React-fiber walk, navigates route-by-route,
// and writes real PNG screenshots to disk. Read-only: it never edits app code,
// never bypasses auth/entitlement/safety gates (DEMO_MODE — the app's own
// sanctioned demo seam — handles auth; every other gate renders its real state).
import { spawn, execSync } from 'node:child_process';
import { setTimeout as sleep } from 'node:timers/promises';
import { createRequire } from 'node:module';
const require = createRequire('/Users/brandonburrell/AForce-Command/');
const WebSocket = require('ws');

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 9333;
const APP = 'http://localhost:8090';

export async function launchChrome(userDataDir) {
  // clear any stale instance holding the port / user-data-dir lock
  try { execSync(`pkill -9 -f "remote-debugging-port=${PORT}" 2>/dev/null; pkill -9 -f "${userDataDir}" 2>/dev/null; true`); } catch {}
  try { execSync(`rm -rf ${userDataDir}`); } catch {}
  await sleep(800);
  const args = [
    '--headless=new',
    `--remote-debugging-port=${PORT}`,
    `--user-data-dir=${userDataDir}`,
    '--disable-gpu',
    '--hide-scrollbars',
    '--no-first-run',
    '--no-default-browser-check',
    '--force-device-scale-factor=2',
    '--window-size=390,844',
    'about:blank',
  ];
  const proc = spawn(CHROME, args, { stdio: 'ignore' });
  // wait for the debugging endpoint
  for (let i = 0; i < 60; i++) {
    try {
      const r = await fetch(`http://localhost:${PORT}/json/version`);
      if (r.ok) break;
    } catch {}
    await sleep(250);
  }
  return proc;
}

export async function connect() {
  // find the page target
  let wsUrl = null;
  for (let i = 0; i < 40; i++) {
    const list = await (await fetch(`http://localhost:${PORT}/json`)).json();
    const page = list.find((t) => t.type === 'page');
    if (page && page.webSocketDebuggerUrl) { wsUrl = page.webSocketDebuggerUrl; break; }
    await sleep(200);
  }
  if (!wsUrl) throw new Error('no page target');
  const ws = new WebSocket(wsUrl, { maxPayload: 512 * 1024 * 1024 });
  await new Promise((res, rej) => { ws.once('open', res); ws.once('error', rej); });

  let id = 0;
  const pending = new Map();
  ws.on('message', (buf) => {
    const msg = JSON.parse(buf.toString());
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.method + ': ' + JSON.stringify(msg.error)));
      else resolve(msg.result);
    }
  });
  const send = (method, params = {}) =>
    new Promise((resolve, reject) => {
      const mid = ++id;
      pending.set(mid, { resolve, reject });
      ws.send(JSON.stringify({ id: mid, method, params }));
    });
  return { ws, send };
}

// evaluate an expression, return the JSON value (awaits promises)
export async function evaluate(send, expression) {
  const r = await send('Runtime.evaluate', {
    expression,
    awaitPromise: true,
    returnByValue: true,
  });
  if (r.exceptionDetails) {
    throw new Error('eval: ' + (r.exceptionDetails.exception?.description || JSON.stringify(r.exceptionDetails)));
  }
  return r.result.value;
}

export async function screenshotClip(send, clip) {
  const params = { format: 'png', captureBeyondViewport: true };
  if (clip) params.clip = { ...clip, scale: 1 };
  const r = await send('Page.captureScreenshot', params);
  return Buffer.from(r.data, 'base64');
}
