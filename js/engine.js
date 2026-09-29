/* Game rules. Pure state transitions with no DOM access, so it runs in Node for tests. */
(function (root, factory) {
  const data = typeof module === 'object' && module.exports ? require('./data.js') : root.BAL.data;
  const mod = factory(data);
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.BAL = Object.assign(root.BAL || {}, { engine: mod });
})(typeof self !== 'undefined' ? self : this, function (D) {
  const { HOUSES, UPGRADES, SPECIALS, LEVELS, DAY_SECONDS } = D;

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
      task: null, rentTimer: 0, prodTimer: 0,
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
      lot.house = { type: code.slice(2), upgrades: [] };
    }
    lot.basePrice = lot.price;
    return lot;
  }
