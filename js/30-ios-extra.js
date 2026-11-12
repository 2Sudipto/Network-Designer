// ======================================================================= IOS: ACLs, NAT, port security, DTP, extra show commands
Object.assign(HELP, {
  "access-list": "Add an access list entry", "access-group": "Specify access control for packets", "access-class": "Filter connections based on an IP access list",
  standard: "Standard Access List", extended: "Extended Access List", "access-lists": "List access lists", nat: "NAT configuration commands",
  inside: "Inside interface for address translation", outside: "Outside interface for address translation", source: "Source address translation",
  list: "Specify access list describing local addresses", overload: "Overload an address translation", static: "Static address translation",
  translations: "Translation entries", statistics: "Translation statistics", "port-security": "Security related command", maximum: "Max secure addresses",
  violation: "Security violation mode", sticky: "Configure dynamic secure addresses as sticky", protect: "Security violation protect mode",
  restrict: "Security violation restrict mode", default: "Set a command to its defaults", repeat: "specify repeat count", switchport: "Show interface switchport information",
  netmask: "Specify the network mask", "prefix-length": "Specify the prefix length", in: "inbound packets", out: "outbound packets", description: "Interface description",
});
const iosPr = (s, t) => s.term.print(t.endsWith("\n") ? t : t + "\n");
// print a caret error under token tokIdx of line l
function lineErr(s, l, tokIdx, msg) {
  if (msg && /^(ERROR|%)/.test(msg)) { iosPr(s, msg); return; }
  const toks = tokenize(l);
  if (tokIdx >= toks.length) { iosPr(s, isFw(s.dev) ? "ERROR: % Incomplete command" : "% Incomplete command.\n"); return; }
  iosPr(s, " ".repeat(promptOf(s).length + toks[tokIdx].at) + "^\n" + (isFw(s.dev) ? "ERROR: " : "") + "% Invalid input detected at '^' marker.\n");
}
const restToks = (l, from) => tokenize(l).slice(from).map(t => t.t);

// ======================================================================= ACCESS LISTS
function aclGet(d, name, type) {
  const c = d.cfg; c.acls = c.acls || {};
  if (!c.acls[name]) c.acls[name] = {type, named: !/^\d+$/.test(name), entries: []};
  return c.acls[name];
}
const aclTypeOf = n => /^\d+$/.test(n) ? (+n < 100 || (+n >= 1300 && +n <= 1999) ? "standard" : "extended") : null;
function aclAdd(s, name, type, toks, l, tokBase, seq) {
  const d = s.dev;
  if (toks[0] && toks[0].toLowerCase() === "remark") { const a = aclGet(d, name, type); a.entries.push({id: newAceId(), seq: seq || nextSeq(a), remark: toks.slice(1).join(" ")}); return; }
  const r = parseAce(toks, type === "standard" ? "ios-std" : "ios-ext", d);
  if (r.err != null) { lineErr(s, l, tokBase + r.err, r.msg); return; }
  const a = aclGet(d, name, type);
  if (a.type !== type) { iosPr(s, `% Access-list type conflicts with prior definition`); return; }
  const e = Object.assign({id: newAceId(), seq: seq || nextSeq(a)}, r.entry);
  if (seq && a.entries.some(x => x.seq === seq)) { iosPr(s, "% Duplicate sequence number"); return; }
  a.entries.push(e); a.entries.sort((x, y) => x.seq - y.seq);
}
const nextSeq = a => (a.entries.length ? Math.max(...a.entries.map(e => e.seq)) : 0) + 10;
defCmd("config", "access-list <1-199> <LINE>", (s, a, l) => {
  const n = String(+a[0]), type = aclTypeOf(n);
  aclAdd(s, n, type, restToks(l, 2), l, 2);
});
defCmd("config", "no access-list <1-199>", (s, a) => { if (s.dev.cfg.acls) delete s.dev.cfg.acls[String(+a[0])]; });
const enterNacl = type => (s, a) => {
  const n = a[0];
  if (/^\d+$/.test(n) && aclTypeOf(n) !== type) { iosPr(s, `% Invalid access list name.`); return; }
  const acl = aclGet(s.dev, n, type);
  if (acl.type !== type) { iosPr(s, `% A named ${acl.type} IP access list with this name already exists`); return; }
  s.mode = "nacl"; s.ctx = {acl: n, type};
};
defCmd("config", "ip access-list standard <WORD>", enterNacl("standard"));
defCmd("config", "ip access-list extended <WORD>", enterNacl("extended"));
defCmd("config", "no ip access-list standard <WORD>", (s, a) => { if (s.dev.cfg.acls) delete s.dev.cfg.acls[a[0]]; });
defCmd("config", "no ip access-list extended <WORD>", (s, a) => { if (s.dev.cfg.acls) delete s.dev.cfg.acls[a[0]]; });
["permit", "deny", "remark"].forEach(k => defCmd("nacl", k + " <LINE>", (s, a, l) => aclAdd(s, s.ctx.acl, s.ctx.type, restToks(l, 0), l, 0)));
defCmd("nacl", "<1-2147483647> <LINE>", (s, a, l) => aclAdd(s, s.ctx.acl, s.ctx.type, restToks(l, 1), l, 1, +a[0]));
defCmd("nacl", "no <1-2147483647>", (s, a) => { const acl = s.dev.cfg.acls[s.ctx.acl]; acl.entries = acl.entries.filter(e => e.seq !== +a[0]); });
["permit", "deny"].forEach(k => defCmd("nacl", `no ${k} <LINE>`, (s, a, l) => {
  const acl = s.dev.cfg.acls[s.ctx.acl], r = parseAce(restToks(l, 1), s.ctx.type === "standard" ? "ios-std" : "ios-ext", s.dev);
  if (r.err != null) { lineErr(s, l, 1 + r.err); return; }
  const txt = aceText(r.entry, s.ctx.type === "standard" ? "ios-std" : "ios-ext");
  acl.entries = acl.entries.filter(e => aceText(e, s.ctx.type === "standard" ? "ios-std" : "ios-ext") !== txt);
}));
["exit"].forEach(k => defCmd(["nacl", "router"], k, s => { s.mode = "config"; s.ctx = {}; }));
defCmd(["nacl", "router"], "end", s => { s.mode = "priv"; s.ctx = {}; iosPr(s, `\n%SYS-5-CONFIG_I: Configured from console by console`); });

