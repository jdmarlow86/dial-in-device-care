const CACHE_NAME="dial-in-device-care-v1";
const CACHE_PREFIX="dial-in-device-care-";
const APP_SHELL=["./","./index.html","./styles.css","./app.js","./manifest.webmanifest","./assets/icon.svg"];
let cacheEnabled=true;
self.addEventListener("install",event=>event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL)).then(()=>self.skipWaiting())));
self.addEventListener("activate",event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith(CACHE_PREFIX)&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim())));
self.addEventListener("message",event=>{if(event.data?.type==="DEVICE_CARE_DISABLE_CACHE"){cacheEnabled=false;event.ports?.[0]?.postMessage({ok:true});}});
self.addEventListener("fetch",event=>{if(event.request.method!=="GET"||new URL(event.request.url).origin!==self.location.origin)return;if(!cacheEnabled){event.respondWith(fetch(event.request));return;}event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{if(response.ok){const copy=response.clone();caches.open(CACHE_NAME).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match("./index.html"))));});
