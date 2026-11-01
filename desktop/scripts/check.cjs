'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..','..','app','src','main','assets');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const features=['gymtrack_v1','function renderCalendar','function renderHistory','function renderWorkout',
  'function renderMusic','BUILTIN_TECHNIQUE_ASSETS','12 GIF','playlistLinksSection',
  'function exportData','function renderTechnique','function youtubeToSoundCloudSearch','youtubeTrackSearch'];
for(const feature of features) assert(html.includes(feature),'Missing app feature: '+feature);
const expected=[
  '01_barbell_bench_press.gif','02_dumbbell_bench_press.gif','03_incline_barbell_press.gif',
  '04_incline_dumbbell_press.gif','05_decline_dumbbell_press.gif','06_chest_press_machine.gif',
  '07_parallel_bar_dips.gif','08_pec_deck.gif','09_cable_crossover.gif',
  '10_low_to_high_cable_fly.gif','11_flat_dumbbell_fly.gif','12_pushups.gif'
];
for(const gif of expected) {
 const p=path.join(base,'gifs',gif);
 assert(fs.statSync(p).size>300000,'GIF missing or truncated: '+gif);
 assert(html.includes('gifs/'+gif),'GIF not linked in interface: '+gif);
}
const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)].filter(m=>!/<script[^>]*\bsrc\s*=/.test(m[0].split('>')[0]));
assert.equal(matches.length,1,'Expected one embedded app script');
const temp=path.join(__dirname,'.app-test.js');
try {
 fs.writeFileSync(temp,matches[0][1]);
 require('node:child_process').execFileSync(process.execPath,['--check',temp],{stdio:'inherit'});
} finally {try{fs.unlinkSync(temp)}catch{}}

// Smoke test the exact protocol handler used in the Windows executable.
// This catches the ERR_UNEXPECTED blank-window regression at build time.
const {createAssetHandler}=require('../asset-loader.cjs');
(async()=>{
 const handle=createAssetHandler(base);
 const root=await handle({url:'gymtrack://app/index.html'});
 assert.equal(root.status,200,'Main page could not be loaded');
 assert.match(root.headers.get('Content-Type'),/text\/html/);
 assert.ok((await root.text()).includes('GymTrack'),'Main page body missing');
 const gif=await handle({url:'gymtrack://app/gifs/03_incline_barbell_press.gif'});
 assert.equal(gif.status,200,'GIF could not be loaded');
 assert.equal(gif.headers.get('Content-Type'),'image/gif');
 assert.ok((await gif.arrayBuffer()).byteLength>300000);
 const missing=await handle({url:'gymtrack://app/no-such-file.html'});
 assert.equal(missing.status,404);
 const invalid=await handle({url:'gymtrack://app/%5cprivate.txt'});
 assert.equal(invalid.status,400);
 const editor=path.join(base,'program-editor.js');
 assert(fs.statSync(editor).size>1000);
 require('node:child_process').execFileSync(process.execPath,['--check',editor],{stdio:'inherit'});
 console.log('GymTrack desktop loader check passed: HTML + GIF + custom editor + path protection.');
})().catch(e=>{console.error(e);process.exitCode=1;});

