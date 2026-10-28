/* Prep Pal — planner: the week's structure, portions, storage, costs, the shopping list and the auto-planner. */
'use strict';

const GROUPS = {
  L1: { t: 'l', name: 'Lunches' },
  L2: { t: 'l', name: 'Lunches' },
  B1: { t: 'b', name: 'Breakfasts' },
  B2: { t: 'b', name: 'Breakfasts' },
  S1: { t: 's', name: 'Snacks' },
  S2: { t: 's', name: 'Snacks' },
};
const MEAL_SPLIT = { b: 0.35, l: 0.45, s: 0.2 };
const AISLES = ['Fruit & veg', 'Meat & fish', 'Dairy & eggs', 'Bakery', 'Pantry', 'Tins & jars', 'Herbs & spices', 'Frozen'];

/* ---------- weeks: each starts on the prep day ---------- */
const weekKeyFor = k => addDays(k, -((dayIdx(k) - S.wk.prep + 7) % 7));
const curWeekKey = () => weekKeyFor(today());
const planned = k => !!(S.weeks[k] && Object.keys(S.weeks[k].g).length);
function focusWeekKey() {
  const cur = curWeekKey();
  return daysBetween(cur, today()) >= 5 || !planned(cur) ? addDays(cur, 7) : cur;
}
const viewWeek = () => UI.week || (UI.week = focusWeekKey());

// want = a day you plan meals for (Settings); on = also not marked away this week.
function weekDays(k) {
  const w = weekRead(k), plan = plannedDays(S.wk);
  return Array.from({ length: 7 }, (_, o) => {
    const key = addDays(k, o), di = dayIdx(key);
    const cheat = di === S.wk.cheat, skip = !!w.skip[o], want = plan.includes(di);
    return { o, key, di, cheat, skip, want, on: want && !skip };
  });
}

// Which days each group covers (offsets from the prep day). One recipe per meal covers every
// planned day; two recipes split the days in half.
function groupDays(days) {
  const P = days.filter(d => d.on).map(d => d.o);
  const split = v => { if (v !== 2) return [P, []]; const h = Math.ceil(P.length / 2); return [P.slice(0, h), P.slice(h)]; };
  const [L1, L2] = split(S.wk.lVar), [B1, B2] = split(S.wk.bVar), [S1, S2] = split(S.wk.sVar);
  return { L1, L2, B1, B2, S1, S2, P };
}

function weekCtx(k) {
  return memo('ctx:' + k, () => {
    const days = weekDays(k);
    const gd = groupDays(days);
    const T = weekTargets(gd.P.length);
    const dayK = dailyTargets(S.prof).kcal * S.wk.share / 100;
    const mealK = { b: dayK * MEAL_SPLIT.b, l: dayK * MEAL_SPLIT.l, s: dayK * MEAL_SPLIT.s };
    const auto = {};
    for (const r of RECIPES) auto[r.id] = clamp(roundTo(mealK[r.t] / RK[r.id], 0.25), 0.5, 3);
    const prev = weekRead(addDays(k, -7)), prev2 = weekRead(addDays(k, -14));
    return { k, days, gd, T, mealK, auto, prevIds: new Set(Object.values(prev.g)), prev2Ids: new Set(Object.values(prev2.g)) };
  });
}
const portion = (ctx, rid) => S.por[rid] || ctx.auto[rid];

// A short label for a list of day offsets, e.g. "Mon–Thu", "Sun & Sat".
function daysLabel(k, offs) {
  if (!offs.length) return '';
  const names = offs.map(o => DAYS[dayIdx(addDays(k, o))]);
  const run = offs.every((o, i) => !i || o === offs[i - 1] + 1);
  if (run && offs.length >= 3) return `${names[0]}–${names[names.length - 1]}`;
  if (names.length === 1) return names[0];
  return `${names.slice(0, -1).join(', ')} & ${names[names.length - 1]}`;
}

