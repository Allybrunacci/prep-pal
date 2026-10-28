/* Prep Pal — Week: today, the prep-day plan, this week's meals and swapping recipes. */
'use strict';

const GROUP_ORDER = ['L1', 'L2', 'B1', 'B2', 'S1', 'S2'];
const TIME_CHIPS = [[0, 'Any time'], [10, '≤ 10 min'], [20, '≤ 20 min'], [30, '≤ 30 min'], [45, '≤ 45 min'], [60, '≤ 1 hr']];
const mealIcon = t => icon(MEALS[t].icon);

function weekNav(k) {
  const diff = Math.round(daysBetween(curWeekKey(), k) / 7);
  const name = diff === 0 ? 'This week' : diff === 1 ? 'Next week' : diff === -1 ? 'Last week' : diff > 0 ? `In ${diff} weeks` : `${-diff} weeks ago`;
  return `<div class="week-nav">
    <button type="button" class="icon-btn" data-act="wk-prev" aria-label="Previous week" ${diff <= -4 ? 'disabled' : ''}>${icon('chev-l')}</button>
    <div class="wk-label"><b>${name}</b><span>${fmtDay(k)} – ${fmtDay(addDays(k, 6))}</span></div>
    <button type="button" class="icon-btn" data-act="wk-next" aria-label="Next week" ${diff >= 4 ? 'disabled' : ''}>${icon('chev-r')}</button>
  </div>`;
}

const SHARED_ACT = {
  'wk-prev': () => { UI.week = addDays(viewWeek(), -7); render(true); },
  'wk-next': () => { UI.week = addDays(viewWeek(), 7); render(true); },
  recipe: a => recipeSheet(a.dataset.rid),
  meal: a => mealSheet(viewWeek(), a.dataset.g),
  plan: () => { autoPlan(viewWeek()); render(); toast('Planned — goals first, then the cheapest options.'); },
};

// "Fridge Mon–Wed · Freezer Thu"
function storageLine(k, outs) {
  const by = {};
  for (const s of outs) (by[s.src] || (by[s.src] = [])).push(s.o);
  const names = { fresh: 'Fresh', fridge: 'Fridge', pantry: 'Pantry', freezer: 'Freezer', frozen: 'Freezer' };
  return ['fresh', 'fridge', 'pantry', 'freezer', 'frozen'].filter(s => by[s]).map(s => `${names[s]} ${daysLabel(k, by[s])}`).join(' · ');
}

const srcChip = src => (src === 'freezer' || src === 'frozen' ? `<span class="src frz">${icon('snow')}Freezer</span>` : src === 'fridge' ? `<span class="src">${icon('fridge')}Fridge</span>` : src === 'pantry' ? `<span class="src">${icon('bag')}Pantry</span>` : `<span class="src fresh">${icon('chef')}Fresh</span>`);

function servingLine(ctx, rid) {
  const m = portion(ctx, rid);
  return `${m === 1 ? '1 serve' : `${frac(m)}× serve`} · ${fmtNum(RK[rid] * m)} kcal · ${fmtNum(RN[rid][NI.prot] * m)} g protein`;
}

const atText = (k, at) => (at === -1 ? `${DAYS_LONG[dayIdx(addDays(k, -1))]} night` : `${DAYS_LONG[dayIdx(addDays(k, at))]} night`);

function jobsHtml(k, jobs) {
  return jobs.map(j => (j.kind === 'thaw'
    ? `<li>${icon('snow')}<span>Move ${j.n > 1 ? `${j.n} serves of ` : ''}<b>${esc(j.b.r.n)}</b> from the freezer to the fridge</span></li>`
    : `<li>${icon('moon')}<span>Make <b>${esc(j.b.r.n)}</b> × ${j.n} <small>(${fmtMins(j.b.r.mins)})</small></span></li>`)).join('');
}

