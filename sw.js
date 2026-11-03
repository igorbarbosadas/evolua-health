/* MOVYA 13.09: cache versionado somente para a estrutura publica do PWA.
 * Dados e autenticacao do Supabase NUNCA sao interceptados.
 */
const CACHE='movya-public-shell-13-09';
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

// MOVYA Push: não tocar em requests Supabase nem no cache de dados do usuário.
self.addEventListener('push',event=>{
 let data={};try{data=event.data?event.data.json():{}}catch{}
 const type=['water','meal','application','custom'].includes(data.type)?data.type:'custom';
 const title='MOVYA · Lembrete';
 const messages={water:'Está na hora do seu lembrete de hidratação.',meal:'Está na hora de conferir sua refeição.',application:'Você tem um lembrete agendado. Abra o MOVYA para conferir.',custom:'Você tem um lembrete programado.'};
 event.waitUntil(self.registration.showNotification(title,{
  body:messages[type],icon:'./assets/movya-icon-192.png',badge:'./assets/movya-icon-192.png',
  tag:'movya-reminder-'+String(data.id||type).slice(0,90),renotify:false,
  data:{path:'./?movya=lembretes'},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const target=new URL('./?movya=lembretes',self.registration.scope).href;
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  for(const client of windows){if(new URL(client.url).origin===self.location.origin){await client.focus();client.postMessage({type:'MOVYA_OPEN_REMINDERS'});return}}
  await clients.openWindow(target);
 })());
});