const {extractVideoId,soundCloudSearchUrl,getYouTubeTitle}=require('../youtube-search.cjs');
assert.equal(extractVideoId('https://www.youtube.com/watch?v=dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.equal(extractVideoId('https://youtu.be/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.equal(extractVideoId('https://music.youtube.com/watch?v=dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.equal(extractVideoId('https://www.youtube.com/shorts/dQw4w9WgXcQ'),'dQw4w9WgXcQ');
assert.equal(extractVideoId('https://www.youtube.com/playlist?list=PL123'),null);
assert.equal(extractVideoId('https://evil-example.com/watch?v=dQw4w9WgXcQ'),null);
assert.equal(extractVideoId('http://youtube.com/watch?v=dQw4w9WgXcQ'),null);
assert.equal(soundCloudSearchUrl('Test Song'),'https://soundcloud.com/search/sounds?q=Test%20Song');
assert.equal(soundCloudSearchUrl('   '),null);
getYouTubeTitle('https://youtu.be/dQw4w9WgXcQ',async(url,options)=>{
  assert.match(url,/youtube\.com\/oembed/);
  assert.equal(options.redirect,'error');
  return {ok:true,text:async()=>JSON.stringify({title:'Test YouTube title'})};
}).then(v=>assert.equal(v.title,'Test YouTube title')).catch(e=>{console.error(e);process.exitCode=1;});
console.log('YouTube to SoundCloud search: URL handling verified.');

const {youtubeVideoId,lookupYoutubeTitle}=require('../youtube-title.cjs');
const assertYoutube=async()=>{
  const id='dQw4w9WgXcQ';
  assert.equal(youtubeVideoId('https://youtu.be/'+id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v='+id),id);
  assert.equal(youtubeVideoId('https://www.youtube.com/shorts/'+id),id);
  assert.equal(youtubeVideoId('https://youtube.com.evil.test/watch?v='+id),null);
  assert.equal(youtubeVideoId('https://www.youtube.com.evil.test/watch?v='+id),null);
  assert.equal(youtubeVideoId('http://www.youtube.com/watch?v='+id),null);
  assert.equal(youtubeVideoId('https://www.youtube.com/watch?v=short'),null);
  let wasCalled=false;
  const result=await lookupYoutubeTitle('https://youtu.be/'+id,async url=>{
    wasCalled=true;
    assert.equal(new URL(url).hostname,'www.youtube.com');
    assert.ok(url.includes('/oembed?'));
    return {ok:true,json:async()=>({title:'Test Track',author_name:'Artist'})};
  });
  assert(wasCalled);
  assert.equal(result.title,'Test Track');
  assert.equal(result.author,'Artist');
  const bad=await lookupYoutubeTitle('https://evil.test/watch?v='+id,async()=>{throw Error('should not fetch')});
  assert.ok(bad.error);
  console.log('YouTube to SoundCloud metadata lookup tested safely.');
};
assertYoutube().catch(e=>{console.error(e);process.exitCode=1;});

const {SoundCloudApi,soundCloudLink}=require('../soundcloud-api.cjs');
const soundCloudTests=async()=>{
 assert.equal(soundCloudLink('https://soundcloud.com/artist/test-track'),'https://soundcloud.com/artist/test-track');
 assert.equal(soundCloudLink('https://soundcloud.com.evil.test/artist/test-track'),null);
 assert.equal(soundCloudLink('http://soundcloud.com/artist/test-track'),null);
 let authCalls=0,searchCalls=0;
 const mock=async(url,opts)=>{
  if(url.includes('/oauth/token')){
   authCalls++;assert.equal(opts.method,'POST');
   assert.match(opts.headers.Authorization||'',/^Basic /);
   return {ok:true,json:async()=>({access_token:'test-token',expires_in:3600,refresh_token:'refresh-token'})};
  }
  searchCalls++;
  assert.equal(new URL(url).origin,'https://api.soundcloud.com');
  assert.match(opts.headers.Authorization,/^OAuth test-token$/);
  return {ok:true,json:async()=>({collection:[{id:123,title:'Test Track',permalink_url:'https://soundcloud.com/artist/test-track',user:{username:'Artist'},duration:120000}]})};
 };
 const api=new SoundCloudApi(mock);
 assert.deepEqual(await api.validate('client-test','secret-test'),{connected:true});
 const a=await api.search('tracks','test');
 assert.equal(a.results.length,1);assert.equal(a.results[0].title,'Test Track');
 const b=await api.search('playlists','test');
 assert.equal(b.results.length,1);assert.equal(authCalls,1);assert.equal(searchCalls,2);
 const bad=await api.search('invalid','test');assert.ok(bad.error);
 console.log('SoundCloud: secure OAuth and in-app search tests passed.');
};
soundCloudTests().catch(e=>{console.error(e);process.exitCode=1;});
