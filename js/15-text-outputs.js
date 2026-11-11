// ======================================================================= TEXT OUTPUTS
const nameOf = id => (byId(id) || {}).name || "?";
function cablingTable() {
  const rows = S.links.map(l => `| ${nameOf(l.a)} | ${l.pa || "—"} | ${nameOf(l.b)} | ${l.pb || "—"} | ${(CABLES[l.cable] || CABLES.copper).label} |`);
  return ["| From | Port | To | Port | Cable |", "|---|---|---|---|---|", ...rows].join("\n");
}
const IPRE = /^(\d{1,3}(?:\.\d{1,3}){3}(?:\/\d{1,2})?|[0-9a-f:]+::?[0-9a-f:]*\/\d{1,3})$/i;
function addressingRows() {
  const rows = [];
  S.devices.forEach(d => {
    const firstPort = (() => { const l = S.links.find(x => x.a === d.id || x.b === d.id); return l ? (l.a === d.id ? l.pa : l.pb) : ""; })();
    ipLines(d).forEach(line => {
      const parts = line.split(/\s+/);
      const ipIdx = parts.findIndex(p => IPRE.test(p));
      if (ipIdx === 0) rows.push([d.name, ["pc", "laptop", "server", "printer", "phone", "tablet"].includes(d.type) ? (firstPort || "NIC") : "", parts[0], parts.slice(1).join(" ")]);
      else if (ipIdx > 0) rows.push([d.name, parts.slice(0, ipIdx).join(" "), parts[ipIdx], parts.slice(ipIdx + 1).join(" ")]);
      else rows.push([d.name, "", "", line]);
    });
  });
  return rows;
}
function addressingTable() {
  const rows = addressingRows();
  return ["| Device | Interface | IP / Prefix | Notes |", "|---|---|---|---|", ...(rows.length ? rows.map(r => `| ${r.join(" | ")} |`) : ["| | | | |"])].join("\n");
}
function deviceTable() {
  return ["| Device | Type | Model | Group |", "|---|---|---|---|", ...S.devices.map(d => `| ${d.name} | ${TYPES[d.type].label} | ${d.model || ""} | ${d.group || ""} |`)].join("\n");
}
function mermaidCode() {
  const m = s => String(s || "").replace(/"/g, "#quot;").replace(/</g, "#lt;").replace(/>/g, "#gt;").replace(/\|/g, "/");
  const L = [`flowchart ${S.dir === "TB" ? "TB" : "LR"}`];
  const node = d => {
    const [o, c] = MSHAPE[d.type] || ["[", "]"];
    let lab = `${EMOJI[d.type] || ""} ${m(d.name)}`;
    if (S.showModel && d.model) lab += `<br/>${m(d.model)}`;
    if (S.showIP) ipLines(d).forEach(x => { lab += `<br/>${m(x)}`; });
    return `${d.id}${o}"${lab}"${c}`;
  };
  const groups = [...new Set(S.devices.map(d => (d.group || "").trim()).filter(Boolean))];
  S.devices.filter(d => !(d.group || "").trim()).forEach(d => L.push("    " + node(d)));
  groups.forEach((g, i) => { L.push(`    subgraph G${i}["${m(g)}"]`); S.devices.filter(d => (d.group || "").trim() === g).forEach(d => L.push("        " + node(d))); L.push("    end"); });
  const styles = [];
  S.links.filter(l => byId(l.a) && byId(l.b)).forEach((l, i) => {
    const c = CABLES[l.cable] || CABLES.copper;
    const line = l.cable === "trunk" ? "===" : (c.dash || l.cable === "serial") ? "-.-" : "---";
    const lab = S.showPorts ? [l.pa, l.pb].filter(Boolean).join(" ↔ ") : "";
    L.push(lab ? `    ${l.a} ${line}|"${m(lab)}"| ${l.b}` : `    ${l.a} ${line} ${l.b}`);
    styles.push(`    linkStyle ${i} stroke:${c.color},stroke-width:${l.cable === "trunk" ? 4 : 2}px`);
  });
  L.push(...styles,
    "    classDef router fill:#1b75bc,color:#fff,stroke:#0b4a7d", "    classDef switch fill:#2c88cd,color:#fff,stroke:#0b4a7d",
    "    classDef host fill:#e9ecef,color:#111,stroke:#6c757d", "    classDef server fill:#6f42c1,color:#fff,stroke:#3d2370",
    "    classDef fw fill:#c0392b,color:#fff,stroke:#7b241c", "    classDef wifi fill:#f39c12,color:#111,stroke:#9a6207", "    classDef cloud fill:#d6eaf8,color:#111,stroke:#5dade2");
  const CLS = {router: "router", switch: "switch", l3switch: "switch", hub: "switch", firewall: "fw", cloud: "cloud", ap: "wifi", wlc: "wifi", server: "server"};
  const by = {};
  S.devices.forEach(d => { const c = CLS[d.type] || "host"; (by[c] = by[c] || []).push(d.id); });
  Object.entries(by).forEach(([c, ids]) => L.push(`    class ${ids.join(",")} ${c}`));
  return L.join("\n");
}
let TAB = "qa";
function outputs() {
  const to = $("qaTo"), cur = to.value;
  to.innerHTML = `<option value="">pick a device…</option>` + S.devices.filter(d => INFRA.includes(d.type) || d.type === "ap").map(d => `<option value="${esc(d.id)}">${esc(d.name)}</option>`).join("");
  if ([...to.options].some(o => o.value === cur)) to.value = cur;
  $("copyOut").classList.toggle("hidden", TAB === "qa");
  if (TAB === "qa") return;
  $("out").textContent = TAB === "cab" ? cablingTable() : TAB === "addr" ? addressingTable() : TAB === "dev" ? deviceTable() : mermaidCode();
  $("outNote").textContent = TAB === "mer" ? "Paste inside a ```mermaid code block in Obsidian. Easier: Export to Obsidian → Note text, which adds the block for you." : TAB === "addr" ? "Built from each device's IP lines. Write them like \"G0/0 192.168.1.1/24\" to fill the Interface column." : "Paste straight into your lab note.";
}
$("tabs").querySelectorAll(".tab").forEach(b => b.onclick = () => {
  TAB = b.dataset.t; $("tabs").querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b));
  $("pane-qa").classList.toggle("hidden", TAB !== "qa"); $("pane-out").classList.toggle("hidden", TAB === "qa"); outputs();
});
$("copyOut").onclick = e => copyText($("out").textContent, "Copied ✓", e.currentTarget);
$("qaType").innerHTML = typeOptions("pc");
$("qaGo").onclick = () => {
  const to = byId($("qaTo").value); if (!to) { toast("Pick which device they connect to."); return; }
  const n = Math.max(1, Math.min(48, parseInt($("qaN").value, 10) || 1)), type = $("qaType").value;
  const prefix = $("qaName").value.trim() || TYPES[type].prefix, first = $("qaPort").value.trim(), mm = first.match(/^(.*?)(\d+)$/), letters = $("qaLetters").checked;
  commit();
  const LR = S.dir !== "TB", sp = LR ? 100 : 130;
  for (let i = 0; i < n; i++) {
    const suf = letters ? String.fromCharCode(65 + (i % 26)) + (i >= 26 ? Math.floor(i / 26) : "") : String(i + 1);
    const off = (i - (n - 1) / 2) * sp;
    const d = {id: nid("d"), name: prefix + suf, type, model: TYPES[type].def, ip: "", group: to.group || "", x: Math.round(LR ? to.x + 220 : to.x + off), y: Math.round(LR ? to.y + off : to.y + 175)};
    S.devices.push(d);
    const cable = autoCable(to, d), l = {id: nid("l"), a: to.id, b: d.id, cable, pa: "", pb: ""};
    if (cable !== "wireless") { l.pa = mm ? mm[1] + (parseInt(mm[2], 10) + i) : (first || pickPort(to, d)); l.pb = pickPort(d, to); }
    S.links.push(l);
  }
  select(null, null); save(); toast(`Added ${n} × ${TYPES[type].label} on ${to.name}. Use Arrange to tidy up.`);
};

