// ======================================================================= POINTER / KEYBOARD / CONTEXT MENU
let drag = null;
const snapV = v => S.snap ? Math.round(v / 10) * 10 : Math.round(v);
function hitAt(e) {
  const t = e.target;
  const el = t.closest("[data-areah],[data-dev],[data-note],[data-link],[data-area]");
  if (!el) return null;
  if (el.dataset.areah) return {kind: "areah", id: el.dataset.areah};
  if (el.dataset.dev) return {kind: "dev", id: el.dataset.dev};
  if (el.dataset.note) return {kind: "note", id: el.dataset.note};
  if (el.dataset.link) return {kind: "link", id: el.dataset.link};
  return {kind: "area", id: el.dataset.area};
}
function startPan(e) { drag = {kind: "pan", sx: e.clientX, sy: e.clientY, vx: VIEW.x, vy: VIEW.y}; cv.setPointerCapture(e.pointerId); cv.classList.add("panning"); }
cv.addEventListener("pointerdown", e => {
  hideCtx(); hidePop();
  if (e.button !== 0 && e.button !== 1) return;
  closeMenus();
  if (!portPick.classList.contains("hidden")) { hidePortPick(); if (!CONNECT.port) { CONNECT.from = null; render(); } }
  const hit = hitAt(e), p = toWorld(e.clientX, e.clientY);
  if (e.button === 1) { startPan(e); return; }
  const dev = hit && hit.kind === "dev" ? byId(hit.id) : null;

  // ---- tools that act on a click
  if (MODE === "connect" || CONNECT.from) {
    if (dev) { handleConnectClick(dev, e); return; }
    if (CONNECT.from) { CONNECT.from = null; CONNECT.port = null; render(); return; }
  }
  if (MODE === "delete") { if (hit && hit.kind !== "areah") deleteItem(hit.kind, hit.id); else startPan(e); return; }
  if (MODE === "inspect") { if (dev) { select("dev", dev.id); inspectDevice(dev, e); } else startPan(e); return; }
  if (MODE === "pdu") { if (dev) pduClick(dev); else startPan(e); return; }
  if (MODE === "note") { if (hit && hit.kind === "note") select("note", hit.id); else { addNote(p); setMode("select"); } return; }
  if (MODE === "area" && !(hit && hit.kind === "areah")) {
    AREA_DRAW = {x0: p.x, y0: p.y, x: p.x, y: p.y, w: 0, h: 0};
    drag = {kind: "areaDraw"}; cv.setPointerCapture(e.pointerId); return;
  }

  // ---- select tool
  if (hit && hit.kind === "areah") {
    const a = byArea(hit.id); if (!a) return;
    drag = {kind: "areaResize", id: a.id, start: snap(), moved: false}; cv.setPointerCapture(e.pointerId); return;
  }
  if (dev) {
    if (SEL.kind !== "dev" || SEL.id !== dev.id) select("dev", dev.id);
    drag = {kind: "dev", id: dev.id, ox: p.x - dev.x, oy: p.y - dev.y, moved: false, start: snap()};
    cv.setPointerCapture(e.pointerId); return;
  }
  if (hit && (hit.kind === "note" || hit.kind === "area")) {
    const o = hit.kind === "note" ? byNote(hit.id) : byArea(hit.id); if (!o) return;
    if (SEL.kind !== hit.kind || SEL.id !== hit.id) select(hit.kind, hit.id);
    drag = {kind: hit.kind, id: hit.id, ox: p.x - o.x, oy: p.y - o.y, moved: false, start: snap()};
    cv.setPointerCapture(e.pointerId); return;
  }
  if (hit && hit.kind === "link") { select("link", hit.id); return; }
  if (SEL.kind) select(null, null);
  startPan(e);
});
cv.addEventListener("pointermove", e => {
  const p = toWorld(e.clientX, e.clientY);
  if (CONNECT.from) { const a = byId(CONNECT.from); if (a) $("gOverlay").innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${f2(p.x)}" y2="${f2(p.y)}" stroke="${TH.accent}" stroke-width="2.2" stroke-dasharray="6 5"/><circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="4" fill="${TH.accent}"/>`; }
  if (PDU_PICK.from) { const a = byId(PDU_PICK.from); if (a) $("gOverlay").innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${f2(p.x)}" y2="${f2(p.y)}" stroke="#d4a017" stroke-width="2.2" stroke-dasharray="4 4"/><text x="${f2(p.x + 8)}" y="${f2(p.y - 8)}" font-size="16">✉️</text>`; }
  if (!drag) return;
  if (drag.kind === "pan") { VIEW.x = drag.vx + e.clientX - drag.sx; VIEW.y = drag.vy + e.clientY - drag.sy; applyView(); return; }
  if (drag.kind === "areaDraw") {
    const A = AREA_DRAW; A.x = Math.min(A.x0, p.x); A.y = Math.min(A.y0, p.y); A.w = Math.abs(p.x - A.x0); A.h = Math.abs(p.y - A.y0);
    $("gOverlay").innerHTML = `<rect x="${f2(A.x)}" y="${f2(A.y)}" width="${f2(A.w)}" height="${f2(A.h)}" rx="14" fill="${TH.accent}" fill-opacity=".08" stroke="${TH.accent}" stroke-width="1.6" stroke-dasharray="6 4"/>`;
    return;
  }
  const begin = () => { if (!drag.moved) { H.past.push(drag.start); H.future = []; drag.moved = true; updateUndo(); } };
  if (drag.kind === "areaResize") {
    const a = byArea(drag.id); if (!a) return;
    const w = Math.max(40, snapV(p.x - a.x)), h = Math.max(30, snapV(p.y - a.y));
    if (w !== a.w || h !== a.h) { begin(); a.w = w; a.h = h; scheduleRender(); }
    return;
  }
  const o = drag.kind === "dev" ? byId(drag.id) : drag.kind === "note" ? byNote(drag.id) : byArea(drag.id);
  if (!o) return;
  const nx = snapV(p.x - drag.ox), ny = snapV(p.y - drag.oy);
  if (nx !== o.x || ny !== o.y) {
    begin();
    if (drag.kind === "area" && !e.altKey) {
      // moving an area carries the devices inside it, like a container
      const dx = nx - o.x, dy = ny - o.y;
      if (!drag.inside) drag.inside = S.devices.filter(d => d.x > o.x && d.x < o.x + o.w && d.y > o.y && d.y < o.y + o.h).map(d => d.id);
      drag.inside.forEach(id => { const d = byId(id); if (d) { d.x += dx; d.y += dy; } });
    }
    o.x = nx; o.y = ny; scheduleRender();
  }
});
const endDrag = () => {
  if (drag && drag.kind === "areaDraw") { const A = AREA_DRAW; AREA_DRAW = null; $("gOverlay").innerHTML = ""; addArea(A); setMode("select"); }
  else if (drag && drag.moved) save();
  drag = null; cv.classList.remove("panning");
};
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("dblclick", e => {
  const hit = hitAt(e); if (!hit) return;
  if (hit.kind === "dev") { select("dev", hit.id); if (typeof openDeviceWindow === "function") openDeviceWindow(byId(hit.id)); else focusName(); }
  else if (hit.kind === "note") { const n = byNote(hit.id); const t = prompt("Edit note (use \\n for a new line):", n.text.replace(/\n/g, "\\n")); if (t != null) { commit(); n.text = t.replace(/\\n/g, "\n"); render(); inspector(); save(); } }
  else if (hit.kind === "area") { select("area", hit.id); const f = $("insp").querySelector('[data-f="label"]'); if (f) { f.focus(); f.select(); } }
});
cv.addEventListener("wheel", e => { e.preventDefault(); zoomBy(Math.exp(-e.deltaY * 0.0015), e.clientX, e.clientY); }, {passive: false});
cv.addEventListener("dragover", e => { if (e.dataTransfer.types.includes("text/x-device")) { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; } });
cv.addEventListener("drop", e => {
  const t = e.dataTransfer.getData("text/x-device"); if (!t) return; e.preventDefault();
  const [type, model] = t.split("|"); if (TYPES[type]) addDevice(type, toWorld(e.clientX, e.clientY), model || undefined);
});
function focusName() { const f = $("insp").querySelector('[data-f="name"]'); if (f) { f.focus(); f.select(); } }

const ctx = $("ctx");
function hideCtx() { ctx.classList.add("hidden"); }
function showCtx(x, y, title, items) {
  ctx.innerHTML = `<div class="ct">${esc(title)}</div>` + items.map((it, i) => it === "-" ? "<hr>" : `<button data-i="${i}"${it.danger ? ' style="color:var(--danger)"' : ""}><span>${it.icon || ""}</span><span>${esc(it.label)}</span></button>`).join("");
  ctx.querySelectorAll("[data-i]").forEach(b => b.onclick = () => { hideCtx(); items[+b.dataset.i].run(); });
  ctx.classList.remove("hidden");
  const r = ctx.getBoundingClientRect();
  ctx.style.left = Math.min(x, innerWidth - r.width - 8) + "px"; ctx.style.top = Math.min(y, innerHeight - r.height - 8) + "px";
}
cv.addEventListener("contextmenu", e => {
  e.preventDefault(); CONNECT.from = null; hidePortPick(); hidePop();
  const hit = hitAt(e);
  if (hit && hit.kind === "dev") {
    const d = byId(hit.id); select("dev", d.id);
    const items = [];
    if (typeof openDeviceWindow === "function") items.push({icon: "🪟", label: "Open device window", run: () => openDeviceWindow(d)});
    items.push({icon: "✏️", label: "Rename", run: focusName},
      {icon: "🔍", label: "Inspect ports", run: () => inspectDevice(d, e)},
      {icon: "🔌", label: "Connect from here (auto cable)", run: () => startConnectFrom(d.id)},
      {icon: "📄", label: "Duplicate", run: duplicateSel},
      "-", {icon: "🗑️", label: "Delete device", danger: true, run: deleteSel});
    showCtx(e.clientX, e.clientY, d.name, items);
  } else if (hit && hit.kind === "link") {
    const l = byLink(hit.id); select("link", l.id);
    showCtx(e.clientX, e.clientY, "Cable", [
      ...CABLE_LIST.map(([k, c]) => ({icon: k === l.cable ? "●" : "", label: c.label, run: () => { commit(); l.cable = k; if (k === "wireless") { l.pa = ""; l.pb = ""; } render(); inspector(); save(); }})),
      "-", {icon: "🗑️", label: "Delete cable", danger: true, run: deleteSel}]);
  } else if (hit && (hit.kind === "note" || hit.kind === "area")) {
    select(hit.kind, hit.id);
    showCtx(e.clientX, e.clientY, hit.kind === "note" ? "Note" : "Area", [{icon: "🗑️", label: "Delete " + hit.kind, danger: true, run: deleteSel}]);
  } else {
    const p = toWorld(e.clientX, e.clientY);
    showCtx(e.clientX, e.clientY, "Workspace", [
      {icon: "🔀", label: "Add router here", run: () => addDevice("router", p)},
      {icon: "🔲", label: "Add switch here", run: () => addDevice("switch", p)},
      {icon: "💻", label: "Add PC here", run: () => addDevice("pc", p)},
      {icon: "📝", label: "Add note here", run: () => addNote(p)},
      "-", {icon: "⇢", label: "Arrange left → right", run: () => arrange("LR")},
      {icon: "⇣", label: "Arrange top → bottom", run: () => arrange("TB")},
      {icon: "⤢", label: "Fit to screen", run: fit},
      "-", {icon: "📋", label: "Export to Obsidian…", run: openExport}]);
  }
});
document.addEventListener("pointerdown", e => {
  if (!ctx.contains(e.target)) hideCtx();
  if (!pop.contains(e.target) && e.target !== cv && !cv.contains(e.target)) hidePop();
  if (!portPick.contains(e.target) && !cv.contains(e.target)) { if (!portPick.classList.contains("hidden")) { hidePortPick(); if (!CONNECT.port) { CONNECT.from = null; render(); } } }
});

const TOOL_KEYS = {v: "select", i: "inspect", d: "delete", n: "note", a: "area", p: "pdu"};
document.addEventListener("keydown", e => {
  if (document.querySelector("dialog[open]")) return;
  if (e.target.closest && e.target.closest(".devwin")) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") { if (e.key === "Escape") e.target.blur(); return; }
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (ctrl && k === "d") { e.preventDefault(); duplicateSel(); }
  else if (ctrl && k === "e") { e.preventDefault(); openExport(); }
  else if (ctrl || e.altKey) return;
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); }
  else if (e.key === "Escape") {
    hideCtx(); hidePop(); hidePortPick();
    if (CONNECT.from || PDU_PICK.from) { CONNECT.from = null; CONNECT.port = null; PDU_PICK.from = null; $("gOverlay").innerHTML = ""; render(); }
    else if (MODE !== "select") setMode("select"); else select(null, null);
    closeMenus();
  }
  else if (k === "c") { setMode("connect"); }
  else if (TOOL_KEYS[k]) setMode(TOOL_KEYS[k]);
  else if (k === "f") fit();
  else if (e.key === "+" || e.key === "=") zoomBy(1.2);
  else if (e.key === "-") zoomBy(1 / 1.2);
});
