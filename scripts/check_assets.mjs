import {readFileSync,writeFileSync,unlinkSync} from 'node:fs';
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
