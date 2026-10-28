/* Prep Pal — onboarding, settings and backups. */
'use strict';

const PREP_TIMES = [[60, '1 h'], [90, '1½ h'], [120, '2 h'], [150, '2½ h'], [180, '3 h'], [0, 'No limit']];
const ceil5 = n => Math.ceil(n / 5) * 5;
function suggestBudget() {
  const days = plannedDays(S.wk).length;
  const kcal = dailyTargets(S.prof).kcal * (S.wk.share / 100) * days;
  return clamp(ceil5(kcal * 0.0042), 15, 300);
}

/* ---------- shared form pieces ---------- */
function profileFields(p) {
  return `<div class="field"><span>Body (for the energy formula)</span>${seg([['m', 'Male'], ['f', 'Female']], p.sex, 'sex')}</div>
    <div class="field-row">
      <label class="field"><span>Age</span><span class="unit-in"><input type="number" inputmode="numeric" name="age" min="14" max="99" value="${p.age || ''}" placeholder="24"><span>yrs</span></span></label>
      <label class="field"><span>Height</span><span class="unit-in"><input type="number" inputmode="numeric" name="cm" min="120" max="230" value="${p.cm || ''}" placeholder="175"><span>cm</span></span></label>
      <label class="field"><span>Weight</span><span class="unit-in"><input type="number" inputmode="decimal" name="kg" min="35" max="250" step="0.5" value="${p.kg || ''}" placeholder="75"><span>kg</span></span></label>
    </div>
    <div class="field"><span>How active are you?</span><div class="radio-list">${Object.entries(ACTS).map(([id, a]) => `<button type="button" class="radio${p.act === id ? ' on' : ''}" role="radio" aria-checked="${p.act === id}" data-act="act" data-v="${id}"><b>${a.name}</b><small>${a.sub}</small></button>`).join('')}</div></div>
    <div class="field"><span>Goal</span>${seg(Object.entries(GOALS).map(([id, g]) => [id, g.name]), p.goal, 'goal', 'small')}</div>`;
}

function weekFields() {
  const w = S.wk;
  const n = plannedDays(w).length;
  return `<div class="field"><span>Prep day</span>${seg([[6, 'Sunday'], [5, 'Saturday']], w.prep, 'prep')}</div>
    <div class="field"><span>Days you want meals for</span>
      <div class="chips" role="group" aria-label="Days you want meals for">${DAYS.map((d, i) => (i === w.cheat
        ? `<button type="button" class="chip cheat" disabled title="Cheat day">${d} ${icon('pizza')}</button>`
        : `<button type="button" class="chip${w.days.includes(i) ? ' on' : ''}" aria-pressed="${w.days.includes(i)}" data-act="pday" data-v="${i}">${d}</button>`)).join('')}</div>
      <small class="field-note">${n === 1 ? 'Each recipe makes 1 serve' : `Breakfast, lunch and a snack for ${weekdaysLabel(plannedDays(w))} — each recipe makes ${n} serves`}, all cooked on prep day.</small></div>
    <div class="field"><span>Cheat day — nothing planned</span>${chipRow([...DAYS.map((d, i) => [i, d]), [-1, 'None']], w.cheat, 'cheat', 'Cheat day')}</div>
    <div class="field"><span>Longest prep session</span>${chipRow(PREP_TIMES, w.maxPrep, 'maxPrep', 'Longest prep session')}</div>`;
}

function updateField(name, v) {
  const p = S.prof;
  if (name === 'age') p.age = v ? clamp(Math.round(v), 14, 99) : 0;
  if (name === 'cm') p.cm = v ? clamp(Math.round(v), 120, 230) : 0;
  if (name === 'kg') p.kg = v ? clamp(Math.round(v * 2) / 2, 35, 250) : 0;
}

const FORM_ACT = {
  sex: a => { S.prof.sex = a.dataset.v; },
  act: a => { S.prof.act = a.dataset.v; },
  goal: a => { S.prof.goal = a.dataset.v; },
  prep: a => { S.wk.prep = +a.dataset.v; UI.week = null; },
  pday: a => {
    const i = +a.dataset.v, days = S.wk.days;
    if (!days.includes(i)) { S.wk.days = days.concat(i).sort((x, y) => x - y); return; }
    const next = days.filter(x => x !== i);
    if (plannedDays({ ...S.wk, days: next }).length) S.wk.days = next;
    else toast('Keep at least one day with meals.');
  },
  cheat: a => {
    const c = +a.dataset.v;
    if (plannedDays({ ...S.wk, cheat: c }).length) S.wk.cheat = c;
    else toast('That’s your only meal day — pick another meal day first.');
  },
  maxPrep: a => { S.wk.maxPrep = +a.dataset.v; },
  bVar: a => { S.wk.bVar = +a.dataset.v; },
  lVar: a => { S.wk.lVar = +a.dataset.v; },
  sVar: a => { S.wk.sVar = +a.dataset.v; },
};

