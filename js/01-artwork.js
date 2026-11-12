// ======================================================================= ARTWORK
// Original drawings in the classic network-topology style (no Cisco artwork copied).
// Two sets: "classic" (shaded topology symbols) and "realistic" (rack hardware). Both are drawn
// around (0,0) inside roughly x -32..32, y -26..26, lit from the top-left, with a soft contact shadow.
const DEFS = `
<radialGradient id="ndShadow"><stop offset="0" stop-color="#000" stop-opacity=".34"/><stop offset=".6" stop-color="#000" stop-opacity=".12"/><stop offset="1" stop-color="#000" stop-opacity="0"/></radialGradient>
<linearGradient id="ndGloss" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".55"/><stop offset=".5" stop-color="#fff" stop-opacity=".12"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="ndBTop" x1="0" y1="1" x2=".35" y2="0"><stop offset="0" stop-color="#4fa6ec"/><stop offset=".55" stop-color="#7cc3f7"/><stop offset="1" stop-color="#b4e0ff"/></linearGradient>
<linearGradient id="ndBFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3b97e3"/><stop offset=".5" stop-color="#2479c9"/><stop offset="1" stop-color="#145a9f"/></linearGradient>
<linearGradient id="ndBSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#14558f"/><stop offset="1" stop-color="#0b3a69"/></linearGradient>
<linearGradient id="ndBCyl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0d4683"/><stop offset=".16" stop-color="#2271c2"/><stop offset=".42" stop-color="#4aa2ea"/><stop offset=".58" stop-color="#3d93df"/><stop offset=".86" stop-color="#1a62ab"/><stop offset="1" stop-color="#0b3c74"/></linearGradient>
<radialGradient id="ndBPuck" cx=".38" cy=".3" r=".85"><stop offset="0" stop-color="#d2efff"/><stop offset=".35" stop-color="#86c8f6"/><stop offset=".8" stop-color="#3f95e0"/><stop offset="1" stop-color="#2c82d0"/></radialGradient>
<linearGradient id="ndRFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e76a52"/><stop offset="1" stop-color="#b3331f"/></linearGradient>
<linearGradient id="ndRTop" x1="0" y1="1" x2=".3" y2="0"><stop offset="0" stop-color="#e2735c"/><stop offset="1" stop-color="#f8b4a4"/></linearGradient>
<linearGradient id="ndRSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9a2a19"/><stop offset="1" stop-color="#701b0f"/></linearGradient>
<linearGradient id="ndAlu" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fbfcfd"/><stop offset="1" stop-color="#cdd3dc"/></linearGradient>
<linearGradient id="ndAluSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#b9c1cc"/><stop offset="1" stop-color="#8e98a6"/></linearGradient>
<linearGradient id="ndCharcoal" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4c5462"/><stop offset="1" stop-color="#1c2129"/></linearGradient>
<linearGradient id="ndScreen" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5fc1ff"/><stop offset=".55" stop-color="#1f78d6"/><stop offset="1" stop-color="#0b3f91"/></linearGradient>
<linearGradient id="ndGlare" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#fff" stop-opacity=".5"/><stop offset=".45" stop-color="#fff" stop-opacity=".08"/><stop offset=".46" stop-color="#fff" stop-opacity="0"/></linearGradient>
<linearGradient id="ndCloud" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset=".6" stop-color="#e6f1fc"/><stop offset="1" stop-color="#c3dcf5"/></linearGradient>
<linearGradient id="ndChFront" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a525e"/><stop offset=".12" stop-color="#363d47"/><stop offset="1" stop-color="#1c2027"/></linearGradient>
<linearGradient id="ndChTop" x1="0" y1="1" x2="0" y2="0"><stop offset="0" stop-color="#6d7683"/><stop offset="1" stop-color="#a9b1bc"/></linearGradient>
<linearGradient id="ndChSide" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#2a3038"/><stop offset="1" stop-color="#171b20"/></linearGradient>
<linearGradient id="ndSilver" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#eef1f5"/><stop offset=".5" stop-color="#c9d0d9"/><stop offset="1" stop-color="#9aa4b1"/></linearGradient>
<linearGradient id="ndBlueBez" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2d7fd0"/><stop offset="1" stop-color="#145394"/></linearGradient>`;

