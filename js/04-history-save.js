// ======================================================================= HISTORY / SAVE
const H = {past: [], future: []};
const snap = () => JSON.stringify({devices: S.devices, links: S.links, title: S.title, notes: S.notes || [], areas: S.areas || []});
function commit() { H.past.push(snap()); if (H.past.length > 150) H.past.shift(); H.future = []; updateUndo(); }
function restore(json) { const v = JSON.parse(json); S.devices = v.devices; S.links = v.links; S.title = v.title || ""; S.notes = v.notes || []; S.areas = v.areas || []; if ((SEL.kind === "dev" && !byId(SEL.id)) || (SEL.kind === "link" && !byLink(SEL.id)) || (SEL.kind === "note" && !byNote(SEL.id)) || (SEL.kind === "area" && !byArea(SEL.id))) SEL = {kind: null, id: null}; render(); inspector(); save(); }
function undo() { if (!H.past.length) return; H.future.push(snap()); restore(H.past.pop()); updateUndo(); }
function redo() { if (!H.future.length) return; H.past.push(snap()); restore(H.future.pop()); updateUndo(); }
function updateUndo() { $("undo").disabled = !H.past.length; $("redo").disabled = !H.future.length; }
let saveTimer = null;
function save() { clearTimeout(saveTimer); saveTimer = setTimeout(() => { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} outputs(); }, 250); }

