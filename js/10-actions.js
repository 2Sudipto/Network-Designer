// ======================================================================= ACTIONS
function select(kind, id) { SEL = {kind, id}; EDITKEY = null; render(); inspector(); }
function setMode(m) {
  MODE = m; CONNECT.from = null; CONNECT.port = null; hidePortPick(); hidePop();
  PDU_PICK.from = null;
  $("gOverlay").innerHTML = "";
  document.querySelectorAll("#toolSeg [data-tool]").forEach(b => b.classList.toggle("on", b.dataset.tool === m));
  document.querySelectorAll("#dtiles [data-cable]").forEach(b => b.classList.toggle("on", m === "connect" && b.dataset.cable === CABLE));
  render();
}
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
  S.devices.push(d);
  if (typeof initDevice === "function") initDevice(d);
  select("dev", d.id); save();
  toast(`Added ${d.name} (${d.model}). Pick a cable in Connections to wire it.`);
  return d;
}

// ---- cabling
function makeLink(a, pa, b, pb, cable) {
  commit();
  const l = {id: nid("l"), a: a.id, b: b.id, cable, pa: pa || "", pb: pb || ""};
  S.links.push(l);
  if (typeof onTopologyChange === "function") onTopologyChange();
  save();
  toast(`${a.name} ${l.pa} ↔ ${b.name} ${l.pb} · ${CABLES[cable].label}`);
  select("link", l.id);
  return l;
}
function connect(a, b) {
  const cable = CABLE === "auto" ? autoCable(a, b) : CABLE;
  if (cable === "wireless") return makeLink(a, "", b, "", cable);
  const pa = pickPort(a, b, cable), pb = pickPort(b, a, cable);
  if (!pa || !pb) { toast(`No free ${CABLES[cable].short} port on ${!pa ? a.name : b.name}.`); return null; }
  return makeLink(a, pa, b, pb, cable);
}
function compatiblePorts(dev, cable) {
  const kinds = CABLES[cable].kinds;
  let ports = allPorts(dev);
  if (dev.type === "laptop" && cable !== "wireless") ports = ports.filter(p => p !== "Wireless0");
  return ports.filter(p => kinds.includes(portKind(p)));
}
const portPick = $("portpick");
function hidePortPick() { portPick.classList.add("hidden"); }
function showPortPick(dev, cable, x, y, done) {
  const used = usedPorts(dev.id), ports = compatiblePorts(dev, cable);
  if (!ports.length) { toast(`${dev.name} (${dev.model}) has no port for a ${CABLES[cable].short} cable.`); return false; }
  portPick.innerHTML = `<div class="ct">${esc(dev.name)} · ${esc(CABLES[cable].short)}</div>` +
    ports.map(p => `<button data-p="${esc(p)}"${used.has(p) ? " disabled" : ""}><span class="pdot ${used.has(p) ? "used" : ""}"></span><span>${esc(p)}</span>${used.has(p) ? '<small>in use</small>' : ""}</button>`).join("");
  portPick.querySelectorAll("[data-p]").forEach(b => b.onclick = () => { hidePortPick(); done(b.dataset.p); });
  portPick.classList.remove("hidden");
  const r = portPick.getBoundingClientRect();
  portPick.style.left = Math.max(8, Math.min(x + 6, innerWidth - r.width - 8)) + "px";
  portPick.style.top = Math.max(8, Math.min(y + 6, innerHeight - r.height - 8)) + "px";
  return true;
}
function handleConnectClick(d, ev) {
  hidePortPick();
  if (CONNECT.from === d.id) { CONNECT.from = null; CONNECT.port = null; render(); return; }
  const cable = CABLE;
  // Automatic: two clicks, ports chosen for you
  if (cable === "auto" || cable === "wireless") {
    if (!CONNECT.from) { CONNECT.from = d.id; render(); return; }
    const a = byId(CONNECT.from); CONNECT.from = null; $("gOverlay").innerHTML = "";
    if (a) connect(a, d);
    if (cable === "wireless") setMode("connect");
    return;
  }
  // Specific cable: pick a port on each end, like Packet Tracer
  const x = ev ? ev.clientX : innerWidth / 2, y = ev ? ev.clientY : innerHeight / 2;
  if (!CONNECT.from) {
    showPortPick(d, cable, x, y, p => { CONNECT.from = d.id; CONNECT.port = p; render(); });
    return;
  }
  const a = byId(CONNECT.from), pa = CONNECT.port;
  showPortPick(d, cable, x, y, p => {
    CONNECT.from = null; CONNECT.port = null; $("gOverlay").innerHTML = "";
    if (!a) return;
    if (cable === "console") {
      const k1 = portKind(pa), k2 = portKind(p);
      if (k1 === k2) { toast("A console cable goes from a PC's RS232 port to a router/switch Console port."); render(); return; }
    }
    makeLink(a, pa, d, p, cable);
  });
}
function startConnectFrom(id) { if (CABLE !== "auto") CABLE = "auto"; setMode("connect"); CONNECT.from = id; render(); }

