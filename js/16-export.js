// ======================================================================= EXPORT
const EX = {bg: "light", scale: 2, title: true, opts: {heading: true, mermaid: true, cabling: true, addressing: true, devices: false}};
function exportSvg() {
  const T = EX.bg === "dark" ? THEMES.dark : EX.bg === "transparent" ? THEMES.white : THEMES.white;
  const b = contentBox(), pad = 34, th = EX.title && S.title ? 44 : 0;
  const x = Math.floor(b.x - pad), y = Math.floor(b.y - pad - th), w = Math.ceil(b.w + pad * 2), h = Math.ceil(b.h + pad * 2 + th);
  const title = th ? `<text x="${x + pad}" y="${y + 34}" font-size="20" font-weight="700" fill="${T.text}">${esc(S.title)}</text>` : "";
  const bg = EX.bg === "transparent" ? "" : `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="${T.canvas}"/>`;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="${x} ${y} ${w} ${h}" font-family="Segoe UI, system-ui, -apple-system, Arial, sans-serif"><defs>${DEFS}</defs>${bg}${title}${areasSvg(true, T)}${groupsSvg()}${S.links.map(l => linkSvg(l, true, T)).join("")}${S.devices.map(d => devSvg(d, true, T)).join("")}${notesSvg(true, T)}</svg>`;
  return {svg, w, h};
}
const svgUrl = svg => "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
function pngBlob() {
  return new Promise((resolve, reject) => {
    const {svg, w, h} = exportSvg();
    const img = new Image();
    img.onload = () => {
      try {
        const sc = EX.scale, c = document.createElement("canvas"); c.width = w * sc; c.height = h * sc;
        const g = c.getContext("2d"); g.scale(sc, sc); g.drawImage(img, 0, 0, w, h);
        c.toBlob(b => b ? resolve(b) : reject(new Error("toBlob failed")), "image/png");
      } catch (e) { reject(e); }
    };
    img.onerror = () => reject(new Error("image load failed"));
    img.src = svgUrl(svg);
  });
}
function download(name, blob) { const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 800); }
const fileBase = () => (S.title || "network-diagram").replace(/[^\w\- ]+/g, "").trim().replace(/\s+/g, "-").toLowerCase() || "network-diagram";
function flash(btn, label) { if (!btn) return; const old = btn.innerHTML; btn.innerHTML = label; btn.classList.add("done"); setTimeout(() => { btn.innerHTML = old; btn.classList.remove("done"); }, 1800); }
async function copyText(t, msg, btn) {
  let ok = false;
  try { await navigator.clipboard.writeText(t); ok = true; }
  catch (e) { const ta = document.createElement("textarea"); ta.value = t; ta.style.position = "fixed"; ta.style.opacity = "0"; document.body.appendChild(ta); ta.select(); try { ok = document.execCommand("copy"); } catch (_) {} ta.remove(); }
  if (ok) { toast(msg || "Copied ✓"); flash(btn, "✓ Copied"); } else toast("Copy was blocked: select the text and press Ctrl+C");
  return ok;
}
async function copyPicture(btn) {
  if (!S.devices.length) { toast("Add some devices first."); return; }
  try {
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) throw new Error("no clipboard");
    await navigator.clipboard.write([new ClipboardItem({"image/png": pngBlob()})]);
    toast("Picture copied ✓  Paste it into your Obsidian note with Ctrl+V"); flash(btn, "✓ Copied");
  } catch (e) {
    try { download(fileBase() + ".png", await pngBlob()); toast("Your browser blocked copying, so the PNG was downloaded. Drag it into Obsidian."); }
    catch (_) { toast("Couldn't make the picture. Try Download SVG."); }
  }
}
function noteText() {
  const o = EX.opts, parts = [];
  if (o.heading) parts.push("## Topology" + (S.title ? `\n\n**${S.title}**` : ""));
  if (o.mermaid) parts.push("```mermaid\n" + mermaidCode() + "\n```");
  if (o.cabling) parts.push("### Cabling\n" + cablingTable());
  if (o.addressing) parts.push("### Addressing table\n" + addressingTable());
  if (o.devices) parts.push("### Devices\n" + deviceTable());
  return parts.join("\n\n") + "\n";
}
function refreshExport() {
  $("exPrev").src = S.devices.length ? svgUrl(exportSvg().svg) : "";
  $("exText").value = noteText();
  $("exBg").querySelectorAll(".btn").forEach(b => b.classList.toggle("on", b.dataset.v === EX.bg));
  $("exScale").querySelectorAll(".btn").forEach(b => b.classList.toggle("on", +b.dataset.v === EX.scale));
}
function openExport() {
  if (!S.devices.length) { toast("Add some devices first."); return; }
  closeMenus(); hideCtx(); refreshExport(); $("exportDlg").showModal();
}
$("openExport").onclick = openExport;
$("exClose").onclick = () => $("exportDlg").close();
$("exportDlg").addEventListener("click", e => { if (e.target === $("exportDlg")) $("exportDlg").close(); });
$("exTabs").querySelectorAll(".tab").forEach(b => b.onclick = () => {
  $("exTabs").querySelectorAll(".tab").forEach(x => x.classList.toggle("on", x === b));
  $("x-pic").classList.toggle("hidden", b.dataset.x !== "pic"); $("x-obs").classList.toggle("hidden", b.dataset.x !== "obs");
});
$("exBg").querySelectorAll(".btn").forEach(b => b.onclick = () => { EX.bg = b.dataset.v; refreshExport(); });
$("exScale").querySelectorAll(".btn").forEach(b => b.onclick = () => { EX.scale = +b.dataset.v; refreshExport(); });
$("exTitleChk").onchange = e => { EX.title = e.target.checked; refreshExport(); };
document.querySelectorAll("[data-o]").forEach(cb => cb.onchange = () => { EX.opts[cb.dataset.o] = cb.checked; refreshExport(); });
$("exCopyImg").onclick = e => copyPicture(e.currentTarget);
$("exPng").onclick = async () => { try { download(fileBase() + ".png", await pngBlob()); } catch (e) { toast("PNG failed. Try SVG."); } };
$("exSvg").onclick = () => download(fileBase() + ".svg", new Blob([exportSvg().svg], {type: "image/svg+xml"}));
$("exCopyText").onclick = e => copyText(noteText(), "Copied ✓  Paste it into your Obsidian note", e.currentTarget);
$("exCopyBoth").onclick = async e => { const btn = e.currentTarget; if (await copyText(noteText(), "Text copied ✓ and picture downloaded: paste the text, then drag the PNG in", btn)) { try { download(fileBase() + ".png", await pngBlob()); } catch (_) {} } };

