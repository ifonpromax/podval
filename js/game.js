'use strict';
const FOV_R=7;
const G={state:'title',floor:0,map:null,p:null,mons:[],items:[],msgs:[],turn:0,kills:0,path:null,dmap:null,win:false,cause:'',exploring:false};
const FX={shake:0,floats:[],parts:[],banner:null,zap:0,proj:null};
let nextId=1;

function msg(text,cls){ G.msgs.push({text,cls:cls||'',t:G.turn}); if(G.msgs.length>80) G.msgs.shift(); UI.log(); }

function newGame(){
  G.floor=0; G.kills=0; G.turn=0; G.msgs=[]; G.win=false; G.cause=''; G.path=null; G.exploring=false;
  FX.floats=[]; FX.parts=[]; FX.shake=0;
  G.p={x:0,y:0,vx:0,vy:0,hp:22,hpMax:22,atk:3,def:0,lvl:1,xp:0,gold:0,inv:[],weapon:null,armor:null,energy:100,st:{},name:'Васян',spr:'player',isPlayer:true,bump:null,flash:0,face:1,id:0};
  G.state='play';
  UI.el.hud.classList.remove('hidden');
  descend();
  msg('Ты спускаешься в подвал. Назад дороги нет.','sys');
}

function descend(){
  G.floor++;
  const m=makeMap(G.floor); G.map=m;
  const p=G.p; p.x=m.start.x;p.y=m.start.y;p.vx=p.x;p.vy=p.y;
  RD.cam.x=p.x; RD.cam.y=p.y;
  G.mons=[]; G.items=[]; G.path=null; G.exploring=false;
  populate(m);
  G.shop=null;
  if(m.kiosk){
    const f=G.floor;
    const st=[{def:ITEMS.kefir,price:15,qty:3},{def:ITEMS.shaurma,price:10,qty:3},{def:ITEMS.boyara,price:25,qty:2},{def:ITEMS.energy,price:30,qty:1},{def:R.pick([ITEMS.sc_tele,ITEMS.sc_map,ITEMS.sc_zap]),price:35,qty:1}];
    const wpn=[ITEMS.w1,ITEMS.w2,ITEMS.w3,ITEMS.w4][clamp(Math.floor(f/2),0,3)];
    const arm=[ITEMS.a1,ITEMS.a2,ITEMS.a3][clamp(Math.floor((f-1)/2.5),0,2)];
    st.push({def:wpn,price:wpn.atk*22,qty:1},{def:arm,price:arm.def*28,qty:1});
    G.shop={stock:st,greet:R.pick(FLAVOR.zina)};
  }
  computeFOV(m,p.x,p.y,FOV_R);
  G.dmap=bfsMap(m,p.x,p.y,()=>true);
  const th=THEMES[G.floor];
  UI.banner(`Этаж ${G.floor}. ${th.name}`,th.sub);
  msg(`Этаж ${G.floor}: ${th.name}. ${R.pick(FLAVOR.enter)}`,'sys');
  AU.sfx('stairs');
  UI.hud();
}

function actorAt(x,y){ for(const a of G.mons) if(a.x===x&&a.y===y) return a; return null; }
function itemAt(x,y){ for(const it of G.items) if(it.x===x&&it.y===y) return it; return null; }
function freeTile(m,x,y){ return isWalk(m,x,y)&&!actorAt(x,y)&&!(G.p.x===x&&G.p.y===y); }
function spawnMon(key,x,y){
  const d=MON[key];
  const m=Object.assign({},d,{type:key,x,y,vx:x,vy:y,hp:d.hp,hpMax:d.hp,energy:R.i(0,60),state:'sleep',lost:0,bump:null,flash:0,face:-1,id:nextId++,tcount:0,tx:x,ty:y});
  if(!d.boss){ const over=Math.max(0,G.floor-d.minF); m.hp=m.hpMax=Math.round(d.hp*(1+0.14*over)); m.atk=d.atk+Math.floor(over/3); m.xp=d.xp+over; }
  G.mons.push(m); return m;
}
function randomFloorInRoom(m,r,tries=30){
  for(let i=0;i<tries;i++){ const x=R.i(r.x,r.x+r.w-1),y=R.i(r.y,r.y+r.h-1); if(freeTile(m,x,y)&&!itemAt(x,y)&&m.t[idx(x,y)]===T.FLOOR) return {x,y}; }
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
  if(dx) p.face=dx;
  const mon=actorAt(nx,ny);
  if(mon){ attack(p,mon); endTurn(); return true; }
  const t=m.t[idx(nx,ny)];
  if(t===T.DOOR){ m.t[idx(nx,ny)]=T.DOOR_OPEN; AU.sfx('door'); msg('Дверь со скрипом открывается.'); endTurn(); return true; }
  if(t===T.KIOSK){ G.path=null; G.exploring=false; UI.openShop(); return false; }
  if(t===T.WALL||t===T.CRATE||!diagOk(m,p.x,p.y,nx,ny)){ p.bump={dx,dy,t:1,small:true}; AU.sfx('bump'); return false; }
  p.x=nx;p.y=ny;
  AU.sfx('step');
  pickup();
  if(m.t[idx(nx,ny)]===T.STAIRS) msg('Лестница вниз. Enter или кнопка «Спуститься».','good');
  endTurn(); return true;
}
function wait(){ if(G.state!=='play')return; G.path=null; endTurn(); }

