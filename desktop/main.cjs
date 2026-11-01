'use strict';
// GymTrack Windows desktop launcher. Exercise GIFs and the entire application
// are loaded from bundled resources, never from an external web server.
const {app, BrowserWindow, Menu, protocol, shell, dialog, ipcMain, safeStorage} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {SoundCloudApi,soundCloudLink}=require('./soundcloud-api.cjs');
const scApi=new SoundCloudApi();
const {createAssetHandler} = require('./asset-loader.cjs');
const {lookupYoutubeTitle} = require('./youtube-title.cjs');
const {getYouTubeTitle,soundCloudSearchUrl} = require('./youtube-search.cjs');

const SCHEME = 'gymtrack';
const APP_URL = 'gymtrack://app/index.html';
let mainWindow;

protocol.registerSchemesAsPrivileged([{
  scheme: SCHEME,
  privileges: {standard:true,secure:true,supportFetchAPI:true,stream:true}
}]);

function assetsFolder() {
  return app.isPackaged
    ? path.join(process.resourcesPath, 'web')
    : path.resolve(__dirname, '..', 'app', 'src', 'main', 'assets');
}

const externalHosts = new Set([
  'open.spotify.com', 'music.youtube.com', 'www.youtube.com', 'youtube.com', 'soundcloud.com', 'www.soundcloud.com','soundcloud.com'
]);
function openApprovedExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'https:' && externalHosts.has(url.hostname)) {
      shell.openExternal(url.href).catch(() => {});
    }
  } catch { /* Ignore malformed or untrusted URLs. */ }
}


function readSoundCloudCredentials(){
 try{
  if(!safeStorage.isEncryptionAvailable())return;
  const saved=fs.readFileSync(path.join(app.getPath('userData'),'soundcloud-credentials.dat'));
  const cfg=JSON.parse(safeStorage.decryptString(saved));
  scApi.setCredentials(cfg.clientId,cfg.clientSecret);
 }catch{
  // Missing credentials or unavailable encryption; never fall back to plaintext.
 }
}
function isTrustedAppSender(event){
 return event.senderFrame?.url===APP_URL;
}
async function saveSoundCloudCredentials(clientId,clientSecret){
 if(!safeStorage.isEncryptionAvailable())return {error:'Защищённое хранилище Windows недоступно.'};
 const validated=await scApi.validate(clientId,clientSecret);
 if(!validated.connected)return validated;
 try{
  const folder=app.getPath('userData');
  fs.mkdirSync(folder,{recursive:true});
  fs.writeFileSync(path.join(folder,'soundcloud-credentials.dat'),
    safeStorage.encryptString(JSON.stringify({clientId,clientSecret})),{mode:0o600});
  return {connected:true};
 }catch(e){scApi.clear();return {error:'Не удалось безопасно сохранить ключи.'};}
}
function openSoundCloudPlayer(raw){
 const link=soundCloudLink(raw);
 if(!link)return {error:'Неверная ссылка SoundCloud'};
 const widgetUrl='https://w.soundcloud.com/player/?'+new URLSearchParams({
  url:link,auto_play:'false',hide_related:'true',show_comments:'false',visual:'false'
 }).toString();
 const player=new BrowserWindow({
  width:610,height:330,minWidth:360,minHeight:250,title:'GymTrack — SoundCloud',
  backgroundColor:'#17191c',autoHideMenuBar:true,
  webPreferences:{partition:'temp:gymtrack-soundcloud-widget',nodeIntegration:false,contextIsolation:true,sandbox:true,
   webSecurity:true,allowRunningInsecureContent:false,devTools:false}
 });
 player.webContents.setWindowOpenHandler(({url})=>{openApprovedExternal(url);return {action:'deny'};});
 player.webContents.on('will-navigate',(event,url)=>{
  if(url.startsWith('https://w.soundcloud.com/player/'))return;
  event.preventDefault();openApprovedExternal(url);
 });
 player.webContents.session.setPermissionRequestHandler((_contents,_perm,callback)=>callback(false));
 player.loadURL(widgetUrl).catch(()=>player.loadURL('data:text/html,'+encodeURIComponent('<body style="background:#17191c;color:white;font-family:sans-serif;padding:20px">Плеер SoundCloud недоступен. Проверь подключение к интернету.</body>')).catch(()=>{}));
 return {opened:true};
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width:1320, height:850, minWidth:390, minHeight:620,
    title:'GymTrack — дневник тренировок',
    backgroundColor:'#0b0d10',
    show:false,
    autoHideMenuBar:true,
    icon:path.join(__dirname,'build','icon.png'),
    webPreferences:{
      preload:path.join(__dirname,'preload.cjs'),
      nodeIntegration:false,contextIsolation:true,sandbox:true,
      preload:path.join(__dirname,'preload.cjs'),
      webSecurity:true,allowRunningInsecureContent:false,
      backgroundThrottling:false,devTools:false,
      spellcheck:false
    }
  });
  mainWindow.once('ready-to-show', () => mainWindow.show());
  mainWindow.webContents.setWindowOpenHandler(({url}) => {
    openApprovedExternal(url);
    return {action:'deny'};
  });
  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (url === APP_URL || url.startsWith('gymtrack://app/')) return;
    event.preventDefault();
    openApprovedExternal(url);
  });
  mainWindow.webContents.on('will-attach-webview', event => event.preventDefault());
  mainWindow.webContents.session.setPermissionRequestHandler((_contents,_permission,callback) => callback(false));

  // Prevent remote resources from being silently requested by bundled content.
  mainWindow.webContents.session.webRequest.onBeforeRequest((details,callback) => {
    const requestUrl = details.url;
    const local = requestUrl.startsWith('gymtrack://app/') ||
                  requestUrl.startsWith('blob:gymtrack://app/') ||
                  requestUrl.startsWith('data:');
    callback({cancel:!local});
  });
  mainWindow.loadURL(APP_URL).catch(error => {
    console.error('GymTrack application loading failed:', error);
    const msg='Не удалось открыть GymTrack. Перезапусти приложение или установи последнюю версию.';
    const safe='<!doctype html><html lang="ru"><meta charset="utf-8"><title>GymTrack</title>'+
      '<body style="background:#101216;color:#eee;font:18px sans-serif;padding:32px">'+
      '<h1 style="color:#ff753f">GymTrack</h1><p>'+msg+'</p></body></html>';
    mainWindow.loadURL('data:text/html;charset=UTF-8,'+encodeURIComponent(safe)).catch(()=>{});
  });
}

