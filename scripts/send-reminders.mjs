/* Sadeyen Stock — scheduled Web Push sender.
   Runs only in GitHub Actions, with credentials stored in repository secrets. */
import admin from "firebase-admin";
import webpush from "web-push";
import {createHash} from "node:crypto";

const JSON_CREDENTIAL=process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
const VAPID_PRIVATE=process.env.VAPID_PRIVATE_KEY;
const VAPID_PUBLIC="BGuNRuNuuB3Ql70Q4NXocEpFKxL65uhxPE-lL5HerZzb9WdChq4Lfy_k37aJKBNvWnPnNYVgiGZLFda3R7egkxk";
if(!JSON_CREDENTIAL||!VAPID_PRIVATE){console.error("Secrets FIREBASE_SERVICE_ACCOUNT_JSON and/or VAPID_PRIVATE_KEY not configured. No pushes sent.");process.exit(1)}
const credential=JSON.parse(JSON_CREDENTIAL);
admin.initializeApp({credential:admin.credential.cert(credential),databaseURL:"https://sadeyen-stock-default-rtdb.asia-southeast1.firebasedatabase.app"});
const database=admin.database();
webpush.setVapidDetails("mailto:domainesadeyen@gmail.com",VAPID_PUBLIC,VAPID_PRIVATE);

const HOUR=3600000,MINUTE=60000,now=Date.now(),local=new Date(now+4*HOUR),today=local.toISOString().slice(0,10),hour=local.getUTCHours(),minute=local.getUTCMinutes();
const isoDay=(d,n)=>{const x=new Date(d+"T12:00:00Z");x.setUTCDate(x.getUTCDate()+n);return x.toISOString().slice(0,10)};
const diff=(a,b)=>Math.round((new Date(a+"T12:00:00Z")-new Date(b+"T12:00:00Z"))/86400000);
const due=t=>String(t.dueDate||today),recurring=t=>t.repeat&&t.repeat!=="none";
function matches(t,day){
 if(day<due(t))return false;
 const delta=diff(day,due(t));
 if(t.repeat==="daily")return true;
 if(t.repeat==="weekly")return delta%7===0;
 if(t.repeat==="monthly"){const last=new Date(Number(day.slice(0,4)),Number(day.slice(5,7)),0).getDate();return Number(day.slice(8,10))===Math.min(Number(due(t).slice(8,10)),last)}
 return day===due(t);
}
function done(t,day){return recurring(t)?!!t.doneDates?.[day]:!!t.done}
function scheduledTime(t,day){
 if(!t.dueTime||t.remind==="none"||!t.remind)return null;
 const dueTime=Date.parse(day+"T"+t.dueTime+":00+04:00");
 if(!Number.isFinite(dueTime))return null;
 return dueTime-(t.remind==="before1d"?24*HOUR:t.remind==="before1h"?HOUR:0);
}
function occurrences(t){
 const days=[];for(let n=-3;n<=3;n++){const d=isoDay(today,n);if(matches(t,d))days.push(d)}return days
}
function taskAssigned(t,profile){return !t.assignee||t.assignee==="Équipe"||t.assignee==="Tout le monde"||t.assignee===profile}
function key(parts){return createHash("sha256").update(parts.join("|")).digest("hex").slice(0,42)}
async function sendOnce(deviceId,subscription,tag,title,body){
 const sentRef=database.ref("sadeyen/pushSent/"+key([deviceId,tag]));
 const claimed=await sentRef.transaction(old=>{if(old&&now-Number(old.at||0)<24*HOUR)return;return {at:now,tag}},undefined,false);
 if(!claimed.committed)return false;
 try{
  await webpush.sendNotification(subscription,JSON.stringify({title,body,tag,url:"./"}),{TTL:3600,urgency:"normal"});
  console.log("SENT",deviceId,tag);
  return true;
 }catch(error){
  console.warn("PUSH FAILED",deviceId,error.statusCode||"",error.message);
  if(error.statusCode===404||error.statusCode===410){await database.ref("sadeyen/pushDevices/"+deviceId).remove().catch(()=>{})}
  else await sentRef.remove().catch(()=>{});
  return false;
 }
}
async function main(){
 const [devSnap,taskSnap,privateSnap]=await Promise.all(["sadeyen/pushDevices","sadeyen/tasks","sadeyen/personalReminders"].map(path=>database.ref(path).get()));
 const devices=devSnap.val()||{},tasks=Object.values(taskSnap.val()||{}),privates=privateSnap.val()||{};
 let attempts=0;
 for(const [deviceId,device] of Object.entries(devices)){
  if(!device.endpoint||!device.keys?.p256dh||!device.keys?.auth)continue;
  const subscription={endpoint:device.endpoint,keys:device.keys},profile=device.profile||"Équipe";
  const assigned=tasks.filter(t=>t&&t.id&&taskAssigned(t,profile));
  for(const task of assigned){
   for(const day of occurrences(task)){
    if(done(task,day))continue;
    const scheduled=scheduledTime(task,day);
    if(scheduled===null||now<scheduled||now-scheduled>90*MINUTE)continue;
    const title=task.priority==="high"?"Priorité · Sadeyen Stock":"Rappel · Sadeyen Stock";
    const body=(task.title||"Tâche à effectuer")+(task.dueTime?" · "+task.dueTime:"");
    attempts+=await sendOnce(deviceId,subscription,"shared:"+task.id+":"+day+":"+task.remind,title,body)?1:0;
   }
  }
  for(const t of Object.values(privates[deviceId]||{})){
   if(!t?.id)continue;
   for(const day of occurrences(t)){
    if(done(t,day))continue;
    const scheduled=scheduledTime(t,day);
    if(scheduled===null||now<scheduled||now-scheduled>90*MINUTE)continue;
    attempts+=await sendOnce(deviceId,subscription,"personal:"+t.id+":"+day+":"+t.remind,"Rappel personnel · Sadeyen","Tu as une tâche personnelle prévue. Ouvre Sadeyen Stock.")?1:0;
   }
  }
  if(hour>=8&&hour<10&&device.dailySummary!==false){
   let count=0,urgent=0;
   for(const t of assigned){if(matches(t,today)&&!done(t,today)){count++;if(t.priority==="high")urgent++}}
   const p=Object.values(privates[deviceId]||{});
   for(const t of p){if(matches(t,today)&&!done(t,today))count++}
   if(count>0){
    const body=count+" tâche"+(count>1?"s":"")+" aujourd’hui"+(urgent?" · "+urgent+" prioritaire"+(urgent>1?"s":""):"");
    attempts+=await sendOnce(deviceId,subscription,"summary:"+today,"Bonjour ! Voici ta journée",body)?1:0;
   }
  }
 }
 await database.ref("sadeyen/pushBackend/lastRun").set(new Date(now).toISOString());
 console.log("Sadeyen reminders: devices=",Object.keys(devices).length,"shared tasks=",tasks.length,"sent=",attempts,"local=",local.toISOString());
}
await main();