// ---- delete / duplicate
function deleteItem(kind, id) {
  commit();
  if (kind === "dev") { S.links = S.links.filter(l => l.a !== id && l.b !== id); S.devices = S.devices.filter(d => d.id !== id); if (typeof closeDeviceWindow === "function") closeDeviceWindow(id); }
  else if (kind === "link") S.links = S.links.filter(l => l.id !== id);
  else if (kind === "note") S.notes = S.notes.filter(n => n.id !== id);
  else if (kind === "area") S.areas = S.areas.filter(a => a.id !== id);
  if (typeof onTopologyChange === "function") onTopologyChange();
  if (SEL.id === id) SEL = {kind: null, id: null};
  render(); inspector(); save();
}
function deleteSel() { if (SEL.kind) deleteItem(SEL.kind, SEL.id); }
function duplicateSel() {
  if (SEL.kind !== "dev") return;
  const s = byId(SEL.id); if (!s) return;
  commit();
  const d = JSON.parse(JSON.stringify(s));
  Object.assign(d, {id: nid("d"), name: nextName(TYPES[s.type].prefix), x: s.x + 40, y: s.y + 40});
  S.devices.push(d); select("dev", d.id); save();
}

// ---- notes and areas
function addNote(p) {
  const text = prompt("Note text (use \\n for a new line):", "Note");
  if (text == null || !text.trim()) return;
  commit();
  const n = {id: nid("n"), x: Math.round(p.x), y: Math.round(p.y), text: text.replace(/\\n/g, "\n")};
  S.notes.push(n); select("note", n.id); save();
}
function addArea(r) {
  if (r.w < 20 || r.h < 20) return;
  commit();
  const a = {id: nid("a"), x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.w), h: Math.round(r.h), label: "Area " + (S.areas.length + 1), color: AREA_COLORS[S.areas.length % AREA_COLORS.length]};
  S.areas.push(a); select("area", a.id); save();
}

// ---- inspect popover (Inspect tool)
const pop = document.createElement("div"); pop.className = "ctx inspop hidden"; document.body.appendChild(pop);
function hidePop() { pop.classList.add("hidden"); }
function inspectDevice(d, ev) {
  const ports = allPorts(d).filter(p => portKind(p) !== "wireless" || d.type === "laptop" || d.type === "tablet");
  const used = ports.filter(p => S.links.some(x => (x.a === d.id && x.pa === p) || (x.b === d.id && x.pb === p)));
  const empty = ports.length - used.length;
  const rows = used.map(p => {
    const l = S.links.find(x => (x.a === d.id && x.pa === p) || (x.b === d.id && x.pb === p));
    let st = "—", nb = "";
    if (l) { const s = linkStatus(l), mine = l.a === d.id, o = byId(mine ? l.b : l.a); st = (mine ? s.a : s.b) || "up"; nb = `${o ? o.name : "?"} ${mine ? l.pb : l.pa}`; }
    else if (!portAdminUp(d, p)) st = "admin down";
    const cls = st === "up" ? "ok" : st === "block" ? "warn" : st === "—" ? "" : "fail";
    const lbl = st === "up" ? "up" : st === "block" ? "blocking" : st === "—" ? "not connected" : st;
    return `<tr><td>${esc(p)}</td><td class="${cls}">${esc(lbl)}</td><td>${esc(nb)}</td></tr>`;
  }).join("") + (empty ? `<tr><td colspan="3" class="muted">${used.length ? "+ " : ""}${empty} empty port${empty === 1 ? "" : "s"}</td></tr>` : "");
  const extra = typeof inspectExtra === "function" ? inspectExtra(d) : "";
  pop.innerHTML = `<div class="ct">${esc(d.name)} · ${esc(d.model)}</div><div class="popb"><table class="pdutbl"><tr><th>Port</th><th>Status</th><th>Connected to</th></tr>${rows}</table>${extra}</div>`;
  pop.classList.remove("hidden");
  const r = pop.getBoundingClientRect();
  pop.style.left = Math.max(8, Math.min(ev.clientX + 10, innerWidth - r.width - 8)) + "px";
  pop.style.top = Math.max(8, Math.min(ev.clientY + 10, innerHeight - r.height - 8)) + "px";
}
