/* Static game content: buildings, upgrades and level definitions. */
(function (root, factory) {
  const mod = factory();
  if (typeof module === 'object' && module.exports) module.exports = mod;
  else root.BAL = Object.assign(root.BAL || {}, { data: mod });
})(typeof self !== 'undefined' ? self : this, function () {
  // Real seconds in one in-game day at 1x speed.
  const DAY_SECONDS = 12;

  // Construction is paid for in materials only; materials are bought with cash.
  // Rent is paid once per day; value is what the house (without the lot) sells for.
  const HOUSES = {
    rambler:   { name: 'Rambler',   materials: 16,  workers: 1, days: 1,   rent: 200,  value: 2400 },
    cottage:   { name: 'Cottage',   materials: 35,  workers: 1, days: 1.5, rent: 420,  value: 5000 },
    colonial:  { name: 'Colonial',  materials: 70,  workers: 2, days: 2,   rent: 800,  value: 10000 },
    victorian: { name: 'Victorian', materials: 130, workers: 2, days: 2.5, rent: 1400, value: 18500 },
    craftsman: { name: 'Craftsman', materials: 210, workers: 3, days: 3,   rent: 2200, value: 31000 },
    mansion:   { name: 'Mansion',   materials: 380, workers: 4, days: 4,   rent: 3800, value: 56000 },
  };

  // An upgrade needs a share of the materials that went into the house.
  const UPGRADES = {
    paint: { name: 'Fresh paint', matPct: 0.08, workers: 1, days: 0.5, rentBonus: 0.10, valueBonus: 0.08 },
    yard:  { name: 'Landscaping', matPct: 0.15, workers: 1, days: 1,   rentBonus: 0.20, valueBonus: 0.14 },
    porch: { name: 'Front porch', matPct: 0.25, workers: 2, days: 1.5, rentBonus: 0.30, valueBonus: 0.22 },
  };

  const SPECIALS = {
    park:     { name: 'Pocket Park', materials: 36, workers: 1, days: 1, blurb: '+20% rent for neighbouring houses' },
    mill:     { name: 'Lumber Mill', materials: 50, workers: 2, days: 2, blurb: '+4 materials every day' },
    workshop: { name: 'Workshop',    materials: 60, workers: 2, days: 2, blurb: 'All construction 30% faster' },
  };

  const DEMOLISH = { cost: 300, workers: 1, days: 0.75 };
  const HIRE_BASE = 600;
  const HIRE_STEP = 400;
  const PARK_BONUS = 0.2;
  const MILL_OUTPUT = 4;
  const WORKSHOP_SPEED = 1 / 0.7;
  const MATERIAL_PRICE = { start: 100, min: 60, max: 150 };

  // Lot codes: 'o' owned empty lot, 'sN' empty lot for sale at $N,
  // 'rN' run-down house for sale at $N (buy, then demolish),
  // 'h:type' owned, rented house of that type.
  const LEVELS = [
    {
      name: 'Maple Court', perRow: 3,
      intro: 'A quiet cul-de-sac to learn the trade. Build houses, and tenants move in on their own.',
      lots: ['o', 'o', 's900', 's900', 's1000', 's1100'],
      cash: 4000, materials: 20, workers: 2, maxWorkers: 3,
      houses: ['rambler', 'cottage'], upgrades: [], specials: [], canSell: false,
      goals: [{ kind: 'houses', target: 4 }, { kind: 'cash', target: 5000 }],
      expertDays: 16,
    },
    {
      name: 'Birch Lane', perRow: 4,
      intro: 'Tenants love a fresh coat of paint. Upgraded houses earn more rent.',
      lots: ['o', 's1000', 's1000', 's1200', 's1200', 'o', 's1300', 's1400'],
      cash: 4500, materials: 20, workers: 2, maxWorkers: 4,
      houses: ['rambler', 'cottage'], upgrades: ['paint'], specials: [], canSell: false,
      goals: [{ kind: 'houses', target: 5 }, { kind: 'upgrades', target: 2 }, { kind: 'cash', target: 12000 }],
      expertDays: 23,
    },
    {
      name: 'Cedar Hollow', perRow: 4,
      intro: 'Old shacks line the street. Buy them cheap, tear them down, and build fresh.',
      lots: ['r500', 'o', 'r500', 's1500', 's1500', 'r600', 'o', 'r700'],
      cash: 6000, materials: 25, workers: 3, maxWorkers: 5,
      houses: ['rambler', 'cottage', 'colonial'], upgrades: ['paint'], specials: [], canSell: false,
      goals: [{ kind: 'demolish', target: 3 }, { kind: 'houseType', type: 'colonial', target: 2 }, { kind: 'cash', target: 15000 }],
      expertDays: 24,
    },
    {
      name: 'Dogwood Heights', perRow: 5,
      intro: 'Buyers are looking. Improve a house, then sell it for a profit.',
      lots: ['h:rambler', 'o', 's1500', 's1500', 'r800', 'h:cottage', 's1600', 'r800', 's1800', 'o'],
      cash: 5000, materials: 25, workers: 3, maxWorkers: 5,
      houses: ['rambler', 'cottage', 'colonial'], upgrades: ['paint', 'yard'], specials: [], canSell: true,
      goals: [{ kind: 'sold', target: 3 }, { kind: 'cash', target: 25000 }],
      expertDays: 21,
    },
    {
      name: 'Elm Park', perRow: 5,
      intro: 'Parks lift rents next door, and a lumber mill ends your trips to the market.',
      lots: ['o', 's2000', 'r900', 's2000', 's2200', 'o', 's2000', 's2200', 'r1000', 's2400'],
      cash: 9000, materials: 30, workers: 3, maxWorkers: 6,
      houses: ['rambler', 'cottage', 'colonial', 'victorian'], upgrades: ['paint', 'yard'], specials: ['park', 'mill'], canSell: true,
      goals: [{ kind: 'special', type: 'park', target: 1 }, { kind: 'houseType', type: 'victorian', target: 2 }, { kind: 'cash', target: 35000 }],
      expertDays: 36,
    },
    {
      name: 'Foxglove Ridge', perRow: 6,
      intro: 'A workshop speeds up every crew. Porches make any house a favourite.',
      lots: ['o', 's2200', 's2200', 'r1000', 's2400', 's2600', 'h:cottage', 's2200', 'r1100', 's2400', 'o', 's2800'],
      cash: 10000, materials: 30, workers: 4, maxWorkers: 7,
      houses: ['rambler', 'cottage', 'colonial', 'victorian'], upgrades: ['paint', 'yard', 'porch'], specials: ['park', 'mill', 'workshop'], canSell: true,
      goals: [{ kind: 'houses', target: 8 }, { kind: 'upgrades', target: 8 }, { kind: 'cash', target: 50000 }],
      expertDays: 28,
    },
    {
      name: 'Garnet Bay', perRow: 6,
      intro: 'Waterfront lots draw a better class of tenant. Craftsman homes are in demand.',
      lots: ['o', 's3000', 's3000', 's3200', 'r1500', 's3400', 'h:colonial', 's3000', 'r1500', 's3200', 's3400', 'o'],
      cash: 14000, materials: 40, workers: 4, maxWorkers: 8,
      houses: ['cottage', 'colonial', 'victorian', 'craftsman'], upgrades: ['paint', 'yard', 'porch'], specials: ['park', 'mill', 'workshop'], canSell: true,
      goals: [{ kind: 'houseType', type: 'craftsman', target: 3 }, { kind: 'rent', target: 40000 }, { kind: 'cash', target: 80000 }],
      expertDays: 33,
    },
    {
      name: 'Hillcrest Estates', perRow: 7,
      intro: 'The finest address in the county. Build mansions and fill every lot.',
      lots: ['o', 's4000', 's4000', 'r2000', 's4200', 's4400', 's4600', 'h:colonial', 's4000', 'r2000', 's4200', 's4400', 'o', 's4800'],
      cash: 20000, materials: 50, workers: 5, maxWorkers: 9,
      houses: ['cottage', 'colonial', 'victorian', 'craftsman', 'mansion'], upgrades: ['paint', 'yard', 'porch'], specials: ['park', 'mill', 'workshop'], canSell: true,
      goals: [{ kind: 'houseType', type: 'mansion', target: 2 }, { kind: 'houses', target: 12 }, { kind: 'cash', target: 150000 }],
      expertDays: 44,
    },
  ];

  return {
    DAY_SECONDS, HOUSES, UPGRADES, SPECIALS, DEMOLISH, HIRE_BASE, HIRE_STEP,
    PARK_BONUS, MILL_OUTPUT, WORKSHOP_SPEED, MATERIAL_PRICE, LEVELS,
  };
});
