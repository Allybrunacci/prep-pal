/* Prep Pal — Plan: the week's meals at the top, and a bank of recipes you drag onto them. */
'use strict';

const TIME_CHIPS = [[0, 'Any time'], [10, '≤ 10 min'], [20, '≤ 20 min'], [30, '≤ 30 min'], [45, '≤ 45 min'], [60, '≤ 1 hr']];
const SORTS = [['fit', 'Best fit'], ['quick', 'Quickest'], ['cheap', 'Cheapest'], ['prot', 'Most protein']];
const TILE_ORDER = ['B1', 'L1', 'S1', 'B2', 'L2', 'S2'];
const mealIcon = t => icon(MEALS[t].icon);
const keepText = r => (r.fz === 2 ? 'Kept frozen' : `Keeps ${r.keep} days${r.fz ? ' · freezes' : ''}`);
const serveCost = (rid, m) => sum(RING[rid].map(([f, g]) => (stapleFree(f) ? 0 : g * unitPrice(f)))) * (m || 1);
const shortMins = m => (m < 60 ? `${Math.round(m)}m` : `${Math.floor(m / 60)}h${Math.round(m % 60) ? ` ${Math.round(m % 60)}m` : ''}`);

function recMatches(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return r.n.toLowerCase().includes(s) || Object.keys(r.ing).some(f => FOODS[f].n.toLowerCase().includes(s) || (FOODS[f].rn || '').includes(s));
}

/* ---------- shared by every tab ---------- */
function weekName(k) {
  const diff = Math.round(daysBetween(curWeekKey(), k) / 7);
  return diff === 0 ? 'This week' : diff === 1 ? 'Next week' : diff === -1 ? 'Last week' : diff > 0 ? `In ${diff} weeks` : `${-diff} weeks ago`;
}

function weekNav(k) {
  const diff = Math.round(daysBetween(curWeekKey(), k) / 7);
  const meals = daysLabel(k, weekCtx(k).gd.P);
  return `<div class="week-nav">
    <button type="button" class="icon-btn" data-act="wk-prev" aria-label="Previous week" ${diff <= -4 ? 'disabled' : ''}>${icon('chev-l')}</button>
    <div class="wk-label"><b>${weekName(k)}</b><span>${DAYS[dayIdx(k)]} ${fmtShort(k)} prep${meals ? ` · meals ${meals}` : ''}</span></div>
    <button type="button" class="icon-btn" data-act="wk-next" aria-label="Next week" ${diff >= 4 ? 'disabled' : ''}>${icon('chev-r')}</button>
  </div>`;
}

const SHARED_ACT = {
  'wk-prev': () => { UI.week = addDays(viewWeek(), -7); render(true); },
  'wk-next': () => { UI.week = addDays(viewWeek(), 7); render(true); },
  recipe: a => recipeSheet(a.dataset.rid),
};

// "Fridge Mon–Wed · Freezer Thu"
function storageLine(k, outs) {
  const by = {};
  for (const s of outs) (by[s.src] || (by[s.src] = [])).push(s.o);
  const names = { fresh: 'Fresh', fridge: 'Fridge', pantry: 'Pantry', freezer: 'Freezer', frozen: 'Freezer' };
  return ['fresh', 'fridge', 'pantry', 'freezer', 'frozen'].filter(s => by[s]).map(s => `${names[s]} ${daysLabel(k, by[s])}`).join(' · ');
}

const srcChip = src => (src === 'freezer' || src === 'frozen' ? `<span class="src frz">${icon('snow')}Freezer</span>`
  : src === 'fridge' ? `<span class="src fridge">${icon('fridge')}Fridge</span>`
    : src === 'pantry' ? `<span class="src pantry">${icon('bag')}Pantry</span>` : `<span class="src fresh">${icon('chef')}Fresh</span>`);

const atText = (k, at) => `${DAYS_LONG[dayIdx(addDays(k, at))]} night`;

