
const R=matchMedia('(prefers-reduced-motion: reduce)').matches,loop=document.getElementById('loop'),pp=document.getElementById('pp');
// Films with canonical LOCK-IN lettering, self-hosted with MP4/WebM fallback.
const PL={},PP={};

const blobURL=(t,ty)=>URL.createObjectURL(new Blob([t],{type:ty}));


const H264=(()=>{try{return document.createElement('video').canPlayType('video/mp4; codecs="avc1.640028"')!==''}catch(_){return true}})();
const FB={'/assets/aforce-os/julius/film-lock-in.mp4':'/assets/aforce-os/julius/film-lock-in.webm','/assets/aforce-os/julius/pause-lock-in.mp4':'/assets/aforce-os/julius/pause-lock-in.webm'};
const pick=fb=>H264?fb:(FB[fb]||fb);
function webmRescue(v,fb){let done=false;v.addEventListener('error',()=>{if(done||!FB[fb])return;const cs=v.currentSrc||'';if(/\.mp4(\?|$)/.test(cs)||cs.startsWith('blob:')){done=true;v.src=FB[fb];v.play().catch(()=>{})}})}
function guard(v,get,fb,want){setTimeout(()=>{const h=get();if(h&&want()&&v.currentTime<0.2){try{h.destroy()}catch(_){};v.src=pick(fb);v.play().catch(()=>{})}},9000)}
function attach(v,pl,dir,audio,fallback,onReady){webmRescue(v,fallback);


 v.src=pick(fallback);onReady&&onReady();return null}
const VTT="WEBVTT\n\nNOTE Sound-only cues. Every word in the film is already on screen, so captions never repeat it.\n\n00:00:00.000 --> 00:00:03.000\n[Low music builds]\n\n00:00:12.000 --> 00:00:14.500\n[The music stops. Room tone.]\n\n00:00:14.900 --> 00:00:17.200\n[A low, held tone]\n\n00:00:17.420 --> 00:00:20.000\n[Music returns]\n\n00:00:29.300 --> 00:00:30.290\n[Soft tick as the plan seals]\n\n00:00:35.710 --> 00:00:38.500\n[Music swells]\n\n00:00:56.000 --> 00:00:57.500\n[One soft breath]\n\n00:00:58.300 --> 00:01:01.758\n[Music resolves]\n";let VTT_URL=blobURL(VTT,'text/vtt');
// Top: the full film plays on its own, muted, and loops
const ppSet=on=>{pp.innerHTML=on?'❚❚&nbsp; Pause':'▶&nbsp; Play';pp.setAttribute('aria-label',on?'Pause the film':'Play the film')};ppSet(0);
const hb=[...document.querySelectorAll('.heroBar [data-film]')];const hLabel=t=>hb.forEach(x=>x.innerHTML=t);
let hh=null,heroSound=false,heroTrack=false;
const heroGo=()=>{if(!R)loop.play().then(()=>ppSet(1)).catch(()=>ppSet(0))};
let heroVis=true;addEventListener('DOMContentLoaded',()=>{hh=attach(loop,PL,'film',true,'/assets/aforce-os/julius/film-lock-in.mp4',heroGo);guard(loop,()=>hh,'/assets/aforce-os/julius/film-lock-in.mp4',()=>!R&&heroVis&&!heroSound&&!document.hidden)});
pp.onclick=()=>{if(loop.paused){loop.play().then(()=>ppSet(1)).catch(()=>{})}else{loop.pause();ppSet(0)}};
function soundOff(){heroSound=false;loop.muted=true;loop.controls=false;loop.loop=true;hLabel('🔊&nbsp; Watch with sound · 1:02')}
function heroPlay(e){const fromBar=e&&e.currentTarget&&e.currentTarget.closest('.heroBar');
 if(heroSound&&fromBar){soundOff();return}
 if(!heroTrack){const t=document.createElement('track');t.kind='captions';t.label='English · sound cues';t.srclang='en';t.src=VTT_URL;loop.appendChild(t);heroTrack=true}
 fv.pause();fSet(0);heroSound=true;loop.loop=false;loop.muted=false;loop.controls=true;try{loop.currentTime=0}catch(_){}
 const fr=document.querySelector('.frame').getBoundingClientRect();if(fr.top<0||fr.bottom>innerHeight)document.querySelector('.frame').scrollIntoView({behavior:R?'auto':'smooth',block:'nearest'});
 loop.play().then(()=>ppSet(1)).catch(()=>{});hLabel('🔇&nbsp; Mute')}
