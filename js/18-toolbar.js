// ======================================================================= TOOLBAR
$("cableSel").innerHTML = `<option value="auto">⚡ Auto cable</option>` + cableOptions("");
$("cableSel").value = "auto";
$("cableSel").onchange = () => status();
$("mSelect").onclick = () => setMode("select");
$("mConnect").onclick = () => setMode(MODE === "connect" ? "select" : "connect");
$("arrLR").onclick = () => arrange("LR");
$("arrTB").onclick = () => arrange("TB");
$("undo").onclick = undo; $("redo").onclick = redo;
$("zIn").onclick = () => zoomBy(1.2); $("zOut").onclick = () => zoomBy(1 / 1.2); $("zFit").onclick = fit;
let toastTimer = null;
function toast(m) { const t = $("toast"); t.textContent = m; t.classList.add("show"); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), 2800); }

