/* Prep Pal — the recipe card: ingredients for your serve or the whole batch, method, nutrition. */
'use strict';

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
    const mine = weekRead(k).g;
    const useBtn = g => (mine[g] === rid
      ? `<button type="button" class="btn ghost" disabled>${icon('check')}In ${MEALS[r.t].name.toLowerCase()}${groups.length > 1 ? ` · ${daysLabel(k, ctx.gd[g])}` : ''}</button>`
      : `<button type="button" class="btn" data-act="use" data-g="${g}">${icon('plus')}${mine[g] ? 'Swap into' : 'Add to'} ${MEALS[r.t].name.toLowerCase()}${groups.length > 1 ? ` · ${daysLabel(k, ctx.gd[g])}` : ''}</button>`);
    return `${sheetHead(esc(r.n), `${MEALS[r.t].name} · ${weekName(k)}`)}
      <div class="hero"><span class="hero-emoji big" aria-hidden="true">${r.e}</span><div class="badges">
        <span class="badge">${icon('clock')}${fmtMins(r.mins)}</span>
        ${r.hands < r.mins ? `<span class="badge">${fmtMins(r.hands)} hands-on</span>` : ''}
        <span class="badge">${r.fz === 2 ? icon('snow') : icon('fridge')}${keepText(r)}</span>
        ${r.night ? `<span class="badge">${icon('moon')}Overnight</span>` : ''}
        ${Object.entries(RTAGS[rid]).filter(([key, on]) => on && ['veg', 'gf', 'df', 'nf'].includes(key)).map(([key]) => `<span class="badge soft">${DIET_NAMES[key]}</span>`).join('')}
      </div></div>
      ${groups.length ? `<div class="use-row">${groups.map(useBtn).join('')}</div>` : ''}
      ${seg([['you', `Your serve ×${frac(m)}`], ['std', 'Standard'], ['batch', `Batch of ${batchN}`]], REC_MODE, 'mode', 'small')}
      <h3 class="sh-title">Ingredients</h3>
      <ul class="ing">${RING[rid].map(([f, g]) => `<li>${esc(amount(f, g * mult))}${stapleFree(f) ? ' <small class="muted">(pantry)</small>' : ''}</li>`).join('')}</ul>
      <p class="sub">About ${money(serveCost(rid, mult))}${REC_MODE === 'batch' ? ' for the batch' : ''}, not counting pantry staples.</p>
      <h3 class="sh-title">Method</h3>
      <ol class="steps">${r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
      <div class="tips">${icon('steam')}<div><b>On the day:</b> ${esc(r.heat)}</div></div>
      <h3 class="sh-title">Nutrition${REC_MODE === 'std' ? ' (standard serve)' : ' (your serve)'}</h3>
      <table class="nut-table"><thead><tr><th></th><th>Amount</th><th class="pct">of a day</th></tr></thead><tbody>${rows}</tbody></table>
      <div class="btn-row">
        <button type="button" class="btn ghost" data-act="fav">${icon('star')}${S.fav.includes(rid) ? 'Unfavourite' : 'Favourite'}</button>
        <button type="button" class="btn ghost" data-act="hide">${icon('eye-off')}${S.hide.includes(rid) ? 'Show in bank' : 'Hide from bank'}</button>
      </div>`;
  };
  openSheet(draw(), {
    label: r.n, cls: 'tall',
    act: {
      mode: (a, e, sh) => { REC_MODE = a.dataset.v; sh.set(draw()); },
      use: (a, e, sh) => { sh.close(); place(k, a.dataset.g, rid); },
      fav: (a, e, sh) => {
        S.fav = S.fav.includes(rid) ? S.fav.filter(x => x !== rid) : S.fav.concat(rid);
        save(); sh.set(draw()); render();
      },
      hide: (a, e, sh) => {
        const was = S.hide.includes(rid);
        S.hide = was ? S.hide.filter(x => x !== rid) : S.hide.concat(rid);
        save(); sh.set(draw()); render();
        if (!was) toast('Hidden from the recipe bank. Bring it back from Settings.');
      },
    },
  });
}