function todayCard(k) {
  const o = daysBetween(k, today());
  if (o < 0 || o > 6) return '';
  const { meals, day } = dayMeals(k, o);
  const jobs = eveningJobs(k, o);
  let body;
  if (day.cheat) body = `<p class="today-cheat">${icon('pizza')} Cheat day — nothing planned. Enjoy it!</p>`;
  else if (day.skip) body = '<p class="sub">You marked today as away.</p>';
  else {
    body = `<ul class="today-list">${meals.map(m => `<li><button type="button" class="today-row" data-act="recipe" data-rid="${m.b.rid}">
      <span class="tl-ic">${mealIcon(m.t)}</span><span class="tl-main"><small>${MEALS[m.t].name}</small><b>${m.b.r.e} ${esc(m.b.r.n)}</b></span>${srcChip(m.s.src)}</button></li>`).join('')}</ul>`;
  }
  return `<section class="card today" aria-label="Today">
    <div class="card-top"><h2>Today</h2><span class="muted">${DAYS_LONG[day.di]}${o === 0 ? ' · prep day' : ''}</span></div>
    ${body}
    ${jobs.length ? `<div class="tonight"><h3>Tonight</h3><ul class="jobs">${jobsHtml(k, jobs)}</ul></div>` : ''}
  </section>`;
}

function prepCard(k, ev) {
  const made = ev.bs.filter(b => b.plan.sess.some(s => s.at === 0)).sort((a, b) => b.r.mins - a.r.mins);
  const before = ev.tm.extra.filter(e => e.at === -1), later = ev.tm.extra.filter(e => e.at > 0);
  const extraLi = e => `<li>${icon('moon')}<span><b>${atText(k, e.at)}:</b> ${esc(RBY[e.rid].n)} × ${e.n} <small>(${fmtMins(RBY[e.rid].mins)})</small></span></li>`;
  return `<section class="card prep" aria-label="Prep day">
    <div class="card-top"><h2>${DAYS_LONG[dayIdx(k)]} prep</h2><span class="pill">${icon('clock')}${fmtMins(ev.tm.prep)}</span></div>
    <p class="sub">${fmtDay(k)} · cook once, eat all week</p>
    <ul class="prep-list">${made.map(b => `<li><span class="pl-emoji" aria-hidden="true">${b.r.e}</span><span class="pl-main"><b>${esc(b.r.n)}</b>
      <small>${b.plan.sess.find(s => s.at === 0).n} serves · ${fmtMins(b.r.mins)} · ${storageLine(k, b.plan.out.filter(s => s.at === 0))}</small></span></li>`).join('')}</ul>
    ${before.length || later.length ? `<ul class="jobs">${before.map(extraLi).join('')}${later.map(extraLi).join('')}</ul>` : ''}
    <button type="button" class="btn wide" data-act="prep">${icon('chef')}Start prep</button>
  </section>`;
}

function mealCard(k, ctx, ev, gid) {
  const offs = ctx.gd[gid];
  if (!offs.length) return '';
  const rid = weekRead(k).g[gid];
  const r = RBY[rid];
  const t = GROUPS[gid].t;
  const label = `${t === 'l' && gid === 'L1' ? 'Prep lunches' : MEALS[t].name} · ${daysLabel(k, offs)}`;
  if (!r) return `<button type="button" class="meal-card empty" data-act="meal" data-g="${gid}"><span class="mc-emoji">${icon('plus')}</span><span class="mc-main"><small>${label}</small><b>Choose a recipe</b></span></button>`;
  const cost = sum(RING[rid].map(([f, g]) => (stapleFree(f) ? 0 : g * unitPrice(f)))) * portion(ctx, rid);
  return `<button type="button" class="meal-card" data-act="meal" data-g="${gid}">
    <span class="mc-emoji" aria-hidden="true">${r.e}</span>
    <span class="mc-main"><small>${label}</small><b>${esc(r.n)}</b><span class="mc-meta">${servingLine(ctx, rid)} · ${money(cost)} a serve</span>${allowed(r) ? '' : '<span class="mc-warn">Doesn’t fit your diet settings — tap to swap</span>'}</span>
    ${weekRead(k).lock[gid] ? `<span class="mc-lock" title="Locked in">${icon('lock')}</span>` : ''}${icon('chev-r', 'mc-chev')}
  </button>`;
}

