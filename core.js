/* Prep Pal — core: helpers, dates, storage, UI kit and router */
'use strict';

const APP_VERSION = '1.0.0';
const STORE_KEY = 'prep-pal:v1';

/* ---------- helpers ---------- */
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const sum = a => a.reduce((t, n) => t + n, 0);
const plural = (n, one, many) => `${n} ${n === 1 ? one : many || one + 's'}`;
const icon = (id, cls) => `<svg class="ic${cls ? ' ' + cls : ''}" viewBox="0 0 32 32" aria-hidden="true"><use href="#i-${id}"/></svg>`;
const buzz = ms => { try { if (navigator.vibrate) navigator.vibrate(ms || 10); } catch (e) { /* not supported */ } };
const money = n => `$${(Math.round(n * 100) / 100).toFixed(2)}`;
const money0 = n => `$${Math.round(n)}`;
const FRAC = { 0.25: '¼', 0.5: '½', 0.75: '¾' };
function frac(n) {
  const q = Math.round(n * 4) / 4;
  const w = Math.floor(q), r = q - w;
  if (!r) return String(w);
  return `${w || ''}${FRAC[r]}`;
}
const roundTo = (n, step) => Math.round(n / step) * step;
function niceG(g) {
  if (g >= 1000) return `${(Math.round(g / 100) / 10).toLocaleString('en-AU')} kg`;
  if (g >= 100) return `${Math.round(g / 10) * 10} g`;
  if (g >= 20) return `${Math.round(g / 5) * 5} g`;
  return `${Math.max(1, Math.round(g))} g`;
}
function niceMl(ml) {
  if (ml >= 1000) return `${(Math.round(ml / 100) / 10).toLocaleString('en-AU')} L`;
  if (ml >= 100) return `${Math.round(ml / 10) * 10} ml`;
  return `${Math.max(5, Math.round(ml / 5) * 5)} ml`;
}
const fmtMins = m => { m = Math.round(m || 0); if (m < 60) return `${m} min`; const h = Math.floor(m / 60), r = m % 60; return r ? `${h} h ${r} min` : `${h} h`; };
const fmtNum = (n, d = 0) => (Math.round(n * 10 ** d) / 10 ** d).toLocaleString('en-AU', { minimumFractionDigits: 0, maximumFractionDigits: d });

/* ---------- dates (local YYYY-MM-DD keys; DAYS index 0 = Monday) ---------- */
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const DAYS_LONG = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const pad = n => String(n).padStart(2, '0');
const dkey = d => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromKey = k => { const [y, m, d] = k.split('-').map(Number); return new Date(y, m - 1, d); };
const today = () => dkey(new Date());
const addDays = (k, n) => { const d = fromKey(k); d.setDate(d.getDate() + n); return dkey(d); };
const daysBetween = (a, b) => Math.round((fromKey(b) - fromKey(a)) / 864e5);
const dayIdx = k => (fromKey(k).getDay() + 6) % 7;
const isKey = k => typeof k === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(k) && !isNaN(fromKey(k));
const fmtDay = k => { const d = fromKey(k); return `${DAYS[dayIdx(k)]} ${d.getDate()} ${MON[d.getMonth()]}`; };
const fmtShort = k => { const d = fromKey(k); return `${d.getDate()} ${MON[d.getMonth()]}`; };
function fmtRange(a, b) {
  const A = fromKey(a), B = fromKey(b);
  if (A.getMonth() === B.getMonth()) return `${A.getDate()}–${B.getDate()} ${MON[B.getMonth()]}`;
  return `${fmtShort(a)} – ${fmtShort(b)}`;
}

/* ---------- state ---------- */
const GROUP_IDS = ['L1', 'L2', 'B1', 'B2', 'S1', 'S2'];
const DIETS = ['veg', 'nofish', 'df', 'gf', 'nf', 'ef'];

function freshState() {
  return {
    v: 1,
    created: today(),
    onboarded: false,
    prof: { sex: '', age: 0, cm: 0, kg: 0, act: 'active', goal: 'keep' },
    wk: { prep: 6, cheat: 4, lunches: 4, bVar: 2, sVar: 2, share: 65, maxPrep: 120 },
    budget: 60,
    staples: true,
    diet: { veg: false, nofish: false, df: false, gf: false, nf: false, ef: false },
    avoid: [],
    hide: [],
    fav: [],
    por: {},
    prices: {},
    weeks: {},
    fx: true,
    savedAt: 0,
  };
}

