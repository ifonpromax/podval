'use strict';
const MAX_FLOOR=8;
const THEMES=[null,
 {name:'Подъезд',     sub:'пахнет кошками и жареной картошкой', floor:'#56604e', floor2:'#4a5443', wall:'#3f6e4b', wallTop:'#cfc6a4', wallDark:'#2c4d35', paint:true, decor:['cig','trash','crack','puddle']},
 {name:'Подвал',      sub:'тут когда-то была качалка',          floor:'#4b4b50', floor2:'#404046', wall:'#6e3c32', wallTop:'#8d5a4a', wallDark:'#3e221c', decor:['crack','trash','puddle','bones']},
 {name:'Теплотрасса', sub:'тепло, сыро, кто-то здесь живёт',    floor:'#5a4a38', floor2:'#4e4030', wall:'#7c4a2c', wallTop:'#a4683c', wallDark:'#4a2c18', decor:['puddle','puddle','trash','bones']},
 {name:'Бомбоубежище',sub:'запасы консервов 1986 года',         floor:'#4a5248', floor2:'#3e463c', wall:'#5c6670', wallTop:'#8e98a4', wallDark:'#343c44', decor:['crack','crack','trash','cig']},
 {name:'Катакомбы',   sub:'кости и надписи «ДМБ-98»',           floor:'#3c3a3a', floor2:'#333030', wall:'#5a5250', wallTop:'#7c726e', wallDark:'#302a28', decor:['bones','bones','crack','puddle']},
 {name:'Коллектор',   sub:'не дыши глубоко',                    floor:'#3a4a3a', floor2:'#2f3f2f', wall:'#4a5a40', wallTop:'#6c7c5a', wallDark:'#2a3424', decor:['puddle','puddle','puddle','trash']},
 {name:'Метро-2',     sub:'поезда сюда не ходят',               floor:'#3a3e52', floor2:'#30344a', wall:'#6a4a60', wallTop:'#a08090', wallDark:'#3a2838', decor:['crack','cig','trash','bones']},
 {name:'Логово Управдома', sub:'здесь начисляют долги',          floor:'#3a2a40', floor2:'#2e2034', wall:'#5a2a5a', wallTop:'#8c4a8c', wallDark:'#301830', decor:['scroll','crack','bones','cig']},
];

const MON={
 rat:     {name:'Крыса',          spr:'rat',     hp:4, atk:2,def:0,spd:120,xp:3, minF:1,maxF:4, w:10,animal:true, a:'кусает'},
 pigeon:  {name:'Голубь',         spr:'pigeon',  hp:3, atk:1,def:0,spd:100,xp:2, minF:1,maxF:3, w:8, animal:true,erratic:true, a:'клюёт'},
 roach:   {name:'Таракан',        spr:'roach',   hp:1, atk:1,def:0,spd:130,xp:1, minF:1,maxF:5, w:6, animal:true,pack:[3,5], a:'щекочет'},
 gopnik:  {name:'Гопник',         spr:'gopnik',  hp:9, atk:3,def:0,spd:100,xp:8, minF:2,maxF:6, w:10,steal:true,pack:[1,2], a:'бьёт с ноги'},
 bomzh:   {name:'Бомж',           spr:'bomzh',   hp:14,atk:2,def:0,spd:70, xp:9, minF:3,maxF:7, w:8, poison:true, a:'дышит на'},
 babka:   {name:'Бабка',          spr:'babka',   hp:12,atk:4,def:1,spd:80, xp:12,minF:3,maxF:8, w:7, ranged:true, a:'лупит сумкой'},
 plumber: {name:'Сантехник',      spr:'plumber', hp:18,atk:5,def:1,spd:100,xp:16,minF:4,maxF:8, w:7, a:'бьёт ключом'},
 mrat:    {name:'Крыса-мутант',   spr:'mrat',    hp:20,atk:5,def:1,spd:150,xp:18,minF:5,maxF:8, w:6, animal:true, a:'грызёт'},
 ghost:   {name:'Призрак жильца', spr:'ghost',   hp:12,atk:4,def:2,spd:90, xp:20,minF:6,maxF:8, w:5, ghost:true, a:'воет на'},
 dvornik: {name:'Дворник',        spr:'dvornik', hp:50,atk:6,def:1,spd:100,xp:60,boss:true, a:'метёт'},
 upravdom:{name:'Управдом',       spr:'upravdom',hp:120,atk:9,def:3,spd:100,xp:200,boss:true,summon:true, a:'начисляет пени'},
};

