'use strict';
// Expose narrowly scoped IPC methods; never expose Node.js or credentials.
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('GymTrackDesktop',Object.freeze({
  getYouTubeTitle:(url)=>ipcRenderer.invoke('gymtrack:youtube-title',url),
  lookupYoutubeTitle:(url)=>ipcRenderer.invoke('gymtrack:youtube-title',url),
  openSoundCloudSearch:(query)=>ipcRenderer.invoke('gymtrack:open-soundcloud',query),
  soundCloudStatus:()=>ipcRenderer.invoke('gymtrack:soundcloud-status'),
  soundCloudConnect:(clientId,clientSecret)=>ipcRenderer.invoke('gymtrack:soundcloud-connect',clientId,clientSecret),
  soundCloudDisconnect:()=>ipcRenderer.invoke('gymtrack:soundcloud-disconnect'),
  soundCloudSearch:(type,query)=>ipcRenderer.invoke('gymtrack:soundcloud-search',type,query),
  soundCloudPlay:(url)=>ipcRenderer.invoke('gymtrack:soundcloud-play',url)
}));