// interface + line bindings
["in", "out"].forEach(dir => {
  defCmd("if", `ip access-group <WORD> ${dir}`, (s, a) => {
    const d = s.dev;
    for (const n of curIfs(s)) if (isSwitch(d) && !isVirtualIf(n) && !d.cfg.ifaces[n].routed) { iosPr(s, "% Port ACLs on layer 2 switchports are not simulated: apply the ACL to an SVI (interface vlan) or a routed port."); return; }
    setPorts(s, i => { i[dir === "in" ? "aclIn" : "aclOut"] = a[0]; });
  });
  defCmd("if", `no ip access-group <WORD> ${dir}`, s => setPorts(s, i => { delete i[dir === "in" ? "aclIn" : "aclOut"]; }));
  defCmd("if", `no ip access-group ${dir}`, s => setPorts(s, i => { delete i[dir === "in" ? "aclIn" : "aclOut"]; }));
});
defCmd("line", "access-class <WORD> in", (s, a) => { lineObj(s).accessClass = a[0]; });
defCmd("line", "no access-class <WORD> in", s => { delete lineObj(s).accessClass; });

function aclShow(d, name) {
  const a = d.cfg.acls[name], hits = rt(d).aclHits || {}, fl = a.type === "standard" ? "ios-std" : "ios-ext";
  const L = [`${a.type === "standard" ? "Standard" : "Extended"} IP access list ${name}`];
  a.entries.forEach(e => {
    if (e.remark != null) return;
    let txt = aceText(e, fl);
    if (fl === "ios-std" && e.src.wild) txt = `${e.action} ${e.src.ip}, wildcard bits ${e.src.wild}${e.log ? " log" : ""}`;
    L.push(`    ${e.seq} ${txt}${hits[e.id] ? ` (${hits[e.id]} match${hits[e.id] > 1 ? "es" : ""})` : ""}`);
  });
  return L.join("\n");
}
function showAcls(s, a) {
  const d = s.dev, acls = d.cfg.acls || {};
  const names = a && a[0] ? [a[0]] : Object.keys(acls).sort((x, y) => (/^\d+$/.test(x) && /^\d+$/.test(y)) ? x - y : x.localeCompare(y));
  iosPr(s, names.filter(n => acls[n]).map(n => aclShow(d, n)).join("\n"));
}
defCmd(SHOWM, "show access-lists", showAcls);
defCmd(SHOWM, "show access-lists <WORD>", showAcls);
defCmd(SHOWM, "show ip access-lists", showAcls);
defCmd(SHOWM, "show ip access-lists <WORD>", showAcls);
defCmd("priv", "clear access-list counters", s => { rt(s.dev).aclHits = {}; });
defCmd("priv", "clear ip access-list counters", s => { rt(s.dev).aclHits = {}; });

// running-config fragments (called from runningConfig)
function iosAclConfig(c) {
  const L = [], acls = c.acls || {};
  Object.keys(acls).filter(n => /^\d+$/.test(n)).sort((a, b) => a - b).forEach(n => {
    const a = acls[n], fl = a.type === "standard" ? "ios-std" : "ios-ext";
    a.entries.forEach(e => L.push(`access-list ${n} ${aceText(e, fl)}`));
  });
  Object.keys(acls).filter(n => !/^\d+$/.test(n)).sort().forEach(n => {
    const a = acls[n], fl = a.type === "standard" ? "ios-std" : "ios-ext";
    L.push(`ip access-list ${a.type} ${n}`); a.entries.forEach(e => L.push(" " + aceText(e, fl)));
  });
  return L;
}

