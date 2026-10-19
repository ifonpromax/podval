'use strict';
const RD={cv:null,g:null,W:0,H:0,sc:3,tz:36,dpr:1,cam:{x:0,y:0},last:0,time:0,tiles:{},pathT:0,vig:null};

function initRender(){
  RD.cv=document.getElementById('game'); RD.g=RD.cv.getContext('2d');
  resize(); window.addEventListener('resize',resize);
  requestAnimationFrame(frame);
}
function resize(){
  const dpr=Math.min(2,window.devicePixelRatio||1);
  RD.W=window.innerWidth; RD.H=window.innerHeight; RD.dpr=dpr;
  RD.cv.width=Math.floor(RD.W*dpr); RD.cv.height=Math.floor(RD.H*dpr);
  RD.cv.style.width=RD.W+'px'; RD.cv.style.height=RD.H+'px';
  const minDim=Math.min(RD.W,RD.H);
  RD.sc=clamp(Math.round(minDim/(12*TS)),2,4); RD.tz=TS*RD.sc;
  RD.vig=null;
}
function themeTiles(f){
  if(RD.tiles[f]) return RD.tiles[f];
  const th=THEMES[f]; const rr=mulberry32(f*7919+13);
  const mk=()=>{const c=document.createElement('canvas');c.width=TS;c.height=TS;return c};
  const floors=[];
  for(let v=0;v<4;v++){
    const c=mk(),g=c.getContext('2d');
    g.fillStyle=th.floor; g.fillRect(0,0,TS,TS);
    g.fillStyle=th.floor2; for(let i=0;i<7;i++) g.fillRect(Math.floor(rr()*TS),Math.floor(rr()*TS),1+Math.floor(rr()*3),1);
    g.fillStyle='rgba(0,0,0,0.13)'; g.fillRect(0,0,TS,1); g.fillRect(0,0,1,TS);
    floors.push(c);
  }
  const face=mk(); { const g=face.getContext('2d');
    if(th.paint){ g.fillStyle=th.wallTop; g.fillRect(0,0,TS,5); g.fillStyle=th.wall; g.fillRect(0,5,TS,7); g.fillStyle=th.wallDark; g.fillRect(0,5,TS,1); g.fillRect(0,TS-1,TS,1); g.fillStyle='rgba(255,255,255,0.08)'; g.fillRect(0,6,TS,1); }
    else { g.fillStyle=th.wall; g.fillRect(0,0,TS,TS); g.fillStyle=th.wallDark; for(let y=0;y<TS;y+=3){ g.fillRect(0,y+2,TS,1); const off=((y/3)|0)%2?3:0; for(let x=off;x<TS;x+=6) g.fillRect(x,y,1,3); } g.fillStyle=th.wallTop; g.fillRect(0,0,TS,1); g.fillStyle=th.wallDark; g.fillRect(0,TS-1,TS,1); }
  }
  const top=mk(); { const g=top.getContext('2d'); g.fillStyle=th.wallDark; g.fillRect(0,0,TS,TS); g.fillStyle='rgba(255,255,255,0.06)'; for(let i=0;i<6;i++) g.fillRect(Math.floor(rr()*TS),Math.floor(rr()*TS),2,1); }
  RD.tiles[f]={floors,face,top,edge:th.paint?th.wall:th.wallTop}; return RD.tiles[f];
}
function camOffset(){
  const shx=FX.shake?(Math.random()-0.5)*FX.shake:0, shy=FX.shake?(Math.random()-0.5)*FX.shake:0;
  return {ox:RD.W/2-(RD.cam.x+0.5)*RD.tz+shx, oy:RD.H/2-(RD.cam.y+0.5)*RD.tz+shy};
}
function screenToTile(cx,cy){ const {ox,oy}=camOffset(); return {x:Math.floor((cx-ox)/RD.tz),y:Math.floor((cy-oy)/RD.tz)}; }

