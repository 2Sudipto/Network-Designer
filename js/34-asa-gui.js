// ======================================================================= FIREWALL MANAGER (web GUI for the firewall)
// Every change runs the equivalent firewall CLI commands through a hidden session, so the GUI and CLI never disagree.
const FWI = {
  dash: '<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  ifaces: '<rect x="3" y="7" width="18" height="10" rx="2"/><path d="M7 11v2M11 11v2M15 11v2"/>',
  routes: '<circle cx="6" cy="18" r="2.5"/><circle cx="18" cy="6" r="2.5"/><path d="M8.5 18H14a4 4 0 0 0 0-8h-4a4 4 0 0 1 0-8h5.5"/>',
  objects: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M12 12l8-4.5M12 12v9M12 12L4 7.5"/>',
  rules: '<path d="M12 3l7 3v5c0 4.5-3 8.3-7 10-4-1.7-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/>',
  nat: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  dhcp: '<rect x="4" y="4" width="16" height="6" rx="1.5"/><rect x="4" y="14" width="16" height="6" rx="1.5"/><path d="M8 7h.01M8 17h.01"/>',
  mgmt: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  monitor: '<path d="M3 12h4l3-8 4 16 3-8h4"/>',
  tracer: '<circle cx="5" cy="12" r="2"/><circle cx="19" cy="12" r="2"/><path d="M7 12h3m4 0h3"/><path d="M12 8v8"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', save: '<path d="M5 3h11l3 3v15H5z"/><path d="M8 3v6h8M8 21v-7h8v7"/>', refresh: '<path d="M20 11a8 8 0 0 0-14.9-3M4 4v4h4M4 13a8 8 0 0 0 14.9 3M20 20v-4h-4"/>',
  play: '<path d="M7 4l13 8-13 8z"/>', check: '<path d="M5 12l5 5 9-10"/>', x: '<path d="M6 6l12 12M18 6L6 18"/>', term: '<path d="M4 6l6 6-6 6M12 18h8"/>',
};
const fi = (k, c) => `<svg class="fwi${c ? " " + c : ""}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">${FWI[k]}</svg>`;
const FW_PAGES = [["dash", "Dashboard"], ["ifaces", "Interfaces"], ["routes", "Static Routes"], ["objects", "Network Objects"], ["rules", "Access Rules"], ["nat", "NAT Rules"], ["dhcp", "DHCP Server"], ["mgmt", "Device Management"], ["monitor", "Monitoring"], ["tracer", "Packet Tracer"]];
const FW_GROUPS = {dash: "HOME", ifaces: "DEVICE SETUP", rules: "FIREWALL", dhcp: "SERVICES", mgmt: "SYSTEM", monitor: "TOOLS"};

function fwState(w) { return w.fw || (w.fw = {page: "dash", add: {}, editIf: null, monTab: "conn", logQ: "", pt: {ifn: "", proto: "icmp", src: "", sport: "1025", dst: "", dport: "80", type: "8"}}); }
// run CLI commands from the GUI; returns false (and shows the error) if the firewall rejected one
function fwRun(w, cmds, exec) {
  const s = w.guiSess || (w.guiSess = hiddenSession(w)), T = s.term;
  s.mode = "priv"; s.pending = null;
  let out = "";
  const real = T.print; T.print = t => { out += t; real(t); };
  try {
    (exec ? cmds : ["configure terminal", ...cmds, "end"]).forEach(c => {
      const cmd = typeof c === "string" ? c : c.cmd;
      real(promptOf(s) + cmd + "\n"); cliLine(s, cmd);
      if (s.pending) { const p = s.pending; s.pending = null; p.fn(typeof c === "string" ? "" : c.answer); }
    });
  } finally { T.print = real; }
  const err = out.split("\n").map(x => x.trim()).find(x => /^(ERROR|% Invalid|% Incomplete|Command rejected)/.test(x));
  if (err) toast(err.replace(/^ERROR:\s*/, ""));
  buildFwGui(w);
  return !err;
}
const fwDirty = d => !d.startup || d.startup !== JSON.stringify(d.cfg);
const fwIfList = d => asaIfOrder(d).map(n => ({n, i: d.cfg.ifaces[n], st: ifStatus(d, n)}));
const fwNameifs = d => fwIfList(d).filter(x => x.i.nameif).map(x => x.i.nameif);
const opt = (v, cur, label) => `<option value="${esc(v)}"${String(v) === String(cur) ? " selected" : ""}>${esc(label == null ? v : label)}</option>`;
const led = st => `<span class="fled ${st.proto === "up" ? "up" : st.status.startsWith("admin") ? "admin" : "down"}"></span>`;
const addrTxt = a => a.any ? '<span class="fchip any">any</span>' : a.host ? `<span class="fchip">${esc(a.host)}</span>` : a.obj ? `<span class="fchip obj">${esc(a.obj)}</span>` : a.ifn ? `<span class="fchip">interface ${esc(a.ifn)}</span>` : `<span class="fchip">${esc(a.ip)}/${maskToLen(a.mask)}</span>`;
const svcTxt = e => e.proto === "ip" ? '<span class="fchip any">any</span>' : e.proto === "icmp" ? `<span class="fchip svc">icmp${e.icmp ? " " + esc(ICMP_NAME[e.icmp]) : ""}</span>` : `<span class="fchip svc">${e.proto}${e.dport ? (e.dport.op === "eq" ? "/" + (ASA_PNAME[e.dport.a] || e.dport.a) : e.dport.op === "range" ? `/${e.dport.a}-${e.dport.b}` : ` ${e.dport.op} ${e.dport.a}`) : ""}</span>`;
// address picker → ASA syntax tokens
function addrPicker(id, objs, label) {
  return `<div class="ffield"><span>${label}</span><div class="frow"><select data-ap="${id}">${opt("any", "any", "Any")}${opt("host", "", "Host")}${opt("net", "", "Network")}${objs.length ? opt("obj", "", "Object") : ""}</select>
    <input data-apv="${id}" placeholder="IP address" class="hide"><input data-apm="${id}" placeholder="Mask, e.g. 255.255.255.0" class="hide">
    <select data-apo="${id}" class="hide">${objs.map(o => opt(o, "")).join("")}</select></div></div>`;
}
function readAddr(root, id) {
  const t = root.querySelector(`[data-ap="${id}"]`).value, v = root.querySelector(`[data-apv="${id}"]`).value.trim(), m = root.querySelector(`[data-apm="${id}"]`).value.trim();
  if (t === "any") return "any";
  if (t === "host") return isIp(v) ? "host " + v : null;
  if (t === "net") { const c = parseCidr(v); if (c) return `${netOf(c.ip, c.mask)} ${c.mask}`; return isIp(v) && isMask(m) ? `${netOf(v, m)} ${m}` : null; }
  return "object " + root.querySelector(`[data-apo="${id}"]`).value;
}
function bindAddrPickers(root) {
  root.querySelectorAll("[data-ap]").forEach(sel => {
    const id = sel.dataset.ap, sync = () => {
      const t = sel.value;
      root.querySelector(`[data-apv="${id}"]`).classList.toggle("hide", t !== "host" && t !== "net");
      root.querySelector(`[data-apm="${id}"]`).classList.toggle("hide", t !== "net");
      root.querySelector(`[data-apo="${id}"]`).classList.toggle("hide", t !== "obj");
      root.querySelector(`[data-apv="${id}"]`).placeholder = t === "net" ? "Network or CIDR, e.g. 10.1.1.0/24" : "IP address";
    };
    sel.onchange = sync; sync();
  });
}