// ---- data path hooks (called by the engine for IOS routers and layer 3 switches)
function aclDenied(d, inIf, p, name, r, dir) {
  const why = r.implicit ? "implicit deny at the end of the list" : `line ${r.entry.seq}: ${aceText(r.entry, (d.cfg.acls[name] || {}).type === "standard" ? "ios-std" : "ios-ext")}`;
  if (CUR) CUR.drop = `${d.name}: access-list ${name} (${dir}) denies it, ${why}`;
  note(`${d.name} checks access-list ${name} ${dir === "in" ? "inbound" : "outbound"}: DENY (${why})`);
  if (r.entry && r.entry.log) {
    const L = l4(p);
    devLog(d, p.proto === "icmp" ? `%SEC-6-IPACCESSLOGDP: list ${name} denied icmp ${p.src} -> ${p.dst} (${ICMP_CODE[p.icmp.type]}/0), 1 packet` : `%SEC-6-IPACCESSLOGP: list ${name} denied ${p.proto} ${p.src}(${L.sport}) -> ${p.dst}(${L.dport}), 1 packet`);
  }
  // IOS answers with ICMP "administratively prohibited": that's the U you see in ping
  if (!isIcmpErr(p) && inIf && inIf.ip) ipOut(d, {src: inIf.ip, dst: p.src, ttl: 255, proto: "icmp", icmp: {type: "unreach", code: 13, id: p.icmp ? p.icmp.id : p.tcp ? p.tcp.id : 0, seq: p.icmp ? p.icmp.seq : 0}});
}
function aclPermitLog(d, name, r, p) {
  if (!r.entry || !r.entry.log) return;
  const L = l4(p);
  devLog(d, p.proto === "icmp" ? `%SEC-6-IPACCESSLOGDP: list ${name} permitted icmp ${p.src} -> ${p.dst} (${ICMP_CODE[p.icmp.type]}/0), 1 packet` : `%SEC-6-IPACCESSLOGP: list ${name} permitted ${p.proto} ${p.src}(${L.sport}) -> ${p.dst}(${L.dport}), 1 packet`);
}
// a packet arrives on an L3 interface: inbound ACL, then NAT outside→inside. false = dropped
function iosIngress(d, iface, p) {
  const i = d.cfg.ifaces[iface.name]; if (!i) return true;
  if (i.aclIn) {
    const r = aclEval(d, i.aclIn, p);
    if (!r.permit) { aclDenied(d, iface, p, i.aclIn, r, "in"); return false; }
    if (!r.missing) { note(`${d.name} checks access-list ${i.aclIn} inbound on ${iface.name}: permit${r.entry ? " (line " + r.entry.seq + ")" : ""}`); aclPermitLog(d, i.aclIn, r, p); }
  }
  if (i.nat === "outside") natOutsideIn(d, iface, p);
  return true;
}
// after the routing decision: NAT inside→outside, then the outbound ACL (IOS order of operations)
function iosEgress(d, inIf, outName, p) {
  const ic = d.cfg.ifaces[inIf.name] || {}, oc = d.cfg.ifaces[outName] || {};
  if (ic.nat === "inside" && oc.nat === "outside") { if (natInsideOut(d, inIf, outName, p) === false) return false; }
  if (oc.aclOut) {
    const r = aclEval(d, oc.aclOut, p);
    if (!r.permit) { aclDenied(d, inIf, p, oc.aclOut, r, "out"); return false; }
    if (!r.missing) aclPermitLog(d, oc.aclOut, r, p);
  }
  return true;
}
// vty access-class: may this source address open a telnet/ssh session?
function vtyAllowed(d, srcIp) {
  const ac = d.cfg.lines.vty.accessClass; if (!ac) return true;
  const acl = (d.cfg.acls || {})[ac]; if (!acl) return true;
  return aclEval(d, ac, {src: srcIp, dst: "0.0.0.0", proto: "ip"}).permit;
}