function pickup(){
  const p=G.p; const it=itemAt(p.x,p.y); if(!it) return;
  if(it.def.kind==='gold'){ p.gold+=it.amt; G.items.splice(G.items.indexOf(it),1); msg(`Нашёл ${it.amt} ₽ мелочью.`,'gold'); AU.sfx('coin'); spawnParts(p.x,p.y,'#f3c53a',6); UI.hud(); return; }
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
    heal(p,d.heal); AU.sfx('drink'); msg('Шаурма… а ничего такая.');
    if(R.chance(0.25)){ p.st.poison=(p.st.poison||0)+4; msg('Так. Шаурма была не очень. Отравление!','bad'); }
  } else if(d.kind==='scroll'){
    readScroll(d.effect);
  } else if(d.kind==='weapon'){
    const old=p.weapon; p.weapon=d; p.inv.splice(i,1); if(old) p.inv.push(old); msg(`В руках: ${d.name} (+${d.atk} атк).`,'good'); AU.sfx('equip'); UI.hud(); endTurn(); return;
  } else if(d.kind==='armor'){
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
  p.gold-=s.price; s.qty--; p.inv.push(s.def); AU.sfx('coin'); msg(`Купил: ${s.def.name} за ${s.price} ₽.`,'gold'); UI.hud();
}
function sellItem(i){
  const p=G.p; const d=p.inv[i]; if(!d) return;
  const pr=sellPrice(d); p.inv.splice(i,1); p.gold+=pr; AU.sfx('coin'); msg(`Продал: ${d.name} за ${pr} ₽.`,'gold'); UI.hud();
}
function dropItem(i){ const p=G.p; const d=p.inv[i]; if(!d) return; p.inv.splice(i,1); if(!itemAt(p.x,p.y)) G.items.push({x:p.x,y:p.y,def:d}); msg(`Выбросил: ${d.name}.`); UI.hud(); }
function heal(a,n){ const before=a.hp; a.hp=Math.min(a.hpMax,a.hp+n); const got=a.hp-before; if(got>0) addFloat(a.x,a.y,'+'+got,'#4caf50'); }

function readScroll(e){
  const p=G.p,m=G.map;
  AU.sfx('scroll');
  if(e==='tele'){
    for(let i=0;i<300;i++){ const x=R.i(1,MW-2),y=R.i(1,MH-2); if(freeTile(m,x,y)&&m.t[idx(x,y)]===T.FLOOR&&cheb({x,y},p)>8){ spawnParts(p.x,p.y,'#9b4fd0',14); p.x=x;p.y=y;p.vx=x;p.vy=y; RD.cam.x=x;RD.cam.y=y; spawnParts(x,y,'#9b4fd0',14); msg('Хлоп. Ты уже не там, где был.','good'); G.path=null; return; } }
    msg('Записка размокла. Ничего не произошло.');
  } else if(e==='map'){
    for(let y=0;y<MH;y++)for(let x=0;x<MW;x++){ const i=idx(x,y); if(m.t[i]!==T.WALL) m.seen[i]=1; else if(DIRS8.some(([dx,dy])=>inb(x+dx,y+dy)&&m.t[idx(x+dx,y+dy)]!==T.WALL)) m.seen[i]=1; }
    msg('План БТИ. Теперь ты знаешь, где лестница.','good');
  } else if(e==='zap'){
    let hit=0; FX.zap=1;
    for(const mon of G.mons.slice()){ if(m.vis[idx(mon.x,mon.y)]){ damage(mon,8+G.floor*2,p,true); hit++; } }
    FX.shake=8; AU.sfx('zap');
    msg(hit?`Электрик дал фазу: ${hit} ${plural(hit,'цель','цели','целей')} под током.`:'Фаза ушла в никуда.','good');
  }
}
function plural(n,a,b,c){ const n10=n%10,n100=n%100; if(n10===1&&n100!==11) return a; if(n10>=2&&n10<=4&&(n100<10||n100>=20)) return b; return c; }