loop.addEventListener('ended',()=>{if(heroSound){soundOff();try{loop.currentTime=0}catch(_){}heroGo()}});
document.querySelectorAll('[data-film]').forEach(b=>b.onclick=heroPlay);
if('IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>{if(heroSound)return;heroVis=e.isIntersecting;if(e.isIntersecting){if(!R&&loop.readyState>0)heroGo()}else{loop.pause();ppSet(0)}}),{threshold:.2}).observe(loop)}
// Bottom: The pause, a short words-free cut that plays muted when it comes into view
const fv=document.getElementById('fv'),fpp=document.getElementById('fpp');let fh=null,fInit=false,fUser=false,fVis=false;
const fSet=on=>{fpp.innerHTML=on?'❚❚&nbsp; Pause':'▶&nbsp; Play';fpp.setAttribute('aria-label',on?'Pause The pause':'Play The pause')};fSet(0);
const fPlay=()=>{if(!fInit){fInit=true;fh=attach(fv,PP,'pause',false,'/assets/aforce-os/julius/pause-lock-in.mp4',()=>fv.play().then(()=>fSet(1)).catch(()=>fSet(0)));guard(fv,()=>fh,'/assets/aforce-os/julius/pause-lock-in.mp4',()=>fVis&&(!R||fUser));fv.addEventListener('playing',()=>fSet(1));return}fv.play().then(()=>fSet(1)).catch(()=>fSet(0))};
if('IntersectionObserver' in window){new IntersectionObserver(es=>es.forEach(e=>{fVis=e.isIntersecting;if(e.isIntersecting){if(!R||fUser)fPlay()}else if(fInit){fv.pause();fSet(0)}}),{threshold:.35}).observe(fv)}else if(!R)fPlay();
fpp.onclick=()=>{fUser=true;if(!fInit||fv.paused)fPlay();else{fv.pause();fSet(0)}};
// Header
const hd=document.getElementById('hd');addEventListener('scroll',()=>hd.classList.toggle('solid',scrollY>40),{passive:true});
// Reveal
if('IntersectionObserver' in window&&!R){const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});document.querySelectorAll('.rv').forEach(el=>io.observe(el))}else document.querySelectorAll('.rv').forEach(el=>el.classList.add('in'));
// Startup sequence plays when seen
if(!R&&'IntersectionObserver' in window){const o=document.querySelector('.obph');new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)o.classList.add('go')}),{threshold:.3}).observe(o)}else{const o=document.querySelector('.obph');o.querySelector('.ob3').style.opacity=1}
// Scrolling screens play only while visible
if(!R&&'IntersectionObserver' in window){const pio=new IntersectionObserver(es=>es.forEach(e=>e.target.classList.toggle('go',e.isIntersecting)),{threshold:.35});document.querySelectorAll('.steps .ph.sc').forEach(x=>pio.observe(x))}
// Sticky story: swap the phone screen as each step reaches the middle
const imgs=[...document.querySelectorAll('#stagePhone>.ph')],dots=[...document.querySelectorAll('.dots i')];
const so=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){const i=+e.target.dataset.s;imgs.forEach((im,k)=>{im.classList.toggle('on',k===i);if(!R)im.classList.toggle('go',k===i&&im.classList.contains('sc'))});dots.forEach((d,k)=>d.classList.toggle('on',k===i))}}),{rootMargin:'-45% 0px -45% 0px'});
document.querySelectorAll('.steps>div').forEach(s=>so.observe(s));
// If the product images can't load, fall back to the film's can shot
const cans=document.getElementById('cans');{const bad=im=>{const f=im.src.split('/').pop();if(!im.dataset.l){im.dataset.l=1;im.src='/assets/aforce-os/julius/img/'+f}else{im.remove();if(!cans.querySelector('img'))cans.closest('.wrap').classList.add('noCans')}};cans.querySelectorAll('img').forEach(im=>{im.addEventListener('error',()=>bad(im));if(im.complete&&!im.naturalWidth)bad(im)})}
// Pick your Moment
const pimg=[...document.querySelectorAll('#pickPhone>.ph')],bgs=[...document.querySelectorAll('.pick .bg')],chips=[...document.querySelectorAll('.pick .chip')];
chips.forEach(c=>c.onclick=()=>{const i=+c.dataset.m;chips.forEach(x=>x.setAttribute('aria-pressed',x===c));pimg.forEach((im,k)=>im.classList.toggle('on',k===i));bgs.forEach((b,k)=>b.classList.toggle('on',k===i))});
// TRY ONE BREATH · interactive preview (nothing saved or sent)
(()=>{const $=s=>document.querySelector(s),dev=$('#dev');if(!dev)return;
const RM=matchMedia('(prefers-reduced-motion: reduce)').matches;
const scr=v=>{dev.querySelectorAll('.scr').forEach(e=>{const on=e.dataset.v===v;e.classList.toggle('on',on);e.inert=!on;on?e.removeAttribute('aria-hidden'):e.setAttribute('aria-hidden','true')});$('#again').style.visibility=(v==='ask'||window.__afxDemo)?'hidden':'visible'};
const SCN=[{k:/basketball|hoops|\bnba\b|\bwnba\b|tip[- ]?off|shootaround/i,img:'/assets/aforce-os/julius/img/sp_basketball.jpg',name:'Basketball',tone:'candle'},
 {k:/baseball|softball|\bmlb\b|pitch(ing)? (start|outing)|bullpen|first pitch|batting practice|\bbp\b/i,img:'/assets/aforce-os/julius/img/sp_baseball.jpg',name:'Baseball',tone:'dusk'},
 {k:/flag football|football|\bnfl\b|scrimmage|kickoff/i,img:'/assets/aforce-os/julius/img/sp_football.jpg',name:'Football',tone:'dusk'},
 {k:/pickleball|pickle ball|dink/i,img:'/assets/aforce-os/julius/img/sp_pickleball.jpg',name:'Pickleball',tone:'candle'},
 {k:/golf|tee time|tee off|tee-off|\bpga\b|driving range|\b(9|18) holes\b/i,img:'/assets/aforce-os/julius/img/sp_golf.jpg',name:'Golf',tone:'dawn'},
 {k:/tennis|\bpadel\b|squash/i,img:'/assets/aforce-os/julius/img/sp_tennis.jpg',name:'Tennis',tone:'day'},
 {k:/soccer|futbol|fútbol|\bmls\b|\bpitch\b(?! (deck|meeting))(?=.*(match|game|kickoff))/i,img:'/assets/aforce-os/julius/img/sp_soccer.jpg',name:'Soccer',tone:'dusk'},
 {k:/swim|swimming|\bpool\b|swim meet|\blaps\b|triathlon/i,img:'/assets/aforce-os/julius/img/sp_swim.jpg',name:'Swimming',tone:'dusk'},
 {k:/\brun\b|running|\brace\b|marathon|half marathon|\b\d+k\b|track meet|\btrack (practice|workout)\b|sprint/i,img:'/assets/aforce-os/julius/img/sp_run.jpg',name:'Race',tone:'dawn'},
 {k:/lift|gym|workout|train(ing)?\b|game|match|practice|ride|yoga/i,img:'/assets/aforce-os/julius/img/bg_gym.jpg',name:'Training',tone:'dawn'},
 {k:/flight|fly|airport|trip|travel/i,img:'/assets/aforce-os/julius/img/bg_travel.jpg',name:'Travel',tone:'dusk'},
 {k:/dinner|lunch|brunch|party|wedding|drinks|birthday|date night|night out|celebration|anniversary|reunion|gala/i,img:'/assets/aforce-os/julius/img/bg_dinner.jpg',name:'Social',tone:'candle',social:true},
 {k:/pitch|present|meeting|investor|interview|demo|board|talk|review/i,img:'/assets/aforce-os/julius/img/bg_presentation_m.jpg',name:'Work',tone:'day'},
 {k:/opening|stage|show|perform|concert|recital|audition|theater|theatre/i,img:'/assets/aforce-os/julius/img/bg_rehearsal_night.jpg',name:'Performance',tone:'stage'}];
const DAYS=['sunday','monday','tuesday','wednesday','thursday','friday','saturday'];
const NUM={one:1,two:2,three:3,four:4,five:5,six:6,seven:7,eight:8,nine:9,ten:10,eleven:11,twelve:12};
function parse(t){const s=t.toLowerCase();let day='';{const c=[['Tomorrow',s.search(/tomorrow/)],['Today',s.search(/tonight|today/)]].filter(x=>x[1]>-1).sort((a,b)=>a[1]-b[1]);if(c.length)day=c[0][0]}
 DAYS.forEach(d=>{if(s.includes(d))day=d[0].toUpperCase()+d.slice(1)});
 let h=null,m=0,ap=null;const st=s.replace(/\b\d+(\.\d+)?\s*(k|mi|miles?|laps?|holes?|meters?|yards?)\b/g,' ');const r=st.match(/\b(\d{1,2})(?::(\d\d))?\s*(am|pm|a\.m\.|p\.m\.)?/);
 if(r){h=+r[1];m=r[2]?+r[2]:0;ap=r[3]}else{const w=st.match(/\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\b(?:\s*(am|pm|a\.m\.|p\.m\.))?/);if(w){h=NUM[w[1]];ap=w[2]}}
 const apGiven=!!ap;if(h!=null){if(!ap)ap=(h>=7&&h<=11&&!/night|evening|tonight/.test(s))?'am':'pm';ap=ap[0]==='a'?'AM':'PM';if(/night|evening/.test(s)&&h<12)ap='PM';if(!apGiven&&/morning|breakfast|sunrise|dawn/.test(s)&&!/night|evening/.test(s))ap='AM'}
 const sc=SCN.find(x=>x.k.test(s))||{img:'/assets/aforce-os/julius/img/bg_calm.jpg',name:'Your Moment'};
 if(h!=null&&!apGiven&&h<=8&&/^(Basketball|Baseball|Football|Soccer)$/.test(sc.name)&&!/morning|\bam\b/.test(s))ap='PM';
 if(h!=null&&!apGiven&&sc.social&&h>=5&&h<=11&&!/brunch|breakfast|lunch|morning/.test(s))ap='PM';
 let title=sc.name;let fl=t.match(/flight to ([A-Za-z]+(?: [A-Za-z]+)?)/i);if(fl){const w=fl[1].split(' ').filter((x,i,arr)=>!/^(sunday|monday|tuesday|wednesday|thursday|friday|saturday|today|tonight|tomorrow|at|on|this|next)$/i.test(x));fl=w.length?[0,w.join(' ')]:null}
 if(sc.img&&sc.img.indexOf('sp_')>-1){title=sc.name;if(/flag football/.test(s))title='Flag football';else if(/swim meet/.test(s))title='Swim meet';else if(/\b\d+k\b/.test(s))title=s.match(/\b(\d+)k\b/)[1]+'K';else if(/game/.test(s))title=sc.name+' game';else if(/practice/.test(s))title=sc.name+' practice';else if(/meet/.test(s))title=sc.name+' meet';else if(/match/.test(s))title=sc.name+' match';else if(/marathon/.test(s))title=/half/.test(s)?'Half marathon':'Marathon';else if(/tee/.test(s))title='Tee time'}else if(/lift/.test(s))title=/morning/.test(s)?'Morning lift':'Lift';else if(/workout/.test(s))title='Workout';else if(/game/.test(s))title='Game';else if(fl)title='Flight to '+(fl[1].toUpperCase()==='LA'?'LA':fl[1].charAt(0).toUpperCase()+fl[1].slice(1));else if(/flight/.test(s))title='Flight';
 else if(/dinner/.test(s))title=/team/.test(s)?'Team dinner':'Dinner';else if(/wedding/.test(s))title='Wedding';else if(/birthday/.test(s))title='Birthday';else if(/night out/.test(s))title='Night out';else if(/date night/.test(s))title='Date night';else if(/anniversary/.test(s))title='Anniversary';else if(/brunch/.test(s))title='Brunch';else if(/lunch/.test(s))title='Lunch';else if(/party/.test(s))title='Party';else if(/celebration/.test(s))title='Celebration';else if(/pitch/.test(s))title='The pitch';else if(/presentation/.test(s))title='Presentation';else if(/interview/.test(s))title='Interview';else if(/opening night/.test(s))title='Opening night';
 if(sc.name==='Your Moment'){const w=t.replace(/[.!?]/g,'').split(' ').slice(0,3).join(' ');title=w.charAt(0).toUpperCase()+w.slice(1)}
 if(sc.social&&title==='Social'){const w=t.split(/[.!?,]/)[0].replace(/\b(at|on|this|next|tonight|today|tomorrow)\b.*$/i,'').trim().split(/\s+/).slice(0,4).join(' ');if(w)title=w.charAt(0).toUpperCase()+w.slice(1)}
 let next=null;if(sc.social){const nm=s.match(/\b(presentation|meeting|interview|workout|lift|flight|game|practice|pitch|shift|class)\b/);if(nm&&/\b(tomorrow|morning|early)\b/.test(s)){next=nm[1].charAt(0).toUpperCase()+nm[1].slice(1)+(/tomorrow/.test(s)?' · tomorrow':'')}}
 if(h!=null&&(h<1||h>12||m<0||m>59)){h=null;m=0}
 return {next,social:!!sc.social,tone:sc.tone||'',day:day||'Soon',time:h!=null?`${h}:${String(m).padStart(2,'0')} ${ap}`:'Time to confirm',h,m,ap,img:sc.img,title}}
const fmt=(h,m,ap,dm)=>{let t=(h%12+(ap==='PM'?12:0))*60+m+dm;t=(t+1440)%1440;let H=Math.floor(t/60),M=t%60,A=H>=12?'PM':'AM';H=H%12||12;return `${H}:${String(M).padStart(2,'0')} ${A}`};
const fit=()=>dev.style.setProperty('--k',dev.clientWidth/390);fit();addEventListener('resize',fit);if('ResizeObserver' in window)new ResizeObserver(fit).observe(dev);
scr('ask');let P=null,busy=false;const tryS=document.getElementById('try');const tone=t=>{if(t)tryS.dataset.tone=t;else delete tryS.dataset.tone};const act=b=>document.querySelectorAll('.tChips .chip').forEach(c=>{c.classList.toggle('act',c===b);c.setAttribute('aria-pressed',c===b?'true':'false')});
const mode=on=>{dev.classList.toggle('social',!!on);const l=document.getElementById('dMode');if(l)l.hidden=!on};

const TOPTS=[['Tonight','7:00 PM',7,0,'PM','Today'],['Tonight','8:00 PM',8,0,'PM','Today'],['Tomorrow','7:00 PM',7,0,'PM','Tomorrow'],['Tomorrow','9:00 AM',9,0,'AM','Tomorrow']];
function mirrorExtras(){const nx=$('#kNx');nx.hidden=!P.next;if(P.next)$('#kN').textContent=P.next;
 const need=P.h==null,box=$('#kTime'),ok=$('#bOk');box.hidden=!need;ok.hidden=need;
 if(need){$('#kW').textContent='Needs a time';const bb=$('#kTimeB');bb.innerHTML='';
  const D=P.day&&P.day!=='Soon'?P.day:null,lab=D==='Today'?'Tonight':D;
  const opts=D?((P.social||D==='Today')?[[lab,'7:00 PM',7,0,'PM',D],[lab,'8:00 PM',8,0,'PM',D],[lab,'9:00 PM',9,0,'PM',D]]:[[lab,'9:00 AM',9,0,'AM',D],[lab,'12:00 PM',12,0,'PM',D],[lab,'7:00 PM',7,0,'PM',D]]):TOPTS;
  opts.forEach(o=>{const b=document.createElement('button');b.type='button';b.className='chip';b.style.cssText='font-size:13px;padding:8px 12px';b.textContent=o[0]+' · '+o[1];
   b.onclick=()=>{P.h=o[2];P.m=o[3];P.ap=o[4];P.time=o[1];P.day=o[5];$('#kW').textContent=P.day+' · '+P.time;box.hidden=true;ok.hidden=false;ok.focus()};bb.appendChild(b)})}}
let tok=0;function say(text,btn,typed){if(busy)return;busy=true;const my=++tok;act(btn||null);{const q=parse(text);tone(q.tone);mode(q.social)}if(innerWidth<1000&&!window.__afxDemo)dev.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});scr('ask');const live=$('#dLive'),orb=$('#dOrb'),rip=$('#rip');$('#dQ').textContent=typed?'Reading your Moment…':'Listening…';$('#dFoot').style.opacity=0;live.innerHTML='';if(!typed){orb.classList.add('listen');rip.classList.add('go')}dev.dataset.os=typed?'think':'listen';
 const words=text.split(' ');words.forEach((w,i)=>{const sp=document.createElement('span');sp.textContent=w+' ';sp.style.animationDelay=(RM||typed?0:i*0.16)+'s';live.appendChild(sp)});
 setTimeout(()=>{if(my!==tok)return;dev.dataset.os='idle';orb.classList.remove('listen');rip.classList.remove('go');P=parse(text);P.text=text;
  $('#dWords').textContent=text;$('#kA').textContent=P.title;$('#kW').textContent=(P.day?P.day+' · ':'')+P.time;mirrorExtras();scr('heard');busy=false},RM?300:typed?900:words.length*160+900)}