function jobsHtml(k, jobs) {
  return jobs.map(j => (j.kind === 'thaw'
    ? `<li>${icon('snow')}<span>Move ${j.n > 1 ? `${j.n} serves of ` : ''}<b>${esc(j.b.r.n)}</b> from the freezer to the fridge</span></li>`
    : `<li>${icon('moon')}<span>Make <b>${esc(j.b.r.n)}</b> × ${j.n} <small>(${fmtMins(j.b.r.mins)})</small></span></li>`)).join('');
}

// Shown on Prep, Shop and Goals when the week has nothing in it yet.
function emptyWeek(nav, k) {
  if (!weekCtx(k).gd.P.length) {
    return `${nav}<section class="card empty-state"><h2>No meal days this week</h2>
      <p class="sub">${plannedDays(S.wk).length ? 'You’re away on every meal day.' : 'Choose the days you want meals for in Settings.'}</p>
      <button type="button" class="btn" data-action="settings">${icon('gear')}Settings</button></section>`;
  }
  return `${nav}<section class="card empty-state"><h2>Nothing planned yet</h2>
    <p class="sub">Drag recipes from the recipe bank onto this week’s meals.</p>
    <a class="btn" href="#/plan">${icon('week')}Plan this week</a></section>`;
}

/* ---------- the week's meals ---------- */
const typesOf = ctx => ['b', 'l', 's'].filter(t => slotsOf(ctx).some(g => GROUPS[g].t === t));
const slotsFor = (ctx, t) => slotsOf(ctx).filter(g => GROUPS[g].t === t);

// Where a recipe goes when you tap +: the first empty slot for its meal, else the first slot.
function targetSlot(k, t) {
  const slots = slotsFor(weekCtx(k), t), g = weekRead(k).g;
  return slots.find(s => !g[s]) || slots[0] || null;
}

// The next meal type with an empty slot, starting after `after`.
function nextEmptyType(k, after) {
  const ctx = weekCtx(k), g = weekRead(k).g, types = typesOf(ctx);
  const i = types.indexOf(after);
  const order = i < 0 ? types : types.slice(i + 1).concat(types.slice(0, i + 1));
  return order.find(t => slotsFor(ctx, t).some(s => !g[s])) || null;
}

let FLASH = new Set();
function tileHtml(k, ctx, gid) {
  const t = GROUPS[gid].t, offs = ctx.gd[gid], r = RBY[weekRead(k).g[gid]];
  const two = slotsFor(ctx, t).length > 1;
  const label = `<span class="t-label">${MEALS[t].name}${two ? ` · ${daysLabel(k, offs)}` : ''}</span>`;
  const attrs = `data-drop data-g="${gid}" data-t="${t}" data-act="tile"`;
  if (!r) {
    return `<button type="button" class="tile empty" ${attrs} aria-label="${MEALS[t].name}: empty. Drop a recipe here.">${label}
      <span class="t-emoji t-plus">${icon('plus')}</span><span class="t-name">Drop a ${MEALS[t].name.toLowerCase()}</span><span class="t-meta">${plural(offs.length, 'serve')}</span></button>`;
  }
  return `<button type="button" class="tile${FLASH.has(gid) ? ' pop' : ''}${allowed(r) ? '' : ' bad'}" ${attrs} aria-label="${MEALS[t].name}: ${esc(r.n)}">${label}
    <span class="t-emoji" aria-hidden="true">${r.e}</span><span class="t-name">${esc(r.n)}</span><span class="t-meta">${offs.length} serves · ${shortMins(r.mins)}</span></button>`;
}

function miniRing(p) {
  const C = 2 * Math.PI * 9;
  return `<svg class="mini-ring" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" class="mr-bg"/><circle cx="12" cy="12" r="9" class="mr-fg" style="stroke-dasharray:${C.toFixed(2)};stroke-dashoffset:${(C * (1 - clamp(p, 0, 1))).toFixed(2)}"/></svg>`;
}

