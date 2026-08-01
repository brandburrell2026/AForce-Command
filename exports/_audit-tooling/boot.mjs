import { evaluate } from './cdp.mjs';
import { setTimeout as sleep } from 'node:timers/promises';

// React-fiber walk → window.__afRootRef (root NavigationContainer ref) + window.__afGo(name)
export const INJECT = `
(function(){
  function fiberOf(el){ var ks=Object.keys(el); for(var i=0;i<ks.length;i++){var k=ks[i];if(k.indexOf('__reactFiber$')===0||k.indexOf('__reactContainer$')===0)return el[k];} return null; }
  var start=null, all=document.querySelectorAll('*');
  for(var i=0;i<all.length;i++){ var f=fiberOf(all[i]); if(f){start=f;break;} }
  if(!start) return 'NO_FIBER';
  var root=start; while(root.return) root=root.return;
  var ref=null, visited=new Set(), stack=[root], c=0;
  function isRootRef(o){try{return o&&typeof o==='object'&&typeof o.resetRoot==='function'&&typeof o.isReady==='function'&&typeof o.navigate==='function';}catch(e){return false;}}
  while(stack.length&&c<80000&&!ref){ var fb=stack.pop(); if(!fb||visited.has(fb))continue; visited.add(fb); c++;
    var p=fb.memoizedProps; if(p&&typeof p==='object'){ for(var k in p){ try{ if(isRootRef(p[k])){ref=p[k];break;} }catch(e){} } }
    if(fb.child)stack.push(fb.child); if(fb.sibling)stack.push(fb.sibling); }
  if(!ref) return 'NO_REF';
  window.__afRootRef=ref;
  window.__afGo=function(name){ try{ ref.navigate(name); return true; }catch(e){ return 'ERR '+e; } };
  return 'OK';
})();`;

export async function clickCenter(send, sel) {
  // scroll into view first (rows below the fold have off-screen coords)
  const r = await evaluate(send, `(function(){var e=document.querySelector(${JSON.stringify(sel)});if(!e)return null;try{e.scrollIntoView({block:'center'});}catch(x){}var b=e.getBoundingClientRect();if(b.width===0&&b.height===0)return null;return {x:b.x+b.width/2,y:b.y+b.height/2};})()`);
  if (!r) return false;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  return true;
}

export async function clickByText(send, re) {
  const r = await evaluate(send, `(function(){var els=Array.from(document.querySelectorAll('*'));var b=els.find(function(e){return e.childElementCount===0 && new RegExp(${JSON.stringify(re)}).test(e.textContent||'');});if(!b)return null;var x=b.getBoundingClientRect();return {x:x.x+x.width/2,y:x.y+x.height/2};})()`);
  if (!r) return false;
  for (const type of ['mouseMoved', 'mousePressed', 'mouseReleased'])
    await send('Input.dispatchMouseEvent', { type, x: r.x, y: r.y, button: 'left', clickCount: type === 'mouseMoved' ? 0 : 1 });
  return true;
}

export async function atIndex(send) {
  return await evaluate(send, `document.querySelectorAll('[data-testid^="gallery-row-"]').length>=13`);
}

// clean cold-boot: dismiss opening cinematic → welcome hero → onboarding, verify overlays gone
export async function bootApp(send) {
  await send('Page.enable');
  await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await send('Page.navigate', { url: 'http://localhost:8090/' });
  await sleep(3500);

  for (let i = 0; i < 45; i++) {
    // dismiss whatever cold-launch overlay is present
    await clickByText(send, 'Skip the opening sequence');
    await clickCenter(send, '[aria-label="GET STARTED"]');
    await clickCenter(send, '[aria-label="Skip setup"]');
    // overlays gone? welcome hero wordmark + CTA absent AND app chrome present
    const st = await evaluate(send, `(function(){
      var t=document.body.innerText||'';
      var heroUp = /PERFORMANCE IS NON-NEGOTIABLE/.test(t) || !!document.querySelector('[aria-label="GET STARTED"]');
      var onboarding = !!document.querySelector('[aria-label="Skip setup"]');
      var homeTab = !!document.querySelector('[aria-label="Home"]') || /READINESS/.test(t);
      return {heroUp:heroUp, onboarding:onboarding, homeTab:homeTab};
    })()`);
    if (!st.heroUp && !st.onboarding && st.homeTab) {
      const r = await evaluate(send, INJECT);
      if (r === 'OK') return true;
    }
    await sleep(700);
  }
  throw new Error('boot: overlays never cleared / app shell not reached');
}
