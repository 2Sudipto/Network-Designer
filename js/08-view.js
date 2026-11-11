// ======================================================================= VIEW
function toWorld(cx, cy) { const r = cv.getBoundingClientRect(); return {x: (cx - r.left - VIEW.x) / VIEW.k, y: (cy - r.top - VIEW.y) / VIEW.k}; }
function fit() {
  const r = cv.getBoundingClientRect(); if (!r.width) return;
  const b = contentBox(), pad = 46, top = 44, bottom = 50;
  // leave room for the activity panel when it is open
  const rp = document.querySelector(".actpanel:not(.hidden):not(.min)") && r.width > 900 ? 352 : 0, W = r.width - rp;
  const k = Math.max(.2, Math.min(1.5, Math.min((W - pad * 2) / b.w, (r.height - top - bottom - pad) / b.h)));
  VIEW.k = k; VIEW.x = (W - b.w * k) / 2 - b.x * k; VIEW.y = top + (r.height - top - bottom - b.h * k) / 2 - b.y * k;
  applyView();
}
function zoomBy(f, cx, cy) {
  const r = cv.getBoundingClientRect(); const mx = cx == null ? r.width / 2 : cx - r.left, my = cy == null ? r.height / 2 : cy - r.top;
  const k = Math.min(3, Math.max(.2, VIEW.k * f));
  VIEW.x = mx - (mx - VIEW.x) * k / VIEW.k; VIEW.y = my - (my - VIEW.y) * k / VIEW.k; VIEW.k = k; applyView();
}
function viewCenter() { const r = cv.getBoundingClientRect(); return toWorld(r.left + r.width / 2, r.top + r.height / 2); }