function glance(k, ev) {
  const ctx = weekCtx(k);
  return `<div class="glance">${ctx.days.map(d => {
    if (d.cheat) return `<button type="button" class="g-day cheat" data-act="day" data-o="${d.o}"><span class="g-name">${DAYS[d.di]}</span><span class="g-cheat">${icon('pizza')}Cheat day</span></button>`;
    if (d.skip) return `<button type="button" class="g-day away" data-act="day" data-o="${d.o}"><span class="g-name">${DAYS[d.di]}</span><span class="g-cheat">Away</span></button>`;
    const { meals } = dayMeals(k, d.o);
    return `<button type="button" class="g-day${d.key === today() ? ' now' : ''}" data-act="day" data-o="${d.o}"><span class="g-name">${DAYS[d.di]}${d.o === 0 ? '<i>prep</i>' : ''}</span>
      <span class="g-meals">${meals.map(m => `<span class="g-meal${m.s.src === 'freezer' || m.s.src === 'frozen' ? ' frz' : ''}" title="${esc(m.b.r.n)}">${m.b.r.e}</span>`).join('')}</span></button>`;
  }).join('')}</div>`;
}

VIEWS.week = {
  title: 'Week',
  render() {
    const k = viewWeek();
    ensurePlan(k);
    const nav = weekNav(k);
    if (!planned(k)) {
      return `${nav}<section class="card empty-state"><h2>No plan for this week</h2><p class="sub">Past weeks aren't planned automatically.</p>
        <button type="button" class="btn" data-act="plan">${icon('spark')}Plan this week</button></section>`;
    }
    const ctx = weekCtx(k), ev = weekEval(k), L = shopList(k);
    const over = ev.cost > S.budget;
    const grp = (title, ids) => {
      const cards = ids.map(g => mealCard(k, ctx, ev, g)).join('');
      return cards ? `<h3 class="grp-title">${title}</h3>${cards}` : '';
    };
    return `${nav}
      <div class="stats">
        <a class="stat" href="#/goals"><span class="stat-ic">${icon('target')}</span><b>${ev.met}/${ev.n}</b><small>goals met</small></a>
        <a class="stat${over ? ' warn' : ''}" href="#/shop"><span class="stat-ic">${icon('bag')}</span><b>${money0(ev.cost)}</b><small>of ${money0(S.budget)} budget</small></a>
        <div class="stat"><span class="stat-ic">${icon('clock')}</span><b>${fmtMins(ev.tm.prep).replace(' min', 'm').replace(' h ', 'h ')}</b><small>prep time</small></div>
      </div>
      ${planned(curWeekKey()) ? todayCard(curWeekKey()) : ''}
      ${over || ev.met < ev.n ? `<section class="card nudge"><p>${icon('info')}<span>${over ? `This week is ${money(ev.cost - S.budget)} over budget` : `${plural(ev.n - ev.met, 'goal')} not met`}${over && ev.met < ev.n ? ` and ${plural(ev.n - ev.met, 'goal')} not met` : ''}. Re-plan to find a better mix (locked meals stay).</span></p>
        <button type="button" class="btn small" data-act="plan">${icon('spark')}Re-plan</button></section>` : ''}
      ${prepCard(k, ev)}
      ${sectionTitle('This week’s meals', `<button type="button" class="link-btn" data-act="shuffle">${icon('shuffle')}Shuffle</button>`)}
      <p class="hint">Tap a meal to swap it or change your serve. Swapped meals stay locked in when you shuffle.</p>
      ${grp('Lunches', ['L1', 'L2'])}${grp('Breakfasts', ['B1', 'B2'])}${grp('Snacks', ['S1', 'S2'])}
      ${sectionTitle('Week at a glance')}
      ${glance(k, ev)}
      <p class="hint"><span class="dot-key" aria-hidden="true"></span>White dot = comes out of the freezer. Tap a day for details or to mark it as away.</p>
      <p class="hint center">Shopping list: ${L.buy.length} items, about ${money(L.shop)} · <a href="#/shop">Open</a></p>`;
  },
  act: {
    prep: () => prepSheet(viewWeek()),
    shuffle: () => {
      const k = viewWeek(), w = weekEdit(k);
      const before = { ...w.g };
      const steer = {};
      for (const g of GROUP_IDS) if (!w.lock[g] && w.g[g]) steer[g] = w.g[g];
      autoPlan(k, { seed: (w.seed || 0) + 1, steer });
      render();
      const changed = GROUP_IDS.filter(g => before[g] !== weekRead(k).g[g]).length;
      toast(changed ? `New ideas for ${plural(changed, 'meal')}.` : 'This is still the best fit — lock or swap meals to change it.', {
        undo: () => { weekEdit(k).g = before; save(); render(); },
      });
    },
    day: a => daySheet(viewWeek(), +a.dataset.o),
  },
};

