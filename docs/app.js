const KEY='runstart-coach-state-v1';
const defaultState={
  week:1,
  profile:{heightCm:168,weightKg:80,goal:'Build consistency and complete an easy 5K'},
  sessions:[
    {id:1,day:'Session 1',plan:'5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null},
    {id:2,day:'Session 2',plan:'5 min walk + 8 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null},
    {id:3,day:'Session 3',plan:'5 min walk + 10 x (1 min easy run / 2 min walk) + 5 min walk',done:false,rpe:null}
  ]
};
function clone(x){return JSON.parse(JSON.stringify(x));}
function load(){try{const raw=localStorage.getItem(KEY);return raw?JSON.parse(raw):clone(defaultState);}catch{return clone(defaultState);}}
function save(){localStorage.setItem(KEY,JSON.stringify(state));}
let state=load();
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
  document.querySelectorAll('[data-done]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.done);s.done=x.checked;save();render();});
  document.querySelectorAll('[data-rpe]').forEach(x=>x.onchange=()=>{const s=state.sessions.find(s=>String(s.id)===x.dataset.rpe);s.rpe=x.value?Number(x.value):null;save();render();});
}
document.querySelector('#weightForm').onsubmit=e=>{e.preventDefault(); const kg=Number(document.querySelector('#weightInput').value); if(kg>=30&&kg<=300){state.profile.weightKg=kg;save();render();}};
if('serviceWorker' in navigator) window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));
render();