// Goals met, cost and prep time. With `base`, also shows how a drop would change them.
function sumHtml(ev, base) {
  const any = ev.bs.length > 0;
  if (base && !base.bs.length) base = null;
  const delta = (v, cls, text) => (Math.abs(v) > 0.5 ? `<i class="delta ${cls}">${text}</i>` : '');
  const dGoals = base ? delta(ev.met - base.met, ev.met >= base.met ? 'up' : 'down', `${ev.met > base.met ? '+' : '−'}${Math.abs(ev.met - base.met)}`) : '';
  const dCost = base ? delta(ev.cost - base.cost, ev.cost <= base.cost ? 'up' : 'down', `${ev.cost > base.cost ? '+' : '−'}${money0(Math.abs(ev.cost - base.cost))}`) : '';
  const dTime = base ? delta(ev.tm.prep - base.tm.prep, ev.tm.prep <= base.tm.prep ? 'up' : 'down', `${ev.tm.prep > base.tm.prep ? '+' : '−'}${shortMins(Math.abs(ev.tm.prep - base.tm.prep))}`) : '';
  return `<a class="sum-i" href="#/goals">${miniRing(any ? ev.met / ev.n : 0)}<span><b>${any ? `${ev.met}/${ev.n}` : '–'}${dGoals}</b><small>goals</small></span></a>
    <a class="sum-i${ev.cost > S.budget ? ' warn' : ''}" href="#/shop">${icon('bag')}<span><b>${money0(ev.cost)}${dCost}</b><small>of ${money0(S.budget)}</small></span></a>
    <a class="sum-i" href="#/prep">${icon('clock')}<span><b>${any ? shortMins(ev.tm.prep) : '–'}${dTime}</b><small>prep</small></span></a>`;
}

/* ---------- the recipe bank ---------- */
function bankCard(x, t, tag) {
  const r = x.r, f = x.fit;
  return `<li class="bcard${tag === 'used' ? ' used' : ''}" data-drag data-rid="${r.id}">
    <span class="grip" aria-hidden="true">${icon('grip')}</span>
    <button type="button" class="bc-main" data-act="recipe" data-rid="${r.id}">
      <span class="bc-emoji" aria-hidden="true">${r.e}</span>
      <span class="bc-text"><b>${esc(r.n)}</b>
        <small>${icon('clock')}${fmtMins(r.mins)} · ${keepText(r)}${r.night ? ' · overnight' : ''}</small>
        <small>${fmtNum(RK[r.id] * x.m)} kcal · ${fmtNum(x.prot)} g protein · ${money(x.cost)}</small>
        ${f ? `<small class="bc-fit${f.met === f.n ? ' all' : ''}">${icon('target')}${f.exact ? '' : 'Up to '}${f.met}/${f.n} goals · ${money0(f.cost)} a week</small>` : ''}
      </span>
    </button>
    <span class="bc-side">
      ${tag === 'used' ? '<span class="bc-tag">In plan</span>' : tag === 'best' ? '<span class="bc-tag best">Best fit</span>' : ''}
      <button type="button" class="bc-add" data-act="add" data-rid="${r.id}" aria-label="Add ${esc(r.n)} to ${MEALS[t].name.toLowerCase()}">${icon('plus')}</button>
    </span>
  </li>`;
}