/* ---------- storage: where each serve comes from ---------- */
// at = the day offset it's made (-1 = the night before prep day). src: fresh, fridge, freezer, frozen.
function storagePlan(r, offs) {
  const out = [], sess = [];
  let cur = null;
  for (const o of offs) {
    if (r.fz === 2) {
      if (!cur) { cur = { at: 0, n: 0 }; sess.push(cur); }
      cur.n++;
      out.push({ o, at: 0, src: 'frozen' });
      continue;
    }
    if (!cur) { cur = { at: r.night && o === 0 ? -1 : 0, n: 0 }; sess.push(cur); }
    let d = o - cur.at;
    if (d > r.keep && !r.fz) { cur = { at: o - 1, n: 0 }; sess.push(cur); d = 1; }
    cur.n++;
    out.push({ o, at: cur.at, src: d <= 0 ? 'fresh' : d <= r.keep ? (r.shelf ? 'pantry' : 'fridge') : 'freezer' });
  }
  return { out, sess };
}

// Recipes chosen for the week, merged into batches (the same recipe in two groups is one batch).
function batches(ctx, sel) {
  const by = {};
  for (const gid of GROUP_IDS) {
    const rid = sel[gid], offs = ctx.gd[gid];
    if (!rid || !RBY[rid] || !offs.length) continue;
    const b = by[rid] || (by[rid] = { rid, r: RBY[rid], offs: [], groups: [] });
    b.offs.push(...offs);
    b.groups.push(gid);
  }
  return Object.values(by).map(b => {
    b.offs.sort((x, y) => x - y);
    b.n = b.offs.length;
    b.m = portion(ctx, b.rid);
    b.plan = storagePlan(b.r, b.offs);
    return b;
  });
}

// Prep-day session time: hands-on work overlaps the slowest dish's cooking, plus 10 min to pack up.
function timeOf(bs) {
  let hands = 0, longest = 0, any = false;
  const extra = [];
  for (const b of bs) {
    for (const s of b.plan.sess) {
      if (s.at === 0) { hands += b.r.hands; longest = Math.max(longest, b.r.mins); any = true; } else extra.push({ at: s.at, rid: b.rid, n: s.n, mins: b.r.mins, hands: b.r.hands });
    }
  }
  extra.sort((a, b) => a.at - b.at);
  return { prep: any ? Math.max(hands, longest) + 10 : 0, hands, extra };
}

/* ---------- prices and packs ---------- */
function packsOf(fid) {
  return memo('packs:' + fid, () => {
    const f = FOODS[fid], ov = S.prices[fid] || [];
    if (f.each) return [{ g: f.each[0], p: ov[0] != null ? ov[0] : f.each[1], label: f.each[2], many: f.each[3], each: true }];
    return f.packs.map(([g, p, label], i) => ({ g, p: ov[i] != null ? ov[i] : p, label }));
  });
}
const unitPrice = fid => memo('unit:' + fid, () => Math.min(...packsOf(fid).map(p => p.p / p.g)));
const stapleFree = fid => !!(FOODS[fid].staple && S.staples);

let BUY_CACHE = null;
// Cheapest set of packs covering the amount (3% under is close enough).
function buyFor(fid, need) {
  if (need <= 0) return { cost: 0, grams: 0, items: [] };
  const key = fid + ':' + Math.round(need);
  if (BUY_CACHE && key in BUY_CACHE) return BUY_CACHE[key];
  const packs = packsOf(fid);
  const want = need * 0.97;
  let best = null;
  const idx = packs.map((p, i) => i).sort((a, b) => packs[b].g - packs[a].g);
  const counts = new Array(packs.length).fill(0);
  const go = (j, have) => {
    const i = idx[j];
    if (j === idx.length - 1) {
      const n = Math.max(0, Math.ceil((want - have) / packs[i].g - 1e-9));
      counts[i] = n;
      const grams = have + n * packs[i].g;
      const cost = counts.reduce((t, c, x) => t + c * packs[x].p, 0);
      if (grams > 0 && (!best || cost < best.cost - 1e-9 || (Math.abs(cost - best.cost) < 1e-9 && grams < best.grams))) {
        best = { cost, grams, items: counts.map((c, x) => [x, c]).filter(([, c]) => c) };
      }
      return;
    }
    const max = Math.ceil(Math.max(0, want - have) / packs[i].g);
    for (let c = 0; c <= max; c++) { counts[i] = c; go(j + 1, have + c * packs[i].g); }
    counts[i] = 0;
  };
  go(0, 0);
  if (BUY_CACHE) BUY_CACHE[key] = best;
  return best;
}

