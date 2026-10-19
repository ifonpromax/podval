'use strict';
const KEYS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],KeyW:[0,-1],KeyS:[0,1],KeyA:[-1,0],KeyD:[1,0],KeyQ:[-1,-1],KeyE:[1,-1],KeyZ:[-1,1],KeyC:[1,1],Numpad8:[0,-1],Numpad2:[0,1],Numpad4:[-1,0],Numpad6:[1,0],Numpad7:[-1,-1],Numpad9:[1,-1],Numpad1:[-1,1],Numpad3:[1,1],KeyK:[0,-1],KeyJ:[0,1],KeyH:[-1,0],KeyL:[1,0],KeyY:[-1,-1],KeyU:[1,-1],KeyB:[-1,1],KeyN:[1,1]};
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const UI={
  el:{},open:null,icons:{},lastMove:0,cls:null,
  init(){
    for(const el of document.querySelectorAll('[id]')) this.el[el.id]=el;
    const E=this.el;
    E['b-inv'].onclick=()=>this.toggleInv();
    E['b-wait'].onclick=()=>{ AU.init(); wait(); };
    E['b-explore'].onclick=()=>{ AU.init(); if(G.path){G.path=null;G.exploring=false;UI.hud();} else explore(); };
    E['b-down'].onclick=()=>{ AU.init(); tryDescend(); };
    E['b-ab'].onclick=()=>{ AU.init(); useAbility(); };
    E['b-sound'].onclick=()=>{ AU.init(); const on=AU.toggle(); E['b-sound'].textContent=on?'♪':'✕'; E['b-sound'].classList.toggle('off',!on); };
    E['b-eye'].onclick=()=>{ RD.memory=!RD.memory; E['b-eye'].classList.toggle('off',!RD.memory); E['b-eye'].title=RD.memory?'Показана разведанная карта (V)':'Только то, что видно сейчас (V)'; if(G.state==='play') msg(RD.memory?'Показываю разведанную карту.':'Показываю только то, что видно сейчас.','sys'); };
    window.addEventListener('keydown',e=>this.key(e));
    const cv=E.game; let pd=null;
    cv.addEventListener('pointerdown',e=>{ pd={x:e.clientX,y:e.clientY,t:performance.now()}; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup',e=>{
      if(!pd) return; AU.init();
      const dx=e.clientX-pd.x,dy=e.clientY-pd.y,dist=Math.hypot(dx,dy); pd=null;
      if(G.state!=='play') return;
      if(this.open){ this.closeOverlay(); return; }
      if(dist>28){ const a=Math.atan2(dy,dx); const o=Math.round(a/(Math.PI/4)); const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]; const d=dirs[(o+8)%8]; G.path=null; G.exploring=false; tryMove(d[0],d[1]); return; }
      const t=screenToTile(e.clientX,e.clientY); const p=G.p;
      if(!inb(t.x,t.y)) return;
      if(t.x===p.x&&t.y===p.y){ if(G.map.t[idx(p.x,p.y)]===T.STAIRS) tryDescend(); else wait(); return; }
      if(cheb(t,p)===1){ G.path=null; G.exploring=false; tryMove(t.x-p.x,t.y-p.y); return; }
      const mon=actorAt(t.x,t.y);
      if(mon&&G.map.vis[idx(t.x,t.y)]){ const path=findPath(G.map,p.x,p.y,t.x,t.y,(x,y)=>pathPass(x,y)||(x===t.x&&y===t.y)); if(path&&path.length>1){ path.pop(); G.path=path; G.exploring=false; RD.pathT=0.2; } return; }
      G.exploring=false; setPathTo(t.x,t.y);
    });
    cv.addEventListener('pointercancel',()=>{pd=null;});
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    try{ this.cls=CLASSES.find(c=>c.id===localStorage.getItem('podval_cls'))||CLASSES[0]; }catch(e){ this.cls=CLASSES[0]; }
    window.addEventListener('beforeunload',()=>saveRun());
    document.addEventListener('visibilitychange',()=>{ if(document.hidden) saveRun(); });
    this.showTitle();
    if(window.Telegram&&Telegram.WebApp){ try{ Telegram.WebApp.ready(); Telegram.WebApp.expand(); }catch(e){} }
  },
  key(e){
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    const code=e.code;
    if(G.state==='title'||G.state==='dead'||G.state==='win'){ if(code==='Enter'||code==='Space'){ e.preventDefault(); AU.init(); this.closeOverlay(); newGame(this.cls); } return; }
    if(this.open==='inv'){
      if(code==='Escape'||code==='KeyI'){ this.closeOverlay(); e.preventDefault(); return; }
      const d=code.match(/^(?:Digit|Numpad)(\d)$/); if(d){ const n=d[1]==='0'?9:parseInt(d[1])-1; if(e.shiftKey) dropItem(n); else useItem(n); this.renderInv(); if(!G.p.inv.length) this.closeOverlay(); e.preventDefault(); }
      return;
    }
    if(this.open==='ach'){ if(code==='Escape'){ this.showTitle(); e.preventDefault(); } return; }
    if(this.open==='shop'){
      if(code==='Escape'){ this.closeOverlay(); e.preventDefault(); return; }
      const d=code.match(/^(?:Digit|Numpad)(\d)$/); if(d){ const n=d[1]==='0'?9:parseInt(d[1])-1; buyItem(n); this.renderShop(); e.preventDefault(); }
      return;
    }
    if(this.open){ if(code==='Escape'){ this.closeOverlay(); e.preventDefault(); } return; }
    if(KEYS[code]){ e.preventDefault(); if(e.repeat&&performance.now()-this.lastMove<90) return; this.lastMove=performance.now(); AU.init(); G.path=null; G.exploring=false; const [dx,dy]=KEYS[code]; tryMove(dx,dy); return; }
    switch(code){
      case 'Space': case 'Period': case 'Numpad5': e.preventDefault(); AU.init(); if(e.shiftKey&&code==='Period') tryDescend(); else wait(); break;
      case 'Enter': case 'NumpadEnter': e.preventDefault(); AU.init(); tryDescend(); break;
      case 'KeyI': e.preventDefault(); this.toggleInv(); break;
      case 'KeyF': e.preventDefault(); AU.init(); useAbility(); break;
      case 'Tab': e.preventDefault(); RD.mini=!RD.mini; break;
      case 'KeyX': e.preventDefault(); AU.init(); if(G.path){G.path=null;G.exploring=false;this.hud();} else explore(); break;
      case 'Escape': G.path=null; G.exploring=false; this.hud(); break;
      case 'KeyM': this.el['b-sound'].onclick(); break;
      case 'KeyV': e.preventDefault(); this.el['b-eye'].onclick(); break;
    }
  },
  icon(spr){ if(!this.icons[spr]) this.icons[spr]=sprCanvas(spr).toDataURL(); return `<img class="ic" src="${this.icons[spr]}" alt="">`; },
  hud(){
    const p=G.p; if(!p) return; const E=this.el;
    const hpr=clamp(p.hp/p.hpMax,0,1);
    E.hpfill.style.width=(hpr*100)+'%'; E.hpfill.className=hpr<0.3?'crit':hpr<0.6?'warn':'';
    E.hptext.textContent=`${Math.max(0,p.hp)}/${p.hpMax}`;
    E.xpfill.style.width=(clamp(p.xp/xpNeed(p.lvl),0,1)*100)+'%';
    E.lvl.textContent=`ур.${p.lvl}`;
    E.floor.textContent=`${G.floor}/${MAX_FLOOR} ${THEMES[G.floor].name}`;
    E.gold.textContent=`${p.gold} ₽`;
    E.atk.textContent=`⚔ ${playerAtk()}`; E.def.textContent=`⛨ ${playerDef()}`;
    E.equip.innerHTML=(p.weapon?this.icon(p.weapon.spr):'<span class="slot"></span>')+(p.armor?this.icon(p.armor.spr):'<span class="slot"></span>');
    const st=[]; if(p.st.poison) st.push(`<span class="st poison">☠ ${p.st.poison}</span>`); if(p.st.drunk) st.push(`<span class="st drunk">~ ${p.st.drunk}</span>`); if(p.st.energy) st.push(`<span class="st energy">⚡ ${p.st.energy}</span>`); if(p.lives) st.push(`<span class="st lives">♥ ${p.lives}</span>`);
    E.status.innerHTML=st.join('');
    const boss=G.mons.find(a=>a.boss&&G.map.vis[idx(a.x,a.y)]);
    if(boss){ E.bossbar.hidden=false; E['boss-name'].textContent=boss.name; E['boss-fill'].style.width=(100*boss.hp/boss.hpMax)+'%'; } else E.bossbar.hidden=true;
    AU.setBoss(!!boss&&G.state==='play');
    E['b-down'].hidden=!(G.map&&G.map.t[idx(p.x,p.y)]===T.STAIRS);
    E['b-inv'].textContent=`Рюкзак${p.inv.length?' ('+p.inv.length+')':''}`;
    E['b-explore'].textContent=G.path?'Стоп':'Обшарить';
    E['b-ab'].textContent=p.cd>0?`${p.cls.ab.name} (${p.cd})`:p.cls.ab.name; E['b-ab'].classList.toggle('cd',p.cd>0);
    if(this.open==='inv') this.renderInv();
  },
  log(){
    const E=this.el; const last=G.msgs.slice(-6);
    E.log.innerHTML=last.map((m,i)=>`<div class="m ${m.cls} ${i<last.length-1?'old':''}">${m.text}</div>`).join('');
  },
  banner(title,sub,boss){
    const E=this.el; E.banner.className='show'+(boss?' boss':''); E['banner-t'].textContent=title; E['banner-s'].textContent=sub||'';
    clearTimeout(this._bt); this._bt=setTimeout(()=>{E.banner.className='';},2600);
  },
  toggleInv(){ if(G.state!=='play') return; if(this.open==='inv') this.closeOverlay(); else { this.open='inv'; this.renderInv(); this.el.overlay.hidden=false; } },
  renderInv(){
    const p=G.p; const E=this.el;
    const row=(d,i)=>{ let act='',stat=''; if(d.kind==='weapon'){act='Взять';stat=`+${d.atk} атк`;} else if(d.kind==='armor'){act='Надеть';stat=`+${d.def} защ`;} else if(d.kind==='scroll'){act='Прочитать';stat=d.desc;} else if(d.kind==='throw'){act='Кинуть';stat=d.desc;} else if(d.kind==='key'){act='';stat=d.desc;} else {act=d.kind==='food'?'Съесть':'Выпить';stat=d.desc;}
      if(!act) return `<div class="row"><span class="num"></span>${this.icon(d.spr)}<div class="nm">${d.name}<small>${stat}</small></div><button class="drop" data-drop="${i}" title="Выбросить">✕</button></div>`;
      return `<div class="row"><span class="num">${isTouch?'':'['+((i+1)%10)+']'}</span>${this.icon(d.spr)}<div class="nm">${d.name}<small>${stat}</small></div><button data-use="${i}">${act}</button><button class="drop" data-drop="${i}" title="Выбросить">✕</button></div>`; };
    const ab=p.cls.ab;
    E.overlay.innerHTML=`<div class="panel inv">
      <h2>${this.icon(p.spr)}${p.name} <small>рюкзак ${p.inv.length}/10</small></h2>
      <div class="eq"><div>${p.weapon?this.icon(p.weapon.spr)+p.weapon.name+' <small>+'+p.weapon.atk+' атк</small>':'<span class="dim">'+(p.cls.id==='barsik'?'когти':'кулаки')+'</span>'}</div><div>${p.armor?this.icon(p.armor.spr)+p.armor.name+' <small>+'+p.armor.def+' защ</small>':'<span class="dim">'+(p.cls.noArmor?'шерсть':'футболка')+'</span>'}</div></div>
      <div class="stats">HP ${p.hp}/${p.hpMax} · атака ${playerAtk()} · защита ${playerDef()} · скорость ${p.spd} · ур.${p.lvl} (${p.xp}/${xpNeed(p.lvl)} xp)<br>этаж ${G.floor} · ход ${G.turn} · убито ${G.kills}<br><b>${ab.name}</b> (F): ${ab.desc}${p.cd?' · ещё '+p.cd+' ход.':' · готово'}</div>
      <div class="list">${p.inv.length?p.inv.map(row).join(''):'<div class="dim">Пусто. Подбирай всё, что блестит.</div>'}</div>
      ${p.inv.length&&!isTouch?'<div class="dim" style="font-size:7px">Цифры работают только пока открыт рюкзак. Shift+цифра: выбросить.</div>':''}
      <button class="big close">Закрыть</button>
    </div>`;
    E.overlay.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{ AU.init(); useItem(+b.dataset.use); if(this.open==='inv'){ if(G.p.inv.length) this.renderInv(); else this.closeOverlay(); } });
    E.overlay.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{ dropItem(+b.dataset.drop); this.renderInv(); });
    E.overlay.querySelector('.close').onclick=()=>this.closeOverlay();
  },
  openShop(){ if(!G.shop||G.state!=='play') return; this.open='shop'; this.el.overlay.hidden=false; AU.sfx('door'); this.renderShop(); },
  renderShop(){
    const p=G.p,E=this.el,sh=G.shop; if(!sh) return;
    const cat=p.cls.id==='barsik';
    const row=(s,i)=>{ const stat=s.def.kind==='weapon'?`+${s.def.atk} атк`:s.def.kind==='armor'?`+${s.def.def} защ`:s.def.desc; const can=s.qty>0&&p.gold>=s.price&&p.inv.length<10;
      return `<div class="row"><span class="num">${isTouch?'':'['+((i+1)%10)+']'}</span>${this.icon(s.def.spr)}<div class="nm">${s.def.name}<small>${stat}${s.qty>1?' · x'+s.qty:''}</small></div><span class="price ${p.gold<s.price?'no':''}">${s.price} ₽</span><button data-buy="${i}" ${can?'':'disabled'}>${s.qty>0?'Купить':'Нет'}</button></div>`; };
    const sell=(d,i)=>`<div class="row"><span class="num"></span>${this.icon(d.spr)}<div class="nm">${d.name}</div><span class="price">${sellPrice(d)} ₽</span><button data-sell="${i}">Продать</button></div>`;
    E.overlay.innerHTML=`<div class="panel inv shop">
      <h2>Ларёк «24 часа» <small>у тебя ${p.gold} ₽</small></h2>
      <div class="zina">${this.icon('kiosk')}Тётя Зина: «${cat?'Кыш! …ладно, что тебе, котик?':sh.greet}»</div>
      <div class="list">${sh.stock.map(row).join('')}</div>
      ${p.inv.length?`<h2>Сдать <small>в полцены</small></h2><div class="list">${p.inv.map(sell).join('')}</div>`:''}
      <button class="big close">Уйти</button>
    </div>`;
    E.overlay.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{ buyItem(+b.dataset.buy); this.renderShop(); });
    E.overlay.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{ sellItem(+b.dataset.sell); this.renderShop(); });
    E.overlay.querySelector('.close').onclick=()=>this.closeOverlay();
  },
  openGym(){
    const m=G.map,p=G.p,E=this.el; if(!m.gym||G.state!=='play') return;
    this.open='gym'; E.overlay.hidden=false; AU.sfx('door');
    const price=25+G.floor*15;
    if(m.gym.used){ E.overlay.innerHTML=`<div class="panel inv"><h2>${this.icon('barbell')}Качалка</h2><div class="zina">Качок: «Абонемент на сегодня использован. Приходи этажом ниже.»</div><button class="big close">Уйти</button></div>`; }
    else E.overlay.innerHTML=`<div class="panel inv"><h2>${this.icon('barbell')}Качалка «Титан» <small>у тебя ${p.gold} ₽</small></h2>
      <div class="zina">Качок: «Абонемент ${price} ₽. Одно занятие. Что качаем?»</div>
      <div class="list">
        <div class="row">${this.icon('armatura')}<div class="nm">Железо<small>+1 атака навсегда</small></div><span class="price ${p.gold<price?'no':''}">${price} ₽</span><button data-gym="atk" ${p.gold<price?'disabled':''}>Качать</button></div>
        <div class="row">${this.icon('kefir')}<div class="nm">Пресс<small>+6 к максимуму HP</small></div><span class="price ${p.gold<price?'no':''}">${price} ₽</span><button data-gym="hp" ${p.gold<price?'disabled':''}>Качать</button></div>
      </div><button class="big close">Уйти</button></div>`;
    E.overlay.querySelectorAll('[data-gym]').forEach(b=>b.onclick=()=>gymBuy(b.dataset.gym));
    E.overlay.querySelector('.close').onclick=()=>this.closeOverlay();
  },
  toast(def){
    const E=this.el; E.toast.innerHTML=`${this.icon(def.spr)}<div><b>Достижение: ${def.name}</b><small>${def.desc}</small></div>`;
    E.toast.className='show'; clearTimeout(this._tt); this._tt=setTimeout(()=>{E.toast.className='';},3500);
  },
  showAch(){
    const E=this.el; const got=loadAch(); const n=Object.keys(got).filter(k=>ACH.some(a=>a.id===k)).length;
    this.open='ach'; E.overlay.hidden=false;
    E.overlay.innerHTML=`<div class="panel inv"><h2>Достижения <small>${n}/${ACH.length}</small></h2><div class="list">${ACH.map(a=>`<div class="row ${got[a.id]?'':'locked'}">${this.icon(a.spr)}<div class="nm">${a.name}<small>${a.desc}</small></div><span class="price">${got[a.id]?'✔':'·'}</span></div>`).join('')}</div><button class="big close">Назад</button></div>`;
    E.overlay.querySelector('.close').onclick=()=>this.showTitle();
  },
  closeOverlay(){ this.open=null; this.el.overlay.hidden=true; this.el.overlay.innerHTML=''; },
  showTitle(){
    const b=loadBest(); const E=this.el; this.open='title'; G.state='title'; AU.setBoss(false);
    E.hud.classList.add('hidden');
    E.overlay.hidden=false;
    const saved=hasSavedRun();
    const runs=loadRuns().slice(0,5);
    const clsName=id=>(CLASSES.find(c=>c.id===id)||CLASSES[0]).name;
    const card=c=>`<div class="cls ${c===this.cls?'sel':''}" data-cls="${c.id}">${this.icon(c.spr)}<div class="cn">${c.name}</div><div class="cs">HP ${c.hp} · ⚔${c.atk} · ⛨${c.def} · ск.${c.spd}</div></div>`;
    E.overlay.innerHTML=`<div class="panel title">
      <div class="logo">ПОДВАЛ</div>
      <div class="tag">roguelike про спуск в недра хрущёвки</div>
      <div class="classes">${CLASSES.map(card).join('')}</div>
      <div class="cdesc"></div>
      ${saved?`<button class="big cont">Продолжить: ${clsName(saved.p.cls)}, этаж ${saved.floor}</button>`:''}
      <button class="big start">Спуститься</button>
      <button class="big daily">Забег дня</button>
      <button class="big ghost achb">Достижения ${Object.keys(loadAch()).filter(k=>ACH.some(a=>a.id===k)).length}/${ACH.length}</button>
      ${b.runs?`<div class="best">Лучший этаж: ${b.floor} · рекорд: ${b.score} · забегов: ${b.runs}${b.wins?' · побед: '+b.wins:''}</div>`:''}
      ${runs.length?`<div class="runs">${runs.map(r=>`<div><span>${clsName(r.cls)}</span><span>${r.win?'<b>победа</b>':'этаж '+r.floor+', '+r.cause}</span><span>${r.score}${r.daily?' ☀':''}</span></div>`).join('')}</div>`:''}
      <div class="help">${isTouch?'Тап по клетке: идти. Свайп: шаг. Тап по себе: ждать.<br>Враг рядом: шагни в него.':'WASD / стрелки / нумпад: шаг. QEZC: по диагонали.<br>Пробел: ждать · Enter: спуск · F: способность · I: рюкзак (в нём цифры = предметы) · X: обшарить · Tab: миникарта · V: только видимое'}</div>
    </div>`;
    const showDesc=()=>{ const c=this.cls; E.overlay.querySelector('.cdesc').innerHTML=`<b>${c.name}.</b> ${c.desc}<br><span class="ab">${c.ab.name}</span>: ${c.ab.desc} (кд ${c.ab.cd}).`; E.overlay.querySelectorAll('.cls').forEach(el=>el.classList.toggle('sel',el.dataset.cls===c.id)); };
    showDesc();
    E.overlay.querySelectorAll('.cls').forEach(el=>el.onclick=()=>{ this.cls=CLASSES.find(c=>c.id===el.dataset.cls); try{ localStorage.setItem('podval_cls',this.cls.id); }catch(e){} AU.init(); AU.sfx('pickup'); showDesc(); });
    const start=(daily)=>{ AU.init(); this.closeOverlay(); E.hud.classList.remove('hidden'); newGame(this.cls,daily); };
    E.overlay.querySelector('.start').onclick=()=>start(false);
    E.overlay.querySelector('.daily').onclick=()=>start(true);
    E.overlay.querySelector('.achb').onclick=()=>this.showAch();
    const cont=E.overlay.querySelector('.cont'); if(cont) cont.onclick=()=>{ AU.init(); this.closeOverlay(); if(!loadRun()) this.showTitle(); };
  },
  endPanel(title,lines){
    const E=this.el; this.open='end'; E.overlay.hidden=false; AU.setBoss(false);
    E.overlay.innerHTML=`<div class="panel end"><div class="logo small">${title}</div>${lines}<button class="big start">Ещё раз</button><button class="big share">Поделиться</button><button class="big ghost menu">В меню</button></div>`;
    E.overlay.querySelector('.start').onclick=()=>{ AU.init(); this.closeOverlay(); newGame(this.cls,!!G.daily); };
    E.overlay.querySelector('.menu').onclick=()=>{ this.showTitle(); };
    E.overlay.querySelector('.share').onclick=()=>{ const t=shareText(); const tg=window.Telegram&&Telegram.WebApp&&Telegram.WebApp.openTelegramLink; if(tg&&Telegram.WebApp.initData){ Telegram.WebApp.openTelegramLink('https://t.me/share/url?url='+encodeURIComponent('https://ifonpromax.github.io/podval/')+'&text='+encodeURIComponent(t)); } else if(navigator.share){ navigator.share({text:t}).catch(()=>{}); } else { navigator.clipboard&&navigator.clipboard.writeText(t); E.overlay.querySelector('.share').textContent='Скопировано'; } };
  },
  showDeath(){
    if(G.state!=='dead') return;
    const th=THEMES[G.floor];
    this.endPanel('ТЫ СДОХ',`<p>${G.cause==='отравление'?'Отравление доконало тебя':G.cause==='люк'?'Ты разбился, провалившись в люк,':'Тебя прикончил: <b>'+G.cause+'</b>'} на этаже ${G.floor} (${th.name}).</p>
      <div class="stats">${G.p.name} · ходов: ${G.turn} · убито: ${G.kills} · мелочи: ${G.p.gold} ₽ · ур.${G.p.lvl}<br><b>счёт: ${score()}</b>${G.daily?' · забег дня':''}</div>`);
  },
  showWin(){
    if(G.state!=='win') return;
    this.endPanel('ДОЛГИ СПИСАНЫ',`<p>Управдом повержен. Квитанции больше не придут.<br>${G.p.name} выбирается наверх, к свету и жареной картошке.</p>
      <div class="stats">ходов: ${G.turn} · убито: ${G.kills} · мелочи: ${G.p.gold} ₽ · ур.${G.p.lvl}<br><b>счёт: ${score()}</b>${G.daily?' · забег дня':''}</div>`);
  }
};
window.addEventListener('DOMContentLoaded',()=>{ initRender(); UI.init(); });