function bankList(k) {
  const ctx = weekCtx(k), t = UI.bank, slot = targetSlot(k, t), mine = weekRead(k).g;
  const used = new Set(slotsOf(ctx).map(g => mine[g]).filter(Boolean));
  const all = RECIPES.filter(r => r.t === t), ok = all.filter(r => allowed(r));
  let list = ok.filter(r => recMatches(r, UI.q));
  const slow = UI.time ? list.filter(r => r.mins > UI.time).length : 0;
  if (UI.time) list = list.filter(r => r.mins <= UI.time);
  const rows = list.map(r => {
    const m = portion(ctx, r.id);
    return { r, m, fit: slot ? fitFor(k, slot, r.id) : null, cost: serveCost(r.id, m), prot: RN[r.id][NI.prot] * m };
  });
  const by = {
    fit: (a, b) => (a.fit ? a.fit.J : 1e9) - (b.fit ? b.fit.J : 1e9) || a.r.mins - b.r.mins,
    quick: (a, b) => a.r.mins - b.r.mins || a.cost - b.cost,
    cheap: (a, b) => a.cost - b.cost || a.r.mins - b.r.mins,
    prot: (a, b) => b.prot - a.prot,
  };
  rows.sort(by[UI.sort] || by.fit);
  const best = UI.sort === 'fit' && rows.length && rows[0].fit ? rows[0].r.id : null;
  const hidden = all.length - ok.length;
  const none = !rows.length
    ? `<li class="bank-empty">${UI.q ? `No ${MEALS[t].many.toLowerCase()} match “${esc(UI.q)}”.` : UI.time ? 'Nothing that quick — try a longer time.' : `No ${MEALS[t].many.toLowerCase()} fit your diet and food settings.`}</li>` : '';
  return `${rows.map(x => bankCard(x, t, used.has(x.r.id) ? 'used' : x.r.id === best ? 'best' : '')).join('')}${none}
    ${slow ? `<li class="hint">${plural(slow, 'more recipe')} take${slow === 1 ? 's' : ''} longer than that.</li>` : ''}
    ${hidden ? `<li class="hint">${plural(hidden, 'recipe')} hidden by your diet and food settings.</li>` : ''}`;
}

function scrollToBank() {
  const head = $('.bank-head'), tray = $('#tray');
  if (!head || !tray) return;
  const y = head.getBoundingClientRect().top + window.scrollY - tray.offsetHeight - 6;
  if (window.scrollY > y) window.scrollTo({ top: Math.max(0, y), behavior: reduceMotion() ? 'auto' : 'smooth' });
}

// Put a recipe in a meal slot, with undo.
function place(k, gid, rid) {
  const w = weekEdit(k), before = { ...w.g }, r = RBY[rid], t = GROUPS[gid].t;
  if (w.g[gid] === rid) { toast(`${esc(r.n)} is already there.`); return; }
  const wasComplete = isComplete(k);
  w.g[gid] = rid;
  save();
  buzz(12);
  FLASH = new Set([gid]);
  const typeFull = !slotsFor(weekCtx(k), t).some(g => !weekRead(k).g[g]);
  const next = typeFull ? nextEmptyType(k, t) : null;
  if (next) UI.bank = next;
  render();
  if (next) scrollToBank();
  const undo = () => { weekEdit(k).g = before; save(); render(); };
  if (!wasComplete && isComplete(k)) {
    const ev = weekEval(k);
    if (ev.met === ev.n) confetti(50);
    toast(`Week planned: ${ev.met}/${ev.n} goals, ${money0(ev.cost)} a week.`, { undo });
    return;
  }
  toast(`${r.e} ${esc(r.n)} → ${MEALS[t].name.toLowerCase()}${next ? `. Next, a ${MEALS[next].name.toLowerCase()}.` : '.'}`, { undo });
}

