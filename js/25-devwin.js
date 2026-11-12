// ======================================================================= DEVICE WINDOWS (double-click a device)
const WINS = {};
let WIN_Z = 100, WIN_N = 0;
function closeDeviceWindow(id) { const w = WINS[id]; if (w) { w.el.remove(); delete WINS[id]; } }
function openDeviceWindow(d, tab) {
  if (!d) return;
  if (WINS[d.id]) { const w = WINS[d.id]; w.el.style.zIndex = ++WIN_Z; if (tab) showTab(w, tab); return w; }
  initDevice(d);
  const tabs = isFw(d) ? ["Physical", "Firewall Manager", "CLI"] : isIOS(d) ? ["Physical", "Config", "CLI"] : isHost(d) ? (d.type === "server" ? ["Physical", "Config", "Services", "Desktop"] : ["Physical", "Config", "Desktop"]) : ["Physical"];
  const el = document.createElement("div");
  el.className = "devwin";
  const k = WIN_N++ % 6;
  if (isFw(d)) { el.classList.add("fwwin"); el.style.width = Math.min(innerWidth - 16, 1040) + "px"; el.style.height = Math.min(innerHeight - 24, 680) + "px"; }
  el.style.left = Math.max(8, Math.min(innerWidth - (isFw(d) ? Math.min(innerWidth - 16, 1040) + 8 : 680), 120 + k * 34)) + "px"; el.style.top = Math.max(8, Math.min(innerHeight - (isFw(d) ? Math.min(innerHeight - 24, 680) + 8 : 520), 70 + k * 30)) + "px"; el.style.zIndex = ++WIN_Z;
  el.innerHTML = `<div class="dwh"><span class="dwi">${iconSvg(d.type)}</span><b class="dwt"></b><span class="grow"></span><button class="btn icon dwx" title="Close" aria-label="Close"><svg class="i" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M6 6l12 12M18 6L6 18"/></svg></button></div>
    <div class="tabs dwtabs">${tabs.map(t => `<button class="tab" data-t="${t}">${t}</button>`).join("")}</div>
    <div class="dwb">${tabs.map(t => `<div class="dwp hidden" data-p="${t}"></div>`).join("")}</div>`;
  document.body.appendChild(el);
  const w = {el, dev: d, tab: null, tabs};
  WINS[d.id] = w;
  el.querySelector(".dwt").textContent = d.name;
  el.querySelector(".dwx").onclick = () => closeDeviceWindow(d.id);
  el.addEventListener("pointerdown", () => { el.style.zIndex = ++WIN_Z; });
  el.querySelectorAll(".dwtabs .tab").forEach(b => b.onclick = () => showTab(w, b.dataset.t));
  // drag by the title bar
  const head = el.querySelector(".dwh");
  head.addEventListener("pointerdown", e => {
    if (e.target.closest("button")) return;
    const r = el.getBoundingClientRect(), ox = e.clientX - r.left, oy = e.clientY - r.top;
    head.setPointerCapture(e.pointerId);
    const mv = ev => { el.style.left = Math.max(0, Math.min(innerWidth - 80, ev.clientX - ox)) + "px"; el.style.top = Math.max(0, Math.min(innerHeight - 40, ev.clientY - oy)) + "px"; };
    const up = () => { head.removeEventListener("pointermove", mv); head.removeEventListener("pointerup", up); };
    head.addEventListener("pointermove", mv); head.addEventListener("pointerup", up);
  });
  showTab(w, tab === "Config" && isFw(d) ? "Firewall Manager" : tab || (isFw(d) ? "Firewall Manager" : isIOS(d) ? "CLI" : isHost(d) ? "Desktop" : "Physical"));
  return w;
}
function showTab(w, t) {
  w.tab = t;
  w.el.querySelectorAll(".dwtabs .tab").forEach(b => b.classList.toggle("on", b.dataset.t === t));
  w.el.querySelectorAll(".dwp").forEach(p => p.classList.toggle("hidden", p.dataset.p !== t));
  const pane = w.el.querySelector(`.dwp[data-p="${t}"]`);
  if (t === "CLI") { if (!w.term) w.term = makeConsole(pane, w.dev); setTimeout(() => w.term.focus(), 0); return; }
  if (t === "Desktop") { if (!pane.dataset.built) { pane.dataset.built = 1; buildDesktop(w, pane); } return; }
  renderPane(w, t, pane);
}
function renderPane(w, t, pane) {
  pane = pane || w.el.querySelector(`.dwp[data-p="${t}"]`);
  if (t === "Physical") pane.innerHTML = physicalHtml(w.dev);
  else if (t === "Firewall Manager") buildFwGui(w, pane);
  else if (t === "Config") isIOS(w.dev) ? buildIosConfig(w, pane) : buildHostConfig(w, pane);
  else if (t === "Services") buildServices(w, pane);
}
function refreshDevWins(d, fromCli) {
  for (const id in WINS) {
    const w = WINS[id];
    if (!byId(id)) { closeDeviceWindow(id); continue; }
    w.el.querySelector(".dwt").textContent = w.dev.name;
    if (w.tab === "Physical") renderPane(w, "Physical");
    if (w.tab === "Config" && w.dev === d && fromCli) renderPane(w, "Config");
    if (w.tab === "Firewall Manager" && w.dev === d && fromCli && !w.fwBusy) { w.fwBusy = true; setTimeout(() => { w.fwBusy = false; if (WINS[w.dev.id] === w && w.tab === "Firewall Manager") buildFwGui(w); }, 0); }
  }
}
// ---- the CLI tab is the device's console port
function makeConsole(pane, d) {
  pane.classList.add("termwrap");
  const T = createTerminal(pane, {onIdleEnter: () => startIOS(T, d, "console")});
  if (isFw(d)) T.print(`Rebooting....

Cisco Systems ROMMON Version (1.1.8) #0: Thu Dec 28 13:42:35 PST 2017

Platform ${d.model.replace(/ /g, "")} with ${d.model.startsWith("FPR") ? 8192 : 4096} Mbytes of main memory
Booting disk0:/asa${asaVer(d).replace(/\D/g, "")}-lfbff-k8.SPA...

Loading...

Cisco Adaptive Security Appliance Software Version ${asaVer(d)}

  ****************************** Warning *******************************
  This product contains cryptographic features and is
  subject to United States and local country laws
  governing, import, export, transfer, and use.
  **********************************************************************

${d.startup ? "" : "INFO: Converting to factory-default configuration.\n\n"}Type help or '?' for a list of available commands.

Press RETURN to get started!

`);
  else T.print(`${d.type === "router" ? "System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\nCopyright (c) 2010 by cisco Systems, Inc.\n\n" : "C2960 Boot Loader (C2960-HBOOT-M) Version 12.2(25r)FX, RELEASE SOFTWARE (fc4)\n\n"}cisco ${d.model} processor with 491520K/32768K bytes of memory.\n\n${d.startup ? "" : "         --- System Configuration Dialog ---\n\nWould you like to enter the initial configuration dialog? [yes/no]: no\n\n"}Press RETURN to get started!\n\n`);
  T.refresh();
  return T;
}

