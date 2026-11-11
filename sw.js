/* Sadeyen Stock — PWA et notifications */
const CACHE="sadeyen-pwa-2026-11-11-v1";
const SHELL=["./","./index.html","./tasks.js","./push.js","./manifest.webmanifest","./icon.svg"];
self.addEventListener("install",event=>{event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL).catch(()=>{})).then(()=>self.skipWaiting()))});
self.addEventListener("activate",event=>{event.waitUntil(Promise.all([caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith("sadeyen-pwa-")&&k!==CACHE).map(k=>caches.delete(k)))),self.clients.claim()]))});
self.addEventListener("fetch",event=>{
 if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;
 if(event.request.mode==="navigate"){event.respondWith(fetch(event.request).then(res=>{if(res.ok){const copy=res.clone();caches.open(CACHE).then(cache=>cache.put("./index.html",copy))}return res}).catch(()=>caches.match("./index.html")));return}
 event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)));
});
self.addEventListener("push",event=>{
 let data={title:"Sadeyen Stock",body:"Tu as un rappel dans ton planning.",url:"./"};try{const incoming=event.data?.json()||{};data={...data,...incoming}}catch{}
 const url=new URL("./",self.registration.scope).href;
 event.waitUntil(self.registration.showNotification(String(data.title||"Sadeyen Stock").slice(0,100),{body:String(data.body||"Tu as un rappel.").slice(0,220),icon:new URL("icon.svg",self.registration.scope).href,badge:new URL("icon.svg",self.registration.scope).href,tag:String(data.tag||"sadeyen-task"),data:{url},renotify:false}));
});
self.addEventListener("notificationclick",event=>{
 event.notification.close();event.waitUntil((async()=>{const all=await clients.matchAll({type:"window",includeUncontrolled:true});const base=new URL("./",self.registration.scope).href;for(const client of all){if(client.url.startsWith(base)){await client.focus();return}}await clients.openWindow(base)})());
});