VIEWS.plan = {
  title: 'Plan',
  render() {
    const k = viewWeek(), ctx = weekCtx(k), slots = slotsOf(ctx), nav = weekNav(k);
    if (!slots.length) return emptyWeek(nav, k);
    const types = typesOf(ctx);
    if (!types.includes(UI.bank)) UI.bank = nextEmptyType(k) || types[0];
    const w = weekRead(k), ev = weekEval(k);
    const empty = slots.filter(g => !w.g[g]);
    const anyPicked = empty.length < slots.length;
    const canRepeat = !anyPicked && slotsOf(weekCtx(addDays(k, -7))).some(g => weekRead(addDays(k, -7)).g[g]);
    const tiles = TILE_ORDER.filter(g => slots.includes(g)).map(g => tileHtml(k, ctx, g)).join('');
    FLASH = new Set();
    return `${nav}
      <section class="tray" id="tray" aria-label="This week’s meals">
        <div class="tiles">${tiles}</div>
        <div class="sum" id="sum">${sumHtml(ev)}</div>
      </section>
      ${anyPicked ? '' : `<section class="card start">
        <p><b>Let’s plan ${weekName(k).toLowerCase()}.</b> Hold a recipe below and drag it up onto a meal — or let Prep Pal fill the week for your goals and budget.</p>
        <div class="btn-row">${canRepeat ? `<button type="button" class="btn ghost small" data-act="repeat">${icon('repeat')}Same as last week</button>` : ''}
          <button type="button" class="btn small" data-act="fill">${icon('spark')}Fill for me</button></div></section>`}
      <div class="bank-head"><h2>Recipe bank</h2>
        ${anyPicked ? `<div class="bh-btns"><button type="button" class="link-btn" data-act="clear">Clear</button>
          <button type="button" class="btn small" data-act="fill">${icon('spark')}${empty.length ? 'Fill the rest' : 'New mix'}</button></div>` : ''}</div>
      ${seg(types.map(t => [t, `${MEALS[t].many}${slotsFor(ctx, t).some(g => !w.g[g]) ? '<i class="dot" title="Not chosen yet"></i>' : ''}`]), UI.bank, 'bank', 'bank-seg')}
      <div class="scroll-x">${chipRow(TIME_CHIPS, UI.time, 'time', 'How long it takes')}</div>
      <div class="bank-tools">
        <label class="search"><span class="sr-only">Search recipes</span><input type="search" name="q" placeholder="Search recipes" value="${esc(UI.q)}" autocomplete="off"></label>
        <label class="sort-sel"><span class="sr-only">Sort recipes</span><select name="sort">${SORTS.map(([v, l]) => `<option value="${v}"${UI.sort === v ? ' selected' : ''}>${l}</option>`).join('')}</select></label>
      </div>
      <p class="hint drag-hint">${icon('grip')}<span>Hold a recipe, then drag it onto a meal above — or tap <b>+</b>. Times are for the whole batch.</span></p>
      <ul class="bank" id="bank">${bankList(k)}</ul>`;
  },
  act: {
    tile: a => {
      const k = viewWeek(), gid = a.dataset.g;
      if (weekRead(k).g[gid]) { mealSheet(k, gid); return; }
      UI.bank = a.dataset.t;
      render();
      scrollToBank();
      toast(`Pick a ${MEALS[a.dataset.t].name.toLowerCase()}: drag it up, or tap +.`);
    },
    bank: a => { UI.bank = a.dataset.v; render(); },
    time: a => { UI.time = +a.dataset.v; render(); },
    add: a => {
      const k = viewWeek(), rid = a.dataset.rid, slot = targetSlot(k, RBY[rid].t);
      if (slot) place(k, slot, rid);
    },
    fill: () => {
      const k = viewWeek(), ctx = weekCtx(k), w = weekEdit(k), before = { ...w.g };
      const slots = slotsOf(ctx), empty = slots.filter(g => !w.g[g]);
      if (empty.length) autoPlan(k, { mode: 'fill' });
      else autoPlan(k, { mode: 'all', steer: { ...w.g }, seed: (w.seed || 0) + 1 });
      const changed = slots.filter(g => before[g] !== weekRead(k).g[g]);
      FLASH = new Set(changed);
      const next = nextEmptyType(k);
      if (next) UI.bank = next;
      render();
      const ev = weekEval(k);
      const undo = () => { weekEdit(k).g = before; save(); render(); };
      if (!changed.length) { toast('This is already the best mix for your goals and budget.'); return; }
      if (empty.length === slots.length && ev.met === ev.n) confetti(40);
      toast(`${empty.length ? 'Filled' : 'New mix'}: ${ev.met}/${ev.n} goals, ${money0(ev.cost)} a week.`, { undo });
    },
    repeat: () => {
      const k = viewWeek(), prev = weekRead(addDays(k, -7)), w = weekEdit(k), before = { ...w.g };
      const slots = slotsOf(weekCtx(k));
      for (const g of slots) if (prev.g[g]) w.g[g] = prev.g[g];
      save();
      FLASH = new Set(slots.filter(g => w.g[g]));
      render();
      toast('Copied last week’s meals.', { undo: () => { weekEdit(k).g = before; save(); render(); } });
    },
    clear: () => {
      const k = viewWeek(), w = weekEdit(k), before = { ...w.g };
      w.g = {};
      save();
      UI.bank = typesOf(weekCtx(k))[0];
      render();
      toast('Cleared this week’s meals.', { undo: () => { weekEdit(k).g = before; save(); render(); } });
    },
  },
  input(e) {
    if (e.target.name !== 'q') return;
    UI.q = e.target.value.slice(0, 40);
    $('#bank').innerHTML = bankList(viewWeek());
  },
  change(e) {
    if (e.target.name !== 'sort') return;
    UI.sort = e.target.value;
    $('#bank').innerHTML = bankList(viewWeek());
  },
};