// What the week's food costs you: fresh food in whole packs, long-life food by what you use.
function foodCost(fid, need) {
  if (stapleFree(fid)) return 0;
  return FOODS[fid].keep === 'long' ? need * unitPrice(fid) : buyFor(fid, need).cost;
}

function buyText(fid, b) {
  const packs = packsOf(fid);
  return b.items.map(([i, c]) => {
    const p = packs[i];
    if (p.each) return `${c} ${c === 1 ? p.label : p.many}`;
    return c === 1 ? p.label : `${c} × ${p.label}`;
  }).join(' + ');
}

/* ---------- evaluating a plan ---------- */
function evalPlan(ctx, sel, full) {
  const bs = batches(ctx, sel);
  const tot = new Float64Array(NN);
  const need = {};
  for (const b of bs) {
    const k = b.n * b.m, v = RN[b.rid];
    for (let i = 0; i < NN; i++) tot[i] += v[i] * k;
    for (const [fid, g] of RING[b.rid]) need[fid] = (need[fid] || 0) + g * k;
  }
  let cost = 0;
  for (const fid in need) cost += foodCost(fid, need[fid]);
  const tm = timeOf(bs);
  const goals = goalCheck(tot, ctx.T);
  let J = 0, met = 0;
  for (const g of goals) {
    const w = NUT_INFO[g.n].w;
    let x = 0;
    if (g.v < g.lo) x = (g.lo - g.v) / Math.max(g.lo, 1e-9);
    else if (g.v > g.hi) x = (g.v - g.hi) / Math.max(g.hi, 1e-9);
    J += w * 100 * x * x;
    if (g.ok) met++; else J += w * 3;
  }
  const B = Math.max(1, S.budget);
  J += (10 * cost) / B + (60 * Math.max(0, cost - B)) / B;
  if (S.wk.maxPrep && tm.prep > S.wk.maxPrep) J += (tm.prep - S.wk.maxPrep) / 5;
  // Everything should be made on prep day; a mid-week top-up only if nothing else fits.
  J += tm.extra.length * 2 + sum(tm.extra.map(e => e.hands)) / 20;
  const same = (a, b) => sel[a] && sel[a] === sel[b] && ctx.gd[a].length && ctx.gd[b].length;
  if (same('B1', 'B2')) J += 1.2;
  if (same('S1', 'S2')) J += 1.2;
  if (same('L1', 'L2')) J += 1.5;
  for (const gid of GROUP_IDS) {
    const rid = sel[gid];
    if (!rid || !ctx.gd[gid].length) continue;
    if (ctx.prevIds.has(rid)) J += 0.5;
    else if (ctx.prev2Ids.has(rid)) J += 0.35;
    if (S.fav.includes(rid)) J -= 0.6;
  }
  if (!full) return J;
  return { J, tot, need, cost, tm, goals, met, n: goals.length, bs };
}

const weekEval = k => memo('eval:' + k, () => evalPlan(weekCtx(k), weekRead(k).g, true));

/* ---------- the auto-planner ---------- */
function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const hashStr = s => { let h = 2166136261; for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619); return h >>> 0; };

const candidates = (gid, all) => RECIPES.filter(r => r.t === GROUPS[gid].t && (all || allowed(r))).map(r => r.id);

