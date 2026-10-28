/* Prep Pal — Shop: the week's shopping list in aisle order, with pack sizes and prices. */
'use strict';

function usedIn(k, fid) {
  return weekEval(k).bs.filter(b => fid in b.r.ing).map(b => b.r.n);
}

VIEWS.shop = {
  title: 'Shop',
  render() {
    const k = viewWeek();
    ensurePlan(k);
    const nav = weekNav(k);
    if (!planned(k)) return `${nav}<section class="card empty-state"><h2>No plan for this week</h2><p class="sub">Plan the week first and the list appears here.</p><button type="button" class="btn" data-act="plan">${icon('spark')}Plan this week</button></section>`;
    const L = shopList(k);
    const byAisle = {};
    for (const it of L.buy) (byAisle[it.f.a] || (byAisle[it.f.a] = [])).push(it);
    const have = L.items.filter(i => i.have && !i.staple);
    const staples = L.items.filter(i => i.staple);
    const pct = L.buy.length ? Math.round((L.done / L.buy.length) * 100) : 100;
    const over = L.food > S.budget;
    return `${nav}
      <section class="card shop-sum">
        <div class="ss-top"><div><small>This shop</small><b class="big-num">${money(L.shop)}</b></div>
          <div class="ss-bud${over ? ' warn' : ''}"><small>Food for the week</small><b>${money(L.food)}</b><small>${over ? `${money(L.food - S.budget)} over` : `${money(S.budget - L.food)} under`} your ${money0(S.budget)} budget</small></div></div>
        <div class="bar" role="progressbar" aria-valuenow="${pct}" aria-valuemin="0" aria-valuemax="100" aria-label="Items in the trolley"><i style="width:${pct}%"></i></div>
        <p class="sub">${L.done} of ${L.buy.length} items in the trolley</p>
        <p class="tiny">${icon('info')}Rice, oats, spices and the like last longer than a week, so a shop can cost more than the week’s food. Prices are typical supermarket estimates — tap an item to set your own.</p>
        <div class="btn-row"><button type="button" class="btn ghost" data-act="copy">${icon('copy')}Copy list</button>${navigator.share ? `<button type="button" class="btn ghost" data-act="share">${icon('share')}Share</button>` : ''}</div>
      </section>
      ${L.buy.length ? '' : '<p class="lead center">Nothing to buy — you have everything.</p>'}
      ${AISLES.filter(a => byAisle[a]).map(a => `<h3 class="grp-title">${a}</h3><ul class="shop-list">${byAisle[a].map(it => `<li class="shop-item${it.got ? ' done' : ''}">
        <label class="chk"><input type="checkbox" name="got" value="${it.fid}" ${it.got ? 'checked' : ''} aria-label="${esc(it.f.n)} in the trolley"><span class="box">${icon('check')}</span></label>
        <button type="button" class="si-main" data-act="item" data-fid="${it.fid}"><b>${esc(it.f.n)}</b>
          <small>${it.f.each ? esc(buyText(it.fid, it.b)) : `${esc(buyText(it.fid, it.b))} · need ${needText(it.fid, it.need)}`}${it.stock > 0 ? ` (have ${needText(it.fid, it.stock)})` : ''}</small></button>
        <span class="si-price">${money(it.b.cost)}</span></li>`).join('')}</ul>`).join('')}
      ${have.length ? `<h3 class="grp-title">Already at home</h3><ul class="shop-list quiet">${have.map(it => `<li class="shop-item"><span class="chk-ph">${icon('check')}</span>
        <button type="button" class="si-main" data-act="item" data-fid="${it.fid}"><b>${esc(it.f.n)}</b><small>need ${needText(it.fid, it.need)}${it.mark ? ' · you said you have it' : ` · about ${needText(it.fid, it.stock)} left over`}</small></button></li>`).join('')}</ul>` : ''}
      ${staples.length ? `<h3 class="grp-title">Pantry staples — check you have</h3><ul class="shop-list quiet">${staples.map(it => `<li class="shop-item"><span class="chk-ph">${icon('info')}</span>
        <button type="button" class="si-main" data-act="item" data-fid="${it.fid}"><b>${esc(it.f.n)}</b><small>about ${needText(it.fid, it.need)} this week</small></button></li>`).join('')}</ul>` : ''}`;
  },
  change(e) {
    if (e.target.name !== 'got') return;
    const k = viewWeek(), w = weekEdit(k), fid = e.target.value;
    if (e.target.checked) w.got[fid] = 1; else delete w.got[fid];
    save();
    buzz(8);
    const L = shopList(k);
    render();
    if (e.target.checked && L.buy.length && L.done === L.buy.length) { confetti(); toast('Shop done! Time to prep.'); }
  },
  act: {
    item: a => itemSheet(viewWeek(), a.dataset.fid),
    copy: () => copyText(shopText(viewWeek())),
    share: () => {
      const text = shopText(viewWeek());
      navigator.share({ title: 'Shopping list', text }).catch(() => {});
    },
  },
};