function frame(ts){
  const dt=Math.min(0.05,((ts-RD.last)/1000)||0); RD.last=ts; RD.time+=dt;
  update(dt); draw();
  requestAnimationFrame(frame);
}
function update(dt){
  if(!G.p) return;
  const all=[G.p,...G.mons];
  for(const a of all){
    a.vx+=(a.x-a.vx)*Math.min(1,dt*18); a.vy+=(a.y-a.vy)*Math.min(1,dt*18);
    if(Math.abs(a.x-a.vx)<0.01)a.vx=a.x; if(Math.abs(a.y-a.vy)<0.01)a.vy=a.y;
    if(a.bump){a.bump.t-=dt*7; if(a.bump.t<=0)a.bump=null;}
    if(a.flash>0)a.flash-=dt*7;
  }
  RD.cam.x+=(G.p.vx-RD.cam.x)*Math.min(1,dt*9); RD.cam.y+=(G.p.vy-RD.cam.y)*Math.min(1,dt*9);
  FX.shake=Math.max(0,FX.shake-dt*32); if(FX.zap>0)FX.zap-=dt*3;
  for(const f of FX.floats) f.t+=dt*1.1; FX.floats=FX.floats.filter(f=>f.t<1);
  for(const q of FX.parts){ q.t+=dt; q.x+=q.vx*dt*4; q.y+=q.vy*dt*4; q.vy+=dt*10; } FX.parts=FX.parts.filter(q=>q.t<q.life);
  if(FX.proj){ FX.proj.t+=dt*5; if(FX.proj.t>=1) FX.proj=null; }
  if(G.path&&G.state==='play'){ RD.pathT+=dt; if(RD.pathT>0.075){ RD.pathT=0; stepPath(); } }
}
function draw(){
  const g=RD.g,W=RD.W,H=RD.H,tz=RD.tz,sc=RD.sc;
  g.setTransform(RD.dpr,0,0,RD.dpr,0,0); g.imageSmoothingEnabled=false;
  g.fillStyle='#07070c'; g.fillRect(0,0,W,H);
  if(!G.map||G.state==='title') return;
  const m=G.map,p=G.p,th=themeTiles(G.floor);
  const {ox,oy}=camOffset();
  const x0=Math.max(0,Math.floor(-ox/tz)-1),y0=Math.max(0,Math.floor(-oy/tz)-1),x1=Math.min(MW-1,Math.ceil((W-ox)/tz)),y1=Math.min(MH-1,Math.ceil((H-oy)/tz));
  const sx=x=>Math.round(ox+x*tz), sy=y=>Math.round(oy+y*tz);
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=idx(x,y); if(!m.seen[i]) continue;
    const t=m.t[i]; const px=sx(x),py=sy(y);
    if(t===T.WALL){
      const below=y+1<MH&&m.t[idx(x,y+1)]!==T.WALL;
      g.drawImage(below?th.face:th.top,px,py,tz,tz);
      if(!below){
        g.fillStyle=th.edge;
        if(y>0&&m.t[idx(x,y-1)]!==T.WALL) g.fillRect(px,py,tz,sc);
        if(x>0&&m.t[idx(x-1,y)]!==T.WALL) g.fillRect(px,py,sc,tz);
        if(x<MW-1&&m.t[idx(x+1,y)]!==T.WALL) g.fillRect(px+tz-sc,py,sc,tz);
      } else {
        g.fillStyle=th.edge;
        if(x>0&&m.t[idx(x-1,y)]!==T.WALL) g.fillRect(px,py,sc,tz);
        if(x<MW-1&&m.t[idx(x+1,y)]!==T.WALL) g.fillRect(px+tz-sc,py,sc,tz);
      }
    }
    else {
      g.drawImage(th.floors[(x*7+y*13)%4],px,py,tz,tz);
      if(t===T.DOOR) g.drawImage(sprCanvas('door'),px,py,tz,tz);
      else if(t===T.DOOR_OPEN) g.drawImage(sprCanvas('door_open'),px,py,tz,tz);
      else if(t===T.STAIRS){ g.drawImage(sprCanvas('stairs'),px,py,tz,tz); if(m.vis[i]){ g.fillStyle=`rgba(243,197,58,${0.15+Math.sin(RD.time*4)*0.1})`; g.fillRect(px,py,tz,tz);} }
      else if(t===T.CRATE) g.drawImage(sprCanvas('crate'),px,py,tz,tz);
      else if(t===T.KIOSK){ g.drawImage(sprCanvas('kiosk'),px,py,tz,tz); if(m.vis[i]&&Math.sin(RD.time*6)>0){ g.fillStyle='rgba(243,197,58,0.25)'; g.fillRect(px+sc,py+sc,tz-2*sc,sc*3); } }
      else if(m.decor[i]){ const d=THEMES[G.floor].decor[m.decor[i]-1]; g.drawImage(sprCanvas(d),px,py,tz,tz); }
    }
  }
  for(const it of G.items){
    const i=idx(it.x,it.y); if(!m.seen[i]||it.x<x0||it.x>x1||it.y<y0||it.y>y1) continue;
    const bob=m.vis[i]?Math.round(Math.sin(RD.time*3+it.x*1.7)*0.5+0.5)*sc:0;
    g.drawImage(sprCanvas(it.def.spr),sx(it.x),sy(it.y)-bob,tz,tz);
  }
  if(G.path){ g.fillStyle='rgba(255,255,255,0.14)'; for(const n of G.path) g.fillRect(sx(n.x)+tz*0.4,sy(n.y)+tz*0.4,tz*0.2,tz*0.2); }
  const drawActor=(a)=>{
    let dx=0,dy=0; if(a.bump){ const k=Math.sin(a.bump.t*Math.PI)*(a.bump.small?0.15:0.4); dx=a.bump.dx*k; dy=a.bump.dy*k; }
    const bob=(a.isPlayer||a.ghost)?(a.ghost?Math.sin(RD.time*3+a.id)*sc:0):Math.round(Math.sin(RD.time*4+a.id)*0.5+0.5)*sc*(a.state==='sleep'?0:1);
    const px=sx(a.vx+dx),py=sy(a.vy+dy)-bob;
    g.save();
    if(a.ghost) g.globalAlpha=0.7+Math.sin(RD.time*5)*0.15;
    if(a.face<0){ g.translate(px+tz,py); g.scale(-1,1); g.drawImage(sprCanvas(a.spr),0,0,tz,tz); if(a.flash>0){ g.globalAlpha=clamp(a.flash,0,1); g.drawImage(sprWhite(a.spr),0,0,tz,tz);} }
    else { g.drawImage(sprCanvas(a.spr),px,py,tz,tz); if(a.flash>0){ g.globalAlpha=clamp(a.flash,0,1); g.drawImage(sprWhite(a.spr),px,py,tz,tz);} }
    g.restore();
    if(!a.isPlayer&&a.state==='sleep'){ g.fillStyle='#cfd0da'; g.font=`${sc*3}px monospace`; g.textAlign='left'; g.fillText('z',px+tz*0.75,py+sc*2+Math.sin(RD.time*2)*sc); }
    if(!a.isPlayer&&a.hp<a.hpMax){ const bw=tz*0.8,bx=px+tz*0.1,by=py-sc*1.5; g.fillStyle='#14121c'; g.fillRect(bx-1,by-1,bw+2,sc+2); g.fillStyle=a.boss?'#f3c53a':'#d2383c'; g.fillRect(bx,by,bw*a.hp/a.hpMax,sc); }
  };
  for(const a of G.mons){ if(!m.vis[idx(a.x,a.y)]) continue; drawActor(a); }
  if(G.state!=='dead') drawActor(p);
  else { g.save(); g.translate(sx(p.vx)+tz/2,sy(p.vy)+tz/2); g.rotate(Math.PI/2); g.drawImage(sprCanvas('player'),-tz/2,-tz/2,tz,tz); g.restore(); }
  if(FX.proj){ const q=FX.proj; const x=lerp(q.x,q.tx,q.t),y=lerp(q.y,q.ty,q.t)-Math.sin(q.t*Math.PI)*0.7; g.fillStyle='#5a3620'; g.fillRect(sx(x)+tz*0.3,sy(y)+tz*0.3,tz*0.4,tz*0.4); g.fillStyle='#8a5a3a'; g.fillRect(sx(x)+tz*0.35,sy(y)+tz*0.35,tz*0.2,tz*0.2); }
  for(const q of FX.parts){ g.globalAlpha=1-q.t/q.life; g.fillStyle=q.color; g.fillRect(sx(q.x),sy(q.y),q.sz*sc,q.sz*sc); } g.globalAlpha=1;
  for(let y=y0;y<=y1;y++)for(let x=x0;x<=x1;x++){
    const i=idx(x,y); if(!m.seen[i]) continue; const px=sx(x),py=sy(y);
    if(!m.vis[i]){ g.fillStyle='rgba(6,6,14,0.64)'; g.fillRect(px,py,tz,tz); }
    else { const d=Math.hypot(x-p.x,y-p.y); const a=clamp((d-2.5)/FOV_R*0.6,0,0.55); if(a>0.02){ g.fillStyle=`rgba(4,4,12,${a.toFixed(2)})`; g.fillRect(px,py,tz,tz);} }
  }
  if(FX.zap>0){ g.fillStyle=`rgba(120,200,255,${(FX.zap*0.5).toFixed(2)})`; g.fillRect(0,0,W,H); }
  if(!RD.vig){ const c=document.createElement('canvas'); c.width=W; c.height=H; const cg=c.getContext('2d'); const gr=cg.createRadialGradient(W/2,H/2,Math.min(W,H)*0.35,W/2,H/2,Math.max(W,H)*0.75); gr.addColorStop(0,'rgba(0,0,0,0)'); gr.addColorStop(1,'rgba(0,0,0,0.75)'); cg.fillStyle=gr; cg.fillRect(0,0,W,H); RD.vig=c; }
  g.drawImage(RD.vig,0,0,W,H);
  if(G.state==='dead'){ g.fillStyle='rgba(120,0,0,0.25)'; g.fillRect(0,0,W,H); }
  g.font=`${Math.max(10,sc*4)}px "Press Start 2P", monospace`; g.textAlign='center';
  for(const f of FX.floats){ const a=1-f.t; g.globalAlpha=a; const fx=sx(f.x)+tz/2, fy=sy(f.y)-f.t*tz*0.9; g.fillStyle='#14121c'; g.fillText(f.text,fx+2,fy+2); g.fillStyle=f.color; g.fillText(f.text,fx,fy); } g.globalAlpha=1;
}