const appMenu = [
  {label:'GymTrack',submenu:[
    {label:'На главную',accelerator:'CmdOrCtrl+H',click:()=>mainWindow?.loadURL(APP_URL)},
    {type:'separator'},
    {label:'Выход',role:'quit'}
  ]},
  {label:'Вид',submenu:[
    {label:'Увеличить',role:'zoomIn'},
    {label:'Уменьшить',role:'zoomOut'},
    {label:'Обычный масштаб',role:'resetZoom'},
    {label:'Полный экран',role:'togglefullscreen'}
  ]}
];

app.whenReady().then(() => {
  readSoundCloudCredentials();
  ipcMain.handle('gymtrack:soundcloud-status',(event)=>isTrustedAppSender(event)?
   {connected:scApi.hasCredentials(),secure:safeStorage.isEncryptionAvailable()}:{error:'Недоступно'});
  ipcMain.handle('gymtrack:soundcloud-connect',async(event,clientId,clientSecret)=>
   isTrustedAppSender(event)?saveSoundCloudCredentials(clientId,clientSecret):{error:'Недоступно'});
  ipcMain.handle('gymtrack:soundcloud-disconnect',(event)=>{
   if(!isTrustedAppSender(event))return {error:'Недоступно'};
   scApi.clear();
   try{fs.unlinkSync(path.join(app.getPath('userData'),'soundcloud-credentials.dat'));}catch{}
   return {connected:false};
  });
  ipcMain.handle('gymtrack:soundcloud-search',(event,type,q)=>
   isTrustedAppSender(event)?scApi.search(type,q):{error:'Недоступно'});
  ipcMain.handle('gymtrack:soundcloud-play',(event,url)=>
   isTrustedAppSender(event)?openSoundCloudPlayer(url):{error:'Недоступно'});
  ipcMain.handle('gymtrack:youtube-title',async(event,url)=>{
    if(event.sender!==mainWindow?.webContents)return {error:'forbidden'};
    return getYouTubeTitle(url);
  });
  ipcMain.handle('gymtrack:open-soundcloud',async(event,query)=>{
    if(event.sender!==mainWindow?.webContents)return false;
    const url=soundCloudSearchUrl(query);
    if(!url)return false;
    try{await shell.openExternal(url);return true;}
    catch{return false;}
  });
  protocol.handle(SCHEME,createAssetHandler(assetsFolder()));
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenu));
  createMainWindow();
  app.on('activate', () => {if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
}).catch(error => dialog.showErrorBox('GymTrack',String(error)));

app.on('window-all-closed', () => {if(process.platform!=='darwin') app.quit();});
