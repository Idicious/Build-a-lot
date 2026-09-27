/* DOM layer: menus, HUD, board rendering and input. All rules live in engine.js. */
(function () {
  const { data: D, engine: E, art: A, sound: S } = window.BAL;
  const $ = (id) => document.getElementById(id);
  const fmt = (n) => (n < 0 ? '−$' : '$') + Math.abs(Math.round(n)).toLocaleString('en-US');
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
  const days = (d) => `${d} day${d === 1 ? '' : 's'}`;

  const STORE_KEY = 'lotbylot.progress.v1';
  const SPEEDS = [0, 1, 2, 4];

  let progress = loadProgress();
  let game = null;
  let speed = 1;
  let selected = null;
  let screen = 'menu';
  let log = [];
  let lotEls = [];
  let lotSigs = [];
  let panelSig = '';
  let goalsSig = '';
  let last = performance.now();

  // ---------- persistence ----------
  function loadProgress() {
    try {
      const p = JSON.parse(localStorage.getItem(STORE_KEY));
      if (p && Array.isArray(p.ratings)) return p;
    } catch (e) { /* storage unavailable */ }
    return { ratings: [] };
  }
  function saveProgress() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(progress)); } catch (e) { /* storage unavailable */ }
  }
  const unlocked = (i) => i === 0 || !!progress.ratings[i - 1];

  // ---------- menu ----------
  function keySVG(kind) {
    const fill = kind === 'expert' ? '#e0a526' : '#9aa8ae';
    const dark = kind === 'expert' ? '#9c6b0c' : '#5d6b71';
    return `<svg viewBox="0 0 84 84"><circle cx="42" cy="42" r="40" fill="${fill}" opacity=".18"/>
      <circle cx="30" cy="42" r="14" fill="none" stroke="${fill}" stroke-width="7"/>
      <rect x="42" y="38.5" width="30" height="7" rx="2" fill="${fill}"/><rect x="60" y="44" width="5" height="10" fill="${fill}"/><rect x="68" y="44" width="4" height="7" fill="${fill}"/>
      <circle cx="30" cy="42" r="5" fill="${dark}" opacity=".35"/></svg>`;
  }

  function ratingBadge(r) {
    if (r === 'expert') return '<span class="key expert">● Gold key</span>';
    if (r === 'complete') return '<span class="key complete">● Finished</span>';
    return '';
  }

  function renderMenu() {
    $('levels').innerHTML = D.LEVELS.map((L, i) => {
      const open = unlocked(i);
      const r = progress.ratings[i];
      const shown = L.houses.slice(-3);
      return `<li><button class="level-card" type="button" data-level="${i}" ${open ? '' : 'disabled'}>
        <div class="scene">${shown.map((t) => A.thumbSVG('house', t)).join('')}</div>
        <div class="num"><span>Street ${i + 1} · Expert by day ${L.expertDays}</span>${ratingBadge(r)}</div>
        <h2>${esc(L.name)}</h2>
        <p class="intro">${open ? esc(L.intro) : 'Finish the previous street to unlock.'}</p>
        <ul class="goal-list">${L.goals.map((g) => `<li>${esc(E.goalLabel(g))}</li>`).join('')}</ul>
      </button></li>`;
    }).join('');
    const done = progress.ratings.filter(Boolean).length;
    const gold = progress.ratings.filter((r) => r === 'expert').length;
    $('progress-summary').textContent = `${done} of ${D.LEVELS.length} streets finished · ${gold} gold ${gold === 1 ? 'key' : 'keys'}`;
    const canResume = game && game.status === 'playing';
    $('resume').hidden = !canResume;
    if (canResume) $('resume').textContent = `Resume ${D.LEVELS[game.level].name} · day ${game.day}`;
  }

  function showScreen(name) {
    screen = name;
    $('menu').hidden = name !== 'menu';
    $('game').hidden = name !== 'game';
    if (name === 'menu') renderMenu();
    window.scrollTo(0, 0);
  }

  // ---------- starting a street ----------
  function startLevel(i, restored) {
    game = restored || E.createGame(i);
    selected = null;
    if (!restored) log = [{ day: 1, text: D.LEVELS[i].intro }];
    $('modal').hidden = true;
    buildBoard();
    showScreen('game');
    render(true);
  }

  function buildBoard() {
    const L = D.LEVELS[game.level];
    const board = $('board');
    board.style.setProperty('--cols', L.perRow);
    const row = (r) => `<div class="lot-row">${game.lots.filter((l) => l.row === r).map((l) => `<div class="lot" role="button" tabindex="0" data-lot="${l.id}"></div>`).join('')}</div>`;
    board.innerHTML = row(0) + `<div class="road"><span class="road-name">${esc(L.name)}</span></div>` + row(1);
    lotEls = [];
    board.querySelectorAll('.lot').forEach((el) => { lotEls[Number(el.dataset.lot)] = el; });
    lotSigs = [];
    panelSig = '';
    goalsSig = '';
    $('hud-level').textContent = L.name;
  }

  // ---------- lot rendering ----------
  function lotLabel(lot) {
    if (lot.task) {
      const t = lot.task;
      const what = t.kind === 'build' ? `Building ${D.HOUSES[t.type].name}`
        : t.kind === 'special' ? `Building ${D.SPECIALS[t.type].name}`
        : t.kind === 'upgrade' ? D.UPGRADES[t.type].name
        : 'Tearing down';
      return [what, plural(t.workers, 'worker')];
    }
    if (lot.kind === 'house') return [D.HOUSES[lot.house.type].name, `${fmt(E.rentFor(game, lot))}/day`];
    if (lot.kind === 'special') {
      const extra = { park: '+20% rent', mill: `+${D.MILL_OUTPUT} mat/day`, workshop: '30% faster' }[lot.special];
      return [D.SPECIALS[lot.special].name, extra];
    }
    if (lot.kind === 'rundown') return ['Run-down', lot.owned ? 'yours' : fmt(lot.price)];
    return lot.owned ? ['Your lot', 'ready'] : ['For sale', fmt(lot.price)];
  }

  function lotSig(lot) {
    return JSON.stringify([lot.kind, lot.owned, lot.house, lot.special, lot.task && [lot.task.kind, lot.task.type], lot.rent,
      lot.kind === 'house' ? E.rentFor(game, lot) : 0, selected === lot.id]);
  }

  function renderLot(lot) {
    const el = lotEls[lot.id];
    const [name, detail] = lotLabel(lot);
    const cap = lot.kind === 'house' ? E.rentFor(game, lot) * D.RENT_CAP_DAYS : 0;
    el.classList.toggle('selected', selected === lot.id);
    el.setAttribute('aria-label', `Lot ${lot.id + 1}: ${name}, ${detail}`);
    el.innerHTML = A.lotSVG(lot, lot.id) +
      (lot.task ? '<div class="bar"><i></i></div>' : '') +
      (lot.rent > 0 ? `<button type="button" class="coin${lot.rent >= cap ? ' full' : ''}" data-collect="${lot.id}" aria-label="Collect ${fmt(lot.rent)} rent">${fmt(lot.rent).slice(1)}</button>` : '') +
      `<div class="lot-label"><b>${esc(name)}</b><span>${esc(detail)}</span></div>`;
  }

  function updateLotProgress(lot) {
    if (!lot.task) return;
    const el = lotEls[lot.id];
    const p = Math.min(1, lot.task.progress);
    const bar = el.querySelector('.bar i');
    if (bar) bar.style.width = `${p * 100}%`;
    const clip = el.querySelector('clipPath rect');
    if (clip) {
      const h = 120 * p;
      clip.setAttribute('height', h);
      clip.setAttribute('y', clip.dataset.reveal === 'up' ? 120 - h : 0);
    }
  }

  function floatText(lotId, text, negative) {
    const el = lotEls[lotId];
    if (!el) return;
    const f = document.createElement('span');
    f.className = 'float' + (negative ? ' neg' : '');
    f.textContent = text;
    el.appendChild(f);
    setTimeout(() => f.remove(), 1300);
  }

  // ---------- HUD ----------
  function setText(id, text) {
    const el = $(id);
    if (el.textContent !== text) el.textContent = text;
  }

  function renderHud() {
    const s = game;
    setText('hud-day', `Day ${s.day}`);
    $('day-dial').style.setProperty('--p', ((s.time % D.DAY_SECONDS) / D.DAY_SECONDS).toFixed(3));
    setText('hud-cash', fmt(s.cash));
    setText('hud-mat', String(s.materials));
    const price = $('hud-price');
    setText('hud-price', `${fmt(s.matPrice)} ea ${s.matTrend > 0 ? '▲' : s.matTrend < 0 ? '▼' : ''}`);
    price.className = 'price' + (s.matTrend > 0 ? ' up' : s.matTrend < 0 ? ' down' : '');
    for (const n of [1, 10, 50]) {
      $(`buy${n}`).disabled = !!E.checks.materials(s, n);
      $(`buy${n}`).title = `Buy ${n} for ${fmt(s.matPrice * n)}`;
    }
    setText('hud-crew', `${E.freeWorkers(s)}/${s.workers}`);
    const full = s.workers >= D.LEVELS[s.level].maxWorkers;
    setText('hire', full ? 'Full crew' : `Hire ${fmt(E.hireCost(s))}`);
    $('hire').disabled = !!E.checks.hire(s);
    const waiting = s.lots.reduce((n, l) => n + l.rent, 0);
    setText('collect-all', waiting ? `Collect ${fmt(waiting)}` : 'No rent due');
    $('collect-all').disabled = !waiting;
    document.querySelectorAll('.speed button').forEach((b) => b.setAttribute('aria-pressed', String(Number(b.dataset.speed) === speed)));
    $('board').classList.toggle('paused', speed === 0 && s.status === 'playing');

    const L = D.LEVELS[s.level];
    const late = s.day > L.expertDays;
    setText('expert', late ? `Past expert day ${L.expertDays}` : `Expert by day ${L.expertDays}`);
    $('expert').classList.toggle('late', late);
  }

  function renderGoals() {
    const L = D.LEVELS[game.level];
    const rows = L.goals.map((g, i) => ({ g, p: E.goalProgress(game, g), met: game.goalsMet[i] }));
    const sig = JSON.stringify(rows.map((r) => [r.p.current, r.met]));
    if (sig === goalsSig) return;
    goalsSig = sig;
    $('goals').innerHTML = rows.map(({ g, p, met }) => {
      const money = g.kind === 'cash' || g.kind === 'rent';
      const pct = met ? 100 : Math.max(0, Math.min(100, (p.current / p.target) * 100));
      const count = money ? `${fmt(Math.min(p.current, p.target))} / ${fmt(p.target)}` : `${Math.min(p.current, p.target)} / ${p.target}`;
      return `<li class="goal${met ? ' done' : ''}"><span class="tick">✓</span>
        <div class="goal-top"><span class="goal-name">${esc(E.goalLabel(g))}</span><span class="count">${met ? 'done' : count}</span></div>
        <div class="meter"><i style="width:${pct}%"></i></div></li>`;
    }).join('');
  }

  // ---------- selected-lot panel ----------
  function costLine(cost, mats, workers, d) {
    const parts = [];
    if (cost) parts.push(fmt(cost));
    if (mats) parts.push(`${mats} materials (${fmt(mats * game.matPrice)} today)`);
    if (workers) parts.push(plural(workers, 'worker'));
    if (d) parts.push(days(d));
    return parts.join(' · ');
  }

  // `mats` is the materials the job needs; when that is the only thing missing, offer to buy the shortfall.
  function actionButton({ act, arg = '', thumb, name, gain = '', cost, why, mats = 0 }) {
    const button = `<button type="button" class="action" data-act="${act}" data-arg="${arg}" ${why ? 'disabled' : ''}>
      ${thumb}
      <span class="action-body"><span class="action-name">${esc(name)}${gain ? `<em>${esc(gain)}</em>` : ''}</span>
      <span class="action-cost">${esc(cost)}</span>${why ? `<span class="action-why">${esc(why)}</span>` : ''}</span>
    </button>`;
    const short = mats - game.materials;
    if (!why || short <= 0 || !/materials/.test(why)) return button;
    const price = short * game.matPrice;
    const buy = `<button type="button" class="btn small buy-short" data-buy="${short}" ${game.cash < price ? 'disabled' : ''}>Buy ${short} materials for ${fmt(price)}</button>`;
    return `<div class="action-wrap">${button}${buy}</div>`;
  }
  const plainThumb = (t) => `<span class="thumb plain" aria-hidden="true">${t}</span>`;
  const artThumb = (kind, type) => `<span class="thumb" aria-hidden="true">${A.thumbSVG(kind, type)}</span>`;

  function renderPanel() {
    const s = game;
    const lot = selected == null ? null : s.lots[selected];
    const sig = JSON.stringify([selected, lot && lotSig(lot), s.cash, s.materials, s.matPrice, E.freeWorkers(s), s.status]);
    if (sig === panelSig) return;
    panelSig = sig;
    const L = D.LEVELS[s.level];
    const card = $('lot-card');

    if (!lot) {
      card.innerHTML = `<h2>${esc(L.name)}</h2><p class="hint">${esc(L.intro)}</p>
        <p class="hint">Pick a lot on the street to buy it, build on it or improve it. Click the gold coins to collect rent.</p>`;
      return;
    }

    let title, sub, facts = [], acts = [];
    const fact = (k, v) => facts.push(`<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`);

    if (lot.task) {
      const [what, crew] = lotLabel(lot);
      title = what;
      sub = `Crew of ${crew.replace(/ workers?/, '')} on site. The work finishes on its own.`;
    } else if (!lot.owned) {
      title = lot.kind === 'rundown' ? 'Run-down house' : 'Lot for sale';
      sub = lot.kind === 'rundown' ? 'Cheap, but it has to come down before you can build.' : 'An empty lot, ready for a new house.';
      fact('Asking price', fmt(lot.price));
      acts.push(actionButton({ act: 'buyLot', thumb: plainThumb('$'), name: 'Buy this lot', cost: fmt(lot.price), why: E.checks.buyLot(s, lot) }));
    } else if (lot.kind === 'rundown') {
      title = 'Run-down house';
      sub = 'Tear it down to free up the lot.';
      acts.push(actionButton({ act: 'demolish', thumb: plainThumb('⌫'), name: 'Tear down', cost: costLine(D.DEMOLISH.cost, 0, D.DEMOLISH.workers, D.DEMOLISH.days), why: E.checks.demolish(s, lot) }));
    } else if (lot.kind === 'empty') {
      title = 'Your empty lot';
      sub = 'Choose what to build.';
      for (const t of L.houses) {
        const h = D.HOUSES[t];
        acts.push(actionButton({ act: 'build', arg: t, thumb: artThumb('house', t), name: h.name, gain: `${fmt(h.rent)}/day`, cost: costLine(0, h.materials, h.workers, h.days), why: E.checks.build(s, lot, t), mats: h.materials }));
      }
      for (const t of L.specials) {
        const sp = D.SPECIALS[t];
        acts.push(actionButton({ act: 'buildSpecial', arg: t, thumb: artThumb('special', t), name: sp.name, gain: sp.blurb, cost: costLine(0, sp.materials, sp.workers, sp.days), why: E.checks.special(s, lot, t), mats: sp.materials }));
      }
    } else if (lot.kind === 'house') {
      const h = D.HOUSES[lot.house.type];
      title = h.name;
      sub = lot.house.upgrades.length ? `Upgrades: ${lot.house.upgrades.map((k) => D.UPGRADES[k].name.toLowerCase()).join(', ')}.` : 'Rented and paying every day.';
      fact('Rent', `${fmt(E.rentFor(s, lot))}/day`);
      const park = E.parkBonus(s, lot);
      if (park) fact('Park bonus', `+${Math.round(park * 100)}%`);
      fact('Rent waiting', fmt(lot.rent));
      if (L.canSell) fact('Sale price', fmt(E.saleValue(s, lot)));
      if (lot.rent > 0) acts.push(actionButton({ act: 'collect', thumb: plainThumb('¢'), name: 'Collect rent', gain: `+${fmt(lot.rent)}`, cost: 'Tenants have paid' }));
      for (const k of L.upgrades) {
        if (lot.house.upgrades.includes(k)) continue;
        const u = D.UPGRADES[k];
        const mats = E.upgradeMaterials(lot.house.type, k);
        acts.push(actionButton({ act: 'upgrade', arg: k, thumb: plainThumb({ paint: '🖌', yard: '✿', porch: '⌂' }[k]), name: u.name, gain: `+${Math.round(u.rentBonus * 100)}% rent`, cost: costLine(0, mats, u.workers, u.days), why: E.checks.upgrade(s, lot, k), mats }));
      }
      if (L.canSell) acts.push(actionButton({ act: 'sell', thumb: plainThumb('$'), name: 'Sell house and lot', gain: `+${fmt(E.saleValue(s, lot))}`, cost: 'The lot goes back on the market', why: E.checks.sell(s, lot) }));
      acts.push(actionButton({ act: 'demolish', thumb: plainThumb('⌫'), name: 'Tear down', cost: costLine(D.DEMOLISH.cost, 0, D.DEMOLISH.workers, D.DEMOLISH.days), why: E.checks.demolish(s, lot) }));
    } else if (lot.kind === 'special') {
      const sp = D.SPECIALS[lot.special];
      title = sp.name;
      sub = sp.blurb + '.';
    }

    card.innerHTML = `<h2>${esc(title)}</h2><p class="sub">Lot ${lot.id + 1} · ${esc(sub)}</p>
      ${facts.length ? `<dl class="facts">${facts.join('')}</dl>` : ''}
      <div class="actions">${acts.join('')}</div>`;
  }

  function renderLog() {
    $('log').innerHTML = log.slice(0, 5).map((m) => `<li><span>Day ${m.day}</span>${esc(m.text)}</li>`).join('');
  }

  function addLog(text) {
    log.unshift({ day: game.day, text });
    log = log.slice(0, 20);
    renderLog();
  }

  // ---------- frame ----------
  function render(force) {
    if (!game) return;
    if (force) { lotSigs = []; panelSig = ''; goalsSig = ''; renderLog(); }
    for (const lot of game.lots) {
      const sig = lotSig(lot);
      if (lotSigs[lot.id] !== sig) { lotSigs[lot.id] = sig; renderLot(lot); }
      updateLotProgress(lot);
    }
    renderHud();
    renderGoals();
    renderPanel();
  }

  function handleEvents() {
    const events = E.drainEvents(game);
    const won = events.some((ev) => ev.type === 'won');
    for (const ev of events) {
      if (ev.type === 'done') S.play('done');
      else if (ev.type === 'materials') S.play('mill');
      else if (ev.type === 'goal' && !won) S.play('goal');
      else if (ev.type === 'won') S.play('win');
    }
    for (const ev of events) {
      if (ev.type === 'money' && ev.lot != null) floatText(ev.lot, (ev.amount > 0 ? '+' : '') + fmt(ev.amount), ev.amount < 0);
      else if (ev.type === 'materials') floatText(ev.lot, `+${ev.amount} materials`);
      else if (ev.type === 'msg') addLog(ev.text);
      else if (ev.type === 'goal') addLog(`Goal met: ${E.goalLabel(D.LEVELS[game.level].goals[ev.index])}`);
      else if (ev.type === 'won') showWin();
    }
  }

  function frame(now) {
    const dt = Math.min(0.25, (now - last) / 1000);
    last = now;
    if (screen === 'game' && game && game.status === 'playing' && speed > 0) E.tick(game, dt * speed);
    if (screen === 'game' && game) { handleEvents(); render(); }
    requestAnimationFrame(frame);
  }

  // ---------- winning ----------
  function showWin() {
    const i = game.level;
    const L = D.LEVELS[i];
    const r = E.rating(game);
    if (progress.ratings[i] !== 'expert') progress.ratings[i] = r;
    saveProgress();
    const lastLevel = i === D.LEVELS.length - 1;
    $('modal-key').innerHTML = keySVG(r);
    $('modal-title').textContent = r === 'expert' ? 'Gold key!' : 'Street finished';
    $('modal-text').textContent = r === 'expert'
      ? `${L.name} is complete on day ${game.wonDay}, inside the expert target of day ${L.expertDays}.`
      : `${L.name} is complete on day ${game.wonDay}. Finish by day ${L.expertDays} to earn the gold key.`;
    if (lastLevel) $('modal-text').textContent += ' That was the last street. Every address in the county is yours.';
    $('modal-next').hidden = lastLevel;
    $('modal').hidden = false;
    $(lastLevel ? 'modal-menu' : 'modal-next').focus();
  }

  // ---------- input ----------
  const ACTION_SOUNDS = {
    buyLot: 'buy', build: 'hammer', buildSpecial: 'hammer', upgrade: 'hammer', demolish: 'crash', sell: 'sell',
    collect: 'coin', collectAll: 'coin', hire: 'hire', buyMaterials: 'materials',
  };

  function doAction(act, arg) {
    if (!game || game.status !== 'playing') return;
    const fn = E.actions[act];
    const res = act === 'collectAll' || act === 'hire' ? fn(game) : act === 'buyMaterials' ? fn(game, arg) : fn(game, selected, arg);
    if (!res.ok && res.reason) addLog(res.reason);
    S.play(res.ok ? ACTION_SOUNDS[act] : 'error');
    handleEvents();
    render();
  }

  function select(id) {
    selected = id;
    render();
  }

  function renderSound() {
    const on = !S.isMuted();
    const b = $('sound');
    b.setAttribute('aria-pressed', String(on));
    b.textContent = on ? '♪ Sound on' : '♪ Sound off';
    b.title = `${on ? 'Mute' : 'Unmute'} sound effects (M)`;
  }

  function toggleSound() {
    S.setMuted(!S.isMuted());
    renderSound();
    S.play('click');
  }

  function setSpeed(v) {
    speed = v;
    if (game) renderHud();
  }

  function wire() {
    $('levels').addEventListener('click', (e) => {
      const b = e.target.closest('[data-level]');
      if (b && !b.disabled) startLevel(Number(b.dataset.level));
    });
    $('resume').addEventListener('click', () => { if (game) { showScreen('game'); render(true); } });
    $('how-toggle').addEventListener('click', (e) => {
      const open = $('how').hidden;
      $('how').hidden = !open;
      e.currentTarget.setAttribute('aria-expanded', String(open));
    });
    $('reset').addEventListener('click', () => { $('reset-confirm').hidden = false; $('reset').hidden = true; });
    $('reset-no').addEventListener('click', () => { $('reset-confirm').hidden = true; $('reset').hidden = false; });
    $('reset-yes').addEventListener('click', () => {
      progress = { ratings: [] };
      saveProgress();
      game = null;
      $('reset-confirm').hidden = true;
      $('reset').hidden = false;
      renderMenu();
    });

    $('to-menu').addEventListener('click', () => showScreen('menu'));
    $('sound').addEventListener('click', toggleSound);
    renderSound();
    for (const n of [1, 10, 50]) $(`buy${n}`).addEventListener('click', () => doAction('buyMaterials', n));
    $('hire').addEventListener('click', () => doAction('hire'));
    $('collect-all').addEventListener('click', () => doAction('collectAll'));
    document.querySelector('.speed').addEventListener('click', (e) => {
      const b = e.target.closest('[data-speed]');
      if (b) setSpeed(Number(b.dataset.speed));
    });

    $('board').addEventListener('click', (e) => {
      const coin = e.target.closest('[data-collect]');
      if (coin) {
        const id = Number(coin.dataset.collect);
        E.actions.collect(game, id);
        S.play('coin');
        handleEvents();
        render();
        return;
      }
      const lot = e.target.closest('.lot');
      if (lot) { S.play('click'); select(Number(lot.dataset.lot)); }
    });
    $('board').addEventListener('keydown', (e) => {
      const lot = e.target.closest('.lot');
      if (lot && e.target === lot && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        select(Number(lot.dataset.lot));
      }
    });
    $('lot-card').addEventListener('click', (e) => {
      const buy = e.target.closest('[data-buy]');
      if (buy && !buy.disabled) { doAction('buyMaterials', Number(buy.dataset.buy)); return; }
      const b = e.target.closest('[data-act]');
      if (b && !b.disabled) doAction(b.dataset.act, b.dataset.arg || undefined);
    });

    $('modal-next').addEventListener('click', () => startLevel(game.level + 1));
    $('modal-replay').addEventListener('click', () => startLevel(game.level));
    $('modal-menu').addEventListener('click', () => { $('modal').hidden = true; showScreen('menu'); });

    document.addEventListener('keydown', (e) => {
      if (screen !== 'game' || !game || !$('modal').hidden) return;
      if (e.target.closest('input, textarea')) return;
      const onButton = e.target.closest('button, [role="button"]');
      if (e.key === ' ' && !onButton) { e.preventDefault(); setSpeed(speed === 0 ? 1 : 0); }
      else if (e.key === 'c' || e.key === 'C') doAction('collectAll');
      else if (e.key === '1' || e.key === '2' || e.key === '3') setSpeed(SPEEDS[Number(e.key)]);
      else if (e.key === 'Escape') select(null);
      else if (e.key === 'm' || e.key === 'M') toggleSound();
    });
  }

  // ---------- zoom lock ----------
  // iOS Safari ignores user-scalable=no, and trackpad pinches arrive as ctrl+wheel.
  function blockZoom() {
    const stop = (e) => e.preventDefault();
    for (const type of ['gesturestart', 'gesturechange', 'gestureend']) document.addEventListener(type, stop, { passive: false });
    document.addEventListener('touchmove', (e) => { if (e.touches.length > 1) e.preventDefault(); }, { passive: false });
    window.addEventListener('wheel', (e) => { if (e.ctrlKey) e.preventDefault(); }, { passive: false });
  }

  // ---------- boot ----------
  function boot(saved) {
    wire();
    blockZoom();
    if (saved && saved.game) {
      game = saved.game;
      speed = saved.speed ?? 1;
      log = saved.log || [];
      startLevel(game.level, game);
      selected = saved.selected ?? null;
      if (saved.screen === 'menu') showScreen('menu');
    } else {
      showScreen('menu');
    }
    requestAnimationFrame((t) => { last = t; requestAnimationFrame(frame); });
  }

  const hot = window.claude && window.claude.hot;
  if (hot && hot.snapshot) hot.snapshot(() => ({ game, speed, selected, screen, log }));
  if (hot && hot.ready) hot.ready(boot);
  else boot((hot && hot.data) || {});
})();
