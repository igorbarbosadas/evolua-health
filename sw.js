/* MOVYA 12.88: cache versionado somente para a estrutura publica do PWA.
 * Dados e autenticacao do Supabase NUNCA sao interceptados.
 */
const CACHE='movya-public-shell-12-87';
const SHELL=['./index.html','./manifest.webmanifest','./assets/movya-icon-192.png','./assets/movya-icon-512.png','./assets/movya-maskable-512.png'];
self.addEventListener('install',event=>{
 event.waitUntil((async()=>{
  const cache=await caches.open(CACHE);
  // A página principal e o manifesto devem estar completos antes da ativação.
  await cache.addAll(SHELL.slice(0,2).map(path=>new Request(path,{cache:'reload'})));
  // Ícones podem falhar isoladamente sem impedir uma instalação válida.
  await Promise.allSettled(SHELL.slice(2).map(path=>cache.add(new Request(path,{cache:'reload'}))));
 })());
});
self.addEventListener('activate',event=>{
 event.waitUntil((async()=>{
  const names=await caches.keys();
  await Promise.all(names.filter(name=>name.startsWith('movya-public-shell-')&&name!==CACHE).map(name=>caches.delete(name)));
  await self.clients.claim();
 })());
});
self.addEventListener('fetch',event=>{
 const request=event.request;
 if(request.method!=='GET')return;
 const url=new URL(request.url);
 if(url.origin!==self.location.origin)return;
 const scope=new URL(self.registration.scope);
 if(!url.pathname.startsWith(scope.pathname))return;
 if(request.mode==='navigate'){
  event.respondWith((async()=>{
   try{
    const response=await fetch(request);
    if(response.ok&&response.type==='basic'){
     const cache=await caches.open(CACHE);
     await cache.put(new URL('./index.html',scope).toString(),response.clone()).catch(()=>{});
    }
    return response;
   }catch(error){
    const cached=await caches.match(new URL('./index.html',scope).toString());
    if(cached)return cached;
    throw error;
   }
  })());
  return;
 }
 // Only known public static files, never runtime media or API responses.
 const allowed=SHELL.map(item=>new URL(item,scope).pathname);
 if(allowed.includes(url.pathname)){
  event.respondWith((async()=>{
   try{const response=await fetch(request);if(response.ok){const cache=await caches.open(CACHE);await cache.put(request,response.clone()).catch(()=>{});}return response;}
   catch(error){const cached=await caches.match(request);if(cached)return cached;throw error;}
  })());
 }
});

// Apenas uma escolha explícita do usuário aplica a nova versão.
self.addEventListener('message',event=>{
 if(event.data&&event.data.type==='SKIP_WAITING')self.skipWaiting();
});
