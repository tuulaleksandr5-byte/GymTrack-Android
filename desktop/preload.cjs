'use strict';
const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('GymTrackDesktop',Object.freeze({
  getYouTubeTitle(url){
    if(typeof url!=='string'||url.length>1200)return Promise.resolve({error:'invalid_url'});
    return ipcRenderer.invoke('gymtrack:youtube-title',url);
  },
  openSoundCloudSearch(query){
    if(typeof query!=='string'||!query.trim()||query.length>220)return Promise.resolve(false);
    return ipcRenderer.invoke('gymtrack:open-soundcloud',query);
  }
}));
