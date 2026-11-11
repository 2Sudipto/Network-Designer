// ======================================================================= AUTO LAYOUT
function arrange(dir, quiet) {
  if (!S.devices.length) return;
  if (!quiet) commit();
  S.dir = dir;
  const adj = new Map(S.devices.map(d => [d.id, []]));
  S.links.forEach(l => { if (adj.has(l.a) && adj.has(l.b)) { adj.get(l.a).push(l.b); adj.get(l.b).push(l.a); } });
  const rank = d => d.type === "cloud" ? 0 : (d.type === "server" && adj.get(d.id).some(n => byId(n).type === "router")) ? 1 : d.type === "firewall" ? 2 : d.type === "router" ? 3 : d.type === "l3switch" ? 4 : d.type === "switch" ? 5 : 9;
  const left = new Set(S.devices.map(d => d.id));
  const LEAF = dir === "LR" ? 100 : 130, DEPTH = dir === "LR" ? 220 : 175;
  let offset = 0;
  while (left.size) {
    const root = S.devices.filter(d => left.has(d.id)).sort((a, b) => rank(a) - rank(b) || adj.get(b.id).length - adj.get(a.id).length)[0];
    const children = new Map(), depth = new Map([[root.id, 0]]), order = [root.id];
    left.delete(root.id);
    for (let i = 0; i < order.length; i++) {
      const u = order[i]; children.set(u, []);
      for (const v of adj.get(u)) if (left.has(v)) { left.delete(v); depth.set(v, depth.get(u) + 1); children.get(u).push(v); order.push(v); }
    }
    const grp = id => ((byId(id) || {}).group || "").trim();
    children.forEach(ch => { const first = new Map(); ch.forEach((x, i) => { if (!first.has(grp(x))) first.set(grp(x), i); }); ch.sort((x, y) => first.get(grp(x)) - first.get(grp(y))); });
    let next = 0, lastGroup = null; const pos = new Map();
    const place = u => {
      const ch = children.get(u);
      if (!ch.length) { const g = grp(u); if (lastGroup !== null && g !== lastGroup) next += 0.9; lastGroup = g; pos.set(u, next++); return pos.get(u); }
      const ps = ch.map(place);
      // line a device up with its children from the SAME group, so group boxes don't overlap
      const g = grp(u), same = g ? ps.filter((_, i) => grp(ch[i]) === g) : [];
      const p = same.length && same.length < ps.length ? (same[0] + same[same.length - 1]) / 2 : (ps[0] + ps[ps.length - 1]) / 2;
      pos.set(u, p); return p;
    };
    place(root.id);
    order.forEach(id => { const d = byId(id); const across = offset + pos.get(id) * LEAF, along = depth.get(id) * DEPTH; if (dir === "LR") { d.x = along; d.y = across; } else { d.x = across; d.y = along; } });
    offset += next * LEAF + LEAF * 0.8;
  }
  render(); inspector(); save(); requestAnimationFrame(fit);
}

