// ======================================================================= IOS-LIKE CLI: parser + terminal
// Commands are registered as patterns, e.g. defCmd("priv", "show ip interface brief", fn).
// Pattern tokens: keywords, or <A.B.C.D> <WORD> <LINE> <IFACE> <RANGE> <VLIST> <n-m> (number range).
const CLI_TREES = {};
const HELP = {};   // keyword → help text
function cliRoot(mode) { return CLI_TREES[mode] || (CLI_TREES[mode] = {kids: [], run: null}); }
const ARG_HELP = {
  "A.B.C.D": "IP address", "MASK": "Subnet mask", "WORD": "Name / text", "LINE": "Text (rest of the line)", "IFACE": "Interface (e.g. g0/0, fa0/1, vlan 1)",
  "RANGE": "Interface range (e.g. fa0/1 - 24)", "VLIST": "VLAN IDs (e.g. 10,20,30-40)", "HOST": "IP address or hostname",
};
function argOk(arg, t, dev) {
  if (arg === "A.B.C.D" || arg === "MASK") return isIp(t) || (t === "0" && !!dev && dev.type === "firewall");
  if (arg === "WORD" || arg === "HOST") return true;
  if (arg === "VLIST") return /^\d+([-,]\d+)*$/.test(t);
  const r = arg.match(/^(\d+)-(\d+)$/);
  if (r) return /^\d+$/.test(t) && +t >= +r[1] && +t <= +r[2];
  return false;
}
function defCmd(modes, pattern, run, help) {
  (Array.isArray(modes) ? modes : [modes]).forEach(mode => {
    let n = cliRoot(mode);
    pattern.trim().split(/\s+/).forEach(tok => {
      const arg = tok.match(/^<(.+)>$/);
      let k = n.kids.find(x => arg ? x.arg === arg[1] : x.kw === tok);
      if (!k) { k = arg ? {arg: arg[1], node: {kids: [], run: null}} : {kw: tok, node: {kids: [], run: null}}; n.kids.push(k); }
      n = k.node;
    });
    n.run = run;
    if (help) n.help = help;
  });
}
function tokenize(line) { const out = []; const re = /\S+/g; let m; while ((m = re.exec(line))) out.push({t: m[0], at: m.index}); return out; }
// Walk the tree. Returns {node, args} or {err, at}
function cliWalk(root, toks, line, sessDev) {
  let n = root; const args = [];
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i].t, tl = t.toLowerCase();
    const kws = n.kids.filter(k => k.kw && k.kw.toLowerCase().startsWith(tl));
    let pick = kws.find(k => k.kw.toLowerCase() === tl) || (kws.length === 1 ? kws[0] : null);
    if (!pick && kws.length > 1 && !n.kids.some(k => k.arg && k.arg !== "IFACE" && argOk(k.arg, t, sessDev))) return {err: "ambig", at: i, word: t};
    if (!pick) {
      for (const k of n.kids.filter(k => k.arg)) {
        if (k.arg === "LINE" || k.arg === "RANGE") { args.push(line.slice(toks[i].at).trim()); return {node: k.node, args}; }
        if (k.arg === "IFACE") {
          let s = t, used = 0;
          if (/^[a-z-]+$/i.test(t) && toks[i + 1] && /^\d/.test(toks[i + 1].t)) { s = t + toks[i + 1].t; used = 1; }
          const sp = splitIf(s);
          if (sp && ifType(sp.t)) { args.push(s); i += used; pick = k; break; }
          continue;
        }
        if (argOk(k.arg, t, sessDev)) { args.push(t); pick = k; break; }
      }
    }
    if (!pick) return {err: "invalid", at: i};
    n = pick.node;
  }
  return {node: n, args};
}
const ERR_INVALID = (prompt, line, at, fw) => `${" ".repeat(prompt.length + at)}^\n${fw ? "ERROR: " : ""}% Invalid input detected at '^' marker.\n`;
function helpFor(kw) { return HELP[kw] || ""; }
function cols(rows) { const w = Math.max(...rows.map(r => r[0].length)) + 2; return rows.map(([a, b]) => "  " + a.padEnd(w) + (b || "")).join("\n"); }

