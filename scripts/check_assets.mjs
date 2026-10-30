import {readFileSync,writeFileSync,unlinkSync,statSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import assert from 'node:assert/strict';
const html=readFileSync(new URL('../app/src/main/assets/index.html',import.meta.url),'utf8');
for(const s of ['id="content"','id="mobileNav"','function renderCalendar',
  'function renderHistory','function renderMusic','function exportData','GymTrackAndroid']){
  assert.ok(html.includes(s),'Missing: '+s);
}
const match=html.match(/<script>([\s\S]*?)<\/script>/);
assert.ok(match,'Missing script');
const temp=new URL('../.web-check.cjs',import.meta.url);
try{
  writeFileSync(temp,match[1]);
  execFileSync('node',['--check',temp.pathname],{stdio:'inherit'});
}finally{try{unlinkSync(temp)}catch{}}
console.log('GymTrack web asset check passed');

const gifFiles=["01_barbell_bench_press.gif","02_dumbbell_bench_press.gif","03_incline_barbell_press.gif","04_incline_dumbbell_press.gif","05_decline_dumbbell_press.gif","06_chest_press_machine.gif","07_parallel_bar_dips.gif","08_pec_deck.gif","09_cable_crossover.gif","10_low_to_high_cable_fly.gif","11_flat_dumbbell_fly.gif","12_pushups.gif"];
for(const file of gifFiles){
  const info=statSync(new URL('../app/src/main/assets/gifs/'+file,import.meta.url));
  assert.ok(info.size > 300000, 'Missing or invalid bundled GIF '+file);
  assert.ok(html.includes('gifs/'+file),'Unmapped GIF '+file);
}
console.log('Validated '+gifFiles.length+' built-in exercise GIFs');