function stepField(name, d) {
  if (name === 'budget') S.budget = clamp(S.budget + d * 5, 15, 400);
  if (name === 'share') S.wk.share = clamp(S.wk.share + d * 5, 40, 90);
}

/* ---------- onboarding ---------- */
let OB = { step: 0, err: '' };
function startOnboarding() {
  OB = { step: 0, err: '' };
  const root = $('#onboard-root');
  root.classList.add('on');
  document.body.classList.add('onboarding');
  drawOnboarding();
  if (!root.dataset.wired) {
    root.dataset.wired = '1';
    root.addEventListener('click', e => {
      const a = e.target.closest('[data-act]');
      if (!a || a.disabled) return;
      e.preventDefault();
      const act = a.dataset.act;
      if (FORM_ACT[act]) { FORM_ACT[act](a); drawOnboarding(); return; }
      if (act === 'step') { stepField(a.dataset.name, +a.dataset.d); drawOnboarding(); return; }
      if (act === 'diet') { const k = a.dataset.v; S.diet[k] = !S.diet[k]; drawOnboarding(); return; }
      if (act === 'next') obNext();
      if (act === 'back') { OB.step = Math.max(0, OB.step - 1); OB.err = ''; drawOnboarding(); }
    });
    root.addEventListener('input', e => {
      if (!e.target.name) return;
      updateField(e.target.name, +e.target.value);
    });
  }
}

function obNext() {
  if (OB.step === 1) {
    const p = S.prof;
    for (const n of ['age', 'cm', 'kg']) { const el = $(`#onboard-root [name="${n}"]`); if (el) updateField(n, +el.value); }
    if (!p.sex || !p.age || !p.cm || !p.kg) { OB.err = 'Fill in all four so your targets fit you.'; drawOnboarding(); return; }
    S.budget = suggestBudget();
  }
  if (OB.step === 2) S.budget = suggestBudget();
  OB.err = '';
  if (OB.step < 3) { OB.step++; drawOnboarding(); return; }
  finishOnboarding();
}

function drawOnboarding() {
  const root = $('#onboard-root');
  const dots = `<div class="ob-dots" aria-hidden="true">${[0, 1, 2, 3].map(i => `<i class="${i === OB.step ? 'on' : ''}"></i>`).join('')}</div>`;
  const back = OB.step ? '<button type="button" class="btn ghost" data-act="back">Back</button>' : '';
  let body = '';
  if (OB.step === 0) {
    body = `<div class="ob-hero"><img src="icons/icon.svg" alt="" width="96" height="96"><h1>Prep Pal</h1><p class="lead">Cook once, eat well all week.</p></div>
      <ul class="ob-points">
        <li>${icon('grip')}<span><b>Drag and drop your week.</b> Pick a breakfast, lunch and snack from the recipe bank — each one is cooked in one go on prep day.</span></li>
        <li>${icon('clock')}<span><b>Pick meals by time.</b> See how long each one takes and keep prep day short.</span></li>
        <li>${icon('target')}<span><b>Hit your nutrient goals</b> across the week, sized to your body and training.</span></li>
        <li>${icon('cart')}<span><b>On budget,</b> with the shopping list done for you in aisle order.</span></li>
      </ul>
      <p class="tiny center">Everything stays on this phone. No account needed.</p>
      <button type="button" class="btn wide" data-act="next">Get started</button>`;
  } else if (OB.step === 1) {
    body = `<h2>About you</h2><p class="sub">Used only to work out your energy and nutrient targets.</p>${profileFields(S.prof)}
      ${OB.err ? `<p class="err" role="alert">${OB.err}</p>` : ''}
      <div class="btn-row">${back}<button type="button" class="btn" data-act="next">Next</button></div>`;
  } else if (OB.step === 2) {
    body = `<h2>Your week</h2><p class="sub">You can change any of this later in Settings.</p>${weekFields()}
      <div class="btn-row">${back}<button type="button" class="btn" data-act="next">Next</button></div>`;
  } else {
    const sug = suggestBudget();
    body = `<h2>Food & budget</h2>
      <div class="field"><span>Any diet needs?</span><div class="chips">${DIETS.map(d => `<button type="button" class="chip${S.diet[d] ? ' on' : ''}" aria-pressed="${S.diet[d]}" data-act="diet" data-v="${d}">${DIET_NAMES[d]}</button>`).join('')}</div></div>
      <div class="field-inline"><span><b>Weekly budget</b><small>For these meals only. Suggested ${money0(sug)} from your energy needs.</small></span>${stepper('budget', money0(S.budget), 'Weekly budget')}</div>
      <p class="tiny">${icon('info')}Prices are typical Australian supermarket estimates. You can set your own on the shopping list.</p>
      <div class="btn-row">${back}<button type="button" class="btn" data-act="next">Start planning</button></div>`;
  }
  root.innerHTML = `<div class="ob-card" role="dialog" aria-modal="true" aria-label="Set up Prep Pal">${OB.step ? dots : ''}${body}</div>`;
}

