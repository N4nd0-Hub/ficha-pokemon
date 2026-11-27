/* Ficha Pokémon — funciona offline e abre mais rápido no celular.
   • Página (HTML): busca na rede primeiro; sem internet, usa a última cópia.
   • Scripts, estilos e imagens do site: já têm a versão no endereço (?v=),
     então servem da cópia guardada e atualizam em segundo plano.
   • Fontes do Google: guardadas depois do primeiro uso.
   Os dados das fichas ficam no save local do navegador, não aqui. */
const CACHE="ficha-v7-20261126u1";
const CORE=["./","./index.html","./manifest.webmanifest","./assets/icons/icon-192.png"];

self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

async function networkFirst(request){
  const cache=await caches.open(CACHE);
  try{
    const response=await fetch(request);
    if(response.ok)cache.put("./index.html",response.clone());
    return response;
  }catch(error){
    return (await cache.match("./index.html"))||(await cache.match("./"))||Response.error();
  }
}
async function staleWhileRevalidate(request){
  const cache=await caches.open(CACHE);
  const cached=await cache.match(request);
  const update=fetch(request).then(response=>{
    if(response.ok||response.type==="opaque")cache.put(request,response.clone());
    return response;
  }).catch(()=>cached);
  return cached||update;
}

self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  // checagem de versão nova: sempre da rede, sem guardar
  if(url.searchParams.has("hhvc"))return;
  if(request.mode==="navigate"&&url.origin===location.origin){event.respondWith(networkFirst(request));return;}
  if(url.origin===location.origin){event.respondWith(staleWhileRevalidate(request));return;}
  if(url.hostname==="fonts.googleapis.com"||url.hostname==="fonts.gstatic.com"){event.respondWith(staleWhileRevalidate(request));return;}
});