/* ---------- a meal's details ---------- */
function mealSheet(k, gid) {
  const ctx = weekCtx(k);
  const draw = () => {
    const w = weekRead(k), rid = w.g[gid], r = RBY[rid];
    const t = GROUPS[gid].t, offs = ctx.gd[gid];
    const title = `${MEALS[t].name} · ${daysLabel(k, offs)}`;
    if (!r) return `${sheetHead(title)}<p class="lead">Nothing here yet. Drag a ${MEALS[t].name.toLowerCase()} from the recipe bank onto this meal, or tap + on one.</p>`;
    const b = weekEval(k).bs.find(x => x.rid === rid);
    const m = portion(ctx, rid), auto = !S.por[rid];
    const own = b ? b.plan.out.filter(s => offs.includes(s.o)) : [];
    const note = s => (s.src === 'freezer' ? `move to the fridge ${DAYS[dayIdx(addDays(k, s.o - 1))]} night`
      : s.src === 'frozen' ? 'straight from the freezer'
        : s.at !== 0 ? `made ${atText(k, s.at).toLowerCase()}` : s.src === 'fresh' ? 'eat it fresh' : 'made on prep day');
    return `${sheetHead(title, `${plural(offs.length, 'serve')}, one batch`)}
      <div class="hero"><span class="hero-emoji" aria-hidden="true">${r.e}</span><div><h3>${esc(r.n)}</h3>
        <p class="sub">${icon('clock')}${fmtMins(r.mins)}${r.hands < r.mins ? ` (${fmtMins(r.hands)} hands-on)` : ''}${r.night ? ' · made the night before' : ''}</p></div></div>
      <div class="store-box">${own.map(s => `<div class="sb-row"><b>${DAYS[dayIdx(addDays(k, s.o))]}</b>${srcChip(s.src)}<span>${note(s)}</span></div>`).join('')}
        ${own.some(s => s.src === 'freezer') ? `<p class="tiny">${icon('info')}Cooked food keeps 2–3 days in the fridge, so later serves go in the freezer on prep day.</p>` : ''}</div>
      <div class="serve-row"><div><b>Your serve</b><small>${auto ? 'Sized to your energy needs' : 'Set by you'} · ${fmtNum(RK[rid] * m)} kcal</small></div>${stepper('por', `×${frac(m)}`, 'Serve size')}</div>
      ${auto ? '' : '<button type="button" class="link-btn" data-act="por-auto">Back to automatic size</button>'}
      <div class="nut-grid">${['prot', 'carb', 'fat', 'fib'].map(n => `<div><b>${fmtNum(RN[rid][NI[n]] * m)} g</b><small>${NUT_INFO[n].n}</small></div>`).join('')}<div><b>${money(serveCost(rid, m))}</b><small>a serve</small></div></div>
      ${allowed(r) ? '' : '<p class="err">This recipe doesn’t fit your diet or food settings any more.</p>'}
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="open">${icon('book')}Recipe</button>
        <button type="button" class="btn ghost" data-act="remove">${icon('trash')}Remove</button>
      </div>
      <p class="hint">To swap it, drag another ${MEALS[t].name.toLowerCase()} from the bank onto this meal.</p>`;
  };
  openSheet(draw(), {
    label: 'Meal',
    act: {
      open: () => recipeSheet(weekRead(k).g[gid]),
      remove: (a, e, sh) => {
        const w = weekEdit(k), before = w.g[gid], t = GROUPS[gid].t;
        delete w.g[gid];
        save();
        sh.close();
        UI.bank = t;
        render();
        toast(`Removed ${esc(RBY[before].n)}.`, { undo: () => { weekEdit(k).g[gid] = before; save(); render(); } });
      },
      step: (a, e, sh) => {
        const rid = weekRead(k).g[gid];
        S.por[rid] = clamp(portion(ctx, rid) + (+a.dataset.d) * 0.25, 0.25, 4);
        save(); sh.set(draw()); render();
      },
      'por-auto': (a, e, sh) => { delete S.por[weekRead(k).g[gid]]; save(); sh.set(draw()); render(); },
    },
  });
}

