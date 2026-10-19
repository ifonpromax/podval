'use strict';
const FOV_R=7;
const G={state:'title',floor:0,map:null,p:null,mons:[],items:[],traps:[],msgs:[],turn:0,kills:0,path:null,dmap:null,win:false,cause:'',exploring:false,shop:null,daily:0,hinted:false};
const FX={shake:0,floats:[],parts:[],banner:null,zap:0,proj:null};
let nextId=1;

function msg(text,cls){ G.msgs.push({text,cls:cls||'',t:G.turn}); if(G.msgs.length>80) G.msgs.shift(); UI.log(); }
function hashSeed(a,b){ let h=(Math.imul(a,2654435761)^Math.imul(b,97))>>>0; h^=h>>>13; h=Math.imul(h,0x5bd1e995)>>>0; h^=h>>>15; return h>>>0; }
function todayKey(){ const d=new Date(); return d.getFullYear()*10000+(d.getMonth()+1)*100+d.getDate(); }

function newGame(cls,daily){
  cls=cls||CLASSES[0];
  G.floor=0; G.kills=0; G.turn=0; G.msgs=[]; G.win=false; G.cause=''; G.path=null; G.exploring=false; G.hinted=false; G.daily=daily?todayKey():0; G.robbed=0; G.zina=0; G.bossHit=false; G.boardSent=false; G.boardRes=null;
  try{ const pl=JSON.parse(localStorage.getItem('podval_played')||'[]'); if(!pl.includes(cls.id)) pl.push(cls.id); localStorage.setItem('podval_played',JSON.stringify(pl)); if(pl.length>=CLASSES.length) setTimeout(()=>ach('all_classes'),1500); }catch(e){}
  FX.floats=[]; FX.parts=[]; FX.shake=0;
  G.p={x:0,y:0,vx:0,vy:0,hp:cls.hp,hpMax:cls.hp,atk:cls.atk,def:cls.def,spd:cls.spd,lvl:1,xp:0,gold:0,inv:cls.start.map(id=>ITEMS[id]),weapon:null,armor:null,energy:100,st:{},name:cls.name,spr:cls.spr,isPlayer:true,bump:null,flash:0,face:1,fdx:1,fdy:0,id:0,cls,cd:0,lives:cls.lives||0};
  G.state='play';
  UI.el.hud.classList.remove('hidden');
  descend();
  msg(G.daily?`Забег дня ${String(G.daily).replace(/(\d{4})(\d\d)(\d\d)/,'$3.$2.$1')}. У всех сегодня один и тот же подвал.`:'Ты спускаешься в подвал. Назад дороги нет.','sys');
}

function descend(){
  G.floor++;
  if(G.daily) R.rng=mulberry32(hashSeed(G.daily,G.floor));
  const m=makeMap(G.floor); G.map=m;
  const p=G.p; p.x=m.start.x;p.y=m.start.y;p.vx=p.x;p.vy=p.y;
  RD.cam.x=p.x; RD.cam.y=p.y;
  G.mons=[]; G.items=[]; G.traps=[]; G.path=null; G.exploring=false;
  populate(m);
  G.shop=null;
  if(m.kiosk){
    const f=G.floor;
    const st=[{def:ITEMS.kefir,price:15,qty:3},{def:ITEMS.shaurma,price:10,qty:3},{def:ITEMS.seeds,price:8,qty:2},{def:ITEMS.boyara,price:25,qty:2},{def:ITEMS.energy,price:30,qty:1},{def:R.pick([ITEMS.sc_tele,ITEMS.sc_map,ITEMS.sc_zap,ITEMS.brick,ITEMS.spray]),price:35,qty:1}];
    const wpn=[ITEMS.w1,ITEMS.w2,ITEMS.w3,ITEMS.w4][clamp(Math.floor(f/2),0,3)];
    const arm=[ITEMS.a1,ITEMS.a2,ITEMS.a3][clamp(Math.floor((f-1)/2.5),0,2)];
    st.push({def:wpn,price:wpn.atk*22,qty:1},{def:arm,price:arm.def*28,qty:1});
    G.shop={stock:st,greet:R.pick(FLAVOR.zina)};
  }
  if(G.daily) R.rng=mulberry32((Date.now()^(Math.random()*1e9))>>>0);
  computeFOV(m,p.x,p.y,FOV_R);
  G.dmap=bfsMap(m,p.x,p.y,()=>true);
  const th=THEMES[G.floor];
  if(G.floor>=4){ ach('floor4'); if(G.turn<400) ach('speed'); }
  UI.banner(`Этаж ${G.floor}. ${th.name}`,th.sub);
  msg(`Этаж ${G.floor}: ${th.name}. ${R.pick(FLAVOR.enter)}`,'sys');
  AU.sfx('stairs');
  UI.hud(); saveRun();
}

