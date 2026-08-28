const CACHE="dawami-simple-v5-0";
const ASSETS=["./","./index.html","./simple.css?v=5.0","./core.js?v=5.0","./simple.js?v=5.0","./manifest.webmanifest?v=5.0","./icon.svg","./holidays-om.json"];
self.addEventListener("install",e=>e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ASSETS)).then(()=>self.skipWaiting())));
self.addEventListener("activate",e=>e.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener("fetch",e=>{
 if(e.request.method!=="GET"||new URL(e.request.url).origin!==location.origin)return;
 if(new URL(e.request.url).pathname.endsWith("/holidays-om.json")){e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x));return r}).catch(()=>caches.match(e.request)));return}\n if(e.request.mode==="navigate"){e.respondWith(fetch(e.request).then(r=>{const x=r.clone();caches.open(CACHE).then(c=>c.put("./index.html",x));return r}).catch(()=>caches.match("./index.html")));return}
 e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{if(r.ok){const x=r.clone();caches.open(CACHE).then(c=>c.put(e.request,x))}return r})))
});
self.addEventListener("notificationclick",e=>{e.notification.close();e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>list[0]?list[0].focus():clients.openWindow("./")))})