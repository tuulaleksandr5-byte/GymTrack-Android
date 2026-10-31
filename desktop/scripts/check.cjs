'use strict';
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const base=path.resolve(__dirname,'..','..','app','src','main','assets');
const html=fs.readFileSync(path.join(base,'index.html'),'utf8');
const features=['gymtrack_v1','function renderCalendar','function renderHistory','function renderWorkout',
  'function renderMusic','BUILTIN_TECHNIQUE_ASSETS','12 GIF','playlistLinksSection',
  'function exportData','function renderTechnique'];
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
const matches=[...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/g)];
assert.equal(matches.length,1,'Expected one embedded app script');
const temp=path.join(__dirname,'.app-test.js');
try {
 fs.writeFileSync(temp,matches[0][1]);
 require('node:child_process').execFileSync(process.execPath,['--check',temp],{stdio:'inherit'});
} finally {try{fs.unlinkSync(temp)}catch{}}
console.log('GymTrack desktop: UI, workout features and 12 animations verified.');
