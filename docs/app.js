const KEY='runstart-coach-state-v4-2';
const LEGACY_KEYS=['runstart-coach-state-v4-1','runstart-coach-state-v4','runstart-coach-state-v3','runstart-coach-state-v2','runstart-coach-state-v1'];
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
function normalizeRun(r){const mode=r.mode||'real';return {...r,mode,isTest:r.isTest===true||mode==='simulation',pausedMs:Number(r.pausedMs)||0,splits:Array.isArray(r.splits)?r.splits:[],points:Array.isArray(r.points)?r.points:[]};}
function isTestRun(r){return !!(r&&(r.isTest===true||r.mode==='simulation'));}
function realRuns(){return state.runs.filter(r=>!isTestRun(r));}
function testRuns(){return state.runs.filter(isTestRun);}
function modeLabel(r){if(!r)return'—';if(isTestRun(r)){return r.mode==='simulation'?'TEST simulation · excluded from stats':'TEST GPS · excluded from stats';}return'Real GPS';}
function selectedRunIds(){return [...document.querySelectorAll('.manage-check:checked')].map(x=>Number(x.dataset.id));}
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
function paceMinutes(distanceM,elapsedMs){if(distanceM<20||elapsedMs<=0)return null;return(elapsedMs/60000)/(distanceM/1000);}
function hav(a,b){const R=6371000,toRad=x=>x*Math.PI/180;const dLat=toRad(b.lat-a.lat),dLon=toRad(b.lon-a.lon);const q=Math.sin(dLat/2)**2+Math.cos(toRad(a.lat))*Math.cos(toRad(b.lat))*Math.sin(dLon/2)**2;return 2*R*Math.asin(Math.sqrt(q));}
function destination(p,d,bearingDeg){const R=6371000,br=bearingDeg*Math.PI/180,lat1=p.lat*Math.PI/180,lon1=p.lon*Math.PI/180,dr=d/R;const lat2=Math.asin(Math.sin(lat1)*Math.cos(dr)+Math.cos(lat1)*Math.sin(dr)*Math.cos(br));const lon2=lon1+Math.atan2(Math.sin(br)*Math.sin(dr)*Math.cos(lat1),Math.cos(dr)-Math.sin(lat1)*Math.sin(lat2));return{lat:lat2*180/Math.PI,lon:lon2*180/Math.PI};}

