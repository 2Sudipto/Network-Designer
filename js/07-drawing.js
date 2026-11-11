// ======================================================================= DRAWING
function linkSvg(l, exp, T) {
  const a = byId(l.a), b = byId(l.b);
  if (!a || !b) return "";
  const c = CABLES[l.cable] || CABLES.copper;
  const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len, nx = -uy, ny = ux;
  let d;
  if (c.zig && len > 90) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    d = `M${a.x},${a.y} L${mx - 10 * ux},${my - 10 * uy} L${mx - 3 * ux + 9 * nx},${my - 3 * uy + 9 * ny} L${mx + 3 * ux - 9 * nx},${my + 3 * uy - 9 * ny} L${mx + 10 * ux},${my + 10 * uy} L${b.x},${b.y}`;
  } else d = `M${a.x},${a.y} L${b.x},${b.y}`;
  const sel = !exp && SEL.kind === "link" && SEL.id === l.id;
  let s = `<g data-link="${esc(l.id)}">`;
  if (sel) s += `<path d="${d}" fill="none" stroke="${T.accent}" stroke-opacity=".3" stroke-width="${c.w + 10}" stroke-linecap="round" stroke-linejoin="round"/>`;
  s += `<path d="${d}" fill="none" stroke="${c.color}" stroke-width="${c.w}"${c.dash ? ` stroke-dasharray="${c.dash}"` : ""} stroke-linecap="round" stroke-linejoin="round"/>`;
  if (!exp) s += `<path d="${d}" fill="none" stroke="#000" stroke-opacity="0" stroke-width="16"/>`;
  const exitT = (dev, vx, vy) => {
    const hw = Math.max(34, textW(dev) / 2 + 4), top = 28, bottom = labelH(dev) + 2;
    const tx = Math.abs(vx) < 1e-6 ? Infinity : hw / Math.abs(vx);
    const ty = Math.abs(vy) < 1e-6 ? Infinity : (vy > 0 ? bottom : top) / Math.abs(vy);
    return Math.min(tx, ty);
  };
  const ea = exitT(a, ux, uy), eb = exitT(b, -ux, -uy);
  if (S.showLights && c.lights && len > 100) {
    const dot = (x, y) => `<circle cx="${f2(x)}" cy="${f2(y)}" r="4.3" fill="#22c55e" stroke="#0f6b31" stroke-width="1"/>`;
    const ra = Math.min(ea + 6, len / 2 - 6), rb = Math.min(eb + 6, len / 2 - 6);
    s += dot(a.x + ux * ra, a.y + uy * ra) + dot(b.x - ux * rb, b.y - uy * rb);
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
let rafId = 0;
function render() {
  $("gGroups").innerHTML = groupsSvg();
  $("gLinks").innerHTML = S.links.map(l => linkSvg(l, false, TH)).join("");
  $("gDevs").innerHTML = S.devices.map(d => devSvg(d, false, TH)).join("");
  if (!CONNECT.from) $("gOverlay").innerHTML = "";
  $("empty").classList.toggle("hidden", S.devices.length > 0);
  cv.classList.toggle("connect", MODE === "connect");
  status();
}
const scheduleRender = () => { cancelAnimationFrame(rafId); rafId = requestAnimationFrame(render); };
function applyView() { $("world").setAttribute("transform", `translate(${VIEW.x},${VIEW.y}) scale(${VIEW.k})`); status(); }
function status() {
  $("zoomInfo").textContent = Math.round(VIEW.k * 100) + "%";
  let h;
  if (CONNECT.from) { const a = byId(CONNECT.from); h = `🔌 Now click the device to connect ${a ? a.name : ""} to · Esc cancels`; }
  else if (MODE === "connect") h = `🔌 Connect: click a device, then another (${$("cableSel").value === "auto" ? "cable picked for you" : CABLES[$("cableSel").value].label}) · V to stop`;
  else h = `${S.devices.length} devices · ${S.links.length} cables · drag to move · right-click for options · scroll to zoom`;
  $("hint").textContent = h;
}
function buildLegend() {
  $("legend").innerHTML = Object.values(CABLES).map(c => `<span><svg viewBox="0 0 24 8"><path d="M1,4 H23" stroke="${c.color}" stroke-width="${Math.min(c.w, 3.5)}"${c.dash ? ` stroke-dasharray="${c.dash.split(" ").map(n => n / 2).join(" ")}"` : ""}/></svg>${esc(c.label.replace(" straight-through", ""))}</span>`).join("");
}

