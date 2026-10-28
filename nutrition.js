/* Prep Pal — nutrition: daily targets from your profile, recipe nutrients and weekly goal checks.
   Energy: Mifflin-St Jeor x activity. Protein: sports nutrition guidance (1.2-1.8 g/kg for active people).
   Vitamins and minerals: Australian & New Zealand Nutrient Reference Values (NHMRC), adults. */
'use strict';

const ACTS = {
  sit: { name: 'Mostly sitting', sub: 'Desk job, little exercise', pal: 1.4, p: 1.0, c: 3 },
  light: { name: 'Lightly active', sub: 'Exercise 1–3 times a week', pal: 1.55, p: 1.2, c: 3 },
  active: { name: 'Active', sub: 'Exercise 3–5 times a week', pal: 1.7, p: 1.4, c: 4 },
  endure: { name: 'Endurance training', sub: 'About 6–10 hours a week', pal: 1.85, p: 1.6, c: 5 },
  heavy: { name: 'Heavy training', sub: 'More than 10 hours a week', pal: 2.0, p: 1.8, c: 6 },
};
const GOALS = {
  keep: { name: 'Keep my weight', f: 1, p: 0 },
  lose: { name: 'Lose a little', f: 0.85, p: 0.2 },
  gain: { name: 'Build muscle', f: 1.1, p: 0.2 },
};

// kind: min = reach at least, range = stay between, max = keep under, show = no goal
const NUT_INFO = {
  kcal: { n: 'Energy', u: 'kcal', kind: 'range', w: 3, d: 0 },
  prot: { n: 'Protein', u: 'g', kind: 'min', w: 3, d: 0, why: 'Builds and repairs muscle.' },
  carb: { n: 'Carbs', u: 'g', kind: 'range', w: 1, d: 0, why: 'Fuel for training and your brain.' },
  fat: { n: 'Fat', u: 'g', kind: 'range', w: 1, d: 0 },
  sat: { n: 'Saturated fat', u: 'g', kind: 'max', w: 1.5, d: 0 },
  fib: { n: 'Fibre', u: 'g', kind: 'min', w: 2, d: 0, why: 'Keeps you full and your gut happy.' },
  sug: { n: 'Sugars', u: 'g', kind: 'show', w: 0, d: 0 },
  na: { n: 'Sodium', u: 'mg', kind: 'max', w: 1, d: 0, why: 'Mostly from bread, cheese and sauces.' },
  fe: { n: 'Iron', u: 'mg', kind: 'min', w: 2, d: 1, why: 'Carries oxygen to your muscles.' },
  ca: { n: 'Calcium', u: 'mg', kind: 'min', w: 2, d: 0, why: 'Bones, muscles and nerves.' },
  vc: { n: 'Vitamin C', u: 'mg', kind: 'min', w: 2, d: 0, why: 'Immunity, and helps you absorb iron.' },
  va: { n: 'Vitamin A', u: 'µg', kind: 'min', w: 1.5, d: 0, why: 'Eyes, skin and immunity.' },
  fol: { n: 'Folate', u: 'µg', kind: 'min', w: 1.5, d: 0, why: 'Makes new cells, including red blood cells.' },
  k: { n: 'Potassium', u: 'mg', kind: 'min', w: 1.5, d: 0, why: 'Muscle contractions and blood pressure.' },
  mg: { n: 'Magnesium', u: 'mg', kind: 'min', w: 1.5, d: 0, why: 'Energy, muscles and sleep.' },
  zn: { n: 'Zinc', u: 'mg', kind: 'min', w: 2, d: 1, why: 'Immunity and recovery.' },
  b12: { n: 'Vitamin B12', u: 'µg', kind: 'min', w: 2, d: 1, why: 'Energy and red blood cells.' },
};
const NI = {};
NUTS.forEach((n, i) => { NI[n] = i; });
const NN = NUTS.length;

// Foods to suggest when a nutrient is low.
const NUT_FOODS = {
  prot: 'chicken, mince, tuna, eggs, yoghurt, lentils', fib: 'oats, lentils, beans, chickpeas, veg',
  fe: 'Weet-Bix, lean mince, lentils, chickpeas, spinach', ca: 'milk, yoghurt, cheese',
  vc: 'capsicum, oranges, broccoli, berries', va: 'carrot, sweet potato, pumpkin, spinach',
  fol: 'Weet-Bix, spinach, chickpeas, lentils, eggs', k: 'potatoes, bananas, beans, milk, spinach',
  mg: 'oats, pepitas, almonds, beans, spinach', zn: 'lean mince, pepitas, oats, chicken',
  b12: 'milk, yoghurt, eggs, mince, tuna, salmon', carb: 'rice, pasta, oats, potatoes, bananas',
};

const profileReady = p => !!(p && p.sex && p.age && p.cm && p.kg);