function actorAt(x,y){ for(const a of G.mons) if(a.x===x&&a.y===y) return a; return null; }
function itemAt(x,y){ for(const it of G.items) if(it.x===x&&it.y===y) return it; return null; }
function trapAt(x,y){ for(const t of G.traps) if(t.x===x&&t.y===y) return t; return null; }
function freeTile(m,x,y){ return isWalk(m,x,y)&&!actorAt(x,y)&&!(G.p.x===x&&G.p.y===y); }
function spawnMon(key,x,y){
  const d=MON[key];
  const m=Object.assign({},d,{type:key,x,y,vx:x,vy:y,hp:d.hp,hpMax:d.hp,energy:R.i(0,60),state:'sleep',lost:0,bump:null,flash:0,face:-1,id:nextId++,tcount:0,tx:x,ty:y,stun:0,flee:0});
  if(!d.boss){ const over=Math.max(0,G.floor-d.minF); m.hp=m.hpMax=Math.round(d.hp*(1+0.14*over)); m.atk=d.atk+Math.floor(over/3); m.xp=d.xp+over; }
  G.mons.push(m); return m;
}
function randomFloorInRoom(m,r,tries=30){
  for(let i=0;i<tries;i++){ const x=R.i(r.x,r.x+r.w-1),y=R.i(r.y,r.y+r.h-1); if(freeTile(m,x,y)&&!itemAt(x,y)&&!trapAt(x,y)&&m.t[idx(x,y)]===T.FLOOR) return {x,y}; }
  return null;
}
function populate(m){
  const f=G.floor; const rooms=m.rooms.slice(1);
  const table=monTable(f);
  let n=6+f*2;
  while(n>0){
    const key=R.weighted(table); const d=MON[key]; const r=R.pick(rooms); const pos=randomFloorInRoom(m,r); if(!pos){n--;continue;}
    if(d.pack){ const c=R.i(d.pack[0],d.pack[1]); for(let i=0;i<c;i++){ const q=randomFloorInRoom(m,r); if(q) spawnMon(key,q.x,q.y);} n-=Math.max(1,c-1); }
    else { spawnMon(key,pos.x,pos.y); n--; }
  }
  if(f===4||f===MAX_FLOOR){
    const b=f===4?'dvornik':'upravdom'; const r=m.bossRoom; let pos=null;
    for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,-1],[2,0],[-2,0]]){ if(freeTile(m,r.cx+dx,r.cy+dy)){pos={x:r.cx+dx,y:r.cy+dy};break;} }
    if(!pos) pos=randomFloorInRoom(m,r);
    if(pos) spawnMon(b,pos.x,pos.y);
  }
  const it=itemTable(f); let k=5+Math.floor(f*1.2);
  while(k>0){ const r=R.pick(m.rooms); const pos=randomFloorInRoom(m,r); if(pos) G.items.push({x:pos.x,y:pos.y,def:ITEMS[R.weighted(it)]}); k--; }
  let g=4+f;
  while(g>0){ const r=R.pick(m.rooms); const pos=randomFloorInRoom(m,r); if(pos) G.items.push({x:pos.x,y:pos.y,def:ITEMS.gold,amt:R.i(3,8)+f*2}); g--; }
  if(f===1){ const pos=randomFloorInRoom(m,m.rooms[0]); if(pos) G.items.push({x:pos.x,y:pos.y,def:ITEMS.kefir}); }
  // special rooms
  if(m.store){
    const s=m.store; const cells=[]; for(let y=s.y;y<s.y+s.h;y++)for(let x=s.x;x<s.x+s.w;x++) cells.push({x,y});
    R.shuffle(cells);
    const loot=[ITEMS[R.weighted(it)],ITEMS[R.weighted(it)],R.pick([ITEMS.sc_zap,ITEMS.energy,ITEMS.boyara,ITEMS.brick])];
    const eq=[ITEMS.w2,ITEMS.w3,ITEMS.a2,ITEMS.w4,ITEMS.a3].filter(d=>(d.atk||d.def*1.5)<=f+2); if(eq.length) loot.push(R.pick(eq));
    loot.forEach((d,i)=>{ if(cells[i]) G.items.push({x:cells[i].x,y:cells[i].y,def:d}); });
    if(cells[loot.length]) G.items.push({x:cells[loot.length].x,y:cells[loot.length].y,def:ITEMS.gold,amt:20+f*10});
    const holders=G.mons.filter(a=>!a.boss);
    if(holders.length){ R.pick(holders).hasKey=true; }
    else { const pos=randomFloorInRoom(m,R.pick(m.rooms)); if(pos) G.items.push({x:pos.x,y:pos.y,def:ITEMS.key}); }
  }
  if(m.benchRoom){
    const b=m.benchRoom; let n=0;
    for(const [dx,dy] of R.shuffle(DIRS8.slice())){ if(n>=3) break; const x=b.x+dx,y=b.y+dy; if(freeTile(m,x,y)&&!itemAt(x,y)&&m.t[idx(x,y)]===T.FLOOR){ const bb=spawnMon('babka',x,y); bb.noWake=true; bb.bench=true; bb.hp=bb.hpMax=Math.round(bb.hpMax*1.2); n++; } }
  }
  // traps
  let tr=1+Math.floor(f/2);
  const kinds=[{v:'wire',w:5},{v:'board',w:4},{v:'hatch',w:f<MAX_FLOOR?3:0}].filter(e=>e.w>0);
  let guard=0;
  while(tr>0&&guard++<200){
    const x=R.i(1,MW-2),y=R.i(1,MH-2);
    if(m.t[idx(x,y)]!==T.FLOOR||itemAt(x,y)||trapAt(x,y)||actorAt(x,y)) continue;
    if(cheb({x,y},m.start)<4) continue;
    G.traps.push({x,y,kind:R.weighted(kinds),seen:false}); tr--;
  }
}

// ---- player ----
function playerAtk(){ return G.p.atk+(G.p.weapon?G.p.weapon.atk:0); }
function playerDef(){ return G.p.def+(G.p.armor?G.p.armor.def:0); }

function tryMove(dx,dy){
  if(G.state!=='play') return false;
  const p=G.p,m=G.map;
  if(p.st.drunk&&R.chance(0.3)){ const d=R.pick(DIRS8); dx=d[0];dy=d[1]; msg('Тебя шатает.','bad'); }
  const nx=p.x+dx,ny=p.y+dy;
  if(!inb(nx,ny)) return false;
  if(dx) p.face=dx; p.fdx=dx; p.fdy=dy;
  const mon=actorAt(nx,ny);
  if(mon){ attack(p,mon); endTurn(); return true; }
  const t=m.t[idx(nx,ny)];
  if(t===T.DOOR){ m.t[idx(nx,ny)]=T.DOOR_OPEN; AU.sfx('door'); msg('Дверь со скрипом открывается.'); endTurn(); return true; }
  if(t===T.KIOSK){ G.path=null; G.exploring=false; UI.openShop(); return false; }
  if(t===T.GYM){ G.path=null; G.exploring=false; UI.openGym(); return false; }
  if(t===T.LOCKED){
    G.path=null; G.exploring=false;
    const ki=p.inv.findIndex(d=>d.kind==='key');
    if(ki<0){ msg('Заперто. Ключ у кого-то на этаже.','bad'); AU.sfx('bump'); return false; }
    p.inv.splice(ki,1); m.t[idx(nx,ny)]=T.DOOR_OPEN; if(m.store) m.store.opened=true; AU.sfx('door'); msg('Ключ подошёл. Кладовка открыта.','good'); ach('storeroom'); UI.hud(); endTurn(); return true;
  }
  if(t===T.WALL||t===T.CRATE||!diagOk(m,p.x,p.y,nx,ny)){ p.bump={dx,dy,t:1,small:true}; AU.sfx('bump'); return false; }
  p.x=nx;p.y=ny;
  AU.sfx('step');
  pickup();
  if(m.t[idx(nx,ny)]===T.STAIRS) msg('Лестница вниз. Enter или кнопка «Спуститься».','good');
  if(checkTrap()) return true;
  endTurn(); return true;
}
function wait(){ if(G.state!=='play')return; G.path=null; endTurn(); }