// ---- Physical tab: the chassis with live port lights
function physicalHtml(d) {
  const ports = allPorts(d);
  const pw = 34, cols = Math.min(12, Math.max(2, ports.length)), rows = Math.ceil(ports.length / cols);
  const W = Math.max(360, cols * (pw + 8) + 60), H = 110 + rows * 52;
  let s = `<svg viewBox="0 0 ${W} ${H}" class="chassis"><rect x="6" y="20" width="${W - 12}" height="${H - 30}" rx="10" fill="#2b3442" stroke="#121821" stroke-width="2"/><rect x="18" y="32" width="${W - 36}" height="20" rx="4" fill="#3a4556"/><text x="26" y="47" font-size="12" fill="#cfd8e6" font-weight="700">${esc(d.model)}</text><text x="${W - 26}" y="47" font-size="11" fill="#9fb0c6" text-anchor="end">${esc(TYPES[d.type].label)}</text>`;
  s += `<circle cx="${W - 34}" cy="${H - 24}" r="6" fill="#22c55e"/><text x="${W - 46}" y="${H - 20}" font-size="10" fill="#cfd8e6" text-anchor="end">PWR</text>`;
  ports.forEach((p, i) => {
    const x = 30 + (i % cols) * (pw + 8), y = 66 + Math.floor(i / cols) * 52;
    const o = linkAt(d, p);
    let st = "none";
    if (o) { const ls = linkStatus(o.l); st = (o.l.a === d.id ? ls.a : ls.b) || (physUp(d, p) ? "up" : "down"); }
    if (isIOS(d) && d.cfg.ifaces[p] && d.cfg.ifaces[p].shutdown) st = o ? "down" : "admin";
    const led = st === "up" ? "#22c55e" : st === "block" ? "#f59e0b" : st === "down" ? "#ef4444" : "#4b5563";
    const kind = portKind(p);
    s += `<g><title>${esc(p)}${o ? " → " + esc(o.dev.name) + " " + esc(o.port) : " (empty)"}</title><rect x="${x}" y="${y}" width="${pw}" height="26" rx="3" fill="${kind === "serial" ? "#6b4b2a" : kind === "console" ? "#2c5a7a" : "#11161d"}" stroke="#5c6b80"/>${kind === "eth" ? `<rect x="${x + 9}" y="${y + 18}" width="${pw - 18}" height="6" fill="#2b3442"/>` : ""}<circle cx="${x + pw - 6}" cy="${y + 6}" r="3.2" fill="${led}"/><text x="${x + pw / 2}" y="${y + 40}" font-size="9" fill="#cfd8e6" text-anchor="middle">${esc(p.replace(/^Console$/, "CON"))}</text></g>`;
  });
  s += "</svg>";
  const conns = S.links.filter(l => l.a === d.id || l.b === d.id).map(l => { const mine = l.a === d.id, o = byId(mine ? l.b : l.a); return `<li><b>${esc((mine ? l.pa : l.pb) || "wireless")}</b> → ${esc(o ? o.name : "?")} ${esc((mine ? l.pb : l.pa) || "")} <span class="muted">(${esc((CABLES[l.cable] || {}).short || l.cable)})</span></li>`; }).join("");
  return `<div class="phys">${s}<div class="physinfo"><p class="muted">${esc(findModel(d.type, d.model) ? findModel(d.type, d.model).desc : "")}. Green = up, orange = STP blocking, red = down, grey = empty. Hover a port for details.</p><ul class="physlist">${conns || "<li class='muted'>No cables yet.</li>"}</ul></div></div>`;
}

