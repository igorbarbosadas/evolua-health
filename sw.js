/* MOVYA 12.46: instalação sem cache de dados privados. */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', event => event.waitUntil(self.clients.claim()));
/* Do not intercept fetch requests: Supabase, config.js and HTML remain network-controlled. */