// ---- sessions
let SESS_SEQ = 1;
function newSession(dev, via, term) {
  return {id: SESS_SEQ++, dev, via, term, mode: "user", ctx: {}, hist: [], authed: false, tries: 0, pending: null};
}
function promptOf(s) {
  if (s.pending && s.pending.prompt != null) return s.pending.prompt;
  const h = s.dev.cfg.hostname;
  return h + ({user: ">", priv: "#", config: "(config)#", if: "(config-if)#", subif: "(config-subif)#", range: "(config-if-range)#", line: "(config-line)#", vlan: "(config-vlan)#", dhcp: "(dhcp-config)#",
    nacl: s.ctx && s.ctx.type === "standard" ? "(config-std-nacl)#" : "(config-ext-nacl)#", router: "(config-router)#", obj: "(config-network-object)#", pmap: "(config-pmap)#", pmapc: "(config-pmap-c)#", cmap: "(config-cmap)#"})[s.mode];
}
const MODE_TREE = {user: "user", priv: "priv", config: "config", if: "if", subif: "if", range: "if", line: "line", vlan: "vlan", dhcp: "dhcp", nacl: "nacl", router: "router", obj: "obj", pmap: "pmap", pmapc: "pmapc", cmap: "cmap"};
const CONFIG_MODES = ["config", "if", "subif", "range", "line", "vlan", "dhcp", "nacl", "router", "obj", "pmap", "pmapc", "cmap"];
// firewalls run their own (ASA-style) command set: same parser, separate command trees
const treeOf = (s, mode) => cliRoot((s.dev.type === "firewall" ? "asa:" : "") + MODE_TREE[mode]);

// ---- terminal widget (used by the CLI tab, the PC Terminal app and telnet/ssh)
function createTerminal(host, opts) {
  const el = document.createElement("div");
  el.className = "term";
  el.innerHTML = `<pre class="tout"></pre><div class="tline"><span class="tprompt"></span><input class="tin" spellcheck="false" autocomplete="off" autocapitalize="off"></div>`;
  host.appendChild(el);
  const out = el.querySelector(".tout"), pr = el.querySelector(".tprompt"), inp = el.querySelector(".tin");
  const T = {el, stack: [], busy: false, onClose: opts && opts.onClose, shell: opts && opts.shell, onIdleEnter: opts && opts.onIdleEnter};
  T.print = txt => {
    out.appendChild(document.createTextNode(txt));
    if (out.textContent.length > 60000) out.textContent = out.textContent.slice(-40000);
    el.scrollTop = el.scrollHeight;
  };
  T.top = () => T.stack[T.stack.length - 1];
  T.refresh = () => {
    const s = T.top();
    pr.textContent = T.busy ? "" : s ? promptOf(s) : (T.shell ? T.shell.prompt() : "");
    inp.type = s && s.pending && s.pending.secret ? "password" : "text";
    el.classList.toggle("busy", T.busy);
    el.scrollTop = el.scrollHeight;
  };
  T.focus = () => inp.focus({preventScroll: true});
  T.push = s => { T.stack.push(s); };
  T.pop = () => { T.stack.pop(); };
  T.runAsync = (steps, done) => {
    // steps: [[delayMs, text or fn]], prints with timing, blocks input
    T.busy = true; T.refresh();
    let i = 0;
    const next = () => {
      if (i >= steps.length || T.cancel) { T.busy = false; T.cancel = false; if (done) done(); T.refresh(); return; }
      const [ms, x] = steps[i++];
      setTimeout(() => { if (typeof x === "function") x(); else T.print(x); next(); }, ms);
    };
    next();
  };
  el.addEventListener("click", e => { if (!window.getSelection().toString()) T.focus(); });
  // "?" can arrive as text input (mobile keyboards, paste): treat it like the key
  inp.addEventListener("input", () => {
    const s = T.top();
    if (!s || s.pending || T.busy || !inp.value.includes("?")) return;
    const v = inp.value.replace(/\?/g, "");
    T.print(promptOf(s) + v + "?\n" + cliHelp(s, v) + "\n");
    inp.value = v; T.refresh();
  });
  inp.addEventListener("keydown", e => {
    const s = T.top();
    if (e.ctrlKey && (e.key === "c" || e.key === "C") && T.busy) { e.preventDefault(); T.cancel = true; return; }
    if (T.busy) { e.preventDefault(); return; }
    if (e.ctrlKey && (e.key === "z" || e.key === "Z")) { e.preventDefault(); if (s && CONFIG_MODES.includes(s.mode)) { T.print(promptOf(s) + inp.value + "^Z\n"); s.mode = "priv"; s.ctx = {}; inp.value = ""; T.refresh(); } return; }
    if (e.ctrlKey && (e.key === "c" || e.key === "C")) { e.preventDefault(); T.print(promptOf(s || {}) + inp.value + "^C\n"); inp.value = ""; if (s && s.pending && !s.pending.keep) s.pending = null; T.refresh(); return; }
    if (e.ctrlKey && e.shiftKey && e.key === "^") return;
    const hist = s ? s.hist : (T.shell ? T.shell.hist : []);
    if (e.key === "ArrowUp") { e.preventDefault(); if (s && s.pending) return; T.hidx = Math.max(0, (T.hidx == null ? hist.length : T.hidx) - 1); if (hist[T.hidx] != null) inp.value = hist[T.hidx]; return; }
    if (e.key === "ArrowDown") { e.preventDefault(); if (T.hidx == null) return; T.hidx = Math.min(hist.length, T.hidx + 1); inp.value = hist[T.hidx] || ""; return; }
    if (e.key === "Tab") { e.preventDefault(); if (s && !s.pending) inp.value = cliTab(s, inp.value); return; }
    if (e.key === "?" && s && !s.pending) { e.preventDefault(); T.print(promptOf(s) + inp.value + "?\n" + cliHelp(s, inp.value) + "\n"); T.refresh(); return; }
    if (e.key === "Enter") {
      e.preventDefault();
      const line = inp.value; inp.value = ""; T.hidx = null;
      if (!s && T.onIdleEnter) { T.print("\n"); T.onIdleEnter(); T.refresh(); return; }
      if (s) {
        const shown = s.pending && s.pending.secret ? "" : line;
        T.print(promptOf(s) + shown + "\n");
        if (!s.pending && line.trim()) { hist.push(line); if (hist.length > 20) hist.shift(); }
        cliLine(s, line);
      } else if (T.shell) {
        T.print(T.shell.prompt() + line + "\n");
        if (line.trim()) { hist.push(line); if (hist.length > 50) hist.shift(); }
        T.shell.run(line);
      }
      T.refresh();
    }
  });
  return T;
}