// ======================================================================= NAT (IOS)
const natCfg = d => d.cfg.nat || (d.cfg.nat = {rules: [], statics: [], pools: {}});
["inside", "outside"].forEach(side => {
  defCmd("if", "ip nat " + side, s => setPorts(s, i => { i.nat = side; }));
  defCmd("if", "no ip nat " + side, s => setPorts(s, i => { if (i.nat === side) delete i.nat; }));
});
const natRule = (s, acl, kind, target, overload) => {
  const N = natCfg(s.dev);
  if (kind === "iface") { const n = resolveIf(s.dev, target); if (!n) { iosPr(s, "% Invalid input detected at '^' marker."); return; } target = n; }
  else if (!N.pools[target]) iosPr(s, `%Pool ${target} not found`);
  N.rules = N.rules.filter(r => r.acl !== acl);
  N.rules.push(kind === "iface" ? {acl, iface: target, overload: !!overload} : {acl, pool: target, overload: !!overload});
};
defCmd("config", "ip nat inside source list <WORD> interface <IFACE> overload", (s, a) => natRule(s, a[0], "iface", a[1], true));
defCmd("config", "ip nat inside source list <WORD> interface <IFACE>", (s, a) => natRule(s, a[0], "iface", a[1], false));
defCmd("config", "ip nat inside source list <WORD> pool <WORD> overload", (s, a) => natRule(s, a[0], "pool", a[1], true));
defCmd("config", "ip nat inside source list <WORD> pool <WORD>", (s, a) => natRule(s, a[0], "pool", a[1], false));
defCmd("config", "no ip nat inside source list <WORD> <LINE>", (s, a) => { const N = natCfg(s.dev); N.rules = N.rules.filter(r => r.acl !== a[0]); });
defCmd("config", "ip nat inside source static <A.B.C.D> <A.B.C.D>", (s, a) => {
  const N = natCfg(s.dev);
  if (N.statics.some(x => !x.proto && x.local === a[0] && x.global !== a[1])) { iosPr(s, `% ${a[0]} already mapped (${a[0]} -> ${N.statics.find(x => x.local === a[0]).global})`); return; }
  N.statics = N.statics.filter(x => !(x.local === a[0] && !x.proto)); N.statics.push({local: a[0], global: a[1]});
});
["tcp", "udp"].forEach(pr => defCmd("config", `ip nat inside source static ${pr} <A.B.C.D> <1-65535> <A.B.C.D> <1-65535>`, (s, a) => {
  const N = natCfg(s.dev); N.statics = N.statics.filter(x => !(x.proto === pr && x.global === a[2] && x.gport === +a[3]));
  N.statics.push({proto: pr, local: a[0], lport: +a[1], global: a[2], gport: +a[3]});
}));
defCmd("config", "no ip nat inside source static <A.B.C.D> <A.B.C.D>", (s, a) => { const N = natCfg(s.dev); N.statics = N.statics.filter(x => !(x.local === a[0] && x.global === a[1] && !x.proto)); });
["tcp", "udp"].forEach(pr => defCmd("config", `no ip nat inside source static ${pr} <A.B.C.D> <1-65535> <A.B.C.D> <1-65535>`, (s, a) => { const N = natCfg(s.dev); N.statics = N.statics.filter(x => !(x.proto === pr && x.global === a[2] && x.gport === +a[3])); }));
defCmd("config", "ip nat pool <WORD> <A.B.C.D> <A.B.C.D> netmask <MASK>", (s, a) => { if (!isMask(a[3])) { iosPr(s, "%Invalid netmask"); return; } natCfg(s.dev).pools[a[0]] = {start: a[1], end: a[2], mask: a[3]}; });
defCmd("config", "ip nat pool <WORD> <A.B.C.D> <A.B.C.D> prefix-length <1-32>", (s, a) => { natCfg(s.dev).pools[a[0]] = {start: a[1], end: a[2], mask: lenToMask(+a[3])}; });
defCmd("config", "no ip nat pool <WORD>", (s, a) => { delete natCfg(s.dev).pools[a[0]]; });

