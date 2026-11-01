'use strict';
const tokenURL='https://secure.soundcloud.com/oauth/token';
const apiBase='https://api.soundcloud.com';
let cached={token:'',refresh:'',expires:0};
let inFlight=null;
const config=()=>({id:process.env.SOUNDCLOUD_CLIENT_ID||'',secret:process.env.SOUNDCLOUD_CLIENT_SECRET||''});
function isConfigured(){const c=config();return Boolean(c.id&&c.secret);}
async function getToken(){
 if(!isConfigured())throw Error('SoundCloud API не настроен. Добавь личные ключи через переменные окружения.');
 if(cached.token&&Date.now()<cached.expires-60000)return cached.token;
 if(inFlight)return inFlight;
 inFlight=(async()=>{
  const c=config();
  let params=new URLSearchParams({grant_type:'client_credentials'});
  let headers={'Authorization':'Basic '+Buffer.from(c.id+':'+c.secret).toString('base64'),'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'};
  if(cached.refresh){
   params=new URLSearchParams({grant_type:'refresh_token',client_id:c.id,client_secret:c.secret,refresh_token:cached.refresh});
   delete headers.Authorization;
  }
  const resp=await fetch(tokenURL,{method:'POST',headers,body:params,signal:AbortSignal.timeout(10000)});
  if(!resp.ok)throw Error('Ошибка авторизации SoundCloud: '+resp.status);
  const data=await resp.json();
  if(typeof data.access_token!=='string')throw Error('SoundCloud не вернул токен');
  cached={token:data.access_token,refresh:data.refresh_token||'',expires:Date.now()+Math.max(60,Number(data.expires_in)||3600)*1000};
  return cached.token;
 })().finally(()=>{inFlight=null});
 return inFlight;
}
function validateText(q){return typeof q==='string'?q.trim().slice(0,180):'';}
async function searchTracks(query){
 const q=validateText(query);
 if(!q)return {error:'Укажи название песни'};
 if(!isConfigured())return {error:'SoundCloud API не подключён: требуются Client ID и Client Secret. Пока используй поиск на сайте SoundCloud.',configured:false};
 try{
  const token=await getToken();
  const u=new URL('/tracks',apiBase);u.searchParams.set('q',q);u.searchParams.set('access','playable');u.searchParams.set('limit','20');
  const response=await fetch(u,{headers:{Authorization:'OAuth '+token,Accept:'application/json'},signal:AbortSignal.timeout(12000)});
  if(!response.ok)return {error:'SoundCloud вернул '+response.status};
  const body=await response.json();
  const raw=Array.isArray(body)?body:Array.isArray(body.collection)?body.collection:[];
  const tracks=raw.slice(0,20).filter(x=>x&&typeof x.permalink_url==='string'&&new URL(x.permalink_url).hostname.endsWith('soundcloud.com')).map(x=>({
   title:String(x.title||'Без названия').slice(0,140),
   artist:String(x.user?.username||'Исполнитель').slice(0,100),
   url:x.permalink_url,
   duration:Number(x.duration)||0,
   artwork:typeof x.artwork_url==='string'&&x.artwork_url.startsWith('https://')?x.artwork_url:null
  }));
  return {tracks,configured:true};
 }catch(e){return {error:'Не удалось выполнить поиск SoundCloud: '+String(e.message||e).slice(0,120)};}
}
module.exports={searchTracks,isConfigured,validateText};
