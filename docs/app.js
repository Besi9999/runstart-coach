const KEY='runstart-coach-state-v3';
const LEGACY_KEYS=['runstart-coach-state-v2','runstart-coach-state-v1'];
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
const $=s=>document.querySelector(s);
function clone(x){return JSON.parse(JSON.stringify(x));}
function normalizeRun(r){return {...r,splits:Array.isArray(r.splits)?r.splits:[],points:Array.isArray(r.points)?r.points:[]};}
function load(){
  try{
    const raw=localStorage.getItem(KEY);
    if(raw){const parsed=JSON.parse(raw);return {...clone(defaultState),...parsed,runs:(parsed.runs||[]).map(normalizeRun)};}
    for(const k of LEGACY_KEYS){
      const legacy=localStorage.getItem(k);
      if(legacy){const old=JSON.parse(legacy);const migrated={...clone(defaultState),...old,runs:(old.runs||[]).map(normalizeRun)};localStorage.setItem(KEY,JSON.stringify(migrated));return migrated;}
    }
  }catch{}
  return clone(defaultState);
}
let state=load();
function save(){localStorage.setItem(KEY,JSON.stringify(state));}

function fmtTime(ms){const total=Math.max(0,Math.floor(ms/1000));const h=Math.floor(total/3600),m=Math.floor((total%3600)/60),s=total%60;return h?`${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`:`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;}
function fmtPace(distanceM,elapsedMs,minDistance=10){if(distanceM<minDistance||elapsedMs<=0)return'--:--';const minPerKm=(elapsedMs/60000)/(distanceM/1000);if(!Number.isFinite(minPerKm)||minPerKm<=0||minPerKm>99)return'--:--';let m=Math.floor(minPerKm),s=Math.round((minPerKm-m)*60);if(s===60){m+=1;s=0;}return`${m}:${String(s).padStart(2,'0')}`;}
function hav(a,b){const R=6371000,toRad=x=>x*Math.PI/180;const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}

function renderCoach(){
  $('#week').textContent=state.week;$('#goal').textContent=state.profile.goal;$('#weightInput').value=state.profile.weightKg;
  const bmi=state.profile.weightKg/Math.pow(state.profile.heightCm/100,2);$('#bmi').textContent=`BMI ${bmi.toFixed(1)}`;
  const completed=state.sessions.filter(s=>s.done).length;$('#score').textContent=Math.round(completed/state.sessions.length*100);
  const rpes=state.sessions.filter(s=>s.rpe).map(s=>s.rpe);const avg=rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:null;
  $('#coachText').textContent=avg>=8?'Keep the next session easy or repeat the week.':completed===3&&avg&&avg<=6.5?'Good consistency. You are ready for a small progression.':'Keep the effort conversational and finish feeling you could do a little more.';
  const root=$('#sessions');root.innerHTML='';
  for(const s of state.sessions){
    const el=document.createElement('article');el.className='session'+(s.done?' done':'');
    el.innerHTML=`<div class="session-top"><h4>${s.day}</h4><span class="muted">Easy effort</span></div><p>${s.plan}</p><div class="controls"><label class="check"><input data-done="${s.id}" type="checkbox" ${s.done?'checked':''}> Completed</label><label class="rpe">RPE <select data-rpe="${s.id}"><option value="">-</option>${[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}" ${s.rpe===v?'selected':''}>${v}</option>`).join('')}</select></label></div>`;
    root.appendChild(el);
  }
  document.querySelectorAll('[data-done]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.done);s.done=x.checked;save();renderCoach();});
  document.querySelectorAll('[data-rpe]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.rpe);s.rpe=x.value?Number(x.value):null;save();renderCoach();});
}
$('#weightForm').onsubmit=e=>{e.preventDefault();const kg=Number($('#weightInput').value);if(kg>=30&&kg<=300){state.profile.weightKg=kg;save();renderCoach();}};

const tracker={active:false,paused:false,watchId:null,startTime:null,pauseStarted:null,pausedMs:0,timer:null,points:[],distanceM:0,lastAccepted:null,segments:[],splits:[],nextSplitM:1000,lastSplitElapsed:0};
function elapsed(){if(!tracker.startTime)return 0;const now=tracker.paused&&tracker.pauseStarted?tracker.pauseStarted:Date.now();return now-tracker.startTime-tracker.pausedMs;}
function status(text,kind=''){const el=$('#gpsStatus');el.textContent=text;el.className='gps-pill'+(kind?` ${kind}`:'');}
function currentPace(){
  const cutoff=Date.now()-90000;const recent=tracker.segments.filter(s=>s.t>=cutoff);const d=recent.reduce((a,s)=>a+s.d,0);if(d<20)return'--:--';const first=recent[0],last=recent[recent.length-1];const ms=Math.max(1000,(last.t-first.t));return fmtPace(d,ms,15);
}
function renderLiveSplits(){const root=$('#liveSplits');root.innerHTML='';if(!tracker.splits.length){root.innerHTML='<p class="muted small">Splits will appear after each completed kilometer.</p>';return;}tracker.splits.forEach(s=>{const row=document.createElement('div');row.className='split-row';row.innerHTML=`<span>Km ${s.km}</span><strong>${fmtTime(s.splitMs)}</strong><span>${fmtPace(1000,s.splitMs,1)} /km</span>`;root.appendChild(row);});}
function updateMetrics(){const e=elapsed();$('#runTime').textContent=fmtTime(e);$('#runDistance').textContent=(tracker.distanceM/1000).toFixed(2);$('#runPace').textContent=currentPace();$('#avgPace').textContent=fmtPace(tracker.distanceM,e);$('#pointCount').textContent=`${tracker.points.length} GPS points`;renderLiveSplits();}
function recordSplits(){const e=elapsed();while(tracker.distanceM>=tracker.nextSplitM){const splitMs=e-tracker.lastSplitElapsed;tracker.splits.push({km:tracker.nextSplitM/1000,splitMs,cumulativeMs:e});tracker.lastSplitElapsed=e;tracker.nextSplitM+=1000;}}
function acceptPosition(pos){
  if(!tracker.active||tracker.paused)return;
  const c=pos.coords,p={lat:c.latitude,lon:c.longitude,acc:Number(c.accuracy)||999,t:pos.timestamp||Date.now()};
  $('#runAccuracy').textContent=Math.round(p.acc)||'—';status(p.acc<=20?'GPS good':p.acc<=45?'GPS fair':'GPS weak',p.acc<=20?'good':p.acc<=45?'fair':'weak');
  if(p.acc>65)return;
  if(tracker.lastAccepted){
    const d=hav(tracker.lastAccepted,p),dt=Math.max(.001,(p.t-tracker.lastAccepted.t)/1000),speed=d/dt;
    const minMove=Math.max(2.5,Math.min(8,p.acc*0.18));
    if(d<minMove)return;
    if(speed>8.5)return;
    tracker.distanceM+=d;tracker.segments.push({d,t:p.t,dt});recordSplits();
  }
  tracker.lastAccepted=p;tracker.points.push(p);updateMetrics();drawRoute();
}
function geoError(err){status(err.code===1?'Location denied':'GPS unavailable','weak');$('#trackerStatus').textContent='Location needed';}
function startWatch(){if(!navigator.geolocation){status('GPS unsupported','weak');return;}tracker.watchId=navigator.geolocation.watchPosition(acceptPosition,geoError,{enableHighAccuracy:true,maximumAge:500,timeout:15000});}
function stopWatch(){if(tracker.watchId!==null){navigator.geolocation.clearWatch(tracker.watchId);tracker.watchId=null;}}
function resetTracker(){Object.assign(tracker,{active:false,paused:false,watchId:null,startTime:null,pauseStarted:null,pausedMs:0,timer:null,points:[],distanceM:0,lastAccepted:null,segments:[],splits:[],nextSplitM:1000,lastSplitElapsed:0});}
function startRun(){if(tracker.active)return;resetTracker();tracker.active=true;tracker.startTime=Date.now();$('#trackerStatus').textContent='Running';$('#startRun').disabled=true;$('#pauseRun').disabled=false;$('#finishRun').disabled=false;$('#pauseRun').textContent='Pause';status('Requesting GPS');startWatch();tracker.timer=setInterval(updateMetrics,1000);updateMetrics();drawRoute();}
function pauseRun(){if(!tracker.active)return;if(!tracker.paused){tracker.paused=true;tracker.pauseStarted=Date.now();stopWatch();$('#trackerStatus').textContent='Paused';$('#pauseRun').textContent='Resume';status('GPS paused');}else{tracker.paused=false;tracker.pausedMs+=Date.now()-tracker.pauseStarted;tracker.pauseStarted=null;$('#trackerStatus').textContent='Running';$('#pauseRun').textContent='Pause';status('Restarting GPS');startWatch();}updateMetrics();}
function finishRun(){
  if(!tracker.active)return;if(tracker.paused&&tracker.pauseStarted){tracker.pausedMs+=Date.now()-tracker.pauseStarted;tracker.pauseStarted=null;}
  const durationMs=elapsed();stopWatch();clearInterval(tracker.timer);tracker.timer=null;
  const run={id:Date.now(),date:new Date().toISOString(),durationMs,distanceM:Math.round(tracker.distanceM),pace:fmtPace(tracker.distanceM,durationMs),splits:tracker.splits,points:tracker.points.map(p=>({lat:+p.lat.toFixed(5),lon:+p.lon.toFixed(5),t:p.t,acc:Math.round(p.acc)}))};
  if(durationMs>=10000||tracker.distanceM>=20){state.runs.unshift(run);save();showSummary(run);}else{alert('Run was too short to save.');}
  tracker.active=false;tracker.paused=false;$('#trackerStatus').textContent='Saved';$('#startRun').disabled=false;$('#pauseRun').disabled=true;$('#finishRun').disabled=true;status('GPS idle');renderHistory();
}
function drawRoute(points=tracker.points,lineSelector='#routeLine',emptySelector='#routeEmpty'){
  const pts=points,$line=$(lineSelector),empty=$(emptySelector);if(!$line||!empty)return;if(pts.length<2){$line.setAttribute('points','');empty.style.display='grid';return;}empty.style.display='none';
  const lats=pts.map(p=>p.lat),lons=pts.map(p=>p.lon),minLat=Math.min(...lats),maxLat=Math.max(...lats),minLon=Math.min(...lons),maxLon=Math.max(...lons),w=Math.max(maxLon-minLon,.00001),h=Math.max(maxLat-minLat,.00001),pad=14;
  $line.setAttribute('points',pts.map(p=>`${(pad+(p.lon-minLon)/w*(300-pad*2)).toFixed(1)},${(180-pad-(p.lat-minLat)/h*(180-pad*2)).toFixed(1)}`).join(' '));
}

function showSummary(run){
  $('#summaryDistance').textContent=`${(run.distanceM/1000).toFixed(2)} km`;$('#summaryTime').textContent=fmtTime(run.durationMs);$('#summaryPace').textContent=`${run.pace} /km`;$('#summarySplits').textContent=`${run.splits.length} completed split${run.splits.length===1?'':'s'}`;
  $('#summaryCard').classList.remove('hidden');switchTab('history');window.scrollTo({top:0,behavior:'smooth'});
}
$('#closeSummary').onclick=()=>$('#summaryCard').classList.add('hidden');

function renderHistory(){
  const root=$('#historyList');root.innerHTML='';$('#historyTotal').textContent=`${state.runs.length} run${state.runs.length===1?'':'s'}`;
  if(!state.runs.length){root.innerHTML='<p class="muted small">No saved runs yet. Your first completed GPS run will appear here.</p>';return;}
  for(const r of state.runs){const d=new Date(r.date),el=document.createElement('article');el.className='history-item clickable';el.dataset.id=r.id;el.innerHTML=`<div><strong>${d.toLocaleDateString()}</strong><span>${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span></div><div class="history-stats"><span>${(r.distanceM/1000).toFixed(2)} km</span><span>${fmtTime(r.durationMs)}</span><span>${r.pace} /km</span></div><span class="chev">›</span>`;root.appendChild(el);}
  document.querySelectorAll('.history-item').forEach(el=>el.onclick=()=>openRunDetail(Number(el.dataset.id)));
}
function openRunDetail(id){
  const r=state.runs.find(x=>x.id===id);if(!r)return;const d=new Date(r.date);$('#detailTitle').textContent=`${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;$('#detailDistance').textContent=`${(r.distanceM/1000).toFixed(2)} km`;$('#detailTime').textContent=fmtTime(r.durationMs);$('#detailPace').textContent=`${r.pace} /km`;$('#deleteRun').dataset.id=r.id;
  const root=$('#detailSplits');root.innerHTML='';if(r.splits?.length){r.splits.forEach(s=>{const row=document.createElement('div');row.className='split-row';row.innerHTML=`<span>Km ${s.km}</span><strong>${fmtTime(s.splitMs)}</strong><span>${fmtPace(1000,s.splitMs,1)} /km</span>`;root.appendChild(row);});}else root.innerHTML='<p class="muted small">No full-kilometer splits recorded.</p>';
  drawRoute(r.points||[],'#detailRouteLine','#detailRouteEmpty');$('#detailCard').classList.remove('hidden');window.scrollTo({top:0,behavior:'smooth'});
}
$('#closeDetail').onclick=()=>$('#detailCard').classList.add('hidden');
$('#deleteRun').onclick=()=>{const id=Number($('#deleteRun').dataset.id);if(!confirm('Delete this run from RunStart? This cannot be undone.'))return;state.runs=state.runs.filter(r=>r.id!==id);save();$('#detailCard').classList.add('hidden');renderHistory();};

function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(`#${name}Tab`).classList.add('active');window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#startRun').onclick=startRun;$('#pauseRun').onclick=pauseRun;$('#finishRun').onclick=finishRun;
$('#exportData').onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`runstart-backup-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1000);};
window.addEventListener('beforeunload',()=>{if(tracker.active)stopWatch();});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderCoach();renderHistory();updateMetrics();renderLiveSplits();drawRoute();
