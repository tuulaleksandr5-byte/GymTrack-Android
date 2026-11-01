'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('GymTrackDesktop',Object.freeze({
  lookupYoutubeTitle:(url)=>ipcRenderer.invoke('gymtrack:youtube-title',url)
}));
