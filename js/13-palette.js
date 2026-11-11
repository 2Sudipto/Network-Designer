// ======================================================================= DOCK (Packet Tracer-style device + connection chooser)
let DOCK_CAT = "routers";
try { DOCK_CAT = localStorage.getItem("ndb.dock") || "routers"; } catch (e) {}
// little cable pictures for the Connections category
function cableIcon(k) {
  if (k === "auto") return `<svg viewBox="0 0 48 40"><path d="M27 3 L12 22 H23 L19 37 L36 16 H25 Z" fill="#f2b705" stroke="#8a6500" stroke-width="1.6" stroke-linejoin="round"/></svg>`;
  const c = CABLES[k];
  let body;
  if (c.zig) body = `<path d="M5,33 L19,25 L26,32 L29,14 L36,21 L43,7" fill="none" stroke="${c.color}" stroke-width="3" stroke-linejoin="round" stroke-linecap="round"/>`;
  else if (k === "wireless") body = `<path d="M10,30 a18,18 0 0 1 28,0 M15,25 a11,11 0 0 1 18,0 M20,20 a5,5 0 0 1 8,0" fill="none" stroke="${c.color}" stroke-width="2.6" stroke-linecap="round"/><circle cx="24" cy="33" r="2.6" fill="${c.color}"/>`;
  else body = `<path d="M5,34 C16,34 14,8 25,8 S35,30 43,6" fill="none" stroke="${c.color}" stroke-width="3"${c.dash ? ` stroke-dasharray="${c.dash.split(" ").map(n => n * .6).join(" ")}"` : ""} stroke-linecap="round"/>`;
  if (c.dce) body += `<circle cx="38" cy="30" r="6" fill="#fff" stroke="${c.color}" stroke-width="1.6"/><path d="M38,26.5 V30 L40.5,31.5" stroke="${c.color}" stroke-width="1.4" fill="none" stroke-linecap="round"/>`;
  if (k === "console") body += `<rect x="1" y="30" width="8" height="8" rx="1.5" fill="#25323f"/><rect x="39" y="2" width="8" height="8" rx="1.5" fill="#25323f"/>`;
  return `<svg viewBox="0 0 48 40">${body}</svg>`;
}
const CABLE_TIPS = {
  auto: "Lets the simulator pick the right cable and the next free ports.",
  console: "Rollover cable: PC RS232 → router/switch Console port. Use it for the PC's Terminal.",
  copper: "Straight-through: different device kinds (PC↔switch, router↔switch).",
  crossover: "Cross-over: same kinds (switch↔switch, router↔router, PC↔PC).",
  fiber: "Fiber: long uplinks between switches/routers with SFP ports.",
  serialDCE: "Serial DCE: the end you click first is DCE and must set `clock rate`.",
  serialDTE: "Serial DTE: the end you click first is DTE (the other end is DCE).",
  wireless: "Associate a laptop/tablet with an access point.",
};
function dockTile(html, label, title) {
  const b = document.createElement("button");
  b.className = "dtile"; b.title = title; b.innerHTML = html + `<span>${esc(label)}</span>`;
  b.addEventListener("mouseenter", () => { $("dlabel").textContent = title; });
  return b;
}
function deviceTile(m) {
  const b = dockTile(iconSvg(m.type), m.name, `${TYPES[m.type].label} ${m.name}: ${m.desc}. Drag onto the workspace or click to add.`);
  b.draggable = true;
  b.addEventListener("dragstart", e => { e.dataTransfer.setData("text/x-device", m.type + "|" + m.name); e.dataTransfer.effectAllowed = "copy"; });
  b.addEventListener("click", () => addDevice(m.type, null, m.name));
  return b;
}
function cableTiles(el) {
  [["auto", CABLES.auto], ...CABLE_LIST].forEach(([k, c]) => {
    const b = dockTile(cableIcon(k), c.short, `${c.label}. ${CABLE_TIPS[k] || ""}`);
    b.classList.add("cab"); b.dataset.cable = k;
    b.classList.toggle("on", MODE === "connect" && CABLE === k);
    b.addEventListener("click", () => {
      if (MODE === "connect" && CABLE === k) { setMode("select"); return; }
      CABLE = k; setMode("connect");
    });
    el.appendChild(b);
  });
}
function buildDock() {
  const cats = $("dcats");
  cats.innerHTML = DOCK_CATS.map(c => `<button class="dcat${c.k === DOCK_CAT ? " on" : ""}" data-k="${c.k}" title="${esc(c.label)}">${c.cables ? cableIcon("auto") : iconSvg(c.icon)}<span>${esc(c.label)}</span></button>`).join("");
  cats.querySelectorAll(".dcat").forEach(b => {
    b.onclick = () => { DOCK_CAT = b.dataset.k; $("psearch").value = ""; try { localStorage.setItem("ndb.dock", DOCK_CAT); } catch (e) {} buildDock(); };
    b.onmouseenter = () => { $("dlabel").textContent = b.title; };
  });
  const el = $("dtiles"), q = $("psearch").value.trim().toLowerCase();
  el.innerHTML = "";
  if (q) {
    const models = ALLMODELS.filter(m => (m.name + " " + m.desc + " " + m.series + " " + TYPES[m.type].label + " " + m.type).toLowerCase().includes(q));
    models.forEach(m => el.appendChild(deviceTile(m)));
    $("dlabel").textContent = models.length ? `${models.length} model${models.length === 1 ? "" : "s"} match "${q}"` : `Nothing matches "${q}". Try "2911", "2960", "9300" or "ASA".`;
    return;
  }
  const cat = DOCK_CATS.find(c => c.k === DOCK_CAT) || DOCK_CATS[0];
  if (cat.cables) { cableTiles(el); $("dlabel").textContent = MODE === "connect" ? CABLES[CABLE].label : "Pick a cable, then click two devices"; return; }
  ALLMODELS.filter(m => cat.types.includes(m.type)).forEach(m => el.appendChild(deviceTile(m)));
  $("dlabel").textContent = `${cat.label}: drag a model onto the workspace`;
}
function buildPalette() { buildDock(); }
$("psearch").addEventListener("input", buildDock);