// Picks recipes for every unlocked group: goals first, then cost, prep time, top-ups and variety.
function autoPlan(k, opts = {}) {
  const ctx = weekCtx(k);
  const w = weekEdit(k);
  const gids = GROUP_IDS.filter(g => ctx.gd[g].length);
  const cand = {};
  for (const g of gids) {
    cand[g] = w.lock[g] && w.g[g] ? [w.g[g]] : candidates(g);
    if (!cand[g].length) cand[g] = candidates(g, true);
  }
  const steer = opts.steer || {};
  const extra = sel => sum(gids.map(g => (steer[g] && steer[g] === sel[g] ? 2.5 : 0)));
  BUY_CACHE = {};
  const score = sel => evalPlan(ctx, sel) + extra(sel);
  const space = gids.reduce((t, g) => t * cand[g].length, 1);
  const found = space <= 6000 ? searchAll(gids, cand, score) : searchLocal(gids, cand, score, rng(hashStr(k) + (opts.seed || 0) * 7919));
  BUY_CACHE = null;
  const best = found.sel;
  w.g = { ...w.g, ...best };
  for (const g of GROUP_IDS) if (!ctx.gd[g].length && !w.lock[g]) delete w.g[g];
  if (opts.seed != null) w.seed = opts.seed;
  save();
  return best;
}

// Few meals to choose (e.g. one breakfast, one lunch and one snack): try every combination.
function searchAll(gids, cand, score) {
  let best = {}, bestJ = Infinity;
  const sel = {};
  const walk = i => {
    if (i === gids.length) {
      const j = score(sel);
      if (j < bestJ - 1e-9) { bestJ = j; best = { ...sel }; }
      return;
    }
    for (const rid of cand[gids[i]]) { sel[gids[i]] = rid; walk(i + 1); }
  };
  walk(0);
  return { sel: best, J: bestJ };
}

// Many meals: random restarts with single swaps, then pairs of swaps that single swaps can miss.
function searchLocal(gids, cand, score, rand) {
  let best = {}, bestJ = Infinity;
  for (let rs = 0; rs < 12; rs++) {
    const sel = {};
    for (const g of gids) sel[g] = cand[g][Math.floor(rand() * cand[g].length)];
    let J = score(sel), improved = true, guard = 0;
    while (improved && guard++ < 10) {
      improved = false;
      const order = gids.slice().sort(() => rand() - 0.5);
      for (const g of order) {
        let bj = J, br = sel[g];
        for (const rid of cand[g]) {
          if (rid === sel[g]) continue;
          sel[g] = rid;
          const j = score(sel);
          if (j < bj - 1e-9) { bj = j; br = rid; }
        }
        sel[g] = br;
        if (bj < J - 1e-9) { J = bj; improved = true; }
      }
    }
    if (J < bestJ - 1e-9) { bestJ = J; best = { ...sel }; }
  }
  let improved = true, rounds = 0;
  while (improved && rounds++ < 3) {
    improved = false;
    for (let a = 0; a < gids.length; a++) {
      for (let b = a + 1; b < gids.length; b++) {
        const ga = gids[a], gb = gids[b];
        if (cand[ga].length < 2 || cand[gb].length < 2) continue;
        const sel = { ...best };
        for (const ra of cand[ga]) {
          sel[ga] = ra;
          for (const rb of cand[gb]) {
            sel[gb] = rb;
            const j = score(sel);
            if (j < bestJ - 1e-9) { bestJ = j; best = { ...sel }; improved = true; }
          }
        }
      }
    }
  }
  return { sel: best, J: bestJ };
}
// After an update that changes the week's shape, re-plan the weeks that haven't started. Locked meals stay.
function upgradePlans() {
  const t = today();
  let n = 0;
  for (const k of Object.keys(S.weeks)) if (k > t && planned(k)) { autoPlan(k); n++; }
  save();
  return n;
}

// Plans the week the first time you look at it.
function ensurePlan(k) {
  if (!S.onboarded || planned(k)) return;
  if (daysBetween(curWeekKey(), k) < 0) return;
  autoPlan(k);
}

/* ---------- shopping ---------- */
// Long-life food left over from the last few weeks' shops (only items you ticked as bought).
function carryIn(k) {
  return memo('carry:' + k, () => {
    let stock = {};
    for (let i = 4; i >= 1; i--) {
      const pk = addDays(k, -7 * i), pw = S.weeks[pk];
      if (!pw || !Object.keys(pw.g).length) continue;
      const ev = weekEval(pk), next = {};
      for (const fid of Object.keys(FOODS)) {
        if (FOODS[fid].keep !== 'long') continue;
        const need = ev.need[fid] || 0;
        const start = pw.stock[fid] != null ? pw.stock[fid] : stock[fid] || 0;
        const bought = pw.got[fid] && need > start ? buyFor(fid, need - start).grams : 0;
        const end = start + bought - need;
        if (end > 1) next[fid] = end;
      }
      stock = next;
    }
    return stock;
  });
}

