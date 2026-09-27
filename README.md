# Lot by Lot

A browser neighbourhood-building game in the style of the classic *Build-a-lot* time-management games. Buy lots, build houses, collect rent, and turn eight streets into the best addresses in the county.

All art is drawn procedurally as SVG. There are no image assets, no dependencies and no build step.

## Play

Open `index.html` in a browser, or serve the folder:

```sh
npm start   # python3 -m http.server 8000, then visit http://localhost:8000
```

## How it plays

- **Money, materials, crew.** Building costs no money: houses, upgrades and neighbourhood buildings are paid for in building materials and crew time. You buy the materials with cash at a market price that moves every day, so buying when the price is low pays off. Cash also buys lots and hires crew.
- **Rent.** Houses are rented as soon as they are built. Tenants pay once a day. Click the gold coin to bank the rent. Unpaid rent stops piling up after 3 days.
- **Houses.** Rambler, Cottage, Colonial, Victorian, Craftsman and Mansion, each costing more and paying more rent.
- **Upgrades.** Fresh paint, landscaping and a front porch raise rent and resale value.
- **Selling and demolition.** Sell a house together with its lot for a profit, tear down run-down shacks, or clear your own house to rebuild bigger.
- **Neighbourhood buildings.** A Pocket Park adds +20% rent to the houses next to it and across the street. A Lumber Mill makes materials every day. A Workshop speeds up all construction.
- **Eight streets.** Each street has its own goals. Finish them and the next street unlocks. Finish by the street's Expert day to earn a gold key. Your progress is saved in the browser.

Keys: `Space` pause, `C` collect all rent, `1`–`3` game speed, `Esc` deselect.

## Code

| File | Role |
| --- | --- |
| `js/data.js` | Buildings, upgrades, balance constants and level definitions |
| `js/engine.js` | Game rules as pure state transitions (no DOM), so they run in Node |
| `js/art.js` | Procedural SVG for lots, houses and neighbourhood buildings |
| `js/ui.js` | Menus, HUD, board rendering and input |
| `tests/` | Engine tests, plus a greedy bot that must win every street |

```sh
npm test
```

The bot tests guard the level balance: every street must be winnable with three different market seeds, within 1.5× the Expert day target.
