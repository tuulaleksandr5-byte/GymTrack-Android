'use strict';
// Node-based smoke test for Electron startup. Catches main-process crashes
// (including SoundCloudApi constructor mismatches) before shipping EXE.
const assert=require('node:assert/strict');
const Module=require('node:module');
const loaded=[],handlers=new Map(),errors=[],windows=[];
class FakeWindow{
 constructor(opts){
  this.options=opts;
  this.webContents={
   setWindowOpenHandler() {},
   on() {},
   session:{setPermissionRequestHandler(){},webRequest:{onBeforeRequest(){}}}
  };
  windows.push(this);
 }
 once() {}
 show() {}
 loadURL(url){loaded.push(url);return Promise.resolve();}
}
FakeWindow.getAllWindows=()=>windows;
const fakeElectron={
 app:{
  isPackaged:false,
  whenReady:()=>Promise.resolve(),
  on() {},
  getPath:()=>require('node:os').tmpdir(),
  quit(){}
 },
 BrowserWindow:FakeWindow,
 Menu:{buildFromTemplate:template=>template,setApplicationMenu(){}},
 protocol:{registerSchemesAsPrivileged(){},handle(){}},
 shell:{openExternal:async()=>{}},
 dialog:{showErrorBox:(title,message)=>errors.push(title+': '+message)},
 ipcMain:{handle:(name,handler)=>{assert(!handlers.has(name),'Duplicate IPC handler: '+name);handlers.set(name,handler)}},
 safeStorage:{isEncryptionAvailable:()=>false}
};
const original=Module._load;
Module._load=function(name,parent,isMain){
 if(name==='electron')return fakeElectron;
 return original.call(this,name,parent,isMain);
};
try{require('../main.cjs');}finally{Module._load=original;}
setImmediate(()=>{
 try{
  assert.deepEqual(errors,[],'Main process startup failed');
  assert(loaded.includes('gymtrack://app/index.html'),'Main page did not start loading');
  assert(handlers.has('gymtrack:soundcloud-status'));
  assert(handlers.has('gymtrack:soundcloud-connect'));
  assert(handlers.has('gymtrack:soundcloud-search'));
  assert(handlers.has('gymtrack:youtube-title'));
  console.log('Electron main-process smoke test passed (window, IPC, initial page).');
 }catch(e){console.error(e);process.exitCode=1;}
});
