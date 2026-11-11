/* Notifications de Sadeyen Stock — iPhone installé comme application */
import {initializeApp,getApps,getApp} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {getAuth,onAuthStateChanged} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {getDatabase,ref,set,get} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";
const config={apiKey:"AIzaSyALBRBlrxGObmY0vsvn5wnxWyvqi4DMGTA",authDomain:"sadeyen-stock.firebaseapp.com",databaseURL:"https://sadeyen-stock-default-rtdb.asia-southeast1.firebasedatabase.app",projectId:"sadeyen-stock",appId:"1:1055732708656:web:a162a5271ce093c20ec4f5"};
const vapid="BGuNRuNuuB3Ql70Q4NXocEpFKxL65uhxPE-lL5HerZzb9WdChq4Lfy_k37aJKBNvWnPnNYVgiGZLFda3R7egkxk", UID="usuiQcHmkMcLtDHbPvep19dURSQ2",PROFILE="sadeyen_tasks_profile_v1",LOCAL="sadeyen_personal_tasks_v1";
const app=getApps().length?getApp():initializeApp(config),auth=getAuth(app),db=getDatabase(app);
let user=null,registration=null,subscription=null;
const status=s=>{const p=document.getElementById("taskPushStatus");if(p)p.textContent=s};
const profile=()=>{try{return JSON.parse(localStorage.getItem(PROFILE))||{}}catch{return {}}};
const personal=()=>{try{return JSON.parse(localStorage.getItem(LOCAL))||{}}catch{return {}}};
const isStandalone=()=>window.navigator.standalone===true||window.matchMedia("(display-mode: standalone)").matches;
function base64bytes(b){const pad="=".repeat((4-b.length%4)%4),raw=atob((b+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function syncPersonal(){
 if(!user||!subscription)return;
 const deviceId=profile().deviceId;if(!deviceId)return;
 const tasks=personal(), reminders={};
 for(const [id,t]of Object.entries(tasks)){
  if(!t||!t.dueDate||!t.dueTime||!t.remind||t.remind==="none")continue;
  reminders[id]={id,dueDate:t.dueDate,dueTime:t.dueTime,remind:t.remind,repeat:t.repeat||"none",done:!!t.done,doneDates:t.doneDates||{}};
 }
 await set(ref(db,"sadeyen/personalReminders/"+deviceId),reminders);
}
async function pushSetup(){
 if(!user){alert("Connecte-toi d’abord au stock partagé Firebase.");return}
 if(!("serviceWorker" in navigator)||!("PushManager" in window)||!("Notification" in window)){alert("Les notifications push ne sont pas disponibles ici. Essaie l’application installée sur l’écran d’accueil d’un iPhone à jour.");return}
 if(!isStandalone()){alert("Sur iPhone, ouvre Sadeyen Stock dans Safari, puis Partager → Sur l’écran d’accueil. Lance ensuite l’application depuis son icône pour activer les rappels.");return}
 try{
  // On iOS the permission request must directly follow the button press.
  const permission=await Notification.requestPermission();
  if(permission!=="granted"){status("Notifications non autorisées. Vérifie Réglages → Notifications → Sadeyen Stock.");return}
  status("Configuration des rappels…");
  registration=registration||await navigator.serviceWorker.register("./sw.js",{scope:"./"});
  subscription=await registration.pushManager.getSubscription();
  if(!subscription)subscription=await registration.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:base64bytes(vapid)});
  const p=profile();
  const label=p.name||prompt("Quel est ton prénom sur ce téléphone ? (pour attribuer les rappels)","")||"";
  if(!p.deviceId)throw Error("Identifiant du téléphone introuvable : ouvre la rubrique Ma journée.");
  if(label!==p.name){p.name=label;localStorage.setItem(PROFILE,JSON.stringify(p));window.SadeyenTasks?.render()}
  const v=subscription.toJSON();
  await set(ref(db,"sadeyen/pushDevices/"+p.deviceId),{endpoint:v.endpoint,keys:v.keys,profile:label||"Équipe",userAgent:navigator.userAgent.slice(0,120),updatedAt:new Date().toISOString(),dailySummary:true});
  await syncPersonal();
  await registration.showNotification("Sadeyen Stock",{body:"Les notifications sont autorisées sur cet iPhone ✅",icon:"./icon.svg",tag:"sadeyen-test"});
  await checkBackend(true);
 }catch(err){status("Activation impossible : "+err.message);console.error(err)}
}
async function checkBackend(enabled=false){
 try{const d=await get(ref(db,"sadeyen/pushBackend/lastRun"));const ts=d.val(),fresh=ts&&Date.now()-new Date(ts).getTime()<3600000;
 status(fresh?"Notifications activées. Planificateur en fonctionnement.":enabled?"Notifications autorisées sur cet iPhone. L’envoi automatique nécessite encore l’activation du planificateur GitHub (voir README-RAPPELS.md).":"Notifications iPhone : planificateur non encore activé.");
 }catch{status(enabled?"Notifications autorisées. Activation du planificateur nécessaire pour recevoir les rappels application fermée.":"Notifications iPhone non configurées")}
}
document.getElementById("taskEnablePush").onclick=pushSetup;
window.addEventListener("sadeyen-personal-tasks",()=>syncPersonal().catch(console.warn));
window.addEventListener("sadeyen-profile-updated",async()=>{if(!user||!subscription)return;const p=profile(),node=ref(db,"sadeyen/pushDevices/"+p.deviceId);try{const v=subscription.toJSON();await set(node,{endpoint:v.endpoint,keys:v.keys,profile:p.name||"Équipe",updatedAt:new Date().toISOString(),dailySummary:true})}catch{}});
if("serviceWorker" in navigator)navigator.serviceWorker.register("./sw.js",{scope:"./"}).then(r=>{registration=r}).catch(e=>{console.warn("Service worker non disponible",e)});
onAuthStateChanged(auth,async u=>{user=u&&u.uid===UID?u:null;if(!user){status("Connecte-toi pour configurer les rappels.");return}if(!registration){try{registration=await navigator.serviceWorker.ready}catch{}}try{subscription=registration?await registration.pushManager.getSubscription():null}catch{}if(subscription){status("Notifications autorisées sur cet iPhone.");await syncPersonal();await checkBackend(true)}else status("Ajoute Sadeyen Stock à l’écran d’accueil, puis appuie sur Activer les rappels iPhone.")});