let CLI_DEPTH = 0;
// ---- handle one line typed into an IOS session
function cliLine(s, line) {
  const T = s.term;
  if (s.pending) { const p = s.pending; s.pending = null; p.fn(line); return; }
  if (s.mode !== "user" && s.mode !== "priv" && !line.trim()) return;
  if (!line.trim()) return;
  // output filters, e.g.  show run | include hostname
  const pipe = CLI_DEPTH === 0 && line.match(/^(.*?)\s\|\s*(\S+)\s+(.+)$/);
  if (pipe) {
    const kind = ["include", "exclude", "begin", "section"].find(k => k.startsWith(pipe[2].toLowerCase()));
    if (!kind) { T.print(ERR_INVALID(promptOf(s), line, line.indexOf("|") + 2)); return; }
    let re; try { re = new RegExp(pipe[3].trim(), "i"); } catch (e) { re = /$^/; }
    const real = T.print; let buf = "";
    T.print = t => { buf += t; };
    try { cliLine(s, pipe[1]); } finally { T.print = real; }
    const lines = buf.split("\n");
    let outL;
    if (kind === "include") outL = lines.filter(x => re.test(x));
    else if (kind === "exclude") outL = lines.filter(x => !re.test(x));
    else if (kind === "begin") { const k = lines.findIndex(x => re.test(x)); outL = k < 0 ? [] : lines.slice(k); }
    else { outL = []; let on = false; lines.forEach(x => { if (!/^\s/.test(x)) on = re.test(x); if (on) outL.push(x); }); }
    T.print(outL.join("\n").replace(/\n*$/, "\n"));
    return;
  }
  let mode = s.mode, l = line;
  const toks0 = tokenize(line);
  if (CONFIG_MODES.includes(mode) && toks0.length && toks0[0].t.toLowerCase() === "do") {
    mode = "priv"; l = line.slice(toks0[1] ? toks0[1].at : line.length);
    if (!l.trim()) { T.print("% Incomplete command.\n\n"); return; }
  }
  const toks = tokenize(l);
  const fw = s.dev.type === "firewall";
  let r = cliWalk(treeOf(s, mode), toks, l, s.dev);
  if ((r.err || !r.node.run) && mode !== "config" && CONFIG_MODES.includes(mode)) {
    // IOS tries the parent (global config) mode when a sub-mode doesn't know the command
    const g = cliWalk(treeOf(s, "config"), toks, l, s.dev);
    if (!g.err && g.node.run) { s.mode = mode = "config"; s.ctx = {}; r = g; }
  }
  if (fw && (r.err || !r.node.run) && CONFIG_MODES.includes(mode)) {
    // the ASA runs show / ping / write / clear / packet-tracer straight from config mode (no "do")
    const g = cliWalk(treeOf(s, "priv"), toks, l, s.dev);
    if (!g.err && g.node.run) { mode = "priv"; r = g; }
  }
  if (r.err === "ambig") { T.print(fw ? `ERROR: % Ambiguous command:  "${l.trim()}"\n` : `% Ambiguous command: "${l.trim()}"\n`); return; }
  if (r.err) {
    if (!fw && (mode === "user" || mode === "priv") && toks.length === 1 && r.at === 0) { unknownExec(s, toks[0].t); return; }
    const off = mode !== s.mode ? line.length - l.length : 0;
    T.print(ERR_INVALID(promptOf(s), line, toks[r.at].at + off, fw)); return;
  }
  if (!r.node.run) { T.print(fw ? "ERROR: % Incomplete command\n" : "% Incomplete command.\n\n"); return; }
  const saveMode = s.mode;
  const snap = CLI_DEPTH === 0 && isIOS(s.dev) && CONFIG_MODES.includes(s.mode) ? ifSnap(s.dev) : null;
  const osnap = CLI_DEPTH === 0 && typeof ospfSnapshot === "function" ? ospfSnapshot() : null;
  if (mode !== s.mode) s.mode = mode;
  CLI_DEPTH++;
  try { r.node.run(s, r.args, l); }
  catch (e) { T.print("% Simulator error: " + e.message + "\n"); console.error(e); }
  finally { CLI_DEPTH--; }
  if (mode !== saveMode && s.mode === "priv") s.mode = saveMode;   // `do` returns to where you were
  if (CLI_DEPTH === 0 && isIOS(s.dev)) {
    if (snap) ifDiff(s, snap); else netDirty();
    if (osnap) ospfNotify(osnap);
    save(); scheduleRender();
    if (typeof activityCheck === "function") activityCheck();
    if (typeof refreshDevWins === "function") refreshDevWins(s.dev, true);
  }
}
// IOS treats an unknown single word as a hostname to telnet to — the reason for `no ip domain-lookup`
function unknownExec(s, word) {
  const T = s.term;
  if (s.dev.cfg.domainLookup) {
    T.print(`Translating "${word}"...domain server (255.255.255.255)\n`);
    T.runAsync([[1500, "% Unknown command or computer name, or unable to find computer address\n"]]);
    return;
  }
  T.print(`Translating "${word}"\n% Unknown command or computer name, or unable to find computer address\n`);
}
function cliHelp(s, line) {
  let mode = s.mode, l = line;
  const t0 = tokenize(line);
  if (CONFIG_MODES.includes(mode) && t0.length && t0[0].t.toLowerCase() === "do" && (t0.length > 1 || /\s$/.test(line))) { mode = "priv"; l = line.slice(t0[1] ? t0[1].at : line.length); }
  const root = treeOf(s, mode), toks = tokenize(l), partial = l && !/\s$/.test(l);
  const walkToks = partial ? toks.slice(0, -1) : toks;
  const r = cliWalk(root, walkToks, l, s.dev);
  if (r.err) return "% Unrecognized command";
  const n = r.node;
  if (partial) {
    const p = toks[toks.length - 1].t.toLowerCase();
    const m = n.kids.filter(k => k.kw && k.kw.toLowerCase().startsWith(p)).map(k => k.kw);
    if (!m.length) return "% Unrecognized command";
    return m.join("  ");
  }
  const rows = n.kids.map(k => k.kw ? [k.kw, helpFor(k.kw)] : (/^\d+-\d+$/.test(k.arg) ? [`<${k.arg}>`, k.node.help || "Number"] : [k.arg === "IFACE" ? "<interface>" : k.arg === "A.B.C.D" || k.arg === "MASK" ? "A.B.C.D" : k.arg, ARG_HELP[k.arg] || ""]));
  rows.sort((a, b) => a[0].localeCompare(b[0]));
  if (n.run) rows.push(["<cr>", ""]);
  return rows.length ? cols(rows) : "% Unrecognized command";
}
function cliTab(s, line) {
  if (!line || /\s$/.test(line)) return line;
  let mode = s.mode, pre = "", l = line;
  const t0 = tokenize(line);
  if (CONFIG_MODES.includes(mode) && t0.length > 1 && t0[0].t.toLowerCase() === "do") { mode = "priv"; pre = line.slice(0, t0[1].at); l = line.slice(t0[1].at); }
  const toks = tokenize(l);
  const r = cliWalk(treeOf(s, mode), toks.slice(0, -1), l, s.dev);
  if (r.err) return line;
  const last = toks[toks.length - 1], p = last.t.toLowerCase();
  const m = r.node.kids.filter(k => k.kw && k.kw.toLowerCase().startsWith(p));
  if (m.length !== 1) return line;
  return pre + l.slice(0, last.at) + m[0].kw + " ";
}

