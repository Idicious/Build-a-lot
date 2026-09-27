/* Procedural SVG art for lots, houses and neighbourhood buildings. Every drawing uses a 160x120 viewBox. */
(function (root) {
  const W = 160;
  const GROUND = 104; // y of the front edge of the house footprint

  // Base and repainted wall colours per house type.
  const STYLE = {
    rambler:   { w: 96, h: 30, wall: '#c9b79a', paint: '#8fb3c9', roof: '#6b4f3f', trim: '#f4efe6' },
    cottage:   { w: 72, h: 34, wall: '#d8c7a6', paint: '#e6a6a0', roof: '#4f5e6b', trim: '#fbf7ee' },
    colonial:  { w: 92, h: 56, wall: '#b9a38e', paint: '#e4dccb', roof: '#3f4a55', trim: '#ffffff' },
    victorian: { w: 86, h: 58, wall: '#9fb0a0', paint: '#b8a1c9', roof: '#5a3d52', trim: '#fff7e8' },
    craftsman: { w: 100, h: 44, wall: '#a88e6c', paint: '#7f9a78', roof: '#5b4636', trim: '#f1e8d4' },
    mansion:   { w: 132, h: 62, wall: '#d6cab6', paint: '#f2ece0', roof: '#39424c', trim: '#ffffff' },
  };

  const r = (x, y, w, h, fill, extra = '') => `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${fill}" ${extra}/>`;
  const poly = (pts, fill, extra = '') => `<polygon points="${pts}" fill="${fill}" ${extra}/>`;

  function windowAt(x, y, w, h, trim, shutters) {
    let s = r(x - 1.5, y - 1.5, w + 3, h + 3, trim) + r(x, y, w, h, '#7fa4bf') + r(x, y, w, h / 2.4, '#a9c6da');
    s += `<line x1="${x + w / 2}" y1="${y}" x2="${x + w / 2}" y2="${y + h}" stroke="${trim}" stroke-width="1"/>`;
    if (shutters) s += r(x - 5, y - 1, 3, h + 2, shutters) + r(x + w + 2, y - 1, 3, h + 2, shutters);
    return s;
  }

  function door(x, y, h, trim, color = '#7a3b2e') {
    return r(x - 1.5, y - 1.5, 12, h + 1.5, trim) + r(x, y, 9, h, color) + `<circle cx="${x + 7}" cy="${y + h / 2}" r="0.9" fill="#e8c35a"/>`;
  }

  function gable(x, y, w, rise, fill, over = 5) {
    return poly(`${x - over},${y} ${x + w / 2},${y - rise} ${x + w + over},${y}`, fill);
  }

  function chimney(x, y, h, fill = '#8c4a3a') {
    return r(x, y - h, 7, h, fill) + r(x - 1, y - h - 2, 9, 3, '#6d3a2e');
  }

  // Core body of each house type, drawn with its front edge on GROUND.
  const BODY = {
    rambler(c, wall) {
      const x = (W - c.w) / 2, y = GROUND - c.h;
      return gable(x, y, c.w, 16, c.roof, 6) + r(x, y, c.w, c.h, wall) +
        windowAt(x + 10, y + 9, 14, 11, c.trim) + windowAt(x + 30, y + 9, 14, 11, c.trim) +
        door(x + 55, y + 10, c.h - 10, c.trim) + r(x + 70, y + 6, 22, c.h - 6, '#e9e4da') +
        `<g stroke="#cfc8ba" stroke-width="1">${[0, 1, 2, 3].map((i) => `<line x1="${x + 70}" y1="${y + 10 + i * 5}" x2="${x + 92}" y2="${y + 10 + i * 5}"/>`).join('')}</g>`;
    },
    cottage(c, wall) {
      const x = (W - c.w) / 2, y = GROUND - c.h;
      return chimney(x + c.w - 18, y - 12, 18) + gable(x, y, c.w, 30, c.roof, 5) + r(x, y, c.w, c.h, wall) +
        poly(`${x + c.w / 2 - 10},${y - 6} ${x + c.w / 2},${y - 16} ${x + c.w / 2 + 10},${y - 6}`, c.trim) +
        windowAt(x + c.w / 2 - 5, y - 10, 10, 7, c.trim) +
        windowAt(x + 9, y + 10, 13, 12, c.trim) + windowAt(x + c.w - 22, y + 10, 13, 12, c.trim) +
        door(x + c.w / 2 - 4.5, y + 12, c.h - 12, c.trim, '#3f6e5a');
    },
    colonial(c, wall) {
      const x = (W - c.w) / 2, y = GROUND - c.h;
      const sh = '#2f3d4a';
      let s = chimney(x + 8, y - 4, 14) + chimney(x + c.w - 15, y - 4, 14) + poly(`${x - 4},${y} ${x + 10},${y - 18} ${x + c.w - 10},${y - 18} ${x + c.w + 4},${y}`, c.roof) + r(x, y, c.w, c.h, wall);
      for (const wx of [x + 12, x + 36, x + 66]) s += windowAt(wx, y + 7, 12, 14, c.trim, sh);
      for (const wx of [x + 12, x + 66]) s += windowAt(wx, y + 32, 12, 14, c.trim, sh);
      s += poly(`${x + 36},${y + 30} ${x + 46},${y + 24} ${x + 56},${y + 30}`, c.trim) + door(x + 41.5, y + 31, c.h - 31, c.trim, '#1f3b57');
      return s;
    },
    victorian(c, wall) {
      const x = (W - c.w) / 2 + 8, y = GROUND - c.h;
      const tx = x - 20, tw = 26;
      let s = gable(x, y, c.w, 26, c.roof, 4) + r(x, y, c.w, c.h, wall);
      s += poly(`${x + c.w - 40},${y} ${x + c.w - 22},${y - 20} ${x + c.w - 4},${y}`, c.trim) + windowAt(x + c.w - 27, y - 11, 10, 9, wall);
      s += r(tx, y - 8, tw, c.h + 8, wall) + poly(`${tx - 3},${y - 8} ${tx + tw / 2},${y - 38} ${tx + tw + 3},${y - 8}`, c.roof) +
        `<line x1="${tx + tw / 2}" y1="${y - 38}" x2="${tx + tw / 2}" y2="${y - 45}" stroke="${c.roof}" stroke-width="1.5"/>`;
      s += windowAt(tx + 8, y + 2, 10, 14, c.trim) + windowAt(tx + 8, y + 30, 10, 14, c.trim);
      s += windowAt(x + 14, y + 7, 12, 15, c.trim) + windowAt(x + c.w - 30, y + 7, 12, 15, c.trim) + windowAt(x + 14, y + 33, 12, 15, c.trim);
      s += door(x + c.w - 30, y + 33, c.h - 33, c.trim, '#6a2f45');
      s += `<g stroke="${c.trim}" stroke-width="1.2">${[0, 1, 2, 3, 4, 5].map((i) => `<line x1="${x + 4 + i * 5}" y1="${y + 1}" x2="${x + 6 + i * 5}" y2="${y + 4}"/>`).join('')}</g>`;
      return s;
    },
    craftsman(c, wall) {
      const x = (W - c.w) / 2, y = GROUND - c.h;
      let s = chimney(x + 6, y - 2, 20, '#7d5a44') + poly(`${x - 8},${y + 4} ${x + c.w / 2},${y - 22} ${x + c.w + 8},${y + 4}`, c.roof) + r(x, y + 4, c.w, c.h - 4, wall);
      s += poly(`${x + 26},${y + 2} ${x + c.w / 2},${y - 12} ${x + c.w - 26},${y + 2}`, c.trim) + windowAt(x + c.w / 2 - 9, y - 5, 18, 6, c.trim);
      s += r(x - 4, y + 16, c.w + 8, 4, c.roof);
      s += windowAt(x + 10, y + 25, 22, 12, c.trim) + windowAt(x + c.w - 32, y + 25, 22, 12, c.trim) + door(x + c.w / 2 - 4.5, y + 24, c.h - 24, c.trim, '#5a3b24');
      for (const px of [x + 2, x + 38, x + c.w - 44, x + c.w - 8]) s += poly(`${px},${GROUND} ${px + 6},${GROUND} ${px + 5},${y + 20} ${px + 1},${y + 20}`, c.trim);
      return s;
    },
    mansion(c, wall) {
      const x = (W - c.w) / 2, y = GROUND - c.h;
      const cw = 52, cx = x + (c.w - cw) / 2;
      let s = '';
      for (const wx of [x, x + c.w - 40]) {
        s += poly(`${wx - 3},${y + 24} ${wx + 6},${y + 12} ${wx + 34},${y + 12} ${wx + 43},${y + 24}`, c.roof) + r(wx, y + 24, 40, c.h - 24, wall);
        s += windowAt(wx + 8, y + 32, 9, 14, c.trim) + windowAt(wx + 23, y + 32, 9, 14, c.trim);
      }
      s += chimney(cx + 6, y - 6, 12) + chimney(cx + cw - 13, y - 6, 12);
      s += poly(`${cx - 4},${y} ${cx + 8},${y - 16} ${cx + cw - 8},${y - 16} ${cx + cw + 4},${y}`, c.roof) + r(cx, y, cw, c.h, wall);
      s += windowAt(cx + 8, y + 7, 10, 13, c.trim) + windowAt(cx + 21, y + 7, 10, 13, c.trim) + windowAt(cx + 34, y + 7, 10, 13, c.trim);
      s += poly(`${cx + 10},${y + 28} ${cx + cw / 2},${y + 18} ${cx + cw - 10},${y + 28}`, c.trim) + r(cx + 10, y + 28, cw - 20, 2, c.trim);
      for (const px of [cx + 11, cx + 18, cx + cw - 21, cx + cw - 14]) s += r(px, y + 30, 3, c.h - 30, c.trim);
      s += door(cx + cw / 2 - 4.5, y + 38, c.h - 38, c.trim, '#27313b');
      return s;
    },
  };

  function porch(c) {
    const x = (W - c.w) / 2 - 4, w = c.w + 8, y = GROUND - 20;
    let s = r(x, GROUND - 3, w, 5, '#b99a76') + r(x - 2, y - 3, w + 4, 4, c.roof);
    for (let i = 0; i <= 6; i++) s += r(x + (i * (w - 3)) / 6, y, 3, 17, c.trim);
    s += `<line x1="${x}" y1="${GROUND - 9}" x2="${x + w}" y2="${GROUND - 9}" stroke="${c.trim}" stroke-width="1.5"/>`;
    return s;
  }

  function yard(c) {
    const left = (W - c.w) / 2 - 6, right = (W + c.w) / 2 + 6;
    let s = '';
    for (const bx of [left, left + 10, right - 10, right]) s += `<ellipse cx="${bx}" cy="${GROUND - 2}" rx="7" ry="6" fill="#3f7d3a"/><ellipse cx="${bx - 2}" cy="${GROUND - 4}" rx="3.5" ry="3" fill="#5a9c4c"/>`;
    const flowers = ['#e86a8a', '#f2c14e', '#ffffff', '#b37fe0'];
    for (let i = 0; i < 12; i++) s += `<circle cx="${14 + i * 12}" cy="${GROUND + 9 + (i % 2) * 2}" r="1.6" fill="${flowers[i % 4]}"/>`;
    s += `<g fill="#fdfbf6">${Array.from({ length: 22 }, (_, i) => `<rect x="${4 + i * 7}" y="${GROUND + 5}" width="3" height="9"/>`).join('')}</g>`;
    s += r(2, GROUND + 8, W - 4, 1.5, '#fdfbf6');
    return s;
  }

  function lawn(path) {
    let s = `<rect class="g-grass" x="0" y="0" width="${W}" height="120"/>`;
    s += `<rect class="g-grass2" x="0" y="0" width="${W}" height="30"/>`;
    if (path) s += `<rect class="g-walk" x="${W / 2 - 6}" y="${GROUND}" width="12" height="16"/>`;
    return s;
  }

  function tree(x, y, s = 1) {
    return `<rect x="${x - 2 * s}" y="${y}" width="${4 * s}" height="${12 * s}" fill="#6b4a33"/>` +
      `<circle cx="${x}" cy="${y - 4 * s}" r="${11 * s}" class="g-tree"/><circle cx="${x - 5 * s}" cy="${y - 1 * s}" r="${8 * s}" class="g-tree2"/><circle cx="${x + 4 * s}" cy="${y - 9 * s}" r="${6 * s}" class="g-tree2"/>`;
  }

  function house(type, upgrades = []) {
    const c = STYLE[type];
    const wall = upgrades.includes('paint') ? c.paint : c.wall;
    let s = `<ellipse cx="${W / 2}" cy="${GROUND + 1}" rx="${c.w / 2 + 12}" ry="4" fill="rgba(0,0,0,.18)"/>`;
    s += BODY[type](c, wall);
    if (upgrades.includes('porch')) s += porch(c);
    if (upgrades.includes('yard')) s += yard(c);
    return s;
  }

  function rundown() {
    const x = 36, y = GROUND - 32, w = 84;
    let s = `<ellipse cx="80" cy="${GROUND + 1}" rx="54" ry="4" fill="rgba(0,0,0,.18)"/>`;
    s += poly(`${x - 5},${y + 2} ${x + 30},${y - 18} ${x + w + 5},${y - 2}`, '#5d544b') + r(x, y, w, 32, '#8f857a');
    s += poly(`${x + 44},${y - 12} ${x + 54},${y - 13} ${x + 50},${y - 2}`, '#8f857a');
    for (const wx of [x + 10, x + 58]) s += r(wx, y + 8, 16, 12, '#3b3631') + `<g stroke="#b59a6d" stroke-width="3"><line x1="${wx - 2}" y1="${y + 9}" x2="${wx + 18}" y2="${y + 18}"/><line x1="${wx - 2}" y1="${y + 18}" x2="${wx + 18}" y2="${y + 10}"/></g>`;
    s += r(x + 36, y + 12, 11, 20, '#4a3f36');
    for (let i = 0; i < 9; i++) s += `<path d="M${10 + i * 17} ${GROUND + 12} l3 -9 l2 9 l3 -7 l1 7" fill="#5c7a36"/>`;
    return s;
  }

  function stakes() {
    const pts = [[24, 40], [136, 40], [24, 100], [136, 100]];
    let s = '<g stroke="#caa66b" stroke-width="1" stroke-dasharray="3 3" fill="none"><rect x="24" y="40" width="112" height="60"/></g>';
    for (const [x, y] of pts) s += r(x - 1, y - 9, 2.5, 10, '#caa66b') + poly(`${x + 1.5},${y - 9} ${x + 8},${y - 7} ${x + 1.5},${y - 5}`, '#ff7a2e');
    return s;
  }

  function saleSign() {
    return r(78, 56, 3, 40, '#6b4a33') + r(56, 42, 48, 20, '#fdfbf6', 'rx="1.5"') + r(58, 44, 44, 16, '#d2462f', 'rx="1"') +
      `<text x="80" y="54.5" text-anchor="middle" font-size="7.5" font-weight="700" letter-spacing=".3" fill="#fff" font-family="system-ui, sans-serif">FOR SALE</text>`;
  }

  const SPECIAL = {
    park() {
      let s = `<ellipse cx="80" cy="78" rx="62" ry="26" fill="#d9c9a2"/><ellipse cx="80" cy="78" rx="48" ry="18" class="g-grass"/>`;
      s += `<ellipse cx="80" cy="80" rx="14" ry="6" fill="#8fb8cf"/><rect x="77" y="66" width="6" height="12" fill="#b9b2a4"/><circle cx="80" cy="64" r="4" fill="#bfe0ef"/>`;
      s += tree(28, 52, 1.3) + tree(132, 50, 1.2) + tree(40, 92, 0.9) + tree(124, 94, 0.9);
      s += r(96, 92, 18, 3, '#7a5236') + r(97, 95, 2, 5, '#3b3631') + r(111, 95, 2, 5, '#3b3631');
      return s;
    },
    mill() {
      let s = poly('26,58 70,34 114,58', '#7a2f28') + r(30, 58, 80, 46, '#a2473a') + r(58, 72, 24, 32, '#5b2a23');
      s += `<g stroke="#f1e6d6" stroke-width="2"><line x1="58" y1="72" x2="82" y2="104"/><line x1="82" y1="72" x2="58" y2="104"/></g>`;
      s += `<circle cx="126" cy="70" r="16" fill="#c7ccd1"/><circle cx="126" cy="70" r="5" fill="#6d737a"/>`;
      s += `<g fill="#c7ccd1">${Array.from({ length: 12 }, (_, i) => { const a = (i / 12) * Math.PI * 2; return `<circle cx="${(126 + Math.cos(a) * 17).toFixed(1)}" cy="${(70 + Math.sin(a) * 17).toFixed(1)}" r="2.2"/>`; }).join('')}</g>`;
      for (let i = 0; i < 3; i++) for (let j = 0; j < 3 - i; j++) s += `<circle cx="${122 + j * 9 + i * 4.5}" cy="${100 - i * 8}" r="4.5" fill="#b48457" stroke="#7a5236"/>`;
      return s;
    },
    workshop() {
      let s = r(28, 50, 104, 54, '#6f7f8c') + poly('22,50 80,32 138,50', '#3c4650');
      s += r(40, 64, 40, 40, '#dfe3e6') + `<g stroke="#b7bec4">${[0, 1, 2, 3, 4, 5, 6].map((i) => `<line x1="40" y1="${68 + i * 5}" x2="80" y2="${68 + i * 5}"/>`).join('')}</g>`;
      s += windowAt(94, 66, 24, 14, '#e8ebee');
      s += r(92, 38, 40, 12, '#f2c14e', 'rx="2"') + `<text x="112" y="46.5" text-anchor="middle" font-size="7" font-weight="800" fill="#2b2f33" font-family="system-ui, sans-serif">WORKS</text>`;
      return s;
    },
  };

  // Scaffolding shown over a structure under construction.
  function scaffold() {
    let s = '<g stroke="#c48a3a" stroke-width="2" fill="none">';
    for (let x = 30; x <= 130; x += 25) s += `<line x1="${x}" y1="${GROUND}" x2="${x}" y2="36"/>`;
    for (let y = GROUND - 22; y > 36; y -= 22) s += `<line x1="26" y1="${y}" x2="134" y2="${y}"/>`;
    return s + '</g>';
  }

  // Full picture for a lot. `id` keeps clip-path ids unique on the page.
  function lotSVG(lot, id) {
    let inner = lawn(lot.kind === 'house' && !lot.task);
    if (!lot.task) {
      if (lot.kind === 'house') inner += house(lot.house.type, lot.house.upgrades);
      else if (lot.kind === 'special') inner += SPECIAL[lot.special]();
      else if (lot.kind === 'rundown') inner += rundown();
      else if (lot.owned) inner += stakes() + tree(146, 30, 0.7);
      else inner += tree(18, 34, 0.8) + tree(146, 28, 0.7);
      if (!lot.owned) inner += saleSign();
    } else {
      const t = lot.task;
      let before = '', after = '';
      if (t.kind === 'build') { before = stakes(); after = house(t.type); }
      else if (t.kind === 'special') { before = stakes(); after = SPECIAL[t.type](); }
      else if (t.kind === 'upgrade') { before = house(lot.house.type, lot.house.upgrades); after = house(lot.house.type, lot.house.upgrades.concat(t.type)); }
      else if (t.kind === 'demolish') { before = lot.kind === 'house' ? house(lot.house.type, lot.house.upgrades) : rundown(); after = stakes(); }
      const reveal = t.kind === 'demolish' ? 'down' : 'up';
      inner += before;
      inner += `<clipPath id="clip-${id}"><rect data-reveal="${reveal}" x="0" y="0" width="${W}" height="0"/></clipPath>`;
      inner += `<g clip-path="url(#clip-${id})">${t.kind === 'demolish' ? lawn(false) + after : after}</g>`;
      if (t.kind !== 'upgrade') inner += scaffold();
    }
    return `<svg viewBox="0 0 ${W} 120" preserveAspectRatio="xMidYMax slice" aria-hidden="true">${inner}</svg>`;
  }

  // Standalone thumbnail of a building for menus.
  function thumbSVG(kind, type) {
    const body = kind === 'house' ? house(type) : SPECIAL[type]();
    return `<svg viewBox="0 20 ${W} 96" aria-hidden="true">${body}</svg>`;
  }

  root.BAL = Object.assign(root.BAL || {}, { art: { lotSVG, thumbSVG } });
})(typeof self !== 'undefined' ? self : this);