function natOutsideIn(d, iface, p) {
  const L = l4(p), N = d.cfg.nat;
  let x = xlates(d).find(x => x.kind !== "static" && x.mIp === p.dst && x.proto === p.proto && x.mPort === L.dport);
  if (!x && N) {
    const st = N.statics.find(st => st.global === p.dst && (!st.proto || (st.proto === p.proto && st.gport === L.dport)));
    if (st) x = xlateAdd(d, {proto: p.proto, rIp: st.local, rPort: st.proto ? st.lport : L.dport, mIp: st.global, mPort: L.dport, oIp: p.src, oPort: L.sport, kind: "flow", rIf: null, mIf: iface.name});
  }
  if (!x) return;
  x.hits++; x.last = Date.now(); natStats(d).hits++;
  note(`${d.name} NAT (outside→inside): ${p.dst}${p.proto !== "icmp" ? ":" + L.dport : ""} → ${x.rIp}${p.proto !== "icmp" ? ":" + x.rPort : ""}`);
  p.dst = x.rIp; setPort(p, "dport", x.rPort);
}
const natStats = d => rt(d).natStat || (rt(d).natStat = {hits: 0, misses: 0});
function natInsideOut(d, inIf, outName, p) {
  const N = d.cfg.nat; if (!N) return;
  const L = l4(p);
  let x = xlates(d).find(x => x.kind !== "static" && x.rIp === p.src && x.proto === p.proto && x.rPort === L.sport && x.oIp === p.dst);
  if (!x) {
    let mIp = null, mPort = L.sport;
    const st = N.statics.find(st => st.local === p.src && (!st.proto || (st.proto === p.proto && st.lport === L.sport)));
    if (st) { mIp = st.global; if (st.proto) mPort = st.gport; }
    else {
      const rule = N.rules.find(r => { const ok = (d.cfg.acls || {})[r.acl] ? aclEval(d, r.acl, p) : {permit: false}; return ok.permit; });
      if (!rule) { natStats(d).misses++; note(`${d.name}: no NAT rule matches ${p.src}, forwarded untranslated`); return; }
      if (rule.iface) { mIp = (d.cfg.ifaces[rule.iface] || {}).ip; if (!mIp) { note(`${d.name}: NAT interface ${rule.iface} has no address`); return; } }
      else {
        const pool = N.pools[rule.pool]; if (!pool) { natStats(d).misses++; return; }
        const a = ipToInt(pool.start), b = ipToInt(pool.end);
        if (rule.overload) mIp = pool.start;
        else {
          const taken = new Set(xlates(d).filter(x => x.kind !== "static" && x.rIp !== p.src).map(x => x.mIp)), mine = xlates(d).find(x => x.rIp === p.src && x.mIp && x.kind !== "static" && ipToInt(x.mIp) >= a && ipToInt(x.mIp) <= b);
          if (mine) mIp = mine.mIp;
          else for (let n = a; n <= b; n++) if (!taken.has(intToIp(n))) { mIp = intToIp(n); break; }
          if (!mIp) { natStats(d).misses++; if (CUR) CUR.drop = `NAT pool ${rule.pool} has no free addresses`; devLog(d, `%IOSXE-6-PLATFORM: NAT pool ${rule.pool} exhausted`); return false; }
        }
      }
      if (rule.overload) mPort = patPort(d, mIp, p.proto, L.sport);
    }
    x = xlateAdd(d, {proto: p.proto, rIp: p.src, rPort: L.sport, mIp, mPort, oIp: p.dst, oPort: L.dport, kind: st ? "flow" : "dynamic", rIf: inIf.name, mIf: outName});
  } else { x.hits++; x.last = Date.now(); }
  natStats(d).hits++;
  note(`${d.name} NAT (inside→outside): ${p.src}${p.proto !== "icmp" ? ":" + L.sport : ""} → ${x.mIp}${p.proto !== "icmp" ? ":" + x.mPort : ""}`);
  p.src = x.mIp; setPort(p, "sport", x.mPort);
}
// a router answers ARP for its static NAT and pool addresses on the outside interface
function iosNatOwns(d, iface, ip) {
  const N = d.cfg.nat, i = d.cfg.ifaces[iface.name]; if (!N || !i || i.nat !== "outside") return false;
  if (N.statics.some(s => s.global === ip)) return true;
  return Object.values(N.pools).some(p => ipToInt(ip) >= ipToInt(p.start) && ipToInt(ip) <= ipToInt(p.end));
}
defCmd(SHOWM, "show ip nat translations", s => {
  const d = s.dev, N = d.cfg.nat || {statics: []};
  const hp = (ip, port, pr) => ip ? (pr && pr !== "ip" ? `${ip}:${port}` : ip) : "---";
  const L = ["Pro  Inside global         Inside local          Outside local         Outside global"];
  xlates(d).filter(x => x.kind !== "static").forEach(x => L.push(pad(x.proto, 5) + pad(hp(x.mIp, x.mPort, x.proto), 22) + pad(hp(x.rIp, x.rPort, x.proto), 22) + pad(hp(x.oIp, x.oPort, x.proto), 22) + hp(x.oIp, x.oPort, x.proto)));
  N.statics.forEach(st => L.push(pad(st.proto || "---", 5) + pad(st.proto ? `${st.global}:${st.gport}` : st.global, 22) + pad(st.proto ? `${st.local}:${st.lport}` : st.local, 22) + pad("---", 22) + "---"));
  iosPr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip nat statistics", s => {
  const d = s.dev, N = d.cfg.nat || {rules: [], statics: [], pools: {}}, xs = xlates(d).filter(x => x.kind !== "static"), st = natStats(d);
  const ins = ifOrder(d).filter(n => (d.cfg.ifaces[n] || {}).nat === "inside").map(longIf), outs = ifOrder(d).filter(n => (d.cfg.ifaces[n] || {}).nat === "outside").map(longIf);
  iosPr(s, `Total active translations: ${xs.length + N.statics.length} (${N.statics.length} static, ${xs.length} dynamic; ${xs.filter(x => x.proto !== "ip").length} extended)\nOutside interfaces:\n${outs.map(x => "  " + x).join("\n") || "  "}\nInside interfaces: \n${ins.map(x => "  " + x).join("\n") || "  "}\nHits: ${st.hits}  Misses: ${st.misses}\nCEF Translated packets: ${st.hits}, CEF Punted packets: 0\nExpired translations: 0\nDynamic mappings:\n-- Inside Source\n${N.rules.map((r, k) => `[Id: ${k + 1}] access-list ${r.acl} ${r.iface ? "interface " + longIf(r.iface) : "pool " + r.pool}${r.overload ? " overload" : ""} refcount ${xs.length}`).join("\n")}${Object.entries(N.pools).map(([n, p]) => `\n pool ${n}: netmask ${p.mask}\n\tstart ${p.start} end ${p.end}\n\ttype generic, total addresses ${ipToInt(p.end) - ipToInt(p.start) + 1}, allocated ${new Set(xs.map(x => x.mIp).filter(ip => ipToInt(ip) >= ipToInt(p.start) && ipToInt(ip) <= ipToInt(p.end))).size}`).join("")}`);
});
defCmd("priv", "clear ip nat translation *", s => { rt(s.dev).xl = []; });
function iosNatConfig(c) {
  const N = c.nat; if (!N) return [];
  const L = [];
  Object.entries(N.pools).forEach(([n, p]) => L.push(`ip nat pool ${n} ${p.start} ${p.end} netmask ${p.mask}`));
  N.rules.forEach(r => L.push(`ip nat inside source list ${r.acl} ${r.iface ? "interface " + longIf(r.iface) : "pool " + r.pool}${r.overload ? " overload" : ""}`));
  N.statics.forEach(st => L.push(st.proto ? `ip nat inside source static ${st.proto} ${st.local} ${st.lport} ${st.global} ${st.gport}` : `ip nat inside source static ${st.local} ${st.global}`));
  return L;
}