// ---- login / enable flows
function sysMsg(s, txt) { s.term.print(txt + "\n"); }
function startIOS(T, dev, via, done) {
  // called when a console or vty session begins
  const s = newSession(dev, via, T);
  T.push(s);
  const c = dev.cfg, line = via === "console" ? c.lines.con : c.lines.vty;
  if (c.banner) T.print(c.banner.replace(/^\n+/, "") + "\n");
  const ok = () => { s.authed = true; s.mode = "user"; if (done) done(s); T.refresh(); };
  if (line.loginLocal) {
    T.print("\nUser Access Verification\n\n");
    const askUser = () => {
      s.pending = {prompt: "Username: ", fn: u => {
        s.pending = {prompt: "Password: ", secret: true, fn: pw => {
          const usr = c.users[u];
          if (usr && pwCheck(usr.secret || usr.password, pw)) { if (usr.priv === 15) { ok(); s.mode = "priv"; T.refresh(); } else ok(); return; }
          T.print("% Login invalid\n\n");
          if (++s.tries >= 3) { endSession(s, "% Bad passwords"); return; }
          askUser();
        }};
      }};
    };
    askUser();
    if (!Object.keys(c.users).length && via !== "console") { /* IOS still prompts; nobody can log in */ }
    T.refresh(); return s;
  }
  if (line.login) {
    if (!line.password) {
      if (via === "console") { ok(); return s; }
      T.print("\nPassword required, but none set\n"); endSession(s); return null;
    }
    T.print("\nUser Access Verification\n\n");
    const ask = () => {
      s.pending = {prompt: "Password: ", secret: true, fn: pw => {
        if (pwCheck(line.password, pw)) { ok(); return; }
        if (++s.tries >= 3) { T.print("% Bad passwords\n"); endSession(s); return; }
        ask();
      }};
    };
    ask(); T.refresh(); return s;
  }
  ok();
  return s;
}
function endSession(s, msg) {
  const T = s.term;
  if (msg) T.print(msg + "\n");
  T.pop();
  if (s.via === "telnet" || s.via === "ssh") {
    T.print(`\n[Connection to ${s.remoteAddr || s.dev.cfg.hostname} closed by foreign host]\n`);
  } else if (s.via === "console") {
    T.print(`\n${s.dev.cfg.hostname} con0 is now available\n\n\n\n\n\nPress RETURN to get started.\n\n\n`);
    s.term.awaitReturn = true;
  }
  if (!T.stack.length && T.onClose) T.onClose(s);
  T.refresh();
}
function doEnable(s) {
  const c = s.dev.cfg, T = s.term;
  const p = c.enableSecret || c.enablePassword;
  if (s.dev.type === "firewall") {   // the ASA always asks, and an unset enable password is just Enter
    s.pending = {prompt: "Password: ", secret: true, fn: pw => { if (!p ? pw === "" : pwCheck(p, pw)) { s.mode = "priv"; } else T.print("Invalid password\n"); T.refresh(); }};
    return;
  }
  if (!p) {
    if (s.via === "telnet" || s.via === "ssh") { T.print("% No password set.\n"); return; }
    s.mode = "priv"; return;
  }
  let tries = 0;
  const ask = () => {
    s.pending = {prompt: "Password: ", secret: true, fn: pw => {
      if (pwCheck(p, pw)) { s.mode = "priv"; T.refresh(); return; }
      if (++tries >= 3) { T.print("% Bad secrets\n\n"); return; }
      ask(); T.refresh();
    }};
  };
  ask();
}
