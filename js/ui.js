'use strict';
const KEYS={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0],KeyW:[0,-1],KeyS:[0,1],KeyA:[-1,0],KeyD:[1,0],KeyQ:[-1,-1],KeyE:[1,-1],KeyZ:[-1,1],KeyC:[1,1],Numpad8:[0,-1],Numpad2:[0,1],Numpad4:[-1,0],Numpad6:[1,0],Numpad7:[-1,-1],Numpad9:[1,-1],Numpad1:[-1,1],Numpad3:[1,1],KeyK:[0,-1],KeyJ:[0,1],KeyH:[-1,0],KeyL:[1,0],KeyY:[-1,-1],KeyU:[1,-1],KeyB:[-1,1],KeyN:[1,1]};
const isTouch=('ontouchstart' in window)||navigator.maxTouchPoints>0;
const UI={
  el:{},open:null,icons:{},lastMove:0,
  init(){
    for(const el of document.querySelectorAll('[id]')) this.el[el.id]=el;
    const E=this.el;
    E['b-inv'].onclick=()=>this.toggleInv();
    E['b-wait'].onclick=()=>{ AU.init(); wait(); };
    E['b-explore'].onclick=()=>{ AU.init(); if(G.path){G.path=null;G.exploring=false;} else explore(); };
    E['b-down'].onclick=()=>{ AU.init(); tryDescend(); };
    E['b-sound'].onclick=()=>{ AU.init(); const on=AU.toggle(); E['b-sound'].textContent=on?'♪':'✕'; E['b-sound'].classList.toggle('off',!on); };
    window.addEventListener('keydown',e=>this.key(e));
    const cv=E.game; let pd=null;
    cv.addEventListener('pointerdown',e=>{ pd={x:e.clientX,y:e.clientY,t:performance.now()}; cv.setPointerCapture(e.pointerId); });
    cv.addEventListener('pointerup',e=>{
      if(!pd) return; AU.init();
      const dx=e.clientX-pd.x,dy=e.clientY-pd.y,dist=Math.hypot(dx,dy); const start=pd; pd=null;
      if(G.state!=='play'){ return; }
      if(this.open){ this.closeOverlay(); return; }
      if(dist>28){ const a=Math.atan2(dy,dx); const o=Math.round(a/(Math.PI/4)); const dirs=[[1,0],[1,1],[0,1],[-1,1],[-1,0],[-1,-1],[0,-1],[1,-1]]; const d=dirs[(o+8)%8]; G.path=null; G.exploring=false; tryMove(d[0],d[1]); return; }
      const t=screenToTile(e.clientX,e.clientY); const p=G.p;
      if(!inb(t.x,t.y)) return;
      if(t.x===p.x&&t.y===p.y){ if(G.map.t[idx(p.x,p.y)]===T.STAIRS) tryDescend(); else wait(); return; }
      if(cheb(t,p)===1){ G.path=null; G.exploring=false; tryMove(t.x-p.x,t.y-p.y); return; }
      const mon=actorAt(t.x,t.y);
      if(mon&&G.map.vis[idx(t.x,t.y)]){ const path=findPath(G.map,p.x,p.y,t.x,t.y,(x,y)=>G.map.seen[idx(x,y)]&&(!actorAt(x,y)||(x===t.x&&y===t.y))); if(path&&path.length>1){ path.pop(); G.path=path; G.exploring=false; RD.pathT=0.2; } return; }
      G.exploring=false; setPathTo(t.x,t.y);
    });
    cv.addEventListener('pointercancel',()=>{pd=null;});
    cv.addEventListener('contextmenu',e=>e.preventDefault());
    this.showTitle();
    if(window.Telegram&&Telegram.WebApp){ try{ Telegram.WebApp.ready(); Telegram.WebApp.expand(); }catch(e){} }
  },
  key(e){
    if(e.ctrlKey||e.metaKey||e.altKey) return;
    const code=e.code;
    if(G.state==='title'||G.state==='dead'||G.state==='win'){ if(code==='Enter'||code==='Space'){ e.preventDefault(); AU.init(); this.closeOverlay(); newGame(); } return; }
    if(this.open==='inv'){
      if(code==='Escape'||code==='KeyI'){ this.closeOverlay(); e.preventDefault(); return; }
      const d=code.match(/^(?:Digit|Numpad)(\d)$/); if(d){ const n=d[1]==='0'?9:parseInt(d[1])-1; if(e.shiftKey) dropItem(n); else useItem(n); this.renderInv(); if(!G.p.inv.length) this.closeOverlay(); e.preventDefault(); }
      return;
    }
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
      case 'Tab': e.preventDefault(); RD.mini=!RD.mini; break;
      case 'KeyX': e.preventDefault(); AU.init(); if(G.path){G.path=null;G.exploring=false;} else explore(); break;
      case 'Escape': G.path=null; G.exploring=false; break;
      case 'KeyM': this.el['b-sound'].onclick(); break;
      default: { const d=code.match(/^Digit(\d)$/); if(d){ const n=d[1]==='0'?9:parseInt(d[1])-1; AU.init(); useItem(n); } }
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
    const st=[]; if(p.st.poison) st.push(`<span class="st poison">☠ ${p.st.poison}</span>`); if(p.st.drunk) st.push(`<span class="st drunk">~ ${p.st.drunk}</span>`); if(p.st.energy) st.push(`<span class="st energy">⚡ ${p.st.energy}</span>`);
    E.status.innerHTML=st.join('');
    const boss=G.mons.find(a=>a.boss&&G.map.vis[idx(a.x,a.y)]);
    if(boss){ E.bossbar.hidden=false; E['boss-name'].textContent=boss.name; E['boss-fill'].style.width=(100*boss.hp/boss.hpMax)+'%'; } else E.bossbar.hidden=true;
    E['b-down'].hidden=!(G.map&&G.map.t[idx(p.x,p.y)]===T.STAIRS);
    E['b-inv'].textContent=`Рюкзак ${p.inv.length?'('+p.inv.length+')':''}`;
    E['b-explore'].textContent=G.path?'Стоп':'Обшарить';
    if(this.open==='inv') this.renderInv();
  },
  log(){
    const E=this.el; const last=G.msgs.slice(-6);
    E.log.innerHTML=last.map((m,i)=>`<div class="m ${m.cls} ${i<last.length-1?'old':''}">${m.text}</div>`).join('');
    E.log.scrollTop=E.log.scrollHeight;
  },
  banner(title,sub,boss){
    const E=this.el; E.banner.className='show'+(boss?' boss':''); E['banner-t'].textContent=title; E['banner-s'].textContent=sub||'';
    clearTimeout(this._bt); this._bt=setTimeout(()=>{E.banner.className='';},2600);
  },
  toggleInv(){ if(G.state!=='play') return; if(this.open==='inv') this.closeOverlay(); else { this.open='inv'; this.renderInv(); this.el.overlay.hidden=false; } },
  renderInv(){
    const p=G.p; const E=this.el;
    const row=(d,i)=>{ let act='',stat=''; if(d.kind==='weapon'){act='Взять';stat=`+${d.atk} атк`;} else if(d.kind==='armor'){act='Надеть';stat=`+${d.def} защ`;} else if(d.kind==='scroll'){act='Прочитать';stat=d.desc;} else {act=d.kind==='food'?'Съесть':'Выпить';stat=d.desc;}
      return `<div class="row"><span class="num">${(i+1)%10}</span>${this.icon(d.spr)}<div class="nm">${d.name}<small>${stat}</small></div><button data-use="${i}">${act}</button><button class="drop" data-drop="${i}" title="Выбросить">✕</button></div>`; };
    E.overlay.innerHTML=`<div class="panel inv">
      <h2>Рюкзак <small>${p.inv.length}/10</small></h2>
      <div class="eq"><div>${p.weapon?this.icon(p.weapon.spr)+p.weapon.name+' <small>+'+p.weapon.atk+' атк</small>':'<span class="dim">кулаки</span>'}</div><div>${p.armor?this.icon(p.armor.spr)+p.armor.name+' <small>+'+p.armor.def+' защ</small>':'<span class="dim">футболка</span>'}</div></div>
      <div class="stats">HP ${p.hp}/${p.hpMax} · атака ${playerAtk()} · защита ${playerDef()} · ур.${p.lvl} (${p.xp}/${xpNeed(p.lvl)} xp) · этаж ${G.floor} · ход ${G.turn}</div>
      <div class="list">${p.inv.length?p.inv.map(row).join(''):'<div class="dim">Пусто. Подбирай всё, что блестит.</div>'}</div>
      <button class="big close">Закрыть</button>
    </div>`;
    E.overlay.querySelectorAll('[data-use]').forEach(b=>b.onclick=()=>{ AU.init(); useItem(+b.dataset.use); if(this.open==='inv'){ if(G.p.inv.length) this.renderInv(); else this.closeOverlay(); } });
    E.overlay.querySelectorAll('[data-drop]').forEach(b=>b.onclick=()=>{ dropItem(+b.dataset.drop); this.renderInv(); });
    E.overlay.querySelector('.close').onclick=()=>this.closeOverlay();
  },
  openShop(){ if(!G.shop||G.state!=='play') return; this.open='shop'; this.el.overlay.hidden=false; AU.sfx('door'); this.renderShop(); },
  renderShop(){
    const p=G.p,E=this.el,sh=G.shop; if(!sh) return;
    const row=(s,i)=>{ const stat=s.def.kind==='weapon'?`+${s.def.atk} атк`:s.def.kind==='armor'?`+${s.def.def} защ`:s.def.desc; const can=s.qty>0&&p.gold>=s.price&&p.inv.length<10;
      return `<div class="row"><span class="num">${(i+1)%10}</span>${this.icon(s.def.spr)}<div class="nm">${s.def.name}<small>${stat}${s.qty>1?' · x'+s.qty:''}</small></div><span class="price ${p.gold<s.price?'no':''}">${s.price} ₽</span><button data-buy="${i}" ${can?'':'disabled'}>${s.qty>0?'Купить':'Нет'}</button></div>`; };
    const sell=(d,i)=>`<div class="row"><span class="num"></span>${this.icon(d.spr)}<div class="nm">${d.name}</div><span class="price">${sellPrice(d)} ₽</span><button data-sell="${i}">Продать</button></div>`;
    E.overlay.innerHTML=`<div class="panel inv shop">
      <h2>Ларёк «24 часа» <small>у тебя ${p.gold} ₽</small></h2>
      <div class="zina">${this.icon('kiosk')}Тётя Зина: «${sh.greet}»</div>
      <div class="list">${sh.stock.map(row).join('')}</div>
      ${p.inv.length?`<h2>Сдать <small>в полцены</small></h2><div class="list">${p.inv.map(sell).join('')}</div>`:''}
      <button class="big close">Уйти</button>
    </div>`;
    E.overlay.querySelectorAll('[data-buy]').forEach(b=>b.onclick=()=>{ buyItem(+b.dataset.buy); this.renderShop(); });
    E.overlay.querySelectorAll('[data-sell]').forEach(b=>b.onclick=()=>{ sellItem(+b.dataset.sell); this.renderShop(); });
    E.overlay.querySelector('.close').onclick=()=>this.closeOverlay();
  },
  closeOverlay(){ this.open=null; this.el.overlay.hidden=true; this.el.overlay.innerHTML=''; },
  showTitle(){
    const b=loadBest(); const E=this.el; this.open='title'; G.state='title';
    E.hud.classList.add('hidden');
    E.overlay.hidden=false;
    E.overlay.innerHTML=`<div class="panel title">
      <div class="logo">ПОДВАЛ</div>
      <div class="tag">roguelike про спуск в недра хрущёвки</div>
      <div class="hero">${this.icon('player')}${this.icon('rat')}${this.icon('gopnik')}${this.icon('babka')}${this.icon('bomzh')}${this.icon('upravdom')}</div>
      <p>Восемь этажей вниз. Крысы, гопники, бабки и Управдом, который начислит пеню.<br>Умер, значит умер. Заново.</p>
      ${b.runs?`<div class="best">Лучший этаж: ${b.floor} · рекорд: ${b.score} · забегов: ${b.runs}${b.wins?' · побед: '+b.wins:''}</div>`:''}
      <button class="big start">Спуститься</button>
      <div class="help">${isTouch?'Тап по клетке: идти. Свайп: шаг. Тап по себе: ждать.<br>Враг рядом: шагни в него.':'WASD / стрелки / нумпад: шаг. QEZC: по диагонали.<br>Пробел: ждать · Enter: спуск · I: рюкзак · X: обшарить этаж · 1-9: предметы · Tab: карта'}</div>
    </div>`;
    E.overlay.querySelector('.start').onclick=()=>{ AU.init(); this.closeOverlay(); E.hud.classList.remove('hidden'); newGame(); };
  },
  endPanel(title,lines){
    const E=this.el; this.open='end'; E.overlay.hidden=false;
    E.overlay.innerHTML=`<div class="panel end"><div class="logo small">${title}</div>${lines}<button class="big start">Ещё раз</button><button class="big ghost menu">В меню</button></div>`;
    E.overlay.querySelector('.start').onclick=()=>{ AU.init(); this.closeOverlay(); newGame(); };
    E.overlay.querySelector('.menu').onclick=()=>{ this.showTitle(); };
  },
  showDeath(){
    const th=THEMES[G.floor];
    this.endPanel('ТЫ СДОХ',`<p>${G.cause==='отравление'?'Отравление доконало тебя':'Тебя прикончил: <b>'+G.cause+'</b>'} на этаже ${G.floor} (${th.name}).</p>
      <div class="stats">ходов: ${G.turn} · убито: ${G.kills} · мелочи: ${G.p.gold} ₽ · ур.${G.p.lvl}<br><b>счёт: ${score()}</b></div>`);
  },
  showWin(){
    this.endPanel('ДОЛГИ СПИСАНЫ',`<p>Управдом повержен. Квитанции больше не придут.<br>Ты выбираешься наверх, к свету и жареной картошке.</p>
      <div class="stats">ходов: ${G.turn} · убито: ${G.kills} · мелочи: ${G.p.gold} ₽ · ур.${G.p.lvl}<br><b>счёт: ${score()}</b></div>`);
  }
};
window.addEventListener('DOMContentLoaded',()=>{ initRender(); UI.init(); });