function checkTrap(){
  const p=G.p; const tr=trapAt(p.x,p.y); if(!tr) return false;
  G.path=null; G.exploring=false; tr.seen=true;
  if(tr.kind==='wire'){ const d=3+G.floor; FX.zap=0.6; AU.sfx('zap'); msg(`Оголённый провод! Током: -${d}.`,'bad'); damage(p,d,null,true); if(G.state!=='play') return true; endTurn(); return true; }
  if(tr.kind==='board'){ AU.sfx('door'); msg('СКРИИИП. Половица. Все проснулись.','bad'); for(const a of G.mons){ if(cheb(a,p)<=12&&a.state==='sleep'&&!a.noWake){ a.state='chase'; a.tx=p.x;a.ty=p.y; } } G.traps.splice(G.traps.indexOf(tr),1); endTurn(); return true; }
  if(tr.kind==='hatch'){ const d=R.i(2,5); msg(`Люк! Ты проваливаешься этажом ниже и ушибаешься: -${d}.`,'bad'); ach('hatch'); FX.shake=12; AU.sfx('hurt'); p.hp-=d; addFloat(p.x,p.y,'-'+d,'#ff6a6a'); if(p.hp<=0){ die(null,'люк'); return true; } descend(); p.x=0; const m=G.map; for(let i=0;i<500;i++){ const x=R.i(1,MW-2),y=R.i(1,MH-2); if(freeTile(m,x,y)&&m.t[idx(x,y)]===T.FLOOR){ p.x=x;p.y=y;p.vx=x;p.vy=y; RD.cam.x=x;RD.cam.y=y; break; } } computeFOV(m,p.x,p.y,FOV_R); UI.hud(); saveRun(); return true; }
  return false;
}
function revealTraps(){
  const p=G.p,m=G.map; const cat=p.cls&&p.cls.id==='barsik';
  for(const t of G.traps){ if(t.seen) continue; const d=cheb(t,p); if(d<=(cat?4:2)&&m.vis[idx(t.x,t.y)]&&R.chance(cat?0.8:0.35)){ t.seen=true; msg(`${cat?'Барсик чует':'Ты замечаешь'}: ${TRAPS[t.kind].name.toLowerCase()}.`,'sys'); } }
}

function pickup(){
  const p=G.p; const it=itemAt(p.x,p.y); if(!it) return;
  if(it.def.kind==='gold'){ p.gold+=it.amt; G.items.splice(G.items.indexOf(it),1); msg(`Нашёл ${it.amt} ₽ мелочью.`,'gold'); AU.sfx('coin'); spawnParts(p.x,p.y,'#f3c53a',6); if(p.gold>=500) ach('rich'); UI.hud(); return; }
  if(p.inv.length>=10){ msg(`${it.def.name}: карманы полны.`,'bad'); return; }
  p.inv.push(it.def); G.items.splice(G.items.indexOf(it),1); msg(`Подобрал: ${it.def.name}.`,'good'); AU.sfx('pickup'); UI.hud();
}

function useItem(i){
  const p=G.p; const d=p.inv[i]; if(!d||G.state!=='play') return;
  if(d.kind==='potion'){
    if(d.heal) heal(p,d.heal);
    if(d.drunk){ p.st.drunk=(p.st.drunk||0)+d.drunk; msg('Боярышник заходит. Мир плывёт.','bad'); }
    if(d.energy){ p.st.energy=(p.st.energy||0)+d.energy; msg('Сердце стучит как отбойник. Ты ускорился!','good'); }
    AU.sfx('drink'); msg(`Выпил: ${d.name}.`);
  } else if(d.kind==='food'){
    heal(p,d.heal); AU.sfx('drink'); msg(p.cls.id==='barsik'?'Барсик вытащил из шаурмы мясо.':'Шаурма… а ничего такая.');
    if(R.chance(p.cls.id==='barsik'?0.05:0.25)){ p.st.poison=(p.st.poison||0)+4; msg('Так. Шаурма была не очень. Отравление!','bad'); ach('shaurma'); }
  } else if(d.kind==='scroll'){
    readScroll(d.effect);
  } else if(d.kind==='throw'){
    if(!throwItem(d.effect)) return;
  } else if(d.kind==='key'){
    msg('Подойди к запертой двери и шагни в неё.'); return;
  } else if(d.kind==='weapon'){
    const old=p.weapon; p.weapon=d; p.inv.splice(i,1); if(old) p.inv.push(old); msg(`В ${p.cls.id==='barsik'?'зубах':'руках'}: ${d.name} (+${d.atk} атк).`,'good'); AU.sfx('equip'); UI.hud(); endTurn(); return;
  } else if(d.kind==='armor'){
    if(p.cls.noArmor){ msg('На кота это не налезает.','bad'); return; }
    const old=p.armor; p.armor=d; p.inv.splice(i,1); if(old) p.inv.push(old); msg(`Надел: ${d.name} (+${d.def} защ).`,'good'); AU.sfx('equip'); UI.hud(); endTurn(); return;
  } else return;
  p.inv.splice(i,1); UI.hud(); endTurn();
}
function sellPrice(d){ return d.kind==='weapon'?d.atk*7:d.kind==='armor'?d.def*9:d.kind==='scroll'?8:d.kind==='food'?3:4; }
function buyItem(i){
  const s=G.shop&&G.shop.stock[i]; const p=G.p; if(!s) return;
  if(s.qty<=0){ msg('Тётя Зина: «Кончилось.»','talk'); return; }
  if(p.gold<s.price){ msg('Тётя Зина: «Без денег не отпускаю.»','talk'); AU.sfx('bump'); return; }
  if(p.inv.length>=10){ msg('Карманы полны.','bad'); return; }
  p.gold-=s.price; s.qty--; p.inv.push(s.def); AU.sfx('coin'); msg(`Купил: ${s.def.name} за ${s.price} ₽.`,'gold'); G.zina=(G.zina||0)+1; if(G.zina>=5) ach('zina'); UI.hud(); saveRun();
}
function sellItem(i){
  const p=G.p; const d=p.inv[i]; if(!d) return;
  const pr=sellPrice(d); p.inv.splice(i,1); p.gold+=pr; AU.sfx('coin'); msg(`Продал: ${d.name} за ${pr} ₽.`,'gold'); UI.hud(); saveRun();
}
function dropItem(i){ const p=G.p; const d=p.inv[i]; if(!d) return; p.inv.splice(i,1); if(!itemAt(p.x,p.y)) G.items.push({x:p.x,y:p.y,def:d}); msg(`Выбросил: ${d.name}.`); UI.hud(); saveRun(); }
function heal(a,n){ const before=a.hp; a.hp=Math.min(a.hpMax,a.hp+n); const got=a.hp-before; if(got>0) addFloat(a.x,a.y,'+'+got,'#4caf50'); }

