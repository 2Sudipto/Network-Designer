// ======================================================================= INSPECTOR
const typeOptions = sel => Object.entries(TYPES).map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(v.label)}</option>`).join("");
const cableOptions = sel => [...CABLE_LIST, ...(CABLES[sel] && CABLES[sel].legacy ? [[sel, CABLES[sel]]] : [])].map(([k, v]) => `<option value="${k}"${k === sel ? " selected" : ""}>${esc(v.label)}</option>`).join("");
const devOptions = sel => S.devices.map(d => `<option value="${esc(d.id)}"${d.id === sel ? " selected" : ""}>${esc(d.name)}</option>`).join("");
function modelOptions(type, cur) {
  const known = !!findModel(type, cur);
  return (MODELS[type] || []).map(([series, ms]) => `<optgroup label="${esc(series)}">${ms.map(m => `<option value="${esc(m.name)}"${m.name === cur ? " selected" : ""}>${esc(m.name)} — ${esc(m.desc)}</option>`).join("")}</optgroup>`).join("") +
    `<option value="__custom"${known ? "" : " selected"}>Other / custom…</option>`;
}
function portOptions(dev, other, link) {
  if (!dev) return "";
  const used = usedPorts(dev.id, link);
  const all = [...new Set([...portList(dev, other), ...allPorts(dev)])];
  return all.filter(p => !used.has(p)).map(p => `<option value="${esc(p)}">free</option>`).join("") + all.filter(p => used.has(p)).map(p => `<option value="${esc(p)}">in use</option>`).join("");
}
function bindFields(root, target, after) {
  root.querySelectorAll("[data-f]").forEach(el => {
    const f = el.dataset.f;
    el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      if (EDITKEY !== f || el.tagName === "SELECT") { commit(); EDITKEY = f; }
      target[f] = el.value;
      if (after) after(f, el.value);
      scheduleRender(); save();
    });
  });
}
function inspector() {
  const el = $("insp");
  if (SEL.kind === "dev" && byId(SEL.id)) {
    const d = byId(SEL.id);
    const conns = S.links.filter(l => l.a === d.id || l.b === d.id);
    const groups = [...new Set(S.devices.map(x => (x.group || "").trim()).filter(Boolean))];
    const known = !!findModel(d.type, d.model);
    el.innerHTML = `<div class="ih"><div class="ic">${iconSvg(d.type)}</div><div><div class="it" id="iTitle"></div><div class="is">${esc(TYPES[d.type].label)}${d.model ? " · " + esc(d.model) : ""}</div></div></div>
      <label>Name<input data-f="name" autocomplete="off"></label>
      <label>Device type<select data-f="type">${typeOptions(d.type)}</select></label>
      <label>Model / series<select id="iModel">${modelOptions(d.type, d.model)}</select></label>
      <input id="iCustom" class="${known ? "hidden" : ""}" placeholder="Type any model, e.g. ISR4451" autocomplete="off" style="margin-top:6px">
      <div class="portinfo" id="iPorts">${esc(known ? portSummary(d) : "Custom model: ports are suggested from the device type.")}</div>
      <label>IP addresses / notes <span class="opt">(one per line, e.g. "G0/0 192.168.1.1/24")</span><textarea data-f="ip" rows="3" placeholder="e.g. 192.168.1.10/24"></textarea></label>
      <label>Group <span class="opt">(room, VLAN or site: draws a box)</span><input data-f="group" list="groupList" autocomplete="off"></label>
      <datalist id="groupList">${groups.map(g => `<option value="${esc(g)}"></option>`).join("")}</datalist>
      <div class="sect">Connections (${conns.length})</div>
      <ul class="conns">${conns.map(l => { const mine = l.a === d.id, o = byId(mine ? l.b : l.a); return `<li><button data-l="${esc(l.id)}"><span class="swatch" style="background:${(CABLES[l.cable] || CABLES.copper).color}"></span><span>${esc((mine ? l.pa : l.pb) || "—")} → <b>${esc(o ? o.name : "?")}</b> ${esc((mine ? l.pb : l.pa) || "")}</span></button></li>`; }).join("") || '<li class="muted" style="font-size:12.5px">None yet. Click Connect from here, then another device.</li>'}</ul>
      <div class="btns">${typeof openDeviceWindow === "function" ? '<button class="btn primary" id="iOpen">🪟 Open</button>' : ""}<button class="btn" id="iConn">🔌 Connect</button><button class="btn" id="iDup">Duplicate</button><button class="btn danger" id="iDel">Delete</button></div>`;
    el.querySelector("#iTitle").textContent = d.name;
    el.querySelector('[data-f="name"]').value = d.name;
    el.querySelector('[data-f="ip"]').value = d.ip || "";
    el.querySelector('[data-f="group"]').value = d.group || "";
    el.querySelector("#iCustom").value = known ? "" : (d.model || "");
    bindFields(el, d, (f, v) => {
      if (f === "name") el.querySelector("#iTitle").textContent = v;
      if (f === "type") { d.model = TYPES[v].def; inspector(); buildPaletteIfStyle(); }
    });
    el.querySelector("#iModel").addEventListener("change", e => {
      commit(); EDITKEY = null;
      if (e.target.value === "__custom") { el.querySelector("#iCustom").classList.remove("hidden"); el.querySelector("#iCustom").focus(); return; }
      d.model = e.target.value; render(); inspector(); save();
    });
    el.querySelector("#iCustom").addEventListener("input", e => { if (EDITKEY !== "model") { commit(); EDITKEY = "model"; } d.model = e.target.value; scheduleRender(); save(); });
    el.querySelectorAll("[data-l]").forEach(b => b.onclick = () => select("link", b.dataset.l));
    el.querySelector("#iConn").onclick = () => startConnectFrom(d.id);
    if (el.querySelector("#iOpen")) el.querySelector("#iOpen").onclick = () => openDeviceWindow(d);
    el.querySelector("#iDup").onclick = duplicateSel;
    el.querySelector("#iDel").onclick = deleteSel;
    return;
  }
  if (SEL.kind === "link" && byLink(SEL.id)) {
    const l = byLink(SEL.id), a = byId(l.a), b = byId(l.b), c = CABLES[l.cable] || CABLES.copper;
    el.innerHTML = `<div class="ih"><div class="ic cab" style="--c:${c.color}"></div><div><div class="it" id="iTitle"></div><div class="is">${esc(c.label)}</div></div></div>
      <div class="pair"><label>From<select data-f="a">${devOptions(l.a)}</select></label><label>Port<input data-f="pa" list="plA" autocomplete="off"></label></div>
      <datalist id="plA">${portOptions(a, b, l)}</datalist>
      <div class="pair"><label>To<select data-f="b">${devOptions(l.b)}</select></label><label>Port<input data-f="pb" list="plB" autocomplete="off"></label></div>
      <datalist id="plB">${portOptions(b, a, l)}</datalist>
      <label>Cable<select data-f="cable">${cableOptions(l.cable)}</select></label>
      <div class="btns"><button class="btn" id="iSwap">⇄ Swap ends</button><button class="btn" id="iAuto">✨ Auto ports</button><button class="btn danger" id="iDel">Delete cable</button></div>
      <p class="muted" style="font-size:12px;margin-top:12px">Click a port box to see the free ports of that model. Wireless links don't need ports.</p>`;
    el.querySelector("#iTitle").textContent = `${a ? a.name : "?"} ↔ ${b ? b.name : "?"}`;
    el.querySelector('[data-f="pa"]').value = l.pa || "";
    el.querySelector('[data-f="pb"]').value = l.pb || "";
    bindFields(el, l, f => { if (f === "a" || f === "b" || f === "cable") inspector(); if (typeof onTopologyChange === "function") onTopologyChange(); });
    el.querySelector("#iSwap").onclick = () => { commit(); [l.a, l.b, l.pa, l.pb] = [l.b, l.a, l.pb, l.pa]; render(); inspector(); save(); };
    el.querySelector("#iAuto").onclick = () => { commit(); const A = byId(l.a), B = byId(l.b); l.pa = ""; l.pb = ""; if (l.cable !== "wireless" && A && B) { l.pa = pickPort(A, B, l.cable); l.pb = pickPort(B, A, l.cable); } render(); inspector(); save(); };
    el.querySelector("#iDel").onclick = deleteSel;
    return;
  }
  if (SEL.kind === "note" && byNote(SEL.id)) {
    const n = byNote(SEL.id);
    el.innerHTML = `<div class="ih"><div class="ic note">📝</div><div><div class="it">Note</div><div class="is">Text on the workspace</div></div></div>
      <label>Text<textarea data-f="text" rows="5"></textarea></label>
      <div class="btns"><button class="btn danger" id="iDel">Delete note</button></div>`;
    el.querySelector('[data-f="text"]').value = n.text;
    bindFields(el, n);
    el.querySelector("#iDel").onclick = deleteSel;
    return;
  }
  if (SEL.kind === "area" && byArea(SEL.id)) {
    const a = byArea(SEL.id);
    el.innerHTML = `<div class="ih"><div class="ic" style="color:${a.color};font-size:26px">▭</div><div><div class="it">Area</div><div class="is">${a.w} × ${a.h}</div></div></div>
      <label>Label<input data-f="label" autocomplete="off"></label>
      <div class="sect">Colour</div>
      <div class="swatches">${AREA_COLORS.map(c => `<button class="sw${c === a.color ? " on" : ""}" data-c="${c}" style="background:${c}" title="${c}"></button>`).join("")}</div>
      <p class="muted" style="font-size:12px;margin-top:10px">Drag the area to move it with the devices inside (hold Alt to move just the box). Drag the corner square to resize.</p>
      <div class="btns"><button class="btn danger" id="iDel">Delete area</button></div>`;
    el.querySelector('[data-f="label"]').value = a.label || "";
    bindFields(el, a);
    el.querySelectorAll("[data-c]").forEach(b => b.onclick = () => { commit(); a.color = b.dataset.c; render(); inspector(); save(); });
    el.querySelector("#iDel").onclick = deleteSel;
    return;
  }
  el.innerHTML = `<div class="ih"><div class="ic">${iconSvg("router")}</div><div><div class="it">Diagram</div><div class="is">${S.devices.length} devices · ${S.links.length} cables</div></div></div>
    <label>Title <span class="opt">(printed on exported pictures)</span><input id="sTitle" placeholder="e.g. Lab 01 — Edison Smiles Dental" autocomplete="off"></label>
    <div class="sect">Icon style</div>
    <div class="segrow"><div class="seg" id="iconSeg"><button class="btn" data-v="cisco">Cisco classic</button><button class="btn" data-v="realistic">Realistic</button></div></div>
    <div class="sect">Show on diagram</div>
    <div class="checks">
      <label><input type="checkbox" data-s="showModel"> Device models</label>
      <label><input type="checkbox" data-s="showIP"> IP addresses / notes</label>
      <label><input type="checkbox" data-s="showPorts"> Port names on cables</label>
      <label><input type="checkbox" data-s="showLights"> Link lights (green / orange / red)</label>
      <label><input type="checkbox" data-s="snap"> Snap to grid while dragging</label>
    </div>
    <div class="sect">How to use</div>
    <ol class="howto">
      <li><b>Add:</b> pick a category in the bottom-left panel, then drag a model onto the workspace (or search "2911", "9300"…).</li>
      <li><b>Cable:</b> open <b>Connections</b>, pick a cable (⚡ = automatic), click a device, choose a port, then the other device.</li>
      <li><b>Configure:</b> double-click a device to open its window.</li>
      <li><b>Tidy:</b> Arrange lays it out as a neat tree.</li>
      <li><b>Export to Obsidian</b> (top right): copy the picture and/or the note text.</li>
    </ol>
    <div class="sect">Shortcuts</div>
    <div class="keys"><kbd>V</kbd> select · <kbd>C</kbd> connect · <kbd>I</kbd> inspect · <kbd>D</kbd> delete tool · <kbd>N</kbd> note · <kbd>A</kbd> area · <kbd>P</kbd> PDU · <kbd>Del</kbd> delete · <kbd>Ctrl</kbd>+<kbd>Z</kbd>/<kbd>Y</kbd> undo/redo · <kbd>Ctrl</kbd>+<kbd>D</kbd> duplicate · <kbd>Ctrl</kbd>+<kbd>E</kbd> export · <kbd>F</kbd> fit · <kbd>Esc</kbd> cancel</div>`;
  const t = el.querySelector("#sTitle"); t.value = S.title || "";
  t.addEventListener("input", () => { if (EDITKEY !== "title") { commit(); EDITKEY = "title"; } S.title = t.value; save(); });
  el.querySelectorAll("[data-s]").forEach(cb => { cb.checked = S[cb.dataset.s] !== false; cb.addEventListener("change", () => { S[cb.dataset.s] = cb.checked; render(); save(); }); });
  el.querySelectorAll("#iconSeg .btn").forEach(b => { b.classList.toggle("on", b.dataset.v === (S.iconStyle || "cisco")); b.onclick = () => { S.iconStyle = b.dataset.v; render(); inspector(); buildPalette(); save(); }; });
}
function buildPaletteIfStyle() { /* palette icons only depend on style, nothing to do here */ }