function toSeal(){const r=$('#sRows');$('#sT').textContent=P.title;r.innerHTML='';
 const rows=P.h!=null?[[fmt(P.h,P.m,P.ap,-60),'Leave with time to spare','travel time from your plan'],[fmt(P.h,P.m,P.ap,-15),'One Breath','then phone face down'],[P.time.replace(/ /,'\u00a0'),'LOCK-IN','AFORCE goes quiet'],['After','One question','optional · only you see it']]
  :[['Before','Leave with time to spare','set the time when you seal'],['Before','One Breath','then phone face down'],['Start','LOCK-IN','AFORCE goes quiet'],['After','One question','optional · only you see it']];
 if(P.social){rows.length=0;rows.push(...(P.h!=null?[[fmt(P.h,P.m,P.ap,-15),'One Breath','then phone face down'],[P.time.replace(/ /,'\u00a0'),'LOCK-IN','AFORCE goes quiet'],['After','One optional question','skip ends it']]:[['Before','One Breath','then phone face down'],['Start','LOCK-IN','AFORCE goes quiet'],['After','One optional question','skip ends it']]))}
 rows.forEach((x,i)=>{const d=document.createElement('div');d.innerHTML=`<i>${x[0]}</i><span${x[1]==='LOCK-IN'?' style="color:#F23A45"':''}>${x[1]}<small>${x[2]}</small></span>`;r.appendChild(d);setTimeout(()=>d.classList.add('in'),RM?0:120+i*120)});
 $('#sWill').innerHTML=(P.social?[`· Adds this to ${P.day==='Soon'?'your plan':P.day==='Tomorrow'?'tomorrow':P.day==='Today'?'today':P.day}`,`· AFORCE stays quiet during your Moment`,`· One optional question after your Moment. Skip ends it.`,`· Your plan and Replay stay private. Send a check-in only if you choose.`].concat(P.next?[`· Keeps ${P.next.split(' · ')[0].toLowerCase()}${P.next.includes('tomorrow')?' tomorrow':''} as its own Moment, not merged`]:[]):[`· Adds this to ${P.day==='Soon'?'your plan':P.day==='Tomorrow'?'tomorrow':P.day==='Today'?'today':P.day}`,`· AFORCE stays quiet during your Moment`,`· One question afterward`,`· Nothing shared unless you invite`]).join('<br>');scr('seal')}