const newWeek = () => ({ g: {}, lock: {}, skip: {}, got: {}, have: {}, stock: {}, seed: 0 });
const EMPTY_WEEK = Object.freeze(newWeek());
const RBY = {};
for (const r of RECIPES) RBY[r.id] = r;

function normWeek(w) {
  const o = newWeek();
  if (!w || typeof w !== 'object') return o;
  const g = w.g && typeof w.g === 'object' ? w.g : {};
  for (const id of GROUP_IDS) if (RBY[g[id]]) o.g[id] = g[id];
  const lock = w.lock && typeof w.lock === 'object' ? w.lock : {};
  for (const id of GROUP_IDS) if (lock[id] && o.g[id]) o.lock[id] = 1;
  if (w.skip && typeof w.skip === 'object') for (const [d, v] of Object.entries(w.skip)) { const n = +d; if (v && n >= 0 && n <= 6) o.skip[n] = 1; }
  for (const f of ['got', 'have']) if (w[f] && typeof w[f] === 'object') for (const [fid, v] of Object.entries(w[f])) if (v && FOODS[fid]) o[f][fid] = 1;
  if (w.stock && typeof w.stock === 'object') {
    for (const [fid, v] of Object.entries(w.stock)) if (FOODS[fid] && isFinite(+v) && +v >= 0) o.stock[fid] = clamp(Math.round(+v), 0, 50000);
  }
  o.seed = Math.max(0, Math.round(+w.seed || 0)) % 1e6;
  return o;
}

function migrate(d) {
  const s = freshState();
  if (!d || typeof d !== 'object') return s;
  s.created = isKey(d.created) ? d.created : s.created;
  s.onboarded = !!d.onboarded;
  const p = d.prof && typeof d.prof === 'object' ? d.prof : {};
  s.prof.sex = ['m', 'f'].includes(p.sex) ? p.sex : '';
  s.prof.age = +p.age ? clamp(Math.round(+p.age), 14, 99) : 0;
  s.prof.cm = +p.cm ? clamp(Math.round(+p.cm), 120, 230) : 0;
  s.prof.kg = +p.kg ? clamp(Math.round(+p.kg * 2) / 2, 35, 250) : 0;
  s.prof.act = ACTS[p.act] ? p.act : 'active';
  s.prof.goal = GOALS[p.goal] ? p.goal : 'keep';
  const w = d.wk && typeof d.wk === 'object' ? d.wk : {};
  s.wk.prep = [5, 6].includes(+w.prep) ? +w.prep : 6;
  s.wk.cheat = +w.cheat >= -1 && +w.cheat <= 6 && w.cheat !== '' && w.cheat != null ? Math.round(+w.cheat) : 4;
  s.wk.lunches = clamp(Math.round(+w.lunches || 4), 2, 5);
  s.wk.bVar = +w.bVar === 1 ? 1 : 2;
  s.wk.sVar = +w.sVar === 1 ? 1 : 2;
  s.wk.share = clamp(Math.round((+w.share || 65) / 5) * 5, 40, 90);
  s.wk.maxPrep = [60, 90, 120, 150, 180, 0].includes(+w.maxPrep) ? +w.maxPrep : 120;
  s.budget = clamp(Math.round(+d.budget || 60), 15, 400);
  s.staples = d.staples !== false;
  const dt = d.diet && typeof d.diet === 'object' ? d.diet : {};
  for (const k of DIETS) s.diet[k] = !!dt[k];
  const ids = (a, ok) => (Array.isArray(a) ? Array.from(new Set(a.filter(x => ok(x)))) : []);
  s.avoid = ids(d.avoid, f => !!FOODS[f]);
  s.hide = ids(d.hide, r => !!RBY[r]);
  s.fav = ids(d.fav, r => !!RBY[r]);
  if (d.por && typeof d.por === 'object') {
    for (const [rid, m] of Object.entries(d.por)) if (RBY[rid] && +m > 0) s.por[rid] = clamp(roundTo(+m, 0.25), 0.25, 4);
  }
  if (d.prices && typeof d.prices === 'object') {
    for (const [fid, arr] of Object.entries(d.prices)) {
      if (!FOODS[fid] || !Array.isArray(arr)) continue;
      const n = FOODS[fid].packs ? FOODS[fid].packs.length : 1;
      const a = arr.slice(0, n).map(v => (isFinite(+v) && +v > 0 ? Math.round(+v * 100) / 100 : null));
      if (a.some(v => v != null)) s.prices[fid] = a;
    }
  }
  if (d.weeks && typeof d.weeks === 'object') for (const [k, wk] of Object.entries(d.weeks)) if (isKey(k)) s.weeks[k] = normWeek(wk);
  s.fx = d.fx !== false;
  s.savedAt = +d.savedAt || 0;
  return s;
}

