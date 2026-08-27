/* 离线缓存：部署到任意静态服务器后生效（file:// 下不注册） */
const CACHE = 'lifehub-v1';
const ASSETS = [
  './',
  './index.html',
  './css/style.css',
  './js/store.js',
  './js/theme.js',
  './js/finance.js',
  './js/baking.js',
  './js/planner.js',
  './js/media.js',
  './js/thinking.js',
  './js/copyedit.js',
  './js/sync.js',
  './js/app.js',
  './manifest.webmanifest',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(
    keys.filter(k => k !== CACHE).map(k => caches.delete(k))
  )).then(() => self.clients.claim()));
});

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(e.request, copy));
      return res;
    }).catch(() => caches.match('./index.html')))
  );
});
