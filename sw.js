// Service worker: guarda os arquivos do app para funcionar offline.
// Os DADOS do usuário não passam por aqui (ficam no IndexedDB do navegador).
// Ao publicar uma nova versão, altere CACHE_VERSION para os usuários receberem a atualização.
var CACHE_VERSION='calculadora-trader-v7.2.7';
var FILES=[
  './',
  'index.html',
  'manifest.webmanifest',
  'css/app.css',
  'js/vendor/qrcode.js',
  'js/vendor/pdf.min.js',
  'js/vendor/pdf.worker.min.js',
  'js/util.js',
  'js/state.js',
  'js/fiscal.js',
  'js/pdf-parser.js',
  'js/reports.js',
  'js/charts.js',
  'js/performance.js',
  'js/cash.js',
  'js/storage.js',
  'js/ui.js',
  'js/app.js',
  'icons/icon-192.png',
  'icons/icon-512.png',
  'icons/icon-maskable-512.png'
];

// Baixa cada arquivo direto do servidor (cache:'reload'), ignorando o cache HTTP
// do navegador. Sem isso, uma atualização podia misturar arquivos da versão
// anterior (o GitHub Pages manda o navegador guardar arquivos por 10 min).
self.addEventListener('install',function(ev){
  ev.waitUntil(caches.open(CACHE_VERSION).then(function(c){
    return Promise.all(FILES.map(function(url){
      return fetch(new Request(url,{cache:'reload'})).then(function(res){
        if(!res.ok)throw new Error('Falha ao baixar '+url+' ('+res.status+')');
        return c.put(url,res);
      });
    }));
  }));
});
self.addEventListener('activate',function(ev){
  ev.waitUntil(caches.keys().then(function(keys){
    return Promise.all(keys.filter(function(k){return k!==CACHE_VERSION}).map(function(k){return caches.delete(k)}));
  }).then(function(){return self.clients.claim()}));
});
self.addEventListener('message',function(ev){
  if(ev.data&&ev.data.type==='skip-waiting')self.skipWaiting();
});
// Cache primeiro (offline); só arquivos do próprio app.
self.addEventListener('fetch',function(ev){
  var req=ev.request;
  if(req.method!=='GET'||new URL(req.url).origin!==location.origin)return;
  ev.respondWith(caches.match(req,{ignoreSearch:true}).then(function(hit){
    return hit||fetch(req);
  }));
});
