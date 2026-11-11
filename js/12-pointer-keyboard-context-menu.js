// ======================================================================= POINTER / KEYBOARD / CONTEXT MENU
let drag = null;
cv.addEventListener("pointerdown", e => {
  hideCtx();
  if (e.button !== 0 && e.button !== 1) return;
  closeMenus();
  const devEl = e.target.closest("[data-dev]"), lkEl = e.target.closest("[data-link]");
  const p = toWorld(e.clientX, e.clientY);
  if (devEl && e.button === 0) {
    const d = byId(devEl.dataset.dev); if (!d) return;
    if (MODE === "connect" || CONNECT.from) { handleConnectClick(d); return; }
    if (SEL.kind !== "dev" || SEL.id !== d.id) select("dev", d.id);
    drag = {kind: "dev", id: d.id, ox: p.x - d.x, oy: p.y - d.y, moved: false, start: snap()};
    cv.setPointerCapture(e.pointerId); return;
  }
  if (lkEl && e.button === 0 && !CONNECT.from) { select("link", lkEl.dataset.link); return; }
  if (CONNECT.from) { CONNECT.from = null; render(); }
  if (e.button === 0 && SEL.kind) select(null, null);
  drag = {kind: "pan", sx: e.clientX, sy: e.clientY, vx: VIEW.x, vy: VIEW.y};
  cv.setPointerCapture(e.pointerId); cv.classList.add("panning");
});
cv.addEventListener("pointermove", e => {
  const p = toWorld(e.clientX, e.clientY);
  if (CONNECT.from) { const a = byId(CONNECT.from); if (a) $("gOverlay").innerHTML = `<line x1="${a.x}" y1="${a.y}" x2="${f2(p.x)}" y2="${f2(p.y)}" stroke="${TH.accent}" stroke-width="2.2" stroke-dasharray="6 5"/><circle cx="${f2(p.x)}" cy="${f2(p.y)}" r="4" fill="${TH.accent}"/>`; }
  if (!drag) return;
  if (drag.kind === "pan") { VIEW.x = drag.vx + e.clientX - drag.sx; VIEW.y = drag.vy + e.clientY - drag.sy; applyView(); return; }
  const d = byId(drag.id); if (!d) return;
  let nx = p.x - drag.ox, ny = p.y - drag.oy;
  if (S.snap) { nx = Math.round(nx / 10) * 10; ny = Math.round(ny / 10) * 10; }
  if (nx !== d.x || ny !== d.y) { if (!drag.moved) { H.past.push(drag.start); H.future = []; drag.moved = true; updateUndo(); } d.x = nx; d.y = ny; scheduleRender(); }
});
const endDrag = () => { if (drag && drag.moved) save(); drag = null; cv.classList.remove("panning"); };
cv.addEventListener("pointerup", endDrag);
cv.addEventListener("pointercancel", endDrag);
cv.addEventListener("dblclick", e => { const el = e.target.closest("[data-dev]"); if (el) { select("dev", el.dataset.dev); focusName(); } });
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
  e.preventDefault(); CONNECT.from = null;
  const devEl = e.target.closest("[data-dev]"), lkEl = e.target.closest("[data-link]");
  if (devEl) {
    const d = byId(devEl.dataset.dev); select("dev", d.id);
    showCtx(e.clientX, e.clientY, d.name, [
      {icon: "✏️", label: "Rename", run: focusName},
      {icon: "🔌", label: "Connect from here", run: () => startConnectFrom(d.id)},
      {icon: "📄", label: "Duplicate", run: duplicateSel},
      "-", {icon: "🗑️", label: "Delete device", danger: true, run: deleteSel}]);
  } else if (lkEl) {
    const l = byLink(lkEl.dataset.link); select("link", l.id);
    showCtx(e.clientX, e.clientY, "Cable", [
      ...Object.entries(CABLES).map(([k, c]) => ({icon: k === l.cable ? "●" : "", label: c.label, run: () => { commit(); l.cable = k; if (k === "wireless") { l.pa = ""; l.pb = ""; } render(); inspector(); save(); }})),
      "-", {icon: "🗑️", label: "Delete cable", danger: true, run: deleteSel}]);
  } else {
    const p = toWorld(e.clientX, e.clientY);
    showCtx(e.clientX, e.clientY, "Canvas", [
      {icon: "🔀", label: "Add router here", run: () => addDevice("router", p)},
      {icon: "🔲", label: "Add switch here", run: () => addDevice("switch", p)},
      {icon: "💻", label: "Add PC here", run: () => addDevice("pc", p)},
      "-", {icon: "⇢", label: "Arrange left → right", run: () => arrange("LR")},
      {icon: "⇣", label: "Arrange top → bottom", run: () => arrange("TB")},
      {icon: "⤢", label: "Fit to screen", run: fit},
      "-", {icon: "📋", label: "Export to Obsidian…", run: openExport}]);
  }
});
document.addEventListener("pointerdown", e => { if (!ctx.contains(e.target)) hideCtx(); });

document.addEventListener("keydown", e => {
  if ($("exportDlg").open) return;
  const tag = (e.target.tagName || "").toLowerCase();
  if (tag === "input" || tag === "textarea" || tag === "select") { if (e.key === "Escape") e.target.blur(); return; }
  const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
  if (ctrl && k === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (ctrl && (k === "y" || (k === "z" && e.shiftKey))) { e.preventDefault(); redo(); }
  else if (ctrl && k === "d") { e.preventDefault(); duplicateSel(); }
  else if (ctrl && k === "e") { e.preventDefault(); openExport(); }
  else if (ctrl) return;
  else if (e.key === "Delete" || e.key === "Backspace") { e.preventDefault(); deleteSel(); }
  else if (e.key === "Escape") { hideCtx(); if (CONNECT.from) { CONNECT.from = null; render(); } else if (MODE === "connect") setMode("select"); else select(null, null); closeMenus(); }
  else if (k === "c") setMode("connect");
  else if (k === "v") setMode("select");
  else if (k === "f") fit();
  else if (e.key === "+" || e.key === "=") zoomBy(1.2);
  else if (e.key === "-") zoomBy(1 / 1.2);
});

