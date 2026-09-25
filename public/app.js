let state;
async function api(url, options={}) { const r = await fetch(url,{headers:{'Content-Type':'application/json'},...options}); if(!r.ok) throw new Error('Request failed'); return r.json(); }
function render(){
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
  document.querySelectorAll('[data-done]').forEach(x=>x.onchange=async()=>{state=await api('/api/session/'+x.dataset.done,{method:'POST',body:JSON.stringify({done:x.checked})});render();});
  document.querySelectorAll('[data-rpe]').forEach(x=>x.onchange=async()=>{state=await api('/api/session/'+x.dataset.rpe,{method:'POST',body:JSON.stringify({rpe:x.value?Number(x.value):null})});render();});
}
async function boot(){ state=await api('/api/state'); render(); }
document.querySelector('#weightForm').onsubmit=async e=>{e.preventDefault(); const kg=Number(document.querySelector('#weightInput').value); state=await api('/api/weight',{method:'POST',body:JSON.stringify({kg})}); render();};
if('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js');
boot();
