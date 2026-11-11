// ======================================================================= PC / SERVER DESKTOP
const APPS = [
  ["ipconfig", "IP Configuration", '<svg viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="28" rx="3" fill="#2f6fd6"/><rect x="8" y="12" width="32" height="20" fill="#e8f0ff"/><text x="24" y="27" font-size="11" text-anchor="middle" fill="#1d3f7a" font-weight="700">IP</text><rect x="18" y="38" width="12" height="4" fill="#5b6575"/></svg>'],
  ["cmd", "Command Prompt", '<svg viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="32" rx="3" fill="#101418"/><text x="9" y="28" font-size="12" fill="#e8e8e8" font-family="monospace">C:\\&gt;_</text></svg>'],
  ["terminal", "Terminal", '<svg viewBox="0 0 48 48"><rect x="4" y="8" width="40" height="32" rx="3" fill="#2c5a7a"/><path d="M12 18l7 6-7 6" stroke="#fff" stroke-width="3" fill="none"/><path d="M22 31h12" stroke="#fff" stroke-width="3"/></svg>'],
  ["browser", "Web Browser", '<svg viewBox="0 0 48 48"><circle cx="24" cy="24" r="17" fill="#e9f3ff" stroke="#2f6fd6" stroke-width="3"/><path d="M7 24h34M24 7c-8 9-8 25 0 34M24 7c8 9 8 25 0 34" stroke="#2f6fd6" stroke-width="2" fill="none"/></svg>'],
];
function buildDesktop(w, pane) {
  pane.innerHTML = `<div class="desk"><div class="apps">${APPS.map(([k, label, ic]) => `<button class="app" data-app="${k}">${ic}<span>${label}</span></button>`).join("")}</div></div><div class="appwin hidden"><div class="apph"><button class="btn" data-back>← Desktop</button><b class="appt"></b></div><div class="appb"></div></div>`;
  pane.querySelectorAll(".app").forEach(b => b.onclick = () => openApp(w, b.dataset.app));
  pane.querySelector("[data-back]").onclick = () => { pane.querySelector(".desk").classList.remove("hidden"); pane.querySelector(".appwin").classList.add("hidden"); };
}
function openApp(w, k) {
  const pane = w.el.querySelector('.dwp[data-p="Desktop"]');
  if (!pane.dataset.built) { pane.dataset.built = 1; buildDesktop(w, pane); }
  pane.querySelector(".desk").classList.add("hidden");
  const win = pane.querySelector(".appwin"), body = win.querySelector(".appb");
  win.classList.remove("hidden");
  win.querySelector(".appt").textContent = APPS.find(a => a[0] === k)[1];
  w.apps = w.apps || {};
  body.querySelectorAll(".appp").forEach(x => x.classList.add("hidden"));
  let el = w.apps[k];
  if (!el) {
    el = document.createElement("div"); el.className = "appp"; body.appendChild(el); w.apps[k] = el;
    if (k === "cmd") { el.classList.add("termwrap"); w.cmd = createTerminal(el, {shell: pcShell(w.dev)}); w.cmd.shell.term = w.cmd; w.cmd.print("\nCisco Packet Tracer-style PC Command Line 1.0\n"); w.cmd.refresh(); }
    if (k === "terminal") buildConsoleApp(w, el);
    if (k === "browser") buildBrowser(w, el);
  }
  if (k === "ipconfig") buildIpConfig(w, el);
  el.classList.remove("hidden");
  if (k === "cmd") setTimeout(() => w.cmd.focus(), 0);
  if (k === "terminal" && w.con) setTimeout(() => w.con.focus(), 0);
}
// ---- IP Configuration
function buildIpConfig(w, el) {
  const d = w.dev, h = d.host, a = hostAddr(d);
  el.innerHTML = `<div class="ipc">
    <div class="sect">IP Configuration</div>
    <div class="radios"><label><input type="radio" name="m${d.id}" value="dhcp"${h.dhcp ? " checked" : ""}> DHCP</label><label><input type="radio" name="m${d.id}" value="static"${h.dhcp ? "" : " checked"}> Static</label><span class="ipmsg muted"></span></div>
    <label>IPv4 Address<input data-k="ip" value="${esc(a.ip)}"${h.dhcp ? " disabled" : ""}></label>
    <label>Subnet Mask<input data-k="mask" value="${esc(a.mask)}"${h.dhcp ? " disabled" : ""}></label>
    <label>Default Gateway<input data-k="gw" value="${esc(a.gw)}"${h.dhcp ? " disabled" : ""}></label>
    <label>DNS Server<input data-k="dns" value="${esc(a.dns)}"${h.dhcp ? " disabled" : ""}></label>
    <p class="muted">MAC ${macDashed(macOf(d, hostPort(d)))} · changes apply as you type</p></div>`;
  const msg = el.querySelector(".ipmsg");
  el.querySelectorAll('input[type="radio"]').forEach(r => r.onchange = () => {
    h.dhcp = r.value === "dhcp";
    if (h.dhcp) {
      msg.textContent = "Requesting IP Address…";
      setTimeout(() => {
        const res = dhcpRequest(d);
        if (!res.ok) rt(d).lease = {ip: apipa(d), mask: "255.255.0.0", gw: "", dns: "", apipa: true};
        if (typeof simCapture === "function") simCapture(d, "DHCP", res.events);
        buildIpConfig(w, el);
        el.querySelector(".ipmsg").textContent = res.ok ? "DHCP request successful." : "DHCP failed. APIPA is being used.";
        save(); render(); if (typeof activityCheck === "function") activityCheck();
      }, 600);
    } else { rt(d).lease = null; buildIpConfig(w, el); }
    save();
  });
  el.querySelectorAll("input[data-k]").forEach(inp => inp.oninput = () => {
    const k = inp.dataset.k, v = inp.value.trim();
    h[k] = v;
    if (k === "ip" && isIp(v) && !h.mask) { h.mask = classfulMask(v); el.querySelector('[data-k="mask"]').value = h.mask; }
    inp.classList.toggle("bad", !!v && !isIp(v));
    rt(d).arp = {};
    save(); scheduleRender(); if (typeof activityCheck === "function") activityCheck();
  });
}
// ---- Command Prompt
function pcShell(d) {
  const sh = {hist: [], prompt: () => "C:\\>"};
  const P = t => sh.term.print(t.endsWith("\n") ? t : t + "\n");
  const resolve = (name, cb) => {
    if (isIp(name)) return cb(name);
    const r = dnsResolve(d, name);
    if (typeof simCapture === "function" && r.events) simCapture(d, "DNS", r.events);
    if (!r.ip) { P(`Ping request could not find host ${name}. Please check the name and try again.`); return; }
    cb(r.ip);
  };
  const cmds = {
    help: () => P("Available Commands\n?             Display the list of available commands\narp           Display the arp table\ncls           Clear screen\nexit          Quits the CLI\nhelp          Display the list of available commands\nipconfig      Display network configuration (/all /release /renew)\nnslookup      DNS Lookup\nping          Send echo messages\nssh           Ssh client (ssh -l username target)\ntelnet        Telnet client\ntracert       Trace route to destination"),
    ipconfig: args => {
      const a = hostAddr(d), p = hostPort(d), flag = (args[0] || "").toLowerCase();
      if (flag === "/release") { rt(d).lease = null; P(`\n   IP Address......................: 0.0.0.0\n   Subnet Mask.....................: 0.0.0.0\n   Default Gateway.................: 0.0.0.0\n   DNS Server......................: 0.0.0.0\n`); save(); scheduleRender(); return; }
      if (flag === "/renew") {
        if (!d.host.dhcp) { P("DHCP is not enabled on this adapter (set DHCP in IP Configuration)."); return; }
        const r = dhcpRequest(d); if (typeof simCapture === "function") simCapture(d, "DHCP", r.events);
        if (!r.ok) { P("DHCP request failed."); return; }
        const l = r.lease; P(`\n   IP Address......................: ${l.ip}\n   Subnet Mask.....................: ${l.mask}\n   Default Gateway.................: ${l.gw || "0.0.0.0"}\n   DNS Server......................: ${l.dns || "0.0.0.0"}\n`); save(); scheduleRender(); return;
      }
      P(`\n${longIf(p)} Connection:(default port)\n\n${flag === "/all" ? `   Connection-specific DNS Suffix..: \n   Physical Address................: ${macOf(d, p).toUpperCase()}\n` : "   Connection-specific DNS Suffix..: \n"}   Link-local IPv6 Address.........: FE80::${macOf(d, p).replace(/\./g, ":").toUpperCase()}\n   IPv4 Address....................: ${a.ip || "0.0.0.0"}\n   Subnet Mask.....................: ${a.mask || "0.0.0.0"}\n   Default Gateway.................: ::\n                                     ${a.gw || "0.0.0.0"}\n${flag === "/all" ? `   DHCP Servers....................: ${(rt(d).lease && rt(d).lease.server) || "0.0.0.0"}\n   DNS Servers.....................: ::\n                                     ${a.dns || "0.0.0.0"}\n` : ""}`);
    },
    ping: args => {
      let n = 4; const i = args.indexOf("-n"); if (i >= 0) { n = Math.min(20, +args[i + 1] || 4); args.splice(i, 2); }
      const host = args[0]; if (!host) { P("Usage: ping [-n count] target"); return; }
      resolve(host, ip => {
        P(`\nPinging ${host !== ip ? host + " [" + ip + "]" : ip} with 32 bytes of data:\n`);
        let ok = 0; const steps = [];
        for (let k = 0; k < n; k++) steps.push([k ? 700 : 300, () => {
          const r = pingOnce(d, ip, {seq: k}); if (typeof simCapture === "function") simCapture(d, "ICMP", r.events, ip);
          const x = r.res;
          if (x.res === "reply") { ok++; sh.term.print(`Reply from ${ip}: bytes=32 time<1ms TTL=${x.ttl}\n`); }
          else if (x.res === "unreach") sh.term.print(`Reply from ${x.from}: Destination host unreachable.\n`);
          else if (x.res === "ttl") sh.term.print(`Reply from ${x.from}: TTL expired in transit.\n`);
          else sh.term.print("Request timed out.\n");
        }]);
        sh.term.runAsync(steps, () => sh.term.print(`\nPing statistics for ${ip}:\n    Packets: Sent = ${n}, Received = ${ok}, Lost = ${n - ok} (${Math.round((n - ok) / n * 100)}% loss),\n${ok ? "Approximate round trip times in milli-seconds:\n    Minimum = 0ms, Maximum = 1ms, Average = 0ms\n" : ""}`));
      });
    },
    tracert: args => {
      const host = args[0]; if (!host) { P("Usage: tracert target"); return; }
      resolve(host, ip => {
        P(`\nTracing route to ${host !== ip ? host + " [" + ip + "]" : ip}
over a maximum of 30 hops: \n`);
        let ttl = 1, miss = 0; const T = sh.term; T.busy = true; T.refresh();
        const step = () => {
          if (ttl > 30 || miss >= 4 || T.cancel) { T.print("\nTrace complete.\n"); T.busy = false; T.cancel = false; T.refresh(); return; }
          const R = pingOnce(d, ip, {ttl}); simCapture(d, "ICMP", R.events);
          let r = R.res; if (!r.res) r = pingOnce(d, ip, {ttl}).res;
          if (r.res) { T.print(`  ${String(ttl).padStart(2)}   0 ms      0 ms      0 ms      ${r.from}\n`); miss = 0; if (r.res !== "ttl") ttl = 99; }
          else { T.print(`  ${String(ttl).padStart(2)}   *         *         *         Request timed out.\n`); miss++; }
          ttl++; setTimeout(step, 450);
        };
        setTimeout(step, 300);
      });
    },
    arp: args => {
      if ((args[0] || "") === "-d") { rt(d).arp = {}; return; }
      const e = Object.entries(rt(d).arp);
      P(e.length ? `  Internet Address      Physical Address      Type\n${e.map(([ip, x]) => `  ${ip.padEnd(22)}${x.mac.padEnd(22)}dynamic`).join("\n")}` : "No ARP Entries Found");
    },
    nslookup: args => {
      const a = hostAddr(d);
      if (!args[0]) { P(`Server: [${a.dns || "0.0.0.0"}]\nAddress:  ${a.dns || "0.0.0.0"}\n`); return; }
      const r = dnsResolve(d, args[0]); if (typeof simCapture === "function" && r.events) simCapture(d, "DNS", r.events);
      P(`Server: [${a.dns || "0.0.0.0"}]\nAddress:  ${a.dns || "0.0.0.0"}\n\n${r.ip ? `Non-authoritative answer:\nName:   ${args[0]}\nAddress:  ${r.ip}` : `*** ${a.dns || "UnKnown"} can't find ${args[0]}: ${r.err === "no record" ? "Non-existent domain" : "No response from server"}`}\n`);
    },
    telnet: args => { if (!args[0]) { P("Usage: telnet target"); return; } resolve(args[0], ip => { const s = remoteLogin(sh.term, d, ip, "telnet"); if (typeof activityCheck === "function") activityCheck(); }); },
    ssh: args => { if (args[0] !== "-l" || !args[1] || !args[2]) { P("Usage: ssh -l username target"); return; } resolve(args[2], ip => remoteLogin(sh.term, d, ip, "ssh", args[1])); },
    cls: () => { sh.term.el.querySelector(".tout").textContent = ""; },
    exit: () => {},
  };
  cmds["?"] = cmds.help;
  sh.run = line => {
    const parts = line.trim().split(/\s+/), c = (parts.shift() || "").toLowerCase();
    if (!c) return;
    if (cmds[c]) cmds[c](parts); else P("Invalid Command.");
  };
  return sh;
}
// ---- Terminal app: a console session over the rollover cable
function buildConsoleApp(w, el) {
  const d = w.dev;
  const l = S.links.find(x => x.cable === "console" && ((x.a === d.id && portKind(x.pa) === "rs232") || (x.b === d.id && portKind(x.pb) === "rs232")));
  const target = l && byId(l.a === d.id ? l.b : l.a);
  if (!target || !isIOS(target)) {
    el.innerHTML = `<div class="ipc"><div class="sect">Terminal Configuration</div><p>No console connection.</p><p class="muted">Use the <b>Console</b> cable: click this PC's <b>RS232</b> port, then a router or switch <b>Console</b> port. Then open Terminal again.</p><div class="row"><button class="btn" data-retry>Try again</button></div></div>`;
    el.querySelector("[data-retry]").onclick = () => { delete w.apps.terminal; el.remove(); openApp(w, "terminal"); };
    return;
  }
  initDevice(target);
  el.innerHTML = `<div class="termcfg muted">Bits per second 9600 · Data bits 8 · Parity None · Stop bits 1 · Flow control None → <b>${esc(target.name)}</b> console</div>`;
  const wrap = document.createElement("div"); wrap.className = "termwrap"; el.appendChild(wrap);
  w.con = createTerminal(wrap, {onIdleEnter: () => startIOS(w.con, target, "console")});
  w.con.print("\nPress RETURN to get started!\n\n"); w.con.refresh();
}
// ---- Web Browser
function buildBrowser(w, el) {
  const d = w.dev;
  el.innerHTML = `<div class="browser"><div class="url"><span>URL</span><input value="http://"><button class="btn primary">Go</button></div><iframe sandbox="" title="Web page"></iframe></div>`;
  const inp = el.querySelector("input"), fr = el.querySelector("iframe");
  const page = (title, body) => `<!doctype html><meta charset="utf-8"><style>body{font:14px Segoe UI,Arial,sans-serif;margin:18px;color:#222}h2{color:#a00}</style>${title ? `<h2>${title}</h2>` : ""}${body}`;
  const go = () => {
    const host = inp.value.trim().replace(/^https?:\/\//i, "").split("/")[0];
    if (!host) return;
    fr.srcdoc = page("", "<p>Loading…</p>");
    setTimeout(() => {
      let ip = host;
      if (!isIp(host)) { const r = dnsResolve(d, host); if (typeof simCapture === "function" && r.events) simCapture(d, "DNS", r.events); ip = r.ip; if (!ip) { fr.srcdoc = page("Host Name Unresolved", `<p>${esc(host)} could not be resolved (${esc(r.err)}).</p>`); return; } }
      const r = tcpConnect(d, ip, 80); if (typeof simCapture === "function") simCapture(d, "HTTP", r.events, ip);
      if (!r.ok) { fr.srcdoc = page("Request Timeout", `<p>${r.refused ? "The server refused the connection (is HTTP turned on?)." : "No response from " + esc(ip) + "."}</p>`); return; }
      fr.srcdoc = r.dev && r.dev.svc ? r.dev.svc.http.page : page("", "<p>It works.</p>");
      if (typeof activityCheck === "function") activityCheck();
    }, 400);
  };
  el.querySelector("button").onclick = go;
  inp.addEventListener("keydown", e => { if (e.key === "Enter") go(); });
}