let S = freshState();
let REV = 0;

function load() {
  let raw = null;
  try { raw = localStorage.getItem(STORE_KEY); } catch (e) { /* storage blocked */ }
  if (!raw) return freshState();
  try {
    return migrate(JSON.parse(raw));
  } catch (e) {
    try { localStorage.setItem(`${STORE_KEY}:unreadable-${Date.now()}`, raw); } catch (_) { /* full */ }
    return freshState();
  }
}

function save() {
  REV++;
  S.savedAt = Date.now();
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(S));
  } catch (e) {
    toast('Couldn’t save on this device. Storage may be full.', { ms: 6000 });
  }
}

function replaceState(next) { S = next; REV++; }

const weekRead = k => S.weeks[k] || EMPTY_WEEK;
const weekEdit = k => S.weeks[k] || (S.weeks[k] = newWeek());

/* Cached results, cleared whenever anything changes. */
let MEMO = { rev: -1, m: {} };
function memo(key, fn) {
  if (MEMO.rev !== REV) MEMO = { rev: REV, m: {} };
  const m = MEMO.m;
  return key in m ? m[key] : (m[key] = fn());
}

/* ---------- amounts ---------- */
// One ingredient line for a recipe, e.g. "2 tbsp peanut butter", "¼ red capsicum", "140 g rolled oats".
function amount(fid, g) {
  const f = FOODS[fid];
  const name = f.rn || f.n.toLowerCase();
  if (f.sp) {
    for (let i = 0; i < f.sp.length; i++) {
      const [gpu, unit] = f.sp[i];
      const n = g / gpu;
      if (n >= 0.9 || i === f.sp.length - 1) {
        if (n < 0.2) return `a pinch of ${name}`;
        if (n > 8 && f.ml) break;
        if (n > 8) return `${niceG(g)} ${name}`;
        return `${frac(Math.max(0.25, n))} ${unit} ${name}`;
      }
    }
  }
  if (f.u) {
    const [gpu, one, many, step, after] = f.u;
    const n = roundTo(g / gpu, step || 0.5);
    if (n > 0) return `${frac(n)} ${n <= 1 ? one : many}${after ? ' ' + after : ''}`;
  }
  if (f.ml) return `${niceMl(g / f.ml)} ${name}`;
  return `${niceG(g)} ${name}`;
}

// How much you need, for the shopping list ("1.2 kg", "9", "750 ml").
function needText(fid, g) {
  const f = FOODS[fid];
  if (f.each) { const n = Math.ceil(g / f.each[0] - 0.05); return `${n} ${n === 1 ? f.each[2] : f.each[3]}`; }
  if (f.u && f.u[3] === 1 && !f.packs) return `${Math.ceil(g / f.u[0])} ${f.u[2]}`;
  if (f.ml) return niceMl(g / f.ml);
  return niceG(g);
}

/* ---------- toast ---------- */
let toastTimer = null;
function toast(msg, opts = {}) {
  const root = $('#toast-root');
  clearTimeout(toastTimer);
  root.innerHTML = '';
  const action = opts.action || (opts.undo ? { label: 'Undo', fn: opts.undo } : null);
  const el = document.createElement('div');
  el.className = 'toast';
  el.innerHTML = `<span>${msg}</span>${action ? `<button type="button">${esc(action.label)}</button>` : ''}`;
  root.append(el);
  const hide = () => { clearTimeout(toastTimer); el.classList.add('out'); setTimeout(() => el.remove(), 260); };
  toastTimer = setTimeout(hide, opts.ms || (action ? 6500 : 3200));
  if (action) el.querySelector('button').addEventListener('click', () => { hide(); action.fn(); });
  return hide;
}

