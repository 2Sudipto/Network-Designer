// ======================================================================= PALETTE
function palItem(type, model, isModel) {
  const b = document.createElement("button");
  b.className = "pal" + (isModel ? " model" : "");
  b.draggable = true;
  const m = model ? findModel(type, model) : null;
  b.title = isModel ? `${TYPES[type].label} ${model}: ${m ? m.desc : ""}. Drag onto the canvas or click to add.` : `${TYPES[type].label}: drag onto the canvas, or click to add. Search for a model name to pick a specific one.`;
  b.innerHTML = iconSvg(type) + (isModel ? `<span><b>${esc(model)}</b><br><small>${esc(TYPES[type].label)} · ${esc(m ? m.desc : "")}</small></span>` : `<span>${esc(TYPES[type].label)}</span>`);
  b.addEventListener("dragstart", e => { e.dataTransfer.setData("text/x-device", type + "|" + (model || "")); e.dataTransfer.effectAllowed = "copy"; });
  b.addEventListener("click", () => addDevice(type, null, model || undefined));
  return b;
}
function buildPalette() {
  const el = $("plist"), q = $("psearch").value.trim().toLowerCase();
  el.innerHTML = "";
  if (!q) {
    PALETTE.forEach(([title, types]) => {
      const h = document.createElement("h3"); h.textContent = title; el.appendChild(h);
      const g = document.createElement("div"); g.className = "pgrid"; types.forEach(t => g.appendChild(palItem(t))); el.appendChild(g);
    });
    const h = document.createElement("h3"); h.innerHTML = "<span>Popular Cisco models</span>"; el.appendChild(h);
    const g = document.createElement("div"); g.className = "pgrid";
    [["router", "1941"], ["router", "2911"], ["router", "ISR4331"], ["switch", "2960-24TT"], ["switch", "C9300-48P"], ["l3switch", "3650-24PS"], ["firewall", "ASA 5506-X"], ["wlc", "WLC-3504"]].forEach(([t, m]) => g.appendChild(palItem(t, m, true)));
    el.appendChild(g);
    return;
  }
  const types = Object.keys(TYPES).filter(t => TYPES[t].label.toLowerCase().includes(q) || t.includes(q));
  const models = ALLMODELS.filter(m => (m.name + " " + m.desc + " " + m.series + " " + TYPES[m.type].label).toLowerCase().includes(q));
  if (types.length) { const g = document.createElement("div"); g.className = "pgrid"; types.forEach(t => g.appendChild(palItem(t))); el.appendChild(g); }
  if (models.length) {
    const h = document.createElement("h3"); h.textContent = `Models (${models.length})`; el.appendChild(h);
    const g = document.createElement("div"); g.className = "pgrid"; models.forEach(m => g.appendChild(palItem(m.type, m.name, true))); el.appendChild(g);
  }
  if (!types.length && !models.length) el.innerHTML = `<p class="pempty">Nothing matches "${esc(q)}". Try "router", "2960", "9300" or "ASA".</p>`;
}
$("psearch").addEventListener("input", buildPalette);

