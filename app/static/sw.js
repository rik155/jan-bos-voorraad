const CACHE='jan-bos-voorraad-v3';
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(['/static/style.css','/static/app.js','/static/janbos_logo.png']))));
self.addEventListener('fetch',event=>{if(event.request.method==='GET'){event.respondWith(fetch(event.request).catch(()=>caches.match(event.request)))}});