let sealTok=0;function sealed(){scr('sealed');tone('seal');const st=++sealTok;setTimeout(()=>{if(st!==sealTok)return;$('#hImg').style.backgroundImage=`url('${P.img}')`;$('#hEy').textContent=(P.day+' · '+P.time).toUpperCase();$('#hD').textContent=new Date().toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'}).toUpperCase().replace(',',' ·');$('#hT').textContent=P.title;{const H=new Date().getHours();document.querySelector('.hHi').textContent=H<12?'Good morning.':H<17?'Good afternoon.':'Good evening.'}$('#hL').innerHTML='<span style="color:#F23A45">LOCK-IN</span> at '+(P.h!=null?P.time:'the start');dev.classList.remove('land');void dev.offsetWidth;dev.classList.add('land');scr('home')},RM?400:1500)}
// hold to seal
const ring=$('#ring');let t=null;const down=e=>{e&&e.preventDefault();clearTimeout(t);ring.classList.add('hold');t=setTimeout(()=>{ring.classList.remove('hold');sealed()},1200)},up=()=>{clearTimeout(t);ring.classList.remove('hold')};
ring.addEventListener('pointerdown',down);['pointerup','pointerleave','pointercancel'].forEach(ev=>ring.addEventListener(ev,up));
ring.addEventListener('keydown',e=>{if((e.key===' '||e.key==='Enter')&&!e.repeat)down(e)});ring.addEventListener('keyup',e=>{if(e.key===' '||e.key==='Enter')up()});
addEventListener('blur',up);document.addEventListener('visibilitychange',()=>{if(document.hidden)up()});
$('#bTap').onclick=sealed;$('#bOk').onclick=toSeal;$('#bAdj').onclick=()=>{scr('ask');$('#dQ').textContent="What's coming?";$('#dLive').innerHTML='';$('#dFoot').style.opacity=1;$('#tIn').focus()};
document.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>say(b.dataset.say,b));
$('#tForm').onsubmit=e=>{e.preventDefault();const v=$('#tIn').value.trim();if(v)say(v.charAt(0).toUpperCase()+v.slice(1)+(/[.!?]$/.test(v)?'':'.'),null,true)};
$('#dOrb').onclick=()=>say('Morning lift tomorrow at 6:30 AM. I want to start on time.',document.querySelector('.tChips .chip'));
$('#dType').onclick=()=>{const i=$('#tIn');i.scrollIntoView({block:'center',behavior:RM?'auto':'smooth'});i.focus({preventScroll:true})};
$('#dClose').onclick=()=>{tok++;busy=false;tone('');mode(0);act(null);scr('ask');$('#dQ').textContent="What's coming?";$('#dLive').innerHTML='';$('#dFoot').style.opacity=1;$('#dOrb').classList.remove('listen');$('#rip').classList.remove('go')};
$('#again').onclick=()=>{tone('');mode(0);act(null);scr('ask');$('#dQ').textContent="What's coming?";$('#dLive').innerHTML='';$('#dFoot').style.opacity=1};

/* ---------- Attract demo: plays the full loop on its own until the visitor takes over ---------- */
(()=>{const bar=$('#demoBar'),txt=$('#demoTxt'),btn=$('#demoBtn'),sec=document.getElementById('try');
 if(!bar||RM)return;
 const LIST=[{c:0},{c:1},{c:2},{c:3},{type:'Dinner Friday at 8 with the team.'}];
 let run=0,on=false,vis=false,taken=false,idx=0;const chips=[...document.querySelectorAll('.tChips .chip')];
 const sleep=ms=>new Promise(r=>setTimeout(r,ms));
 const cur=()=>{const e=dev.querySelector('.scr.on');return e&&e.dataset.v};
 async function until(v,my,max){const t0=Date.now();while(cur()!==v){if(my!==run||Date.now()-t0>(max||9000))return false;await sleep(70)}return my===run}
 function tap(el,hold){if(!el)return;const d=dev.getBoundingClientRect(),r=el.getBoundingClientRect();let g;
  if(dev.contains(el)){g=document.createElement('i');g.className='gTap';g.style.left=(r.left-d.left+r.width/2)+'px';g.style.top=(r.top-d.top+r.height/2)+'px';dev.appendChild(g)}
  else{g=document.createElement('i');g.className='gTap';const p=el.offsetParent||document.body;const pr=p.getBoundingClientRect();g.style.left=(r.left-pr.left+r.width/2)+'px';g.style.top=(r.top-pr.top+r.height/2)+'px';if(getComputedStyle(p).position==='static')p.style.position='relative';p.appendChild(g)}
  void g.offsetWidth;g.classList.add(hold?'holdT':'go');el.classList.add('pressed');setTimeout(()=>el.classList.remove('pressed'),hold?1200:220);setTimeout(()=>g.remove(),hold?1400:800)}
 function clean(){tok++;sealTok++;busy=false;tone('');act(null);mode(0);ring.classList.remove('hold');$('#tIn').value='';scr('ask');$('#dQ').textContent="What's coming?";$('#dLive').innerHTML='';$('#dFoot').style.opacity=1;$('#dOrb').classList.remove('listen');$('#rip').classList.remove('go');dev.querySelectorAll('.gTap').forEach(g=>g.remove())}
 async function one(m,my){
  if(m.type){const i=$('#tIn');i.value='';tap(i);for(const ch of m.type){if(my!==run)return false;i.value+=ch;await sleep(48)}await sleep(380);if(my!==run)return false;tap($('#tForm button'));await sleep(200);i.value='';say(m.type,null,true)}
  else{const c=chips[m.c];tap(c);await sleep(220);if(my!==run)return false;say(c.dataset.say,c)}
  if(!await until('heard',my))return false;
  await sleep(1500);if(my!==run)return false;
  if(!$('#kTime').hidden){const b=$('#kTimeB button');tap(b);await sleep(260);b&&b.click();await sleep(700)}
  tap($('#bOk'));await sleep(240);if(my!==run)return false;toSeal();
  await sleep(1900);if(my!==run)return false;
  tap(ring,true);await sleep(120);ring.classList.add('hold');await sleep(1250);ring.classList.remove('hold');if(my!==run)return false;sealed();
  if(!await until('home',my,4000))return false;
  await sleep(3400);if(my!==run)return false;
  clean();return true}
 async function loop(my){await sleep(500);while(my===run){if(!await one(LIST[idx%LIST.length],my))return;idx++;await sleep(900)}}
 function start(){if(on||taken||!vis)return;on=true;window.__afxDemo=true;dev.setAttribute('aria-live','off');bar.hidden=false;bar.classList.remove('off');txt.textContent='Demo playing';btn.textContent='Tap to try it yourself';const my=++run;clean();loop(my)}
 function stop(byUser){if(!on&&!byUser)return;run++;on=false;window.__afxDemo=false;dev.setAttribute('aria-live','polite');clean();
  if(byUser){taken=true;bar.classList.add('off');txt.textContent='Your turn';btn.textContent='Play demo'}else{bar.classList.add('off');txt.textContent='Demo paused';btn.textContent='Play demo'}}
 btn.addEventListener('click',e=>{e.stopPropagation();if(on){stop(true)}else{taken=false;start()}});
 // any real interaction inside the section hands control to the visitor
 const take=e=>{if(taken||!e.isTrusted)return;if(bar.contains(e.target))return;if(e.type==='pointerdown'&&!e.target.closest('button,input,a,.ring,.chip,#dev'))return;if(on)stop(true);else taken=true};
 ['pointerdown','keydown','focusin'].forEach(ev=>sec.addEventListener(ev,take,true));
 const io=new IntersectionObserver(es=>es.forEach(e=>{vis=e.isIntersecting&&e.intersectionRatio>=.45;if(vis)start();else if(on)stop(false)}),{threshold:[0,.45,.7]});
 io.observe(dev);
 document.addEventListener('visibilitychange',()=>{if(document.hidden&&on)stop(false);else if(!document.hidden&&vis)start()});
})();
})();


