'use strict';
const AU={ctx:null,on:true,master:null,ambOn:false,dripTimer:null,
  init(){
    if(this.ctx){ if(this.ctx.state==='suspended') this.ctx.resume(); return; }
    try{ this.ctx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){ return; }
    this.master=this.ctx.createGain(); this.master.gain.value=0.5; this.master.connect(this.ctx.destination);
    this.startAmbient();
  },
  toggle(){ this.on=!this.on; if(this.master) this.master.gain.value=this.on?0.5:0; return this.on; },
  tone(f,dur,type,vol,slide,delay){
    if(!this.ctx||!this.on) return; const c=this.ctx,t=c.currentTime+(delay||0);
    const o=c.createOscillator(),g=c.createGain(); o.type=type||'square';
    o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(20,f+slide),t+dur);
    g.gain.setValueAtTime(vol||0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    o.connect(g); g.connect(this.master); o.start(t); o.stop(t+dur+0.02);
  },
  noise(dur,vol,delay,freq){
    if(!this.ctx||!this.on) return; const c=this.ctx,t=c.currentTime+(delay||0);
    const n=Math.floor(c.sampleRate*dur); const b=c.createBuffer(1,n,c.sampleRate); const d=b.getChannelData(0); for(let i=0;i<n;i++) d[i]=Math.random()*2-1;
    const s=c.createBufferSource(); s.buffer=b; const g=c.createGain(); g.gain.setValueAtTime(vol||0.1,t); g.gain.exponentialRampToValueAtTime(0.001,t+dur);
    const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=freq||800; f.Q.value=0.7;
    s.connect(f); f.connect(g); g.connect(this.master); s.start(t); s.stop(t+dur+0.02);
  },
  sfx(n){
    if(!this.ctx) return;
    switch(n){
      case 'step': this.noise(0.03,0.035,0,400); break;
      case 'bump': this.tone(90,0.08,'square',0.05,-30); break;
      case 'hit': this.noise(0.08,0.16,0,900); this.tone(180,0.1,'square',0.07,-100); break;
      case 'crit': this.noise(0.12,0.22,0,1200); this.tone(320,0.16,'sawtooth',0.1,-220); break;
      case 'hurt': this.tone(140,0.18,'sawtooth',0.12,-80); this.noise(0.1,0.12,0,500); break;
      case 'kill': this.tone(220,0.08,'square',0.09,-120); this.tone(110,0.22,'square',0.08,-60,0.06); this.noise(0.15,0.1,0.02,600); break;
      case 'coin': this.tone(880,0.06,'square',0.06); this.tone(1320,0.1,'square',0.06,0,0.06); break;
      case 'pickup': this.tone(440,0.06,'square',0.06); this.tone(660,0.09,'square',0.06,0,0.07); break;
      case 'drink': this.tone(300,0.1,'sine',0.1,200); this.tone(500,0.12,'sine',0.08,250,0.1); break;
      case 'equip': this.tone(200,0.05,'square',0.08); this.tone(150,0.08,'square',0.08,0,0.06); break;
      case 'door': this.tone(120,0.18,'sawtooth',0.05,70); this.noise(0.12,0.05,0,300); break;
      case 'stairs': [330,262,196,131].forEach((f,i)=>this.tone(f,0.16,'triangle',0.1,0,i*0.12)); break;
      case 'levelup': [523,659,784,1047].forEach((f,i)=>this.tone(f,0.18,'square',0.07,0,i*0.09)); break;
      case 'scroll': this.noise(0.25,0.07,0,2000); this.tone(600,0.25,'sine',0.05,500); break;
      case 'zap': this.noise(0.3,0.3,0,3000); this.tone(1200,0.3,'sawtooth',0.1,-1100); break;
      case 'boss': [110,110,82,65].forEach((f,i)=>this.tone(f,0.3,'sawtooth',0.14,0,i*0.2)); this.noise(0.4,0.1,0,150); break;
      case 'summon': this.tone(500,0.1,'square',0.07,300); this.tone(500,0.1,'square',0.07,300,0.12); break;
      case 'die': this.tone(300,1.3,'sawtooth',0.15,-260); this.noise(0.5,0.2,0,400); break;
      case 'win': [523,659,784,1047,1319].forEach((f,i)=>this.tone(f,0.3,'square',0.09,0,i*0.15)); break;
    }
  },
  setBoss(on){
    if(on===this.bossOn) return; this.bossOn=on;
    if(on){ let i=0; this.bossTimer=setInterval(()=>{ if(!this.ctx||!this.on||G.state!=='play') return; const f=[55,55,65,49,55,55,73,65][i++%8]; this.tone(f,0.22,'sawtooth',0.11); if(i%2===0) this.noise(0.05,0.07,0,180); },300); }
    else { clearInterval(this.bossTimer); this.bossTimer=null; }
  },
  startAmbient(){
    const c=this.ctx; if(!c||this.ambOn) return; this.ambOn=true;
    const o=c.createOscillator(); o.type='sawtooth'; o.frequency.value=41;
    const o2=c.createOscillator(); o2.type='sine'; o2.frequency.value=41.3;
    const f=c.createBiquadFilter(); f.type='lowpass'; f.frequency.value=140; f.Q.value=2;
    const lfo=c.createOscillator(); lfo.frequency.value=0.07; const lg=c.createGain(); lg.gain.value=70; lfo.connect(lg); lg.connect(f.frequency);
    const g=c.createGain(); g.gain.value=0.045;
    o.connect(f); o2.connect(f); f.connect(g); g.connect(this.master); o.start(); o2.start(); lfo.start();
    const drip=()=>{ if(this.on&&G.state==='play'){ const fr=600+Math.random()*900; this.tone(fr,0.08,'sine',0.04,-fr*0.6); this.tone(fr*1.5,0.12,'sine',0.02,-fr*0.7,0.05);} this.dripTimer=setTimeout(drip,2500+Math.random()*6000); };
    this.dripTimer=setTimeout(drip,3000);
  }
};
