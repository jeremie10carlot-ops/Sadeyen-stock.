/* Sadeyen Stock — organisation, November 2026 */
import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getDatabase,ref,onValue,set,remove} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const config={apiKey:"AIzaSyALBRBlrxGObmY0vsvn5wnxWyvqi4DMGTA",authDomain:"sadeyen-stock.firebaseapp.com",databaseURL:"https://sadeyen-stock-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"sadeyen-stock",appId:"1:1055732708656:web:a162a5271ce093c20ec4f5"};
const app=getApps().length?getApp():initializeApp(config);
const auth=getAuth(app), database=getDatabase(app), ROOT="sadeyen/tasks";
const LOCAL="sadeyen_personal_tasks_v1",OUTBOX="sadeyen_tasks_outbox_v1",PROFILE="sadeyen_tasks_profile_v1",PUSHDEVICE="sadeyen_push_device_v1";
const el=id=>document.getElementById(id), e=s=>String(s??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const fromStore=(k,def)=>{try{return JSON.parse(localStorage.getItem(k))||def}catch{return def}};
const store=(k,v)=>{try{localStorage.setItem(k,JSON.stringify(v))}catch(err){console.warn("Stockage local indisponible",err)}};
const personal=fromStore(LOCAL,{}), queue=fromStore(OUTBOX,{});
let shared={},connected=false,uid=null,unsubscribe=null,view="today",scopeFilter="all",selectedDay=null,expanded={},activeId=null,profile=fromStore(PROFILE,{name:"",deviceId:""}),busy=false;
if(!profile.deviceId){profile.deviceId="phone_"+Math.random().toString(36).slice(2)+Date.now().toString(36);store(PROFILE,profile)}
const nowReunion=()=>{const parts=new Intl.DateTimeFormat("en-US",{timeZone:"Indian/Reunion",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const x={};for(const p of parts)x[p.type]=p.value;return x.year+"-"+x.month+"-"+x.day};
const shift=(date,n)=>{const d=new Date(date+"T12:00:00Z");d.setUTCDate(d.getUTCDate()+n);return d.toISOString().slice(0,10)};
const diff=(a,b)=>Math.round((new Date(a+"T12:00:00Z")-new Date(b+"T12:00:00Z"))/86400000);
const fmt=d=>{if(!d)return "Sans date";const p=d.split("-");return p[2]+"/"+p[1]+"/"+p[0]};
const isRepeating=t=>t.repeat&&t.repeat!=="none";
const due=t=>t.dueDate||nowReunion();
const validOcc=(t,d)=>{if(d<due(t))return false;const delta=diff(d,due(t));if(t.repeat==="daily")return true;if(t.repeat==="weekly")return delta%7===0;if(t.repeat==="monthly"){const a=Number(due(t).slice(8,10)),last=new Date(Number(d.slice(0,4)),Number(d.slice(5,7)),0).getDate();return Number(d.slice(8,10))===Math.min(a,last)}return d===due(t)};
const occurrenceDone=(t,d)=>isRepeating(t)?!!(t.doneDates&&t.doneDates[d]):!!t.done;
const checkDone=(t,d,id)=>!!(t.checkDone&&t.checkDone[isRepeating(t)?d:"once"]&&t.checkDone[isRepeating(t)?d:"once"][id]);
function entries(){
 const today=nowReunion(),from=view==="week"?today:view==="today"?today:null,to=view==="week"?shift(today,6):today;
 const tasks=[...Object.values(personal),...Object.values(shared)].filter(x=>x&&x.id&&(!queue[x.id]||queue[x.id].op!=="delete"));
 const result=[];
 for(const t of tasks){
  if(scopeFilter!=="all"&&t.scope!==scopeFilter)continue;
  let days=[];
  if(isRepeating(t)){
   if(view==="week"){for(let n=0;n<7;n++){let d=shift(from,n);if(validOcc(t,d))days.push(d)}}
   else if(view==="today"){if(validOcc(t,today))days=[today]}
   else if(view==="done"){const dates=Object.keys(t.doneDates||{}).filter(d=>t.doneDates[d]);days=dates.slice(-30)}
   else{for(let n=0;n<60;n++){const d=shift(today,n);if(validOcc(t,d)){days=[d];break}}}
  }else{
   const d=due(t);
   if(view==="today"&&d<=today&&!t.done)days=[d];
   if(view==="week"&&d<=to&&!t.done)days=[d];
   if(view==="all"&&!t.done)days=[d];
   if(view==="done"&&t.done)days=[d];
  }
  for(const d of days){if(view!=="done"&&occurrenceDone(t,d))continue;result.push({task:t,date:d})}
 }
 result.sort((a,b)=>a.date.localeCompare(b.date)||({"high":0,"normal":1,"low":2}[a.task.priority||"normal"]-({"high":0,"normal":1,"low":2}[b.task.priority||"normal"]))||a.task.title.localeCompare(b.task.title,"fr"));
 return result.slice(0,120);
}
function allTasks(){return [...Object.values(personal),...Object.values(shared)].filter(x=>x&&x.id)}
function summary(){
 const today=nowReunion(),dueToday=allTasks().filter(t=>validOcc(t,today)&&!occurrenceDone(t,today)),overdue=allTasks().filter(t=>!isRepeating(t)&&due(t)<today&&!t.done),urgent=[...dueToday,...overdue].filter(t=>t.priority==="high");
 el("taskSummary").innerHTML='<div class="task-summary"><div><strong>'+ (dueToday.length+overdue.length) +'</strong><span>à faire aujourd’hui</span></div><div><strong>'+urgent.length+'</strong><span>prioritaires</span></div><div><strong>'+ allTasks().filter(t=>t.scope==="shared").length +'</strong><span>partagées</span></div></div>';
 const stamp=fromStore("sadeyen_daily_digest_v1","");if(stamp!==today){store("sadeyen_daily_digest_v1",today);el("taskGreeting").textContent=(dueToday.length+overdue.length===0?"Tout est à jour pour aujourd’hui ✨":"Aujourd’hui : "+(dueToday.length+overdue.length)+" tâche(s), dont "+urgent.length+" prioritaire(s).")}
 else el("taskGreeting").textContent="Ta journée et ton équipe, au même endroit.";
}
function render(){
 summary();
 const labels={today:"Aujourd’hui",week:"7 jours",all:"À venir",done:"Terminées"};
 el("taskTabs").innerHTML=Object.keys(labels).map(k=>'<button type="button" data-view="'+k+'" class="'+(view===k?"active":"")+'">'+labels[k]+'</button>').join("");
 el("taskFilters").innerHTML=[["all","Toutes"],["shared","Équipe"],["personal","Privées"]].map(x=>'<button type="button" data-scope="'+x[0]+'" class="'+(scopeFilter===x[0]?"active":"")+'">'+x[1]+'</button>').join("");
 el("taskProfile").textContent=profile.name||"Définir mon prénom";
 el("taskSync").textContent=connected?"Tâches communes synchronisées":"Tâches communes : connexion Firebase nécessaire";
 const a=entries();
 el("taskList").innerHTML=a.length?a.map(({task:t,date:d})=>{
  const steps=t.checklist||[],count=steps.filter(s=>checkDone(t,d,s.id)).length,priority=t.priority==="high"?'<span class="task-priority">Prioritaire</span>':"";
  const link=t.eventId?eventName(t.eventId):"";
  const remind=t.remind&&t.remind!=="none"&&t.dueTime?' · 🔔 '+t.dueTime:"";
  const open=expanded[t.id+"@"+d];
  const details=open?'<div class="task-details">'+(t.note?'<p>'+e(t.note)+'</p>':"")+(steps.length?'<div class="task-checklist">'+steps.map(s=>'<label><input type="checkbox" data-action="step" data-id="'+e(t.id)+'" data-date="'+d+'" data-step="'+e(s.id)+'" '+(checkDone(t,d,s.id)?"checked":"")+'> <span>'+e(s.text)+'</span></label>').join("")+'</div>':"")+'<div class="task-actions"><button type="button" data-action="edit" data-id="'+e(t.id)+'">Modifier</button><button type="button" class="danger" data-action="delete" data-id="'+e(t.id)+'">Supprimer</button></div></div>':"";
  const badge=t.scope==="personal"?"Privée":(t.assignee||"Équipe");
  return '<div class="task-card"><div class="task-main"><button type="button" class="task-tick" aria-label="Terminer" data-action="done" data-id="'+e(t.id)+'" data-date="'+d+'">○</button><button type="button" class="task-body" data-action="expand" data-id="'+e(t.id)+'" data-date="'+d+'"><strong>'+e(t.title)+'</strong><span>'+fmt(d)+(t.dueTime?" · "+e(t.dueTime):"")+remind+(link?" · "+e(link):"")+'</span><span class="task-tags"><em>'+e(badge)+'</em>'+(isRepeating(t)?'<em>↻ '+e({daily:"Chaque jour",weekly:"Chaque semaine",monthly:"Chaque mois"}[t.repeat])+'</em>':"")+(steps.length?'<em>'+count+'/'+steps.length+' étapes</em>':"")+priority+'</span></button><button type="button" class="task-more" aria-label="Voir la tâche" data-action="expand" data-id="'+e(t.id)+'" data-date="'+d+'">⌄</button></div>'+details+'</div>';
 }).join(""):'<div class="empty task-empty">Aucune tâche ici. Profite-en, ou ajoute ta prochaine action !</div>';
 updateBadge();
}
function updateBadge(){
 const count=allTasks().filter(t=>{const today=nowReunion();return validOcc(t,today)&&!occurrenceDone(t,today)}).length;
 if("setAppBadge" in navigator){if(count)navigator.setAppBadge(count).catch(()=>{});else navigator.clearAppBadge().catch(()=>{})}
}
function eventName(id){try{return (db.events||[]).find(x=>String(x.id)===String(id))?.name||""}catch{return ""}}
function find(id){return personal[id]||shared[id]||null}
function write(t){
 t.updatedAt=new Date().toISOString();
 if(t.scope==="personal"){personal[t.id]=t;store(LOCAL,personal);if(shared[t.id])enqueue(t.id,"delete");}
 else{shared[t.id]=t;enqueue(t.id,"set",t);delete personal[t.id];store(LOCAL,personal)}
 render();
}
function enqueue(id,op,value){queue[id]={op,value};store(OUTBOX,queue);flush()}
async function flush(){
 if(busy||!connected)return;busy=true;
 try{for(const id of Object.keys(queue)){const entry=queue[id];if(!entry)continue;const path=ref(database,ROOT+"/"+id);try{if(entry.op==="delete")await remove(path);else await set(path,entry.value);delete queue[id];store(OUTBOX,queue)}catch(ex){el("taskSync").textContent="Modifications en attente : "+ex.message;break}}}finally{busy=false}
}
function modify(id,fn){const t=find(id);if(!t)return;const next=structuredClone?structuredClone(t):JSON.parse(JSON.stringify(t));fn(next);write(next)}
function toggleDone(id,date){modify(id,t=>{if(isRepeating(t)){t.doneDates=t.doneDates||{};t.doneDates[date]=!t.doneDates[date]}else t.done=!t.done})}
function toggleStep(id,date,sid,checked){modify(id,t=>{const k=isRepeating(t)?date:"once";t.checkDone=t.checkDone||{};t.checkDone[k]=t.checkDone[k]||{};t.checkDone[k][sid]=checked})}
function removeTask(id){const t=find(id);if(!t||!confirm("Supprimer cette tâche ?"))return;if(t.scope==="personal"){delete personal[id];store(LOCAL,personal)}else{delete shared[id];enqueue(id,"delete")}render()}
function localTodayInput(){return nowReunion()}
function openForm(id){
 const t=id?find(id):null;activeId=id||null;
 const dialog=el("taskDialog"),form=el("taskForm");
 el("taskDialogTitle").textContent=t?"Modifier la tâche":"Nouvelle tâche";
 const events=(typeof db!=="undefined"&&Array.isArray(db.events)?db.events:[]).slice().sort((a,b)=>String(a.date).localeCompare(String(b.date)));
 form.innerHTML='<label>À faire <input name="title" required maxlength="120" placeholder="Ex. Préparer les nappes" value="'+e(t?.title||"")+'"></label>'
 +'<div class="task-form-grid"><label>Date <input name="dueDate" type="date" required value="'+e(t?.dueDate||localTodayInput())+'"></label><label>Heure (facultatif) <input name="dueTime" type="time" value="'+e(t?.dueTime||"")+'"></label></div>'
 +'<div class="task-form-grid"><label>Priorité <select name="priority">'+options([["normal","Normale"],["high","Urgente"],["low","Faible"]],t?.priority||"normal")+'</select></label><label>Répétition <select name="repeat">'+options([["none","Une fois"],["daily","Chaque jour"],["weekly","Chaque semaine"],["monthly","Chaque mois"]],t?.repeat||"none")+'</select></label></div>'
 +'<div class="task-form-grid"><label>Visibilité <select name="scope" id="taskScope">'+options([["shared","Partagée avec l’équipe"],["personal","Privée, sur cet iPhone"]],t?.scope||"shared")+'</select></label><label>Responsable <input name="assignee" maxlength="40" list="assigneeNames" value="'+e(t?.assignee||"Équipe")+'" placeholder="Équipe / Prénom"><datalist id="assigneeNames"><option value="Équipe"><option value="'+e(profile.name||"Moi")+'"></datalist></label></div>'
 +'<label>Rappel <select name="remind">'+options([["none","Aucun"],["at","À l’heure prévue"],["before1h","1 heure avant"],["before1d","1 jour avant"]],t?.remind||"none")+'</select></label>'
 +'<label>Événement associé (facultatif) <select name="eventId"><option value="">Aucun événement</option>'+events.map(ev=>'<option value="'+e(String(ev.id))+'" '+(String(ev.id)===String(t?.eventId)?"selected":"")+'>'+e(fmt(String(ev.date).slice(0,10))+" · "+(ev.name||"Événement"))+'</option>').join("")+'</select></label>'
 +'<label>Notes <textarea name="note" rows="2" placeholder="Informations utiles…">'+e(t?.note||"")+'</textarea></label>'
 +'<div class="task-step-title"><strong>Sous-tâches</strong><button type="button" id="taskAddStep">+ Ajouter</button></div><div id="taskEditSteps"></div>'
 +'<div class="task-dialog-actions"><button type="button" id="taskCancel">Annuler</button><button class="primary" type="submit">Enregistrer</button></div>';
 (t?.checklist||[]).forEach(s=>appendStep(s.text,s.id));
 el("taskAddStep").onclick=()=>appendStep();
 el("taskCancel").onclick=()=>dialog.close();
 form.onsubmit=async ev=>{
  ev.preventDefault();const d=new FormData(form),name=String(d.get("title")||"").trim();if(!name)return;
  const scope=String(d.get("scope"));if(scope==="shared"&&!connected){if(!confirm("Firebase n’est pas connecté. Cette tâche restera en attente de synchronisation. Continuer ?"))return}
  const steps=[...form.querySelectorAll(".task-edit-step")].map(row=>({id:row.dataset.stepid||"s_"+Math.random().toString(36).slice(2),text:row.querySelector("input").value.trim()})).filter(x=>x.text);
  const old=t||{},newTask={...old,id:t?.id||"t_"+Date.now()+"_"+Math.random().toString(36).slice(2),title:name,dueDate:d.get("dueDate"),dueTime:d.get("dueTime"),priority:d.get("priority"),repeat:d.get("repeat"),scope,assignee:String(d.get("assignee")||"Équipe").trim()||"Équipe",remind:d.get("remind"),eventId:d.get("eventId"),note:String(d.get("note")||"").trim(),checklist:steps,doneDates:old.doneDates||{},checkDone:old.checkDone||{},done:old.done||false,createdAt:old.createdAt||new Date().toISOString()};
  if(t&&t.scope!==scope){if(t.scope==="shared"){delete shared[t.id];enqueue(t.id,"delete")}else{delete personal[t.id];store(LOCAL,personal)}}
  write(newTask);dialog.close();
 };
 dialog.showModal();
}
function appendStep(text="",id=""){const row=document.createElement("div");row.className="task-edit-step";if(id)row.dataset.stepid=id;row.innerHTML='<input maxlength="110" aria-label="Sous-tâche" placeholder="Ex. Nettoyer les tables" value="'+e(text)+'"><button type="button" aria-label="Supprimer cette sous-tâche">×</button>';row.querySelector("button").onclick=()=>row.remove();el("taskEditSteps").appendChild(row)}
function options(arr,current){return arr.map(([v,label])=>'<option value="'+v+'" '+(v===current?"selected":"")+'>'+e(label)+'</option>').join("")}
el("taskTabs").addEventListener("click",ev=>{const b=ev.target.closest("[data-view]");if(!b)return;view=b.dataset.view;render()});
el("taskFilters").addEventListener("click",ev=>{const b=ev.target.closest("[data-scope]");if(!b)return;scopeFilter=b.dataset.scope;render()});
el("taskList").addEventListener("click",ev=>{const b=ev.target.closest("[data-action]");if(!b||b.dataset.action==="step")return;const {action,id,date}=b.dataset;if(action==="done")toggleDone(id,date);if(action==="expand"){const k=id+"@"+date;expanded[k]=!expanded[k];render()}if(action==="edit")openForm(id);if(action==="delete")removeTask(id)});
el("taskList").addEventListener("change",ev=>{const b=ev.target.closest('[data-action="step"]');if(b)toggleStep(b.dataset.id,b.dataset.date,b.dataset.step,b.checked)});
el("taskNew").onclick=()=>openForm();
el("taskProfileButton").onclick=()=>{const name=prompt("Quel prénom doit apparaître sur les tâches qui te sont attribuées ?",profile.name||"");if(name===null)return;profile.name=name.trim().slice(0,40);store(PROFILE,profile);render();};
window.SadeyenTasks={open:()=>openForm(),render};
try{onAuthStateChanged(auth,user=>{
 connected=!!user&&user.uid==="usuiQcHmkMcLtDHbPvep19dURSQ2";uid=connected?user.uid:null;
 if(unsubscribe){unsubscribe();unsubscribe=null}
 if(connected){
  unsubscribe=onValue(ref(database,ROOT),snap=>{const raw=snap.val()||{};shared=raw&&typeof raw==="object"&&!Array.isArray(raw)?raw:{};for(const [id,item]of Object.entries(queue)){if(item.op==="delete")delete shared[id];else if(item.value)shared[id]=item.value}render();flush()},err=>{connected=false;el("taskSync").textContent="Impossible de charger les tâches : "+err.message});
 }else shared={};
 render();
})}catch(ex){el("taskSync").textContent="Mode personnel uniquement : "+ex.message}
render();
