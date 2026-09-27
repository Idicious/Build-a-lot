const test = require('node:test');
const assert = require('node:assert/strict');
const E = require('../js/engine.js');
const D = require('../js/data.js');
const { playLevel } = require('./bot.js');

const day = (s, n = 1) => { for (let i = 0; i < n * 10; i++) E.tick(s, D.DAY_SECONDS / 10); };

test('buying a lot spends its price and marks it owned', () => {
  const s = E.createGame(0, 1);
  const lot = s.lots.find((l) => !l.owned);
  const before = s.cash;
  assert.equal(E.actions.buyLot(s, lot.id).ok, true);
  assert.equal(lot.owned, true);
  assert.equal(s.cash, before - lot.price);
  assert.equal(E.actions.buyLot(s, lot.id).ok, false);
});

test('building uses materials and crew but no cash, then produces a rented house', () => {
  const s = E.createGame(0, 1);
  const h = D.HOUSES.rambler;
  const { cash, materials } = s;
  assert.equal(E.actions.build(s, 0, 'rambler').ok, true);
  assert.equal(s.cash, cash);
  assert.equal(s.materials, materials - h.materials);
  assert.equal(E.freeWorkers(s), s.workers - h.workers);
  day(s, h.days);
  assert.equal(s.lots[0].kind, 'house');
  assert.equal(E.freeWorkers(s), s.workers);
});

test('rent is paid into the bank automatically once a day', () => {
  const s = E.createGame(0, 1);
  E.actions.build(s, 0, 'rambler');
  day(s, 1); // construction
  const cash = s.cash;
  day(s, 1);
  assert.equal(s.cash, cash + D.HOUSES.rambler.rent);
  day(s, 4);
  assert.equal(s.cash, cash + D.HOUSES.rambler.rent * 5, 'rent keeps arriving with no cap');
  assert.equal(s.stats.rentCollected, D.HOUSES.rambler.rent * 5);
});

test('materials cost cash at the market price', () => {
  const s = E.createGame(0, 1);
  const { cash, materials, matPrice } = s;
  assert.equal(E.actions.buyMaterials(s, 10).ok, true);
  assert.equal(s.materials, materials + 10);
  assert.equal(s.cash, cash - matPrice * 10);
  s.cash = matPrice - 1;
  assert.match(E.actions.buyMaterials(s, 1).reason, /Needs \$/);
});

test('upgrades need a share of the house materials and no cash', () => {
  const s = E.createGame(1, 1); // Birch Lane has paint
  E.actions.build(s, 0, 'rambler');
  day(s, 1);
  const cash = s.cash, mats = s.materials;
  const need = E.upgradeMaterials('rambler', 'paint');
  assert.ok(need >= 1);
  assert.equal(E.actions.upgrade(s, 0, 'paint').ok, true);
  assert.equal(s.cash, cash);
  assert.equal(s.materials, mats - need);
});

test('actions are refused with a reason when resources are short', () => {
  const s = E.createGame(0, 1);
  s.materials = 10;
  const res = E.actions.build(s, 0, 'rambler');
  assert.equal(res.ok, false);
  assert.equal(res.reason, `Needs ${D.HOUSES.rambler.materials - 10} more materials`);
  assert.equal(E.actions.build(s, 0, 'mansion').ok, false, 'types outside the level are unavailable');
});

test('upgrades raise rent and sale value', () => {
  const s = E.createGame(3, 1); // Dogwood Heights: paint + yard, selling allowed
  const lot = s.lots[0];
  const rent = E.rentFor(s, lot);
  const value = E.saleValue(s, lot);
  assert.equal(E.actions.upgrade(s, lot.id, 'paint').ok, true);
  day(s, 1);
  assert.deepEqual(lot.house.upgrades, ['paint']);
  assert.ok(E.rentFor(s, lot) > rent);
  assert.ok(E.saleValue(s, lot) > value);
  assert.equal(E.actions.upgrade(s, lot.id, 'paint').ok, false);
});

test('selling returns the lot to the market', () => {
  const s = E.createGame(3, 1);
  const lot = s.lots[0];
  const value = E.saleValue(s, lot);
  const cash = s.cash;
  assert.equal(E.actions.sell(s, lot.id).ok, true);
  assert.equal(s.cash, cash + value);
  assert.equal(lot.owned, false);
  assert.equal(lot.kind, 'empty');
  assert.equal(s.stats.sold, 1);
});

