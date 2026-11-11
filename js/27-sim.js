// ======================================================================= SIMULATION MODE (event list, animation, PDU details)
const SIM = {events: [], pos: 0, playing: false, speed: 1, clock: 0, timer: 0, sel: null,
  filters: {ARP: true, ICMP: true, DHCP: true, DNS: true, TCP: true, Telnet: true, SSH: true, HTTP: true}};
const PKT_COLORS = {ARP: "#e7b416", ICMP: "#e5508f", DHCP: "#20a464", DNS: "#7c4dff", TCP: "#1e88e5", Telnet: "#1e88e5", SSH: "#0d47a1", HTTP: "#00a3bf", IP: "#64748b"};
const FILTER_GROUPS = [["ARP"], ["ICMP"], ["DHCP"], ["DNS"], ["TCP", "Telnet", "SSH", "HTTP"]];
const visible = e => SIM.filters[e.kind] !== false;
// called by ping / DHCP / DNS / browser / telnet with the engine's event log
function simCapture(dev, label, events) {
  if (SIMMODE !== "simulation" || !events || !events.length) return;
  const hops = []; let pending = [];
  events.forEach(e => {
    if (e.kind === "note") { e.notes.forEach(n => pending.push(n)); return; }
    e.pre = pending; pending = []; hops.push(e);
  });
  if (pending.length && hops.length) hops[hops.length - 1].post = pending;
  hops.sort((a, b) => a.t - b.t);
  const base = SIM.clock, maxT = Math.max(...hops.map(e => e.t));
  hops.forEach((e, i) => { e.time = base + e.t * 0.001; e.batch = base; e.n = SIM.events.length + i + 1; });
  SIM.clock = +(base + maxT * 0.001 + 0.002).toFixed(3);
  SIM.events.push(...hops);
  if (SIM.events.length > 600) { const cut = SIM.events.length - 600; SIM.events.splice(0, cut); SIM.pos = Math.max(0, SIM.pos - cut); }
  renderRt();
  if (!SIM.playing) simPlay();
}
// ---- Add Simple PDU (envelope tool)
function firstIp(d) { const i = l3Ifaces(d).find(x => x.ip && x.up && !x.loop) || l3Ifaces(d).find(x => x.ip); return i ? i.ip : null; }
function simPdu(p) {
  const a = byId(p.src), b = byId(p.dst);
  if (!a || !b) return;
  const ip = firstIp(b);
  if (!l3Ifaces(a).some(i => i.ip)) { p.status = "Failed"; toast(`${a.name} has no IP address yet`); return; }
  if (!ip) { p.status = "Failed"; toast(`${b.name} has no IP address yet`); return; }
  let r = pingOnce(a, ip), evs = r.events;
  if (r.res.res !== "reply") { const r2 = pingOnce(a, ip); evs = evs.concat(r2.events); r = r2; }
  p.status = r.res.res === "reply" ? "Successful" : "Failed";
  p.dstIp = ip;
  simCapture(a, "ICMP", evs);
  if (SIMMODE !== "simulation") toast(`${a.name} → ${b.name} (${ip}): ${p.status === "Successful" ? "✓ Successful" : "✕ Failed"}`);
  if (typeof activityCheck === "function") activityCheck();
}
// ---- playback
function nextVisible(from) { let i = from; while (i < SIM.events.length && !visible(SIM.events[i])) i++; return i; }
function simStep() {
  const i = nextVisible(SIM.pos);
  if (i >= SIM.events.length) { simPause(); return false; }
  // everything that happens at the same moment moves together
  const t = SIM.events[i].time, group = [];
  let k = i;
  while (k < SIM.events.length && SIM.events[k].time === t) { if (visible(SIM.events[k])) group.push(SIM.events[k]); k++; }
  SIM.pos = k;
  group.forEach(animatePkt);
  SIM.sel = group[group.length - 1];
  renderRt();
  return true;
}
function simPlay() {
  if (SIM.playing) return;
  SIM.playing = true; renderRt();
  const tick = () => { if (!SIM.playing) return; if (!simStep()) return; SIM.timer = setTimeout(tick, 820 / SIM.speed); };
  tick();
}
function simPause() { SIM.playing = false; clearTimeout(SIM.timer); renderRt(); }
function simBack() { simPause(); const prev = SIM.events.slice(0, SIM.pos).filter(visible); if (!prev.length) return; const t = prev[prev.length - 1].time; while (SIM.pos > 0 && SIM.events[SIM.pos - 1].time >= t) SIM.pos--; SIM.sel = SIM.events[SIM.pos - 1] || null; renderRt(); }
function simReset() { simPause(); SIM.events = []; SIM.pos = 0; SIM.clock = 0; SIM.sel = null; $("gPkts").innerHTML = ""; renderRt(); }
function onSimModeChange() { simPause(); $("gPkts").innerHTML = ""; if (SIMMODE === "simulation") toast("Simulation mode: send a ping or a Simple PDU and watch every hop. Click an event for its OSI details."); }
// ---- envelope animation along the cable
function animatePkt(e) {
  const a = byId(e.from), b = byId(e.to); if (!a || !b) return;
  const col = PKT_COLORS[e.kind] || PKT_COLORS.IP, g = document.createElementNS("http://www.w3.org/2000/svg", "g");
  g.innerHTML = `<rect x="-11" y="-8" width="22" height="16" rx="2.5" fill="${col}" stroke="#fff" stroke-width="1.4"/><path d="M-11,-8 L0,1 L11,-8" fill="none" stroke="#fff" stroke-width="1.4"/>`;
  g.style.pointerEvents = "none";
  $("gPkts").appendChild(g);
  const dur = 700 / SIM.speed, t0 = performance.now();
  const step = now => {
    const k = Math.min(1, (now - t0) / dur), x = a.x + (b.x - a.x) * k, y = a.y + (b.y - a.y) * k - 4;
    g.setAttribute("transform", `translate(${f2(x)},${f2(y)})`);
    if (k < 1) requestAnimationFrame(step);
    else if (e.drop) {
      g.innerHTML = `<circle r="11" fill="#dc2626" stroke="#fff" stroke-width="1.5"/><path d="M-5,-5 L5,5 M5,-5 L-5,5" stroke="#fff" stroke-width="2.4" stroke-linecap="round"/>`;
      setTimeout(() => g.remove(), 900 / SIM.speed);
    } else setTimeout(() => g.remove(), 120);
  };
  requestAnimationFrame(step);
}
// ---- the panel
function renderSimPanel(body) {
  const rows = SIM.events.map((e, i) => ({e, i})).filter(x => visible(x.e));
  const nm = id => esc((byId(id) || {}).name || "?");
  body.innerHTML = `<div class="simbar">
      <button class="mini" data-s="reset" title="Reset simulation (clear events)">⏮</button>
      <button class="mini" data-s="back" title="Back">◀</button>
      <button class="mini play" data-s="play" title="${SIM.playing ? "Pause" : "Auto capture / play"}">${SIM.playing ? "⏸" : "▶"}</button>
      <button class="mini" data-s="step" title="Capture / forward one step">▶|</button>
      <input type="range" min="0.25" max="4" step="0.25" value="${SIM.speed}" title="Play speed" class="simspeed">
      <span class="simf">${FILTER_GROUPS.map(gr => `<label title="Show ${gr.join("/")} events"><input type="checkbox" data-f="${gr.join(",")}"${SIM.filters[gr[0]] !== false ? " checked" : ""}><span style="--c:${PKT_COLORS[gr[0]]}">${gr[0]}</span></label>`).join("")}</span>
    </div>
    <div class="simlist"><table class="pdutbl"><tr><th>Vis.</th><th>Time (sec)</th><th>Last Device</th><th>At Device</th><th>Type</th></tr>${rows.map(({e, i}) => `<tr data-ev="${i}" class="${i < SIM.pos ? "done" : ""}${SIM.sel === e ? " sel" : ""}"><td>${i < SIM.pos ? (e.drop ? "✕" : "👁") : ""}</td><td>${e.time.toFixed(3)}</td><td>${nm(e.from)}</td><td>${nm(e.to)}</td><td><span class="pk" style="--c:${PKT_COLORS[e.kind] || "#888"}"></span>${esc(e.kind)}${e.drop ? ' <b class="fail">dropped</b>' : ""}</td></tr>`).join("") || '<tr><td colspan="5" class="muted">No events yet. Ping from a PC (Desktop → Command Prompt), use ✉️ Add Simple PDU (P), or turn on DHCP on a PC.</td></tr>'}</table></div>`;
  const q = s => body.querySelector(s);
  body.querySelectorAll("[data-s]").forEach(b => b.onclick = () => ({reset: simReset, back: simBack, play: () => SIM.playing ? simPause() : simPlay(), step: () => { simPause(); simStep(); }})[b.dataset.s]());
  q(".simspeed").oninput = e => { SIM.speed = +e.target.value; };
  body.querySelectorAll("[data-f]").forEach(cb => cb.onchange = () => { cb.dataset.f.split(",").forEach(k => { SIM.filters[k] = cb.checked; }); renderRt(); });
  body.querySelectorAll("[data-ev]").forEach(tr => tr.onclick = ev => { const e = SIM.events[+tr.dataset.ev]; SIM.sel = e; renderRt(); showPduInfo(e, ev); });
  const sel = q("tr.sel"), box = q(".simlist"); if (sel && box) { const top = sel.getBoundingClientRect().top - box.getBoundingClientRect().top + box.scrollTop - box.clientHeight / 2; box.scrollTop = Math.max(0, top); }
}
// ---- PDU information (OSI view)
const pduWin = document.createElement("div"); pduWin.className = "ctx pduwin hidden"; document.body.appendChild(pduWin);
function describeLayers(e) {
  const f = e.frame, o = byId(e.to), from = byId(e.from), L = [];
  L.push(["Layer 1", `Port ${e.toPort || "wireless"} (from ${from ? from.name : "?"} ${e.fromPort})`]);
  L.push(["Layer 2", `Ethernet II  Src: ${f.src}  Dst: ${f.dst === BCAST ? "FFFF.FFFF.FFFF (broadcast)" : f.dst}${f.tag ? `  · 802.1Q tag VLAN ${f.tag}` : "  · untagged"}`]);
  if (f.type === "arp") {
    const a = f.arp;
    L.push(["Layer 3", a.op === "request" ? `ARP Request: who has ${a.tip}? Tell ${a.sip}` : `ARP Reply: ${a.sip} is at ${a.smac}`]);
  } else {
    const p = f.ip;
    L.push(["Layer 3", `IPv4  Src: ${p.src || "0.0.0.0"}  Dst: ${p.dst}  TTL: ${p.ttl}`]);
    if (p.proto === "icmp") L.push(["Layer 4", `ICMP ${({echo: "Echo Request (type 8)", reply: "Echo Reply (type 0)", ttl: "Time Exceeded (type 11)", unreach: "Destination Unreachable (type 3)"})[p.icmp.type]}${p.icmp.seq != null ? "  seq " + p.icmp.seq : ""}`]);
    else if (p.proto === "udp") {
      const u = p.udp;
      if (u.dhcp) L.push(["Layer 4", `UDP ${u.sport} → ${u.dport}`], ["Layer 7", `DHCP ${u.dhcp.op.toUpperCase()}${u.dhcp.yiaddr ? "  your IP: " + u.dhcp.yiaddr : ""}${u.dhcp.giaddr ? "  relay (giaddr): " + u.dhcp.giaddr : ""}  client MAC ${u.dhcp.chaddr}`]);
      else if (u.dns) L.push(["Layer 4", `UDP ${u.sport} → ${u.dport}`], ["Layer 7", u.dns.q ? `DNS query: A ${u.dns.q}?` : `DNS answer: ${u.dns.name} = ${u.dns.a || "(no record)"}`]);
    } else if (p.proto === "tcp") L.push(["Layer 4", `TCP ${p.tcp.sport} → ${p.tcp.dport}  flags ${p.tcp.flags}`]);
  }
  return {L, at: o};
}
function showPduInfo(e, ev) {
  const {L, at} = describeLayers(e);
  const notes = [...(e.pre || []), ...e.notes, ...(e.post || [])];
  pduWin.innerHTML = `<div class="ct">PDU information at ${esc(at ? at.name : "?")} · ${esc(e.kind)} · ${e.time.toFixed(3)} s</div>
    <div class="popb"><table class="osi">${L.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("")}</table>
    ${e.drop ? `<p class="fail">✕ Dropped: ${esc(e.drop)}</p>` : ""}
    ${notes.length ? `<h5>What the devices decided</h5><ol class="notes">${notes.map(n => `<li>${esc(n)}</li>`).join("")}</ol>` : ""}
    <div class="row" style="justify-content:flex-end"><button class="btn" data-x>Close</button></div></div>`;
  pduWin.classList.remove("hidden");
  pduWin.querySelector("[data-x]").onclick = () => pduWin.classList.add("hidden");
  const r = pduWin.getBoundingClientRect();
  pduWin.style.left = Math.max(8, Math.min((ev ? ev.clientX : innerWidth / 2) - r.width / 2, innerWidth - r.width - 8)) + "px";
  pduWin.style.top = Math.max(8, Math.min((ev ? ev.clientY : innerHeight / 2) - r.height - 12, innerHeight - r.height - 8)) + "px";
}
document.addEventListener("pointerdown", e => { if (!pduWin.contains(e.target) && !e.target.closest("[data-ev]")) pduWin.classList.add("hidden"); });

