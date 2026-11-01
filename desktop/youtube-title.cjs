'use strict';
// Resolve public YouTube video metadata (not audio/video downloads).
// Never fetch a user-supplied hostname; only a canonical 11-character video ID.
function youtubeVideoId(value){
  if(typeof value!=='string'||value.length>1500)return null;
  let u;
  try{u=new URL(value.trim());}catch{return null;}
  if(u.protocol!=='https:'||u.username||u.password)return null;
  let id=null;
  if(['www.youtube.com','youtube.com','m.youtube.com','music.youtube.com'].includes(u.hostname)){
    if(u.pathname==='/watch')id=u.searchParams.get('v');
    else if(/^\/(shorts|live|embed)\/[a-zA-Z0-9_-]{11}\/?$/.test(u.pathname))id=u.pathname.split('/')[2];
  }else if(u.hostname==='youtu.be'&&/^\/[a-zA-Z0-9_-]{11}\/?$/.test(u.pathname)){
    id=u.pathname.slice(1).replace(/\/$/,'');
  }
  return typeof id==='string'&&/^[A-Za-z0-9_-]{11}$/.test(id)?id:null;
}
async function lookupYoutubeTitle(value,request=fetch){
  const id=youtubeVideoId(value);
  if(!id)return {error:'Вставь ссылку на одно видео YouTube или напиши название песни вручную.'};
  const canonical='https://www.youtube.com/watch?v='+id;
  const endpoint='https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(canonical);
  try{
    const res=await request(endpoint,{method:'GET',signal:AbortSignal.timeout(8000),redirect:'error',headers:{'Accept':'application/json'}});
    if(!res.ok)return {error:'Не удалось получить название видео. Напиши название песни вручную.'};
    const json=await res.json();
    const title=typeof json.title==='string'?json.title.trim().slice(0,180):'';
    const author=typeof json.author_name==='string'?json.author_name.trim().slice(0,100):'';
    if(!title)return {error:'У видео нет доступного названия. Введи его вручную.'};
    return {title,author};
  }catch{
    return {error:'Название видео недоступно. Проверь интернет или введи название вручную.'};
  }
}
module.exports={youtubeVideoId,lookupYoutubeTitle};