/* ---------- sheets ---------- */
function mealSheet(k, gid) {
  const ctx = weekCtx(k);
  const draw = () => {
    const w = weekRead(k), rid = w.g[gid], r = RBY[rid];
    const t = GROUPS[gid].t, offs = ctx.gd[gid];
    const title = `${gid === 'L1' ? 'Prep lunches' : MEALS[t].many} · ${daysLabel(k, offs)}`;
    if (!r) return `${sheetHead(title)}<button type="button" class="btn wide" data-act="swap">${icon('swap')}Choose a recipe</button>`;
    const b = weekEval(k).bs.find(x => x.rid === rid);
    const m = portion(ctx, rid), auto = !S.por[rid];
    const cost = sum(RING[rid].map(([f, g]) => (stapleFree(f) ? 0 : g * unitPrice(f)))) * m;
    const own = b ? b.plan.out.filter(s => offs.includes(s.o)) : [];
    const thaw = own.filter(s => s.src === 'freezer');
    return `${sheetHead(title)}
      <div class="hero"><span class="hero-emoji" aria-hidden="true">${r.e}</span><div><h3>${esc(r.n)}</h3>
        <p class="sub">${icon('clock')}${fmtMins(r.mins)}${r.hands < r.mins ? ` (${fmtMins(r.hands)} hands-on)` : ''}${r.night ? ' · made the night before' : ''}</p></div></div>
      <div class="store-box">${own.map(s => `<div class="sb-row"><b>${DAYS[dayIdx(addDays(k, s.o))]}</b>${srcChip(s.src)}<span>${s.src === 'freezer' ? `move to the fridge ${DAYS[dayIdx(addDays(k, s.o - 1))]} night` : s.src === 'frozen' ? 'straight from the freezer' : s.at === -1 ? `made ${atText(k, -1).toLowerCase()}` : s.at > 0 ? `made ${atText(k, s.at).toLowerCase()}` : s.src === 'fresh' ? 'eat it fresh' : 'made on prep day'}</span></div>`).join('')}
        ${thaw.length ? `<p class="tiny">${icon('info')}Cooked food keeps 2–3 days in the fridge, so later serves go in the freezer on prep day.</p>` : ''}</div>
      <div class="serve-row"><div><b>Your serve</b><small>${auto ? 'Sized to your energy needs' : 'Set by you'} · ${fmtNum(RK[rid] * m)} kcal</small></div>${stepper('por', `×${frac(m)}`, 'Serve size')}</div>
      ${auto ? '' : '<button type="button" class="link-btn" data-act="por-auto">Back to automatic size</button>'}
      <div class="nut-grid">${['prot', 'carb', 'fat', 'fib'].map(n => `<div><b>${fmtNum(RN[rid][NI[n]] * m)} g</b><small>${NUT_INFO[n].n}</small></div>`).join('')}<div><b>${money(cost)}</b><small>per serve</small></div></div>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="open">${icon('book')}Recipe</button>
        <button type="button" class="btn" data-act="swap">${icon('swap')}Swap</button>
      </div>
      ${switchRow('lock', 'Lock this meal in', 'Shuffle and re-planning won’t change it', !!w.lock[gid])}`;
  };
  openSheet(draw(), {
    label: 'Meal',
    act: {
      swap: () => pickerSheet(k, gid),
      open: () => recipeSheet(weekRead(k).g[gid]),
      step: (a, e, sh) => {
        const rid = weekRead(k).g[gid];
        const m = clamp(portion(ctx, rid) + (+a.dataset.d) * 0.25, 0.25, 4);
        S.por[rid] = m;
        save(); sh.set(draw()); render();
      },
      'por-auto': (a, e, sh) => { delete S.por[weekRead(k).g[gid]]; save(); sh.set(draw()); render(); },
    },
    change: (e, sh) => {
      if (e.target.name !== 'lock') return;
      const w = weekEdit(k);
      if (e.target.checked) w.lock[gid] = 1; else delete w.lock[gid];
      save(); render();
    },
  });
}

