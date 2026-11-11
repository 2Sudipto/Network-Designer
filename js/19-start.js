// ======================================================================= START
(function start() {
  let v = null, layout = false;
  try { v = JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) {}
  if (v && Array.isArray(v.devices)) S = migrate(v);
  else {
    let old = null; try { old = JSON.parse(localStorage.getItem("netDiagramBuilder") || "null"); } catch (e) {}
    if (old && Array.isArray(old.devices) && old.devices.length) { S = migrate(old); layout = true; }
    else { S = exampleLab(); layout = true; }
  }
  fixUid(); buildLegend(); buildPalette(); applyTheme(); updateUndo(); inspector(); outputs();
  if (layout) arrange(S.dir || "LR", true); else requestAnimationFrame(fit);
  addEventListener("resize", () => { clearTimeout(start.t); start.t = setTimeout(fit, 150); });
})();
