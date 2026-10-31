'use strict';
// GymTrack Windows desktop launcher. Exercise GIFs and the entire application
// are loaded from bundled resources, never from an external web server.
const {app, BrowserWindow, Menu, protocol, net, shell, dialog} = require('electron');
const path = require('node:path');
const fs = require('node:fs');
const {pathToFileURL} = require('node:url');

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

function getBundledAsset(request) {
  let parsed;
  try { parsed = new URL(request.url); }
  catch { return new Response('Bad URL', {status:400}); }
  if (parsed.host !== 'app') return new Response('Forbidden', {status:403});
  let relative;
  try { relative = decodeURIComponent(parsed.pathname); }
  catch { return new Response('Bad filename', {status:400}); }
  if (relative.includes('\\') || relative.includes('\0')) {
    return new Response('Invalid filename', {status:400});
  }
  const base = assetsFolder();
  const full = path.resolve(base, '.' + relative);
  if (full !== base && !full.startsWith(base + path.sep)) {
    return new Response('Forbidden', {status:403});
  }
  try {
    if (!fs.statSync(full).isFile()) return new Response('Not a file', {status:404});
  } catch { return new Response('Not found', {status:404}); }
  return net.fetch(pathToFileURL(full).toString());
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
    dialog.showErrorBox('GymTrack', 'Не удалось открыть приложение: ' + error.message);
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
  protocol.handle(SCHEME,getBundledAsset);
  Menu.setApplicationMenu(Menu.buildFromTemplate(appMenu));
  createMainWindow();
  app.on('activate', () => {if(BrowserWindow.getAllWindows().length===0)createMainWindow();});
}).catch(error => dialog.showErrorBox('GymTrack',String(error)));

app.on('window-all-closed', () => {if(process.platform!=='darwin') app.quit();});
