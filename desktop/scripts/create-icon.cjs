'use strict';
// Generate 256px branded PNG and Windows ICO using only Node built-ins.
const fs=require('node:fs');
const path=require('node:path');
const zlib=require('node:zlib');
const SIZE=256;
const rgba=Buffer.alloc(SIZE*SIZE*4);
function mix(x,y,c){const p=(y*SIZE+x)*4;for(let j=0;j<4;j++)rgba[p+j]=c[j];}
function rounded(x,y,w,h,r,c){
 for(let iy=Math.max(0,y);iy<Math.min(SIZE,y+h);iy++)for(let ix=Math.max(0,x);ix<Math.min(SIZE,x+w);ix++){
  const a=ix<x+r?x+r-ix-1:ix>=x+w-r?ix-(x+w-r):0;
  const b=iy<y+r?y+r-iy-1:iy>=y+h-r?iy-(y+h-r):0;
  if(a*a+b*b<=r*r)mix(ix,iy,c);
 }
}
function circle(cx,cy,r,c){for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
 const d=(x-cx)*(x-cx)+(y-cy)*(y-cy);
 if(d<=r*r)mix(x,y,c);
}}
const dark=[13,16,21,255],orange=[255,111,56,255],white=[247,247,247,255],dim=[42,46,53,255];
rounded(5,5,246,246,55,dark);
rounded(12,12,232,232,49,dim);
rounded(17,17,222,222,46,dark);
circle(128,128,81,orange);
circle(128,128,70,dark);
// Central barbell (orange plates with light bar)
rounded(63,121,130,14,7,white);
rounded(68,92,20,70,6,orange);
rounded(92,104,16,48,4,orange);
rounded(148,104,16,48,4,orange);
rounded(168,92,20,70,6,orange);
function crc32(buf){let crc=0xffffffff;for(const b of buf){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function chunk(type,data){
 const header=Buffer.from(type,'ascii');
 const len=Buffer.alloc(4);len.writeUInt32BE(data.length);
 const crc=Buffer.alloc(4);crc.writeUInt32BE(crc32(Buffer.concat([header,data])));
 return Buffer.concat([len,header,data,crc]);
}
const raw=Buffer.alloc(SIZE*(1+SIZE*4));
for(let y=0;y<SIZE;y++){const o=y*(1+SIZE*4);raw[o]=0;rgba.copy(raw,o+1,y*SIZE*4,(y+1)*SIZE*4);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(SIZE,0);ihdr.writeUInt32BE(SIZE,4);ihdr[8]=8;ihdr[9]=6;
const png=Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',zlib.deflateSync(raw,{level:9})),chunk('IEND',Buffer.alloc(0))]);
const dir=Buffer.alloc(22);dir.writeUInt16LE(0,0);dir.writeUInt16LE(1,2);dir.writeUInt16LE(1,4);
dir[6]=0;dir[7]=0;dir[8]=0;dir[9]=0;dir.writeUInt16LE(1,10);dir.writeUInt16LE(32,12);dir.writeUInt32LE(png.length,14);dir.writeUInt32LE(22,18);
const out=path.resolve(__dirname,'..','build');fs.mkdirSync(out,{recursive:true});
fs.writeFileSync(path.join(out,'icon.png'),png);
fs.writeFileSync(path.join(out,'icon.ico'),Buffer.concat([dir,png]));
console.log('GymTrack app icons generated');