// extra tables for the Inspect tool
function inspectExtra(d) {
  const r = rt(d), out = [];
  const arp = Object.entries(r.arp);
  if (arp.length) out.push(`<h5>ARP table</h5><table class="pdutbl"><tr><th>IP address</th><th>MAC address</th><th>Interface</th></tr>${arp.map(([ip, e]) => `<tr><td>${esc(ip)}</td><td>${esc(e.mac)}</td><td>${esc(e.iface)}</td></tr>`).join("")}</table>`);
  if (isSwitch(d)) { const m = Object.values(r.mac); out.push(`<h5>MAC address table</h5>${m.length ? `<table class="pdutbl"><tr><th>VLAN</th><th>MAC address</th><th>Port</th></tr>${m.map(e => `<tr><td>${e.vlan}</td><td>${esc(e.mac)}</td><td>${esc(e.port)}</td></tr>`).join("")}</table>` : '<p class="muted">Empty: no frames seen yet.</p>'}`); }
  if (isIOS(d) && (isRouterish(d) || d.cfg.ipRouting)) out.push(`<h5>Routing table</h5><table class="pdutbl"><tr><th>Type</th><th>Network</th><th>Port / next hop</th></tr>${routeTable(d).filter(x => x.code !== "L").map(x => `<tr><td>${x.code}</td><td>${x.net}/${maskToLen(x.mask)}</td><td>${esc(x.nh || x.iface)}</td></tr>`).join("") || '<tr><td colspan="3" class="muted">No routes</td></tr>'}</table>`);
  if (isHost(d)) { const a = hostAddr(d); out.push(`<h5>IP settings</h5><p>${a.ip ? `${esc(a.ip)} / ${esc(a.mask)} · gateway ${esc(a.gw || "none")}${a.dhcp ? " (DHCP)" : ""}` : '<span class="muted">No IP address</span>'}</p>`); }
  return out.join("");
}
