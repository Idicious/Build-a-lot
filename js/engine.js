/* Game rules. Pure state transitions with no DOM access, so it runs in Node for tests. */
(function (root, factory) {
  const data = typeof module === 'object' && module.exports ? require('./data.js') : root.BAL.data;
  const mod = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.BAL = Object.assign(root.BAL || {}, { engine: mod });
})(typeof self !== 'undefined' ? self : this, function (D) {
  const { HOUSES, UPGRADES, SPECIALS, LEVELS, DAY_SECONDS, HOUSE_DECAY_DAYS, TRAINING_COST } = D;

  // Seeded PRNG (mulberry32); the seed lives in state so saved games replay the same market.
  function nextRandom(state) {
    let t = (state.seed = (state.seed + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  function parseLot(code, i, perRow) {
    const lot = {
      id: i, row: i < perRow ? 0 : 1, col: i % perRow,
      owned: false, price: 0, kind: 'empty', house: null, special: null,
      task: null, rentTimer: 0, prodTimer: 0, workshopActive: false,
    };
    if (code === 'o') {
      lot.owned = true;
      lot.price = 25000;
    } else if (code[0] === 's') {
      lot.price = Number(code.slice(1));
    } else if (code[0] === 'r') {
      lot.price = Number(code.slice(1));
      lot.kind = 'rundown';
    } else if (code.startsWith('h:')) {
      lot.owned = true;
      lot.price = 25000;
      lot.kind = 'house';
      lot.house = { type: code.slice(2), upgrades: [], damaged: false, decay: 0 };
    }
    lot.basePrice = lot.price;
    return lot;
  }

  function createGame(levelIndex, seed) {
    const L = LEVELS[levelIndex];
    return {
      level: levelIndex,
      seed: (seed == null ? Math.floor(Math.random() * 2 ** 32) : seed) >>> 0,
      time: 0,
      day: 1,
      cash: L.cash,
      materials: L.materials,
      workers: L.workers,
      hired: 0,
      matPrice: D.MATERIAL_PRICE.start,
      matTrend: 0,
      workshopTraining: false,
      lots: L.lots.map((c, i) => parseLot(c, i, L.perRow)),
      stats: { built: 0, sold: 0, upgrades: 0, demolished: 0, rentCollected: 0 },
      goalsMet: L.goals.map(() => false),
      status: 'playing',
      wonDay: null,
      events: [],
    };
  }

  const level = (s) => LEVELS[s.level];
  const busyWorkers = (s) => s.lots.reduce((n, l) => n + (l.task ? l.task.workers : 0), 0);
  const freeWorkers = (s) => s.workers - busyWorkers(s);
  const hasSpecial = (s, type) => s.lots.some((l) => l.kind === 'special' && l.special === type);
  const hasWorkshop = (s) => hasSpecial(s, 'workshop');
  const buildSpeed = (s) => (hasWorkshop(s) && s.workshopTraining ? D.WORKSHOP_SPEED : 1);
  const hireCost = (s) => {
    const standard = D.HIRE_BASE + D.HIRE_STEP * s.hired;
    return hasWorkshop(s) ? Math.round(standard / 2) : standard;
  };
  const upgradeMaterials = (type, key) => Math.max(1, Math.round(HOUSES[type].materials * UPGRADES[key].matPct));

  function neighbours(s, lot) {
    return s.lots.filter(
      (o) => (o.row === lot.row && Math.abs(o.col - lot.col) === 1) || (o.row !== lot.row && o.col === lot.col)
    );
  }

  function parkBonus(s, lot) {
    const parks = neighbours(s, lot).filter((o) => o.kind === 'special' && o.special === 'park').length;
    return Math.min(parks, 2) * D.PARK_BONUS;
  }

  function rentFor(s, lot) {
    if (lot.kind !== 'house') return 0;
    if (lot.house.damaged) return 0;
    const h = HOUSES[lot.house.type];
    const bonus = lot.house.upgrades.reduce((b, k) => b + UPGRADES[k].rentBonus, 0) + parkBonus(s, lot);
    return Math.round(h.rent * (1 + bonus));
  }

  function saleValue(s, lot) {
    if (lot.kind !== 'house') return 0;
    const h = HOUSES[lot.house.type];
    const bonus = lot.house.upgrades.reduce((b, k) => b + UPGRADES[k].valueBonus, 0);
    return Math.round((h.value * (1 + bonus) + lot.basePrice) / 50) * 50;
  }

  // ---- Checks: each returns null when allowed, otherwise a reason for the player. ----

  function needs(s, cost, materials, workers) {
    if (s.cash < cost) return `Needs $${cost.toLocaleString('en-US')}`;
    if (s.materials < materials) return `Needs ${materials - s.materials} more materials`;
    if (freeWorkers(s) < workers) return `Needs ${workers} free worker${workers > 1 ? 's' : ''}`;
    return null;
  }

  function idle(lot) {
    if (lot.task) return 'Crew is working here';
    return null;
  }

  function checkBuyLot(s, lot) {
    if (lot.owned) return 'Already yours';
    if (s.cash < lot.price) return `Needs $${lot.price.toLocaleString('en-US')}`;
    return null;
  }

  function checkBuild(s, lot, type) {
    if (!level(s).houses.includes(type)) return 'Not available here';
    if (!lot.owned) return 'Buy the lot first';
    if (lot.kind !== 'empty') return 'Lot is not empty';
    const h = HOUSES[type];
    return idle(lot) || needs(s, 0, h.materials, h.workers);
  }

  function checkSpecial(s, lot, type) {
    if (!level(s).specials.includes(type)) return 'Not available here';
    if (!lot.owned) return 'Buy the lot first';
    if (lot.kind !== 'empty') return 'Lot is not empty';
    if (type === 'workshop' && s.lots.some((l) => l.special === 'workshop')) return 'Only one workshop';
    const sp = SPECIALS[type];
    return idle(lot) || needs(s, 0, sp.materials, sp.workers);
  }

  function checkUpgrade(s, lot, key) {
    if (!level(s).upgrades.includes(key)) return 'Not available here';
    if (lot.kind !== 'house') return 'No house here';
    if (lot.house.upgrades.includes(key)) return 'Already done';
    return idle(lot) || needs(s, 0, upgradeMaterials(lot.house.type, key), UPGRADES[key].workers);
  }

  function checkDemolish(s, lot) {
    if (lot.kind !== 'rundown' && lot.kind !== 'house') return 'Nothing to tear down';
    if (!lot.owned) return 'Buy the lot first';
    return idle(lot) || needs(s, D.DEMOLISH.cost, 0, D.DEMOLISH.workers);
  }

  function checkSell(s, lot) {
    if (!level(s).canSell) return 'Selling unlocks later';
    if (lot.kind !== 'house') return 'No house here';
    return idle(lot);
  }

  function checkHire(s) {
    if (s.workers >= level(s).maxWorkers) return 'Crew is at full size';
    if (s.cash < hireCost(s)) return `Needs $${hireCost(s).toLocaleString('en-US')}`;
    return null;
  }

  function checkMaterials(s, n) {
    const cost = s.matPrice * n;
    if (s.cash < cost) return `Needs $${cost.toLocaleString('en-US')}`;
    return null;
  }

  function checkTrain(s) {
    if (!hasWorkshop(s)) return 'Build a workshop first';
    if (s.workshopTraining) return 'Efficiency Training is already active';
    if (s.cash < TRAINING_COST) return `Needs $${TRAINING_COST.toLocaleString('en-US')}`;
    return null;
  }

  function checkInspect(s, lot) {
    if (lot.kind !== 'house') return 'No house here';
    if (!lot.house.damaged && lot.house.decay < HOUSE_DECAY_DAYS * 0.5) return 'This house is in good condition';
    return null;
  }

  // ---- Actions: mutate state and return { ok, reason }. ----

  function act(reason, apply) {
    if (reason) return { ok: false, reason };
    apply();
    return { ok: true };
  }

  function startTask(s, lot, task) {
    lot.task = Object.assign({ progress: 0 }, task);
  }

  function spend(s, cost, materials) {
    s.cash -= cost;
    s.materials -= materials;
    if (cost) s.events.push({ type: 'money', lot: null, amount: -cost });
  }

  const actions = {
    buyLot(s, id) {
      const lot = s.lots[id];
      return act(checkBuyLot(s, lot), () => {
        spend(s, lot.price, 0);
        lot.owned = true;
      });
    },
    build(s, id, type) {
      const lot = s.lots[id];
      return act(checkBuild(s, lot, type), () => {
        const h = HOUSES[type];
        spend(s, 0, h.materials);
        startTask(s, lot, { kind: 'build', type, days: h.days, workers: h.workers });
      });
    },
    buildSpecial(s, id, type) {
      const lot = s.lots[id];
      return act(checkSpecial(s, lot, type), () => {
        const sp = SPECIALS[type];
        spend(s, 0, sp.materials);
        startTask(s, lot, { kind: 'special', type, days: sp.days, workers: sp.workers });
      });
    },
    upgrade(s, id, key) {
      const lot = s.lots[id];
      return act(checkUpgrade(s, lot, key), () => {
        const u = UPGRADES[key];
        spend(s, 0, upgradeMaterials(lot.house.type, key));
        lot.house.decay = 0;
        lot.house.damaged = false;
        startTask(s, lot, { kind: 'upgrade', type: key, days: u.days, workers: u.workers });
      });
    },
    demolish(s, id) {
      const lot = s.lots[id];
      return act(checkDemolish(s, lot), () => {
        spend(s, D.DEMOLISH.cost, 0);
        startTask(s, lot, { kind: 'demolish', days: D.DEMOLISH.days, workers: D.DEMOLISH.workers });
      });
    },
    sell(s, id) {
      const lot = s.lots[id];
      return act(checkSell(s, lot), () => {
        const value = saleValue(s, lot);
        s.cash += value;
        s.stats.sold++;
        s.events.push({ type: 'money', lot: id, amount: value });
        s.events.push({ type: 'msg', text: `Sold the ${HOUSES[lot.house.type].name} for $${value.toLocaleString('en-US')}` });
        Object.assign(lot, { owned: false, kind: 'empty', house: null, price: lot.basePrice, rentTimer: 0 });
      });
    },
    hire(s) {
      return act(checkHire(s), () => {
        spend(s, hireCost(s), 0);
        s.workers++;
        s.hired++;
      });
    },
    buyMaterials(s, n) {
      return act(checkMaterials(s, n), () => {
        spend(s, s.matPrice * n, -n);
      });
    },
    train(s) {
      return act(checkTrain(s), () => {
        spend(s, TRAINING_COST, 0);
        s.workshopTraining = true;
        for (const lot of s.lots) {
          if (lot.kind === 'special' && lot.special === 'workshop') lot.workshopActive = true;
        }
        s.events.push({ type: 'msg', text: 'Efficiency Training is active: all work is now 2× faster' });
      });
    },
    inspect(s, id) {
      const lot = s.lots[id];
      return act(checkInspect(s, lot), () => {
        lot.house.damaged = false;
        lot.house.decay = 0;
        s.events.push({ type: 'msg', text: `${HOUSES[lot.house.type].name} inspected and repaired` });
      });
    },
  };

  function finishTask(s, lot) {
    const t = lot.task;
    lot.task = null;
    if (t.kind === 'build') {
      lot.kind = 'house';
      lot.house = { type: t.type, upgrades: [], damaged: false, decay: 0 };
      lot.rentTimer = 0;
      s.stats.built++;
      s.events.push({ type: 'msg', text: `Tenants moved into your new ${HOUSES[t.type].name}` });
    } else if (t.kind === 'special') {
      lot.kind = 'special';
      lot.special = t.type;
      lot.workshopActive = false;
      lot.prodTimer = 0;
      s.events.push({ type: 'msg', text: `${SPECIALS[t.type].name} is open` });
    } else if (t.kind === 'upgrade') {
      lot.house.upgrades.push(t.type);
      lot.house.decay = 0;
      lot.house.damaged = false;
      s.stats.upgrades++;
      s.events.push({ type: 'msg', text: `${UPGRADES[t.type].name} finished` });
    } else if (t.kind === 'demolish') {
      if (lot.kind === 'rundown') s.stats.demolished++;
      lot.kind = 'empty';
      lot.house = null;
      s.events.push({ type: 'msg', text: 'Lot cleared and ready to build' });
    }
    s.events.push({ type: 'done', lot: lot.id });
  }

  function newDay(s) {
    s.day++;
    const { min, max } = D.MATERIAL_PRICE;
    const drift = Math.round((nextRandom(s) - 0.5) * 30);
    const pull = Math.round((D.MATERIAL_PRICE.start - s.matPrice) * 0.15);
    const next = Math.max(min, Math.min(max, s.matPrice + drift + pull));
    s.matTrend = Math.sign(next - s.matPrice);
    s.matPrice = next;
  }

  function goalProgress(s, g) {
    let current = 0;
    const houses = s.lots.filter((l) => l.kind === 'house');
    switch (g.kind) {
      case 'cash': current = s.cash; break;
      case 'houses': current = houses.length; break;
      case 'houseType': current = houses.filter((l) => l.house.type === g.type).length; break;
      case 'upgrades': current = s.stats.upgrades; break;
      case 'sold': current = s.stats.sold; break;
      case 'rent': current = s.stats.rentCollected; break;
      case 'demolish': current = s.stats.demolished; break;
      case 'special': current = s.lots.filter((l) => l.kind === 'special' && l.special === g.type).length; break;
    }
    return { current, target: g.target, done: current >= g.target };
  }

  function goalLabel(g) {
    const n = g.target.toLocaleString('en-US');
    switch (g.kind) {
      case 'cash': return `Have $${n} in the bank`;
      case 'houses': return `Own ${n} houses`;
      case 'houseType': return `Own ${n} ${HOUSES[g.type].name}${g.target > 1 ? 's' : ''}`;
      case 'upgrades': return `Finish ${n} upgrades`;
      case 'sold': return `Sell ${n} houses`;
      case 'rent': return `Collect $${n} in rent`;
      case 'demolish': return `Tear down ${n} old houses`;
      case 'special': return `Open ${n} ${SPECIALS[g.type].name}${g.target > 1 ? 's' : ''}`;
    }
    return '';
  }

  function checkGoals(s) {
    // Cash goals track the live balance; every other goal stays ticked once reached.
    level(s).goals.forEach((g, i) => {
      const done = goalProgress(s, g).done;
      if (g.kind === 'cash' && !done) s.goalsMet[i] = false;
      else if (!s.goalsMet[i] && done) {
        s.goalsMet[i] = true;
        s.events.push({ type: 'goal', index: i });
      }
    });
    if (s.status === 'playing' && s.goalsMet.every(Boolean)) {
      s.status = 'won';
      s.wonDay = s.day;
      s.events.push({ type: 'won' });
    }
  }

  function rating(s) {
    if (s.status !== 'won') return null;
    return s.wonDay <= level(s).expertDays ? 'expert' : 'complete';
  }

  const EPS = 1e-9; // absorbs float drift so a 1-day job ends after exactly 1 day

  // Advance the simulation by dt seconds of game time.
  function tick(s, dt) {
    if (s.status !== 'playing') return;
    const dayDelta = dt / DAY_SECONDS;
    const speed = buildSpeed(s);
    s.time += dt;
    while (s.time >= s.day * DAY_SECONDS - EPS) newDay(s);

    for (const lot of s.lots) {
      if (lot.task) {
        lot.task.progress += (dayDelta * speed) / lot.task.days;
        if (lot.task.progress >= 1 - EPS) finishTask(s, lot);
      } else if (lot.kind === 'house') {
        if (lot.house.damaged) {
          // damaged houses earn no rent until repaired
        } else {
          lot.house.decay += dayDelta;
          if (lot.house.decay >= HOUSE_DECAY_DAYS - EPS) {
            lot.house.damaged = true;
            lot.house.decay = HOUSE_DECAY_DAYS;
            s.events.push({ type: 'msg', text: `${HOUSES[lot.house.type].name} has become damaged and is no longer earning rent` });
          }
          lot.rentTimer += dayDelta;
          if (lot.rentTimer >= 1 - EPS) {
            lot.rentTimer -= 1;
            const r = rentFor(s, lot);
            s.cash += r;
            s.stats.rentCollected += r;
            s.events.push({ type: 'money', lot: lot.id, amount: r });
            s.events.push({ type: 'rent', lot: lot.id });
          }
        }
      } else if (lot.kind === 'special' && lot.special === 'mill') {
        lot.prodTimer += dayDelta;
        if (lot.prodTimer >= 1 - EPS) {
          lot.prodTimer -= 1;
          s.materials += D.MILL_OUTPUT;
          s.events.push({ type: 'materials', lot: lot.id, amount: D.MILL_OUTPUT });
        }
      }
    }
    checkGoals(s);
  }

  function drainEvents(s) {
    const ev = s.events;
    s.events = [];
    return ev;
  }

  return {
    createGame, tick, actions, drainEvents, rating,
    freeWorkers, busyWorkers, hireCost, upgradeMaterials, rentFor, saleValue, parkBonus, neighbours, hasSpecial,
    goalProgress, goalLabel, checkGoals, hasWorkshop,
    checks: { buyLot: checkBuyLot, build: checkBuild, special: checkSpecial, upgrade: checkUpgrade, demolish: checkDemolish, sell: checkSell, hire: checkHire, materials: checkMaterials, train: checkTrain, inspect: checkInspect },
  };
});
