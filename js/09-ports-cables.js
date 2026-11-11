// ======================================================================= PORTS & CABLES
function usedPorts(id, except) { const u = new Set(); S.links.forEach(l => { if (l === except) return; if (l.a === id && l.pa) u.add(l.pa); if (l.b === id && l.pb) u.add(l.pb); }); return u; }
const INFRA = ["router", "switch", "l3switch", "hub", "firewall", "cloud", "wlc"];
const HAS_CONSOLE = ["router", "switch", "l3switch", "firewall", "wlc"];

// What kind of physical port is this? Decides which cables can plug in.
function portKind(p) {
  if (/^console$/i.test(p)) return "console";
  if (/^rs232$/i.test(p)) return "rs232";
  if (/^wireless/i.test(p)) return "wireless";
  if (/^(s|se|serial)\d/i.test(p)) return "serial";
  return "eth";
}
function modelOf(dev) { return findModel(dev.type, dev.model) || findModel(dev.type, TYPES[dev.type].def); }
function allPorts(dev) {
  const m = modelOf(dev);
  const ports = m ? [...m.access, ...m.up] : [];
  if (HAS_CONSOLE.includes(dev.type)) ports.push("Console");
  return ports;
}
// Ports in the order they should be auto-picked. `cable` limits them to compatible kinds.
function portList(dev, other, cable) {
  const m = modelOf(dev); if (!m) return [];
  const kinds = cable && CABLES[cable] && CABLES[cable].kinds;
  let list;
  if (!m.up.length) list = dev.type === "laptop" && cable !== "wireless" ? m.access.filter(p => p !== "Wireless0") : m.access.slice();
  else {
    const infra = other && INFRA.includes(other.type);
    list = infra ? [...m.up, ...m.access.slice().reverse()] : [...m.access, ...m.up];
  }
  if (HAS_CONSOLE.includes(dev.type)) list.push("Console");
  if (kinds) list = list.filter(p => kinds.includes(portKind(p)));
  else list = list.filter(p => portKind(p) === "eth");
  return list;
}
function pickPort(dev, other, cable) { const used = usedPorts(dev.id); return portList(dev, other, cable).find(p => !used.has(p)) || ""; }
function autoCable(a, b) {
  const t = [a.type, b.type];
  if (t.includes("tablet")) return "wireless";
  if ((t.includes("ap") || t.includes("wlc")) && t.includes("laptop")) return "wireless";
  if (t.includes("cloud")) return "copper";
  const sw = x => TYPES[x].cat === "sw";
  return sw(a.type) === sw(b.type) ? "crossover" : "copper";
}
// A cable only works if both ends are plugged into a port of a kind it supports
function cableFits(l) {
  const c = CABLES[l.cable] || CABLES.copper;
  if (!c.kinds || l.cable === "wireless") return true;
  return [l.pa, l.pb].every(p => !p || c.kinds.includes(portKind(p)));
}
const portSummary = dev => { const m = modelOf(dev); if (!m) return ""; const g = arr => arr.length > 2 ? `${arr[0]}–${arr[arr.length - 1].split("/").pop()}` : arr.join(", "); return `${m.access.length + m.up.length} ports: ${g(m.access)}${m.up.length ? " + " + g(m.up) : ""}`; };

// ---- link status (green / orange / red lights). Later phases plug real config and STP in here.
function portAdminUp(dev, port) {
  const c = dev && dev.cfg && dev.cfg.ifaces && dev.cfg.ifaces[port];
  return !(c && c.shutdown);
}
function portBlocked(dev, port) { return typeof stpBlocked === "function" ? stpBlocked(dev, port) : false; }
function linkStatus(l) {
  const a = byId(l.a), b = byId(l.b), c = CABLES[l.cable] || CABLES.copper;
  if (!a || !b || !c.lights) return {up: true, a: null, b: null};
  const up = portAdminUp(a, l.pa) && portAdminUp(b, l.pb) && cableFits(l);
  const st = (dev, port) => !up ? "down" : portBlocked(dev, port) ? "block" : "up";
  return {up, a: st(a, l.pa), b: st(b, l.pb)};
}
const LIGHT = {up: ["#22c55e", "#0f6b31"], block: ["#f59e0b", "#92400e"], down: ["#ef4444", "#7f1d1d"]};