/* Waitlist: on joinaforce.com it posts to the existing /api/founding-250 capture and only confirms a saved signup.
   Anywhere else (this preview) nothing is sent, and it says so honestly. */
(()=>{const f=document.getElementById('wl');if(!f)return;const st=f.querySelector('.wlS'),btn=f.querySelector('button'),inp=f.querySelector('#em');
const LIVE=/(^|\.)joinaforce\.com$/.test(location.hostname);
f.addEventListener('submit',async e=>{e.preventDefault();const em=inp.value.trim();
 if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)){st.textContent='Please enter a valid email address.';inp.focus();return}
 if(!LIVE){st.innerHTML='Preview only, so nothing was sent. Join at <a href="https://www.joinaforce.com/#founding" style="color:#F7F4EF">joinaforce.com</a>.';return}
 btn.disabled=true;const lab=btn.textContent;btn.textContent='Joining…';st.textContent='';
 const c=new AbortController(),to=setTimeout(()=>c.abort(),15000);
 try{const r=await fetch('/api/founding-250',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({email:em,source:f.dataset.signupSource,website:f.querySelector('[name=website]').value}),signal:c.signal});
  const j=await r.json();if(!r.ok||j.ok!==true)throw 0;btn.textContent='You\u2019re on the list';st.textContent='Thank you. Your early-access request has been received.'}
 catch(_){btn.disabled=false;btn.textContent=lab;st.textContent='We couldn\u2019t save your request. Please try again, or email info@alkalineforce.com.'}
 finally{clearTimeout(to)}});})();
