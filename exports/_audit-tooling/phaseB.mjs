import { launchChrome, connect, evaluate, screenshotClip } from './cdp.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { bootApp } from './boot.mjs';

const OUT = '/Users/brandonburrell/AForce-Command/exports/full-route-audit';
mkdirSync(OUT, { recursive: true });

// user-facing routes. hint carries known semantics (device/auth/flow/dev/legacy/param).
const ROUTES = [
  { id: 'home',              label: 'Home (tab)',              nav: ['(tabs)', { screen: 'index' }],       path: '/(tabs)' , hint: 'tab' },
  { id: 'hydration',         label: 'Hydration (tab)',         nav: ['(tabs)', { screen: 'journal' }],     path: '/journal', hint: 'tab' },
  { id: 'protocol',          label: 'Protocol (tab)',          nav: ['(tabs)', { screen: 'protocol' }],    path: '/protocol', hint: 'tab' },
  { id: 'community',         label: 'Community (tab)',         nav: ['(tabs)', { screen: 'competition' }], path: '/competition', hint: 'tab' },
  { id: 'profile',           label: 'Profile (tab)',           nav: ['(tabs)', { screen: 'profile' }],     path: '/profile', hint: 'tab' },
  { id: 'scan-tab',          label: 'Scan (tab)',              nav: ['(tabs)', { screen: 'scan' }],        path: '/scan', hint: 'device' },
  { id: 'social-tab',        label: 'Social (tab)',            nav: ['(tabs)', { screen: 'social' }],      path: '/social', hint: 'tab' },
  { id: 'social-legacy',     label: 'Social (legacy tab)',     nav: ['(tabs)', { screen: 'social-legacy' }], path: '/social-legacy', hint: 'legacy' },
  { id: 'sleep',             label: 'Sleep (tab)',             nav: ['(tabs)', { screen: 'sleep' }],       path: '/sleep', hint: 'tab' },
  { id: 'onboarding',        label: 'Onboarding',              nav: ['onboarding'],           path: '/onboarding', hint: 'flow' },
  { id: 'auth',              label: 'Auth (sign-in/up)',       nav: ['(auth)'],               path: '/(auth)', hint: 'auth' },
  { id: 'scan',              label: 'HydroScan',               nav: ['scan'],                 path: '/scan', hint: 'device' },
  { id: 'subscription',      label: 'Subscription',            nav: ['subscription'],         path: '/subscription' },
  { id: 'subscription-manage', label: 'Subscription · Manage', nav: ['subscription/manage'],  path: '/subscription/manage' },
  { id: 'store',             label: 'Store',                   nav: ['store'],                path: '/store' },
  { id: 'cart',              label: 'Cart',                    nav: ['cart'],                 path: '/cart' },
  { id: 'heat',              label: 'Heat',                    nav: ['heat'],                 path: '/heat' },
  { id: 'urine-check',       label: 'Urine Check',             nav: ['urine-check'],          path: '/urine-check' },
  { id: 'heat-guardian',     label: 'Heat · Guardian',         nav: ['heat/guardian'],        path: '/heat/guardian' },
  { id: 'phantom',           label: 'Phantom',                 nav: ['phantom'],              path: '/phantom' },
  { id: 'cruise',            label: 'Cruise',                  nav: ['cruise'],               path: '/cruise' },
  { id: 'hidden-cruise',     label: 'Cruise (hidden group)',   nav: ['(hidden)/cruise'],      path: '/cruise', hint: 'flow' },
  { id: 'ring',              label: 'Ring',                    nav: ['ring'],                 path: '/ring' },
  { id: 'ring-session',      label: 'Ring · Session',          nav: ['ring/session'],         path: '/ring/session' },
  { id: 'notifications',     label: 'Notifications',           nav: ['notifications'],        path: '/notifications' },
  { id: 'leaderboard',       label: 'Leaderboard',             nav: ['leaderboard'],          path: '/leaderboard' },
  { id: 'legal',             label: 'Legal',                   nav: ['legal'],                path: '/legal' },
  { id: 'modules',           label: 'Modules',                 nav: ['modules'],              path: '/modules' },
  { id: 'weekly-report',     label: 'Weekly Report',           nav: ['weekly-report'],        path: '/weekly-report' },
  { id: 'share',             label: 'Share',                   nav: ['share'],                path: '/share' },
  { id: 'sweat',             label: 'Sweat',                   nav: ['sweat'],                path: '/sweat' },
  { id: 'clutch',            label: 'Clutch',                  nav: ['clutch'],               path: '/clutch' },
  { id: 'circles',           label: 'Circles',                 nav: ['circles'],              path: '/circles' },
  { id: 'circles-manage',    label: 'Circles · Manage',        nav: ['circles/manage'],       path: '/circles/manage' },
  { id: 'circles-shared',    label: 'Circles · Shared',        nav: ['circles/shared'],       path: '/circles/shared' },
  { id: 'circles-id',        label: 'Circle · Detail [id]',    nav: ['circles/[id]', { id: 'demo' }], path: '/circles/demo', hint: 'param' },
  { id: 'science',           label: 'Science',                 nav: ['science'],              path: '/science' },
  { id: 'sensors',           label: 'Sensors',                 nav: ['sensors'],              path: '/sensors', hint: 'device' },
  { id: 'guardian',          label: 'Guardian',                nav: ['guardian'],             path: '/guardian' },
  { id: 'social-v2',         label: 'Social v2',               nav: ['social-v2'],            path: '/social-v2' },
  { id: 'territory',         label: 'Territory',               nav: ['territory'],            path: '/territory' },
  { id: 'achievements',      label: 'Achievements',            nav: ['achievements'],         path: '/achievements' },
  { id: 'recovery-coach',    label: 'Recovery Coach',          nav: ['recovery-coach'],       path: '/recovery-coach' },
  { id: 'ui-gallery',        label: 'UI Gallery',              nav: ['ui-gallery'],           path: '/ui-gallery', hint: 'dev' },
  { id: 'gallery',           label: 'P0 Screen Gallery',       nav: ['(hidden)/gallery'],     path: '/gallery', hint: 'dev' },
];

