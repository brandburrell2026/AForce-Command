/* Interactive product preview. No calendar, sharing or booking side effects. */
(()=>{
'use strict';
const DAYS = {
      game: { label: 'GAME DAY', date: 'SAT · OCT 18', place: 'FIELD 2, BRICKELL PARK',
        items: [
          { t: '8:30 AM', n: 'Wake sip', d: '16 oz water', k: 'HYDRATE' },
          { t: '12:30 PM', n: 'Lunch, then rest', d: 'Eat early, keep the afternoon light', k: 'FUEL' },
          { t: '5:10 PM', n: 'Leave for the field', d: 'Traffic adds 12 minutes today', k: 'TRAVEL', flag: true },
          { t: '6:00 PM', n: 'Warm-up', d: 'Watermelon Surge, then 8 oz water', k: 'LOCK IN' },
          { t: '7:00 PM', n: 'Flag Football · Game 2', d: 'Your Moment', k: 'MOMENT', moment: true },
          { t: '9:15 PM', n: 'Recover & Replay', d: 'Two minutes, then rest', k: 'RECOVER' } ],
        env: ['86°F at kickoff', 'Humidity 72%', 'Field 18 min away'],
        q: 'It will be 86°F at kickoff.', p: 'Start pre-game hydration 30 minutes earlier, at 5:30?', why: 'Heat and humidity climb through the afternoon. Your warm-up time stays the same.', done: 'Pre-game hydration now starts at 5:30.' },
      work: { label: 'WORKDAY', date: 'TUE · OCT 21', place: 'MIDTOWN OFFICE',
        items: [
          { t: '7:00 AM', n: 'Morning stick', d: 'AFORCE hydration · 16 oz', k: 'HYDRATE' },
          { t: '9:00 AM', n: 'Back-to-back calls', d: 'Nothing open until 1:30', k: 'CALENDAR', flag: true },
          { t: '1:30 PM', n: 'Eat and reset', d: 'Ten quiet minutes before you present', k: 'PREP' },
          { t: '2:00 PM', n: 'Board presentation', d: 'Your Moment', k: 'MOMENT', moment: true },
          { t: '6:30 PM', n: 'Pickleball doubles', d: 'Court 4 · after work', k: 'MOVE' },
          { t: '10:00 PM', n: 'Wind-down', d: 'Screens down, 8 oz water', k: 'RECOVER' } ],
        env: ['Office 68°F', '4 hours of meetings', 'Courts lit until 10'],
        q: 'Your morning calls run straight into lunch.', p: 'Hold 1:30–1:50 to eat and reset before you present?', why: 'That time is open on your calendar now. Your 2:00 presentation does not move.', done: '1:30–1:50 is held for you.' },
      travel: { label: 'TRAVEL DAY', date: 'THU · OCT 23', place: 'NEW YORK → CHICAGO',
        items: [
          { t: '9:30 AM', n: 'Pre-flight sip', d: '12 oz before boarding', k: 'HYDRATE' },
          { t: '11:40 AM', n: 'Flight to Chicago', d: 'Cabin protocol: small sips every hour', k: 'TRAVEL' },
          { t: '3:00 PM', n: 'Land at O’Hare', d: '35 minutes to the venue', k: 'TRAVEL' },
          { t: '4:30 PM', n: 'Settle in', d: 'Hotel · 30 quiet minutes', k: 'PREP', flag: true },
          { t: '6:00 PM', n: 'Investor presentation', d: 'Your Moment', k: 'MOMENT', moment: true },
          { t: '8:30 PM', n: 'Dinner near the venue', d: 'Table for 4', k: 'CLEAR' } ],
        env: ['Dry cabin air', 'Chicago 58°F, windy', 'Venue 35 min from airport'],
        q: 'You land at 3:00 and present at 6:00.', p: 'Hold 4:30–5:00 to settle in before anything else gets booked?', why: 'Three hours goes fast after a flight. This protects the time you said you need.', done: '4:30–5:00 is protected.' }
    };
const q=(n,root=document)=>root.querySelector(`[data-ui="${n}"]`);
const all=n=>[...document.querySelectorAll(`[data-ui="${n}"]`)];
const text=(n,t,root)=>{q(n,root).textContent=t;};
let mode='travel';const decisions={};
const status=document.createElement('p');status.setAttribute('role','status');status.style.cssText='font-size:14px;color:#c9c3b8;line-height:1.5';q(117).append(status);
function renderDay(){
 const d=DAYS[mode];text(101,d.label);text(102,`${d.date} · ${d.place}`);
 all(97).forEach((b,i)=>{const on=['game','work','travel'][i]===mode;b.setAttribute('aria-selected',on);b.tabIndex=on?0:-1;b.style.background=on?'#0f0e0d':'transparent';b.style.color=on?'#ede8df':'#3a3631';});
 all(104).forEach((row,i)=>{const it=d.items[i];text(105,it.t,row);text(108,it.n,row);text(109,it.d,row);text(110,it.k,row);q(108,row).style.fontWeight=it.moment?'800':'600';q(106,row).style.cssText=`width:12px;height:12px;flex:none;border-radius:50%;box-sizing:border-box;background:${it.moment?'#e5402c':it.flag?'transparent':'#cfc8ba'};border:${it.flag?'2px solid #e5402c':'none'};`;});
 all(116).forEach((el,i)=>el.textContent=d.env[i]);text(121,d.q);text(122,d.p);text(123,d.why);
 q(126).hidden=!!decisions[mode];status.textContent=decisions[mode]==='approved'?`Preview updated: ${d.done}`:decisions[mode]==='skipped'?'Preview unchanged. Your plan stays as it is.':'';
}
all(97).forEach((b,i)=>{b.addEventListener('click',()=>{mode=['game','work','travel'][i];renderDay();});b.addEventListener('keydown',e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const next=e.key==='Home'?0:e.key==='End'?2:(i+(e.key==='ArrowRight'?1:2))%3;all(97)[next].click();all(97)[next].focus();});});
q(127).onclick=()=>{decisions[mode]='approved';renderDay();};q(128).onclick=()=>{decisions[mode]='skipped';renderDay();};renderDay();
const diff=document.createElement('div');diff.hidden=true;diff.id='travel-changes';diff.style.cssText='margin-top:16px;font-size:13px;line-height:1.8;color:#c9c3b8';diff.innerHTML='<p>Land: <s>3:00</s> → 4:10 PM</p><p>Settle in: <s>4:30</s> → 4:45 PM · 10 minutes</p><p>Preparation window: 5:00–5:45 PM</p>';
q(153).before(diff);q(154).setAttribute('aria-controls',diff.id);q(154).setAttribute('aria-expanded','false');q(154).onclick=()=>{diff.hidden=!diff.hidden;q(154).textContent=diff.hidden?'See what changes':'Hide changes';q(154).setAttribute('aria-expanded',String(!diff.hidden));};
q(155).onclick=()=>{diff.hidden=false;q(154).textContent='Hide changes';q(154).setAttribute('aria-expanded','true');q(155).textContent='Preview updated';q(155).disabled=true;};
all(209).forEach(b=>b.onclick=()=>{const on=b.getAttribute('aria-checked')!=='true';b.setAttribute('aria-checked',on);b.style.background=on?'#4565ff':'#2a2f48';b.firstElementChild.style.left=on?'25px':'3px';});
const cue=document.createElement('p');cue.setAttribute('role','status');cue.className='demo-note';q(195).parentElement.after(cue);
q(191).onclick=()=>{cue.textContent='Voice preview: “One breath together before Game 2.” No audio is recorded or sent.';};
q(195).onclick=()=>{if(cue.querySelector('input'))return;cue.textContent='Try a cue — preview only. ';const input=document.createElement('input');input.type='text';input.maxLength=200;input.placeholder='One breath together before Game 2';input.setAttribute('aria-label','Preview a team cue');input.style.cssText='display:block;width:100%;margin-top:10px;padding:12px;background:#101322;color:#fff;border:1px solid #4a5070;border-radius:10px';cue.append(input);input.focus();};
all(229).forEach(b=>b.onclick=()=>{all(229).forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.style.borderColor=x===b?'#e5402c':'#2a2724';});q(235).textContent='Approve this choice';});q(235).onclick=()=>{q(235).textContent='Preview selected · no booking made';};
all(256).forEach(b=>b.onclick=()=>all(256).forEach(x=>{x.setAttribute('aria-pressed',String(x===b));x.style.borderColor=x===b?'#ede8df':'#3a3631';x.style.background=x===b?'#2a2724':'transparent';}));
const play=q(81);play.onclick=()=>{const frame=play.parentElement;const video=document.createElement('video');video.controls=true;video.muted=true;video.defaultMuted=true;video.playsInline=true;video.preload='none';video.poster='/assets/aforce-os/story-football.jpg';video.src='/assets/aforce-os/product-film-silent.mp4';video.setAttribute('aria-label','Silent AFORCE OS product film');video.style.cssText='position:absolute;inset:0;width:100%;height:100%;object-fit:contain;background:#000';frame.append(video);play.hidden=true;video.play().catch(()=>{video.focus();});video.focus();};
})();
