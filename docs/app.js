const KEY='runstart-coach-state-v2';
const LEGACY_KEY='runstart-coach-state-v1';
const defaultState={
  week:1,
  profile:{heightCm:168,weightKg:80,goal:'Build consistency and complete an easy 5K'},
  sessions:[
    {id:1,day:'Session 1',plan:'5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null},
    {id:2,day:'Session 2',plan:'5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null},
    {id:3,day:'Session 3',plan:'5 min walk + 10 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null}
  ],
  runs:[]
};
function clone(x){return JSON.parse(JSON.stringify(x));}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw) return {...clone(defaultState),...JSON.parse(raw)};
    const legacy=localStorage.getItem(LEGACY_KEY);
    if(legacy){
      const old=JSON.parse(legacy);
      const migrated={...clone(defaultState),...old,runs:[]};
      localStorage.setItem(KEY,JSON.stringify(migrated));
      return migrated;
    }
  }catch{}
  return clone(defaultState);
}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
let state=load();

function renderCoach(){
  document.querySelector('#week').textContent=state.week;
  document.querySelector('#goal').textContent=state.profile.goal;
  document.querySelector('#weightInput').value=state.profile.weightKg;
  const bmi=state.profile.weightKg/Math.pow(state.profile.heightCm/100,2);
  document.querySelector('#bmi').textContent=`BMI ${bmi.toFixed(1)}`;
  const completed=state.sessions.filter(s=>s.done).length;
  document.querySelector('#score').textContent=Math.round(completed/state.sessions.length*100);
  const rpes=state.sessions.filter(s=>s.rpe).map(s=>s.rpe);
  const avg=rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:null;
  document.querySelector('#coachText').textContent=avg>=8?'Keep the next session easy or repeat the week.':completed===3&&avg&&avg<=6.5?'Good consistency. You are ready for a small progression.':'Keep the effort conversational and finish feeling you could do a little more.';
  const root=document.querySelector('#sessions'); root.innerHTML='';
  for(const s of state.sessions){
    const el=document.createElement('article'); el.className='session'+(s.done?' done':'');
    el.innerHTML=`<div class="session-top"><h4>${s.day}</h4><span class="muted">Easy effort</span></div><p>${s.plan}</p><div class="controls"><label class="check"><input data-done="${s.id}" type="checkbox" ${s.done?'checked':''}> Completed</label><label class="rpe">RPE <select data-rpe="${s.id}"><option value="">-</option>${[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}" ${s.rpe===v?'selected':''}>${v}</option>`).join('')}</select></label></div>`;
    root.appendChild(el);
  }
  document.querySelectorAll('[data-done]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.done);s.done=x.checked;save();renderCoach();});
  document.querySelectorAll('[data-rpe]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.rpe);s.rpe=x.value?Number(x.value):null;save();renderCoach();});
}

document.querySelector('#weightForm').onsubmit=e=>{e.preventDefault(); const kg=Number(document.querySelector('#weightInput').value); if(kg>=30&&kg<=300){state.profile.weightKg=kg;save();renderCoach();}};

const tracker={active:false,paused:false,watchId:null,startTime:null,pauseStarted:null,pausedMs:0,timer:null,points:[],distanceM:0,lastAccepted:null};
const $=s=>document.querySelector(s);
function fmtTime(ms){const total=Math.max(0,Math.floor(ms/1000));const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function fmtPace(distanceM,elapsedMs){if(distanceM<30||elapsedMs<=0)return'--:--';const minPerKm=(elapsedMs/60000)/(distanceM/1000);if(!Number.isFinite(minPerKm)||minPerKm>99)return'--:--';const m=Math.floor(minPerKm),s=Math.round((minPerKm-m)*60);return`${m}:${String(s===60?0:s).padStart(2,'0')}`;}
function hav(a,b){const R=6371000,toRad=x=>x*Math.PI/180;const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);const x=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(x));}
function elapsed(){if(!tracker.startTime)return 0;const now=tracker.paused&&tracker.pauseStarted?tracker.pauseStarted:Date.now();return now-tracker.startTime-tracker.pausedMs;}
function updateMetrics(){const e=elapsed();$('#runTime').textContent=fmtTime(e);$('#runDistance').textContent=(tracker.distanceM/1000).toFixed(2);$('#runPace').textContent=fmtPace(tracker.distanceM,e);$('#pointCount').textContent=`${tracker.points.length} GPS points`;}
function status(text,kind=''){const el=$('#gpsStatus');el.textContent=text;el.className='gps-pill'+(kind?` ${kind}`:'');}
function acceptPosition(pos){
  if(!tracker.active||tracker.paused)return;
  const c=pos.coords; const p={lat:c.latitude,lon:c.longitude,acc:c.accuracy,t:pos.timestamp||Date.now()};
  $('#runAccuracy').textContent=Math.round(c.accuracy||0)||'—';
  status(c.accuracy<=25?'GPS good':c.accuracy<=60?'GPS fair':'GPS weak',c.accuracy<=25?'good':c.accuracy<=60?'fair':'weak');
  if(c.accuracy>100)return;
  if(tracker.lastAccepted){
    const d=hav(tracker.lastAccepted,p); const dt=(p.t-tracker.lastAccepted.t)/1000;
    const speed=dt>0?d/dt:0;
    if(d<3)return;
    if(speed>8.5)return;
    tracker.distanceM+=d;
  }
  tracker.lastAccepted=p; tracker.points.push(p); updateMetrics();drawRoute();
}
function geoError(err){status(err.code===1?'Location denied':'GPS unavailable','weak');$('#trackerStatus').textContent='Location needed';}
function startWatch(){if(!navigator.geolocation){status('GPS unsupported','weak');return;}tracker.watchId=navigator.geolocation.watchPosition(acceptPosition,geoError,{enableHighAccuracy:true,maximumAge:1000,timeout:15000});}
function stopWatch(){if(tracker.watchId!==null){navigator.geolocation.clearWatch(tracker.watchId);tracker.watchId=null;}}
function startRun(){
  if(tracker.active)return;
  tracker.active=true;tracker.paused=false;tracker.startTime=Date.now();tracker.pausedMs=0;tracker.pauseStarted=null;tracker.points=[];tracker.distanceM=0;tracker.lastAccepted=null;
  $('#trackerStatus').textContent='Running';$('#startRun').disabled=true;$('#pauseRun').disabled=false;$('#finishRun').disabled=false;$('#pauseRun').textContent='Pause';
  status('Requesting GPS');startWatch();tracker.timer=setInterval(updateMetrics,1000);updateMetrics();drawRoute();
}
function pauseRun(){if(!tracker.active)return;if(!tracker.paused){tracker.paused=true;tracker.pauseStarted=Date.now();stopWatch();$('#trackerStatus').textContent='Paused';$('#pauseRun').textContent='Resume';status('GPS paused');}else{tracker.paused=false;tracker.pausedMs+=Date.now()-tracker.pauseStarted;tracker.pauseStarted=null;$('#trackerStatus').textContent='Running';$('#pauseRun').textContent='Pause';status('Restarting GPS');startWatch();}updateMetrics();}
function finishRun(){
  if(!tracker.active)return;
  if(tracker.paused&&tracker.pauseStarted){tracker.pausedMs+=Date.now()-tracker.pauseStarted;tracker.pauseStarted=null;}
  const durationMs=elapsed();stopWatch();clearInterval(tracker.timer);tracker.timer=null;
  const run={id:Date.now(),date:new Date().toISOString(),durationMs,distanceM:Math.round(tracker.distanceM),pace:fmtPace(tracker.distanceM,durationMs),points:tracker.points.map(p=>({lat:+p.lat.toFixed(5),lon:+p.lon.toFixed(5),t:p.t}))};
  if(durationMs>=10000||tracker.distanceM>=20){state.runs.unshift(run);save();}
  tracker.active=false;tracker.paused=false;$('#trackerStatus').textContent='Saved';$('#startRun').disabled=false;$('#pauseRun').disabled=true;$('#finishRun').disabled=true;status('GPS idle');renderHistory();switchTab('history');
}
function drawRoute(){
  const pts=tracker.points,$line=$('#routeLine'),empty=$('#routeEmpty');if(pts.length<2){$line.setAttribute('points','');empty.style.display='grid';return;}empty.style.display='none';
  const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons);const w=Math.max(maxLon-minLon,.00001),h=Math.max(maxLat-minLat,.00001);const pad=14;
  const mapped=pts.map(p=>{const x=pad+(p.lon-minLon)/w*(300-pad*2);const y=180-pad-(p.lat-minLat)/h*(180-pad*2);return`${x.toFixed(1)},${y.toFixed(1)}`;});$line.setAttribute('points',mapped.join(' '));
}
function renderHistory(){
  const root=$('#historyList');root.innerHTML='';$('#historyTotal').textContent=`${state.runs.length} run${state.runs.length===1?'':'s'}`;
  if(!state.runs.length){root.innerHTML='<p class="muted small">No saved runs yet. Your first completed GPS run will appear here.</p>';return;}
  for(const r of state.runs){const d=new Date(r.date);const el=document.createElement('article');el.className='history-item';el.innerHTML=`<div><strong>${d.toLocaleDateString()}</strong><span>${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><div class="history-stats"><span>${(r.distanceM/1000).toFixed(2)} km</span><span>${fmtTime(r.durationMs)}</span><span>${r.pace} /km</span></div>`;root.appendChild(el);}
}
function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(`#${name}Tab`).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#startRun').onclick=startRun;$('#pauseRun').onclick=pauseRun;$('#finishRun').onclick=finishRun;
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`runstart-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.addEventListener('beforeunload',()=>{if(tracker.active)stopWatch();});
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderCoach();renderHistory();updateMetrics();drawRoute();
