/* MOVYA 13.22: cache versionado somente para a estrutura publica do PWA.
 * Dados e autenticacao do Supabase NUNCA sao interceptados.
 */
const CACHE='movya-public-shell-13-22';
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
 const messages={
  water:{title:'💧 Hora de se hidratar!',body:'Que tal um copo de água? 💦 Registre e avance na sua meta diária!'},
  meal:{title:'🍽️ Hora de se alimentar!',body:'Sua pausa chegou! 🥗 Aproveite e registre sua refeição no MOVYA.'},
  application:{title:'📅 Lembrete de aplicação',body:'Confira seu horário programado no MOVYA. ✅'},
  custom:{title:'🔔 Você tem um lembrete!',body:'Hora de conferir sua atividade no MOVYA. ✨'},
 };
 const msg=messages[type];
 event.waitUntil(self.registration.showNotification(msg.title,{
  body:msg.body,icon:'./assets/movya-icon-192.png',badge:'./assets/movya-icon-192.png',
  tag:'movya-reminder-'+String(data.id||type).slice(0,90),renotify:false,
  data:{reminderType:type,id:String(data.id||'').slice(0,90)},
 }));
});
self.addEventListener('notificationclick',event=>{
 event.notification.close();
 event.waitUntil((async()=>{
  const type=['water','meal','application','custom'].includes(event.notification.data?.reminderType)?event.notification.data.reminderType:'custom';
  const target=new URL('./?movya='+encodeURIComponent(type),self.registration.scope).href;
  const windows=await clients.matchAll({type:'window',includeUncontrolled:true});
  const inApp=windows.filter(c=>{
   try{const u=new URL(c.url);return u.origin===self.location.origin&&u.pathname.startsWith(new URL(self.registration.scope).pathname)}catch{return false}
  });
  if(inApp.length){
   const client=await inApp[0].focus();
   client?.postMessage({type:'MOVYA_OPEN_REMINDER',reminderType:type});
   return;
  }
  await clients.openWindow(target);
 })());
});
