/* Prep Pal — Prep: today's meals, the prep-day cook-up step by step, and the week's fridge and freezer jobs. */
'use strict';

function todayCard(k) {
  const o = daysBetween(k, today());
  if (o < 0 || o > 6) return '';
  const { meals, day } = dayMeals(k, o);
  const jobs = eveningJobs(k, o);
  let body;
  if (day.cheat) body = `<p class="today-msg">${icon('pizza')} Cheat day — nothing planned. Enjoy it!</p>`;
  else if (!day.want && o === 0) body = `<p class="today-msg">${icon('chef')} Prep day — cook the week’s meals (about ${fmtMins(weekEval(k).tm.prep)}).</p>`;
  else if (!day.want) body = '<p class="today-msg">Nothing planned today — eat whatever you like.</p>';
  else if (day.skip) body = '<p class="today-msg">You marked today as away.</p>';
  else {
    body = `<ul class="today-list">${meals.map(m => `<li><button type="button" class="today-row" data-act="recipe" data-rid="${m.b.rid}">
      <span class="tl-ic">${mealIcon(m.t)}</span><span class="tl-main"><small>${MEALS[m.t].name}</small><b>${m.b.r.e} ${esc(m.b.r.n)}</b></span>${srcChip(m.s.src)}</button></li>`).join('')}</ul>`;
  }
  return `<section class="card today" aria-label="Today">
    <div class="card-top"><h2>Today</h2><span class="today-day">${DAYS_LONG[day.di]}${o === 0 ? ' · prep day' : ''}</span></div>
    ${body}
    ${jobs.length ? `<div class="tonight"><h3>Tonight</h3><ul class="jobs">${jobsHtml(k, jobs)}</ul></div>` : ''}
  </section>`;
}

// One recipe's cook-up: batch amounts, method and where each serve goes.
function prepStep(k, b, n, at, i) {
  const done = !!weekRead(k).done[b.rid] && at === 0;
  const when = at === 0 ? '' : `${atText(k, at)} · `;
  return `<article class="prep-step${done ? ' done' : ''}">
    <div class="ps-head">
      ${at === 0 ? `<label class="chk"><input type="checkbox" name="done" value="${b.rid}" ${done ? 'checked' : ''} aria-label="${esc(b.r.n)} is made"><span class="box">${icon('check')}</span></label>` : `<span class="ps-moon">${icon('moon')}</span>`}
      <div class="ps-title"><h3>${i ? `${i}. ` : ''}${b.r.e} ${esc(b.r.n)}</h3>
        <p class="sub">${when}${n} serves${b.m !== 1 ? ` (each ×${frac(b.m)})` : ''} · ${fmtMins(b.r.mins)}${b.r.hands < b.r.mins ? ` (${fmtMins(b.r.hands)} hands-on)` : ''}</p></div>
    </div>
    <div class="ps-body">
      <ul class="ing">${RING[b.rid].map(([f, g]) => `<li>${esc(amount(f, g * n * b.m))}${stapleFree(f) ? ' <small class="muted">(pantry)</small>' : ''}</li>`).join('')}</ul>
      <ol class="steps">${b.r.steps.map(s => `<li>${esc(s)}</li>`).join('')}</ol>
    </div>
    <p class="store-note">${icon('fridge')}<span>${storageLine(k, b.plan.out.filter(s => s.at === at))}</span></p>
  </article>`;
}

// Every evening job this week: anything made the night before prep day, thawing tomorrow's meals and top-ups.
function weekJobs(k) {
  const out = [], ev = weekEval(k);
  const before = [];
  for (const b of ev.bs) for (const s of b.plan.sess) if (s.at === -1) before.push({ kind: 'make', b, n: s.n });
  if (before.length) out.push({ when: atText(k, -1), jobs: before });
  for (let o = 0; o < 6; o++) {
    const jobs = eveningJobs(k, o);
    if (jobs.length) out.push({ when: atText(k, o), jobs });
  }
  return out;
}

function glance(k) {
  const ctx = weekCtx(k);
  return `<div class="glance">${ctx.days.map(d => {
    const name = `<span class="g-name">${DAYS[d.di]}</span>`;
    const now = d.key === today() ? ' now' : '';
    if (d.cheat) return `<button type="button" class="g-day cheat${now}" data-act="day" data-o="${d.o}">${name}<span class="g-note">${icon('pizza')}Cheat day</span></button>`;
    if (!d.want && d.o === 0) return `<button type="button" class="g-day off${now}" data-act="day" data-o="${d.o}">${name}<span class="g-note">${icon('chef')}Prep day</span></button>`;
    if (!d.want) return `<button type="button" class="g-day off${now}" data-act="day" data-o="${d.o}">${name}<span class="g-note">Not planned</span></button>`;
    if (d.skip) return `<button type="button" class="g-day off${now}" data-act="day" data-o="${d.o}">${name}<span class="g-note">Away</span></button>`;
    const { meals } = dayMeals(k, d.o);
    return `<button type="button" class="g-day${now}" data-act="day" data-o="${d.o}">${name}
      <span class="g-meals">${meals.map(m => `<span class="g-meal${m.s.src === 'freezer' || m.s.src === 'frozen' ? ' frz' : ''}" title="${esc(m.b.r.n)}">${m.b.r.e}</span>`).join('') || '<span class="g-note">Nothing chosen</span>'}</span></button>`;
  }).join('')}</div>`;
}