function buildFwGui(w, pane) {
  pane = pane || w.el.querySelector('.dwp[data-p="Firewall Manager"]');
  if (!pane) return;
  const d = w.dev, c = d.cfg, F = fwState(w);
  if (!pane.querySelector(".fwm")) {
    pane.classList.add("fwpane");
    pane.innerHTML = `<div class="fwm"><header class="fwtop"><span class="fwlogo">${iconSvg("firewall")}</span><div class="fwid"><b class="fwhost"></b><span class="fwsub"></span></div><span class="grow"></span><span class="fwsave-state"></span><button class="fbtn pri" data-top="save">${fi("save")}Save</button><button class="fbtn ghost" data-top="cli" title="Show the CLI commands the GUI sent">${fi("term")}Commands</button></header>
      <div class="fwbody"><nav class="fwnav"></nav><main class="fwmain"></main></div>
      <div class="fwdrawer hidden"><div class="fwdh"><b>CLI commands sent by Firewall Manager</b><span class="grow"></span><button class="fbtn ghost sm" data-top="clr">Clear</button><button class="fbtn ghost sm" data-top="cli">${fi("x")}</button></div><pre class="eqlog"></pre></div></div>`;
    pane.querySelectorAll("[data-top]").forEach(b => b.onclick = () => {
      const a = b.dataset.top;
      if (a === "save") { fwRun(w, ["write memory"], true); toast("Running configuration saved to startup-config"); }
      if (a === "cli") pane.querySelector(".fwdrawer").classList.toggle("hidden");
      if (a === "clr") { w.eqText = ""; pane.querySelector(".eqlog").textContent = ""; }
    });
  }
  pane.querySelector(".fwhost").textContent = c.hostname;
  pane.querySelector(".fwsub").textContent = `${d.model} · ASA ${asaVer(d)} · ${d.name}`;
  const dirty = fwDirty(d);
  const ss = pane.querySelector(".fwsave-state"); ss.className = "fwsave-state " + (dirty ? "warn" : "ok"); ss.textContent = dirty ? "Unsaved changes" : "Saved";
  let nav = "";
  FW_PAGES.forEach(([k, label]) => { if (FW_GROUPS[k]) nav += `<div class="fwng">${FW_GROUPS[k]}</div>`; nav += `<button class="fwni${F.page === k ? " on" : ""}" data-pg="${k}">${fi(k)}<span>${label}</span></button>`; });
  pane.querySelector(".fwnav").innerHTML = nav;
  pane.querySelectorAll("[data-pg]").forEach(b => b.onclick = () => { F.page = b.dataset.pg; F.add = {}; F.editIf = null; buildFwGui(w); });
  const log = pane.querySelector(".eqlog"); log.textContent = w.eqText || ""; log.scrollTop = log.scrollHeight;
  const main = pane.querySelector(".fwmain");
  const keep = main.scrollTop;
  main.innerHTML = (FW_RENDER[F.page] || FW_RENDER.dash)(w, d, c, F);
  main.scrollTop = keep;
  (FW_BIND[F.page] || (() => {}))(w, d, c, F, main);
  clearInterval(w.fwTimer);
  if (F.page === "dash" || F.page === "monitor") w.fwTimer = setInterval(() => {
    if (!document.body.contains(main) || w.tab !== "Firewall Manager") { clearInterval(w.fwTimer); return; }
    if (main.contains(document.activeElement) && /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
    const k = main.scrollTop; main.innerHTML = FW_RENDER[F.page](w, d, c, F); main.scrollTop = k; (FW_BIND[F.page] || (() => {}))(w, d, c, F, main);
  }, 2500);
}
const card = (title, body, extra) => `<section class="fcard"><div class="fch"><h3>${title}</h3><span class="grow"></span>${extra || ""}</div>${body}</section>`;
const pageHead = (title, sub, actions) => `<div class="fph"><div><h2>${title}</h2><p>${sub}</p></div><span class="grow"></span>${actions || ""}</div>`;

const FW_RENDER = {
  dash(w, d, c) {
    const ifs = fwIfList(d), conns = asaConns(d), xl = asaXl(d).filter(x => x.kind !== "static"), log = rt(d).log || [];
    const denies = log.filter(e => /%ASA-\d-(106023|106001|106014|106006|313004|710003)/.test(e.msg)).length;
    const up = Math.max(1, Math.round(performance.now() / 1000));
    return pageHead("Dashboard", `${esc(c.hostname)} — ${esc(d.model)}`, `<button class="fbtn" data-go="tracer">${fi("tracer")}Packet Tracer</button>`) +
      `<div class="fkpis"><div class="fkpi"><span>Active connections</span><b>${conns.length}</b></div><div class="fkpi"><span>NAT translations</span><b>${xl.length}</b></div><div class="fkpi"><span>Access rules</span><b>${Object.values(c.acls).reduce((n, a) => n + a.entries.filter(e => e.remark == null).length, 0)}</b></div><div class="fkpi ${denies ? "bad" : ""}"><span>Denied packets (log)</span><b>${denies}</b></div></div>` +
      `<div class="fgrid2">` + card("Device information", `<dl class="fdl"><dt>Hostname</dt><dd>${esc(c.hostname)}</dd><dt>Model</dt><dd>${esc(d.model)}</dd><dt>Software</dt><dd>ASA ${asaVer(d)}</dd><dt>Serial number</dt><dd>${asaSerial(d)}</dd><dt>Uptime</dt><dd>${Math.floor(up / 3600)}h ${Math.floor(up / 60) % 60}m</dd><dt>Configuration</dt><dd>${fwDirty(d) ? '<span class="fbadge warn">Unsaved changes</span>' : '<span class="fbadge ok">Saved</span>'}</dd><dt>ICMP inspection</dt><dd>${c.inspect.icmp ? '<span class="fbadge ok">On</span>' : '<span class="fbadge">Off (default)</span>'}</dd></dl>`) +
      card("Interface status", `<div class="fiflist">${ifs.filter(x => x.i.nameif || !x.i.shutdown).map(x => `<div class="fifrow">${led(x.st)}<b>${esc(x.i.nameif || "—")}</b><span class="muted">${esc(shortIf(x.n))}</span><span class="grow"></span><span>${x.i.ip ? esc(x.i.ip) + "/" + maskToLen(x.i.mask) : '<span class="muted">no address</span>'}</span><span class="fsec">${x.i.sec == null ? "—" : x.i.sec}</span></div>`).join("") || '<p class="muted">No interfaces named yet.</p>'}</div>`, `<button class="fbtn ghost sm" data-go="ifaces">Manage</button>`) + `</div>` +
      card("Latest events", fwLogTable(log.slice(-8).reverse()), `<button class="fbtn ghost sm" data-go="monitor">Open syslog</button>`);
  },
  ifaces(w, d, c, F) {
    const rows = fwIfList(d).map(x => {
      const ed = F.editIf === x.n;
      const row = `<tr class="${ed ? "sel" : ""}"><td>${led(x.st)}${esc(longIf(x.n))}</td><td>${x.i.nameif ? `<b>${esc(x.i.nameif)}</b>` : '<span class="muted">—</span>'}</td><td>${x.i.sec == null ? '<span class="muted">—</span>' : `<span class="fsec">${x.i.sec}</span>`}</td><td>${x.i.ip ? esc(x.i.ip) : '<span class="muted">unassigned</span>'}</td><td>${x.i.ip ? esc(x.i.mask) : ""}</td><td>${x.i.shutdown ? '<span class="fbadge">Disabled</span>' : x.st.proto === "up" ? '<span class="fbadge ok">Up</span>' : '<span class="fbadge bad">Down</span>'}</td><td class="muted">${esc(x.i.desc || "")}</td><td class="fact"><button class="ficon" data-edit="${esc(x.n)}" title="Edit">${fi("edit")}</button></td></tr>`;
      if (!ed) return row;
      return row + `<tr class="fedit"><td colspan="8"><div class="fform">
        <label class="ffield"><span>Interface name (nameif)</span><input data-f="nameif" value="${esc(x.i.nameif)}" placeholder="inside / outside / dmz"></label>
        <label class="ffield"><span>Security level (0–100)</span><input data-f="sec" type="number" min="0" max="100" value="${x.i.sec == null ? "" : x.i.sec}"></label>
        <label class="ffield"><span>IP address</span><input data-f="ip" value="${esc(x.i.ip)}" placeholder="192.168.1.1"></label>
        <label class="ffield"><span>Subnet mask</span><input data-f="mask" value="${esc(x.i.mask)}" placeholder="255.255.255.0"></label>
        <label class="ffield wide"><span>Description</span><input data-f="desc" value="${esc(x.i.desc)}"></label>
        <label class="fchk"><input type="checkbox" data-f="on"${x.i.shutdown ? "" : " checked"}> Enable interface</label>
        <div class="fbtns"><button class="fbtn pri" data-a="saveIf">${fi("check")}Apply</button><button class="fbtn" data-a="cancel">Cancel</button></div></div>
        <p class="fhint">An interface passes no traffic until it has a name. "inside" defaults to security level 100, any other name to 0. Traffic may flow from a higher to a lower level without a rule.</p></td></tr>`;
    }).join("");
    return pageHead("Interfaces", "Name each interface, set its security level and address.") + card("Physical and sub-interfaces", `<table class="fwt"><thead><tr><th>Interface</th><th>Name</th><th>Security</th><th>IP address</th><th>Mask</th><th>Status</th><th>Description</th><th></th></tr></thead><tbody>${rows}</tbody></table>`);
  },
  routes(w, d, c, F) {
    const nm = fwNameifs(d);
    const form = F.add.route ? `<div class="fform"><label class="ffield"><span>Interface</span><select data-f="ifn">${nm.map(n => opt(n, "outside")).join("")}</select></label><label class="ffield"><span>Network</span><input data-f="net" value="0.0.0.0"></label><label class="ffield"><span>Mask</span><input data-f="mask" value="0.0.0.0"></label><label class="ffield"><span>Gateway</span><input data-f="gw" placeholder="203.0.113.1"></label><label class="ffield sm"><span>Metric</span><input data-f="metric" type="number" min="1" max="255" value="1"></label><div class="fbtns"><button class="fbtn pri" data-a="addRoute">${fi("check")}Add route</button><button class="fbtn" data-a="cancel">Cancel</button></div></div>` : "";
    const rows = c.routes.map((r, k) => `<tr><td><b>${esc(r.ifn || "")}</b></td><td>${r.net}</td><td>${r.mask}</td><td>${esc(r.nh)}</td><td>${r.ad || 1}</td><td>${routeTable(d).some(x => x.nh === r.nh && x.net === r.net) ? '<span class="fbadge ok">Installed</span>' : '<span class="fbadge bad">Not installed</span>'}</td><td class="fact"><button class="ficon dang" data-rmroute="${k}" title="Delete">${fi("trash")}</button></td></tr>`).join("") || `<tr><td colspan="7" class="fempty">No static routes. Add a default route toward your ISP.</td></tr>`;
    const tab = routeTable(d).map(r => `<tr><td><code>${r.code}</code></td><td>${r.net}/${maskToLen(r.mask)}</td><td>${r.nh ? esc(r.nh) : "directly connected"}</td><td>${esc(nameifOf(d, r.iface || (lookup(d, r.nh) || {}).iface || ""))}</td></tr>`).join("");
    return pageHead("Static Routes", "Routes the firewall uses to reach networks that are not directly connected.", `<button class="fbtn pri" data-a="showAdd" data-k="route">${fi("plus")}Add route</button>`) + form +
      card("Configured routes", `<table class="fwt"><thead><tr><th>Interface</th><th>Network</th><th>Mask</th><th>Gateway</th><th>Metric</th><th>State</th><th></th></tr></thead><tbody>${rows}</tbody></table>`) +
      card("Routing table", `<table class="fwt"><thead><tr><th>Code</th><th>Prefix</th><th>Next hop</th><th>Interface</th></tr></thead><tbody>${tab}</tbody></table>`);
  },
  objects(w, d, c, F) {
    const form = F.add.obj ? `<div class="fform"><label class="ffield"><span>Name</span><input data-f="name" placeholder="WEB-SERVER"></label><label class="ffield sm"><span>Type</span><select data-f="type">${opt("host", "host", "Host")}${opt("subnet", "", "Network")}${opt("range", "", "Range")}</select></label><label class="ffield"><span>Address / network / start</span><input data-f="a" placeholder="192.168.1.10 or 10.1.1.0/24"></label><label class="ffield"><span>Mask / end</span><input data-f="b" placeholder="(network mask or range end)"></label><label class="ffield wide"><span>Description</span><input data-f="desc"></label><div class="fbtns"><button class="fbtn pri" data-a="addObj">${fi("check")}Create object</button><button class="fbtn" data-a="cancel">Cancel</button></div></div>` : "";
    const rows = Object.entries(c.objects).map(([n, o]) => `<tr><td><b>${esc(n)}</b></td><td>${o.type === "host" ? "Host" : o.type === "subnet" ? "Network" : o.type === "range" ? "Range" : '<span class="muted">empty</span>'}</td><td>${o.type === "subnet" ? `${o.a}/${maskToLen(o.b)}` : o.type === "range" ? `${o.a} – ${o.b}` : esc(o.a)}</td><td>${o.nat ? `<span class="fchip svc">${o.nat.type} NAT → ${esc(o.nat.to)}</span>` : '<span class="muted">—</span>'}</td><td class="muted">${esc(o.desc || "")}</td><td class="fact"><button class="ficon dang" data-rmobj="${esc(n)}" title="Delete">${fi("trash")}</button></td></tr>`).join("") || `<tr><td colspan="6" class="fempty">No objects yet.</td></tr>`;
    return pageHead("Network Objects", "Named hosts, networks and ranges used by access rules and NAT.", `<button class="fbtn pri" data-a="showAdd" data-k="obj">${fi("plus")}Add object</button>`) + form + card("Objects", `<table class="fwt"><thead><tr><th>Name</th><th>Type</th><th>Value</th><th>NAT</th><th>Description</th><th></th></tr></thead><tbody>${rows}</tbody></table>`);
  },
  rules(w, d, c, F) {
    const nm = fwNameifs(d); if (!F.ruleIf || !nm.includes(F.ruleIf)) F.ruleIf = nm.includes("outside") ? "outside" : nm[0];
    const ifn = F.ruleIf, acl = ifn && (c.accessGroups[ifn] || {}).in, a = acl && c.acls[acl], hits = rt(d).aclHits || {};
    const n0 = ifByNameif(d, ifn), mySec = n0 ? secOf(d, n0) : 0;
    const objs = Object.keys(c.objects);
    const tabs = `<div class="ftabs">${nm.map(n => `<button class="ftab${n === ifn ? " on" : ""}" data-rif="${esc(n)}">${esc(n)} <span class="fsec">${secOf(d, ifByNameif(d, n))}</span></button>`).join("")}</div>`;
    const form = F.add.rule ? `<div class="fform rule"><div class="ffield"><span>Action</span><div class="fseg"><label><input type="radio" name="fact" value="permit" checked> Permit</label><label><input type="radio" name="fact" value="deny"> Deny</label></div></div>
      ${addrPicker("src", objs, "Source")}${addrPicker("dst", objs, "Destination")}
      <label class="ffield sm"><span>Protocol</span><select data-f="proto">${opt("ip", "tcp", "Any (ip)")}${opt("tcp", "tcp", "TCP")}${opt("udp", "", "UDP")}${opt("icmp", "", "ICMP")}</select></label>
      <label class="ffield sm" data-show="port"><span>Destination port</span><input data-f="port" list="fwports" placeholder="www, 443, any"></label>
      <label class="ffield sm hide" data-show="icmp"><span>ICMP type</span><select data-f="icmp">${opt("", "", "Any")}${opt("echo", "", "echo")}${opt("echo-reply", "", "echo-reply")}${opt("unreachable", "", "unreachable")}${opt("time-exceeded", "", "time-exceeded")}</select></label>
      <label class="ffield wide"><span>Description (remark)</span><input data-f="desc" placeholder="optional"></label>
      <label class="fchk"><input type="checkbox" data-f="log"> Log matches</label><label class="ffield sm"><span>Position</span><select data-f="pos">${opt("end", "end", "Bottom")}${opt("1", "", "Top")}</select></label>
      <div class="fbtns"><button class="fbtn pri" data-a="addRule">${fi("check")}Add rule</button><button class="fbtn" data-a="cancel">Cancel</button></div></div>
      <datalist id="fwports">${["www", "https", "ssh", "telnet", "domain", "ftp", "smtp", "3389"].map(p => `<option value="${p}">`).join("")}</datalist>` : "";
    let rows = "", line = 0;
    if (a) a.entries.forEach((e, k) => {
      line++;
      if (e.remark != null) { rows += `<tr class="frem"><td></td><td colspan="8">${esc(e.remark)}</td><td class="fact"><button class="ficon dang" data-rmace="${k}">${fi("trash")}</button></td></tr>`; return; }
      rows += `<tr class="${e.inactive ? "off" : ""}"><td class="muted">${line}</td><td><input type="checkbox" data-tog="${k}"${e.inactive ? "" : " checked"} title="Enabled"></td><td>${e.action === "permit" ? `<span class="fpermit">${fi("check")}Permit</span>` : `<span class="fdeny">${fi("x")}Deny</span>`}</td><td>${addrTxt(e.src)}</td><td>${addrTxt(e.dst)}</td><td>${svcTxt(e)}</td><td class="num">${hits[e.id] || 0}</td><td>${e.log ? "✓" : ""}</td><td class="fact"><button class="ficon" data-mv="${k}" data-dir="-1" title="Move up">${fi("up")}</button><button class="ficon" data-mv="${k}" data-dir="1" title="Move down">${fi("down")}</button></td><td class="fact"><button class="ficon dang" data-rmace="${k}" title="Delete">${fi("trash")}</button></td></tr>`;
    });
    const implicit = a ? `<tr class="fimpl"><td></td><td></td><td><span class="fdeny">${fi("x")}Deny</span></td><td>${addrTxt({any: true})}</td><td>${addrTxt({any: true})}</td><td>${svcTxt({proto: "ip"})}</td><td colspan="4" class="muted">Implicit rule — anything not permitted above is dropped</td></tr>`
      : nm.filter(n => n !== ifn).map(o => { const os = secOf(d, ifByNameif(d, o)), ok = mySec > os || (mySec === os && c.sameSec.inter); return `<tr class="fimpl"><td></td><td></td><td>${ok ? `<span class="fpermit">${fi("check")}Permit</span>` : `<span class="fdeny">${fi("x")}Deny</span>`}</td><td>${addrTxt({any: true})}</td><td><span class="fchip">${esc(o)} (level ${os})</span></td><td>${svcTxt({proto: "ip"})}</td><td colspan="4" class="muted">Implicit rule — ${ok ? (mySec > os ? "to a less secure interface" : "same level, inter-interface allowed") : mySec === os ? "same security level" : "to a more secure interface"}</td></tr>`; }).join("");
    return pageHead("Access Rules", "Rules are checked top-down on traffic entering the selected interface; the first match wins. Return traffic of allowed connections passes automatically.", nm.length ? `<button class="fbtn pri" data-a="showAdd" data-k="rule">${fi("plus")}Add rule</button>` : "") +
      (nm.length ? tabs + form + card(`Incoming on <b>${esc(ifn)}</b> <span class="muted">${acl ? "· access-list " + esc(acl) : "· no access-list (security levels decide)"}</span>`, `<table class="fwt rules"><thead><tr><th>#</th><th>On</th><th>Action</th><th>Source</th><th>Destination</th><th>Service</th><th>Hits</th><th>Log</th><th>Order</th><th></th></tr></thead><tbody>${rows}${implicit}</tbody></table>`, acl ? `<button class="fbtn ghost sm" data-a="clearHits">Reset hits</button><button class="fbtn ghost sm dang" data-a="unbind">Unbind access-list</button>` : "") : card("No named interfaces", '<p class="fempty">Name an interface first (Interfaces page).</p>'));
  },
  nat(w, d, c, F) {
    const nm = fwNameifs(d), rules = asaNatRules(d), hits = rt(d).natHits || {}, objs = Object.keys(c.objects);
    const form = F.add.nat ? `<div class="fform"><label class="ffield"><span>Rule type</span><select data-f="kind">${opt("pat", "pat", "Dynamic PAT (hide behind interface)")}${opt("dyn", "", "Dynamic PAT to an address")}${opt("static", "", "Static NAT (1:1)")}${opt("fwd", "", "Static port forward")}</select></label>
      <label class="ffield"><span>Object name</span><input data-f="name" placeholder="INSIDE-NET"></label><label class="ffield"><span>Real address / network</span><input data-f="real" placeholder="192.168.1.0/24 or 192.168.1.10"></label>
      <label class="ffield sm"><span>Real interface</span><select data-f="rif">${nm.map(n => opt(n, "inside")).join("")}</select></label><label class="ffield sm"><span>Mapped interface</span><select data-f="mif">${nm.map(n => opt(n, "outside")).join("")}</select></label>
      <label class="ffield" data-show="mip"><span>Mapped address</span><input data-f="mip" placeholder="203.0.113.10"></label>
      <label class="ffield sm hide" data-show="svc"><span>Protocol</span><select data-f="sproto">${opt("tcp", "tcp", "TCP")}${opt("udp", "", "UDP")}</select></label><label class="ffield sm hide" data-show="svc"><span>Real port</span><input data-f="rport" placeholder="www"></label><label class="ffield sm hide" data-show="svc"><span>Mapped port</span><input data-f="mport" placeholder="www"></label>
      <div class="fbtns"><button class="fbtn pri" data-a="addNat">${fi("check")}Add NAT rule</button><button class="fbtn" data-a="cancel">Cancel</button></div></div>
      <p class="fhint">Object NAT creates <code>object network NAME</code> with the real address and a <code>nat (real,mapped) …</code> line. Inbound access to a static NAT still needs an access rule on the mapped interface that permits the <b>real</b> address.</p>` : "";
    const rows = rules.map((r, k) => `<tr><td class="muted">${r.sec === 1 ? "Manual" : "Auto"}</td><td>${esc(r.real)} → ${esc(r.mapped)}</td><td>${r.obj ? `<span class="fchip obj">${esc(r.name || r.srcName)}</span> <span class="muted">${r.obj.type === "subnet" ? r.obj.a + "/" + maskToLen(r.obj.b) : r.obj.a}</span>` : '<span class="fchip any">any</span>'}</td><td>${r.to === "interface" ? `<span class="fchip">${esc(r.mapped)} interface</span>` : `<span class="fchip">${esc(r.to)}</span>`}</td><td>${r.svc ? `<span class="fchip svc">${r.svc.proto} ${ASA_PNAME[r.svc.rport] || r.svc.rport}→${ASA_PNAME[r.svc.mport] || r.svc.mport}</span>` : '<span class="muted">any</span>'}</td><td><span class="fbadge">${r.type === "static" ? "Static" : (r.to === "interface" || isIp(r.to)) ? "Dynamic PAT" : "Dynamic"}</span></td><td class="num">${(hits[r.key] || {}).t || 0} / ${(hits[r.key] || {}).u || 0}</td><td class="fact"><button class="ficon dang" data-rmnat="${k}" title="Delete">${fi("trash")}</button></td></tr>`).join("") || `<tr><td colspan="8" class="fempty">No NAT rules: traffic leaves with its real source address.</td></tr>`;
    return pageHead("NAT Rules", "Section 1 manual (twice) NAT is checked first, then section 2 auto (object) NAT: static before dynamic.", `<button class="fbtn pri" data-a="showAdd" data-k="nat">${fi("plus")}Add NAT rule</button>`) + form +
      card("Translation rules", `<table class="fwt"><thead><tr><th>Section</th><th>Interfaces</th><th>Original source</th><th>Translated to</th><th>Service</th><th>Type</th><th>Hits (out/in)</th><th></th></tr></thead><tbody>${rows}</tbody></table>`);
  },
  dhcp(w, d, c) {
    const rows = fwIfList(d).filter(x => x.i.nameif).map(x => { const ifn = x.i.nameif, p = c.dhcpd.pools[ifn] || {}; return `<tr data-dif="${esc(ifn)}"><td><b>${esc(ifn)}</b><div class="muted">${x.i.ip ? x.i.ip + "/" + maskToLen(x.i.mask) : "no address"}</div></td><td><input type="checkbox" data-dhon${c.dhcpd.enabled[ifn] ? " checked" : ""}${x.i.ip ? "" : " disabled"}></td><td><input data-dhs value="${esc(p.start || "")}" placeholder="start"></td><td><input data-dhe value="${esc(p.end || "")}" placeholder="end"></td><td class="fact"><button class="fbtn sm" data-a="saveDhcp"${x.i.ip ? "" : " disabled"}>Apply</button></td></tr>`; }).join("");
    const leases = Object.entries(rt(d).leases).map(([mac, ip]) => `<tr><td>${ip}</td><td><code>${mac}</code></td><td>3600 s</td></tr>`).join("") || `<tr><td colspan="3" class="fempty">No leases yet.</td></tr>`;
    return pageHead("DHCP Server", "Hand out addresses on directly connected interfaces. The gateway given to clients is the interface address.") +
      card("Address pools", `<table class="fwt"><thead><tr><th>Interface</th><th>Enabled</th><th>Pool start</th><th>Pool end</th><th></th></tr></thead><tbody>${rows}</tbody></table>`) +
      card("Options", `<div class="fform"><label class="ffield"><span>DNS server 1</span><input data-f="dns1" value="${esc(c.dhcpd.dns[0] || "")}"></label><label class="ffield"><span>DNS server 2</span><input data-f="dns2" value="${esc(c.dhcpd.dns[1] || "")}"></label><label class="ffield"><span>Domain name</span><input data-f="dom" value="${esc(c.dhcpd.domain)}"></label><div class="fbtns"><button class="fbtn pri" data-a="saveDhcpOpt">Apply</button></div></div>`) +
      card("Leases", `<table class="fwt"><thead><tr><th>IP address</th><th>Client MAC</th><th>Lease</th></tr></thead><tbody>${leases}</tbody></table>`);
  },
  mgmt(w, d, c, F) {
    const nm = fwNameifs(d), insp = ["icmp", "icmp error", "http", "ftp", "dns preset_dns_map", "tftp", "sip", "esmtp", "sqlnet"];
    const acc = ["ssh", "telnet", "http"].flatMap(k => c.mgmt[k].map((r, j) => `<tr><td><span class="fbadge">${k === "http" ? "HTTPS/ASDM" : k.toUpperCase()}</span></td><td>${r.net}/${maskToLen(r.mask)}</td><td>${esc(r.ifn)}</td><td class="fact"><button class="ficon dang" data-rmacc="${k}|${j}">${fi("trash")}</button></td></tr>`)).join("") || `<tr><td colspan="4" class="fempty">No management access rules: the firewall can only be managed from the console.</td></tr>`;
    const users = Object.entries(c.users).map(([u, o]) => `<tr><td><b>${esc(u)}</b></td><td>${o.priv}</td><td class="fact"><button class="ficon dang" data-rmuser="${esc(u)}">${fi("trash")}</button></td></tr>`).join("") || `<tr><td colspan="3" class="fempty">No local users.</td></tr>`;
    return pageHead("Device Management", "Identity, administrator access, inspection policy and logging.", `<button class="fbtn dang" data-a="factory">Restore factory defaults</button>`) +
      `<div class="fgrid2">` + card("System", `<div class="fform col"><label class="ffield"><span>Hostname</span><input data-f="host" value="${esc(c.hostname)}"></label><label class="ffield"><span>Domain name</span><input data-f="dom" value="${esc(c.domainName)}"></label><label class="ffield"><span>Enable password</span><input data-f="en" type="password" placeholder="${c.enablePassword ? "•••••• (set)" : "not set"}"></label><div class="fbtns"><button class="fbtn pri" data-a="saveSys">Apply</button></div></div>`) +
      card("Local users", `<table class="fwt"><thead><tr><th>Username</th><th>Privilege</th><th></th></tr></thead><tbody>${users}</tbody></table><div class="fform"><label class="ffield sm"><span>Username</span><input data-f="un"></label><label class="ffield sm"><span>Password</span><input data-f="up" type="password"></label><label class="ffield sm"><span>Privilege</span><select data-f="upr">${opt(15, 15)}${opt(2, "")}${opt(1, "")}</select></label><div class="fbtns"><button class="fbtn" data-a="addUser">${fi("plus")}Add</button></div></div>`) + `</div>` +
      card("Management access", `<table class="fwt"><thead><tr><th>Protocol</th><th>Allowed network</th><th>Interface</th><th></th></tr></thead><tbody>${acc}</tbody></table>
        <div class="fform"><label class="ffield sm"><span>Protocol</span><select data-f="ak">${opt("ssh", "ssh", "SSH")}${opt("telnet", "", "Telnet")}${opt("http", "", "HTTPS (ASDM)")}</select></label><label class="ffield"><span>Network (CIDR)</span><input data-f="an" placeholder="192.168.1.0/24"></label><label class="ffield sm"><span>Interface</span><select data-f="ai">${nm.map(n => opt(n, "inside")).join("")}</select></label><div class="fbtns"><button class="fbtn" data-a="addAcc">${fi("plus")}Allow</button></div></div>
        <div class="fsw"><label class="fchk"><input type="checkbox" data-aaa="ssh"${c.aaa.ssh ? " checked" : ""}> AAA for SSH (LOCAL)</label><label class="fchk"><input type="checkbox" data-aaa="telnet"${c.aaa.telnet ? " checked" : ""}> AAA for Telnet (LOCAL)</label><label class="fchk"><input type="checkbox" data-aaa="serial"${c.aaa.serial ? " checked" : ""}> AAA for console (LOCAL)</label><label class="fchk"><input type="checkbox" data-a2="http"${c.mgmt.httpServer ? " checked" : ""}> HTTPS server</label></div>
        <div class="fbtns"><span class="muted">RSA key: ${c.ssh.keyBits ? c.ssh.keyBits + " bits" : "none (SSH disabled)"}</span><button class="fbtn sm" data-a="rsa">Generate 2048-bit RSA key</button><label class="fchk"><input type="checkbox" data-a2="sshv2"${c.ssh.version === 2 ? " checked" : ""}> SSH version 2 only</label></div>`) +
      `<div class="fgrid2">` + card("Inspection policy (global_policy)", `<p class="fhint">Inspected protocols are tracked statefully. ICMP is not inspected by default, so ping replies from outside are dropped unless you enable ICMP inspection or permit echo-reply.</p><div class="fsw">${insp.map(k => `<label class="fchk"><input type="checkbox" data-insp="${k}"${c.inspect[k] ? " checked" : ""}> ${k.replace(" preset_dns_map", "")}</label>`).join("")}</div><div class="fsw"><label class="fchk"><input type="checkbox" data-ss="inter"${c.sameSec.inter ? " checked" : ""}> Same-security traffic between interfaces</label><label class="fchk"><input type="checkbox" data-ss="intra"${c.sameSec.intra ? " checked" : ""}> Hairpin on the same interface</label></div>`) +
      card("Logging", `<div class="fform col"><label class="fchk"><input type="checkbox" data-f="logen"${c.logging.enable ? " checked" : ""}> Enable logging</label><label class="ffield"><span>Buffer level</span><select data-f="logbuf">${opt("", c.logging.buffered == null ? "" : "x", "Off")}${LOG_LEVELS.map((l, k) => opt(k, c.logging.buffered, `${k} – ${l}`)).join("")}</select></label><label class="ffield"><span>Console level</span><select data-f="logcon">${opt("", c.logging.console == null ? "" : "x", "Off")}${LOG_LEVELS.map((l, k) => opt(k, c.logging.console, `${k} – ${l}`)).join("")}</select></label><div class="fbtns"><button class="fbtn pri" data-a="saveLog">Apply</button></div></div>`) + `</div>`;
  },
  monitor(w, d, c, F) {
    const tabs = [["conn", "Connections"], ["xlate", "Translations"], ["log", "Syslog"], ["arp", "ARP"]].map(([k, l]) => `<button class="ftab${F.monTab === k ? " on" : ""}" data-mt="${k}">${l}</button>`).join("");
    let body = "";
    if (F.monTab === "conn") body = `<table class="fwt"><thead><tr><th>ID</th><th>Proto</th><th>Initiator</th><th></th><th>Responder</th><th>Translated as</th><th>Idle</th><th>Bytes</th></tr></thead><tbody>${asaConns(d).slice().reverse().map(x => `<tr><td class="muted">${x.id}</td><td><span class="fbadge">${x.proto.toUpperCase()}</span></td><td><b>${esc(x.iIfn)}</b> ${x.srcR}${x.proto === "icmp" ? "" : ":" + x.sportR}</td><td>→</td><td><b>${esc(x.rIfn)}</b> ${x.dstR}${x.proto === "icmp" ? "" : ":" + x.dportR}</td><td class="muted">${x.srcM !== x.srcR ? x.srcM + (x.proto === "icmp" ? "" : ":" + x.sportM) : "—"}</td><td>${idle(x.last)}</td><td class="num">${x.bytes}</td></tr>`).join("") || `<tr><td colspan="8" class="fempty">No connections. Only TCP, UDP and inspected ICMP create connections.</td></tr>`}</tbody></table>`;
    else if (F.monTab === "xlate") body = `<table class="fwt"><thead><tr><th>Type</th><th>Real</th><th>Mapped</th><th>Idle</th></tr></thead><tbody>${[...asaStaticXlates(d), ...asaXl(d).filter(x => x.kind !== "static")].map(x => `<tr><td><span class="fbadge">${x.kind === "pat" ? "PAT" : x.kind === "static" ? "Static" : "Dynamic"}</span> ${x.proto !== "ip" ? x.proto.toUpperCase() : ""}</td><td><b>${esc(x.rIf)}</b> ${x.rIp}${x.rPort != null ? "/" + x.rPort : ""}</td><td><b>${esc(x.mIf)}</b> ${x.mIp}${x.mPort != null ? "/" + x.mPort : ""}</td><td>${x.kind === "static" ? "—" : idle(x.last)}</td></tr>`).join("") || `<tr><td colspan="4" class="fempty">No translations.</td></tr>`}</tbody></table>`;
    else if (F.monTab === "arp") body = `<table class="fwt"><thead><tr><th>Interface</th><th>IP address</th><th>MAC address</th></tr></thead><tbody>${Object.entries(rt(d).arp).map(([ip, e]) => `<tr><td>${esc(nameifOf(d, e.iface))}</td><td>${ip}</td><td><code>${e.mac}</code></td></tr>`).join("") || `<tr><td colspan="3" class="fempty">ARP table is empty.</td></tr>`}</tbody></table>`;
    else { const q = (F.logQ || "").toLowerCase(), list = (rt(d).log || []).filter(e => !q || e.msg.toLowerCase().includes(q)).slice(-200).reverse(); body = `<div class="fform"><label class="ffield wide"><span>Filter</span><input data-f="logq" value="${esc(F.logQ || "")}" placeholder="e.g. Deny, 302020, 192.168.1.10"></label><div class="fbtns"><button class="fbtn ghost sm" data-a="clearLog">Clear buffer</button></div></div>${fwLogTable(list)}`; }
    return pageHead("Monitoring", "Live state of the firewall (refreshes every few seconds).", `<button class="fbtn ghost" data-a="clearConn">${fi("refresh")}Clear connections & xlates</button>`) + `<div class="ftabs">${tabs}</div>` + card(({conn: "Connections", xlate: "NAT translations", log: "Syslog messages", arp: "ARP"})[F.monTab], body);
  },
  tracer(w, d, c, F) {
    const nm = fwNameifs(d), pt = F.pt; if (!pt.ifn || !nm.includes(pt.ifn)) pt.ifn = nm.includes("inside") ? "inside" : nm[0] || "";
    const res = F.ptRes;
    const phases = res ? res.r.phases.map((x, k) => `<div class="fphase ${x.result === "DROP" ? "drop" : "ok"}"><div class="fpn">${k + 1}</div><div class="fpb"><div class="fpt"><b>${esc(x.type)}</b>${x.subtype ? `<span class="muted"> · ${esc(x.subtype)}</span>` : ""}<span class="grow"></span><span class="fres">${x.result === "DROP" ? fi("x") : fi("check")}${x.result}</span></div>${x.config ? `<pre>${esc(x.config)}</pre>` : ""}${x.info ? `<p>${esc(x.info).replace(/\n/g, "<br>")}</p>` : ""}</div></div>`).join("") +
      `<div class="fverdict ${res.r.verdict === "drop" ? "drop" : "ok"}">${res.r.verdict === "drop" ? fi("x") : fi("check")}<div><b>${res.r.verdict === "drop" ? "Packet dropped" : res.r.verdict === "local" ? "Delivered to the firewall itself" : `Allowed — leaves on ${esc(res.r.outIfn)}`}</b>${res.r.verdict === "drop" ? `<span>${esc(res.r.reason)}</span>` : ""}</div></div>` : "";
    return pageHead("Packet Tracer", "Simulate a packet entering an interface and see every check the firewall makes (no real traffic is sent).") +
      card("Packet", `<div class="fform"><label class="ffield sm"><span>Input interface</span><select data-pt="ifn">${nm.map(n => opt(n, pt.ifn)).join("")}</select></label><label class="ffield sm"><span>Protocol</span><select data-pt="proto">${["icmp", "tcp", "udp"].map(p => opt(p, pt.proto, p.toUpperCase())).join("")}</select></label>
        <label class="ffield"><span>Source IP</span><input data-pt="src" value="${esc(pt.src)}" placeholder="192.168.1.10"></label>${pt.proto === "icmp" ? `<label class="ffield sm"><span>ICMP type</span><select data-pt="type">${[["8", "8 echo request"], ["0", "0 echo reply"], ["3", "3 unreachable"], ["11", "11 time exceeded"]].map(([v, l]) => opt(v, pt.type, l)).join("")}</select></label>` : `<label class="ffield sm"><span>Source port</span><input data-pt="sport" value="${esc(pt.sport)}"></label>`}
        <label class="ffield"><span>Destination IP</span><input data-pt="dst" value="${esc(pt.dst)}" placeholder="8.8.8.8"></label>${pt.proto === "icmp" ? "" : `<label class="ffield sm"><span>Destination port</span><input data-pt="dport" value="${esc(pt.dport)}" list="fwports2"></label><datalist id="fwports2">${["www", "https", "ssh", "domain", "telnet"].map(p => `<option value="${p}">`).join("")}</datalist>`}
        <div class="fbtns"><button class="fbtn pri" data-a="trace">${fi("play")}Start</button></div></div>${res ? `<p class="fhint">CLI: <code>${esc(res.cmd)}</code></p>` : ""}`) + (res ? `<div class="fphases">${phases}</div>` : "");
  },
};
function fwLogTable(list) {
  if (!list.length) return '<p class="fempty">No messages. Enable logging (Device Management) and send some traffic.</p>';
  return `<table class="fwt flog"><thead><tr><th>Time</th><th>Sev</th><th>ID</th><th>Message</th></tr></thead><tbody>${list.map(e => { const m = e.msg.match(/^%ASA-(\d)-(\d+): (.*)$/) || [0, e.sev, "", e.msg]; return `<tr class="sev${m[1]}"><td class="muted">${new Date(e.t).toTimeString().slice(0, 8)}</td><td><span class="fsev s${m[1]}">${m[1]}</span></td><td>${m[2]}</td><td>${esc(m[3])}</td></tr>`; }).join("")}</tbody></table>`;
}

const FW_BIND = {
  dash(w, d, c, F, m) { m.querySelectorAll("[data-go]").forEach(b => b.onclick = () => { F.page = b.dataset.go; buildFwGui(w); }); },
  ifaces(w, d, c, F, m) {
    m.querySelectorAll("[data-edit]").forEach(b => b.onclick = () => { F.editIf = F.editIf === b.dataset.edit ? null : b.dataset.edit; buildFwGui(w); });
    const q = k => m.querySelector(`[data-f="${k}"]`);
    m.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      if (b.dataset.a === "cancel") { F.editIf = null; buildFwGui(w); return; }
      const n = F.editIf, i = c.ifaces[n], cmds = [`interface ${longIf(n)}`];
      const nm = q("nameif").value.trim(), sec = q("sec").value.trim(), ip = q("ip").value.trim(), mask = q("mask").value.trim(), desc = q("desc").value.trim();
      if (nm !== i.nameif) cmds.push(nm ? `nameif ${nm}` : "no nameif");
      if (nm && sec !== "" && +sec !== i.sec) cmds.push(`security-level ${+sec}`);
      if (ip && (ip !== i.ip || mask !== i.mask)) { const cid = parseCidr(ip); cmds.push(cid ? `ip address ${cid.ip} ${cid.mask}` : `ip address ${ip} ${mask}`); } else if (!ip && i.ip) cmds.push("no ip address");
      if (desc !== i.desc) cmds.push(desc ? `description ${desc}` : "no description");
      cmds.push(q("on").checked ? "no shutdown" : "shutdown");
      if (fwRun(w, cmds)) { F.editIf = null; buildFwGui(w); }
    });
  },
  routes(w, d, c, F, m) {
    const q = k => m.querySelector(`[data-f="${k}"]`);
    fwCommon(w, F, m);
    m.querySelectorAll("[data-a=addRoute]").forEach(b => b.onclick = () => { if (fwRun(w, [`route ${q("ifn").value} ${q("net").value.trim()} ${q("mask").value.trim()} ${q("gw").value.trim()} ${q("metric").value || 1}`])) { F.add = {}; buildFwGui(w); } });
    m.querySelectorAll("[data-rmroute]").forEach(b => b.onclick = () => { const r = c.routes[+b.dataset.rmroute]; fwRun(w, [`no route ${r.ifn} ${r.net} ${r.mask} ${r.nh} ${r.ad || 1}`]); });
  },
  objects(w, d, c, F, m) {
    const q = k => m.querySelector(`[data-f="${k}"]`);
    fwCommon(w, F, m);
    m.querySelectorAll("[data-a=addObj]").forEach(b => b.onclick = () => {
      const n = q("name").value.trim().replace(/\s+/g, "-"), t = q("type").value, a = q("a").value.trim(), bb = q("b").value.trim();
      if (!n) { toast("Give the object a name"); return; }
      let line;
      if (t === "host") line = `host ${a}`;
      else if (t === "subnet") { const cid = parseCidr(a); line = cid ? `subnet ${netOf(cid.ip, cid.mask)} ${cid.mask}` : `subnet ${a} ${bb}`; }
      else line = `range ${a} ${bb}`;
      const cmds = [`object network ${n}`, line]; if (q("desc").value.trim()) cmds.push(`description ${q("desc").value.trim()}`);
      if (fwRun(w, cmds)) { F.add = {}; buildFwGui(w); }
    });
    m.querySelectorAll("[data-rmobj]").forEach(b => b.onclick = () => fwRun(w, [`no object network ${b.dataset.rmobj}`]));
  },
  rules(w, d, c, F, m) {
    fwCommon(w, F, m); bindAddrPickers(m);
    m.querySelectorAll("[data-rif]").forEach(b => b.onclick = () => { F.ruleIf = b.dataset.rif; buildFwGui(w); });
    const q = k => m.querySelector(`[data-f="${k}"]`), ifn = F.ruleIf, acl = (c.accessGroups[ifn] || {}).in, aclName = acl || `${ifn}_access_in`;
    const proto = q("proto");
    if (proto) { const sync = () => { m.querySelectorAll("[data-show=port]").forEach(x => x.classList.toggle("hide", !["tcp", "udp"].includes(proto.value))); m.querySelectorAll("[data-show=icmp]").forEach(x => x.classList.toggle("hide", proto.value !== "icmp")); }; proto.onchange = sync; sync(); }
    const aceLine = e => `extended ${aceText(e, "asa")}`;
    m.querySelectorAll("[data-a=addRule]").forEach(b => b.onclick = () => {
      const src = readAddr(m, "src"), dst = readAddr(m, "dst");
      if (!src || !dst) { toast("Check the source and destination addresses"); return; }
      const act = m.querySelector('input[name="fact"]:checked').value, pr = proto.value, port = q("port").value.trim();
      let ace = `${act} ${pr} ${src} ${dst}`;
      if ((pr === "tcp" || pr === "udp") && port && port !== "any") { if (portNum(port) == null) { toast("Unknown port " + port); return; } ace += ` eq ${port}`; }
      if (pr === "icmp" && q("icmp").value) ace += " " + q("icmp").value;
      if (q("log").checked) ace += " log";
      const pos = q("pos").value === "1" ? " line 1" : "", cmds = [];
      // a remark sits on the line above its rule: at the top, insert the rule first and then push the remark above it
      const rem = q("desc").value.trim() ? `access-list ${aclName}${pos} remark ${q("desc").value.trim()}` : null, rule = `access-list ${aclName}${pos} extended ${ace}`;
      if (pos) { cmds.push(rule); if (rem) cmds.push(rem); } else { if (rem) cmds.push(rem); cmds.push(rule); }
      if (!acl) cmds.push(`access-group ${aclName} in interface ${ifn}`);
      if (fwRun(w, cmds)) { F.add = {}; buildFwGui(w); }
    });
    const a = acl && c.acls[acl];
    m.querySelectorAll("[data-rmace]").forEach(b => b.onclick = () => { const e = a.entries[+b.dataset.rmace]; fwRun(w, [e.remark != null ? `no access-list ${acl} remark ${e.remark}` : `no access-list ${acl} ${aceLine(e)}`]); if (e.remark != null) { a.entries = a.entries.filter(x => x !== e); save(); buildFwGui(w); } });
    m.querySelectorAll("[data-tog]").forEach(b => b.onchange = () => { const k = +b.dataset.tog, e = a.entries[k], ne = Object.assign({}, e, {inactive: !b.checked}); fwRun(w, [`no access-list ${acl} ${aceLine(e)}`, `access-list ${acl} line ${k + 1} ${aceLine(ne)}`]); });
    m.querySelectorAll("[data-mv]").forEach(b => b.onclick = () => { const k = +b.dataset.mv, to = k + +b.dataset.dir; if (to < 0 || to >= a.entries.length) return; const e = a.entries[k]; fwRun(w, [`no access-list ${acl} ${aceLine(e)}`, `access-list ${acl} line ${to + 1} ${aceLine(e)}`]); });
    m.querySelectorAll("[data-a=clearHits]").forEach(b => b.onclick = () => fwRun(w, [`clear access-list ${acl} counters`], true));
    m.querySelectorAll("[data-a=unbind]").forEach(b => b.onclick = () => fwRun(w, [`no access-group ${acl} in interface ${ifn}`]));
  },
  nat(w, d, c, F, m) {
    fwCommon(w, F, m);
    const q = k => m.querySelector(`[data-f="${k}"]`), kind = q("kind");
    if (kind) { const sync = () => { m.querySelectorAll("[data-show=mip]").forEach(x => x.classList.toggle("hide", kind.value === "pat" || kind.value === "fwd")); m.querySelectorAll("[data-show=svc]").forEach(x => x.classList.toggle("hide", kind.value !== "fwd")); }; kind.onchange = sync; sync(); }
    m.querySelectorAll("[data-a=addNat]").forEach(b => b.onclick = () => {
      const n = q("name").value.trim().replace(/\s+/g, "-"), real = q("real").value.trim(), k = kind.value, pair = `(${q("rif").value},${q("mif").value})`;
      if (!n) { toast("Give the NAT object a name"); return; }
      const cid = parseCidr(real), def = cid && cid.mask !== "255.255.255.255" ? `subnet ${netOf(cid.ip, cid.mask)} ${cid.mask}` : `host ${cid ? cid.ip : real}`;
      const nat = k === "pat" ? `nat ${pair} dynamic interface` : k === "dyn" ? `nat ${pair} dynamic ${q("mip").value.trim()}` : k === "static" ? `nat ${pair} static ${q("mip").value.trim()}` : `nat ${pair} static interface service ${q("sproto").value} ${q("rport").value.trim()} ${q("mport").value.trim()}`;
      if (fwRun(w, [`object network ${n}`, def, nat])) { F.add = {}; buildFwGui(w); }
    });
    m.querySelectorAll("[data-rmnat]").forEach(b => b.onclick = () => { const r = asaNatRules(d)[+b.dataset.rmnat]; fwRun(w, r.sec === 1 ? [`no nat (${r.real},${r.mapped}) source ${r.type} ${r.srcName} ${r.to}`] : [`object network ${r.name}`, "no nat"]); });
  },
  dhcp(w, d, c, F, m) {
    m.querySelectorAll("[data-a=saveDhcp]").forEach(b => b.onclick = () => {
      const tr = b.closest("tr"), ifn = tr.dataset.dif, on = tr.querySelector("[data-dhon]").checked, st = tr.querySelector("[data-dhs]").value.trim(), en = tr.querySelector("[data-dhe]").value.trim();
      const cmds = [];
      if (st && en) cmds.push(`dhcpd address ${st}-${en} ${ifn}`);
      cmds.push(on ? `dhcpd enable ${ifn}` : `no dhcpd enable ${ifn}`);
      fwRun(w, cmds);
    });
    const q = k => m.querySelector(`[data-f="${k}"]`);
    m.querySelectorAll("[data-a=saveDhcpOpt]").forEach(b => b.onclick = () => { const dns = [q("dns1").value.trim(), q("dns2").value.trim()].filter(Boolean); const cmds = []; if (dns.length) cmds.push(`dhcpd dns ${dns.join(" ")}`); if (q("dom").value.trim()) cmds.push(`dhcpd domain ${q("dom").value.trim()}`); if (cmds.length) fwRun(w, cmds); });
  },
  mgmt(w, d, c, F, m) {
    const q = k => m.querySelector(`[data-f="${k}"]`);
    m.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
      const a = b.dataset.a;
      if (a === "saveSys") { const cmds = []; if (q("host").value.trim() && q("host").value.trim() !== c.hostname) cmds.push(`hostname ${q("host").value.trim()}`); if (q("dom").value.trim() !== c.domainName) cmds.push(q("dom").value.trim() ? `domain-name ${q("dom").value.trim()}` : "no domain-name"); if (q("en").value) cmds.push(`enable password ${q("en").value}`); if (cmds.length) fwRun(w, cmds); }
      if (a === "addUser") { if (!q("un").value.trim() || !q("up").value) { toast("Enter a username and password"); return; } fwRun(w, [`username ${q("un").value.trim()} password ${q("up").value} privilege ${q("upr").value}`]); }
      if (a === "addAcc") { const cid = parseCidr(q("an").value.trim()) || (isIp(q("an").value.trim()) ? {ip: q("an").value.trim(), mask: "255.255.255.255"} : null); if (!cid) { toast("Enter a network like 192.168.1.0/24"); return; } fwRun(w, [`${q("ak").value} ${netOf(cid.ip, cid.mask)} ${cid.mask} ${q("ai").value}`]); }
      if (a === "rsa") fwRun(w, [{cmd: "crypto key generate rsa modulus 2048", answer: "yes"}]);
      if (a === "saveLog") { const cmds = [q("logen").checked ? "logging enable" : "no logging enable", q("logbuf").value === "" ? "no logging buffered" : `logging buffered ${q("logbuf").value}`, q("logcon").value === "" ? "no logging console" : `logging console ${q("logcon").value}`]; fwRun(w, cmds); }
      if (a === "factory") { if (confirm("Restore the factory-default configuration? The running configuration is replaced (startup-config is kept until you save).")) fwRun(w, ["configure factory-default"]); }
    });
    m.querySelectorAll("[data-rmacc]").forEach(b => b.onclick = () => { const [k, j] = b.dataset.rmacc.split("|"), r = c.mgmt[k][+j]; fwRun(w, [`no ${k} ${r.net} ${r.mask} ${r.ifn}`]); });
    m.querySelectorAll("[data-rmuser]").forEach(b => b.onclick = () => fwRun(w, [`no username ${b.dataset.rmuser}`]));
    m.querySelectorAll("[data-aaa]").forEach(b => b.onchange = () => fwRun(w, [`${b.checked ? "" : "no "}aaa authentication ${b.dataset.aaa} console LOCAL`]));
    m.querySelectorAll("[data-a2]").forEach(b => b.onchange = () => fwRun(w, [b.dataset.a2 === "http" ? `${b.checked ? "" : "no "}http server enable` : `ssh version ${b.checked ? 2 : 1}`]));
    m.querySelectorAll("[data-insp]").forEach(b => b.onchange = () => fwRun(w, ["policy-map global_policy", "class inspection_default", `${b.checked ? "" : "no "}inspect ${b.dataset.insp}`]));
    m.querySelectorAll("[data-ss]").forEach(b => b.onchange = () => fwRun(w, [`${b.checked ? "" : "no "}same-security-traffic permit ${b.dataset.ss}-interface`]));
  },
  monitor(w, d, c, F, m) {
    m.querySelectorAll("[data-mt]").forEach(b => b.onclick = () => { F.monTab = b.dataset.mt; buildFwGui(w); });
    m.querySelectorAll("[data-a=clearConn]").forEach(b => b.onclick = () => fwRun(w, ["clear xlate", "clear conn"], true));
    m.querySelectorAll("[data-a=clearLog]").forEach(b => b.onclick = () => fwRun(w, ["clear logging buffer"], true));
    const lq = m.querySelector('[data-f="logq"]'); if (lq) lq.oninput = () => { F.logQ = lq.value; clearTimeout(w.lqT); w.lqT = setTimeout(() => { buildFwGui(w); const x = w.el.querySelector('[data-f="logq"]'); if (x) { x.focus(); x.setSelectionRange(x.value.length, x.value.length); } }, 300); };
  },
  tracer(w, d, c, F, m) {
    const pt = F.pt;
    m.querySelectorAll("[data-pt]").forEach(x => x.onchange = () => { pt[x.dataset.pt] = x.value.trim(); if (x.dataset.pt === "proto") buildFwGui(w); });
    m.querySelectorAll("[data-a=trace]").forEach(b => b.onclick = () => {
      m.querySelectorAll("[data-pt]").forEach(x => { pt[x.dataset.pt] = x.value.trim(); });
      if (!isIp(pt.src) || !isIp(pt.dst)) { toast("Enter valid source and destination IP addresses"); return; }
      let p, cmd;
      if (pt.proto === "icmp") { p = {src: pt.src, dst: pt.dst, ttl: 64, proto: "icmp", icmp: {type: ({8: "echo", 0: "reply", 3: "unreach", 11: "ttl"})[pt.type] || "echo", id: 1, seq: 0}}; cmd = `packet-tracer input ${pt.ifn} icmp ${pt.src} ${pt.type} 0 ${pt.dst}`; }
      else { const sp = portNum(pt.sport), dp = portNum(pt.dport); if (sp == null || dp == null) { toast("Enter valid ports"); return; } p = {src: pt.src, dst: pt.dst, ttl: 64, proto: pt.proto}; p[pt.proto] = {sport: sp, dport: dp, flags: "SYN", id: 1}; cmd = `packet-tracer input ${pt.ifn} ${pt.proto} ${pt.src} ${pt.sport} ${pt.dst} ${pt.dport}`; }
      F.ptRes = {r: asaPacketTracerRun(d, ifByNameif(d, pt.ifn), p), cmd};
      w.eqText = (w.eqText || "") + promptOf(w.guiSess || (w.guiSess = hiddenSession(w))) + cmd + "\n";
      buildFwGui(w);
    });
  },
};
function fwCommon(w, F, m) {
  m.querySelectorAll("[data-a=showAdd]").forEach(b => b.onclick = () => { F.add = {[b.dataset.k]: !F.add[b.dataset.k]}; buildFwGui(w); });
  m.querySelectorAll("[data-a=cancel]").forEach(b => b.onclick = () => { F.add = {}; buildFwGui(w); });
}