// Full-day targets (before the share that planned meals cover).
function dailyTargets(p) {
  const sex = p.sex === 'f' ? 'f' : 'm';
  const age = p.age || 30, cm = p.cm || (sex === 'm' ? 178 : 165), kg = p.kg || (sex === 'm' ? 78 : 65);
  const act = ACTS[p.act] || ACTS.active;
  const goal = GOALS[p.goal] || GOALS.keep;
  const bmr = 10 * kg + 6.25 * cm - 5 * age + (sex === 'm' ? 5 : -161);
  const kcal = bmr * act.pal * goal.f;
  const prot = kg * (act.p + goal.p);
  const fat = (kcal * 0.3) / 9;
  const carb = Math.max(0, (kcal - prot * 4 - fat * 9) / 4);
  const t = {
    kcal, prot, carb, fat,
    sat: (kcal * 0.1) / 9,
    fib: sex === 'm' ? 30 : 25,
    sug: 0,
    na: 2000,
    fe: sex === 'f' && age <= 50 ? 18 : 8,
    ca: (sex === 'm' && age > 70) || (sex === 'f' && age > 50) ? 1300 : 1000,
    vc: 45,
    va: sex === 'm' ? 900 : 700,
    fol: 400,
    k: sex === 'm' ? 3800 : 2800,
    mg: sex === 'm' ? (age <= 30 ? 400 : 420) : (age <= 30 ? 310 : 320),
    zn: sex === 'm' ? 14 : 8,
    b12: 2.4,
  };
  return { t, bmr, kcal, carbMin: Math.min(carb * 0.9, Math.max(kcal * 0.45 / 4, kg * act.c)) };
}

// Weekly targets for the planned meals: daily x share of the day x planned days, with lower/upper bounds.
// Carbs: at least 45% of energy (AMDR) or the sports guide for your activity (g/kg), whichever is higher,
// but never more than 90% of what's left after protein and fat.
function weekTargets(days) {
  const d = dailyTargets(S.prof), t = d.t;
  const f = (S.wk.share / 100) * days;
  const tg = new Float64Array(NN), lo = new Float64Array(NN), hi = new Float64Array(NN);
  for (const n of NUTS) {
    const i = NI[n], v = t[n] * f;
    tg[i] = v;
    lo[i] = 0;
    hi[i] = Infinity;
    const kind = NUT_INFO[n].kind;
    if (kind === 'min') lo[i] = v;
    if (kind === 'max') hi[i] = v;
  }
  const E = tg[NI.kcal];
  lo[NI.kcal] = E * 0.92; hi[NI.kcal] = E * 1.08;
  lo[NI.carb] = d.carbMin * f; hi[NI.carb] = (E * 0.65) / 4;
  lo[NI.fat] = (E * 0.2) / 9; hi[NI.fat] = (E * 0.35) / 9;
  return { tg, lo, hi, days };
}

/* Recipe nutrients and energy for one standard serve. */
const RN = {}, RK = {}, RING = {};
for (const r of RECIPES) {
  const v = new Float64Array(NN);
  const ing = [];
  for (const [fid, g] of Object.entries(r.ing)) {
    const nu = FOODS[fid].nu;
    for (let i = 0; i < NN; i++) v[i] += (nu[i] * g) / 100;
    ing.push([fid, g]);
  }
  RN[r.id] = v;
  RK[r.id] = v[NI.kcal];
  RING[r.id] = ing;
}

// The state of each goal: ok, low, high, or close (within 10% of a minimum). Within 2% counts as met:
// serves come in quarter steps and the reference values aren't that precise.
function goalCheck(tot, T) {
  const out = [];
  for (const n of NUTS) {
    const info = NUT_INFO[n];
    if (info.kind === 'show') continue;
    const i = NI[n], v = tot[i];
    let state = 'ok';
    if (v < T.lo[i] * 0.98 - 1e-9) state = info.kind === 'min' && v >= T.lo[i] * 0.9 ? 'close' : 'low';
    else if (v > T.hi[i] * 1.02 + 1e-9) state = 'high';
    out.push({ n, i, v, tg: T.tg[i], lo: T.lo[i], hi: T.hi[i], state, ok: state === 'ok' });
  }
  return out;
}

const fmtNut = (n, v) => `${fmtNum(v, NUT_INFO[n].d)} ${NUT_INFO[n].u}`;

/* Diet filters. */
const dietTags = r => {
  const has = list => list.some(f => f in r.ing);
  return {
    veg: !has(FOOD_FLAGS.meat) && !has(FOOD_FLAGS.fish),
    nofish: !has(FOOD_FLAGS.fish),
    df: !has(FOOD_FLAGS.dairy),
    gf: !has(FOOD_FLAGS.gluten),
    nf: !has(FOOD_FLAGS.nuts),
    ef: !has(FOOD_FLAGS.egg),
  };
};
const RTAGS = {};
for (const r of RECIPES) RTAGS[r.id] = dietTags(r);
const DIET_NAMES = { veg: 'Vegetarian', nofish: 'No fish', df: 'Dairy-free', gf: 'Gluten-free', nf: 'Nut-free', ef: 'Egg-free' };

function allowed(r) {
  const tags = RTAGS[r.id];
  for (const k of DIETS) if (S.diet[k] && !tags[k]) return false;
  for (const f of S.avoid) if (f in r.ing) return false;
  return !S.hide.includes(r.id);
}