function readScroll(e){
  const p=G.p,m=G.map;
  AU.sfx('scroll');
  if(e==='tele'){
    for(let i=0;i<300;i++){ const x=R.i(1,MW-2),y=R.i(1,MH-2); if(freeTile(m,x,y)&&m.t[idx(x,y)]===T.FLOOR&&cheb({x,y},p)>8){ spawnParts(p.x,p.y,'#9b4fd0',14); p.x=x;p.y=y;p.vx=x;p.vy=y; RD.cam.x=x;RD.cam.y=y; spawnParts(x,y,'#9b4fd0',14); msg('Хлоп. Ты уже не там, где был.','good'); G.path=null; return; } }
    msg('Записка размокла. Ничего не произошло.');
  } else if(e==='map'){
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ const i=idx(x,y); if(m.t[i]!==T.WALL) m.seen[i]=1; else if(DIRS8.some(([dx,dy])=>inb(x+dx,y+dy)&&m.t[idx(x+dx,y+dy)]!==T.WALL)) m.seen[i]=1; }
    for(const t of G.traps) t.seen=true;
    msg('План БТИ. Теперь ты знаешь, где лестница и где ловушки.','good');
  } else if(e==='zap'){
    let hit=0; FX.zap=1;
    for(const mon of G.mons.slice()){ if(m.vis[idx(mon.x,mon.y)]){ damage(mon,8+G.floor*2,p,true); hit++; } }
    FX.shake=8; AU.sfx('zap');
    msg(hit?`Электрик дал фазу: ${hit} ${plural(hit,'цель','цели','целей')} под током.`:'Фаза ушла в никуда.','good');
  }
}
function throwItem(e){
  const p=G.p,m=G.map;
  if(e==='seeds'){
    let n=0; for(const a of G.mons){ if(m.vis[idx(a.x,a.y)]&&cheb(a,p)<=6&&!a.boss){ a.stun=3; if(a.state==='sleep') a.state='wander'; n++; } }
    spawnParts(p.x,p.y,'#e8b890',12); AU.sfx('scroll');
    msg(n?`Семки в толпу! ${n} ${plural(n,'враг лузгает','врага лузгают','врагов лузгают')}.`:'Семки рассыпались. Никому не интересно.','good');
    return true;
  }
  if(e==='brick'){
    let t=null,bd=99; for(const a of G.mons){ if(!m.vis[idx(a.x,a.y)]) continue; const d=cheb(a,p); if(d<=6&&d<bd&&lineClear(m,p.x,p.y,a.x,a.y)){bd=d;t=a;} }
    if(!t){ msg('Некого бить кирпичом.'); return false; }
    FX.proj={x:p.x,y:p.y,tx:t.x,ty:t.y,t:0,color:'#8c1f2a'}; const dmg=7+G.floor; G.lastHit='brick';
    msg(`Кирпич летит в ${t.name}: -${dmg}.`,'good'); AU.sfx('crit'); damage(t,dmg,p,true); G.lastHit=null;
    return true;
  }
  if(e==='spray'){
    let n=0; for(const a of G.mons.slice()){ if(cheb(a,p)<=1){ n++; if(a.ghost){ msg('Призрак ненавидит краску!','good'); damage(a,10,p,true); } else { a.flee=4; a.state='chase'; damage(a,2,p,true); } } }
    spawnParts(p.x,p.y,'#d2383c',16); AU.sfx('zap'); FX.shake=3;
    msg(n?`Пшшш! ${n} ${plural(n,'сосед ослеплён','соседа ослеплены','соседей ослеплены')} и бегут.`:'Пшшш. Красиво, но никого рядом.','good');
    return true;
  }
  return false;
}
function plural(n,a,b,c){ const n10=n%10,n100=n%100; if(n10===1&&n100!==11) return a; if(n10>=2&&n10<=4&&(n100<10||n100>=20)) return b; return c; }

// ---- abilities ----
function useAbility(){
  const p=G.p,m=G.map; if(G.state!=='play') return;
  const ab=p.cls.ab;
  if(p.cd>0){ msg(`${ab.name}: ещё ${p.cd} ${plural(p.cd,'ход','хода','ходов')}.`,'bad'); AU.sfx('bump'); return; }
  G.path=null; G.exploring=false;
  if(ab.key==='kick'){
    let t=actorAt(p.x+p.fdx,p.y+p.fdy); if(!t) for(const [dx,dy] of DIRS8){ t=actorAt(p.x+dx,p.y+dy); if(t) break; }
    if(!t){ msg('Некого пинать.'); return; }
    const dx=sign(t.x-p.x),dy=sign(t.y-p.y); p.fdx=dx;p.fdy=dy; if(dx)p.face=dx;
    p.bump={dx,dy,t:1}; let dmg=Math.max(2,playerAtk()*2-t.def);
    let pushed=0; for(let i=0;i<2;i++){ const nx=t.x+dx,ny=t.y+dy; if(isWalk(m,nx,ny)&&!actorAt(nx,ny)&&diagOk(m,t.x,t.y,nx,ny)){ t.x=nx;t.y=ny;pushed++; } else { if(i===0||pushed) dmg+=3; break; } }
    msg(`С НОГИ! ${t.name} ${pushed?'отлетает':'впечатывается в стену'}: -${dmg}.`,'good'); AU.sfx('crit'); FX.shake=6;
    damage(t,dmg,p,true);
  } else if(ab.key==='shout'){
    let n=0; for(const a of G.mons){ if(m.vis[idx(a.x,a.y)]){ a.stun=2; n++; } }
    msg(n?`«СТОЯТЬ!» ${n} ${plural(n,'враг замер','врага замерли','врагов замерли')}.`:'«СТОЯТЬ!» Эхо. Никого.','good'); AU.sfx('boss'); FX.shake=5;
  } else if(ab.key==='dash'){
    let dx=p.fdx,dy=p.fdy; if(!dx&&!dy){ dx=p.face; }
    let steps=0;
    for(let i=0;i<3;i++){ const nx=p.x+dx,ny=p.y+dy; if(!isWalk(m,nx,ny)||actorAt(nx,ny)||!diagOk(m,p.x,p.y,nx,ny)) break; spawnParts(p.x,p.y,'#5ad0e8',3); p.x=nx;p.y=ny; steps++; pickup(); if(trapAt(nx,ny)) break; }
    if(!steps){ msg('Впереди стена.'); return; }
    msg(`Рывок на ${steps} ${plural(steps,'клетку','клетки','клеток')}!`,'good'); AU.sfx('scroll');
    if(checkTrap()) { p.cd=ab.cd; UI.hud(); return; }
  } else if(ab.key==='hiss'){
    let n=0; for(const a of G.mons){ if(m.vis[idx(a.x,a.y)]&&cheb(a,p)<=3&&!a.boss){ a.flee=4; a.state='chase'; n++; } }
    msg(n?`ШШШШ! ${n} ${plural(n,'враг','врага','врагов')} в ужасе.`:'ШШШШ! Пусто.','good'); AU.sfx('zap'); spawnParts(p.x,p.y,'#ffffff',10);
  }
  p.cd=ab.cd; UI.hud(); endTurn();
}

