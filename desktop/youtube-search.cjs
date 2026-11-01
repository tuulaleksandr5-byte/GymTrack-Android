'use strict';
/** Strictly read public YouTube video metadata, never audio. */
const ID_PATTERN=/^[A-Za-z0-9_-]{11}$/;
const HOSTS=new Set(['youtube.com','www.youtube.com','m.youtube.com','music.youtube.com','youtu.be']);
function extractVideoId(value){
  if(typeof value!=='string'||value.length>1200)return null;
  let u;
  try{u=new URL(value.trim());}catch{return null;}
  if(u.protocol!=='https:'||!HOSTS.has(u.hostname)||u.username||u.password||u.port)return null;
  let id=null;
  if(u.hostname==='youtu.be'){
    const bits=u.pathname.split('/').filter(Boolean);
    if(bits.length===1)id=bits[0];
  }else if(u.pathname==='/watch')id=u.searchParams.get('v');
  else{
    const bits=u.pathname.split('/').filter(Boolean);
    if(bits.length===2&&['shorts','live','embed'].includes(bits[0]))id=bits[1];
  }
  return id && ID_PATTERN.test(id)?id:null;
}
function soundCloudSearchUrl(value){
 const query=typeof value==='string'?value.trim():'';
 if(!query||query.length>220)return null;
 return 'https://soundcloud.com/search/sounds?q='+encodeURIComponent(query);
}
async function getYouTubeTitle(value,requestFetch=fetch){
  const id=extractVideoId(value);
  if(!id)return {error:'invalid_url'};
  const canonical='https://www.youtube.com/watch?v='+id;
  const endpoint='https://www.youtube.com/oembed?format=json&url='+encodeURIComponent(canonical);
  try{
    const response=await requestFetch(endpoint,{redirect:'error',signal:AbortSignal.timeout(8500)});
    if(!response.ok)return {error:'not_found'};
    const raw=await response.text();
    if(raw.length>40000)return {error:'invalid_response'};
    const data=JSON.parse(raw);
    const title=typeof data.title==='string'?data.title.trim().slice(0,220):'';
    return title?{title}:{error:'no_title'};
  }catch(e){return {error:'network_error'};}
}
module.exports={extractVideoId,soundCloudSearchUrl,getYouTubeTitle};
