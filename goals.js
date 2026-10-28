/* Prep Pal — Goals: the week's nutrients against your targets, and swaps that fix any gaps. */
'use strict';

const GOAL_SECTIONS = [
  ['Energy & macros', ['kcal', 'prot', 'carb', 'fat', 'fib']],
  ['Vitamins & minerals', ['fe', 'ca', 'vc', 'va', 'fol', 'k', 'mg', 'zn', 'b12']],
  ['Keep under', ['sat', 'na']],
];

// The single swap that best fixes a goal without losing any others.
function findFix(k, n) {
  return memo(`fix:${k}:${n}`, () => {
    const ctx = weekCtx(k), w = weekRead(k), base = weekEval(k);
    let best = null;
    BUY_CACHE = {};
    for (const gid of GROUP_IDS) {
      if (!ctx.gd[gid].length) continue;
      for (const r of RECIPES) {
        if (r.t !== GROUPS[gid].t || r.id === w.g[gid] || !allowed(r)) continue;
        const ev = evalPlan(ctx, { ...w.g, [gid]: r.id }, true);
        const g = ev.goals.find(x => x.n === n);
        if (!g.ok || ev.met < base.met) continue;
        if (!best || ev.met > best.ev.met || (ev.met === best.ev.met && ev.J < best.ev.J)) best = { gid, rid: r.id, ev };
      }
    }
    BUY_CACHE = null;
    return best;
  });
}

function goalBar(g) {
  const info = NUT_INFO[g.n];
  const ref = info.kind === 'max' ? g.hi : g.tg;
  const pct = ref > 0 ? (g.v / ref) * 100 : 0;
  const scale = info.kind === 'range' ? g.tg * 1.25 : ref;
  const fill = scale > 0 ? (g.v / scale) * 100 : 0;
  const band = info.kind === 'range' ? `<span class="band" style="left:${clamp((g.lo / scale) * 100, 0, 100)}%;right:${100 - clamp((Math.min(g.hi, scale) / scale) * 100, 0, 100)}%"></span>` : '';
  const stateIcon = g.ok ? icon('check') : g.state === 'high' ? icon('up') : icon('down');
  const word = g.ok ? (info.kind === 'max' ? 'under the limit' : 'on target') : g.state === 'high' ? (info.kind === 'max' ? 'over the limit' : 'a bit high') : g.state === 'close' ? 'nearly there' : 'low';
  return `<li class="goal ${g.ok ? 'ok' : g.state}">
    <div class="gl-top"><b>${info.n}</b><span class="gl-state">${stateIcon}${word}</span></div>
    <div class="gbar${info.kind === 'max' ? ' limit' : ''}">${band}<i style="width:${clamp(fill, 2, 100)}%"></i></div>
    <div class="gl-nums"><span>${fmtNut(g.n, g.v)}</span><span>${info.kind === 'max' ? 'limit' : info.kind === 'range' ? 'target' : 'goal'} ${fmtNut(g.n, ref)} · ${Math.round(pct)}%</span></div>
  </li>`;
}

VIEWS.goals = {
  title: 'Goals',
  render() {
    const k = viewWeek();
    ensurePlan(k);
    const nav = weekNav(k);
    if (!planned(k)) return `${nav}<section class="card empty-state"><h2>No plan for this week</h2><button type="button" class="btn" data-act="plan">${icon('spark')}Plan this week</button></section>`;
    const ev = weekEval(k), ctx = weekCtx(k);
    const p = S.prof, { t: day } = dailyTargets(p);
    const byN = {};
    for (const g of ev.goals) byN[g.n] = g;
    const misses = ev.goals.filter(g => !g.ok);
    const ringPct = ev.n ? ev.met / ev.n : 0;
    const C = 2 * Math.PI * 42;
    const fixes = misses.map(g => ({ g, fix: findFix(k, g.n) }));
    return `${nav}
      <section class="card goal-head">
        <svg class="ring" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="42" class="ring-bg"/><circle cx="50" cy="50" r="42" class="ring-fg" style="stroke-dasharray:${C};stroke-dashoffset:${C * (1 - ringPct)}"/></svg>
        <div class="gh-num"><b>${ev.met}<small>/${ev.n}</small></b></div>
        <div class="gh-text"><h2>${misses.length ? `${plural(misses.length, 'goal')} to work on` : 'Every goal met'}</h2>
          <p class="sub">Over ${plural(ctx.gd.P.length, 'planned day')}: breakfast, lunch and a snack.</p></div>
      </section>
      ${fixes.length ? `<section class="card fixes">${fixes.map(({ g, fix }) => `<div class="fix"><p><b>${NUT_INFO[g.n].n} is ${g.state === 'high' ? 'over' : 'short'}.</b> ${g.state === 'high' ? '' : `Good sources: ${NUT_FOODS[g.n] || 'a wider mix of foods'}.`}</p>
        ${fix ? `<button type="button" class="btn small" data-act="fix" data-g="${fix.gid}" data-rid="${fix.rid}">${icon('swap')}Swap ${GROUPS[fix.gid].t === 'l' ? 'lunch' : MEALS[GROUPS[fix.gid].t].name.toLowerCase()} (${daysLabel(k, ctx.gd[fix.gid])}) to ${esc(RBY[fix.rid].n)}</button>` : '<p class="sub">No single swap fixes this — try a bigger serve or a different budget.</p>'}</div>`).join('')}</section>` : ''}
      ${GOAL_SECTIONS.map(([title, ns]) => `<h3 class="grp-title">${title}</h3><ul class="goal-list">${ns.map(n => goalBar(byN[n])).join('')}</ul>`).join('')}
      <section class="card profile-card">
        <div class="card-top"><h2>Your targets</h2><button type="button" class="link-btn" data-action="settings">${icon('edit')}Edit</button></div>
        <p class="sub">${profileReady(p) ? `${p.sex === 'm' ? 'Male' : 'Female'} · ${p.age} · ${p.cm} cm · ${p.kg} kg · ${ACTS[p.act].name} · ${GOALS[p.goal].name}` : 'Add your details in Settings for targets that fit you.'}</p>
        <div class="nut-grid">
          <div><b>${fmtNum(day.kcal)}</b><small>kcal a day</small></div>
          <div><b>${fmtNum(day.prot)} g</b><small>protein</small></div>
          <div><b>${fmtNum(day.carb)} g</b><small>carbs</small></div>
          <div><b>${fmtNum(day.fib)} g</b><small>fibre</small></div>
        </div>
        <p class="tiny">${icon('info')}Planned meals cover ${S.wk.share}% of each day; dinner and training fuel are the rest. Energy uses the Mifflin-St Jeor equation; protein follows sports nutrition guidance; vitamins and minerals use the Australian and New Zealand Nutrient Reference Values. A guide, not medical advice.</p>
      </section>`;
  },
  act: {
    fix: a => {
      const k = viewWeek(), w = weekEdit(k), gid = a.dataset.g;
      const before = w.g[gid], wasLocked = !!w.lock[gid];
      w.g[gid] = a.dataset.rid; w.lock[gid] = 1;
      save(); render();
      toast(`Swapped to ${esc(RBY[a.dataset.rid].n)}.`, { undo: () => { const x = weekEdit(k); x.g[gid] = before; if (!wasLocked) delete x.lock[gid]; save(); render(); } });
    },
  },
};