// ---- combat ----
function attack(att,def,ranged){
  const atk=att.isPlayer?playerAtk():att.atk;
  const dfv=def.isPlayer?playerDef():def.def;
  let dmg=Math.max(1,atk+R.i(-1,1)-dfv);
  let crit=false;
  if(R.chance(att.isPlayer?0.12:0.05)){ dmg=dmg*2; crit=true; }
  if(!ranged) att.bump={dx:sign(def.x-att.x),dy:sign(def.y-att.y),t:1};
  if(def.x!==att.x) att.face=sign(def.x-att.x);
  if(def.isPlayer&&def.cls.dodge&&R.chance(def.cls.dodge)){ addFloat(def.x,def.y,'мимо','#b8d8ff'); msg(`${att.name} ${att.a} воздух. Барсик увернулся.`,'good'); AU.sfx('step'); return; }
  damage(def,dmg,att,false,crit);
  if(def.hp>0&&def.isPlayer){
    if(att.steal&&G.p.gold>0&&R.chance(0.35)){ const s=Math.min(G.p.gold,(att.bigSteal?15:5)+G.floor*3); G.p.gold-=s; msg(`${att.name} вытащил ${s} ₽. «${R.pick(FLAVOR[att.type]||FLAVOR.gopnik)}»`,'bad'); G.robbed=(G.robbed||0)+1; if(G.robbed>=5) ach('robbed'); }
    if(att.poison&&R.chance(0.4)){ G.p.st.poison=(G.p.st.poison||0)+3; msg('От бомжа несёт так, что ты отравлен.','bad'); }
  }
}
function damage(def,dmg,src,magic,crit){
  def.hp-=dmg; def.flash=1;
  addFloat(def.x,def.y,(crit?'!':'')+dmg,def.isPlayer?'#ff6a6a':crit?'#f3c53a':'#fff');
  spawnParts(def.x,def.y,def.ghost?'#b8d8ff':def.animal?'#8c1f2a':'#d2383c',crit?10:5);
  if(def.isPlayer){
    FX.shake=Math.max(FX.shake,crit?10:5); AU.sfx('hurt'); haptic(crit?'heavy':'medium');
    if(src){ msg(`${src.name} ${src.a||'бьёт'} тебя: -${dmg}${crit?' (крит!)':''}.`,'bad'); if(src.boss) G.bossHit=true; }
    if(def.hp<=0) die(src);
    UI.hud();
  } else {
    AU.sfx(crit?'crit':'hit');
    if(!magic) msg(`Ты ${crit?'со всей дури ':''}бьёшь: ${def.name} -${dmg}.`);
    if(def.hp<=0) killMon(def);
  }
}
function killMon(mon){
  G.mons.splice(G.mons.indexOf(mon),1); G.kills++;
  spawnParts(mon.x,mon.y,mon.ghost?'#b8d8ff':'#8c1f2a',14);
  msg(`${mon.name} ${mon.ghost?'растворяется':mon.animal?'сдох':'падает'}.`,'good');
  AU.sfx('kill');
  gainXp(mon.xp);
  ach('first_blood'); if(mon.ghost) ach('ghost'); if(G.lastHit==='brick') ach('brick');
  if(mon.boss&&!G.bossHit) ach('nodmg_boss');
  if(mon.hasKey){ if(itemAt(mon.x,mon.y)){ const it=itemAt(mon.x,mon.y); G.items.splice(G.items.indexOf(it),1); } G.items.push({x:mon.x,y:mon.y,def:ITEMS.key}); msg(`У ${mon.name} выпал ключ!`,'lvl'); }
  if(mon.bench&&!itemAt(mon.x,mon.y)) G.items.push({x:mon.x,y:mon.y,def:ITEMS.gold,amt:10+G.floor*4});
  if(R.chance(mon.boss?1:0.3)&&!itemAt(mon.x,mon.y)) G.items.push({x:mon.x,y:mon.y,def:ITEMS.gold,amt:R.i(2,6)+G.floor*(mon.boss?10:1)});
  if(mon.boss){ for(const [dx,dy] of DIRS8){ const x=mon.x+dx,y=mon.y+dy; if(isWalk(G.map,x,y)&&!itemAt(x,y)){ G.items.push({x,y,def:R.pick([ITEMS.w3,ITEMS.a2,ITEMS.w4,ITEMS.a3])}); break; } } }
  if(mon.type==='upravdom') win();
  else if(mon.type==='dvornik'){ msg('Дворник повержен. «Кто теперь мести будет…»','lvl'); FX.shake=10; ach('dvornik'); }
}
function xpNeed(l){ return Math.floor(10*Math.pow(l,1.75)); }
function gainXp(n){
  const p=G.p; p.xp+=Math.round(n*(p.cls.xpMul||1));
  while(p.xp>=xpNeed(p.lvl)){ p.xp-=xpNeed(p.lvl); p.lvl++; p.hpMax+=5; p.hp=Math.min(p.hpMax,p.hp+7); if(p.lvl%2===0) p.atk+=1; if(p.lvl%4===0) p.def+=1; msg(`Уровень ${p.lvl}! Ты стал крепче.`,'lvl'); addFloat(p.x,p.y,'LVL UP','#f3c53a'); AU.sfx('levelup'); spawnParts(p.x,p.y,'#f3c53a',16); if(p.lvl>=10) ach('lvl10'); }
  UI.hud();
}
function die(src,causeOverride){
  if(G.state!=='play') return;
  const p=G.p;
  if(p.lives>0){ p.lives--; p.hp=Math.ceil(p.hpMax/2); msg('Барсик использует запасную жизнь. Осталось: '+p.lives+'.','lvl'); addFloat(p.x,p.y,'9 ЖИЗНЕЙ','#f3c53a'); AU.sfx('levelup'); spawnParts(p.x,p.y,'#ffffff',20); UI.hud(); return; }
  G.state='dead'; G.cause=causeOverride||(src?src.name:'отравление');
  FX.shake=14; AU.sfx('die'); G.path=null;
  msg('Ты сдох.','bad');
  saveBest(); recordRun(); clearRun(); UI.hud(); setTimeout(()=>UI.showDeath(),1100);
}
function win(){ G.state='win'; G.win=true; AU.sfx('win'); G.path=null; msg('Управдом повержен! Долги списаны.','lvl'); ach('win'); if(G.p.cls.id==='barsik') ach('win_barsik'); saveBest(); recordRun(); clearRun(); setTimeout(()=>UI.showWin(),1400); }
// ---- achievements ----
function loadAch(){ try{ return JSON.parse(localStorage.getItem('podval_ach')||'{}'); }catch(e){ return {}; } }
function ach(id){
  const a=loadAch(); if(a[id]) return; const def=ACH.find(x=>x.id===id); if(!def) return;
  a[id]=Date.now(); try{ localStorage.setItem('podval_ach',JSON.stringify(a)); }catch(e){}
  UI.toast(def); AU.sfx('levelup');
}
function gymBuy(opt){
  const p=G.p,m=G.map; if(!m.gym||m.gym.used) return;
  const price=25+G.floor*15;
  if(p.gold<price){ msg('Качок на входе: «Абонемент дорогой, братан.»','talk'); AU.sfx('bump'); return; }
  p.gold-=price; m.gym.used=true;
  if(opt==='atk'){ p.atk+=1; msg('Потягал железо. +1 атака навсегда.','lvl'); }
  else { p.hpMax+=6; p.hp+=6; msg('Покачал пресс. +6 к максимуму HP.','lvl'); }
  addFloat(p.x,p.y,'+','#f3c53a'); spawnParts(p.x,p.y,'#f3c53a',10); AU.sfx('levelup'); ach('gym'); UI.hud(); UI.closeOverlay(); endTurn();
}
function score(){ return G.p.gold+G.kills*10+(G.floor-1)*100+(G.win?1000:0); }
function saveBest(){ try{ const b=loadBest(); const s=score(); const nb={floor:Math.max(b.floor||0,G.floor),score:Math.max(b.score||0,s),runs:(b.runs||0)+1,wins:(b.wins||0)+(G.win?1:0)}; localStorage.setItem('podval_best',JSON.stringify(nb)); }catch(e){} }
function loadBest(){ try{ return JSON.parse(localStorage.getItem('podval_best')||'{}'); }catch(e){ return {}; } }
function recordRun(){ try{ const list=JSON.parse(localStorage.getItem('podval_runs')||'[]'); list.unshift({cls:G.p.cls.id,floor:G.floor,score:score(),cause:G.win?'победа':G.cause,win:G.win,daily:G.daily,turn:G.turn,kills:G.kills,date:Date.now()}); localStorage.setItem('podval_runs',JSON.stringify(list.slice(0,12))); }catch(e){} }
function loadRuns(){ try{ return JSON.parse(localStorage.getItem('podval_runs')||'[]'); }catch(e){ return []; } }
function shareText(){ const p=G.p; const th=THEMES[G.floor]; return G.win?`ПОДВАЛ: ${p.name} прошёл все 8 этажей и победил Управдома! Счёт ${score()}, ${G.kills} убитых. ${G.daily?'Забег дня. ':''}https://ifonpromax.github.io/podval/`:`ПОДВАЛ: ${p.name} дошёл до этажа ${G.floor} (${th.name}) и сдох от: ${G.cause}. Счёт ${score()}, ${G.kills} убитых. ${G.daily?'Забег дня. ':''}Сможешь глубже? https://ifonpromax.github.io/podval/`; }