const deepestRoute = `(function(){try{
  function d(s){ if(!s||!s.routes)return null; var r=s.routes[s.index!=null?s.index:s.routes.length-1]; return r.state?d(r.state):r.name; }
  return d(window.__afRootRef.getRootState());
}catch(e){return 'ERR';}})()`;

function classify(r) {
  if (r.errorBoundary) return { status: 'error-boundary', reason: '"Something went wrong" ErrorBoundary fallback rendered.' };
  if (r.featureGate)   return { status: 'preview/feature-flagged', reason: 'FeatureGate quiet/DEMO-LOCKED state (flag OFF in DEFAULT_FLAGS).' };
  if (r.authForm)      return { status: 'requires-authentication', reason: 'Clerk sign-in/up form (auth surface; DEMO_MODE bypasses the gate elsewhere).' };
  const blank = r.bodyLen < 12;
  if (blank) {
    if (r.hint === 'device') return { status: 'requires-device-only-capability', reason: 'Camera/sensor surface — no web hardware; renders empty on the web target.' };
    if (r.redirected)        return { status: 'redirected', reason: `Routed to "${r.actualRoute}" instead of the requested screen.` };
    return { status: 'blank-render', reason: 'Mounted but painted no content on the web target (see notes).' };
  }
  if (r.redirected && r.hint !== 'tab') return { status: 'redirected', reason: `Rendered "${r.actualRoute}" (redirect/guard) rather than the requested route.` };
  if (r.hint === 'device') return { status: 'rendered', reason: 'Rendered on web (device capture/sensor UI shown without live hardware).' };
  return { status: 'rendered', reason: 'Rendered with content on the web target.' };
}

