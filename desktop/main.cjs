'use strict';
// GymTrack Windows desktop launcher. Exercise GIFs and the entire application
// are loaded from bundled resources, never from an external web server.
const {app, BrowserWindow, Menu, protocol, shell, dialog} = require('electron');
const path = require('node:path');
const {createAssetHandler} = require('./asset-loader.cjs');

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
  'open.spotify.com', 'music.youtube.com', 'www.youtube.com', 'youtube.com'
]);
function openApprovedExternal(rawUrl) {
  try {
    const url = new URL(rawUrl);
    if (url.protocol === 'https:' && externalHosts.has(url.hostname)) {
      shell.openExternal(url.href).catch(() => {});
    }
  } catch { /* Ignore malformed or untrusted URLs. */ }
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
      nodeIntegration:false,contextIsolation:true,sandbox:true,
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
  protocol.handle(SCHEME,createAssetHandler(assetsFolder()));
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenu));
  createMainWindow();
  app.on('activate', () => {if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
}).catch(error => dialog.showErrorBox('GymTrack',String(error)));

app.on('window-all-closed', () => {if(process.platform!=='darwin') app.quit();});