// ---- save / continue ----
function saveRun(){
  if(G.state!=='play') return;
  try{
    const p=G.p,m=G.map;
    const data={v:2,floor:G.floor,turn:G.turn,kills:G.kills,hinted:G.hinted,daily:G.daily,robbed:G.robbed,zina:G.zina,bossHit:G.bossHit,
      map:{t:Array.from(m.t),seen:Array.from(m.seen),decor:Array.from(m.decor),rooms:m.rooms,start:m.start,stairs:m.stairs,bossRoom:m.bossRoom,kiosk:m.kiosk,store:m.store,gym:m.gym,benchRoom:m.benchRoom,special:m.special},
      shop:G.shop?{stock:G.shop.stock.map(s=>({id:s.def.id,price:s.price,qty:s.qty})),greet:G.shop.greet}:null,
      mons:G.mons.map(a=>({type:a.type,x:a.x,y:a.y,hp:a.hp,hpMax:a.hpMax,atk:a.atk,xp:a.xp,state:a.state,energy:a.energy,tcount:a.tcount,tx:a.tx,ty:a.ty,stun:a.stun,flee:a.flee,hasKey:a.hasKey,noWake:a.noWake,bench:a.bench})),
      items:G.items.map(i=>({x:i.x,y:i.y,id:i.def.id,amt:i.amt})),
      traps:G.traps,
      p:{cls:p.cls.id,x:p.x,y:p.y,hp:p.hp,hpMax:p.hpMax,atk:p.atk,def:p.def,lvl:p.lvl,xp:p.xp,gold:p.gold,inv:p.inv.map(d=>d.id),weapon:p.weapon?p.weapon.id:null,armor:p.armor?p.armor.id:null,energy:p.energy,st:p.st,cd:p.cd,lives:p.lives,fdx:p.fdx,fdy:p.fdy,face:p.face},
      msgs:G.msgs.slice(-8)};
    localStorage.setItem('podval_run',JSON.stringify(data));
  }catch(e){}
}
function hasSavedRun(){ try{ const d=JSON.parse(localStorage.getItem('podval_run')||'null'); return d&&d.v===2?d:null; }catch(e){ return null; } }
function clearRun(){ try{ localStorage.removeItem('podval_run'); }catch(e){} }
function loadRun(){
  const d=hasSavedRun(); if(!d) return false;
  const cls=CLASSES.find(c=>c.id===d.p.cls)||CLASSES[0];
  G.floor=d.floor; G.turn=d.turn; G.kills=d.kills; G.hinted=d.hinted; G.daily=d.daily||0; G.win=false; G.cause=''; G.path=null; G.exploring=false; G.msgs=d.msgs||[]; G.robbed=d.robbed||0; G.zina=d.zina||0; G.bossHit=!!d.bossHit;
  FX.floats=[]; FX.parts=[]; FX.shake=0;
  const m={w:MW,h:MH,t:Uint8Array.from(d.map.t),seen:Uint8Array.from(d.map.seen),vis:new Uint8Array(MW*MH),decor:Uint8Array.from(d.map.decor),rooms:d.map.rooms,floor:d.floor,start:d.map.start,stairs:d.map.stairs,bossRoom:d.map.bossRoom,kiosk:d.map.kiosk,store:d.map.store||null,gym:d.map.gym||null,benchRoom:d.map.benchRoom||null,special:d.map.special||null};
  G.map=m;
  const q=d.p;
  G.p={x:q.x,y:q.y,vx:q.x,vy:q.y,hp:q.hp,hpMax:q.hpMax,atk:q.atk,def:q.def,spd:cls.spd,lvl:q.lvl,xp:q.xp,gold:q.gold,inv:q.inv.map(id=>ITEMS[id]).filter(Boolean),weapon:q.weapon?ITEMS[q.weapon]:null,armor:q.armor?ITEMS[q.armor]:null,energy:q.energy,st:q.st||{},name:cls.name,spr:cls.spr,isPlayer:true,bump:null,flash:0,face:q.face||1,fdx:q.fdx,fdy:q.fdy,id:0,cls,cd:q.cd||0,lives:q.lives||0};
  G.mons=d.mons.map(a=>{ const base=MON[a.type]; return Object.assign({},base,{type:a.type,x:a.x,y:a.y,vx:a.x,vy:a.y,hp:a.hp,hpMax:a.hpMax,atk:a.atk,xp:a.xp,state:a.state,energy:a.energy,tcount:a.tcount,tx:a.tx,ty:a.ty,stun:a.stun||0,flee:a.flee||0,hasKey:!!a.hasKey,noWake:!!a.noWake,bench:!!a.bench,lost:0,bump:null,flash:0,face:-1,id:nextId++}); });
  G.items=d.items.map(i=>({x:i.x,y:i.y,def:ITEMS[i.id],amt:i.amt})).filter(i=>i.def);
  G.traps=d.traps||[];
  G.shop=d.shop?{stock:d.shop.stock.map(s=>({def:ITEMS[s.id],price:s.price,qty:s.qty})).filter(s=>s.def),greet:d.shop.greet}:null;
  RD.cam.x=G.p.x; RD.cam.y=G.p.y;
  G.state='play'; UI.el.hud.classList.remove('hidden');
  computeFOV(m,G.p.x,G.p.y,FOV_R); G.dmap=bfsMap(m,G.p.x,G.p.y,()=>true);
  UI.banner(`Этаж ${G.floor}. ${THEMES[G.floor].name}`,'продолжаем');
  msg('Ты возвращаешься в подвал. Он тебя ждал.','sys'); UI.hud(); UI.log();
  return true;
}

