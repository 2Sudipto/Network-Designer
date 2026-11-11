// ======================================================================= STATE
const KEY = "ndb.v2";
const blank = () => ({v: 3, title: "", dir: "LR", iconStyle: "cisco", showModel: true, showIP: true, showPorts: true, showLights: true, snap: true, devices: [], links: []});
let S = blank();
let uid = 1;
const nid = p => p + (uid++);
function fixUid() { for (const o of [...S.devices, ...S.links]) { const n = parseInt(String(o.id).replace(/\D/g, ""), 10); if (n >= uid) uid = n + 1; } }
const byId = id => S.devices.find(d => d.id === id);
const byLink = id => S.links.find(l => l.id === id);
const ipLines = d => String(d.ip || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);
const icon = type => (S.iconStyle === "realistic" ? ICON_REAL : ICON_CISCO)[type] || ICON_REAL[type] || ICON_REAL.pc;
const iconSvg = type => `<svg viewBox="-34 -27 68 54" aria-hidden="true">${icon(type)}</svg>`;
let SEL = {kind: null, id: null}, MODE = "select", VIEW = {x: 0, y: 0, k: 1}, TH = THEMES.light, EDITKEY = null;
const CONNECT = {from: null};
const cv = $("cv");