function renderCoach(){
  $('#week').textContent=state.week;$('#goal').textContent=state.profile.goal;$('#weightInput').value=state.profile.weightKg;
  const bmi=state.profile.weightKg/Math.pow(state.profile.heightCm/100,2);$('#bmi').textContent=`BMI ${bmi.toFixed(1)}`;
  const completed=state.sessions.filter(s=>s.done).length;$('#score').textContent=Math.round(completed/state.sessions.length*100);
  const rpes=state.sessions.filter(s=>s.rpe).map(s=>s.rpe);const avg=rpes.length?rpes.reduce((a,b)=>a+b,0)/rpes.length:null;
  $('#coachText').textContent=avg>=8?'Keep the next session easy or repeat the week.':completed===3&&avg&&avg<=6.5?'Good consistency. You are ready for a small progression.':'Keep the effort conversational and finish feeling you could do a little more.';
  const root=$('#sessions');root.innerHTML='';
  for(const s of state.sessions){const el=document.createElement('article');el.className='session'+(s.done?' done':'');el.innerHTML=`<div class="session-top"><h4>${s.day}</h4><span class="muted">Easy effort</span></div><p>${s.plan}</p><div class="controls"><label class="check"><input data-done="${s.id}" type="checkbox" ${s.done?'checked':''}> Completed</label><label class="rpe">RPE <select data-rpe="${s.id}"><option value="">-</option>${[1,2,3,4,5,6,7,8,9,10].map(v=>`<option value="${v}" ${s.rpe===v?'selected':''}>${v}</option>`).join('')}</select></label></div>`;root.appendChild(el);}
  document.querySelectorAll('[data-done]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.done);s.done=x.checked;save();renderCoach();});
  document.querySelectorAll('[data-rpe]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.rpe);s.rpe=x.value?Number(x.value):null;save();renderCoach();});
}
$('#weightForm').onsubmit=e=>{e.preventDefault();const kg=Number($('#weightInput').value);if(kg>=30&&kg<=300){state.profile.weightKg=kg;save();renderCoach();}};

const tracker={mode:'real',active:false,paused:false,watchId:null,simTimer:null,startWall:null,pauseStartedWall:null,pausedWallMs:0,clockScale:1,timer:null,points:[],distanceM:0,lastAccepted:null,segments:[],splits:[],nextSplitM:1000,lastSplitElapsed:0,bearing:80,simBase:{lat:51.505,lon:-0.09}};
function rawWallElapsed(){if(!tracker.startWall)return 0;const now=tracker.paused&&tracker.pauseStartedWall?tracker.pauseStartedWall:Date.now();return now-tracker.startWall-tracker.pausedWallMs;}
function elapsed(){return rawWallElapsed()*tracker.clockScale;}
function pausedDisplayMs(){return tracker.pausedWallMs*tracker.clockScale+(tracker.paused&&tracker.pauseStartedWall?(Date.now()-tracker.pauseStartedWall)*tracker.clockScale:0);}
function status(text,kind=''){const el=$('#gpsStatus');el.textContent=text;el.className='gps-pill'+(kind?` ${kind}`:'');}
function setMode(mode){if(tracker.active)return;tracker.mode=mode;const sim=mode==='simulation';tracker.clockScale=sim?20:1;$('#realMode').classList.toggle('active',!sim);$('#simMode').classList.toggle('active',sim);$('#modeBadge').textContent=sim?'TEST SIM':'REAL GPS';$('#modeBadge').classList.toggle('sim',sim);$('#modeHelp').textContent=sim?'TEST MODE ONLY: generates a synthetic route at 20× time speed. Test activities are saved with a TEST label, excluded from every running statistic/trend, and can be deleted together from History.':'Uses iPhone GPS. Keep RunStart open for the most reliable tracking.';status(sim?'Simulator idle':'GPS idle');}
$('#realMode').onclick=()=>setMode('real');$('#simMode').onclick=()=>setMode('simulation');
function currentPace(){const e=elapsed(),cutoff=e-90000;const recent=tracker.segments.filter(s=>s.e>=cutoff);const d=recent.reduce((a,s)=>a+s.d,0),ms=recent.reduce((a,s)=>a+s.dtMs,0);return d>=20?fmtPace(d,ms,15):'--:--';}
function renderLiveSplits(){const root=$('#liveSplits');root.innerHTML='';if(!tracker.splits.length){root.innerHTML='<p class="muted small">Splits will appear after each completed kilometer.</p>';return;}tracker.splits.forEach(s=>{const row=document.createElement('div');row.className='split-row';row.innerHTML=`<span>Km ${s.km}</span><strong>${fmtTime(s.splitMs)}</strong><span>${fmtPace(1000,s.splitMs,1)} /km</span>`;root.appendChild(row);});}
function updateMetrics(){const e=elapsed();$('#runTime').textContent=fmtTime(e);$('#runDistance').textContent=(tracker.distanceM/1000).toFixed(2);$('#runPace').textContent=currentPace();$('#avgPace').textContent=fmtPace(tracker.distanceM,e);$('#pauseTime').textContent=fmtTime(pausedDisplayMs());$('#pointCount').textContent=`${tracker.points.length} points`;renderLiveSplits();}
function interpolateSplits(oldDistance,newDistance,prevE,currE,d){while(tracker.nextSplitM<=newDistance){const ratio=d>0?(tracker.nextSplitM-oldDistance)/d:1;const crossE=prevE+(currE-prevE)*Math.max(0,Math.min(1,ratio));const splitMs=crossE-tracker.lastSplitElapsed;tracker.splits.push({km:tracker.nextSplitM/1000,splitMs,cumulativeMs:crossE});tracker.lastSplitElapsed=crossE;tracker.nextSplitM+=1000;}}
function processPoint(p,{bypassFilter=false}={}){
  if(!tracker.active||tracker.paused)return;
  $('#runAccuracy').textContent=Math.round(p.acc)||'—';
  if(tracker.mode==='simulation')status('SIM active','fair');else status(p.acc<=20?'GPS good':p.acc<=45?'GPS fair':'GPS weak',p.acc<=20?'good':p.acc<=45?'fair':'weak');
  if(!bypassFilter&&p.acc>65)return;
  if(tracker.lastAccepted){
    const d=hav(tracker.lastAccepted,p),prevE=tracker.lastAccepted.e??0,currE=p.e??elapsed(),dtMs=Math.max(250,currE-prevE),speed=d/(dtMs/1000),minMove=bypassFilter?0:Math.max(2.5,Math.min(8,p.acc*0.18));
    if(!bypassFilter&&d<minMove)return;if(!bypassFilter&&speed>8.5)return;
    const oldDistance=tracker.distanceM,newDistance=oldDistance+d;interpolateSplits(oldDistance,newDistance,prevE,currE,d);tracker.distanceM=newDistance;tracker.segments.push({d,e:currE,dtMs});
  }
  tracker.lastAccepted=p;tracker.points.push(p);updateMetrics();updateLiveMap();
}
function acceptPosition(pos){const c=pos.coords;processPoint({lat:c.latitude,lon:c.longitude,acc:Number(c.accuracy)||999,t:pos.timestamp||Date.now(),e:elapsed()});}
function geoError(err){status(err.code===1?'Location denied':'GPS unavailable','weak');$('#trackerStatus').textContent='Location needed';}
function startWatch(){if(!navigator.geolocation){status('GPS unsupported','weak');return;}tracker.watchId=navigator.geolocation.watchPosition(acceptPosition,geoError,{enableHighAccuracy:true,maximumAge:500,timeout:15000});}
function stopWatch(){if(tracker.watchId!==null){navigator.geolocation.clearWatch(tracker.watchId);tracker.watchId=null;}}
function startSimulation(){let p=tracker.lastAccepted||{...tracker.simBase,e:0,t:Date.now(),acc:4};if(!tracker.lastAccepted)processPoint(p,{bypassFilter:true});tracker.simTimer=setInterval(()=>{if(!tracker.active||tracker.paused)return;tracker.bearing=(tracker.bearing+2.8)%360;const next=destination(p,25,tracker.bearing);p={...next,acc:4,t:Date.now(),e:elapsed()};processPoint(p,{bypassFilter:true});},500);}
function stopSimulation(){if(tracker.simTimer){clearInterval(tracker.simTimer);tracker.simTimer=null;}}
function startSource(){tracker.mode==='simulation'?startSimulation():startWatch();}
function stopSource(){tracker.mode==='simulation'?stopSimulation():stopWatch();}
function resetTracker(){Object.assign(tracker,{active:false,paused:false,watchId:null,simTimer:null,startWall:null,pauseStartedWall:null,pausedWallMs:0,timer:null,points:[],distanceM:0,lastAccepted:null,segments:[],splits:[],nextSplitM:1000,lastSplitElapsed:0,bearing:80});}
function setModeControls(disabled){$('#realMode').disabled=disabled;$('#simMode').disabled=disabled;}
function startRun(){if(tracker.active)return;const mode=tracker.mode,scale=mode==='simulation'?20:1;resetTracker();tracker.mode=mode;tracker.clockScale=scale;tracker.active=true;tracker.startWall=Date.now();$('#trackerStatus').textContent=mode==='simulation'?'Simulating':'Running';$('#startRun').disabled=true;$('#pauseRun').disabled=false;$('#finishRun').disabled=false;$('#pauseRun').textContent='Pause';setModeControls(true);status(mode==='simulation'?'Starting simulator':'Requesting GPS');startSource();tracker.timer=setInterval(updateMetrics,500);updateMetrics();resetLiveMap();}
function pauseRun(){if(!tracker.active)return;if(!tracker.paused){tracker.paused=true;tracker.pauseStartedWall=Date.now();stopSource();$('#trackerStatus').textContent='Paused';$('#pauseRun').textContent='Resume';status(tracker.mode==='simulation'?'SIM paused':'GPS paused');}else{tracker.paused=false;tracker.pausedWallMs+=Date.now()-tracker.pauseStartedWall;tracker.pauseStartedWall=null;$('#trackerStatus').textContent=tracker.mode==='simulation'?'Simulating':'Running';$('#pauseRun').textContent='Pause';status(tracker.mode==='simulation'?'Restarting SIM':'Restarting GPS');startSource();}updateMetrics();}
function avgAccuracy(points){const xs=points.filter(p=>Number.isFinite(p.acc));return xs.length?Math.round(xs.reduce((a,p)=>a+p.acc,0)/xs.length):null;}
function finishRun(){
  if(!tracker.active)return;if(tracker.paused&&tracker.pauseStartedWall){tracker.pausedWallMs+=Date.now()-tracker.pauseStartedWall;tracker.pauseStartedWall=null;}
  const durationMs=elapsed(),pausedMs=tracker.pausedWallMs*tracker.clockScale;stopSource();clearInterval(tracker.timer);tracker.timer=null;
  const run={id:Date.now(),date:new Date().toISOString(),mode:tracker.mode,isTest:tracker.mode==='simulation',durationMs,pausedMs,distanceM:Math.round(tracker.distanceM),pace:fmtPace(tracker.distanceM,durationMs),avgAccuracy:avgAccuracy(tracker.points),splits:tracker.splits,points:tracker.points.map(p=>({lat:+p.lat.toFixed(6),lon:+p.lon.toFixed(6),t:p.t,acc:Math.round(p.acc)}))};
  if(durationMs>=10000||tracker.distanceM>=20){state.runs.unshift(run);save();showSummary(run);}else{alert('Run was too short to save.');}
  tracker.active=false;tracker.paused=false;$('#trackerStatus').textContent='Saved';$('#startRun').disabled=false;$('#pauseRun').disabled=true;$('#finishRun').disabled=true;setModeControls(false);status(tracker.mode==='simulation'?'Simulator idle':'GPS idle');renderHistory();renderStats();
}

let liveMap=null,liveLine=null,liveMarker=null,detailMap=null,detailLine=null;
function makeMap(id){if(typeof L==='undefined')return null;const map=L.map(id,{zoomControl:true,attributionControl:true});L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',{maxZoom:19,attribution:'&copy; OpenStreetMap contributors'}).addTo(map);return map;}
function ensureLiveMap(){if(!liveMap){liveMap=makeMap('liveMap');if(liveMap){liveLine=L.polyline([],{color:'#60a5fa',weight:5,opacity:.95}).addTo(liveMap);liveMap.setView([0,0],2);}}setTimeout(()=>liveMap?.invalidateSize(),100);}
function resetLiveMap(){ensureLiveMap();if(!liveMap)return;liveLine.setLatLngs([]);if(liveMarker){liveMap.removeLayer(liveMarker);liveMarker=null;}$('#mapHint').style.display='block';liveMap.setView([0,0],2);}
function updateLiveMap(){ensureLiveMap();if(!liveMap||!tracker.points.length)return;const latlngs=tracker.points.map(p=>[p.lat,p.lon]);liveLine.setLatLngs(latlngs);const last=latlngs[latlngs.length-1];if(!liveMarker)liveMarker=L.circleMarker(last,{radius:7,color:'#f8fafc',fillColor:'#22c55e',fillOpacity:1,weight:2}).addTo(liveMap);else liveMarker.setLatLng(last);$('#mapHint').style.display='none';if(latlngs.length===1)liveMap.setView(last,17);else if(latlngs.length<5||latlngs.length%8===0)liveMap.fitBounds(liveLine.getBounds(),{padding:[25,25],maxZoom:18});}
function showDetailMap(points){if(typeof L==='undefined')return;if(detailMap){detailMap.remove();detailMap=null;}detailMap=makeMap('detailMap');if(!detailMap)return;const latlngs=(points||[]).map(p=>[p.lat,p.lon]);if(latlngs.length){detailLine=L.polyline(latlngs,{color:'#60a5fa',weight:5}).addTo(detailMap);L.circleMarker(latlngs[0],{radius:6,color:'#fff',fillColor:'#22c55e',fillOpacity:1}).addTo(detailMap).bindTooltip('Start');L.circleMarker(latlngs[latlngs.length-1],{radius:6,color:'#fff',fillColor:'#ef4444',fillOpacity:1}).addTo(detailMap).bindTooltip('Finish');detailMap.fitBounds(detailLine.getBounds(),{padding:[25,25],maxZoom:18});}else detailMap.setView([0,0],2);setTimeout(()=>detailMap?.invalidateSize(),120);}

function showSummary(run){const test=isTestRun(run);$('#summaryDistance').textContent=`${(run.distanceM/1000).toFixed(2)} km`;$('#summaryTime').textContent=fmtTime(run.durationMs);$('#summaryPace').textContent=`${run.pace} /km`;$('#summaryPaused').textContent=fmtTime(run.pausedMs||0);$('#summarySplits').textContent=`${run.splits.length} full km`;$('#summaryMode').textContent=modeLabel(run);$('#summaryTitle').textContent=test?'Test activity saved':'Run saved';$('#summaryNotice').classList.toggle('hidden',!test);$('#summaryCard').classList.toggle('test-summary',test);$('#summaryCard').classList.remove('hidden');switchTab('history');window.scrollTo({top:0,behavior:'smooth'});}
$('#closeSummary').onclick=()=>$('#summaryCard').classList.add('hidden');
function renderHistory(){
  const root=$('#historyList');root.innerHTML='';const realCount=realRuns().length,testCount=testRuns().length;$('#historyTotal').textContent=`${realCount} real · ${testCount} test`;
  if(!state.runs.length){root.innerHTML='<p class="muted small">No saved runs yet. Your first completed run will appear here.</p>';return;}
  for(const r of state.runs){const d=new Date(r.date),el=document.createElement('article');el.className='history-item clickable';el.dataset.id=r.id;el.innerHTML=`<div><strong>${d.toLocaleDateString()}</strong><span>${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</span>${isTestRun(r)?'<span class="test-tag">TEST · excluded from stats</span>':''}</div><div class="history-stats"><span>${(r.distanceM/1000).toFixed(2)} km</span><span>${fmtTime(r.durationMs)}</span><span>${r.pace} /km</span></div><span class="chev">›</span>`;root.appendChild(el);}
  document.querySelectorAll('.history-item').forEach(el=>el.onclick=()=>openRunDetail(Number(el.dataset.id)));
  renderManageActivities();
}
function openRunDetail(id){
  const r=state.runs.find(x=>x.id===id);if(!r)return;const d=new Date(r.date);$('#detailTitle').textContent=`${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}`;$('#detailDistance').textContent=`${(r.distanceM/1000).toFixed(2)} km`;$('#detailTime').textContent=fmtTime(r.durationMs);$('#detailPace').textContent=`${r.pace} /km`;$('#detailPaused').textContent=fmtTime(r.pausedMs||0);$('#detailAccuracy').textContent=r.avgAccuracy?`±${r.avgAccuracy} m`:'—';$('#detailMode').textContent=modeLabel(r);$('#deleteRun').dataset.id=r.id;$('#exportGpx').dataset.id=r.id;$('#toggleTest').dataset.id=r.id;$('#toggleTest').textContent=r.mode==='simulation'?'Simulation TEST':(isTestRun(r)?'Mark as REAL':'Mark as TEST');$('#toggleTest').disabled=r.mode==='simulation';
  const root=$('#detailSplits');root.innerHTML='';if(r.splits?.length){r.splits.forEach(s=>{const row=document.createElement('div');row.className='split-row';row.innerHTML=`<span>Km ${s.km}</span><strong>${fmtTime(s.splitMs)}</strong><span>${fmtPace(1000,s.splitMs,1)} /km</span>`;root.appendChild(row);});}else root.innerHTML='<p class="muted small">No full-kilometer splits recorded.</p>';
  $('#detailCard').classList.remove('hidden');setTimeout(()=>showDetailMap(r.points||[]),50);window.scrollTo({top:0,behavior:'smooth'});
}
function renderManageActivities(){
  const root=$('#manageList');if(!root)return;const realCount=realRuns().length,testCount=testRuns().length;$('#manageCounts').textContent=`${realCount} real · ${testCount} test`;root.innerHTML='';
  if(!state.runs.length){root.innerHTML='<p class="muted small">No running activities stored.</p>';return;}
  state.runs.forEach(r=>{const d=new Date(r.date),row=document.createElement('label');row.className='manage-row';row.innerHTML=`<input class="manage-check" data-id="${r.id}" type="checkbox"><div><strong>${d.toLocaleDateString()} · ${d.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})}</strong><span>${(r.distanceM/1000).toFixed(2)} km · ${fmtTime(r.durationMs)} · ${r.pace} /km</span></div><span class="manage-badge ${isTestRun(r)?'test':'real'}">${isTestRun(r)?'TEST':'REAL'}</span>`;root.appendChild(row);});
}
function refreshDataViews(){save();renderHistory();renderStats();}
$('#toggleTest').onclick=()=>{const id=Number($('#toggleTest').dataset.id),r=state.runs.find(x=>x.id===id);if(!r)return;if(r.mode==='simulation'){alert('Simulation activities are always TEST and cannot be marked REAL.');return;}r.isTest=!isTestRun(r);refreshDataViews();openRunDetail(id);};
$('#markSelectedTest').onclick=()=>{const ids=selectedRunIds();if(!ids.length){alert('Select one or more activities first.');return;}state.runs.forEach(r=>{if(ids.includes(r.id))r.isTest=true;});refreshDataViews();};
$('#markSelectedReal').onclick=()=>{const ids=selectedRunIds();if(!ids.length){alert('Select one or more activities first.');return;}let blocked=0;state.runs.forEach(r=>{if(ids.includes(r.id)){if(r.mode==='simulation')blocked++;else r.isTest=false;}});refreshDataViews();if(blocked)alert(`${blocked} simulation activit${blocked===1?'y was':'ies were'} kept as TEST.`);};
$('#deleteSelected').onclick=()=>{const ids=selectedRunIds();if(!ids.length){alert('Select one or more activities first.');return;}if(!confirm(`Delete ${ids.length} selected activit${ids.length===1?'y':'ies'}? This cannot be undone.`))return;state.runs=state.runs.filter(r=>!ids.includes(r.id));$('#detailCard').classList.add('hidden');$('#summaryCard').classList.add('hidden');refreshDataViews();};
$('#resetRunningData').onclick=()=>{const n=state.runs.length;if(!n){alert('There is no running data to reset.');return;}if(!confirm(`Reset all ${n} running activit${n===1?'y':'ies'} and statistics? Coach sessions, RPE, weight and goal will be kept. Export a backup first if needed.`))return;state.runs=[];$('#detailCard').classList.add('hidden');$('#summaryCard').classList.add('hidden');refreshDataViews();alert('Running history and statistics were reset. Coach data was kept.');};
$('#closeDetail').onclick=()=>$('#detailCard').classList.add('hidden');
$('#deleteRun').onclick=()=>{const id=Number($('#deleteRun').dataset.id);if(!confirm('Delete this activity from RunStart? This cannot be undone.'))return;state.runs=state.runs.filter(r=>r.id!==id);$('#detailCard').classList.add('hidden');refreshDataViews();};
$('#deleteTests').onclick=()=>{const n=testRuns().length;if(!n){alert('No test activities to delete.');return;}if(!confirm(`Delete all ${n} TEST simulation activit${n===1?'y':'ies'}? Real GPS runs will be kept.`))return;state.runs=state.runs.filter(r=>!isTestRun(r));$('#summaryCard').classList.add('hidden');$('#detailCard').classList.add('hidden');refreshDataViews();};
function download(name,text,type='text/plain'){const blob=new Blob([text],{type}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),1200);}
function runToGpx(r){const pts=(r.points||[]).map(p=>`<trkpt lat="${p.lat}" lon="${p.lon}"><time>${new Date(p.t||r.date).toISOString()}</time></trkpt>`).join('');const label=isTestRun(r)?'TEST Simulation':'Run';return`<?xml version="1.0" encoding="UTF-8"?><gpx version="1.1" creator="RunStart V4.2" xmlns="http://www.topografix.com/GPX/1/1"><metadata><name>RunStart ${label} ${new Date(r.date).toISOString()}</name></metadata><trk><name>RunStart ${label}</name><trkseg>${pts}</trkseg></trk></gpx>`;}
$('#exportGpx').onclick=()=>{const r=state.runs.find(x=>x.id===Number($('#exportGpx').dataset.id));if(!r)return;download(`runstart-${new Date(r.date).toISOString().slice(0,16).replace(/[:T]/g,'-')}.gpx`,runToGpx(r),'application/gpx+xml');};

function runsSince(days){const cut=Date.now()-days*86400000;return realRuns().filter(r=>new Date(r.date).getTime()>=cut);}
function aggregate(runs){const distanceM=runs.reduce((a,r)=>a+(r.distanceM||0),0),durationMs=runs.reduce((a,r)=>a+(r.durationMs||0),0);return{count:runs.length,distanceM,durationMs,pace:fmtPace(distanceM,durationMs,20),longest:runs.reduce((m,r)=>Math.max(m,r.distanceM||0),0)};}
function statCard(label,value){return`<div class="stat-card"><span>${label}</span><strong>${value}</strong></div>`;}
function renderStats(){
  const clean=realRuns(),tests=testRuns(),all=aggregate(clean),d7=aggregate(runsSince(7)),d30=aggregate(runsSince(30));$('#statsGrid').innerHTML=[statCard('Runs · 7 days',d7.count),statCard('Distance · 7 days',`${(d7.distanceM/1000).toFixed(2)} km`),statCard('Runs · 30 days',d30.count),statCard('Distance · 30 days',`${(d30.distanceM/1000).toFixed(2)} km`),statCard('All-time distance',`${(all.distanceM/1000).toFixed(2)} km`),statCard('All-time time',fmtTime(all.durationMs)),statCard('Overall avg pace',`${all.pace} /km`),statCard('Longest run',`${(all.longest/1000).toFixed(2)} km`),statCard('TEST activities excluded',tests.length)].join('');
  const recent=clean.slice(0,8).reverse().map(r=>({...r,pm:paceMinutes(r.distanceM,r.durationMs)})).filter(r=>r.pm&&r.pm<60);const chart=$('#paceTrend');chart.innerHTML='';if(!recent.length){chart.innerHTML='<p class="muted small">No meaningful pace data yet.</p>';}else{const vals=recent.map(r=>r.pm),min=Math.min(...vals),max=Math.max(...vals),range=Math.max(.5,max-min);recent.forEach(r=>{const h=35+(max-r.pm)/range*110,wrap=document.createElement('div');wrap.className='pace-bar-wrap';wrap.innerHTML=`<b>${r.pace}</b><div class="pace-bar ${r.mode==='simulation'?'sim':''}" style="height:${h}px"></div><small>${new Date(r.date).toLocaleDateString([], {month:'short',day:'numeric'})}</small>`;chart.appendChild(wrap);});}
  const weeks=[];for(let i=5;i>=0;i--){const end=Date.now()-i*7*86400000,start=end-7*86400000,rs=clean.filter(r=>{const t=new Date(r.date).getTime();return t>=start&&t<end;}),a=aggregate(rs);weeks.push({label:`-${i}w`,km:a.distanceM/1000});}const maxKm=Math.max(.1,...weeks.map(w=>w.km));$('#weeklyChart').innerHTML=weeks.map(w=>`<div class="week-col"><b>${w.km.toFixed(1)}</b><div class="week-bar" style="height:${Math.max(4,w.km/maxKm*115)}px"></div><small>${w.label}</small></div>`).join('');
}
function switchTab(name){document.querySelectorAll('.tab').forEach(b=>b.classList.toggle('active',b.dataset.tab===name));document.querySelectorAll('.tab-panel').forEach(p=>p.classList.remove('active'));$(`#${name}Tab`).classList.add('active');if(name==='run'){setTimeout(()=>ensureLiveMap(),50);}if(name==='stats')renderStats();window.scrollTo({top:0,behavior:'smooth'});}
document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>switchTab(b.dataset.tab));
$('#startRun').onclick=startRun;$('#pauseRun').onclick=pauseRun;$('#finishRun').onclick=finishRun;
$('#exportData').onclick=()=>download(`runstart-backup-${new Date().toISOString().slice(0,10)}.json`,JSON.stringify(state,null,2),'application/json');
window.addEventListener('beforeunload',()=>{if(tracker.active)stopSource();});
if('serviceWorker' in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
renderCoach();renderHistory();renderStats();updateMetrics();renderLiveSplits();setMode('real');