/* ---------- drag and drop (mouse, pen and touch) ---------- */
// Touch: hold a recipe for a moment, then drag. Mouse: just drag. Dropping on a meal of the same type places it.
let DRAG = null;
let SUPPRESS_CLICK = 0;
const DRAG_ACTIVE = () => !!(DRAG && DRAG.active);

function initDrag() {
  document.addEventListener('pointerdown', dragDown, { passive: true });
  document.addEventListener('pointermove', dragMove, { passive: false });
  document.addEventListener('pointerup', dragUp);
  document.addEventListener('pointercancel', dragCancel);
  document.addEventListener('touchmove', e => { if (DRAG && DRAG.active) e.preventDefault(); }, { passive: false });
  document.addEventListener('contextmenu', e => { if (e.target.closest && e.target.closest('[data-drag]')) e.preventDefault(); });
  document.addEventListener('click', e => { if (Date.now() < SUPPRESS_CLICK) { e.stopPropagation(); e.preventDefault(); } }, true);
  window.addEventListener('blur', () => { if (DRAG) { if (DRAG.active) dragEnd(); else dragForget(); } });
}

function dragDown(e) {
  if (CUR !== 'plan' || SHEET || DRAG) return;
  if (!e.target.closest || e.target.closest('.bc-add')) return;
  const card = e.target.closest('[data-drag]');
  if (!card || (e.pointerType === 'mouse' && e.button !== 0)) return;
  const rid = card.dataset.rid;
  DRAG = { card, rid, t: RBY[rid].t, x0: e.clientX, y0: e.clientY, x: e.clientX, y: e.clientY, pid: e.pointerId, type: e.pointerType, active: false, timer: null, over: null };
  if (e.pointerType !== 'mouse') {
    card.classList.add('pressing');
    DRAG.timer = setTimeout(startDrag, 260);
  }
}

function dragMove(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  DRAG.x = e.clientX;
  DRAG.y = e.clientY;
  if (!DRAG.active) {
    const dist = Math.hypot(e.clientX - DRAG.x0, e.clientY - DRAG.y0);
    if (DRAG.type === 'mouse') { if (dist > 6) startDrag(); } else if (dist > 10) dragForget();
    return;
  }
  e.preventDefault();
  placeGhost();
  dragHover();
}