test('run-down houses must be bought and torn down before building', () => {
  const s = E.createGame(2, 1);
  const lot = s.lots.find((l) => l.kind === 'rundown');
  assert.equal(E.actions.demolish(s, lot.id).ok, false);
  E.actions.buyLot(s, lot.id);
  assert.equal(E.actions.build(s, lot.id, 'rambler').ok, false);
  assert.equal(E.actions.demolish(s, lot.id).ok, true);
  day(s, 1);
  assert.equal(lot.kind, 'empty');
  assert.equal(s.stats.demolished, 1);
  assert.equal(E.actions.build(s, lot.id, 'rambler').ok, true);
});

test('parks boost neighbouring rent and mills make materials', () => {
  const s = E.createGame(4, 1); // Elm Park
  s.cash = 1e6;
  s.materials = 1e4;
  s.workers = 6;
  // Lot 0 (owned) becomes a park; lot 1 next to it gets a house.
  E.actions.buyLot(s, 1);
  E.actions.buildSpecial(s, 0, 'park');
  E.actions.build(s, 1, 'rambler');
  day(s, 2);
  assert.equal(E.parkBonus(s, s.lots[1]), D.PARK_BONUS);
  assert.equal(E.rentFor(s, s.lots[1]), Math.round(D.HOUSES.rambler.rent * (1 + D.PARK_BONUS)));
  E.actions.buildSpecial(s, 5, 'mill');
  day(s, 2);
  const mats = s.materials;
  day(s, 1);
  assert.equal(s.materials, mats + D.MILL_OUTPUT);
});

test('the material market stays inside its price band', () => {
  const s = E.createGame(0, 42);
  for (let i = 0; i < 300; i++) {
    day(s, 1);
    s.status = 'playing';
    assert.ok(s.matPrice >= D.MATERIAL_PRICE.min && s.matPrice <= D.MATERIAL_PRICE.max);
  }
});

test('the same seed replays the same market', () => {
  const a = E.createGame(0, 7), b = E.createGame(0, 7);
  day(a, 20); day(b, 20);
  assert.equal(a.matPrice, b.matPrice);
});

test('a street never starts with a goal already met', () => {
  for (const [i] of D.LEVELS.entries()) {
    const s = E.createGame(i, 1);
    E.checkGoals(s);
    assert.deepEqual(s.goalsMet, s.goalsMet.map(() => false), `street ${i + 1}`);
  }
});

test('cash goals track the balance while other goals stay met', () => {
  const s = E.createGame(1, 1); // Birch Lane: 5 houses, 2 upgrades, $12,000
  s.stats.upgrades = 2;
  s.cash = 1e6;
  E.checkGoals(s);
  assert.deepEqual(s.goalsMet, [false, true, true]);
  s.stats.upgrades = 0;
  s.cash = 0;
  E.checkGoals(s);
  assert.deepEqual(s.goalsMet, [false, true, false]);
  assert.equal(s.status, 'playing');
});

for (const [i, L] of D.LEVELS.entries()) {
  test(`street ${i + 1} (${L.name}) can be won by a simple bot`, () => {
    for (const seed of [1, 2, 3]) {
      const s = playLevel(i, seed);
      assert.equal(s.status, 'won', `seed ${seed} stalled on day ${s.day}`);
      assert.ok(s.wonDay <= L.expertDays * 1.5, `seed ${seed} took ${s.wonDay} days`);
    }
  });
}

test('every asset in index.html carries the build stamp the deploy replaces', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const root = path.join(__dirname, '..');
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /<html[^>]* data-build="__BUILD__"/);
  const local = [...html.matchAll(/(?:src|href)="((?:js|css)\/[^"]+)"/g)].map((m) => m[1]);
  assert.ok(local.length >= 6, 'found the stylesheet and scripts');
  for (const ref of local) {
    assert.match(ref, /\?v=__BUILD__$/, `${ref} needs ?v=__BUILD__`);
    assert.ok(fs.existsSync(path.join(root, ref.split('?')[0])), `${ref} exists`);
  }
  assert.match(fs.readFileSync(path.join(root, 'js/ui.js'), 'utf8'), /const BUILD = '__BUILD__';/);
});
