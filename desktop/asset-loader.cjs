'use strict';
// Reliable file handler for gymtrack://app/.
// Unlike net.fetch(file://...), reading directly from bundled assets works
// the same way inside an installed or portable Windows build.
const fs=require('node:fs/promises');
const path=require('node:path');
const MIME=Object.freeze({
  '.html':'text/html; charset=utf-8',
  '.htm':'text/html; charset=utf-8',
  '.css':'text/css; charset=utf-8',
  '.js':'text/javascript; charset=utf-8',
  '.json':'application/json; charset=utf-8',
  '.gif':'image/gif',
  '.png':'image/png',
  '.jpg':'image/jpeg',
  '.jpeg':'image/jpeg',
  '.svg':'image/svg+xml',
  '.webp':'image/webp',
  '.mp3':'audio/mpeg',
  '.m4a':'audio/mp4',
  '.wav':'audio/wav',
  '.ogg':'audio/ogg'
});
function errorResponse(status,message){
  return new Response(message,{status,headers:{'Content-Type':'text/plain; charset=utf-8','Cache-Control':'no-store'}});
}
function createAssetHandler(folder){
  const root=path.resolve(folder);
  return async function handleAsset(request){
    let url;
    try{url=new URL(request.url);}
    catch{return errorResponse(400,'Invalid URL');}
    if(url.protocol!=='gymtrack:'||url.host!=='app')return errorResponse(403,'Forbidden');
    let requested;
    try{requested=decodeURIComponent(url.pathname);}
    catch{return errorResponse(400,'Invalid path encoding');}
    if(!requested.startsWith('/')||requested.includes('\\')||requested.includes('\0'))
      return errorResponse(400,'Invalid path');
    const resolved=path.resolve(root,'.'+requested);
    if(resolved===root||!resolved.startsWith(root+path.sep))
      return errorResponse(403,'Forbidden');
    try{
      const stat=await fs.stat(resolved);
      if(!stat.isFile())return errorResponse(404,'Not a file');
      const bytes=await fs.readFile(resolved);
      return new Response(new Uint8Array(bytes),{
        status:200,
        headers:{
          'Content-Type':MIME[path.extname(resolved).toLowerCase()]||'application/octet-stream',
          'Cache-Control':'no-store',
          'X-Content-Type-Options':'nosniff'
        }
      });
    }catch(e){
      if(e.code==='ENOENT'||e.code==='ENOTDIR')return errorResponse(404,'Not found');
      console.error('GymTrack file error:',resolved,e);
      return errorResponse(500,'Error reading local asset');
    }
  };
}
module.exports={createAssetHandler};
