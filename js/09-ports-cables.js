// ======================================================================= PORTS & CABLES
function usedPorts(id, except) { const u = new Set(); S.links.forEach(l => { if (l === except) return; if (l.a === id && l.pa) u.add(l.pa); if (l.b === id && l.pb) u.add(l.pb); }); return u; }
const INFRA = ["router", "switch", "l3switch", "hub", "firewall", "cloud", "wlc"];
function modelOf(dev) { return findModel(dev.type, dev.model) || findModel(dev.type, TYPES[dev.type].def); }
function allPorts(dev) { const m = modelOf(dev); return m ? [...m.access, ...m.up] : []; }
function portList(dev, other) {
  const m = modelOf(dev); if (!m) return [];
  if (!m.up.length) return dev.type === "laptop" ? m.access.filter(p => p !== "Wireless0") : m.access;
  const infra = other && INFRA.includes(other.type);
  return infra ? [...m.up, ...m.access.slice().reverse()] : [...m.access, ...m.up];
}
function pickPort(dev, other) { const used = usedPorts(dev.id); return portList(dev, other).find(p => !used.has(p)) || ""; }
function autoCable(a, b) {
  const t = [a.type, b.type];
  if (t.includes("tablet")) return "wireless";
  if ((t.includes("ap") || t.includes("wlc")) && t.includes("laptop")) return "wireless";
  if (t.includes("cloud")) return "copper";
  const sw = x => TYPES[x].cat === "sw";
  return sw(a.type) === sw(b.type) ? "crossover" : "copper";
}
const portSummary = dev => { const m = modelOf(dev); if (!m) return ""; const g = arr => arr.length > 2 ? `${arr[0]}–${arr[arr.length - 1].split("/").pop()}` : arr.join(", "); return `${m.access.length + m.up.length} ports: ${g(m.access)}${m.up.length ? " + " + g(m.up) : ""}`; };