function copyText(text) {
  const done = () => toast('Shopping list copied.');
  if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(done, () => fallbackCopy(text, done));
  else fallbackCopy(text, done);
}
function fallbackCopy(text, done) {
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.setAttribute('readonly', '');
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.append(ta);
  ta.select();
  try { document.execCommand('copy'); done(); } catch (e) { toast('Couldn’t copy on this device.'); }
  ta.remove();
}

function itemSheet(k, fid) {
  const f = FOODS[fid];
  const draw = () => {
    const w = weekRead(k), L = shopList(k), it = L.items.find(i => i.fid === fid);
    const packs = packsOf(fid);
    const carry = Math.round(carryIn(k)[fid] || 0);
    return `${sheetHead(esc(f.n), f.a)}
      ${it ? `<p class="lead">Need <b>${needText(fid, it.need)}</b> this week for ${usedIn(k, fid).map(esc).join(', ')}.</p>` : ''}
      <h3 class="sh-title">Price${packs.length > 1 ? 's' : ''}</h3>
      <div class="price-list">${packs.map((p, i) => `<label class="price-row"><span>${esc(p.each ? `1 ${p.label}` : p.label)}</span>
        <span class="money-in">$<input type="number" inputmode="decimal" step="0.05" min="0.05" max="200" name="price" data-i="${i}" value="${p.p.toFixed(2)}"></span></label>`).join('')}</div>
      ${S.prices[fid] ? '<button type="button" class="link-btn" data-act="reset">Back to the estimate</button>' : ''}
      ${f.staple && S.staples ? '<p class="sub">A pantry staple — not counted in the cost (change this in Settings).</p>' : switchRow('have', 'I already have enough', 'Leave it off this week’s list', !!w.have[fid])}
      ${f.keep === 'long' && !(f.staple && S.staples) ? `<label class="field"><span>How much do you have at home?${carry ? ` <small>(we think about ${needText(fid, carry)})</small>` : ''}</span>
        <span class="unit-in"><input type="number" inputmode="numeric" min="0" max="50000" step="10" name="stock" value="${w.stock[fid] != null ? Math.round(w.stock[fid] / (f.ml || 1)) : ''}" placeholder="${Math.round(carry / (f.ml || 1)) || 0}"><span>${f.ml ? 'ml' : 'g'}</span></span></label>
        <p class="tiny">Long-life food you ticked last week is carried over automatically.</p>` : ''}
      <p class="tiny">Nutrition from the Australian Food Composition Database (FSANZ): ${esc(f.src.replace(/^F\d+\s*/, ''))}.</p>`;
  };
  openSheet(draw(), {
    label: f.n,
    act: { reset: (a, e, sh) => { delete S.prices[fid]; save(); sh.set(draw()); render(); } },
    change: (e, sh) => {
      const w = weekEdit(k);
      if (e.target.name === 'have') { if (e.target.checked) w.have[fid] = 1; else delete w.have[fid]; save(); render(); return; }
      if (e.target.name === 'price') {
        const v = Math.round(+e.target.value * 100) / 100;
        if (!(v > 0)) { sh.set(draw()); return; }
        const n = packsOf(fid).length;
        const arr = (S.prices[fid] || new Array(n).fill(null)).slice(0, n);
        arr[+e.target.dataset.i] = v;
        S.prices[fid] = arr;
        save(); sh.set(draw()); render();
        return;
      }
      if (e.target.name === 'stock') {
        const raw = e.target.value.trim();
        const g = f.ml ? Math.round(+raw * f.ml) : Math.round(+raw);
        if (raw === '') delete w.stock[fid]; else if (isFinite(g) && g >= 0) w.stock[fid] = Math.min(g, 50000);
        save(); render();
      }
    },
  });
}
