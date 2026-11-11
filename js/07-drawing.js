// ======================================================================= DRAWING
// Packet Tracer-style link light: a small triangle pointing along the cable
function lightSvg(x, y, ux, uy, state) {
  const [fill, stroke] = LIGHT[state] || LIGHT.up, nx = -uy, ny = ux;
  const pts = [[x + ux * 5.5, y + uy * 5.5], [x - ux * 4 + nx * 4.6, y - uy * 4 + ny * 4.6], [x - ux * 4 - nx * 4.6, y - uy * 4 - ny * 4.6]];
  return `<polygon points="${pts.map(p => p.map(f2).join(",")).join(" ")}" fill="${fill}" stroke="${stroke}" stroke-width="1" stroke-linejoin="round"/>`;
}
function linkSvg(l, exp, T) {
  const A = byId(l.a), B = byId(l.b);
  if (!A || !B) return "";
  const c = CABLES[l.cable] || CABLES.copper;
  // fan out parallel cables between the same two devices
  const sib = S.links.filter(x => (x.a === l.a && x.b === l.b) || (x.a === l.b && x.b === l.a));
  let a = A, b = B;
  if (sib.length > 1) {
    const [p, q] = A.id < B.id ? [A, B] : [B, A], L0 = Math.hypot(q.x - p.x, q.y - p.y) || 1;
    const off = (sib.indexOf(l) - (sib.length - 1) / 2) * 18, ox = -(q.y - p.y) / L0 * off, oy = (q.x - p.x) / L0 * off;
    a = Object.assign({}, A, {x: A.x + ox, y: A.y + oy}); b = Object.assign({}, B, {x: B.x + ox, y: B.y + oy});
  }
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  let d;
  if (c.zig && len > 90) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    d = `M${a.x},${a.y} L${f2(mx - 10 * ux)},${f2(my - 10 * uy)} L${f2(mx - 3 * ux + 9 * nx)},${f2(my - 3 * uy + 9 * ny)} L${f2(mx + 3 * ux - 9 * nx)},${f2(my + 3 * uy - 9 * ny)} L${f2(mx + 10 * ux)},${f2(my + 10 * uy)} L${b.x},${b.y}`;
  } else d = `M${a.x},${a.y} L${b.x},${b.y}`;
  const sel = !exp && SEL.kind === "link" && SEL.id === l.id;
  const st = linkStatus(l);
  let s = `<g data-link="${esc(l.id)}">`;
  if (sel) s += `<path d="${d}" fill="none" stroke="${T.accent}" stroke-opacity=".3" stroke-width="${c.w + 10}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="${c.w}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ""} stroke-linecap="round" stroke-linejoin="round"${st.up ? "" : ' stroke-opacity=".65"'}/>`;
  if (!exp) s += `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="16"/>`;
  const exitT = (dev, vx, vy) => {
    const hw = Math.max(34, textW(dev) / 2 + 4), top = 28, bottom = labelH(dev) + 2;
    const tx = Math.abs(vx) < 1e-6 ? Infinity : hw / Math.abs(vx);
    const ty = Math.abs(vy) < 1e-6 ? Infinity : (vy > 0 ? bottom : top) / Math.abs(vy);
    return Math.min(tx, ty);
  };
  const ea = exitT(a, ux, uy), eb = exitT(b, -ux, -uy);
  if (S.showLights && c.lights && len > 100 && st.a) {
    const ra = Math.min(ea + 6, len / 2 - 6), rb = Math.min(eb + 6, len / 2 - 6);
    s += lightSvg(a.x + ux * ra, a.y + uy * ra, ux, uy, st.a) + lightSvg(b.x - ux * rb, b.y - uy * rb, -ux, -uy, st.b);
  }
  if (c.dce && len > 140) {
    // clock symbol on the DCE end, like Packet Tracer
    const r = Math.min(ea + 24, len / 2 - 14), cx = a.x + ux * r + nx * 12, cy = a.y + uy * r + ny * 12;
    s += `<g transform="translate(${f2(cx)},${f2(cy)})"><circle r="6.5" fill="#fff" stroke="${c.color}" stroke-width="1.6"/><path d="M0,-3.8 V0 L2.8,1.6" stroke="${c.color}" stroke-width="1.4" fill="none" stroke-linecap="round"/></g>`;
  }
  if (S.showPorts) {
    const horiz = Math.abs(ux) > Math.abs(uy), off = horiz ? -9 : 0, side = horiz ? 0 : 9;
    const lab = (txt, x, y) => txt ? `<text x="${f2(x)}" y="${f2(y)}" text-anchor="${side ? "start" : "middle"}" dominant-baseline="middle" font-size="10.5" font-weight="600" fill="${T.port}" stroke="${T.canvas}" stroke-width="4" stroke-linejoin="round" paint-order="stroke">${esc(txt)}</text>` : "";
    const ta = Math.max(18, Math.min(ea + 20, len / 2 - 10)), tb = Math.max(18, Math.min(eb + 20, len / 2 - 10));
    s += lab(l.pa, a.x + ux * ta + side, a.y + uy * ta + off) + lab(l.pb, b.x - ux * tb + side, b.y - uy * tb + off);
  }
  return s + "</g>";
}
function devSvg(d, exp, T) {
  const sel = !exp && SEL.kind === "dev" && SEL.id === d.id;
  const pending = !exp && CONNECT.from === d.id;
  let s = `<g data-dev="${esc(d.id)}" transform="translate(${d.x},${d.y})">`;
  if (sel || pending) s += `<rect x="-42" y="-33" width="84" height="64" rx="12" fill="${T.accent}" fill-opacity=".1" stroke="${T.accent}" stroke-width="1.6" stroke-dasharray="${pending ? "3 3" : "6 4"}"/>`;
  if (!exp) s += `<rect x="-36" y="-28" width="72" height="58" fill="#000" fill-opacity="0"/>`;
  s += icon(d.type);
  const txt = (y, t, size, fill, weight) => `<text y="${y}" text-anchor="middle" font-size="${size}" font-weight="${weight}" fill="${fill}" stroke="${T.canvas}" stroke-width="3.5" stroke-linejoin="round" paint-order="stroke">${esc(t)}</text>`;
  let y = 40;
  s += txt(y, d.name, 12.5, T.text, 700);
  if (S.showModel && d.model) { y += 14; s += txt(y, d.model, 10.5, T.muted, 500); }
  if (S.showIP) for (const line of ipLines(d)) { y += 13.5; s += txt(y, line, 10.5, T.ip, 600); }
  return s + "</g>";
}
function groupsSvg() {
  return groupRects().map(g => `<g><rect x="${g.x}" y="${g.y}" width="${g.w}" height="${g.h}" rx="16" fill="${g.color}" fill-opacity=".07" stroke="${g.color}" stroke-opacity=".75" stroke-width="1.4" stroke-dasharray="7 5"/><text x="${g.x + 14}" y="${g.y + 20}" font-size="12.5" font-weight="700" fill="${g.color}">${esc(g.name)}</text></g>`).join("");
}
// ---- areas (boxes you draw) and notes (text labels)
const AREA_COLORS = ["#0a84ff", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2", "#64748b"];
function areasSvg(exp, T) {
  return (S.areas || []).map(a => {
    const sel = !exp && SEL.kind === "area" && SEL.id === a.id;
    let s = `<g data-area="${esc(a.id)}"><rect x="${a.x}" y="${a.y}" width="${a.w}" height="${a.h}" rx="14" fill="${a.color}" fill-opacity=".09" stroke="${a.color}" stroke-width="${sel ? 2.6 : 1.6}"${sel ? ' stroke-dasharray="7 4"' : ""}/>`;
    if (a.label) s += `<text x="${a.x + 14}" y="${a.y + 22}" font-size="13" font-weight="700" fill="${a.color}">${esc(a.label)}</text>`;
    if (sel) s += `<rect data-areah="${esc(a.id)}" x="${a.x + a.w - 8}" y="${a.y + a.h - 8}" width="14" height="14" rx="3" fill="${a.color}" style="cursor:nwse-resize"/>`;
    return s + "</g>";
  }).join("");
}
function noteBox(n) { const lines = String(n.text || "").split("\n"); return {lines, w: Math.max(70, ...lines.map(l => l.length * 7.1)) + 22, h: lines.length * 17 + 14}; }
function notesSvg(exp, T) {
  return (S.notes || []).map(n => {
    const sel = !exp && SEL.kind === "note" && SEL.id === n.id, {lines, w, h} = noteBox(n);
    return `<g data-note="${esc(n.id)}" transform="translate(${n.x},${n.y})"><rect width="${f2(w)}" height="${h}" rx="6" fill="#fff6bf" stroke="${sel ? T.accent : "#d9b93a"}" stroke-width="${sel ? 2 : 1}"/>` +
      lines.map((l, i) => `<text x="11" y="${21 + i * 17}" font-size="12.5" fill="#3b3200">${esc(l)}</text>`).join("") + "</g>";
  }).join("");
}
let rafId = 0;
function render() {
  $("gAreas").innerHTML = areasSvg(false, TH);
  $("gGroups").innerHTML = groupsSvg();
  $("gLinks").innerHTML = S.links.map(l => linkSvg(l, false, TH)).join("");
  $("gDevs").innerHTML = S.devices.map(d => devSvg(d, false, TH)).join("");
  $("gNotes").innerHTML = notesSvg(false, TH);
  if (!CONNECT.from && !AREA_DRAW) $("gOverlay").innerHTML = "";
  $("empty").classList.toggle("hidden", S.devices.length > 0);
  cv.className.baseVal = "tool-" + MODE + (MODE === "connect" ? " connect" : "");
  status();
}
const scheduleRender = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); };
function applyView() { $("world").setAttribute("transform", `translate(${VIEW.x},${VIEW.y}) scale(${VIEW.k})`); status(); }
const TOOL_HINTS = {
  select: () => `${S.devices.length} devices · ${S.links.length} cables · drag to move · double-click a device to open it · right-click for options`,
  connect: () => CABLE === "auto" ? "⚡ Automatic cable: click one device, then another. Ports are picked for you · Esc stops" : `🔌 ${CABLES[CABLE].label}: click a device and pick a port, then the other device · Esc stops`,
  inspect: () => "🔍 Inspect: click a device to see its ports and status",
  delete: () => "🗑️ Delete: click a device, cable, note or area to remove it · Esc stops",
  note: () => "📝 Note: click anywhere on the workspace to place a note",
  area: () => "▭ Area: drag on the workspace to draw a box",
  pdu: () => "✉️ Simple PDU: click the source device, then the destination",
};
function status() {
  $("zoomInfo").textContent = Math.round(VIEW.k * 100) + "%";
  let h;
  if (CONNECT.from) { const a = byId(CONNECT.from); h = `🔌 ${a ? a.name : ""}${CONNECT.port ? " " + CONNECT.port : ""} → now click the other device · Esc cancels`; }
  else h = (TOOL_HINTS[MODE] || TOOL_HINTS.select)();
  $("hint").textContent = h;
}
function buildLegend() {
  $("legend").innerHTML = CABLE_LIST.map(([, c]) => `<span><svg viewBox="0 0 24 8"><path d="M1,4 H23" stroke="${c.color}" stroke-width="${Math.min(c.w, 3.5)}"${c.dash ? ` stroke-dasharray="${c.dash.split(" ").map(n => n / 2).join(" ")}"` : ""}/></svg>${esc(c.short)}</span>`).join("") +
    `<span><svg viewBox="0 0 24 8"><polygon points="4,1 4,7 10,4" fill="#22c55e"/><polygon points="13,1 13,7 19,4" fill="#f59e0b"/></svg>up / blocking</span><span><svg viewBox="0 0 24 8"><polygon points="8,1 8,7 14,4" fill="#ef4444"/></svg>down</span>`;
}