const ITEMS={
 gold:    {name:'Мелочь',          spr:'gold',    kind:'gold'},
 kefir:   {name:'Кефир',           spr:'kefir',   kind:'potion', heal:12, desc:'+12 HP'},
 boyara:  {name:'Боярышник',       spr:'boyara',  kind:'potion', heal:30, drunk:8, desc:'+30 HP, штормит 8 ходов'},
 energy:  {name:'Энергетик',       spr:'energy',  kind:'potion', energy:12, desc:'двойная скорость 12 ходов'},
 shaurma: {name:'Шаурма',          spr:'shaurma', kind:'food',   heal:8,  desc:'+8 HP, но с вокзала'},
 sc_tele: {name:'Записка: Телепорт',spr:'scroll', kind:'scroll', effect:'tele', desc:'перенесёт куда-то'},
 sc_map:  {name:'План БТИ',        spr:'scroll',  kind:'scroll', effect:'map',  desc:'показывает этаж'},
 sc_zap:  {name:'Записка: Электрик',spr:'scroll', kind:'scroll', effect:'zap',  desc:'током по всем видимым'},
 w1:{name:'Арматура',  spr:'armatura',  kind:'weapon',atk:2},
 w2:{name:'Монтировка',spr:'montirovka',kind:'weapon',atk:3},
 w3:{name:'Лопата',    spr:'lopata',    kind:'weapon',atk:4},
 w4:{name:'Бензопила', spr:'chainsaw',  kind:'weapon',atk:6},
 a1:{name:'Телогрейка',spr:'telogreika',kind:'armor',def:1},
 a2:{name:'Кожанка',   spr:'kozhanka',  kind:'armor',def:2},
 a3:{name:'Бронежилет',spr:'bronik',    kind:'armor',def:3},
};
for(const k in ITEMS) ITEMS[k].id=k;
for(const k in MON) MON[k].id=k;

function itemTable(f){
  return [
    {v:'kefir',w:14},{v:'shaurma',w:8},{v:'boyara',w:f>=2?6:2},{v:'energy',w:f>=2?5:1},
    {v:'sc_tele',w:4},{v:'sc_map',w:4},{v:'sc_zap',w:f>=2?5:1},
    {v:'w1',w:f<=3?5:1},{v:'w2',w:f>=2&&f<=5?4:1},{v:'w3',w:f>=4?4:0},{v:'w4',w:f>=6?2:0},
    {v:'a1',w:f<=3?5:1},{v:'a2',w:f>=3&&f<=6?3:0},{v:'a3',w:f>=5?2:0},
  ].filter(e=>e.w>0);
}
function monTable(f){
  const t=[]; for(const k in MON){const m=MON[k]; if(m.boss)continue; if(f>=m.minF&&f<=m.maxF) t.push({v:k,w:m.w});} return t;
}
const FLAVOR={
  enter:[ 'Ступеньки скользкие.', 'Где-то капает.', 'Лампочка моргает и гаснет.', 'На стене написано «ЦОЙ ЖИВ».', 'Пахнет сыростью и чем-то ещё.', 'Шаги эхом. Твои ли?', 'Внизу кто-то кашлянул.' ],
  gopnik:[ 'Э, есть чё?', 'Слышь, пацан, поясни за прикид.', 'Семки будешь?', 'Ты с какого района?' ],
  babka:[ 'Ироды!', 'Я на вас управдому пожалуюсь!', 'В моё время такого не было!', 'Ну-ка иди сюда, шпана!' ],
  bomzh:[ 'Братан, дай на чекушку.', 'Это моё место!', 'Ты пришёл… я знал…' ],
  plumber:[ 'Стояк менять надо.', 'Кто тут воду не платит?', 'Ща перекрою всё.' ],
  dvornik:[ 'Намусорили тут!', 'Я с пяти утра на ногах!', 'Щас как размету!' ],
  upravdom:[ 'У вас долг за капремонт.', 'Квитанция придёт в понедельник.', 'Пеня начислена.', 'Крысы, фас!' ],
  ghost:[ 'Я… жил… в пятой…', 'Отключили… газ…', 'Верните… двушку…' ],
  zina:[ 'Чё надо? Сдачи нет.', 'Кефир свежий, вчерашний.', 'Бери, не раздумывай.', 'Карту не принимаю, только мелочь.', 'Ты с какой квартиры?' ],
};
