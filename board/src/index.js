// ПОДВАЛ — daily leaderboard.
//
//   GET  /board/<YYYYMMDD>            -> { day, count, top: [{name, score, cls, floor, win, kills, turn, t}] }
//   POST /board/<YYYYMMDD>  {name, score, cls, floor, win, kills, turn}
//                                     -> { rank, count, top } (keeps the best result per name)
//
// One Durable Object per day; entries live in its storage under "entries".

const DAY_RE = /^\d{8}$/;
const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': '*' };
const json = (o, status = 200) => new Response(JSON.stringify(o), { status, headers: { 'content-type': 'application/json', ...CORS } });
const TOP = 50;
const CLS = ['vasyan', 'mihalych', 'lyoha', 'barsik'];

export class Board {
  constructor(state) { this.state = state; }

  async fetch(req) {
    const url = new URL(req.url);
    const day = url.pathname.split('/')[2];
    let entries = (await this.state.storage.get('entries')) || [];
    if (req.method === 'POST') {
      let b; try { b = await req.json(); } catch (e) { return json({ error: 'bad json' }, 400); }
      const name = String(b.name || '').replace(/[^\p{L}\p{N} _.\-]/gu, '').trim().slice(0, 16);
      const score = Math.floor(Number(b.score) || 0), floor = Math.floor(Number(b.floor) || 0);
      if (!name) return json({ error: 'name' }, 400);
      if (score < 0 || score > 6000 || floor < 1 || floor > 8) return json({ error: 'range' }, 400);
      const e = { name, score, floor, cls: CLS.includes(b.cls) ? b.cls : 'vasyan', win: !!b.win, kills: Math.min(999, Math.floor(Number(b.kills) || 0)), turn: Math.min(99999, Math.floor(Number(b.turn) || 0)), t: Date.now() };
      const key = name.toLowerCase();
      const i = entries.findIndex(x => x.name.toLowerCase() === key);
      if (i >= 0) { if (entries[i].score >= score) { /* keep best */ } else entries[i] = e; } else entries.push(e);
      entries.sort((a, b) => b.score - a.score || a.t - b.t);
      entries = entries.slice(0, TOP);
      await this.state.storage.put('entries', entries);
      const rank = entries.findIndex(x => x.name.toLowerCase() === key) + 1;
      return json({ day, rank: rank || null, count: entries.length, top: entries.slice(0, 20) });
    }
    return json({ day, count: entries.length, top: entries.slice(0, 20) });
  }
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
    const url = new URL(req.url);
    const m = url.pathname.match(/^\/board\/(\d{8})$/);
    if (!m || !DAY_RE.test(m[1])) return new Response('podval board: ok', { headers: { 'content-type': 'text/plain', ...CORS } });
    if (req.method !== 'GET' && req.method !== 'POST') return json({ error: 'method' }, 405);
    const id = env.BOARD.idFromName(m[1]);
    return env.BOARD.get(id).fetch(req);
  }
};