VIEWS.prep = {
  title: 'Prep',
  render() {
    const k = viewWeek(), nav = weekNav(k), cur = curWeekKey();
    const todayHtml = planned(cur) ? todayCard(cur) : '';
    if (!planned(k)) return `${todayHtml}${emptyWeek(nav, k)}`;
    const ev = weekEval(k), w = weekRead(k);
    const made = ev.bs.filter(b => b.plan.sess.some(s => s.at === 0)).sort((a, b) => b.r.mins - a.r.mins);
    const nDone = made.filter(b => w.done[b.rid]).length;
    const extra = ev.tm.extra.map(e => prepStep(k, ev.bs.find(b => b.rid === e.rid), e.n, e.at, 0)).join('');
    const jobs = weekJobs(k);
    const missing = slotsOf(weekCtx(k)).filter(g => !w.g[g]).length;
    return `${todayHtml}${nav}
      <section class="card prep-head">
        <div class="card-top"><h2>${DAYS_LONG[dayIdx(k)]} prep</h2><span class="pill">${icon('clock')}${fmtMins(ev.tm.prep)}</span></div>
        <p class="sub">${fmtDay(k)} · ${plural(made.length, 'recipe')}, cooked once for the week</p>
        <div class="bar" role="progressbar" aria-valuenow="${nDone}" aria-valuemin="0" aria-valuemax="${made.length}" aria-label="Recipes made"><i style="width:${made.length ? (nDone / made.length) * 100 : 0}%"></i></div>
        <p class="sub">${nDone === made.length && made.length ? 'All made — nice work!' : `${nDone} of ${made.length} made`}</p>
        ${missing ? `<p class="tiny">${icon('info')}${plural(missing, 'meal')} still to choose — <a href="#/plan">finish your plan</a>.</p>` : ''}
      </section>
      <div class="tips">${icon('info')}<div><b>Start with the slowest dish</b> and do the quick ones while it cooks. Cool food fast (spread rice on a tray), get it in the fridge within an hour, and freeze anything for later than 3 days out. Label the containers.</div></div>
      ${made.map((b, i) => prepStep(k, b, b.plan.sess.find(s => s.at === 0).n, 0, i + 1)).join('')}
      ${extra ? `${sectionTitle('Later in the week')}${extra}` : ''}
      ${jobs.length ? `${sectionTitle('Fridge & freezer reminders')}<section class="card"><ul class="week-jobs">${jobs.map(j => `<li><b>${j.when}</b><ul class="jobs">${jobsHtml(k, j.jobs)}</ul></li>`).join('')}</ul></section>` : ''}
      ${sectionTitle('Week at a glance')}
      ${glance(k)}
      <p class="hint"><span class="dot-key" aria-hidden="true"></span>Gold dot = comes out of the freezer. Tap a day for details or to mark it as away.</p>`;
  },
  act: {
    day: a => daySheet(viewWeek(), +a.dataset.o),
  },
  change(e) {
    if (e.target.name !== 'done') return;
    const k = viewWeek(), w = weekEdit(k), rid = e.target.value;
    if (e.target.checked) w.done[rid] = 1; else delete w.done[rid];
    save();
    buzz(8);
    render();
    const ev = weekEval(k);
    const made = ev.bs.filter(b => b.plan.sess.some(s => s.at === 0));
    if (e.target.checked && made.length && made.every(b => weekRead(k).done[b.rid])) { confetti(); toast('Prep done! Your week is sorted.'); }
  },
};

function daySheet(k, o) {
  const draw = () => {
    const { meals, day } = dayMeals(k, o);
    const jobs = eveningJobs(k, o);
    const tonight = jobs.length ? `<div class="tonight"><h3>That evening</h3><ul class="jobs">${jobsHtml(k, jobs)}</ul></div>` : '';
    let body;
    if (day.cheat) body = `<p class="lead">${icon('pizza')} Cheat day — nothing planned. You can change your cheat day in Settings.</p>${tonight}`;
    else if (!day.want) {
      body = `<p class="lead">${day.o === 0 ? 'Prep day — you cook the week’s meals today.' : 'Not planned — no meals made for this day.'}</p>
        <p class="sub">Choose which days get meals in Settings.</p>${tonight}`;
    } else {
      body = `${meals.map(m => `<button type="button" class="today-row" data-act="open" data-rid="${m.b.rid}"><span class="tl-ic">${mealIcon(m.t)}</span>
          <span class="tl-main"><small>${MEALS[m.t].name}</small><b>${m.b.r.e} ${esc(m.b.r.n)}</b></span>${srcChip(m.s.src)}</button>`).join('')}
        ${tonight}
        ${switchRow('away', 'I’m away this day', 'Leave it out of this week’s meals and shopping', day.skip)}`;
    }
    return `${sheetHead(fmtDay(day.key), day.o === 0 ? 'Prep day' : '')}${body}`;
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
