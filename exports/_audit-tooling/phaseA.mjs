import { launchChrome, connect, evaluate, screenshotClip } from './cdp.mjs';
import { setTimeout as sleep } from 'node:timers/promises';
import { writeFileSync, mkdirSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { bootApp, clickCenter, clickByText, atIndex } from './boot.mjs';

const OUT = '/Users/brandonburrell/AForce-Command/exports/p0-gallery';
mkdirSync(OUT, { recursive: true });

async function main() {
  const proc = await launchChrome('/tmp/afaudit-chrome');
  const { ws, send } = await connect();
  await bootApp(send);
  console.log('booted clean; navigating to gallery');
  // Tall viewport so the 844-tall device frame sits fully on-screen and paints
  // completely (RN-web does not paint content scrolled below the fold). Width
  // stays 390 so the screens' responsive layout is faithful; the frame clips to
  // 390x844 regardless of window height.
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 1500, deviceScaleFactor: 2, mobile: true });

  await evaluate(send, `window.__afGo('(hidden)/gallery')`);
  await sleep(2500);
  let rows = [];
  for (let i = 0; i < 20; i++) {
    rows = await evaluate(send, `Array.from(document.querySelectorAll('[data-testid^="gallery-row-"]')).map(function(e){return {id:e.getAttribute('data-testid').replace('gallery-row-',''), label:(e.textContent||'').trim().replace(/\\s+/g,' ').slice(0,70)};})`);
    if (rows && rows.length >= 13) break;
    await sleep(500);
  }
  console.log('rows found:', rows.length);
  if (rows.length < 13) throw new Error('gallery rows not found: ' + rows.length);

  // Remount a fresh gallery (selectedId=null) — reset() unmounts any wedged,
  // un-dismissable overlay state, so the flow can never get stuck.
  async function freshGallery() {
    await evaluate(send, `(function(){try{window.__afRootRef.reset({index:0,routes:[{name:'(tabs)'}]});}catch(e){}})()`);
    await sleep(700);
    await evaluate(send, `window.__afGo('(hidden)/gallery')`);
    for (let i = 0; i < 16; i++) { if (await atIndex(send)) return true; await sleep(400); }
    return false;
  }

  const manifest = [];
  let n = 0;
  for (const row of rows) {
    n++;
    const num = String(n).padStart(2, '0');

    await freshGallery();
    // select the state
    await clickCenter(send, `[data-testid="gallery-row-${row.id}"]`);
    await sleep(1600); // detail render + arc/ring animation settle

    // Prefer the INNER bordered device frame (border/radius); detailRoot is also
    // 390x844 but has no border → excluded. Overlay states have no in-frame
    // content → fall back to a full-window capture of the overlay.
    const info = await evaluate(send, `(function(){
      var divs=document.querySelectorAll('div'), inner=null;
      for(var i=0;i<divs.length;i++){var d=divs[i];var w=d.clientWidth,h=d.clientHeight;
        if(w>=386&&w<=394&&h>=836&&h<=848){var cs=getComputedStyle(d);
          if(cs.borderTopWidth!=='0px'||cs.borderRadius!=='0px'){inner=d;break;}}}
      if(inner){var r=inner.getBoundingClientRect();var t=(inner.textContent||'').replace(/\\s+/g,' ').trim();
        return {found:true, rect:{x:r.x,y:r.y,width:r.width,height:r.height}, hasContent:t.length>2, sample:t.slice(0,48)};}
      // no bordered frame → overlay; sample the visible body text
      var bt=(document.body.innerText||'').replace(/\\s+/g,' ').trim();
      return {found:false, sample:bt.slice(0,48)};
    })()`);

    let clip, method;
    if (info.found && info.hasContent) {
      clip = { ...info.rect };
      method = 'device-frame 390x844';
    } else {
      clip = { x: 0, y: 0, width: 390, height: 844 };
      method = 'full-window (overlay surface)';
    }
    const png = await screenshotClip(send, clip);
    const file = `${num}-${row.id}.png`;
    writeFileSync(`${OUT}/${file}`, png);
    manifest.push({ n, id: row.id, label: row.label, file, viewport: 'standard 390x844', renderMethod: method, sample: info.sample || null, bytes: png.length });
    console.log(`  ${file}  ${method}  ${png.length}b  "${(info.sample||'').slice(0,34)}"`);
  }
  await freshGallery(); // leave clean

  writeFileSync(`${OUT}/manifest.json`, JSON.stringify({
    generated: execSync('date -u +%Y-%m-%dT%H:%M:%SZ').toString().trim(),
    target: 'Expo web (EXPO_PUBLIC_DEMO_MODE=true) via headless Chrome / CDP',
    route: '/gallery  — app/(hidden)/gallery.tsx  (dev/demo-only P0 harness)',
    viewport: { id: 'standard', width: 390, height: 844 },
    note: 'Store-driven states (Home/Hydration/Guardian/Activation) render inside the gallery 390x844 device frame; RecoveryCoach/Calibration overlay surfaces render full-window. All 13 states are the real shipped …ScreenV2 components fed deterministic fixtures — no forks, no fabricated data.',
    states: manifest,
  }, null, 2));
  console.log('WROTE manifest with', manifest.length, 'states');

  ws.close();
  try { proc.kill(); } catch {}
  try { execSync(`pkill -f "afaudit-chrome" || true`); } catch {}
}

main().catch((e) => { console.error('FATAL', e); process.exit(1); });
