// ======================================================================= GEOMETRY
const textW = d => Math.max(d.name.length * 7.6, S.showModel && d.model ? d.model.length * 6.2 : 0, ...(S.showIP ? ipLines(d).map(s => s.length * 6.4) : [0]));
const labelH = d => 40 + (S.showModel && d.model ? 14 : 0) + (S.showIP ? ipLines(d).length * 13.5 : 0);
function groupRects() {
  const names = [...new Set(S.devices.map(d => (d.group || "").trim()).filter(Boolean))];
  return names.map((g, i) => {
    const ds = S.devices.filter(d => (d.group || "").trim() === g);
    let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
    ds.forEach(d => { const hw = Math.max(50, textW(d) / 2 + 12); x1 = Math.min(x1, d.x - hw); x2 = Math.max(x2, d.x + hw); y1 = Math.min(y1, d.y - 56); y2 = Math.max(y2, d.y + labelH(d) + 12); });
    x2 = Math.max(x2, x1 + g.length * 7.5 + 30);
    return {name: g, x: x1, y: y1, w: x2 - x1, h: y2 - y1, color: GROUP_COLORS[i % GROUP_COLORS.length]};
  });
}
function contentBox() {
  if (!S.devices.length && !(S.areas || []).length && !(S.notes || []).length) return {x: -300, y: -200, w: 600, h: 400};
  let x1 = Infinity, y1 = Infinity, x2 = -Infinity, y2 = -Infinity;
  for (const a of S.areas || []) { x1 = Math.min(x1, a.x); y1 = Math.min(y1, a.y); x2 = Math.max(x2, a.x + a.w); y2 = Math.max(y2, a.y + a.h); }
  for (const n of S.notes || []) { const b = noteBox(n); x1 = Math.min(x1, n.x); y1 = Math.min(y1, n.y); x2 = Math.max(x2, n.x + b.w); y2 = Math.max(y2, n.y + b.h); }
  for (const d of S.devices) { const hw = Math.max(40, textW(d) / 2 + 6); x1 = Math.min(x1, d.x - hw); x2 = Math.max(x2, d.x + hw); y1 = Math.min(y1, d.y - 32); y2 = Math.max(y2, d.y + labelH(d) + 6); }
  for (const g of groupRects()) { x1 = Math.min(x1, g.x); y1 = Math.min(y1, g.y); x2 = Math.max(x2, g.x + g.w); y2 = Math.max(y2, g.y + g.h); }
  return {x: x1, y: y1, w: x2 - x1, h: y2 - y1};
}

