/* Prep Pal — Recipes: browse by meal and time, and the recipe card. */
'use strict';

const keepText = r => (r.fz === 2 ? 'Kept frozen' : `Keeps ${r.keep} days${r.fz ? ' · freezes' : ''}`);
const serveCost = (rid, m) => sum(RING[rid].map(([f, g]) => (stapleFree(f) ? 0 : g * unitPrice(f)))) * (m || 1);

function recMatches(r, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return r.n.toLowerCase().includes(s) || Object.keys(r.ing).some(f => FOODS[f].n.toLowerCase().includes(s) || (FOODS[f].rn || '').includes(s));
}

function recListHtml() {
  const t = UI.recType;
  const all = RECIPES.filter(r => r.t === t);
  const ok = all.filter(r => allowed(r));
  let list = ok.filter(r => recMatches(r, UI.recQ));
  const slow = UI.recTime ? list.filter(r => r.mins > UI.recTime).length : 0;
  if (UI.recTime) list = list.filter(r => r.mins <= UI.recTime);
  list.sort((a, b) => a.mins - b.mins || a.n.localeCompare(b.n));
  const hidden = all.length - ok.length;
  return `${list.map(r => `<li><button type="button" class="rec-card" data-act="recipe" data-rid="${r.id}">
      <span class="rc-emoji" aria-hidden="true">${r.e}</span>
      <span class="rc-main"><b>${esc(r.n)}</b>
        <small>${icon('clock')}${fmtMins(r.mins)}${r.hands < r.mins ? ` · ${fmtMins(r.hands)} hands-on` : ''}${r.night ? ' · overnight' : ''}</small>
        <small>${keepText(r)} · ${fmtNum(RK[r.id])} kcal · ${fmtNum(RN[r.id][NI.prot])} g protein · ${money(serveCost(r.id))}</small></span>
      ${S.fav.includes(r.id) ? `<span class="rc-fav" title="Favourite">${icon('star')}</span>` : ''}
    </button></li>`).join('') || '<li class="sub pad">No recipes match.</li>'}
    ${slow ? `<li class="hint">${plural(slow, 'more recipe')} take${slow === 1 ? 's' : ''} longer.</li>` : ''}
    ${hidden ? `<li class="hint">${plural(hidden, 'recipe')} hidden by your diet, avoid list or hidden recipes (Settings).</li>` : ''}`;
}

VIEWS.recipes = {
  title: 'Recipes',
  render() {
    return `${sectionTitle('Recipes')}
      <p class="sub lead-sub">All made ahead: batch-cooked, packed in jars or frozen. Nutrition and cost are for one standard serve.</p>
      ${seg([['b', 'Breakfasts'], ['l', 'Lunches'], ['s', 'Snacks']], UI.recType, 'type')}
      ${chipRow(TIME_CHIPS, UI.recTime, 'time', 'How long it takes')}
      <label class="search"><span class="sr-only">Search</span><input type="search" name="q" placeholder="Search recipes or ingredients" value="${esc(UI.recQ)}" autocomplete="off"></label>
      <ul class="rec-list" id="rec-list">${recListHtml()}</ul>`;
  },
  act: {
    type: a => { UI.recType = a.dataset.v; render(); },
    time: a => { UI.recTime = +a.dataset.v; render(); },
  },
  input(e) {
    if (e.target.name !== 'q') return;
    UI.recQ = e.target.value.slice(0, 40);
    $('#rec-list').innerHTML = recListHtml();
  },
};