function shopList(k) {
  return memo('shop:' + k, () => {
    const w = weekRead(k), ev = weekEval(k), carry = carryIn(k);
    const items = [];
    for (const [fid, need] of Object.entries(ev.need)) {
      const f = FOODS[fid];
      const staple = stapleFree(fid);
      const stock = w.stock[fid] != null ? w.stock[fid] : f.keep === 'long' ? Math.round(carry[fid] || 0) : 0;
      let toBuy = Math.max(0, need - stock);
      if (toBuy < Math.max(5, need * 0.03)) toBuy = 0;
      const b = toBuy > 0 ? buyFor(fid, toBuy) : { cost: 0, grams: 0, items: [] };
      items.push({
        fid, f, need, stock, toBuy, b, staple,
        have: !!w.have[fid] || (toBuy === 0 && !staple),
        mark: !!w.have[fid], got: !!w.got[fid],
        left: Math.max(0, b.grams - toBuy),
      });
    }
    items.sort((a, b) => AISLES.indexOf(a.f.a) - AISLES.indexOf(b.f.a) || a.f.n.localeCompare(b.f.n));
    const buy = items.filter(i => !i.staple && !i.have);
    const shop = sum(buy.map(i => i.b.cost));
    const done = buy.filter(i => i.got).length;
    return { items, buy, shop, food: ev.cost, done, ev };
  });
}

function shopText(k) {
  const L = shopList(k), lines = [`Prep Pal shopping list — ${fmtRange(k, addDays(k, 6))}`];
  let aisle = '';
  for (const it of L.buy) {
    if (it.f.a !== aisle) { aisle = it.f.a; lines.push('', aisle.toUpperCase()); }
    lines.push(`${it.got ? '✓' : '•'} ${it.f.n} — ${buyText(it.fid, it.b)} (${money(it.b.cost)})`);
  }
  const st = L.items.filter(i => i.staple);
  if (st.length) { lines.push('', 'CHECK YOU HAVE'); for (const it of st) lines.push(`• ${it.f.n} (${needText(it.fid, it.need)})`); }
  lines.push('', `Total about ${money(L.shop)}`);
  return lines.join('\n');
}

/* ---------- days ---------- */
// What you eat on a day of the week and where it comes from.
function dayMeals(k, o) {
  const ev = weekEval(k), w = weekRead(k), out = [];
  for (const t of ['b', 'l', 's']) {
    for (const b of ev.bs) {
      if (b.r.t !== t) continue;
      const s = b.plan.out.find(x => x.o === o);
      if (s) { out.push({ t, b, s, gid: b.groups.find(g => weekCtx(k).gd[g].includes(o)) }); break; }
    }
  }
  return { meals: out, day: weekCtx(k).days[o], lock: w.lock };
}

// Jobs for the evening of day offset o: thaw tomorrow's frozen meals and make anything due tomorrow.
function eveningJobs(k, o) {
  const jobs = [];
  const add = (wk, off) => {
    if (!planned(wk)) return;
    const ev = weekEval(wk);
    for (const b of ev.bs) {
      const thaw = b.plan.out.filter(s => s.o === off + 1 && s.src === 'freezer').length;
      if (thaw) jobs.push({ kind: 'thaw', b, n: thaw });
      for (const s of b.plan.sess) if (s.at === off && off !== 0) jobs.push({ kind: 'make', b, n: s.n });
    }
  };
  add(k, o);
  if (o === 6) add(addDays(k, 7), -1);
  return jobs;
}

const SRC_TEXT = { fresh: 'made today', fridge: 'from the fridge', pantry: 'from the pantry', freezer: 'from the freezer', frozen: 'from the freezer' };