// ---- Config tab for routers/switches: forms that run real IOS commands
function hiddenSession(w) {
  const d = w.dev;
  const T = {print: t => { w.eqText = (w.eqText || "") + t; const lg = w.el.querySelector(".eqlog"); if (lg) { lg.textContent = w.eqText; lg.scrollTop = lg.scrollHeight; } }, refresh() {}, runAsync(steps, done) { steps.forEach(([, x]) => typeof x === "function" ? x() : T.print(x)); if (done) done(); }, stack: [], push() {}, pop() {}};
  const s = newSession(d, "gui", T); s.mode = "priv"; s.authed = true; T.stack.push(s);
  return s;
}
function runIos(w, cmds, alsoPriv) {
  const s = w.guiSess || (w.guiSess = hiddenSession(w));
  s.mode = "priv"; s.pending = null;
  const lines = alsoPriv ? cmds : ["configure terminal", ...cmds, "end"];
  lines.forEach(c => { s.term.print(promptOf(s) + c + "\n"); cliLine(s, c); if (s.pending) { const p = s.pending; s.pending = null; p.fn(""); } });
}
function buildIosConfig(w, pane) {
  const d = w.dev, c = d.cfg;
  const sel = w.cfgSel || "global";
  const items = [["global", "Settings", "GLOBAL"], ["routing", "Static", "ROUTING"], ...(isSwitch(d) ? [["vlans", "VLAN Database", "SWITCHING"]] : []),
    ...ifOrder(d).filter(n => c.ifaces[n]).map(n => ["if:" + n, longIf(n), "INTERFACE"])];
  let nav = "", lastH = "";
  items.forEach(([k, label, h]) => { if (h !== lastH) { nav += `<div class="cfgh">${h}</div>`; lastH = h; } nav += `<button class="cfgi${k === sel ? " on" : ""}" data-k="${esc(k)}">${esc(label)}</button>`; });
  let body = "";
  if (sel === "global") body = `<h4>Global Settings</h4>
    <label>Display Name<input data-g="name" value="${esc(d.name)}"></label>
    <label>Hostname<input data-g="hostname" value="${esc(c.hostname)}"></label>
    <div class="sect">NVRAM</div><div class="row"><button class="btn" data-a="erase">Erase</button><button class="btn primary" data-a="save">Save</button></div>
    <div class="sect">Startup config</div><div class="row"><button class="btn" data-a="showstart">View startup-config</button><button class="btn" data-a="showrun">View running-config</button></div>`;
  else if (sel === "routing") body = `<h4>Static Routes</h4>
    <div class="pair3"><label>Network<input id="rNet" placeholder="10.0.0.0"></label><label>Mask<input id="rMask" placeholder="255.255.255.0"></label><label>Next Hop<input id="rNh" placeholder="192.168.1.2"></label></div>
    <div class="row"><button class="btn primary" data-a="addRoute">Add</button></div>
    <div class="sect">Network Address</div><ul class="cfglist">${c.routes.map((r, i) => `<li><span>${r.net}/${maskToLen(r.mask)} via ${esc(r.nh || r.iface)}</span><button class="mini" data-rm="${i}">Remove</button></li>`).join("") || "<li class='muted'>No static routes.</li>"}</ul>`;
  else if (sel === "vlans") body = `<h4>VLAN Configuration</h4>
    <div class="pair"><label>VLAN Number<input id="vNum" type="number" min="2" max="4094"></label><label>VLAN Name<input id="vName"></label></div>
    <div class="row"><button class="btn primary" data-a="addVlan">Add</button></div>
    <ul class="cfglist">${Object.entries(c.vlans).map(([v, n]) => `<li><span>${v} — ${esc(n)}</span>${+v === 1 ? "" : `<button class="mini" data-rv="${v}">Remove</button>`}</li>`).join("")}</ul>`;
  else if (sel.startsWith("if:")) {
    const n = sel.slice(3), i = c.ifaces[n], st = ifStatus(d, n), sw = isSwitchport(d, n);
    body = `<h4>${esc(longIf(n))}</h4>
      <label class="chk inline"><input type="checkbox" data-i="on"${i.shutdown ? "" : " checked"}> Port Status: On <span class="muted">(${st.status} / protocol ${st.proto})</span></label>
      ${sw ? `<div class="pair"><label>Mode<select data-i="mode"><option value="access"${i.mode !== "trunk" ? " selected" : ""}>Access</option><option value="trunk"${i.mode === "trunk" ? " selected" : ""}>Trunk</option></select></label>
        <label>${i.mode === "trunk" ? "Native VLAN" : "VLAN"}<select data-i="vlan">${Object.entries(c.vlans).map(([v, nm]) => `<option value="${v}"${+v === (i.mode === "trunk" ? i.nativeVlan : i.accessVlan) ? " selected" : ""}>${v}: ${esc(nm)}</option>`).join("")}</select></label></div>`
        : `<div class="pair"><label>IPv4 Address<input data-i="ip" value="${esc(i.ip)}" placeholder="192.168.1.1"></label><label>Subnet Mask<input data-i="mask" value="${esc(i.mask)}" placeholder="255.255.255.0"></label></div>
        <div class="row"><button class="btn primary" data-a="setIp">Apply IP</button>${i.ip ? '<button class="btn" data-a="noIp">Remove IP</button>' : ""}</div>`}
      ${portKind(n) === "serial" ? `<label>Clock Rate<select data-i="clock"><option value="">Not Set</option>${RATES.map(r => `<option${i.clock === r ? " selected" : ""}>${r}</option>`).join("")}</select></label>` : ""}
      ${portKind(n) === "eth" && !isVirtualIf(n) ? `<div class="pair"><label>Bandwidth<select data-i="speed">${["auto", "10", "100", "1000"].map(v => `<option${i.speed === v ? " selected" : ""}>${v}</option>`).join("")}</select></label><label>Duplex<select data-i="duplex">${["auto", "half", "full"].map(v => `<option${i.duplex === v ? " selected" : ""}>${v}</option>`).join("")}</select></label></div>` : ""}
      <label>Description<input data-i="desc" value="${esc(i.desc)}"></label>`;
  }
  pane.innerHTML = `<div class="cfg"><nav class="cfgnav">${nav}</nav><div class="cfgbody">${body}</div></div><div class="eqh">Equivalent IOS Commands</div><pre class="eqlog"></pre>`;
  const log = pane.querySelector(".eqlog");
  log.textContent = w.eqText || ""; log.scrollTop = log.scrollHeight;
  pane.querySelectorAll(".cfgi").forEach(b => b.onclick = () => { w.cfgSel = b.dataset.k; buildIosConfig(w, pane); });
  const q = x => pane.querySelector(x);
  const run = (cmds, priv) => { runIos(w, cmds, priv); buildIosConfig(w, pane); };
  pane.querySelectorAll("[data-g]").forEach(inp => inp.onchange = () => {
    if (inp.dataset.g === "name") { commit(); d.name = inp.value.trim() || d.name; render(); inspector(); save(); refreshDevWins(d); }
    else if (inp.value.trim()) run(["hostname " + inp.value.trim().replace(/\s+/g, "-")]);
  });
  pane.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "save") run(["copy running-config startup-config"], true);
    else if (a === "erase") run(["erase startup-config"], true);
    else if (a === "showrun" || a === "showstart") { w.eqText = (w.eqText || "") + (a === "showrun" ? runningConfig(d) : (startupConfig(d) || "startup-config is not present")) + "\n"; log.textContent = w.eqText; log.scrollTop = log.scrollHeight; }
    else if (a === "addRoute") run([`ip route ${q("#rNet").value.trim()} ${q("#rMask").value.trim()} ${q("#rNh").value.trim()}`]);
    else if (a === "addVlan") { const v = q("#vNum").value.trim(), nm = q("#vName").value.trim(); if (v) run(nm ? [`vlan ${v}`, `name ${nm.replace(/\s+/g, "_")}`] : [`vlan ${v}`]); }
    else if (a === "setIp") { const n = sel.slice(3); run([`interface ${longIf(n)}`, `ip address ${q('[data-i="ip"]').value.trim()} ${q('[data-i="mask"]').value.trim()}`]); }
    else if (a === "noIp") run([`interface ${longIf(sel.slice(3))}`, "no ip address"]);
  });
  pane.querySelectorAll("[data-rm]").forEach(b => b.onclick = () => { const r = c.routes[+b.dataset.rm]; run([`no ip route ${r.net} ${r.mask} ${r.nh || longIf(r.iface)}`]); });
  pane.querySelectorAll("[data-rv]").forEach(b => b.onclick = () => run([`no vlan ${b.dataset.rv}`]));
  pane.querySelectorAll("[data-i]").forEach(inp => {
    if (["ip", "mask"].includes(inp.dataset.i)) return;
    inp.onchange = () => {
      const n = sel.slice(3), k = inp.dataset.i, ifcmd = `interface ${longIf(n)}`;
      if (k === "on") run([ifcmd, inp.checked ? "no shutdown" : "shutdown"]);
      else if (k === "mode") run([ifcmd, `switchport mode ${inp.value}`]);
      else if (k === "vlan") run([ifcmd, c.ifaces[n].mode === "trunk" ? `switchport trunk native vlan ${inp.value}` : `switchport access vlan ${inp.value}`]);
      else if (k === "clock") run([ifcmd, inp.value ? `clock rate ${inp.value}` : "no clock rate"]);
      else if (k === "speed" || k === "duplex") run([ifcmd, `${k} ${inp.value}`]);
      else if (k === "desc") run([ifcmd, inp.value.trim() ? `description ${inp.value.trim()}` : "no description"]);
    };
  });
}