function dragForget() {
  if (!DRAG) return;
  clearTimeout(DRAG.timer);
  DRAG.card.classList.remove('pressing');
  DRAG = null;
}

function startDrag() {
  const d = DRAG;
  if (!d || d.active || !d.card.isConnected) { dragForget(); return; }
  d.active = true;
  d.card.classList.remove('pressing');
  const r = RBY[d.rid];
  const g = document.createElement('div');
  g.className = 'drag-ghost';
  g.innerHTML = `<span aria-hidden="true">${r.e}</span><b>${esc(r.n)}</b>`;
  document.body.append(g);
  d.ghost = g;
  d.gw = g.offsetWidth;
  d.gh = g.offsetHeight;
  d.card.classList.add('lifted');
  document.body.classList.add('dragging');
  for (const tile of $$('.tile[data-drop]')) tile.classList.add(tile.dataset.t === d.t ? 'can-drop' : 'no-drop');
  d.base = weekEval(viewWeek());
  buzz(15);
  placeGhost();
  dragHover();
}

// The ghost sits above your finger (so you can see where you're dropping) or beside the mouse pointer.
// Near the top of the screen it moves beside your finger instead, so it never slides off-screen.
function placeGhost() {
  const d = DRAG, W = window.innerWidth;
  let x = d.type === 'mouse' ? d.x + 14 : d.x - d.gw / 2;
  let y = d.type === 'mouse' ? d.y + 10 : d.y - d.gh - 44;
  if (y < 6) {
    y = Math.max(6, d.y - d.gh / 2);
    x = d.x < W / 2 ? d.x + 34 : d.x - d.gw - 34;
  }
  x = clamp(x, 6, W - d.gw - 6);
  d.ghost.style.transform = `translate(${Math.round(x)}px, ${Math.round(y)}px) rotate(-2deg)`;
}

function dragHover() {
  const d = DRAG;
  const el = document.elementFromPoint(d.x, d.y);
  let zone = el && el.closest ? el.closest('[data-drop]') : null;
  if (zone && zone.dataset.t !== d.t) zone = null;
  if (zone === d.over) return;
  if (d.over) d.over.classList.remove('over');
  d.over = zone;
  const box = $('#sum');
  if (zone) {
    zone.classList.add('over');
    buzz(6);
    const k = viewWeek();
    const ev = evalPlan(weekCtx(k), { ...weekRead(k).g, [zone.dataset.g]: d.rid }, true);
    if (box) { box.innerHTML = sumHtml(ev, d.base); box.classList.add('preview'); }
  } else if (box) {
    box.innerHTML = sumHtml(d.base);
    box.classList.remove('preview');
  }
}

function dragUp(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  if (!DRAG.active) { dragForget(); return; }
  dragHover();
  const { rid, t } = DRAG, zone = DRAG.over;
  dragEnd();
  SUPPRESS_CLICK = Date.now() + 400;
  if (zone) place(viewWeek(), zone.dataset.g, rid);
  else toast(`Drop it on ${MEALS[t].name} at the top to add it.`);
}

function dragCancel(e) {
  if (!DRAG || e.pointerId !== DRAG.pid) return;
  if (DRAG.active) dragEnd(); else dragForget();
}

function dragEnd() {
  const d = DRAG;
  DRAG = null;
  clearTimeout(d.timer);
  if (d.ghost) d.ghost.remove();
  d.card.classList.remove('lifted', 'pressing');
  if (d.over) d.over.classList.remove('over');
  for (const tile of $$('.tile')) tile.classList.remove('can-drop', 'no-drop');
  document.body.classList.remove('dragging');
  const box = $('#sum');
  if (box && d.base) { box.innerHTML = sumHtml(d.base); box.classList.remove('preview'); }
}