// ---- turns ----
function endTurn(){
  const p=G.p;
  p.energy-=100;
  let guard=0;
  while(p.energy<100&&G.state==='play'&&guard++<10){
    G.turn++;
    G.dmap=bfsMap(G.map,p.x,p.y,()=>true);
    for(const m of G.mons.slice()){
      if(m.hp<=0||G.state!=='play') continue;
      m.energy+=m.spd;
      let g2=0;
      while(m.energy>=100&&G.state==='play'&&g2++<3){ m.energy-=100; monAct(m); }
    }
    tickStatus();
    if(p.cd>0){ p.cd--; if(p.cd===0) msg(`${p.cls.ab.name}: готово.`,'good'); }
    p.energy+=p.st.energy?200:p.spd;
  }
  if(G.state==='play'){ computeFOV(G.map,p.x,p.y,FOV_R); revealTraps(); }
  UI.hud(); saveRun();
}
function tickStatus(){
  const p=G.p, st=p.st;
  if(st.poison){ st.poison--; p.hp-=1; addFloat(p.x,p.y,'-1','#4caf50'); if(p.hp<=0) die(null); if(st.poison===0) msg('Отравление прошло.'); }
  if(st.drunk){ st.drunk--; if(st.drunk===0) msg('Голова прояснилась.'); }
  if(st.energy){ st.energy--; if(st.energy===0) msg('Энергетик отпустил.'); }
}

// ---- monster AI ----
function monAct(m){
  const p=G.p,map=G.map;
  if(m.stun>0){ m.stun--; return; }
  const d=cheb(m,p);
  const sees=map.vis[idx(m.x,m.y)]===1&&d<=FOV_R;
  if(sees){ if(m.state!=='chase'){ m.state='chase'; onNotice(m); } m.lost=0; m.tx=p.x;m.ty=p.y; }
  else if(m.state==='chase'){ m.lost++; if(m.lost>12) m.state='wander'; }
  if(m.state==='sleep'){ if(d<=2&&R.chance(0.5)){ m.state='chase'; m.tx=p.x;m.ty=p.y; onNotice(m);} else return; }
  if(m.state==='wander'){ if(R.chance(0.4)) stepRandom(m); return; }
  m.tcount++;
  if(m.flee>0){ m.flee--; stepAway(m); return; }
  if(m.summon&&m.tcount%6===0){ let n=0; for(const [dx,dy] of R.shuffle(DIRS8.slice())){ if(n>=2)break; const x=m.x+dx,y=m.y+dy; if(freeTile(map,x,y)){ const r=spawnMon('rat',x,y); r.state='chase'; r.tx=p.x;r.ty=p.y; n++; } } if(n){ msg('Управдом: «Крысы, фас!»','talk'); AU.sfx('summon'); } }
  if(m.erratic&&R.chance(0.4)){ stepRandom(m); return; }
  if(d<=1){ attack(m,p); return; }
  if(m.ranged&&d<=4&&sees&&lineClear(map,m.x,m.y,p.x,p.y)&&R.chance(0.5)){ FX.proj={x:m.x,y:m.y,tx:p.x,ty:p.y,t:0}; attack(m,p,true); return; }
  if(m.ghost){ const dx=sign(p.x-m.x),dy=sign(p.y-m.y); const nx=m.x+dx,ny=m.y+dy; if(inb(nx,ny)&&!actorAt(nx,ny)&&!(p.x===nx&&p.y===ny)){ m.x=nx;m.y=ny; if(dx)m.face=dx; } return; }
  let dm=G.dmap;
  if(!sees) dm=bfsMap(map,m.tx,m.ty,()=>true,40);
  let bx=m.x,by=m.y,bd=dm[idx(m.x,m.y)]; if(bd<0) bd=9999;
  for(const [dx,dy] of R.shuffle(DIRS8.slice())){
    const nx=m.x+dx,ny=m.y+dy; if(!inb(nx,ny)) continue;
    const v=dm[idx(nx,ny)]; if(v<0||v>=bd) continue;
    const t=map.t[idx(nx,ny)];
    if(t===T.DOOR&&m.animal) continue;
    if(actorAt(nx,ny)||(p.x===nx&&p.y===ny)) continue;
    if(!diagOk(map,m.x,m.y,nx,ny)) continue;
    bd=v;bx=nx;by=ny;
  }
  if(bx===m.x&&by===m.y){ if(R.chance(0.3)) stepRandom(m); return; }
  if(map.t[idx(bx,by)]===T.DOOR){ map.t[idx(bx,by)]=T.DOOR_OPEN; if(map.vis[idx(bx,by)]||cheb({x:bx,y:by},p)<7){ msg('Где-то рядом открылась дверь.'); AU.sfx('door'); } return; }
  if(bx!==m.x) m.face=sign(bx-m.x);
  m.x=bx;m.y=by;
}
function stepRandom(m){
  const map=G.map;
  for(const [dx,dy] of R.shuffle(DIRS8.slice())){ const nx=m.x+dx,ny=m.y+dy; if(!isWalk(map,nx,ny)||actorAt(nx,ny)||(G.p.x===nx&&G.p.y===ny)||!diagOk(map,m.x,m.y,nx,ny)) continue; if(dx)m.face=dx; m.x=nx;m.y=ny; return; }
}
function stepAway(m){
  const map=G.map,dm=G.dmap; let bx=m.x,by=m.y,bd=dm[idx(m.x,m.y)];
  for(const [dx,dy] of R.shuffle(DIRS8.slice())){ const nx=m.x+dx,ny=m.y+dy; if(!isWalk(map,nx,ny)||actorAt(nx,ny)||(G.p.x===nx&&G.p.y===ny)||!diagOk(map,m.x,m.y,nx,ny)) continue; const v=dm[idx(nx,ny)]; if(v>bd){bd=v;bx=nx;by=ny;} }
  if(bx!==m.x) m.face=sign(bx-m.x); m.x=bx;m.y=by;
}
function haptic(kind){ try{ const h=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.HapticFeedback; if(h) h.impactOccurred(kind||'light'); else if(navigator.vibrate&&isTouch) navigator.vibrate(kind==='heavy'?40:20); }catch(e){} }
function onNotice(m){
  if(G.kills===0&&!G.hinted){ G.hinted=true; msg('Подсказка: шагни во врага, чтобы ударить. Дерись в коридоре, чтобы не окружили. F: способность.','sys'); }
  const f=FLAVOR[m.type];
  if(f&&R.chance(0.75)) msg(`${m.name}: «${R.pick(f)}»`,'talk');
  else msg(`${m.name} заметил тебя.`);
  if(m.boss) G.bossHit=false;
  if(m.bench&&R.chance(0.8)) msg(`Бабка с лавочки: «${R.pick(FLAVOR.bench)}»`,'talk');
  if(m.loud){ let n=0; for(const a of G.mons){ if(a!==m&&a.state==='sleep'&&!a.noWake&&cheb(a,m)<=12){ a.state='chase'; a.tx=G.p.x;a.ty=G.p.y; n++; } } if(n) msg(`Перфоратор разбудил весь этаж (${n}).`,'bad'); AU.sfx('summon'); FX.shake=4; }
  if(m.boss){ UI.banner(m.name,m.type==='dvornik'?'«Намусорили тут!»':'«Вы задолжали»',true); AU.sfx('boss'); }
}