// ---- Config tab for PCs/servers
function buildHostConfig(w, pane) {
  const d = w.dev, a = hostAddr(d), p = hostPort(d);
  pane.innerHTML = `<div class="cfgsimple"><h4>Global Settings</h4><label>Display Name<input data-h="name" value="${esc(d.name)}"></label>
    <div class="sect">Interface ${esc(p)}</div>
    <p class="muted">MAC address <code>${macDashed(macOf(d, p))}</code></p>
    <p>IP settings are in <b>Desktop → IP Configuration</b>, like Packet Tracer.</p>
    <div class="row"><button class="btn primary" data-a="ipc">Open IP Configuration</button></div>
    <p class="muted">Current: ${a.ip ? `${esc(a.ip)} / ${esc(a.mask)}${a.gw ? " · gateway " + esc(a.gw) : ""}${a.dns ? " · DNS " + esc(a.dns) : ""}` : "no IP address"}${a.dhcp ? " (DHCP)" : ""}</p></div>`;
  pane.querySelector('[data-h="name"]').onchange = e => { commit(); d.name = e.target.value.trim() || d.name; render(); inspector(); save(); refreshDevWins(d); };
  pane.querySelector('[data-a="ipc"]').onclick = () => { showTab(w, "Desktop"); openApp(w, "ipconfig"); };
}