async function main() {
  const proc = await launchChrome('/tmp/afaudit-chrome');
  const { ws, send } = await connect();
  async function bootFresh() {
    await bootApp(send);
    await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  }
  await bootFresh();
  console.log('booted; auditing', ROUTES.length, 'routes');

  const results = [];
  let poisoned = false;
  let n = 0;
  for (const rt of ROUTES) {
    n++;
    const num = String(n).padStart(2, '0');
    // A tripped root ErrorBoundary unmounts the nav tree and poisons every later
    // route → recover with a full reload+reboot so each route is judged clean.
    if (poisoned) { console.log('   ↻ recovering (reload+reboot) after prior crash'); await bootFresh(); poisoned = false; }
    else { await evaluate(send, `(function(){try{window.__afRootRef.reset({index:0,routes:[{name:'(tabs)'}]});}catch(e){}})()`); await sleep(500); }
    // navigate
    const navExpr = rt.nav.length === 2
      ? `window.__afGo2(${JSON.stringify(rt.nav[0])}, ${JSON.stringify(rt.nav[1])})`
      : `window.__afGo(${JSON.stringify(rt.nav[0])})`;
    await evaluate(send, `window.__afGo2=window.__afGo2||function(a,b){try{window.__afRootRef.navigate(a,b);return true}catch(e){return 'ERR '+e}};`);
    const navResult = await evaluate(send, navExpr);
    await sleep(1700);

    const sig = await evaluate(send, `(function(){
      var t=(document.body.innerText||'').replace(/\\s+/g,' ').trim();
      return {
        bodyLen:t.length, sample:t.slice(0,90),
        errorBoundary:/Something went wrong/i.test(t),
        featureGate:/DEMO LOCKED|Activate Demo/i.test(t),
        authForm: !!document.querySelector('input[type=password],input[name=identifier],input[name=emailAddress]') || /Sign in to|Continue with|Create your account/i.test(t),
      };
    })()`);
    const actualRoute = await evaluate(send, deepestRoute);
    const redirected = actualRoute && rt.nav[0] !== actualRoute && !(rt.hint === 'tab');

    const png = await screenshotClip(send, { x: 0, y: 0, width: 390, height: 844 });
    const file = `${num}-${rt.id}.png`;
    writeFileSync(`${OUT}/${file}`, png);

    const row = { ...rt, ...sig, actualRoute, redirected, navResult, file, n, bytes: png.length };
    const cls = classify(row);
    row.status = cls.status; row.reason = cls.reason;
    results.push(row);
    console.log(`  ${num} ${rt.id.padEnd(20)} ${cls.status.padEnd(28)} len=${String(sig.bodyLen).padStart(4)} act=${actualRoute}`);
    if (sig.errorBoundary) poisoned = true;
  }

  writeFileSync(`${OUT}/route-manifest.json`, JSON.stringify({
    phase: 'Full-route render audit',
    generated: execSync('date -u +%Y-%m-%dT%H:%M:%SZ').toString().trim(),
    target: 'Expo web (EXPO_PUBLIC_DEMO_MODE=true) via headless Chrome / CDP; navigated in-app through the real expo-router navigation ref (no auth/entitlement/flag/safety bypass).',
    viewport: { width: 390, height: 844 },
    routeCount: results.length,
    routes: results.map((r) => ({
      n: r.n, id: r.id, label: r.label, requestedRoute: r.nav[0], actualRoute: r.actualRoute,
      path: r.path, file: r.file, status: r.status, reason: r.reason,
      bodyLen: r.bodyLen, sample: r.sample, redirected: r.redirected,
      errorBoundary: r.errorBoundary, featureGate: r.featureGate, authForm: r.authForm, hint: r.hint || null,
    })),
  }, null, 2));
  console.log('WROTE route-manifest.json with', results.length, 'routes');

  ws.close();
  try { proc.kill(); } catch {}
  try { execSync(`pkill -9 -f "afaudit-chrome" || true`); } catch {}
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
