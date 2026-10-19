// dev-only autoplay bot: load with ?dev=1, then bot(n) / botRuns(k) in console
'use strict';
function bot(steps){
  let stuck=0;
  try{
    for(let i=0;i<steps&&G.state==='play';i++){
      const p=G.p,m=G.map;
      if(UI.open) UI.closeOverlay();
      const vis=G.mons.filter(a=>m.vis[idx(a.x,a.y)]);
      if(p.hp<p.hpMax*0.4){ const k=p.inv.findIndex(d=>d.kind==='potion'||d.kind==='food'); if(k>=0){useItem(k);continue;} }
      const eq=p.inv.findIndex(d=>(d.kind==='weapon'&&(!p.weapon||d.atk>p.weapon.atk))||(d.kind==='armor'&&!p.cls.noArmor&&(!p.armor||d.def>p.armor.def)));
      if(eq>=0){useItem(eq);continue;}
      if(vis.length){
        vis.sort((a,b)=>cheb(a,p)-cheb(b,p)); const t=vis[0];
        if(p.cd===0&&cheb(t,p)===1&&p.cls.ab.key!=='dash'){ useAbility(); continue; }
        if(cheb(t,p)===1){ tryMove(sign(t.x-p.x),sign(t.y-p.y)); continue; }
        const path=findPath(m,p.x,p.y,t.x,t.y,(x,y)=>!actorAt(x,y)||(x===t.x&&y===t.y));
        if(path&&path.length>1){ const n=path[0]; if(!tryMove(n.x-p.x,n.y-p.y)) wait(); } else wait();
        continue;
      }
      explore();
      if(!G.path&&/люк/.test(G.msgs[G.msgs.length-1].text)){ const any=findFrontier(pathPassAny); if(any>=0){ const path=findPath(m,p.x,p.y,any%MW,(any/MW)|0,pathPassAny); if(path&&path.length){ G.path=path; } } }
      if(G.path){ const n=G.path.shift(); if(!tryMove(n.x-p.x,n.y-p.y)) wait(); G.path=null; G.exploring=false; }
      else if(m.t[idx(p.x,p.y)]===T.STAIRS) tryDescend();
      else if(m.stairs&&m.seen[idx(m.stairs.x,m.stairs.y)]){ const path=findPath(m,p.x,p.y,m.stairs.x,m.stairs.y,(x,y)=>!actorAt(x,y)); if(path&&path.length){const n=path[0]; if(!tryMove(n.x-p.x,n.y-p.y)) wait();} else wait(); }
      else { wait(); if(++stuck>40){ return {err:'stuck at turn '+G.turn+' floor '+G.floor+' msgs '+G.msgs.slice(-3).map(m=>m.text).join(' | ')}; } }
    }
  }catch(e){ return {err:e.stack}; }
  return {state:G.state,floor:G.floor,turn:G.turn,kills:G.kills,hp:G.p.hp,hpMax:G.p.hpMax,lvl:G.p.lvl,atk:playerAtk(),def:playerDef(),gold:G.p.gold,cause:G.cause,inv:G.p.inv.map(d=>d.name),msgs:G.msgs.slice(-10).map(m=>m.text)};
}
function botRuns(k,clsId){ const res=[]; for(let r=0;r<k;r++){ UI.closeOverlay(); newGame(CLASSES.find(c=>c.id===clsId)||CLASSES[0]); const o=bot(8000); res.push(o.err?o:{floor:o.floor,turn:o.turn,kills:o.kills,lvl:o.lvl,cause:o.cause,state:o.state,atk:o.atk,def:o.def,gold:o.gold}); } return res; }
function botNear(max){ for(let i=0;i<max&&G.state==='play';i++){ const near=G.mons.some(a=>G.map.vis[idx(a.x,a.y)]&&cheb(a,G.p)<=3); if(near) return {i,floor:G.floor}; bot(1);} return {timeout:true,floor:G.floor}; }