// ---- Services tab (servers)
function buildServices(w, pane) {
  const d = w.dev, v = d.svc, sel = w.svcSel || "HTTP";
  const nav = ["HTTP", "DHCP", "DNS"].map(k => `<button class="cfgi${k === sel ? " on" : ""}" data-k="${k}">${k}</button>`).join("");
  let body = "";
  const onoff = (k, on) => `<div class="seg onoff" data-svc="${k}"><button class="btn${on ? " on" : ""}" data-v="1">On</button><button class="btn${on ? "" : " on"}" data-v="0">Off</button></div>`;
  if (sel === "HTTP") body = `<h4>HTTP</h4>${onoff("http", v.http.on)}<label>index.html<textarea id="hPage" rows="9">${esc(v.http.page)}</textarea></label><div class="row"><button class="btn primary" data-a="savePage">Save page</button></div>`;
  else if (sel === "DHCP") {
    const p = v.dhcp.pools[0];
    body = `<h4>DHCP</h4>${onoff("dhcp", v.dhcp.on)}
      <div class="pair"><label>Pool Name<input data-p="name" value="${esc(p.name)}"></label><label>Default Gateway<input data-p="gw" value="${esc(p.gw)}"></label></div>
      <div class="pair"><label>DNS Server<input data-p="dns" value="${esc(p.dns)}"></label><label>Start IP Address<input data-p="start" value="${esc(p.start)}" placeholder="192.168.1.100"></label></div>
      <div class="pair"><label>Subnet Mask<input data-p="mask" value="${esc(p.mask)}"></label><label>Maximum Users<input data-p="max" type="number" value="${p.max}"></label></div>
      <p class="muted">Leases: ${Object.entries(rt(d).leases).map(([m, ip]) => `${ip} → ${m}`).join(", ") || "none yet"}</p>`;
  } else body = `<h4>DNS</h4>${onoff("dns", v.dns.on)}
      <div class="pair"><label>Name<input id="dName" placeholder="www.example.com"></label><label>Address<input id="dIp" placeholder="192.168.1.10"></label></div>
      <div class="row"><button class="btn primary" data-a="addDns">Add</button></div>
      <ul class="cfglist">${v.dns.records.map((r, i) => `<li><span>${esc(r.name)} → A ${esc(r.ip)}</span><button class="mini" data-rd="${i}">Remove</button></li>`).join("") || "<li class='muted'>No records.</li>"}</ul>`;
  pane.innerHTML = `<div class="cfg"><nav class="cfgnav"><div class="cfgh">SERVICES</div>${nav}</nav><div class="cfgbody">${body}</div></div>`;
  const re = () => { save(); buildServices(w, pane); if (typeof activityCheck === "function") activityCheck(); };
  pane.querySelectorAll(".cfgi").forEach(b => b.onclick = () => { w.svcSel = b.dataset.k; buildServices(w, pane); });
  pane.querySelectorAll(".onoff").forEach(g => g.querySelectorAll(".btn").forEach(b => b.onclick = () => { v[g.dataset.svc].on = b.dataset.v === "1"; re(); }));
  pane.querySelectorAll("[data-p]").forEach(inp => inp.onchange = () => { const p = v.dhcp.pools[0], k = inp.dataset.p; p[k] = k === "max" ? +inp.value : inp.value.trim(); re(); });
  const q = x => pane.querySelector(x);
  pane.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    if (b.dataset.a === "savePage") { v.http.page = q("#hPage").value; re(); toast("Web page saved"); }
    if (b.dataset.a === "addDns") { const n = q("#dName").value.trim(), ip = q("#dIp").value.trim(); if (!n || !isIp(ip)) { toast("Enter a name and a valid IP address"); return; } v.dns.records = v.dns.records.filter(r => r.name !== n); v.dns.records.push({name: n, ip}); re(); }
  });
  pane.querySelectorAll("[data-rd]").forEach(b => b.onclick = () => { v.dns.records.splice(+b.dataset.rd, 1); re(); });
}
