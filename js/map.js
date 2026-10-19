'use strict';
const MW=48, MH=36;
const T={WALL:0,FLOOR:1,DOOR:2,DOOR_OPEN:3,STAIRS:4,CRATE:5,KIOSK:6};
const idx=(x,y)=>y*MW+x;
const inb=(x,y)=>x>=0&&y>=0&&x<MW&&y<MH;
const DIRS8=[[1,0],[-1,0],[0,1],[0,-1],[1,1],[1,-1],[-1,1],[-1,-1]];

function isOpaque(m,x,y){ if(!inb(x,y)) return true; const t=m.t[idx(x,y)]; return t===T.WALL||t===T.DOOR||t===T.CRATE; }
function isSolid(m,x,y){ if(!inb(x,y)) return true; const t=m.t[idx(x,y)]; return t===T.WALL||t===T.CRATE||t===T.KIOSK; }
function isWalk(m,x,y){ if(!inb(x,y)) return false; const t=m.t[idx(x,y)]; return t===T.FLOOR||t===T.DOOR_OPEN||t===T.STAIRS; }
// can an actor step from (x,y) to (nx,ny)? Doors handled separately by caller.
function diagOk(m,x,y,nx,ny){ const dx=nx-x,dy=ny-y; if(dx&&dy){ if(isOpaque(m,x+dx,y)||isOpaque(m,x,y+dy)) return false; } return true; }

function makeMap(floor){
  const m={w:MW,h:MH,t:new Uint8Array(MW*MH),seen:new Uint8Array(MW*MH),vis:new Uint8Array(MW*MH),decor:new Uint8Array(MW*MH),rooms:[],floor,start:null,stairs:null};
  const rooms=m.rooms;
  for(let a=0;a<400&&rooms.length<13;a++){
    const w=R.i(4,10),h=R.i(3,7),x=R.i(1,MW-w-2),y=R.i(1,MH-h-2);
    if(rooms.some(o=>x<o.x+o.w+2&&x+w+2>o.x&&y<o.y+o.h+2&&y+h+2>o.y)) continue;
    const r={x,y,w,h,cx:x+(w>>1),cy:y+(h>>1)};
    for(let yy=y;yy<y+h;yy++)for(let xx=x;xx<x+w;xx++) m.t[idx(xx,yy)]=T.FLOOR;
    rooms.push(r);
  }
  rooms.sort((a,b)=>a.cx-b.cx);
  const corr=new Uint8Array(MW*MH);
  const carve=(x,y)=>{ if(m.t[idx(x,y)]===T.WALL){ m.t[idx(x,y)]=T.FLOOR; corr[idx(x,y)]=1; } };
  const tunnel=(a,b)=>{
    let x=a.cx,y=a.cy;
    const horizFirst=R.chance(0.5);
    const goH=()=>{ while(x!==b.cx){ x+=sign(b.cx-x); carve(x,y);} };
    const goV=()=>{ while(y!==b.cy){ y+=sign(b.cy-y); carve(x,y);} };
    if(horizFirst){goH();goV();}else{goV();goH();}
  };
  for(let i=0;i<rooms.length-1;i++) tunnel(rooms[i],rooms[i+1]);
  for(let i=0;i<2;i++){ const a=R.pick(rooms),b=R.pick(rooms); if(a!==b) tunnel(a,b); }
  // doors: corridor tiles on a room's perimeter ring
  for(const r of rooms){
    for(let y=r.y-1;y<=r.y+r.h;y++)for(let x=r.x-1;x<=r.x+r.w;x++){
      if(!inb(x,y)) continue;
      const onRing=(x===r.x-1||x===r.x+r.w||y===r.y-1||y===r.y+r.h);
      if(!onRing||!corr[idx(x,y)]) continue;
      const L=m.t[idx(x-1,y)],Rr=m.t[idx(x+1,y)],U=m.t[idx(x,y-1)],Dn=m.t[idx(x,y+1)];
      const hor=L!==T.WALL&&Rr!==T.WALL&&U===T.WALL&&Dn===T.WALL;
      const ver=U!==T.WALL&&Dn!==T.WALL&&L===T.WALL&&Rr===T.WALL;
      if((hor||ver)&&R.chance(0.75)) m.t[idx(x,y)]=T.DOOR;
    }
  }
  // decor & crates inside rooms
  for(const r of rooms){
    for(let y=r.y;y<r.y+r.h;y++)for(let x=r.x;x<r.x+r.w;x++){
      const i=idx(x,y);
      if(m.t[i]!==T.FLOOR) continue;
      const interior=x>r.x&&x<r.x+r.w-1&&y>r.y&&y<r.y+r.h-1;
      const nearCorr=DIRS8.some(([dx,dy])=>inb(x+dx,y+dy)&&(corr[idx(x+dx,y+dy)]||m.t[idx(x+dx,y+dy)]===T.DOOR));
      if(interior&&!nearCorr&&r.w*r.h>=16&&R.chance(0.04)){ m.t[i]=T.CRATE; continue; }
      if(R.chance(0.09)) m.decor[i]=R.i(1,4);
    }
  }
  // start & stairs
  const start=rooms[0]; m.start={x:start.cx,y:start.cy};
  let d=bfsMap(m,start.cx,start.cy,()=>true);
  if(rooms.some(r=>d[idx(r.cx,r.cy)]<0)){ // safety: drop crates, retry
    for(let i=0;i<MW*MH;i++) if(m.t[i]===T.CRATE) m.t[i]=T.FLOOR;
    d=bfsMap(m,start.cx,start.cy,()=>true);
    if(rooms.some(r=>d[idx(r.cx,r.cy)]<0)) return makeMap(floor);
  }
  let best=null,bd=-1;
  for(const r of rooms){ const v=d[idx(r.cx,r.cy)]; if(v>bd){bd=v;best=r;} }
  m.stairs={x:best.cx,y:best.cy};
  if(floor<MAX_FLOOR) m.t[idx(best.cx,best.cy)]=T.STAIRS; else { m.t[idx(best.cx,best.cy)]=T.FLOOR; }
  m.t[idx(start.cx,start.cy)]=T.FLOOR;
  m.bossRoom=best;
  // kiosk (shop) on even floors, 50% on odd floors from 3
  m.kiosk=null;
  if(floor>=2&&(floor%2===0||R.chance(0.5))){
    const cands=rooms.filter(r=>r!==start&&r!==best&&r.w>=5&&r.h>=4);
    if(cands.length){
      const r=R.pick(cands);
      for(let i=0;i<40;i++){ const x=R.i(r.x+1,r.x+r.w-2),y=R.i(r.y+1,r.y+r.h-2); const ii=idx(x,y); if(m.t[ii]!==T.FLOOR) continue; m.t[ii]=T.KIOSK; m.decor[ii]=0; m.kiosk={x,y}; break; }
    }
  }
  return m;
}

