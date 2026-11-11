const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
let handler, originalFetch;
beforeEach(() => {
  delete require.cache[require.resolve('../api/founding-250.js')];
  handler = require('../api/founding-250.js'); originalFetch = global.fetch;
});
afterEach(() => { global.fetch = originalFetch; });
async function submit(body, headers = {}, method = 'POST') {
  const req = { body, method, headers, socket: { remoteAddress: '127.0.0.1' } };
  let result;
  const res = { setHeader() {}, end(raw) { result = JSON.parse(raw); } };
  await handler(req, res); return { status: res.statusCode, body: result };
}
test('normalizes email, preserves source and requires a confirmed capture', async () => {
  global.fetch = async (url, options) => {
    assert.equal(url, 'https://aforce-command-production.up.railway.app/api/early-access');
    assert.deepEqual(JSON.parse(options.body), { email: 'lead@example.com', source: 'homepage' });
    return new Response('{"ok":true}', { status: 200 });
  };
  assert.deepEqual(await submit({ email: ' LEAD@example.com ', source: 'homepage', website: '' }), { status: 200, body: { ok: true } });
});
test('rejects malformed email without contacting the backend', async () => {
  global.fetch = () => { throw Error('must not fetch'); };
  assert.equal((await submit({ email: 'invalid' })).status, 400);
});
test('rejects filled honeypot and foreign origins', async () => {
  assert.equal((await submit({ email: 'a@example.com', website: 'spam' })).status, 400);
  assert.equal((await submit({ email: 'a@example.com' }, { origin: 'https://evil.example' })).status, 403);
});
test('rejects an oversized parsed body', async () => {
  assert.equal((await submit({ email: 'a@example.com', padding: 'x'.repeat(3000) })).status, 413);
});
test('does not claim success for HTML or an unconfirmed 200', async () => {
  global.fetch = async () => new Response('<html>Login</html>', { status: 200 });
  assert.equal((await submit({ email: 'a@example.com' })).status, 502);
  global.fetch = async () => new Response('{}', { status: 200 });
  assert.equal((await submit({ email: 'a@example.com' })).status, 502);
});
test('surfaces upstream limits and failures', async () => {
  global.fetch = async () => new Response('{}', { status: 429 });
  assert.equal((await submit({ email: 'a@example.com' })).status, 429);
  global.fetch = async () => { throw Error('network failure'); };
  assert.equal((await submit({ email: 'a@example.com' })).status, 502);
});
test('limits repeated attempts', async () => {
  global.fetch = async () => new Response('{"ok":true}', { status: 200 });
  for (let n=0; n<5; n++) assert.equal((await submit({ email: 'a@example.com' })).status, 200);
  assert.equal((await submit({ email: 'a@example.com' })).status, 429);
});
test('does not accept GET requests', async () => {
  assert.equal((await submit({}, {}, 'GET')).status, 405);
});

test('accepts a native form POST when JavaScript is unavailable', async () => {
  global.fetch = async (_url, options) => {
    assert.deepEqual(JSON.parse(options.body), { email: 'lead@example.com', source: 'shop-waitlist' });
    return new Response('{"ok":true}', { status: 200 });
  };
  assert.equal((await submit('email=lead%40example.com&source=shop-waitlist&website=',
    { 'content-type': 'application/x-www-form-urlencoded' })).status, 200);
});