// ---- combat ----
function attack(att,def,ranged){
  const atk=att.isPlayer?playerAtk():att.atk;
  const dfv=def.isPlayer?playerDef():def.def;
  let dmg=Math.max(1,atk+R.i(-1,1)-dfv);
  let crit=false;
  if(R.chance(att.isPlayer?0.12:0.05)){ dmg=dmg*2; crit=true; }
  if(!ranged) att.bump={dx:sign(def.x-att.x),dy:sign(def.y-att.y),t:1};
  if(def.x!==att.x) att.face=sign(def.x-att.x);
  damage(def,dmg,att,false,crit);
  if(def.hp>0&&def.isPlayer){
    if(att.steal&&G.p.gold>0&&R.chance(0.35)){ const s=Math.min(G.p.gold,5+G.floor*3); G.p.gold-=s; msg(`Гопник вытащил ${s} ₽. «${R.pick(FLAVOR.gopnik)}»`,'bad'); }
    if(att.poison&&R.chance(0.4)){ G.p.st.poison=(G.p.st.poison||0)+3; msg('От бомжа несёт так, что ты отравлен.','bad'); }
  }
}
function damage(def,dmg,src,magic,crit){
  def.hp-=dmg; def.flash=1;
  addFloat(def.x,def.y,(crit?'!':'')+dmg,def.isPlayer?'#ff6a6a':crit?'#f3c53a':'#fff');
  spawnParts(def.x,def.y,def.ghost?'#b8d8ff':def.animal?'#8c1f2a':'#d2383c',crit?10:5);
  if(def.isPlayer){
    FX.shake=Math.max(FX.shake,crit?10:5); AU.sfx('hurt'); haptic(crit?'heavy':'medium');
    const who=src?src.name:'Что-то'; msg(`${who} ${src&&src.a?src.a:'бьёт'} тебя: -${dmg}${crit?' (крит!)':''}.`,'bad');
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
  if(R.chance(mon.boss?1:0.3)&&!itemAt(mon.x,mon.y)) G.items.push({x:mon.x,y:mon.y,def:ITEMS.gold,amt:R.i(2,6)+G.floor*(mon.boss?10:1)});
  if(mon.boss){ for(const [dx,dy] of DIRS8){ const x=mon.x+dx,y=mon.y+dy; if(isWalk(G.map,x,y)&&!itemAt(x,y)){ G.items.push({x,y,def:R.pick([ITEMS.w3,ITEMS.a2,ITEMS.w4,ITEMS.a3])}); break; } } }
  if(mon.type==='upravdom') win();
  else if(mon.type==='dvornik'){ msg('Дворник повержен. «Кто теперь мести будет…»','lvl'); FX.shake=10; }
}
function xpNeed(l){ return Math.floor(10*Math.pow(l,1.75)); }
function gainXp(n){
  const p=G.p; p.xp+=n;
  while(p.xp>=xpNeed(p.lvl)){ p.xp-=xpNeed(p.lvl); p.lvl++; p.hpMax+=5; p.hp=Math.min(p.hpMax,p.hp+7); if(p.lvl%2===0) p.atk+=1; if(p.lvl%4===0) p.def+=1; msg(`Уровень ${p.lvl}! Ты стал крепче.`,'lvl'); addFloat(p.x,p.y,'LVL UP','#f3c53a'); AU.sfx('levelup'); spawnParts(p.x,p.y,'#f3c53a',16); }
  UI.hud();
}
function die(src){
  if(G.state!=='play') return;
  G.state='dead'; G.cause=src?src.name:'отравление';
  FX.shake=14; AU.sfx('die'); G.path=null;
  msg('Ты сдох.','bad');
  saveBest(); UI.hud(); setTimeout(()=>UI.showDeath(),1100);
}
function win(){ G.state='win'; G.win=true; AU.sfx('win'); G.path=null; msg('Управдом повержен! Долги списаны.','lvl'); saveBest(); setTimeout(()=>UI.showWin(),1400); }
function score(){ return G.p.gold+G.kills*10+(G.floor-1)*100+(G.win?1000:0); }
function saveBest(){ try{ const b=loadBest(); const s=score(); const nb={floor:Math.max(b.floor||0,G.floor),score:Math.max(b.score||0,s),runs:(b.runs||0)+1,wins:(b.wins||0)+(G.win?1:0)}; localStorage.setItem('podval_best',JSON.stringify(nb)); }catch(e){} }
function loadBest(){ try{ return JSON.parse(localStorage.getItem('podval_best')||'{}'); }catch(e){ return {}; } }

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
    p.energy+=p.st.energy?200:100;
  }
  computeFOV(G.map,p.x,p.y,FOV_R);
  UI.hud();
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
  const d=cheb(m,p);
  const sees=map.vis[idx(m.x,m.y)]===1&&d<=FOV_R;
  if(sees){ if(m.state!=='chase'){ m.state='chase'; onNotice(m); } m.lost=0; m.tx=p.x;m.ty=p.y; }
  else if(m.state==='chase'){ m.lost++; if(m.lost>12) m.state='wander'; }
  if(m.state==='sleep'){ if(d<=2&&R.chance(0.5)){ m.state='chase'; m.tx=p.x;m.ty=p.y; onNotice(m);} else return; }
  if(m.state==='wander'){ if(R.chance(0.4)) stepRandom(m); return; }
  m.tcount++;
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
function haptic(kind){ try{ const h=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.HapticFeedback; if(h) h.impactOccurred(kind||'light'); else if(navigator.vibrate&&isTouch) navigator.vibrate(kind==='heavy'?40:20); }catch(e){} }
function onNotice(m){
  if(G.kills===0&&!G.hinted){ G.hinted=true; msg('Подсказка: шагни во врага, чтобы ударить. Дерись в коридоре, чтобы не окружили.','sys'); }
  const f=FLAVOR[m.type];
  if(f&&R.chance(0.75)) msg(`${m.name}: «${R.pick(f)}»`,'talk');
  else msg(`${m.name} заметил тебя.`);
  if(m.boss){ UI.banner(m.name,m.type==='dvornik'?'«Намусорили тут!»':'«Вы задолжали»',true); AU.sfx('boss'); }
}

