// ======================================================================= ARTWORK
// Original drawings in the classic Cisco network-topology style (no Cisco artwork copied).
const DEFS = `
<linearGradient id="cF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2c88cd"/><stop offset="1" stop-color="#1663a4"/></linearGradient>
<linearGradient id="cT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#86c8f2"/><stop offset="1" stop-color="#3f98d8"/></linearGradient>
<linearGradient id="cS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#145d9e"/><stop offset="1" stop-color="#0b416f"/></linearGradient>
<linearGradient id="rF" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e0684f"/><stop offset="1" stop-color="#a8321e"/></linearGradient>
<linearGradient id="rT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a592"/><stop offset="1" stop-color="#da654e"/></linearGradient>
<linearGradient id="rS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8c2a19"/><stop offset="1" stop-color="#6b1e11"/></linearGradient>
<linearGradient id="gB" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#3f93e6"/><stop offset="1" stop-color="#0a4f9c"/></linearGradient>
<linearGradient id="gBT" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#b3d8ff"/><stop offset="1" stop-color="#5aa4f0"/></linearGradient>
<linearGradient id="gBS" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#0b4e98"/><stop offset="1" stop-color="#063568"/></linearGradient>
<linearGradient id="gG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f8f9fb"/><stop offset="1" stop-color="#c2c8d2"/></linearGradient>
<linearGradient id="gS" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#5cb0ff"/><stop offset="1" stop-color="#0b3f86"/></linearGradient>
<linearGradient id="gR" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#e8665a"/><stop offset="1" stop-color="#9e2219"/></linearGradient>
<linearGradient id="gC" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ffffff"/><stop offset="1" stop-color="#cbe2f8"/></linearGradient>
<linearGradient id="gD" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#4a5566"/><stop offset="1" stop-color="#232b37"/></linearGradient>`;
const SH = (rx, cy) => `<ellipse cx="0" cy="${cy}" rx="${rx}" ry="3.6" fill="#000" fill-opacity=".15"/>`;
const CO = `stroke="#0b4a7d" stroke-width="1" stroke-linejoin="round"`;
const RO = `stroke="#6e1710" stroke-width="1" stroke-linejoin="round"`;
// flat arrow polygon in "face" coordinates (u along, v across)
const ap = (u0, len, v, dir, w = 1.1, h = 2.6, head = 4) => dir > 0
  ? `${u0},${v - w} ${u0 + len - head},${v - w} ${u0 + len - head},${v - h} ${u0 + len},${v} ${u0 + len - head},${v + h} ${u0 + len - head},${v + w} ${u0},${v + w}`
  : `${u0 + len},${v - w} ${u0 + head},${v - w} ${u0 + head},${v - h} ${u0},${v} ${u0 + head},${v + h} ${u0 + head},${v + w} ${u0 + len},${v + w}`;
