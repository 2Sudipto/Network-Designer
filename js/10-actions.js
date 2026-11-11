// ======================================================================= ACTIONS
function select(kind, id) { SEL = {kind, id}; EDITKEY = null; render(); inspector(); }
function setMode(m) { MODE = m; CONNECT.from = null; $("gOverlay").innerHTML = ""; $("mSelect").classList.toggle("on", m === "select"); $("mConnect").classList.toggle("on", m === "connect"); render(); }
function freeSpot(p) {
  for (let i = 0; i < 60; i++) {
    const ang = i * 2.4, rad = i ? 40 + i * 14 : 0, x = p.x + Math.cos(ang) * rad, y = p.y + Math.sin(ang) * rad;
    if (!S.devices.some(d => Math.abs(d.x - x) < 130 && y > d.y - 100 && y < d.y + labelH(d) + 60)) return {x, y};
  }
  return p;
}
function nextName(prefix) { const names = new Set(S.devices.map(d => d.name)); let i = 1; while (names.has(prefix + i)) i++; return prefix + i; }
function addDevice(type, at, model) {
  commit();
  const T = TYPES[type], p = at || freeSpot(viewCenter());
  const g = v => S.snap ? Math.round(v / 10) * 10 : Math.round(v);
  const d = {id: nid("d"), name: nextName(T.prefix), type, model: model || T.def, ip: "", group: "", x: g(p.x), y: g(p.y)};
  S.devices.push(d); select("dev", d.id); save();
  toast(`Added ${d.name} (${d.model}). Press C to cable it.`);
  return d;
}
function connect(a, b) {
  commit();
  const cable = $("cableSel").value === "auto" ? autoCable(a, b) : $("cableSel").value;
  const l = {id: nid("l"), a: a.id, b: b.id, cable, pa: "", pb: ""};
  if (cable !== "wireless") { l.pa = pickPort(a, b); l.pb = pickPort(b, a); }
  S.links.push(l); save();
  toast(`${a.name} ${l.pa} ↔ ${b.name} ${l.pb} · ${CABLES[cable].label}`);
  select("link", l.id);
}
function handleConnectClick(d) {
  if (!CONNECT.from) { CONNECT.from = d.id; render(); return; }
  if (CONNECT.from === d.id) { CONNECT.from = null; render(); return; }
  const a = byId(CONNECT.from); CONNECT.from = null; $("gOverlay").innerHTML = "";
  if (a) connect(a, d);
}
function deleteSel() {
  if (SEL.kind === "dev") { commit(); const id = SEL.id; S.links = S.links.filter(l => l.a !== id && l.b !== id); S.devices = S.devices.filter(d => d.id !== id); }
  else if (SEL.kind === "link") { commit(); S.links = S.links.filter(l => l.id !== SEL.id); }
  else return;
  select(null, null); save();
}
function duplicateSel() {
  if (SEL.kind !== "dev") return;
  const s = byId(SEL.id); if (!s) return;
  commit();
  const d = Object.assign({}, s, {id: nid("d"), name: nextName(TYPES[s.type].prefix), x: s.x + 40, y: s.y + 40});
  S.devices.push(d); select("dev", d.id); save();
}
function startConnectFrom(id) { setMode("connect"); CONNECT.from = id; render(); }