// ======================================================================= PORT SECURITY
const psOf = i => i.ps || (i.ps = {on: false, max: 1, viol: "shutdown", sticky: false, macs: []});
function psNeedAccess(s) {
  for (const n of curIfs(s)) {
    const i = s.dev.cfg.ifaces[n];
    if (!isSwitch(s.dev) || isVirtualIf(n) || i.routed) { iosPr(s, "% Invalid input detected at '^' marker."); return false; }
    if (i.mode === "trunk") { iosPr(s, `Command rejected: ${longIf(n)} is a trunk port.`); return false; }
    if (i.mode !== "access") { iosPr(s, `Command rejected: ${longIf(n)} is a dynamic port.`); return false; }
  }
  return true;
}
defCmd("if", "switchport port-security", s => { if (psNeedAccess(s)) setPorts(s, i => { psOf(i).on = true; }); });
defCmd("if", "no switchport port-security", s => setPorts(s, (i, n) => { if (i.ps) i.ps.on = false; const r = rt(s.dev); if (r.errdis) delete r.errdis[n]; }));
defCmd("if", "switchport port-security maximum <1-132>", (s, a) => { if (psNeedAccess(s)) setPorts(s, i => { psOf(i).max = +a[0]; }); });
["protect", "restrict", "shutdown"].forEach(v => defCmd("if", "switchport port-security violation " + v, s => { if (psNeedAccess(s)) setPorts(s, i => { psOf(i).viol = v; }); }));
defCmd("if", "switchport port-security mac-address sticky", s => { if (psNeedAccess(s)) setPorts(s, (i, n) => { const ps = psOf(i); ps.sticky = true; const st = ((rt(s.dev).psec || {})[n]); if (st) { st.learned.forEach(m => ps.macs.push({mac: m, sticky: true})); st.learned = []; } }); });
defCmd("if", "no switchport port-security mac-address sticky", s => setPorts(s, i => { const ps = psOf(i); ps.sticky = false; ps.macs = ps.macs.filter(m => !m.sticky); }));
defCmd("if", "switchport port-security mac-address <WORD>", (s, a) => {
  if (!/^[0-9a-f]{4}\.[0-9a-f]{4}\.[0-9a-f]{4}$/i.test(a[0])) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  if (psNeedAccess(s)) setPorts(s, i => { const ps = psOf(i); if (!ps.macs.some(m => m.mac === a[0].toLowerCase())) ps.macs.push({mac: a[0].toLowerCase()}); });
});
defCmd("if", "switchport port-security aging time <0-1440>", () => {});
// engine hook: may this frame enter the port?
function psecCheck(d, port, f, vlan) {
  const i = d.cfg.ifaces[port], ps = i && i.ps;
  if (!ps || !ps.on || i.mode !== "access") return true;
  const r = rt(d), st = (r.psec = r.psec || {})[port] || (r.psec[port] = {learned: [], viol: 0});
  if (ps.macs.some(m => m.mac === f.src) || st.learned.includes(f.src)) return true;
  if (ps.macs.length + st.learned.length < ps.max) {
    if (ps.sticky) { ps.macs.push({mac: f.src, sticky: true}); note(`${d.name} port-security: learns ${f.src} as a sticky secure MAC on ${port}`); if (typeof save === "function") save(); }
    else { st.learned.push(f.src); note(`${d.name} port-security: learns ${f.src} as a secure MAC on ${port}`); }
    return true;
  }
  st.viol++; st.last = `${f.src}:${vlan}`;
  if (CUR) CUR.drop = `port-security violation on ${d.name} ${port} (${ps.viol}): ${f.src} is not a secure MAC`;
  if (ps.viol === "protect") return false;
  if (ps.viol === "restrict") { devLog(d, `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${f.src} on port ${longIf(port)}.`, {sev: 2}); return false; }
  (r.errdis = r.errdis || {})[port] = "psecure-violation";
  devLog(d, `%PM-4-ERR_DISABLE: psecure-violation error detected on ${shortIf(port)}, putting ${shortIf(port)} in err-disable state`, {sev: 4});
  devLog(d, `%PORT_SECURITY-2-PSECURE_VIOLATION: Security violation occurred, caused by MAC address ${f.src} on port ${longIf(port)}.`, {sev: 2});
  devLog(d, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(port)}, changed state to down`);
  devLog(d, `%LINK-3-UPDOWN: Interface ${longIf(port)}, changed state to down`);
  netDirty(); if (typeof scheduleRender === "function") scheduleRender();
  return false;
}
const errDisabled = (d, port) => !!(RT[d.id] && RT[d.id].errdis && RT[d.id].errdis[port]);
function showPsec(s) {
  const d = s.dev; if (!isSwitch(d)) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  const L = ["Secure Port  MaxSecureAddr  CurrentAddr  SecurityViolation  Security Action", "                (Count)       (Count)          (Count)", "---------------------------------------------------------------------------"];
  allPorts(d).forEach(p => { const i = d.cfg.ifaces[p]; if (!i || !i.ps || !i.ps.on) return; const st = (rt(d).psec || {})[p] || {learned: [], viol: 0}; L.push(pad(shortIf(p), 13) + pad(String(i.ps.max).padStart(9), 15) + pad(String(i.ps.macs.length + st.learned.length).padStart(9), 13) + pad(String(st.viol).padStart(12), 19) + (i.ps.viol[0].toUpperCase() + i.ps.viol.slice(1))); });
  L.push("---------------------------------------------------------------------------", `Total Addresses in System (excluding one mac per port)     : 0`, `Max Addresses limit in System (excluding one mac per port) : 1024`);
  iosPr(s, L.join("\n"));
}
defCmd(SHOWM, "show port-security", showPsec);
defCmd(SHOWM, "show port-security interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]), i = n && d.cfg.ifaces[n]; if (!i || !isSwitch(d)) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  const ps = i.ps || {on: false, max: 1, viol: "shutdown", sticky: false, macs: []}, st = (rt(d).psec || {})[n] || {learned: [], viol: 0};
  iosPr(s, `Port Security              : ${ps.on ? "Enabled" : "Disabled"}\nPort Status                : ${errDisabled(d, n) ? "Secure-shutdown" : ps.on && ifUp(d, n) ? "Secure-up" : "Secure-down"}\nViolation Mode             : ${ps.viol[0].toUpperCase() + ps.viol.slice(1)}\nAging Time                 : 0 mins\nAging Type                 : Absolute\nSecureStatic Address Aging : Disabled\nMaximum MAC Addresses      : ${ps.max}\nTotal MAC Addresses        : ${ps.macs.length + st.learned.length}\nConfigured MAC Addresses   : ${ps.macs.filter(m => !m.sticky).length}\nSticky MAC Addresses       : ${ps.macs.filter(m => m.sticky).length}\nLast Source Address:Vlan   : ${st.last || "0000.0000.0000:0"}\nSecurity Violation Count   : ${st.viol}`);
});
defCmd(SHOWM, "show port-security address", s => {
  const d = s.dev, L = ["               Secure Mac Address Table", "-----------------------------------------------------------------------------", "Vlan    Mac Address       Type                          Ports   Remaining Age", "                                                                   (mins)", "----    -----------       ----                          -----   -------------"];
  allPorts(d).forEach(p => { const i = d.cfg.ifaces[p]; if (!i || !i.ps || !i.ps.on) return; const st = (rt(d).psec || {})[p] || {learned: []};
    i.ps.macs.forEach(m => L.push(`${String(i.accessVlan || 1).padStart(4)}    ${m.mac}    ${pad(m.sticky ? "SecureSticky" : "SecureConfigured", 30)}${pad(shortIf(p), 8)}    -`));
    st.learned.forEach(m => L.push(`${String(i.accessVlan || 1).padStart(4)}    ${m}    ${pad("SecureDynamic", 30)}${pad(shortIf(p), 8)}    -`)); });
  L.push("-----------------------------------------------------------------------------");
  iosPr(s, L.join("\n"));
});
defCmd("priv", "clear port-security sticky", s => { allPorts(s.dev).forEach(p => { const i = s.dev.cfg.ifaces[p]; if (i && i.ps) i.ps.macs = i.ps.macs.filter(m => !m.sticky); }); });
defCmd("priv", "clear port-security all", s => { rt(s.dev).psec = {}; allPorts(s.dev).forEach(p => { const i = s.dev.cfg.ifaces[p]; if (i && i.ps) i.ps.macs = i.ps.macs.filter(m => !m.sticky); }); });
defCmd("config", "errdisable recovery cause psecure-violation", s => { s.dev.cfg.errRecovery = true; });

// ======================================================================= DTP / switchport details
function dtpTrunk(d, p) {
  const i = d.cfg.ifaces[p]; if (!i) return false;
  if (i.mode === "trunk") return true;
  if (i.mode === "access") return false;
  const o = linkAt(d, p); if (!o || !isSwitch(o.dev) || !isSwitchport(o.dev, o.port)) return false;
  const oi = o.dev.cfg.ifaces[o.port]; if (!oi) return false;
  if (oi.mode === "trunk") return !oi.noneg;
  if (oi.mode === "desirable") return true;
  if (oi.mode === "dynamic" || oi.mode === "auto") return i.mode === "desirable";
  return false;
}
const adminModeTxt = i => i.mode === "trunk" ? "trunk" : i.mode === "access" ? "static access" : i.mode === "desirable" ? "dynamic desirable" : "dynamic auto";
defCmd(SHOWM, "show interfaces <IFACE> switchport", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]), i = n && d.cfg.ifaces[n];
  if (!i || !isSwitch(d) || isVirtualIf(n)) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  if (i.routed) { iosPr(s, `Name: ${shortIf(n)}\nSwitchport: Disabled`); return; }
  const tr = operTrunk(d, n), vn = v => `${v} (${d.cfg.vlans[v] || "Inactive"})`;
  iosPr(s, `Name: ${shortIf(n)}\nSwitchport: Enabled\nAdministrative Mode: ${adminModeTxt(i).replace("static access", "static access")}\nOperational Mode: ${!ifUp(d, n) ? "down" : tr ? "trunk" : "static access"}\nAdministrative Trunking Encapsulation: dot1q\nOperational Trunking Encapsulation: ${tr ? "dot1q" : "native"}\nNegotiation of Trunking: ${i.noneg || i.mode === "access" ? "Off" : "On"}\nAccess Mode VLAN: ${vn(i.accessVlan || 1)}\nTrunking Native Mode VLAN: ${vn(i.nativeVlan || 1)}\nAdministrative Native VLAN tagging: enabled\nVoice VLAN: none\nAdministrative private-vlan host-association: none\nAdministrative private-vlan mapping: none\nOperational private-vlan: none\nTrunking VLANs Enabled: ${i.allowed === "all" ? "ALL" : i.allowed === "none" ? "NONE" : i.allowed}\nPruning VLANs Enabled: 2-1001\nCapture Mode Disabled\nCapture VLANs Allowed: ALL\n\nProtected: false\nUnknown unicast blocked: disabled\nUnknown multicast blocked: disabled\nAppliance trust: none`);
});

// ======================================================================= MISC IOS BEHAVIOUR
defCmd(SHOWM, "show running-config interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]);
  if (!n || !d.cfg.ifaces[n]) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  const txt = runningConfig(d).split("\n"), k = txt.indexOf("interface " + longIf(n));
  const body = []; for (let j = k; j < txt.length && txt[j] !== "!"; j++) body.push(txt[j]);
  iosPr(s, `Building configuration...\n\nCurrent configuration : ${body.join("\n").length + 1} bytes\n!\n${body.join("\n")}\nend`);
});
defCmd(SHOWM, "show interfaces description", s => {
  const d = s.dev, L = ["Interface                      Status         Protocol Description"];
  ifOrder(d).filter(n => d.cfg.ifaces[n]).forEach(n => { const st = ifStatus(d, n); L.push(pad(shortIf(n), 31) + pad(st.status === "administratively down" ? "admin down" : st.status, 15) + pad(st.proto, 9) + (d.cfg.ifaces[n].desc || "")); });
  iosPr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]), i = n && d.cfg.ifaces[n];
  if (!i) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  const st = ifStatus(d, n);
  iosPr(s, `${longIf(n)} is ${st.status}, line protocol is ${st.proto}\n${i.ip ? `  Internet address is ${i.ip}/${maskToLen(i.mask)}\n  Broadcast address is 255.255.255.255\n  Address determined by setup command\n  MTU is 1500 bytes\n  Helper address is ${(i.helper || []).join(", ") || "not set"}\n  Directed broadcast forwarding is disabled\n  Outgoing access list is ${i.aclOut || "not set"}\n  Inbound  access list is ${i.aclIn || "not set"}\n  Proxy ARP is enabled\n  Local Proxy ARP is disabled\n  Security level is default\n  Split horizon is enabled\n  ICMP redirects are always sent\n  ICMP unreachables are always sent\n  ICMP mask replies are never sent\n  IP fast switching is disabled\n  IP CEF switching is disabled\n  Network address translation is ${i.nat ? "enabled, interface in domain " + i.nat : "disabled"}` : "  Internet protocol processing disabled"}`);
});
defCmd(SHOWM, "show logging", s => {
  const d = s.dev, log = rt(d).log || [];
  iosPr(s, `Syslog logging: enabled (0 messages dropped, 0 messages rate-limited, 0 flushes, 0 overruns, xml disabled, filtering disabled)\n\nNo Active Message Discriminator.\n\nNo Inactive Message Discriminator.\n\n    Console logging: level debugging, ${log.length} messages logged, xml disabled,\n                     filtering disabled\n    Monitor logging: level debugging, 0 messages logged, xml disabled,\n                     filtering disabled\n    Buffer logging:  level debugging, ${log.length} messages logged, xml disabled,\n                    filtering disabled\n\n    Logging Exception size (4096 bytes)\n    Count and timestamp logging messages: disabled\n    Persistent logging: disabled\n\nLog Buffer (4096 bytes):\n${log.map(e => e.msg).join("\n")}`);
});
defCmd("priv", "clear logging", s => { s.pending = {prompt: "Clear logging buffer [confirm]", fn: v => { if (!/^n/i.test(v)) rt(s.dev).log = []; }}; });
defCmd("config", "no logging console", s => { s.dev.cfg.loggingConsole = false; });
defCmd("config", "logging console", s => { s.dev.cfg.loggingConsole = true; });
defCmd("config", "default interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]);
  if (!n || !d.cfg.ifaces[n]) { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  const def = defaultCfg(d).ifaces[n] || {shutdown: false, desc: "", ip: "", mask: "", helper: []};
  if (isVirtualIf(n)) def.shutdown = false;
  d.cfg.ifaces[n] = def; const r = rt(d); if (r.errdis) delete r.errdis[n];
  iosPr(s, `Interface ${longIf(n)} set to default configuration`);
});
defCmd("priv", "show clock detail", s => { const t = new Date(); iosPr(s, `${iosStamp(t)} UTC ${t.toDateString().slice(0, 3)} ${t.toDateString().slice(4)}\nTime source is hardware calendar`); });
// `shutdown` is how you recover an err-disabled port (then `no shutdown`)
defCmd("if", "shutdown", s => setPorts(s, (i, n) => { i.shutdown = true; const r = RT[s.dev.id]; if (r && r.errdis) delete r.errdis[n]; }));