let PICK = { time: 0, sort: 'fit' };
function pickerSheet(k, gid) {
  const ctx = weekCtx(k);
  const t = GROUPS[gid].t;
  const draw = () => {
    const w = weekRead(k), cur = w.g[gid];
    BUY_CACHE = {};
    let list = RECIPES.filter(r => r.t === t && allowed(r)).map(r => {
      const ev = evalPlan(ctx, { ...w.g, [gid]: r.id }, true);
      const m = portion(ctx, r.id);
      const serve = sum(RING[r.id].map(([f, g]) => (stapleFree(f) ? 0 : g * unitPrice(f)))) * m;
      return { r, ev, m, serve, prot: RN[r.id][NI.prot] * m };
    });
    BUY_CACHE = null;
    const hidden = list.filter(x => PICK.time && x.r.mins > PICK.time).length;
    if (PICK.time) list = list.filter(x => x.r.mins <= PICK.time);
    const sorts = { fit: (a, b) => a.ev.J - b.ev.J, cheap: (a, b) => a.serve - b.serve, quick: (a, b) => a.r.mins - b.r.mins, prot: (a, b) => b.prot - a.prot };
    list.sort(sorts[PICK.sort]);
    return `${sheetHead(`Choose ${gid === 'L1' ? 'prep lunches' : MEALS[t].many.toLowerCase()}`, `For ${daysLabel(k, ctx.gd[gid])} · times are for the whole batch`)}
      ${chipRow(TIME_CHIPS, PICK.time, 'time', 'How long it takes')}
      ${seg([['fit', 'Best fit'], ['cheap', 'Cheapest'], ['quick', 'Quickest'], ['prot', 'Protein']], PICK.sort, 'sort', 'small')}
      <ul class="pick-list">${list.map(x => `<li><button type="button" class="pick${x.r.id === cur ? ' cur' : ''}" data-act="pick" data-rid="${x.r.id}">
        <span class="pk-emoji" aria-hidden="true">${x.r.e}</span>
        <span class="pk-main"><b>${esc(x.r.n)}</b>
          <small>${icon('clock')}${fmtMins(x.r.mins)} · ${x.r.fz === 2 ? 'kept frozen' : `keeps ${x.r.keep} days${x.r.fz ? ' · freezes' : ''}`}${x.r.night ? ' · overnight' : ''}</small>
          <small>${money(x.serve)} a serve · ${fmtNum(x.prot)} g protein</small></span>
        <span class="pk-fit"><b>${x.ev.met}/${x.ev.n}</b><small>${money0(x.ev.cost)}/wk</small></span>
        ${x.r.id === cur ? '<span class="cur-tag">Now</span>' : ''}</button></li>`).join('') || `<li class="sub pad">${hidden ? 'Nothing that quick — try a longer time.' : `No ${MEALS[t].many.toLowerCase()} fit all your diet settings and avoided ingredients. Loosen one in Settings.`}</li>`}</ul>
      ${hidden ? `<p class="hint">${plural(hidden, 'recipe')} take longer than that.</p>` : ''}
      <p class="hint">Goals and weekly cost if you pick it. Hidden or avoided recipes aren’t shown.</p>`;
  };
  openSheet(draw(), {
    label: 'Choose a recipe', cls: 'tall',
    act: {
      time: (a, e, sh) => { PICK.time = +a.dataset.v; sh.set(draw()); },
      sort: (a, e, sh) => { PICK.sort = a.dataset.v; sh.set(draw()); },
      pick: (a, e, sh) => {
        const w = weekEdit(k), before = w.g[gid], wasLocked = !!w.lock[gid];
        w.g[gid] = a.dataset.rid;
        w.lock[gid] = 1;
        save(); sh.close(); render();
        buzz();
        toast(`${esc(RBY[a.dataset.rid].n)} — locked in.`, { undo: () => { const x = weekEdit(k); if (before) x.g[gid] = before; else delete x.g[gid]; if (!wasLocked) delete x.lock[gid]; save(); render(); } });
      },
    },
  });
}

