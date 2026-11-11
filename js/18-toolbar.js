// ======================================================================= TOOLBAR
document.querySelectorAll("#toolSeg [data-tool]").forEach(b => b.onclick = () => setMode(MODE === b.dataset.tool && b.dataset.tool !== "select" ? "select" : b.dataset.tool));
$("arrLR").onclick = () => arrange("LR");
$("arrTB").onclick = () => arrange("TB");
$("undo").onclick = undo; $("redo").onclick = redo;
$("zIn").onclick = () => zoomBy(1.2); $("zOut").onclick = () => zoomBy(1 / 1.2); $("zFit").onclick = fit;
let toastTimer = null;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800); }

// ---- Realtime / Simulation (the simulation engine fills these in)
let SIMMODE = "realtime";
const PDUS = [];   // {id, src, dst, status, type}
function setSimMode(m) {
  SIMMODE = m;
  $("rtReal").classList.toggle("on", m === "realtime"); $("rtSim").classList.toggle("on", m === "simulation");
  document.body.classList.toggle("simmode", m === "simulation");
  if (typeof onSimModeChange === "function") onSimModeChange();
  renderRt();
}
function renderRt() {
  const body = $("rtBody");
  if (typeof renderSimPanel === "function" && SIMMODE === "simulation") { renderSimPanel(body); return; }
  body.innerHTML = `<table class="pdutbl"><tr><th>Fire</th><th>Last status</th><th>Source</th><th>Destination</th><th>Type</th><th></th></tr>${PDUS.map(p => `<tr><td><button class="mini" data-fire="${p.id}" title="Send again">▶</button></td><td class="${p.status === "Successful" ? "ok" : p.status === "Failed" ? "fail" : ""}">${esc(p.status || "—")}</td><td>${esc((byId(p.src) || {}).name || "?")}</td><td>${esc((byId(p.dst) || {}).name || "?")}</td><td>${esc(p.type)}</td><td><button class="mini" data-del="${p.id}" title="Delete">✕</button></td></tr>`).join("") || '<tr><td colspan="6" class="muted">No PDUs yet. Use ✉️ Add Simple PDU (P): click a source, then a destination.</td></tr>'}</table>`;
  body.querySelectorAll("[data-fire]").forEach(b => b.onclick = () => firePdu(PDUS.find(p => p.id === b.dataset.fire)));
  body.querySelectorAll("[data-del]").forEach(b => b.onclick = () => { PDUS.splice(PDUS.findIndex(p => p.id === b.dataset.del), 1); renderRt(); });
}
$("rtReal").onclick = () => setSimMode("realtime");
$("rtSim").onclick = () => setSimMode("simulation");
let pduSeq = 1;
function pduClick(d) {
  if (!PDU_PICK.from) { PDU_PICK.from = d.id; toast(`Source: ${d.name}. Now click the destination.`); return; }
  if (PDU_PICK.from === d.id) { PDU_PICK.from = null; $("gOverlay").innerHTML = ""; return; }
  const p = {id: "p" + (pduSeq++), src: PDU_PICK.from, dst: d.id, status: "", type: "ICMP"};
  PDU_PICK.from = null; $("gOverlay").innerHTML = "";
  PDUS.push(p); firePdu(p);
}
function firePdu(p) {
  if (!p) return;
  if (typeof simPdu === "function") simPdu(p);
  else { p.status = "Pending"; toast("Ping simulation arrives in Phase 4."); }
  renderRt();
}
