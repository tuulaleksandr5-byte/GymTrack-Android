'use strict';
// The credentials and access token never enter the renderer (web app).
// Public SoundCloud search requires a registered confidential app.
const API='https://api.soundcloud.com';
const AUTH='https://secure.soundcloud.com/oauth/token';
function soundCloudLink(input){
 try{
  const u=new URL(input);
  if(u.protocol!=='https:'||u.username||u.password||!['soundcloud.com','www.soundcloud.com'].includes(u.hostname))return null;
  if(u.pathname.split('/').filter(Boolean).length<2||u.href.length>1500)return null;
  return u.origin+u.pathname;
 }catch{return null;}
}
function cleanResult(raw,kind){
 if(!raw||typeof raw!=='object')return null;
 const link=soundCloudLink(raw.permalink_url||'');
 if(!link)return null;
 const user=raw.user&&typeof raw.user==='object'?raw.user:{};
 return {id:String(raw.urn||raw.id||'').slice(0,110),
  type:kind,
  title:String(raw.title||'Без названия').slice(0,170),
  artist:String(user.username||'Автор SoundCloud').slice(0,110),
  url:link,
  duration:Math.max(0,Math.min(86400000,Number(raw.duration)||0)),
  access:String(raw.access||'').slice(0,30),
  description:String(raw.description||'').slice(0,200)};
}
class SoundCloudApi {
 constructor(fetcher=fetch){this.fetcher=fetcher;this.clear();}
 clear(){this.credentials=null;this.token=null;this.refreshToken=null;this.expires=0;}
 hasCredentials(){return !!this.credentials;}
 setCredentials(id,secret){
  if(typeof id!=='string'||typeof secret!=='string'||id.trim().length<3||secret.trim().length<3||id.length>300||secret.length>400)throw Error('Проверь Client ID и Client Secret');
  this.credentials={id:id.trim(),secret:secret.trim()};this.token=null;this.refreshToken=null;this.expires=0;
 }
 async json(url,options){
  const response=await this.fetcher(url,{...options,signal:AbortSignal.timeout(11000),redirect:'error'});
  if(!response.ok){
   if(response.status===429)throw Error('SoundCloud ограничил число запросов. Попробуй позже.');
   if(response.status===401||response.status===403)throw Error('SoundCloud отказал в доступе. Проверь API-ключи.');
   throw Error('SoundCloud API вернул HTTP '+response.status);
  }
  return response.json();
 }
 async auth(force=false){
  if(!this.credentials)throw Error('Сначала подключи API SoundCloud');
  if(!force&&this.token&&Date.now()<this.expires-60000)return this.token;
  const {id,secret}=this.credentials;
  let json;
  if(this.refreshToken){
   try{
    json=await this.json(AUTH,{
      method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json'},
      body:new URLSearchParams({grant_type:'refresh_token',client_id:id,client_secret:secret,refresh_token:this.refreshToken}).toString()
    });
   }catch{this.refreshToken=null;}
  }
  if(!json){
   json=await this.json(AUTH,{
     method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded','Accept':'application/json','Authorization':'Basic '+Buffer.from(id+':'+secret).toString('base64')},
     body:'grant_type=client_credentials'
   });
  }
  if(typeof json.access_token!=='string'||!json.access_token)throw Error('SoundCloud не вернул access token');
  this.token=json.access_token;
  this.refreshToken=typeof json.refresh_token==='string'?json.refresh_token:null;
  this.expires=Date.now()+Math.min(7200,Math.max(120,Number(json.expires_in)||3600))*1000;
  return this.token;
 }
 async validate(id,secret){
  this.setCredentials(id,secret);
  try {await this.auth();return {connected:true};}
  catch(e){this.clear();return {error:e.message};}
 }
 async search(type,q){
  if(type!=='tracks'&&type!=='playlists')return {error:'Неизвестный тип поиска'};
  if(typeof q!=='string'||q.trim().length<2||q.length>160)return {error:'Введи от 2 до 160 символов'};
  try{
   const token=await this.auth();
   const url=new URL(API+'/'+type);
   url.searchParams.set('q',q.trim());
   url.searchParams.set('limit','20');
   url.searchParams.set('linked_partitioning','true');
   let data;
   try{data=await this.json(url.href,{headers:{'Authorization':'OAuth '+token,'Accept':'application/json; charset=utf-8'}});}
   catch(e){
    if(/access|401|403/.test(e.message)){
      this.token=null;const second=await this.auth(true);
      data=await this.json(url.href,{headers:{'Authorization':'OAuth '+second,'Accept':'application/json; charset=utf-8'}});
    }else throw e;
   }
   const items=Array.isArray(data)?data:Array.isArray(data.collection)?data.collection:[];
   return {results:items.map(x=>cleanResult(x,type)).filter(Boolean),query:q.trim(),type};
  }catch(e){return {error:e.message||'Ошибка подключения к SoundCloud'};}
 }
}
module.exports={SoundCloudApi,soundCloudLink,cleanResult};