// helpers stay private to this file
const [ICON_CISCO, ICON_REAL] = (() => {
const P = pts => pts.map(p => p.map(f2).join(",")).join(" ");
// a solid arrow from (x1,y1) to (x2,y2): shaft half-width sw, head half-width hw, head length hl
function arrowPts(x1, y1, x2, y2, sw = 1.3, hw = 3.4, hl = 4.4) {
  const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, nx = -uy, ny = ux, bx = x2 - ux * hl, by = y2 - uy * hl;
  return P([[x1 + nx * sw, y1 + ny * sw], [bx + nx * sw, by + ny * sw], [bx + nx * hw, by + ny * hw], [x2, y2], [bx - nx * hw, by - ny * hw], [bx - nx * sw, by - ny * sw], [x1 - nx * sw, y1 - ny * sw]]);
}
// arrows drawn in a face's own coordinates, with a soft dark copy underneath for depth
const arrows = (list, opts) => {
  const o = Object.assign({sw: 1.3, hw: 3.4, hl: 4.4, fill: "#fff", sh: "#06305c"}, opts || {});
  const pts = list.map(a => arrowPts(a[0], a[1], a[2], a[3], o.sw, o.hw, o.hl));
  return pts.map(p => `<polygon points="${p}" fill="${o.sh}" fill-opacity=".35" transform="translate(.5,.9)"/>`).join("") + pts.map(p => `<polygon points="${p}" fill="${o.fill}"/>`).join("");
};
const shadow = (rx, cy, ry) => `<ellipse cx="1" cy="${cy}" rx="${rx}" ry="${ry || 4.5}" fill="url(#ndShadow)"/>`;
// an oblique box: front face at (x,y) w×h, depth d going up-right
const KX = 0.92, KY = -0.78;
function box(x, y, w, h, d, f) {
  const dx = KX * d, dy = KY * d;
  const st = `stroke="${f.edge}" stroke-width=".8" stroke-linejoin="round"`;
  return {
    svg: `<path d="M${x},${y} L${f2(x + dx)},${f2(y + dy)} H${f2(x + w + dx)} L${x + w},${y} Z" fill="${f.top}" ${st}/>` +
      `<path d="M${x + w},${y} L${f2(x + w + dx)},${f2(y + dy)} V${f2(y + dy + h)} L${x + w},${y + h} Z" fill="${f.side}" ${st}/>` +
      `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${f.front}" ${st}/>` +
      // light catching the two top edges
      `<path d="M${x + .6},${y + .5} H${x + w - .4} L${f2(x + w + dx - .4)},${f2(y + dy + .4)}" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width=".7"/>`,
    top: `matrix(1,0,${KX},${KY},${x},${y})`,          // (u along width, v along depth)
    side: `matrix(${KX},${KY},0,1,${x + w},${y})`,     // (u along depth, v down)
    front: `translate(${x},${y})`,
  };
}
const BLUE = {top: "url(#ndBTop)", front: "url(#ndBFront)", side: "url(#ndBSide)", edge: "#0a3566"};
const RED = {top: "url(#ndRTop)", front: "url(#ndRFront)", side: "url(#ndRSide)", edge: "#5e140b"};
const ALU = {top: "url(#ndAlu)", front: "url(#ndAlu)", side: "url(#ndAluSide)", edge: "#59626f"};
const CHASSIS = {top: "url(#ndChTop)", front: "url(#ndChFront)", side: "url(#ndChSide)", edge: "#101318"};

// bricks for a face w×h (in face coordinates), rows of height rh, mortar gap g
function bricks(w, h, rh, bw, g, fill, light) {
  let s = "";
  for (let r = 0, y = 0; y < h - .5; r++, y += rh) {
    const off = r % 2 ? -bw / 2 : 0;
    for (let x = off; x < w; x += bw) {
      const x0 = Math.max(0, x) + g / 2, x1 = Math.min(w, x + bw) - g / 2, y1 = Math.min(h, y + rh) - g / 2;
      if (x1 - x0 < .8) continue;
      s += `<rect x="${f2(x0)}" y="${f2(y + g / 2)}" width="${f2(x1 - x0)}" height="${f2(y1 - y - g / 2)}" rx=".5" fill="${fill}"/>`;
      if (light) s += `<path d="M${f2(x0 + .4)},${f2(y + g / 2 + .5)} H${f2(x1 - .4)}" stroke="#fff" stroke-opacity=".35" stroke-width=".6"/>`;
    }
  }
  return s;
}
const LED = (x, y, c, r = 1.1) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${c}"/><circle cx="${x - r * .3}" cy="${y - r * .3}" r="${r * .4}" fill="#fff" fill-opacity=".7"/>`;
const rj45 = (x, y, w = 3.4, h = 2.8) => `<rect x="${f2(x)}" y="${f2(y)}" width="${w}" height="${h}" rx=".35" fill="#0b0e12" stroke="#5d6672" stroke-width=".35"/>`;
const T = (x, y, txt, size, fill, w) => `<text x="${x}" y="${y}" font-size="${size}" font-weight="${w || 800}" fill="${fill}" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif" letter-spacing=".2">${txt}</text>`;

// ---------------------------------------------------------------- classic (topology symbols)
function puck(rx, ry, top, h, fills, extra) {
  return `<path d="M${-rx},${top} V${top + h} A${rx},${ry} 0 0 0 ${rx},${top + h} V${top} Z" fill="${fills.side}" stroke="${fills.edge}" stroke-width=".8"/>` +
    `<path d="M${-rx + 1.5},${top + h + 1.2} A${rx - 1.5},${ry - 1} 0 0 0 ${rx - 1.5},${top + h + 1.2}" fill="none" stroke="#fff" stroke-opacity=".18" stroke-width="1"/>` +
    `<ellipse cx="0" cy="${top}" rx="${rx}" ry="${ry}" fill="${fills.top}" stroke="${fills.edge}" stroke-width=".8"/>` +
    `<ellipse cx="0" cy="${top + .3}" rx="${rx - 1}" ry="${ry - .8}" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width=".7"/>` + (extra || "");
}
const ROUTER_ARROWS = (() => {
  // four arrows in an X on the round top: two in, two out (the classic router symbol), drawn flat then squashed
  const a = 18, b = 5.5;
  return `<g transform="translate(0,-6) scale(1,.38)">${arrows([[-a, -a, -b, -b], [a, a, b, b], [b, -b, a, -a], [-b, b, -a, a]], {sw: 2.3, hw: 5.6, hl: 7.4, sh: "#05284d"})}</g>`;
})();
const swClassic = (() => {
  const B = box(-30, -3, 50, 15, 12, BLUE);
  return B.svg + `<rect x="-30" y="-3" width="50" height="6" fill="url(#ndGloss)" opacity=".55"/>` +
    `<g transform="${B.top}">${arrows([[22, 8.6, 6, 8.6], [28, 8.6, 44, 8.6], [6, 3.4, 22, 3.4], [44, 3.4, 28, 3.4]], {sw: 1.25, hw: 3.1, hl: 4.6})}</g>`;
})();
const ICON_CISCO = {
  router: shadow(29, 18, 5) + puck(27, 10.5, -6, 13, {side: "url(#ndBCyl)", top: "url(#ndBPuck)", edge: "#0a3566"}) + ROUTER_ARROWS,
  switch: shadow(32, 15) + swClassic,
  l3switch: (() => {
    const B = box(-21, -8, 34, 28, 11, BLUE);
    return shadow(26, 23) + B.svg + `<rect x="-21" y="-8" width="34" height="10" fill="url(#ndGloss)" opacity=".5"/>` +
      `<g transform="${B.top}">${arrows([[4, 5.5, 14, 5.5], [30, 5.5, 20, 5.5]], {sw: 1.1, hw: 2.8, hl: 4})}</g>` +
      `<g transform="translate(-4,7)">${arrows([[-8.5, -6.5, -2.2, -1.6], [8.5, 6.5, 2.2, 1.6], [2.2, -1.6, 8.5, -6.5], [-2.2, 1.6, -8.5, 6.5]], {sw: 1.2, hw: 3, hl: 4})}</g>`;
  })(),
  hub: (() => {
    const B = box(-30, 0, 52, 9, 9, BLUE);
    return shadow(32, 13) + B.svg + `<g transform="${B.top}">${arrows([[18, 4.5, 4, 4.5], [34, 4.5, 48, 4.5]], {sw: 1, hw: 2.6, hl: 3.6})}<rect x="18" y="3.5" width="16" height="2" fill="#fff"/></g>` +
      Array.from({length: 7}, (_, i) => rj45(-27 + i * 6.8, 3.5, 3.6, 3)).join("");
  })(),
  firewall: (() => {
    const B = box(-24, -11, 40, 29, 10, RED);
    return shadow(28, 22) + B.svg +
      `<g transform="${B.front}"><rect width="40" height="29" fill="#f3cfc5"/>${bricks(40, 29, 7.25, 13.33, 1.3, "url(#ndRFront)", true)}</g>` +
      `<g transform="${B.top}"><rect width="40" height="10" fill="#f7d9d1"/>${bricks(40, 10, 5, 13.33, 1.1, "url(#ndRTop)")}</g>` +
      `<g transform="${B.side}"><rect width="10" height="29" fill="#c98c80"/>${bricks(10, 29, 7.25, 10, 1.1, "url(#ndRSide)")}</g>` +
      `<rect x="-24" y="-11" width="40" height="29" fill="none" stroke="#5e140b" stroke-width=".8"/>`;
  })(),
  ap: shadow(25, 17) + puck(23, 7.5, 8, 4.5, {side: "url(#ndBCyl)", top: "url(#ndBPuck)", edge: "#0a3566"}) + LED(0, 8, "#4ade80", 1.4) +
    `<g fill="none" stroke-linecap="round"><g stroke="#063a74" stroke-opacity=".3" stroke-width="3.2" transform="translate(.5,1)"><path d="M-7,-3 a10,10 0 0 1 14,0"/><path d="M-13,-9 a19,19 0 0 1 26,0"/><path d="M-19,-15 a28,28 0 0 1 38,0"/></g>` +
    `<g stroke="#1e7fe0" stroke-width="2.7"><path d="M-7,-3 a10,10 0 0 1 14,0"/><path d="M-13,-9 a19,19 0 0 1 26,0"/><path d="M-19,-15 a28,28 0 0 1 38,0"/></g></g>`,
  wlc: (() => {
    const B = box(-30, -3, 50, 15, 12, BLUE);
    return shadow(32, 15) + B.svg + `<g transform="${B.top}">${arrows([[8, 6, 22, 6], [42, 6, 28, 6]], {sw: 1.1, hw: 2.8, hl: 4})}</g>` +
      `<g fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"><path d="M-25,6.5 a4.5,4.5 0 0 1 6.5,0"/><path d="M-27.6,3.6 a8.5,8.5 0 0 1 11.7,0"/></g>${LED(-21.8, 8.5, "#fff", 1.2)}` + T(4, 8.3, "WLC", 7.5, "#fff");
  })(),
  cloud: `<g transform="translate(0,1)">${shadow(26, 19, 3.5)}<path d="M-19,15 H20 a11,11 0 0 0 1.5,-21.8 a14.5,14.5 0 0 0 -27,-6.4 a10.5,10.5 0 0 0 -16.6,7.4 a9.6,9.6 0 0 0 2.1,20.8 Z" fill="url(#ndCloud)" stroke="#3f86c9" stroke-width="1.5" stroke-linejoin="round"/>` +
    `<path d="M-14,-4 a9,9 0 0 1 11,-6.5 M4,-12 a11,11 0 0 1 11,4" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round"/><path d="M-16,13 H18" stroke="#9cc4ea" stroke-width="1.2" stroke-linecap="round"/></g>`,
};

// ---------------------------------------------------------------- end devices (shared by both sets)
const monitor = (x, y, w, h) => `<rect x="${x}" y="${y}" width="${w}" height="${h}" rx="2.2" fill="url(#ndCharcoal)" stroke="#11151b" stroke-width=".8"/>` +
  `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4.6}" rx=".8" fill="url(#ndScreen)"/>` +
  `<path d="M${x + 4},${y + h - 7} q${w * .22},-${h * .32} ${w * .5},-${h * .18} t${w * .38},-${h * .2}" fill="none" stroke="#9fdcff" stroke-opacity=".55" stroke-width="1.1"/>` +
  `<rect x="${x + 2}" y="${y + 2}" width="${w - 4}" height="${h - 4.6}" rx=".8" fill="url(#ndGlare)"/>` +
  `<circle cx="${x + w / 2}" cy="${y + h - 1.3}" r=".55" fill="#7c8696"/>`;
const ICON_HOSTS = {
  pc: shadow(24, 22, 3.6) +
    // tower behind the monitor
    `<rect x="9" y="-18" width="14" height="36" rx="2" fill="url(#ndAlu)" stroke="#59626f" stroke-width=".8"/><path d="M23,-17 l3,-2.4 V15.6 l-3,2.4" fill="url(#ndAluSide)" stroke="#59626f" stroke-width=".7"/>` +
    `<rect x="11.5" y="-14" width="9" height="2" rx=".5" fill="#2c333d"/><rect x="11.5" y="-10" width="9" height="2" rx=".5" fill="#2c333d"/>${LED(16, 11, "#4ade80", 1)}<circle cx="16" cy="5" r="1.8" fill="none" stroke="#8a93a1" stroke-width=".8"/>` +
    monitor(-25, -20, 36, 26) + `<path d="M-10,6 h6 l1.4,6 h-8.8 Z" fill="url(#ndAluSide)"/><rect x="-16" y="12" width="20" height="2.6" rx="1.3" fill="url(#ndAlu)" stroke="#59626f" stroke-width=".7"/>` +
    `<path d="M-26,17.5 h27 l-2.6,4 h-27 Z" fill="url(#ndAlu)" stroke="#59626f" stroke-width=".7"/><path d="M-25,19.4 h24" stroke="#a9b1bd" stroke-width=".7" stroke-dasharray="1.2 .8"/>`,
  laptop: shadow(27, 18, 3.6) +
    `<path d="M-17,-19 H17 a2.2,2.2 0 0 1 2.2,2.2 V8 H-19.2 V-16.8 a2.2,2.2 0 0 1 2.2,-2.2 Z" fill="url(#ndCharcoal)" stroke="#11151b" stroke-width=".8"/>` +
    `<rect x="-16.6" y="-16.4" width="29.6" height="21.8" rx=".8" fill="url(#ndScreen)"/><rect x="-16.6" y="-16.4" width="29.6" height="21.8" rx=".8" fill="url(#ndGlare)"/>` +
    `<path d="M-22.5,8 H22.5 L27.5,15.5 a1.2,1.2 0 0 1 -1,1.8 H-26.5 a1.2,1.2 0 0 1 -1,-1.8 Z" fill="url(#ndAlu)" stroke="#59626f" stroke-width=".8"/>` +
    `<path d="M-19,10 H19 L21.5,13 H-21.5 Z" fill="#c5ccd6"/><path d="M-5.5,14.4 H5.5" stroke="#8a93a1" stroke-width="1.4" stroke-linecap="round"/>`,
  server: shadow(18, 23, 3.4) +
    `<rect x="-14" y="-24" width="26" height="45" rx="2.4" fill="url(#ndAlu)" stroke="#4f5967" stroke-width=".9"/><path d="M12,-23 l4,-3 V18 l-4,3" fill="url(#ndAluSide)" stroke="#4f5967" stroke-width=".8"/><path d="M-13.5,-23.3 l4,-3 H16" fill="none" stroke="#4f5967" stroke-width=".8"/><path d="M-14,-24 l4,-3 h26 l-4,3 Z" fill="#e9edf2" stroke="#4f5967" stroke-width=".8"/>` +
    [-19, -11, -3].map(y => `<rect x="-10.5" y="${y}" width="19" height="6.2" rx="1" fill="url(#ndCharcoal)"/><path d="M-8.5,${y + 3.1} H1.5" stroke="#6c7686" stroke-width=".9"/>${LED(5.3, y + 3.1, y === -3 ? "#fbbf24" : "#4ade80", .9)}`).join("") +
    `<g stroke="#a7afba" stroke-width=".8">${[7, 9.5, 12, 14.5].map(y => `<path d="M-9,${y} H7"/>`).join("")}</g><circle cx="-1" cy="17.5" r="1.6" fill="none" stroke="#6c7686" stroke-width=".8"/>`,
  printer: shadow(23, 20, 3.4) +
    `<path d="M-12,-21 H11 L13,-11 H-14 Z" fill="#fff" stroke="#8a93a1" stroke-width=".8"/><path d="M-9,-17 H8 M-9,-14 H5" stroke="#c4cad3" stroke-width=".8"/>` +
    `<rect x="-22" y="-12" width="42" height="19" rx="3" fill="url(#ndAlu)" stroke="#4f5967" stroke-width=".9"/><path d="M20,-11 l3,-2.5 V5 l-3,2" fill="url(#ndAluSide)" stroke="#4f5967" stroke-width=".7"/>` +
    `<rect x="-17" y="-5" width="30" height="3" rx="1.5" fill="#2f3a4a"/><rect x="10" y="-9.5" width="7" height="3.2" rx=".6" fill="url(#ndScreen)"/>${LED(15, -1, "#4ade80", 1)}` +
    `<path d="M-15,7 H13 L15,17 H-17 Z" fill="#fff" stroke="#8a93a1" stroke-width=".8"/><path d="M-11,11 H9 M-11,14 H4" stroke="#c4cad3" stroke-width=".8"/>`,
  phone: shadow(22, 18, 3.4) +
    `<path d="M-20,14 L-16,-5 H16 L20,14 a1.6,1.6 0 0 1 -1.6,1.8 H-18.4 a1.6,1.6 0 0 1 -1.6,-1.8 Z" fill="url(#ndCharcoal)" stroke="#11151b" stroke-width=".8"/>` +
    `<rect x="-5" y="-2.5" width="17" height="8.5" rx="1" fill="url(#ndScreen)"/><rect x="-5" y="-2.5" width="17" height="8.5" rx="1" fill="url(#ndGlare)"/>` +
    Array.from({length: 9}, (_, i) => `<rect x="${f2(-4.3 + (i % 3) * 5.9)}" y="${f2(7.6 + Math.floor(i / 3) * 2.2)}" width="4" height="1.5" rx=".5" fill="#9aa4b2"/>`).join("") +
    `<path d="M-19,-7 Q-19.5,-17 -13,-17.5 H-8 Q-5,-17.5 -5,-14 V-11 H-10 V-12.5 H-14 V10 H-10 V8.5 H-7 V11.5 Q-7,14 -9.5,14 H-14 Q-19,14 -19,8 Z" fill="url(#ndCharcoal)" stroke="#11151b" stroke-width=".8"/>`,
  tablet: shadow(16, 22, 3.2) +
    `<rect x="-14" y="-23" width="28" height="42" rx="4" fill="url(#ndCharcoal)" stroke="#11151b" stroke-width=".8"/><rect x="-11.3" y="-19.5" width="22.6" height="33" rx="1" fill="url(#ndScreen)"/>` +
    `<g fill="#fff" fill-opacity=".85">${Array.from({length: 8}, (_, i) => `<rect x="${f2(-9 + (i % 4) * 5)}" y="${f2(-16 + Math.floor(i / 4) * 6)}" width="3.4" height="3.4" rx=".9"/>`).join("")}</g>` +
    `<rect x="-11.3" y="-19.5" width="22.6" height="33" rx="1" fill="url(#ndGlare)"/><circle cx="0" cy="16.3" r="1.3" fill="none" stroke="#8a96a8" stroke-width=".7"/>`,
};
Object.assign(ICON_CISCO, ICON_HOSTS);

// ---------------------------------------------------------------- realistic (rack hardware)
function rackUnit(w, h, d, opts) {
  const x = -w / 2 - 3, y = -h / 2 + 3, B = box(x, y, w, h, d, opts.fill || CHASSIS);
  let s = shadow(w / 2 + 4, y + h + 4, 4.2) + B.svg;
  // rack ears + bezel highlight
  s += `<rect x="${x - 2.4}" y="${y + .5}" width="2.4" height="${h - 1}" rx=".6" fill="url(#ndSilver)" stroke="#4b5562" stroke-width=".5"/><rect x="${x + w}" y="${y + .5}" width="2.4" height="${h - 1}" rx=".6" fill="url(#ndSilver)" stroke="#4b5562" stroke-width=".5"/>`;
  s += `<g transform="${B.top}">${Array.from({length: 7}, (_, i) => `<path d="M${6 + i * (w - 12) / 6},${d * .25} v${d * .5}" stroke="#2a3038" stroke-opacity=".5" stroke-width="1.1"/>`).join("")}</g>`;
  return {s: s + `<g transform="${B.front}">${opts.front(w, h)}</g>`, B};
}
const ICON_REAL = {
  router: rackUnit(54, 15, 10, {front: (w, h) =>
    `<rect x="1.5" y="1.5" width="10" height="${h - 3}" rx="1" fill="url(#ndBlueBez)"/>${T(6.5, h / 2 + 2, "ISR", 4.6, "#fff")}` +
    `<g>${[0, 1, 2].map(i => rj45(15 + i * 5, 3.2)).join("")}${[0, 1, 2].map(i => LED(16.7 + i * 5, 8.6, "#4ade80", .6)).join("")}</g>` +
    `<rect x="31" y="2.6" width="12" height="9" rx=".8" fill="#262c35" stroke="#59626f" stroke-width=".4"/><rect x="33" y="5" width="3.6" height="3" rx=".4" fill="#0b0e12"/><rect x="38" y="5" width="3.6" height="3" rx=".4" fill="#0b0e12"/>` +
    `${LED(47, 4, "#4ade80", .8)}${LED(50.5, 4, "#4ade80", .8)}${LED(47, 9.5, "#f59e0b", .8)}`}).s,
  switch: rackUnit(58, 13, 11, {fill: {top: "url(#ndChTop)", front: "url(#ndSilver)", side: "url(#ndChSide)", edge: "#2d333c"}, front: (w, h) =>
    `<rect x="1.4" y="1.4" width="7" height="${h - 2.8}" rx=".8" fill="url(#ndBlueBez)"/>${LED(5, 4.5, "#4ade80", .7)}${LED(5, 8.5, "#4ade80", .7)}` +
    Array.from({length: 24}, (_, i) => { const c = Math.floor(i / 2), r = i % 2; return rj45(10.5 + c * 3.5 + Math.floor(c / 6) * 1.2, 2.2 + r * 4.6, 3, 3.6); }).join("") +
    `<rect x="${w - 7}" y="2.2" width="5.4" height="3.6" rx=".4" fill="#11151b" stroke="#6b7480" stroke-width=".35"/><rect x="${w - 7}" y="6.9" width="5.4" height="3.6" rx=".4" fill="#11151b" stroke="#6b7480" stroke-width=".35"/>`}).s,
  l3switch: rackUnit(58, 17, 11, {fill: {top: "url(#ndChTop)", front: "url(#ndSilver)", side: "url(#ndChSide)", edge: "#2d333c"}, front: (w, h) =>
    `<rect x="1.4" y="1.4" width="8" height="${h - 2.8}" rx=".8" fill="url(#ndBlueBez)"/>${T(5.4, 10.6, "L3", 5, "#fff")}` +
    Array.from({length: 24}, (_, i) => { const c = Math.floor(i / 2), r = i % 2; return rj45(11.5 + c * 3.4 + Math.floor(c / 6) * 1.1, 3 + r * 5.6, 3, 4); }).join("") +
    [0, 1, 2, 3].map(i => `<rect x="${w - 7.2}" y="${1.8 + i * 3.4}" width="5.6" height="2.6" rx=".3" fill="#11151b" stroke="#6b7480" stroke-width=".3"/>`).join("")}).s,
  hub: rackUnit(46, 10, 9, {fill: {top: "url(#ndAlu)", front: "url(#ndAlu)", side: "url(#ndAluSide)", edge: "#59626f"}, front: (w, h) =>
    Array.from({length: 8}, (_, i) => rj45(3 + i * 4.6, 2.6, 3.4, 3.2)).join("") + Array.from({length: 8}, (_, i) => LED(4.7 + i * 4.6, 7.6, "#4ade80", .5)).join("")}).s,
  firewall: (() => {
    const r = rackUnit(50, 17, 12, {front: (w, h) =>
      `<rect x="0" y="0" width="${w}" height="2.2" fill="#d2402b"/><rect x="2" y="4" width="11" height="${h - 6}" rx="1" fill="#a2311f"/>` +
      `<g transform="translate(3.2,5.1)">${bricks(8.6, h - 8.2, 2.7, 4.3, .55, "#e9634c")}</g>` +
      Array.from({length: 8}, (_, i) => rj45(16 + (i % 4) * 5, 4.4 + Math.floor(i / 4) * 5.4, 3.6, 3.6)).join("") +
      `${LED(w - 5, 5, "#4ade80", .8)}${LED(w - 5, 9, "#4ade80", .8)}${LED(w - 5, 13, "#f59e0b", .8)}`});
    return r.s;
  })(),
  ap: shadow(23, 15, 4) +
    `<path d="M-21,6 Q-21,-1 -14,-2.5 H14 Q21,-1 21,6 V8 Q21,12 15,12.5 H-15 Q-21,12 -21,8 Z" fill="url(#ndAluSide)" stroke="#59626f" stroke-width=".8"/>` +
    `<path d="M-21,4 Q-21,-5 -12,-6.5 H12 Q21,-5 21,4 Q21,8 14,8.6 H-14 Q-21,8 -21,4 Z" fill="url(#ndAlu)" stroke="#59626f" stroke-width=".8"/><ellipse cx="0" cy="1" rx="5" ry="2.1" fill="#e9eef4" stroke="#b1b9c4" stroke-width=".6"/>${LED(0, 1, "#22c55e", 1.1)}` +
    `<g fill="none" stroke="#1e7fe0" stroke-width="2.2" stroke-linecap="round"><path d="M-6,-10 a8,8 0 0 1 12,0"/><path d="M-11,-15 a15,15 0 0 1 22,0"/><path d="M-16,-20 a22,22 0 0 1 32,0"/></g>`,
  wlc: rackUnit(54, 13, 10, {front: (w, h) =>
    `<rect x="1.4" y="1.4" width="12" height="${h - 2.8}" rx=".8" fill="url(#ndBlueBez)"/>${T(7.4, 9, "WLC", 4.6, "#fff")}` +
    [0, 1, 2, 3].map(i => rj45(17 + i * 5.2, 3, 3.6, 3.6)).join("") + [0, 1, 2, 3].map(i => LED(18.8 + i * 5.2, 9.4, "#4ade80", .55)).join("") +
    `<g fill="none" stroke="#9fd0ff" stroke-width="1.1" stroke-linecap="round"><path d="M${w - 10},8.5 a3,3 0 0 1 4.4,0"/><path d="M${w - 11.8},6.6 a5.6,5.6 0 0 1 8,0"/></g>`}).s,
  cloud: ICON_CISCO.cloud,
};
Object.assign(ICON_REAL, ICON_HOSTS);
return [ICON_CISCO, ICON_REAL];
})();