function prepSheet(k) {
  const ev = weekEval(k);
  const made = ev.bs.filter(b => b.plan.sess.some(s => s.at === 0)).sort((a, b) => b.r.mins - a.r.mins);
  const block = (b, n, i, when, at) => {
    const amounts = RING[b.rid].map(([f, g]) => `<li>${esc(amount(f, g * n * b.m))}</li>`).join('');
    return `<section class="prep-step"><h3>${i ? `${i}. ` : ''}${b.r.e} ${esc(b.r.n)}</h3>
      <p class="sub">${when ? `${when} · ` : ''}${n} serves${b.m !== 1 ? ` (each ×${frac(b.m)})` : ''} · ${fmtMins(b.r.mins)}</p>
      <ul class="ing">${amounts}</ul><ol class="steps">${b.r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <p class="store-note">${icon('fridge')}${storageLine(k, b.plan.out.filter(s => s.at === at))}</p></section>`;
  };
  const extra = ev.tm.extra.map(e => block(ev.bs.find(b => b.rid === e.rid), e.n, 0, atText(k, e.at), e.at)).join('');
  openSheet(`${sheetHead(`${DAYS_LONG[dayIdx(k)]} prep`, `About ${fmtMins(ev.tm.prep)} · ${plural(made.length, 'recipe')}`)}
    <div class="tips">${icon('info')}<div><b>Start with the slowest dish</b> and do the quick ones while it cooks.
      Cool food fast (spread rice on a tray), get it in the fridge within an hour, and freeze anything for later than 3 days out. Label the containers.</div></div>
    ${made.map((b, i) => block(b, b.plan.sess.find(s => s.at === 0).n, i + 1, '', 0)).join('')}
    ${extra ? `<h3 class="grp-title">Later in the week</h3>${extra}` : ''}`, { label: 'Prep day', cls: 'tall' });
}

function daySheet(k, o) {
  const draw = () => {
    const { meals, day } = dayMeals(k, o);
    const jobs = eveningJobs(k, o);
    return `${sheetHead(fmtDay(day.key), day.o === 0 ? 'Prep day' : '')}
      ${day.cheat ? `<p class="lead">${icon('pizza')} Cheat day — nothing planned. You can change your cheat day in Settings.</p>`
        : `${meals.map(m => `<button type="button" class="today-row" data-act="open" data-rid="${m.b.rid}"><span class="tl-ic">${mealIcon(m.t)}</span>
          <span class="tl-main"><small>${MEALS[m.t].name}</small><b>${m.b.r.e} ${esc(m.b.r.n)}</b></span>${srcChip(m.s.src)}</button>`).join('')}
        ${jobs.length ? `<div class="tonight"><h3>That evening</h3><ul class="jobs">${jobsHtml(k, jobs)}</ul></div>` : ''}
        ${switchRow('away', 'I’m away this day', 'Leave it out of the plan and the shopping', day.skip)}`}`;
  };
  openSheet(draw(), {
    label: 'Day',
    act: { open: a => recipeSheet(a.dataset.rid) },
    change: (e, sh) => {
      if (e.target.name !== 'away') return;
      const w = weekEdit(k);
      if (e.target.checked) w.skip[o] = 1; else delete w.skip[o];
      save(); sh.set(draw()); render();
    },
  });
}