function finishOnboarding() {
  S.onboarded = true;
  save();
  const root = $('#onboard-root');
  root.classList.remove('on');
  root.innerHTML = '';
  document.body.classList.remove('onboarding');
  UI.week = null;
  UI.bank = null;
  location.hash = '#/plan';
  render(true);
  askPersist();
  setTimeout(() => toast('All set! Drag recipes onto your meals, or tap Fill for me.', { ms: 5000 }), 250);
}

/* ---------- settings ---------- */
let SET_DIRTY = false;
function openSettings() {
  SET_DIRTY = false;
  const draw = () => {
    const sug = suggestBudget();
    return `${sheetHead('Settings', `Prep Pal ${APP_VERSION}`)}
      <h3 class="sh-title">About you</h3>${profileFields(S.prof)}
      <h3 class="sh-title">Your week</h3>${weekFields()}
      <div class="field"><span>Recipes for each meal <small>— one recipe makes every serve; two split the days in half</small></span></div>
      <div class="field-inline tight"><span><b>Breakfast</b></span>${seg([[1, 'One'], [2, 'Two']], S.wk.bVar, 'bVar', 'small mini')}</div>
      <div class="field-inline tight"><span><b>Lunch</b></span>${seg([[1, 'One'], [2, 'Two']], S.wk.lVar, 'lVar', 'small mini')}</div>
      <div class="field-inline tight"><span><b>Snack</b></span>${seg([[1, 'One'], [2, 'Two']], S.wk.sVar, 'sVar', 'small mini')}</div>
      <div class="field-inline"><span><b>Share of your day</b><small>How much of each day’s food these meals cover (dinner isn’t planned)</small></span>${stepper('share', `${S.wk.share}%`, 'Share of your day')}</div>
      <h3 class="sh-title">Budget</h3>
      <div class="field-inline"><span><b>Weekly budget</b><small>Suggested ${money0(sug)} from your energy needs</small></span>${stepper('budget', money0(S.budget), 'Weekly budget')}</div>
      ${switchRow('staples', 'I keep pantry staples', 'Oil, soy sauce, honey, salt and spices aren’t costed', S.staples)}
      <h3 class="sh-title">Food</h3>
      <div class="chips">${DIETS.map(d => `<button type="button" class="chip${S.diet[d] ? ' on' : ''}" aria-pressed="${S.diet[d]}" data-act="diet" data-v="${d}">${DIET_NAMES[d]}</button>`).join('')}</div>
      <div class="field"><span>Ingredients to avoid</span><div class="chips small">${Object.keys(FOODS).filter(f => !FOODS[f].staple).sort((a, b) => FOODS[a].n.localeCompare(FOODS[b].n)).map(f => `<button type="button" class="chip${S.avoid.includes(f) ? ' on' : ''}" aria-pressed="${S.avoid.includes(f)}" data-act="avoid" data-v="${f}">${esc(FOODS[f].n)}</button>`).join('')}</div></div>
      ${S.hide.length ? `<div class="field"><span>Recipes you’ve hidden</span><div class="chips small">${S.hide.map(r => `<button type="button" class="chip on" data-act="unhide" data-v="${r}">${esc(RBY[r].n)} ${icon('x')}</button>`).join('')}</div></div>` : ''}
      <h3 class="sh-title">App</h3>
      ${switchRow('fx', 'Celebrations', 'Confetti when your week is planned, shopped and prepped', S.fx)}
      <div class="btn-row"><button type="button" class="btn ghost" data-act="export">${icon('down')}Save a backup</button>
        <label class="btn ghost file-btn">${icon('up')}Restore<input type="file" accept="application/json,.json" name="import" hidden></label></div>
      <button type="button" class="btn ghost danger wide" data-act="reset">Start over</button>
      <div class="about"><p><b>How it works.</b> Every meal is made ahead. Cooked food keeps 2–3 days in the fridge (Food Safety Information Council), so later serves go in the freezer on prep day — Prep Pal tells you when to move them to the fridge. Reheat until steaming hot.</p>
        <p><b>Data.</b> Nutrients: Australian Food Composition Database, Release 3 (Food Standards Australia New Zealand). Targets: Nutrient Reference Values for Australia and New Zealand. Prices: typical supermarket estimates for 2026.</p>
        <p><b>Privacy.</b> Your details and plans are stored only in this browser. Nothing is sent anywhere.</p></div>`;
  };
  openSheet(draw(), {
    label: 'Settings', cls: 'tall',
    act: Object.assign({}, Object.fromEntries(Object.entries(FORM_ACT).map(([k, fn]) => [k, (a, e, sh) => { fn(a); SET_DIRTY = true; save(); sh.set(draw()); }])), {
      step: (a, e, sh) => { stepField(a.dataset.name, +a.dataset.d); SET_DIRTY = true; save(); sh.set(draw()); },
      diet: (a, e, sh) => { const k = a.dataset.v; S.diet[k] = !S.diet[k]; SET_DIRTY = true; save(); sh.set(draw()); },
      avoid: (a, e, sh) => { const f = a.dataset.v; S.avoid = S.avoid.includes(f) ? S.avoid.filter(x => x !== f) : S.avoid.concat(f); SET_DIRTY = true; save(); sh.set(draw()); },
      unhide: (a, e, sh) => { S.hide = S.hide.filter(x => x !== a.dataset.v); SET_DIRTY = true; save(); sh.set(draw()); },
      export: () => exportBackup(),
      reset: () => confirmSheet({
        title: 'Start over?', body: 'This deletes your details, plans and prices from this phone.', yes: 'Delete everything',
        onYes: () => { try { localStorage.removeItem(STORE_KEY); } catch (e) { /* ignore */ } replaceState(freshState()); UI.week = null; startOnboarding(); },
      }),
    }),
    input: e => { if (['age', 'cm', 'kg'].includes(e.target.name)) { updateField(e.target.name, +e.target.value); SET_DIRTY = true; save(); } },
    change: (e, sh) => {
      const n = e.target.name;
      if (n === 'staples') { S.staples = e.target.checked; SET_DIRTY = true; save(); }
      if (n === 'fx') { S.fx = e.target.checked; save(); }
      if (n === 'import' && e.target.files && e.target.files[0]) importBackup(e.target.files[0]);
      if (['age', 'cm', 'kg'].includes(n)) sh.set(draw());
    },
    onClose: () => {
      const dirty = SET_DIRTY;
      SET_DIRTY = false;
      REV++;
      render();
      if (!dirty) return;
      const k = viewWeek(), g = weekRead(k).g;
      const misfit = slotsOf(weekCtx(k)).filter(s => g[s] && !allowed(RBY[g[s]]));
      if (misfit.length) toast(`${plural(misfit.length, 'meal')} this week ${misfit.length === 1 ? 'doesn’t' : 'don’t'} fit your new settings — swap ${misfit.length === 1 ? 'it' : 'them'} on the Plan tab.`, { ms: 6000 });
    },
  });
}

function exportBackup() {
  const blob = new Blob([JSON.stringify(S, null, 1)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `prep-pal-backup-${today()}.json`;
  document.body.append(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  toast('Backup saved to your downloads.');
}

function importBackup(file) {
  const rd = new FileReader();
  rd.onload = () => {
    try {
      const d = JSON.parse(rd.result);
      if (!d || typeof d !== 'object' || !d.prof || !d.wk) throw new Error('not a backup');
      replaceState(migrate(d));
      if (UPGRADED) { UPGRADED = false; upgradePlans(); }
      save();
      closeSheet(true);
      UI.week = null;
      render(true);
      toast('Backup restored.');
    } catch (e) {
      toast('That file isn’t a Prep Pal backup.');
    }
  };
  rd.readAsText(file);
}
