// ======================================================================= EXAMPLES / PROJECT
function makeBuilder() {
  const s = blank();
  const D = (name, type, ip, group, model) => { const d = {id: nid("d"), name, type, model: model || TYPES[type].def, ip: ip || "", group: group || "", x: 0, y: 0}; s.devices.push(d); return d; };
  const L = (a, pa, b, pb, cable) => { s.links.push({id: nid("l"), a: a.id, pa, b: b.id, pb, cable}); };
  return {s, D, L};
}
function exampleLab() {
  const {s, D, L} = makeBuilder(); s.title = "Lab 01 — Edison Smiles Dental";
  const web = D("WEB SERVER", "server", "www.EdisonSmiles.com"), r = D("EDISON-SMILES", "router"), m = D("ES-MAIN", "switch");
  const f = D("ES-FRONT", "switch", "", "Front desk"), c = D("ES-CLINIC", "switch", "", "Clinic");
  L(web, "Fa0", r, "G0/0/1", "copper"); L(r, "G0/0/0", m, "G0/1", "copper"); L(m, "Fa0/24", f, "Fa0/24", "crossover"); L(m, "Fa0/23", c, "Fa0/24", "crossover");
  ["A", "B", "C"].forEach((x, i) => L(f, "Fa0/" + (i + 1), D("ES-FR-PC" + x, "pc", "", "Front desk"), "Fa0", "copper"));
  ["A", "B", "C"].forEach((x, i) => L(c, "Fa0/" + (i + 1), D("ES-CL-PC" + x, "pc", "", "Clinic"), "Fa0", "copper"));
  return s;
}
function exampleLan() {
  const {s, D, L} = makeBuilder(); s.title = "Small LAN"; s.dir = "TB";
  const r = D("R1", "router", "G0/0 192.168.1.1/24", "", "1941"), sw = D("SW1", "switch", "VLAN1 192.168.1.2/24");
  L(r, "G0/0", sw, "G0/1", "copper");
  [1, 2, 3].forEach(i => L(sw, "Fa0/" + i, D("PC" + i, "pc", "192.168.1." + (10 + i) + "/24"), "Fa0", "copper"));
  return s;
}
function exampleCompany() {
  const {s, D, L} = makeBuilder(); s.title = "Small company network";
  const isp = D("ISP", "cloud", "203.0.113.1"), fw = D("FW1", "firewall", "outside 203.0.113.2/30", "", "FPR-1010"), r = D("R1", "router", "G0/0/0 10.0.0.1/30", "", "C8200-1N-4T"), mls = D("CORE1", "l3switch", "VLAN10 10.1.10.1/24\nVLAN20 10.1.20.1/24", "", "C9300-24P");
  const s1 = D("ACC1", "switch", "", "Office", "C9200-24P"), s2 = D("ACC2", "switch", "", "Office", "C9200-24P");
  const web = D("SRV-WEB", "server", "10.1.99.10/24", "Server room"), dns = D("SRV-DNS", "server", "10.1.99.11/24", "Server room");
  L(isp, "Eth0", fw, "Eth1/1", "copper"); L(fw, "Eth1/2", r, "G0/0/1", "copper"); L(r, "G0/0/0", mls, "Te1/1/1", "fiber");
  L(mls, "G1/0/1", s1, "G1/1/1", "crossover"); L(mls, "G1/0/2", s2, "G1/1/1", "crossover"); L(mls, "G1/0/23", web, "G0", "copper"); L(mls, "G1/0/24", dns, "G0", "copper");
  L(s1, "G1/0/1", D("PC1", "pc", "10.1.10.11/24", "Office"), "Fa0", "copper"); L(s1, "G1/0/2", D("PC2", "pc", "10.1.10.12/24", "Office"), "Fa0", "copper"); L(s1, "G1/0/3", D("PH1", "phone", "", "Office"), "Switch", "copper");
  const ap = D("AP1", "ap", "SSID Corp", "Office", "C9120AXI");
  L(s2, "G1/0/1", ap, "G0", "copper"); L(s2, "G1/0/2", D("PRN1", "printer", "10.1.10.50/24", "Office"), "Fa0", "copper"); L(ap, "", D("LT1", "laptop", "DHCP", "Office"), "", "wireless");
  return s;
}
function exampleWan() {
  const {s, D, L} = makeBuilder(); s.title = "Two sites over a WAN";
  const ny = D("R-NY", "router", "G0/0 10.1.1.1/24\nS0/0/0 10.0.0.1/30", "New York", "2911"), nj = D("R-NJ", "router", "G0/0 10.2.2.1/24\nS0/0/0 10.0.0.2/30", "New Jersey", "2911");
  const sny = D("SW-NY", "switch", "", "New York"), snj = D("SW-NJ", "switch", "", "New Jersey");
  L(ny, "S0/0/0", nj, "S0/0/0", "serialDCE"); L(ny, "G0/0", sny, "G0/1", "copper"); L(nj, "G0/0", snj, "G0/1", "copper");
  L(sny, "Fa0/1", D("PC-NY", "pc", "10.1.1.10/24", "New York"), "Fa0", "copper"); L(snj, "Fa0/1", D("PC-NJ", "pc", "10.2.2.10/24", "New Jersey"), "Fa0", "copper");
  return s;
}
function loadProject(s, msg) { commit(); const style = S.iconStyle; S = Object.assign(blank(), s); if (typeof initAll === "function") initAll(); S.iconStyle = style || "cisco"; fixUid(); SEL = {kind: null, id: null}; CONNECT.from = null; arrange(S.dir || "LR", true); inspector(); if (msg) toast(msg); }
function closeMenus() { document.querySelectorAll("details.menu[open]").forEach(d => d.removeAttribute("open")); }
document.addEventListener("click", e => { if (!e.target.closest("details.menu")) closeMenus(); });
$("exLab").onclick = () => { closeMenus(); loadProject(exampleLab(), "Loaded Kalloo Lab 01"); };
$("exLan").onclick = () => { closeMenus(); loadProject(exampleLan(), "Loaded small LAN"); };
$("exCo").onclick = () => { closeMenus(); loadProject(exampleCompany(), "Loaded small company"); };
$("exWan").onclick = () => { closeMenus(); loadProject(exampleWan(), "Loaded two-site WAN"); };
$("newDiag").onclick = () => { closeMenus(); commit(); S = Object.assign(blank(), {dir: S.dir, iconStyle: S.iconStyle}); select(null, null); save(); fit(); toast("New diagram. Undo (Ctrl+Z) brings the old one back."); };
$("saveJson").onclick = () => { closeMenus(); download(fileBase() + ".json", new Blob([JSON.stringify(S, null, 2)], {type: "application/json"})); };
$("openJson").onclick = () => { closeMenus(); $("file").click(); };
$("file").onchange = e => {
  const f = e.target.files[0]; if (!f) return;
  f.text().then(t => {
    try {
      const v = JSON.parse(t); if (!Array.isArray(v.devices) || !Array.isArray(v.links)) throw new Error("bad");
      const needLayout = v.devices.some(d => typeof d.x !== "number");
      commit(); S = migrate(v); fixUid(); select(null, null);
      if (needLayout) arrange(S.dir || "LR", true); else { render(); fit(); }
      buildPalette(); save(); toast("Opened " + f.name);
    } catch (_) { toast("That file isn't a diagram project."); }
  });
  e.target.value = "";
};
function migrate(v) {
  const out = Object.assign(blank(), v);
  if (!out.iconStyle) out.iconStyle = "cisco";
  out.devices = v.devices.map((d, i) => { const type = TYPES[d.type] ? d.type : "pc"; return {id: d.id || "d" + (900 + i), name: d.name || "?", type, model: d.model ? d.model : TYPES[type].def, ip: d.ip != null ? d.ip : (d.info || ""), group: d.group || "", x: typeof d.x === "number" ? d.x : 0, y: typeof d.y === "number" ? d.y : 0}; });
  const legacy = {serial: "serialDCE", trunk: "crossover"};
  out.devices.forEach((d, i) => { const o = v.devices[i]; for (const k of ["cfg", "startup", "host", "svc"]) if (o[k]) d[k] = o[k]; });
  out.links = v.links.filter(l => l.a && l.b).map((l, i) => ({id: l.id || "l" + (900 + i), a: l.a, b: l.b, pa: l.pa || "", pb: l.pb || "", cable: legacy[l.cable] || (CABLES[l.cable] && !CABLES[l.cable].virtual ? l.cable : "copper")}));
  out.notes = Array.isArray(v.notes) ? v.notes : [];
  out.areas = Array.isArray(v.areas) ? v.areas : [];
  return out;
}

