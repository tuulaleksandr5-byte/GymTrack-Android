'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('GymTrackDesktop',Object.freeze({
  lookupYoutubeTitle:(url)=>ipcRenderer.invoke('gymtrack:youtube-title',url),
  soundCloudStatus:()=>ipcRenderer.invoke('gymtrack:sc-status'),
  soundCloudSearch:(query)=>ipcRenderer.invoke('gymtrack:sc-search',query),
  soundCloudStatus:()=>ipcRenderer.invoke('gymtrack:soundcloud-status'),
  soundCloudConnect:(id,secret)=>ipcRenderer.invoke('gymtrack:soundcloud-connect',id,secret),
  soundCloudDisconnect:()=>ipcRenderer.invoke('gymtrack:soundcloud-disconnect'),
  soundCloudSearch:(type,q)=>ipcRenderer.invoke('gymtrack:soundcloud-search',type,q),
  soundCloudPlay:(url)=>ipcRenderer.invoke('gymtrack:soundcloud-play',url)
}));