/* ---------- recipe card ---------- */
let REC_MODE = 'you';
function recipeSheet(rid) {
  const r = RBY[rid];
  if (!r) return;
  const k = viewWeek();
  const ctx = weekCtx(k);
  const draw = () => {
    const m = portion(ctx, rid);
    const inWeek = weekEval(k).bs.find(b => b.rid === rid);
    const firstGroup = { b: 'B1', l: 'L1', s: 'S1' }[r.t];
    const batchN = inWeek ? inWeek.n : ctx.gd[firstGroup].length || plannedDays(S.wk).length || 4;
    const mult = REC_MODE === 'std' ? 1 : REC_MODE === 'batch' ? m * batchN : m;
    const v = RN[rid];
    const { t: day } = dailyTargets(S.prof);
    const rows = ['kcal', 'prot', 'carb', 'fat', 'sat', 'fib', 'na', 'fe', 'ca', 'vc', 'zn'].map(n => {
      const val = v[NI[n]] * (REC_MODE === 'batch' ? m : mult);
      const pct = day[n] ? Math.round((val / day[n]) * 100) : 0;
      return `<tr><th>${NUT_INFO[n].n}</th><td>${fmtNut(n, val)}</td><td class="pct">${pct}%</td></tr>`;
    }).join('');
    const groups = GROUP_IDS.filter(g => GROUPS[g].t === r.t && ctx.gd[g].length);
    return `${sheetHead(esc(r.n), MEALS[r.t].name)}
      <div class="hero"><span class="hero-emoji big" aria-hidden="true">${r.e}</span><div class="badges">
        <span class="badge">${icon('clock')}${fmtMins(r.mins)}</span>
        ${r.hands < r.mins ? `<span class="badge">${fmtMins(r.hands)} hands-on</span>` : ''}
        <span class="badge">${r.fz === 2 ? icon('snow') : icon('fridge')}${keepText(r)}</span>
        ${r.night ? `<span class="badge">${icon('moon')}Overnight</span>` : ''}
        ${Object.entries(RTAGS[rid]).filter(([key, on]) => on && ['veg', 'gf', 'df', 'nf'].includes(key)).map(([key]) => `<span class="badge soft">${DIET_NAMES[key]}</span>`).join('')}
      </div></div>
      ${seg([['you', `Your serve ×${frac(m)}`], ['std', 'Standard'], ['batch', `Batch of ${batchN}`]], REC_MODE, 'mode', 'small')}
      <h3 class="sh-title">Ingredients</h3>
      <ul class="ing">${RING[rid].map(([f, g]) => `<li>${esc(amount(f, g * mult))}${stapleFree(f) ? ' <small class="muted">(pantry)</small>' : ''}</li>`).join('')}</ul>
      <p class="sub">About ${money(serveCost(rid, mult))}${REC_MODE === 'batch' ? ' for the batch' : ''}, not counting pantry staples.</p>
      <h3 class="sh-title">Method</h3>
      <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="tips">${icon('steam')}<div><b>On the day:</b> ${esc(r.heat)}</div></div>
      <h3 class="sh-title">Nutrition${REC_MODE === 'std' ? ' (standard serve)' : ' (your serve)'}</h3>
      <table class="nut-table"><thead><tr><th></th><th>Amount</th><th class="pct">of a day</th></tr></thead><tbody>${rows}</tbody></table>
      ${groups.length ? `<h3 class="sh-title">Use it ${daysBetween(curWeekKey(), k) === 0 ? 'this week' : `for ${fmtShort(k)}`}</h3>
        <div class="use-row">${groups.map(g => `<button type="button" class="btn ghost small" data-act="use" data-g="${g}">${MEALS[r.t].many} · ${daysLabel(k, ctx.gd[g])}</button>`).join('')}</div>` : ''}
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="fav">${icon('star')}${S.fav.includes(rid) ? 'Unfavourite' : 'Favourite'}</button>
        <button type="button" class="btn ghost" data-act="hide">${icon('eye-off')}${S.hide.includes(rid) ? 'Suggest again' : 'Don’t suggest'}</button>
      </div>`;
  };
  openSheet(draw(), {
    label: r.n, cls: 'tall',
    act: {
      mode: (a, e, sh) => { REC_MODE = a.dataset.v; sh.set(draw()); },
      use: (a, e, sh) => {
        const g = a.dataset.g, w = weekEdit(k);
        w.g[g] = rid; w.lock[g] = 1;
        save(); sh.close(); render();
        toast(`${esc(r.n)} added for ${daysLabel(k, ctx.gd[g])}.`);
      },
      fav: (a, e, sh) => {
        S.fav = S.fav.includes(rid) ? S.fav.filter(x => x !== rid) : S.fav.concat(rid);
        save(); sh.set(draw()); render();
      },
      hide: (a, e, sh) => {
        const was = S.hide.includes(rid);
        S.hide = was ? S.hide.filter(x => x !== rid) : S.hide.concat(rid);
        save(); sh.set(draw()); render();
        if (!was) toast('It won’t be suggested. Undo any time from the recipe or Settings.');
      },
    },
  });
}