// ---- fx ----
function addFloat(x,y,text,color){ FX.floats.push({x,y,text,color,t:0}); }
function spawnParts(x,y,color,n){ for(let i=0;i<n;i++){ const a=R.f()*Math.PI*2,s=0.5+R.f()*2.5; FX.parts.push({x:x+0.5,y:y+0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,color,t:0,life:0.4+R.f()*0.5,sz:1+R.i(0,1)}); } }

// ---- auto-walk / explore ----
function monsterVisible(){ const m=G.map; return G.mons.some(a=>m.vis[idx(a.x,a.y)]&&(a.state!=='sleep'||cheb(a,G.p)<=2)); }
function visActorAt(x,y){ const i=idx(x,y); return G.map.vis[i]&&actorAt(x,y); }
function pathPass(x,y){ const m=G.map; if(!m.seen[idx(x,y)]||visActorAt(x,y)) return false; const t=trapAt(x,y); return !(t&&t.seen); }
function pathPassAny(x,y){ const m=G.map; return m.seen[idx(x,y)]&&!visActorAt(x,y); }
function findFrontier(pass){
  const m=G.map,p=G.p; const d=bfsMap(m,p.x,p.y,pass); let best=-1,bd=1e9;
  for(const it of G.items){ const i=idx(it.x,it.y); if(d[i]>0&&d[i]<bd&&!(it.def.kind!=='gold'&&p.inv.length>=10)){bd=d[i];best=i;} }
  if(best<0) for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){
    const i=idx(x,y); if(d[i]<=0) continue; const tt=m.t[i]; if(isBlockTile(tt)) continue;
    let fr=tt===T.DOOR; if(!fr) for(const [dx,dy] of DIRS8){ if(!m.seen[idx(x+dx,y+dy)]){fr=true;break;} }
    if(fr&&d[i]<bd){bd=d[i];best=i;}
  }
  return best;
}
function pathPassLoose(x,y){ const m=G.map; if(!m.seen[idx(x,y)]||visActorAt(x,y)) return false; const t=trapAt(x,y); return !(t&&t.seen&&t.kind==='hatch'); }
function setPathTo(tx,ty,quiet){
  const m=G.map,p=G.p;
  if(!m.seen[idx(tx,ty)]){ if(!quiet) msg('Ты там ещё не был.'); return false; }
  let path=findPath(m,p.x,p.y,tx,ty,(x,y)=>pathPass(x,y)||(x===tx&&y===ty));
  if(!path||!path.length){ path=findPath(m,p.x,p.y,tx,ty,(x,y)=>pathPassLoose(x,y)||(x===tx&&y===ty)); if(path&&path.length&&!quiet) msg('Обхода нет, придётся пройти по ловушке.','bad'); }
  if(!path||!path.length){ if(!quiet) msg('Туда не пройти.'); return false; }
  G.path=path; RD.pathT=0.2; return true;
}
function explore(){
  const m=G.map,p=G.p;
  if(G.state!=='play') return;
  if(monsterVisible()){ msg('Сначала разберись с тем, кто рядом.','bad'); G.exploring=false; return; }
  let best=-1;
  for(const pass of [pathPass,pathPassLoose]){ best=findFrontier(pass); if(best>=0) break; }
  if(best<0){
    const any=findFrontier(pathPassAny);
    if(any>=0){
      G.exploring=false;
      const path=findPath(m,p.x,p.y,any%MW,(any/MW)|0,pathPassAny);
      if(path){ const cut=[]; for(const n of path){ const t=trapAt(n.x,n.y); if(t&&t.seen&&t.kind==='hatch') break; cut.push(n); } if(cut.length){ G.path=cut; RD.pathT=0.2; } }
      msg('Дальше только через открытый люк. Прыгать или нет, решай сам.','bad'); return;
    }
  }
  if(best<0){
    G.exploring=false;
    if(G.floor<MAX_FLOOR&&m.seen[idx(m.stairs.x,m.stairs.y)]){
      if(p.x===m.stairs.x&&p.y===m.stairs.y){ msg('Этаж обшарен. Пора вниз.','good'); return; }
      msg('Всё обшарил. Иду к лестнице.'); setPathTo(m.stairs.x,m.stairs.y);
    } else msg('Исследовать больше нечего.');
    return;
  }
  G.exploring=true;
  setPathTo(best%MW,(best/MW)|0);
}
function stepPath(){
  if(!G.path||G.state!=='play'){ G.path=null; G.exploring=false; return; }
  if(monsterVisible()){ G.path=null; G.exploring=false; msg('Кто-то рядом. Стоп.','bad'); return; }
  const n=G.path.shift(); const p=G.p;
  const dx=n.x-p.x,dy=n.y-p.y;
  if(Math.abs(dx)>1||Math.abs(dy)>1){ G.path=null; G.exploring=false; return; }
  const wasExploring=G.exploring; const bx=p.x,by=p.y;
  const ok=tryMove(dx,dy);
  if(!ok){ G.path=null; G.exploring=false; return; }
  if(G.path&&p.x===bx&&p.y===by) G.path.unshift(n);
  if(G.path&&G.path.length===0){ G.path=null; if(wasExploring) setTimeout(()=>{ if(G.state==='play'&&G.exploring) explore(); },60); }
}
function tryDescend(){
  const p=G.p,m=G.map; if(G.state!=='play') return;
  if(m.t[idx(p.x,p.y)]===T.STAIRS) descend(); else msg('Тут нет лестницы.');
}

// ---- daily leaderboard (Worker behind the Deno proxy, see board/) ----
const BOARD_URL='https://petuh-vs-kot.ifonpromax.deno.net/podval/board';
function playerName(){ try{ const n=localStorage.getItem('podval_name'); if(n) return n; const u=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.initDataUnsafe&&Telegram.WebApp.initDataUnsafe.user; return u?(u.first_name||u.username||''):''; }catch(e){ return ''; } }
function setPlayerName(n){ try{ localStorage.setItem('podval_name',n); }catch(e){} }
async function boardFetch(day){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),7000);
  try{ const r=await fetch(`${BOARD_URL}/${day}`,{signal:ctl.signal}); if(!r.ok) throw new Error('http '+r.status); return await r.json(); }
  finally{ clearTimeout(t); }
}
async function boardSubmit(day,entry){
  const ctl=new AbortController(); const t=setTimeout(()=>ctl.abort(),8000);
  try{ const r=await fetch(`${BOARD_URL}/${day}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(entry),signal:ctl.signal}); const j=await r.json(); if(!r.ok) throw new Error(j.error||('http '+r.status)); return j; }
  finally{ clearTimeout(t); }
}