// ---- fx ----
function addFloat(x,y,text,color){ FX.floats.push({x,y,text,color,t:0}); }
function spawnParts(x,y,color,n){ for(let i=0;i<n;i++){ const a=R.f()*Math.PI*2,s=0.5+R.f()*2.5; FX.parts.push({x:x+0.5,y:y+0.5,vx:Math.cos(a)*s,vy:Math.sin(a)*s-1.5,color,t:0,life:0.4+R.f()*0.5,sz:1+R.i(0,1)}); } }

// ---- auto-walk / explore ----
function monsterVisible(){ const m=G.map; return G.mons.some(a=>m.vis[idx(a.x,a.y)]); }
function setPathTo(tx,ty,quiet){
  const m=G.map,p=G.p;
  if(!m.seen[idx(tx,ty)]){ if(!quiet) msg('Ты там ещё не был.'); return false; }
  const pass=(x,y)=>m.seen[idx(x,y)]&&!actorAt(x,y);
  const path=findPath(m,p.x,p.y,tx,ty,pass);
  if(!path||!path.length){ if(!quiet) msg('Туда не пройти.'); return false; }
  G.path=path; RD.pathT=0.2; return true;
}
function explore(){
  const m=G.map,p=G.p;
  if(G.state!=='play') return;
  if(monsterVisible()){ msg('Сначала разберись с тем, кто рядом.','bad'); G.exploring=false; return; }
  const pass=(x,y)=>m.seen[idx(x,y)]&&!actorAt(x,y);
  const d=bfsMap(m,p.x,p.y,pass);
  let best=-1,bd=1e9;
  for(const it of G.items){ const i=idx(it.x,it.y); if(d[i]>0&&d[i]<bd&&!(it.def.kind!=='gold'&&p.inv.length>=10)){bd=d[i];best=i;} }
  if(best<0) for(let y=1;y<MH-1;y++)for(let x=1;x<MW-1;x++){
    const i=idx(x,y); if(d[i]<=0) continue; const tt=m.t[i]; if(tt===T.WALL||tt===T.CRATE||tt===T.KIOSK) continue;
    let fr=tt===T.DOOR; if(!fr) for(const [dx,dy] of DIRS8){ if(!m.seen[idx(x+dx,y+dy)]){fr=true;break;} }
    if(fr&&d[i]<bd){bd=d[i];best=i;}
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
  if(G.path&&p.x===bx&&p.y===by) G.path.unshift(n); // opened a door, step again
  if(G.path&&G.path.length===0){ G.path=null; if(wasExploring) setTimeout(()=>{ if(G.state==='play'&&G.exploring) explore(); },60); }
}
function tryDescend(){
  const p=G.p,m=G.map; if(G.state!=='play') return;
  if(m.t[idx(p.x,p.y)]===T.STAIRS) descend(); else msg('Тут нет лестницы.');
}