// BFS distance map over passable tiles (doors count as passable). passFn(x,y) extra filter.
function bfsMap(m,sx,sy,passFn,maxD=9999){
  const d=new Int16Array(MW*MH).fill(-1);
  const q=new Int32Array(MW*MH); let qh=0,qt=0;
  d[idx(sx,sy)]=0; q[qt++]=idx(sx,sy);
  while(qh<qt){
    const c=q[qh++]; const x=c%MW,y=(c/MW)|0; const cd=d[c];
    if(cd>=maxD) continue;
    for(const [dx,dy] of DIRS8){
      const nx=x+dx,ny=y+dy; if(!inb(nx,ny)) continue;
      const ni=idx(nx,ny); if(d[ni]>=0) continue;
      const t=m.t[ni]; if(t===T.WALL||t===T.CRATE||t===T.KIOSK) continue;
      if(!diagOk(m,x,y,nx,ny)) continue;
      if(!passFn(nx,ny)) continue;
      d[ni]=cd+1; q[qt++]=ni;
    }
  }
  return d;
}
// path from (sx,sy) to (tx,ty) over tiles where passFn true; returns array of {x,y} excluding start
function findPath(m,sx,sy,tx,ty,passFn){
  const d=bfsMap(m,tx,ty,passFn);
  if(d[idx(sx,sy)]<0) return null;
  const path=[]; let x=sx,y=sy;
  while(!(x===tx&&y===ty)){
    let bx=-1,by=-1,bd=d[idx(x,y)];
    for(const [dx,dy] of DIRS8){ const nx=x+dx,ny=y+dy; if(!inb(nx,ny))continue; const v=d[idx(nx,ny)]; if(v>=0&&v<bd&&diagOk(m,x,y,nx,ny)){bd=v;bx=nx;by=ny;} }
    if(bx<0) return null;
    x=bx;y=by; path.push({x,y});
    if(path.length>500) return null;
  }
  return path;
}

function lineClear(m,x0,y0,x1,y1){
  let dx=Math.abs(x1-x0),dy=-Math.abs(y1-y0),sx=x0<x1?1:-1,sy=y0<y1?1:-1,err=dx+dy;
  let x=x0,y=y0;
  for(;;){
    if(x===x1&&y===y1) return true;
    if(!(x===x0&&y===y0)&&isOpaque(m,x,y)) return false;
    const e2=2*err; if(e2>=dy){err+=dy;x+=sx;} if(e2<=dx){err+=dx;y+=sy;}
  }
}
function computeFOV(m,px,py,rad){
  m.vis.fill(0);
  const r2=rad*rad+rad;
  for(let y=py-rad;y<=py+rad;y++)for(let x=px-rad;x<=px+rad;x++){
    if(!inb(x,y)) continue;
    const dx=x-px,dy=y-py; if(dx*dx+dy*dy>r2) continue;
    if(lineClear(m,px,py,x,y)){ const i=idx(x,y); m.vis[i]=1; m.seen[i]=1; }
  }
  // make walls adjacent to visible floor visible too (nicer rooms)
  const add=[];
  for(let y=py-rad-1;y<=py+rad+1;y++)for(let x=px-rad-1;x<=px+rad+1;x++){
    if(!inb(x,y)) continue; const i=idx(x,y); if(m.vis[i]||!isOpaque(m,x,y)) continue;
    for(const [dx,dy] of DIRS8){ const nx=x+dx,ny=y+dy; if(inb(nx,ny)&&m.vis[idx(nx,ny)]&&!isOpaque(m,nx,ny)){ add.push(i); break; } }
  }
  for(const i of add){ m.vis[i]=1; m.seen[i]=1; }
}