const RA = len => `0,-2.6 ${len - 7},-2.6 ${len - 7},-6.6 ${len},0 ${len - 7},6.6 ${len - 7},2.6 0,2.6`;
function sun(cx, cy, r1, r2) {
  let s = "";
  for (let i = 0; i < 8; i++) {
    const a = i * Math.PI / 4, c = Math.cos(a), si = Math.sin(a);
    const x1 = cx + c * r1, y1 = cy + si * r1, x2 = cx + c * r2, y2 = cy + si * r2, bx = cx + c * (r2 - 3.6), by = cy + si * (r2 - 3.6);
    s += `<path d="M${f2(x1)},${f2(y1)} L${f2(bx)},${f2(by)}" stroke="#fff" stroke-width="1.7"/><polygon points="${f2(x2)},${f2(y2)} ${f2(bx - si * 2.4)},${f2(by + c * 2.4)} ${f2(bx + si * 2.4)},${f2(by - c * 2.4)}" fill="#fff"/>`;
  }
  return s;
}
const swBody = `<path d="M-30,-3 L-18,-15 H32 L20,-3 Z" fill="url(#cT)" ${CO}/><path d="M20,-3 L32,-15 V-1 L20,11 Z" fill="url(#cS)" ${CO}/><rect x="-30" y="-3" width="50" height="14" fill="url(#cF)" ${CO}/>`;
const ICON_CISCO = {
  router: SH(27, 20) + `<path d="M-26,-3 V9 A26,9.5 0 0 0 26,9 V-3 Z" fill="url(#cF)" ${CO}/><ellipse cx="0" cy="-3" rx="26" ry="9.5" fill="url(#cT)" ${CO}/>
    <g transform="translate(0,-3) scale(1,0.365)" fill="#fff">
      <polygon points="${RA(17)}" transform="rotate(-45) translate(5,0)"/><polygon points="${RA(17)}" transform="rotate(135) translate(5,0)"/>
      <polygon points="${RA(17)}" transform="rotate(-135) translate(23,0) rotate(180)"/><polygon points="${RA(17)}" transform="rotate(45) translate(23,0) rotate(180)"/>
    </g>`,
  switch: SH(31, 17) + swBody + `<g transform="matrix(1,0,0.857,-0.857,-30,-3)" fill="#fff">
      <polygon points="${ap(4, 16, 10.4, -1, 1.5, 3.2, 4.6)}"/><polygon points="${ap(24, 16, 10.4, 1, 1.5, 3.2, 4.6)}"/><polygon points="${ap(8, 16, 3.6, -1, 1.5, 3.2, 4.6)}"/><polygon points="${ap(28, 16, 3.6, 1, 1.5, 3.2, 4.6)}"/></g>`,
  l3switch: SH(24, 23) + `<path d="M-20,-9 L-11,-18 H23 L14,-9 Z" fill="url(#cT)" ${CO}/><path d="M14,-9 L23,-18 V12 L14,21 Z" fill="url(#cS)" ${CO}/><rect x="-20" y="-9" width="34" height="30" fill="url(#cF)" ${CO}/>
    <g transform="matrix(1,0,1,-1,-20,-9)" fill="#fff"><polygon points="${ap(3, 12, 4.5, -1, 0.9, 2.2, 3.2)}"/><polygon points="${ap(19, 12, 4.5, 1, 0.9, 2.2, 3.2)}"/></g>
    <circle cx="-3" cy="6" r="4" fill="#fff"/>` + sun(-3, 6, 5.6, 12.8),
  hub: SH(31, 13) + `<path d="M-30,1 L-22,-7 H30 L22,1 Z" fill="url(#cT)" ${CO}/><path d="M22,1 L30,-7 V1 L22,9 Z" fill="url(#cS)" ${CO}/><rect x="-30" y="1" width="52" height="8" fill="url(#cF)" ${CO}/>
    <g transform="matrix(1,0,1,-1,-30,1)" fill="#fff"><polygon points="${ap(8, 16, 4, -1, 0.8, 2, 3)}"/><polygon points="${ap(28, 16, 4, 1, 0.8, 2, 3)}"/></g>` +
    Array.from({length: 7}, (_, i) => `<rect x="${-26 + i * 6.6}" y="3.4" width="3.8" height="3" rx=".5" fill="#d6ecff"/>`).join(""),
  firewall: SH(26, 21) + `<path d="M-22,-10 L-13,-19 H27 L18,-10 Z" fill="url(#rT)" ${RO}/><path d="M18,-10 L27,-19 V9 L18,18 Z" fill="url(#rS)" ${RO}/><rect x="-22" y="-10" width="40" height="28" fill="url(#rF)" ${RO}/>
    <g stroke="#fbd5cf" stroke-width="1.3" fill="none"><path d="M-22,-0.7 H18 M-22,8.7 H18 M-9,-10 V-0.7 M5,-10 V-0.7 M-16,-0.7 V8.7 M-2,-0.7 V8.7 M12,-0.7 V8.7 M-9,8.7 V18 M5,8.7 V18"/>
    <path d="M-14,-14.5 H18 M-4,-19 L-8.5,-14.5 M10,-19 L5.5,-14.5" stroke-opacity=".75"/></g>`,
  ap: SH(25, 18) + `<path d="M-24,6 L-17,-1 H28 L21,6 Z" fill="url(#cT)" ${CO}/><path d="M21,6 L28,-1 V5 L21,12 Z" fill="url(#cS)" ${CO}/><rect x="-24" y="6" width="45" height="6" fill="url(#cF)" ${CO}/>
    <g fill="none" stroke="#1b75bc" stroke-width="2.8" stroke-linecap="round"><path d="M-4,-6 a8,8 0 0 1 12,0"/><path d="M-10,-12 a16,16 0 0 1 24,0"/><path d="M-16,-18 a24,24 0 0 1 36,0"/></g>`,
  wlc: SH(31, 17) + swBody + `<g fill="none" stroke="#fff" stroke-width="1.7" stroke-linecap="round"><path d="M-23.5,6 a5,5 0 0 1 7,0"/><path d="M-26.5,3 a9,9 0 0 1 13,0"/></g><circle cx="-20" cy="7.6" r="1.4" fill="#fff"/>
    <g transform="matrix(1,0,0.857,-0.857,-30,-3)" fill="#fff"><polygon points="${ap(9, 15, 7, -1)}"/><polygon points="${ap(26, 15, 7, 1)}"/></g>
    <text x="4" y="7.5" font-size="8" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif">WLC</text>`,
  cloud: `<path d="M-18,15 H20 a11,11 0 0 0 1,-22 a14,14 0 0 0 -26,-6 a10,10 0 0 0 -16,7 a9.5,9.5 0 0 0 3,21 Z" fill="url(#gC)" stroke="#3f86c9" stroke-width="1.7"/>`,
};
const OUT = `stroke="#063a74" stroke-width="1.2" stroke-linejoin="round"`;
const portDots = (n, x0, y, step, w) => Array.from({length: n}, (_, i) => `<rect x="${x0 + i * step}" y="${y}" width="${w}" height="3" rx=".6" fill="#d6ecff" fill-opacity=".92"/>`).join("");
const boxTop = `<path d="M-28,-6 L-20,-14 H30 L22,-6 Z" fill="url(#gBT)" ${OUT}/><path d="M22,-6 L30,-14 V4 L22,12 Z" fill="url(#gBS)" ${OUT}/><rect x="-28" y="-6" width="50" height="18" fill="url(#gB)" ${OUT}/>`;
const ICON_REAL = {
  router: SH(27, 20) + `<path d="M-26,-4 V8 A26,9 0 0 0 26,8 V-4 Z" fill="url(#gB)" ${OUT}/><ellipse cx="0" cy="-4" rx="26" ry="9" fill="url(#gBT)" ${OUT}/>
    <g stroke="#fff" stroke-width="1.9" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-20,-4 H-8 M-11,-6.6 L-8,-4 L-11,-1.4"/><path d="M20,-4 H8 M11,-6.6 L8,-4 L11,-1.4"/><path d="M0,-6.2 V-11.8 M-2.4,-9.4 L0,-11.8 L2.4,-9.4"/><path d="M0,-1.8 V3.6 M-2.4,1.2 L0,3.6 L2.4,1.2"/></g>`,
  switch: SH(30, 17) + boxTop + `<g stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-9,-11.6 H11 M8,-13.4 L11,-11.6 L8,-9.8"/><path d="M14,-8.4 H-6 M-3,-10.2 L-6,-8.4 L-3,-6.6"/></g>` + portDots(8, -25, 5, 5.6, 3.6),
  l3switch: SH(30, 17) + boxTop + `<g stroke="#fff" stroke-width="1.7" fill="none" stroke-linecap="round" stroke-linejoin="round"><path d="M-9,-11.6 H11 M8,-13.4 L11,-11.6 L8,-9.8"/><path d="M14,-8.4 H-6 M-3,-10.2 L-6,-8.4 L-3,-6.6"/></g>` + portDots(5, -25, 5, 5.6, 3.6) + `<text x="10" y="6.5" font-size="9" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif">L3</text>`,
  hub: SH(30, 13) + `<path d="M-28,-2 L-22,-8 H30 L24,-2 Z" fill="#d7dde6" stroke="#4f5967" stroke-width="1.1"/><path d="M24,-2 L30,-8 V2 L24,8 Z" fill="#8d97a6" stroke="#4f5967" stroke-width="1.1"/><rect x="-28" y="-2" width="52" height="10" fill="url(#gG)" stroke="#4f5967" stroke-width="1.1"/>` + Array.from({length: 6}, (_, i) => `<rect x="${-24 + i * 7.5}" y="1" width="4.5" height="4" rx=".6" fill="#2f3a4a"/>`).join(""),
  firewall: SH(28, 20) + `<rect x="-26" y="-16" width="52" height="32" rx="2" fill="url(#gR)" stroke="#6e1710" stroke-width="1.2"/><g stroke="#f7d4cf" stroke-width="1.5" stroke-linecap="square"><path d="M-26,-5.3 H26 M-26,5.3 H26 M-9,-16 V-5.3 M9,-16 V-5.3 M-18,-5.3 V5.3 M0,-5.3 V5.3 M18,-5.3 V5.3 M-9,5.3 V16 M9,5.3 V16"/></g>`,
  ap: SH(22, 19) + `<ellipse cx="0" cy="10" rx="22" ry="7" fill="url(#gB)" ${OUT}/><ellipse cx="0" cy="7" rx="22" ry="6.5" fill="url(#gBT)" ${OUT}/><circle cx="0" cy="7" r="2.2" fill="#22c55e"/><g fill="none" stroke="#1f7ae0" stroke-width="2.6" stroke-linecap="round"><path d="M-7,-5 a10,10 0 0 1 14,0"/><path d="M-13.5,-11 a19,19 0 0 1 27,0"/><path d="M-20,-17 a28,28 0 0 1 40,0"/></g>`,
  wlc: SH(30, 17) + boxTop + `<g fill="none" stroke="#fff" stroke-width="1.8" stroke-linecap="round"><path d="M-20,7 a5,5 0 0 1 7,0"/><path d="M-23,4 a9,9 0 0 1 13,0"/></g><circle cx="-16.5" cy="8.6" r="1.4" fill="#fff"/><text x="5" y="7.5" font-size="8.5" font-weight="800" fill="#fff" text-anchor="middle" font-family="Segoe UI,Arial,sans-serif">WLC</text>`,
  cloud: `<path d="M-18,15 H20 a11,11 0 0 0 1,-22 a14,14 0 0 0 -26,-6 a10,10 0 0 0 -16,7 a9.5,9.5 0 0 0 3,21 Z" fill="url(#gC)" stroke="#5d8fc6" stroke-width="1.6"/><path d="M-12,9 H14" stroke="#9cc1e6" stroke-width="1.4" stroke-linecap="round"/>`,
  server: SH(17, 23) + `<rect x="-15" y="-24" width="30" height="45" rx="3" fill="url(#gG)" stroke="#4f5967" stroke-width="1.2"/><rect x="-11" y="-19" width="22" height="7" rx="1" fill="url(#gD)"/><rect x="-11" y="-9" width="22" height="7" rx="1" fill="url(#gD)"/><rect x="-11" y="1" width="22" height="7" rx="1" fill="url(#gD)"/><circle cx="7.5" cy="-15.5" r="1.3" fill="#4ade80"/><circle cx="7.5" cy="-5.5" r="1.3" fill="#4ade80"/><circle cx="7.5" cy="4.5" r="1.3" fill="#fbbf24"/><path d="M-8,-15.5 H2 M-8,-5.5 H2 M-8,4.5 H2" stroke="#8a96a8" stroke-width="1.2"/><circle cx="0" cy="14.5" r="2.4" fill="#9aa3b0"/>`,
  pc: SH(18, 21) + `<rect x="-21" y="-22" width="42" height="30" rx="3" fill="url(#gG)" stroke="#5b6573" stroke-width="1.2"/><rect x="-18" y="-19" width="36" height="23" rx="1.5" fill="url(#gS)"/><path d="M-13,-15 H-3" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/><path d="M-4,8 H4 L6,15 H-6 Z" fill="url(#gG)" stroke="#5b6573" stroke-width="1"/><rect x="-14" y="15" width="28" height="4" rx="2" fill="url(#gG)" stroke="#5b6573" stroke-width="1"/>`,
  laptop: SH(26, 18) + `<path d="M-17,-19 H17 a2,2 0 0 1 2,2 V8 H-19 V-17 a2,2 0 0 1 2,-2 Z" fill="url(#gG)" stroke="#5b6573" stroke-width="1.2"/><rect x="-16" y="-16" width="32" height="21" rx="1" fill="url(#gS)"/><path d="M-11,-12 H-2" stroke="#fff" stroke-opacity=".55" stroke-width="1.6" stroke-linecap="round"/><path d="M-23,8 H23 L27,15 H-27 Z" fill="url(#gG)" stroke="#5b6573" stroke-width="1.2"/><path d="M-6,11.5 H6" stroke="#8a93a1" stroke-width="1.5" stroke-linecap="round"/>`,
  tablet: SH(14, 22) + `<rect x="-13" y="-22" width="26" height="41" rx="4" fill="url(#gD)" stroke="#1f2733" stroke-width="1"/><rect x="-10" y="-18" width="20" height="31" rx="1" fill="url(#gS)"/><circle cx="0" cy="16" r="1.4" fill="#8a96a8"/>`,
  phone: SH(20, 18) + `<path d="M-20,14 L-16,-6 H16 L20,14 Z" fill="url(#gG)" stroke="#4f5967" stroke-width="1.2"/><rect x="-9" y="-3" width="18" height="8" rx="1" fill="url(#gS)"/>${Array.from({length: 6}, (_, i) => `<circle cx="${-6 + (i % 3) * 6}" cy="${8.5 + Math.floor(i / 3) * 3}" r="1" fill="#6b7585"/>`).join("")}<path d="M-22,-9 Q-22,-18 -14,-18 H14 Q22,-18 22,-9 V-6 H13 V-11 H-13 V-6 H-22 Z" fill="url(#gD)" stroke="#1f2733" stroke-width="1"/>`,
  printer: SH(22, 21) + `<rect x="-12" y="-22" width="24" height="12" fill="#fff" stroke="#8a93a1" stroke-width="1"/><rect x="-22" y="-12" width="44" height="20" rx="3" fill="url(#gG)" stroke="#4f5967" stroke-width="1.2"/><rect x="-16" y="-5" width="32" height="3" rx="1.5" fill="#2f3a4a"/><rect x="-14" y="8" width="28" height="10" fill="#fff" stroke="#8a93a1" stroke-width="1"/><path d="M-9,12 H9 M-9,15 H4" stroke="#b5bcc7" stroke-width="1"/><circle cx="15" cy="-7.5" r="1.6" fill="#4ade80"/>`,
};