/* ---------- celebrations ---------- */
const reduceMotion = () => !!(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
const fxOn = () => S.fx && !reduceMotion();
const PALETTE = ['#1B7D4F', '#066839', '#6FD39F', '#F1F7F3', '#0F5132'];

function confetti(n = 60) {
  if (!fxOn()) return;
  const root = $('#fx-root');
  for (let i = 0; i < n; i++) {
    const p = document.createElement('i');
    p.className = 'confetti';
    const w = 7 + Math.random() * 7;
    p.style.left = `${Math.random() * 100}vw`;
    p.style.width = `${w}px`;
    p.style.height = `${w * (Math.random() < 0.5 ? 1 : 1.8)}px`;
    p.style.background = PALETTE[i % PALETTE.length];
    p.style.borderRadius = Math.random() < 0.35 ? '50%' : '2px';
    p.style.setProperty('--dx', `${Math.random() * 200 - 100}px`);
    p.style.setProperty('--rot', `${Math.random() * 1000 - 500}deg`);
    p.style.setProperty('--dur', `${1.9 + Math.random() * 1.5}s`);
    p.style.setProperty('--delay', `${Math.random() * 0.45}s`);
    root.append(p);
    setTimeout(() => p.remove(), 4200);
  }
}

/* ---------- bottom sheets ---------- */
let SHEET = null;
function openSheet(html, opts = {}) {
  closeSheet(true);
  clearTimeout(toastTimer);
  $('#toast-root').innerHTML = '';
  const root = $('#sheet-root');
  const back = document.createElement('div');
  back.className = 'backdrop';
  const el = document.createElement('div');
  el.className = 'sheet' + (opts.cls ? ' ' + opts.cls : '');
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  if (opts.label) el.setAttribute('aria-label', opts.label);
  el.tabIndex = -1;
  root.append(back, el);
  document.body.classList.add('locked');
  const sh = {
    el, back, opts, closed: false,
    close: () => closeSheet(),
    set(content) {
      const top = el.scrollTop;
      el.innerHTML = `<div class="grab"></div>${content}`;
      el.scrollTop = top;
    },
  };
  sh.set(html);
  SHEET = sh;
  back.addEventListener('click', () => closeSheet());
  el.addEventListener('click', e => {
    if (e.target.closest('[data-close]')) { e.preventDefault(); closeSheet(); return; }
    const a = e.target.closest('[data-act]');
    if (a && opts.act && opts.act[a.dataset.act] && !a.disabled) { e.preventDefault(); opts.act[a.dataset.act](a, e, sh); }
  });
  if (opts.input) el.addEventListener('input', e => opts.input(e, sh));
  if (opts.change) el.addEventListener('change', e => opts.change(e, sh));
  el.addEventListener('submit', e => { e.preventDefault(); if (opts.submit) opts.submit(e, sh); });
  el.focus({ preventScroll: true });
  if (opts.onOpen) opts.onOpen(sh);
  return sh;
}

function closeSheet(instant) {
  const sh = SHEET;
  if (!sh) return;
  SHEET = null;
  sh.closed = true;
  document.body.classList.remove('locked');
  if (sh.opts.onClose) sh.opts.onClose(sh);
  if (instant) { sh.el.remove(); sh.back.remove(); return; }
  sh.el.classList.add('closing');
  sh.back.classList.add('closing');
  setTimeout(() => { sh.el.remove(); sh.back.remove(); }, 230);
}

const sheetHead = (title, sub) => `<div class="sheet-head"><div><h2>${title}</h2>${sub ? `<p class="sub">${sub}</p>` : ''}</div><button type="button" class="icon-btn" data-close aria-label="Close">${icon('x')}</button></div>`;

function confirmSheet({ title, body, yes = 'Yes', no = 'Cancel', onYes }) {
  openSheet(`${sheetHead(title)}<p class="lead">${body}</p>
    <div class="btn-row"><button type="button" class="btn ghost" data-close>${no}</button><button type="button" class="btn" data-act="yes">${yes}</button></div>`,
  { label: title, act: { yes: (a, e, sh) => { sh.close(); onYes(); } } });
}

/* ---------- small form widgets ---------- */
function stepper(name, shown, label) {
  return `<div class="stepper" role="group" aria-label="${esc(label || name)}">
    <button type="button" data-act="step" data-name="${name}" data-d="-1" aria-label="Less">${icon('minus')}</button>
    <output aria-live="polite">${shown}</output>
    <button type="button" data-act="step" data-name="${name}" data-d="1" aria-label="More">${icon('plus')}</button></div>`;
}
const seg = (items, cur, act, cls) => `<div class="seg${cls ? ' ' + cls : ''}" role="radiogroup">${items.map(([v, l]) => `<button type="button" role="radio" class="${String(v) === String(cur) ? 'on' : ''}" aria-checked="${String(v) === String(cur)}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
const switchRow = (name, title, sub, on) => `<label class="switch-row"><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span><span class="switch"><input type="checkbox" name="${name}" ${on ? 'checked' : ''}><span></span></span></label>`;
const chipRow = (items, cur, act, label) => `<div class="chips" role="radiogroup" aria-label="${esc(label || '')}">${items.map(([v, l]) => `<button type="button" role="radio" class="chip${String(v) === String(cur) ? ' on' : ''}" aria-checked="${String(v) === String(cur)}" data-act="${act}" data-v="${v}">${l}</button>`).join('')}</div>`;
const sectionTitle = (title, extra) => `<div class="section-title"><h2>${title}</h2>${extra || ''}</div>`;

/* ---------- router ---------- */
const VIEWS = {};
const UI = { week: null, recType: 'l', recTime: 0, recQ: '', prepOpen: false };
let CUR = null;

function routeName() {
  const r = (location.hash || '').replace(/^#\/?/, '').split(/[?/]/)[0];
  return VIEWS[r] ? r : 'week';
}

function render(fresh) {
  const name = routeName();
  if (name !== CUR) fresh = true;
  CUR = name;
  const v = VIEWS[name];
  const view = $('#view');
  const y = window.scrollY;
  view.classList.remove('view-in');
  view.innerHTML = v.render();
  if (fresh) {
    void view.offsetWidth;
    view.classList.add('view-in');
    window.scrollTo(0, 0);
  } else window.scrollTo(0, y);
  if (v.after) v.after(view);
  for (const t of $$('.tab')) {
    const on = t.dataset.tab === name;
    t.classList.toggle('active', on);
    if (on) t.setAttribute('aria-current', 'page'); else t.removeAttribute('aria-current');
  }
  document.title = name === 'week' ? 'Prep Pal' : `${v.title} · Prep Pal`;
}

const GLOBAL_ACT = {
  settings: () => openSettings(),
};

function onViewClick(e) {
  const a = e.target.closest('[data-act]');
  if (!a || a.disabled || !$('#view').contains(a)) return;
  const v = VIEWS[CUR];
  const fn = (v && v.act && v.act[a.dataset.act]) || GLOBAL_ACT[a.dataset.act] || SHARED_ACT[a.dataset.act];
  if (fn) { e.preventDefault(); fn(a, e); }
}

let DAY = null;
function checkDay() {
  const t = today();
  if (t === DAY) return;
  DAY = t;
  UI.week = null;
  REV++;
  if (!SHEET && S.onboarded) render();
}

function registerSW() {
  if (!('serviceWorker' in navigator) || !/^https?:$/.test(location.protocol)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline support is optional */ });
}

function askPersist() {
  try {
    if (navigator.storage && navigator.storage.persist) navigator.storage.persisted().then(p => p || navigator.storage.persist()).catch(() => {});
  } catch (e) { /* not supported */ }
}

function boot() {
  replaceState(load());
  DAY = today();
  $('#view').addEventListener('click', onViewClick);
  $('#view').addEventListener('change', e => {
    const v = VIEWS[CUR];
    if (v && v.change) v.change(e);
  });
  $('#view').addEventListener('input', e => {
    const v = VIEWS[CUR];
    if (v && v.input) v.input(e);
  });
  document.addEventListener('click', e => {
    const a = e.target.closest('[data-action]');
    if (a && GLOBAL_ACT[a.dataset.action]) { e.preventDefault(); GLOBAL_ACT[a.dataset.action](a, e); }
  });
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && SHEET) { closeSheet(); return; }
    if ((e.key === 'Enter' || e.key === ' ') && e.target.matches('[role="button"][data-act]')) { e.preventDefault(); e.target.click(); }
  });
  window.addEventListener('hashchange', () => { closeSheet(true); clearTimeout(toastTimer); $('#toast-root').innerHTML = ''; render(true); });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) checkDay(); });
  setInterval(checkDay, 30000);
  window.addEventListener('storage', e => {
    if (e.key !== STORE_KEY) return;
    replaceState(load());
    if (!SHEET && S.onboarded) render();
  });
  if (!S.onboarded) startOnboarding();
  else { render(true); askPersist(); }
  registerSW();
}

document.addEventListener('DOMContentLoaded', boot);