/* Open the page with #quality to show the resolution each film is actually playing at. */
(()=>{if(location.hash!=='#quality')return;const b=document.createElement('div');b.setAttribute('aria-hidden','true');
b.style.cssText='position:fixed;left:12px;bottom:12px;z-index:9999;background:rgba(0,0,0,.8);color:#F7F4EF;font:12px/1.5 Inter,system-ui;padding:8px 12px;border-radius:8px;border:1px solid #333';document.body.appendChild(b);
const q=v=>{if(!v)return'–';const s=(v.currentSrc||'').startsWith('blob:')?'stream':(v.currentSrc||'').split('/').pop();return v.videoWidth+'×'+v.videoHeight+' · '+s};
setInterval(()=>{b.innerHTML='Film: '+q(document.getElementById('loop'))+'<br>The pause: '+q(document.getElementById('fv'))+'<br>Screen: '+innerWidth+'×'+innerHeight+' @'+devicePixelRatio+'x'},1000)})();

(function(){var t=document.getElementById('try');if(!t)return;var z=function(){if(t.scrollTop)t.scrollTop=0;if(t.scrollLeft)t.scrollLeft=0};t.addEventListener('scroll',z);z()})();
(function(){var dev=document.getElementById('dev'),btn=document.getElementById('dOrb'),cv=document.getElementById('dCv'),st=document.getElementById('dSt'),q=document.getElementById('dQ');if(!dev||!btn||!cv||!cv.getContext)return;var c=cv.getContext('2d'),W=660,cx=330,cy=330,t0=performance.now(),lvl=0,last='',vis=true,RM=matchMedia('(prefers-reduced-motion: reduce)').matches,ask=dev.querySelector('.scr[data-v=ask]'),LB={idle:'STANDBY',listen:'',think:''};
function state(){var s=dev.dataset.os||'idle';if(s==='listen'&&!btn.classList.contains('listen'))s='idle';if(s==='think'&&!(q&&/^Reading/.test(q.textContent)))s='idle';return s}
function draw(){var S=state(),t=(performance.now()-t0)/1000,lv=0,i,a;if(S!==last){last=S;if(st)st.textContent=LB[S]}
 if(S==='listen')lv=.35+.35*Math.abs(Math.sin(t*7.3))*Math.abs(Math.sin(t*2.1+1));else if(S==='think')lv=.15;
 lvl+=(lv-lvl)*.22;var L=RM?0:lvl;c.clearRect(0,0,W,W);
 var N=120,R1=250,R2=266;for(i=0;i<N;i++){a=i/N*Math.PI*2-Math.PI/2;var on=0;
  if(S==='listen'){var f=.5+.5*Math.sin(a*3+t*4)*Math.sin(a*5-t*3);on=Math.max(0,Math.min(1,L*1.6*f+L*.4))}
  else if(S==='think'&&!RM){var h=((t*1.6)%1)*Math.PI*2-Math.PI/2,d=Math.abs(((a-h+Math.PI*3)%(Math.PI*2))-Math.PI);on=Math.max(0,1-d/.7)}
  var mj=i%10===0,r1=mj?R1-8:R1;c.strokeStyle=on>.05?'rgba(247,244,239,'+(.25+.75*on)+')':'rgba(247,244,239,'+(mj?.38:.14)+')';
  if(on>.6&&S!=='think')c.strokeStyle='rgba(229,30,42,'+(.6+.4*on)+')';
  c.lineWidth=mj?3:2;c.beginPath();c.moveTo(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1);c.lineTo(cx+Math.cos(a)*(R2+on*10),cy+Math.sin(a)*(R2+on*10));c.stroke()}
 var br=S==='idle'&&!RM?Math.sin(t*1.1)*.018:0,R=170*(1+br+L*.07),pts=96,path=new Path2D();
 for(i=0;i<=pts;i++){a=i/pts*Math.PI*2;var n=Math.sin(a*3+t*1.3)*.5+Math.sin(a*5-t*1.9)*.3+Math.sin(a*7+t*2.6)*.2,r=R*(1+(RM?0:n)*(.012+L*.06)),x=cx+Math.cos(a)*r,y=cy+Math.sin(a)*r;i?path.lineTo(x,y):path.moveTo(x,y)}
 c.save();c.shadowColor='rgba(229,30,42,'+(.5+L*.4)+')';c.shadowBlur=80+L*70;
 var g=c.createRadialGradient(cx-R*.25,cy-R*.3,R*.08,cx+R*.05,cy+R*.08,R*1.08);g.addColorStop(0,'#FF7A7F');g.addColorStop(.35,'#EE2C37');g.addColorStop(.7,'#B5121C');g.addColorStop(1,'#33040A');c.fillStyle=g;c.fill(path);c.restore();
 c.save();c.clip(path);c.globalCompositeOperation='lighter';
 for(var k=0;k<3;k++){a=(RM?0:t)*(.32+k*.15)+k*2.1;var ox=Math.cos(a)*R*.3,oy=Math.sin(a*1.3)*R*.26,gg=c.createRadialGradient(cx+ox,cy+oy,0,cx+ox,cy+oy,R*(.5+k*.1));gg.addColorStop(0,'rgba(255,'+(90+k*25)+','+(80+k*15)+','+(.10+L*.16)+')');gg.addColorStop(1,'rgba(255,60,60,0)');c.fillStyle=gg;c.fillRect(0,0,W,W)}
 c.globalCompositeOperation='source-over';
 var sh=c.createRadialGradient(cx+R*.3,cy+R*.38,R*.15,cx,cy,R*1.05);sh.addColorStop(0,'rgba(30,1,3,0)');sh.addColorStop(.7,'rgba(30,1,3,.18)');sh.addColorStop(1,'rgba(30,1,3,.55)');c.fillStyle=sh;c.fillRect(0,0,W,W);
 var bl=c.createRadialGradient(cx-R*.36,cy-R*.44,0,cx-R*.36,cy-R*.44,R*.55);bl.addColorStop(0,'rgba(255,225,222,.20)');bl.addColorStop(1,'rgba(255,225,222,0)');c.fillStyle=bl;c.fillRect(0,0,W,W);
 c.save();c.translate(cx-R*.42,cy-R*.52);c.rotate(-.6);var sp=c.createRadialGradient(0,0,0,0,0,R*.2);sp.addColorStop(0,'rgba(255,255,255,.62)');sp.addColorStop(.5,'rgba(255,255,255,.14)');sp.addColorStop(1,'rgba(255,255,255,0)');c.scale(1.6,.75);c.fillStyle=sp;c.beginPath();c.arc(0,0,R*.2,0,7);c.fill();c.restore();
 c.restore();
 c.save();var rim=c.createLinearGradient(cx,cy-R,cx,cy+R);rim.addColorStop(0,'rgba(255,214,210,.38)');rim.addColorStop(.45,'rgba(255,214,210,.04)');rim.addColorStop(1,'rgba(255,120,120,.22)');c.strokeStyle=rim;c.lineWidth=2.4;c.stroke(path);c.restore();
 c.save();c.fillStyle='rgba(247,244,239,.92)';c.font='300 62px Inter,system-ui,sans-serif';c.textAlign='center';c.textBaseline='middle';var mw=c.measureText('N').width,gap=8,bw=26,tot=mw*2+bw+gap*2,x0=cx-tot/2;c.fillText('N',x0+mw/2,cy+2);x0+=mw+gap;c.fillRect(x0,cy-1,bw,3.5);x0+=bw+gap;c.translate(x0+mw/2,cy+2);c.scale(-1,1);c.fillText('N',0,0);c.restore();
 if(S==='think'&&!RM){c.save();c.strokeStyle='rgba(247,244,239,.9)';c.lineWidth=3;c.lineCap='round';var h2=t*4.2;c.beginPath();c.arc(cx,cy,R+34,h2,h2+.9);c.stroke();c.restore()}
 if(dev.classList.contains('social')){c.save();c.strokeStyle='rgba(39,101,255,.95)';c.lineWidth=5;c.shadowColor='rgba(39,101,255,.8)';c.shadowBlur=18;c.beginPath();c.arc(cx,cy,R+16,0,Math.PI*2);c.stroke();c.restore()}}
function loop(){if(!vis||document.hidden||!ask||!ask.classList.contains('on')){setTimeout(function(){requestAnimationFrame(loop)},250);return}draw();requestAnimationFrame(loop)}
if('IntersectionObserver' in window)new IntersectionObserver(function(es){es.forEach(function(e){vis=e.isIntersecting})},{threshold:.05}).observe(dev);
if(document.fonts&&document.fonts.ready)document.fonts.ready.then(draw);
if(RM){draw();setInterval(draw,500)}else requestAnimationFrame(loop)})();