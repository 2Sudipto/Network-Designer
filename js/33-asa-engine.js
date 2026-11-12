// ======================================================================= FIREWALL DATA PATH (stateful)
// Order of checks, like the ASA's packet-tracer phases:
//   existing flow? → UN-NAT (static / existing xlate) → to-the-box? → ROUTE-LOOKUP → ACCESS-LIST (or security levels)
//   → NAT (source) → INSPECT → FLOW-CREATION.  Return traffic of a flow skips the policy (stateful).
let CONN_ID = 1000;
function asaConns(d) {
  const r = rt(d), now = Date.now();
  r.conns = (r.conns || []).filter(c => now - c.last < (c.proto === "icmp" ? 30000 : c.proto === "udp" ? 120000 : 3600000));
  return r.conns;
}
const asaXl = d => { const r = rt(d), now = Date.now(); r.xl = (r.xl || []).filter(x => x.kind === "static" || now - x.last < 180000); return r.xl; };
const objSize = o => o.type === "host" ? 1 : o.type === "range" ? ipToInt(o.b) - ipToInt(o.a) + 1 : Math.pow(2, 32 - maskToLen(o.b));
const objFirst = o => o.a;
function asaNatRules(d) {
  const c = d.cfg, out = c.twiceNat.map((r, k) => ({sec: 1, line: k + 1, real: r.real, mapped: r.mapped, type: r.type, to: r.to, srcName: r.src, obj: r.src === "any" ? null : c.objects[r.src], cfg: `nat (${r.real},${r.mapped}) source ${r.type} ${r.src} ${r.to}`}));
  const objs = Object.entries(c.objects).filter(([, o]) => o.nat && o.type).map(([name, o]) => ({sec: 2, name, obj: o, real: o.nat.real, mapped: o.nat.mapped, type: o.nat.type, to: o.nat.to, svc: o.nat.svc,
    cfg: `object network ${name}\n nat (${o.nat.real},${o.nat.mapped}) ${o.nat.type} ${o.nat.to}${o.nat.svc ? ` service ${o.nat.svc.proto} ${o.nat.svc.rport} ${o.nat.svc.mport}` : ""}`}));
  objs.sort((a, b) => (a.type === "static" ? 0 : 1) - (b.type === "static" ? 0 : 1) || objSize(a.obj) - objSize(b.obj));
  return out.concat(objs).map((r, k) => Object.assign(r, {key: r.sec + ":" + (r.name || r.line)}));
}
// the mapped (translated) address for a real address under rule r
function natMappedIp(d, r, realIp) {
  const c = d.cfg;
  if (r.to === "interface") { const n = ifByNameif(d, r.mapped); return n ? c.ifaces[n].ip : null; }
  if (isIp(r.to)) return r.to;
  const o = c.objects[r.to]; if (!o) return null;
  if (r.type === "static" && r.obj && r.obj.type !== "host" && o.type !== "host") return intToIp((ipToInt(objFirst(o)) + (ipToInt(realIp) - ipToInt(objFirst(r.obj)))) >>> 0);
  return objFirst(o);
}
// for un-NAT: which real address does a mapped address belong to?
function natRealIp(d, r, mappedIp) {
  if (!r.obj) return null;
  const mFirst = r.to === "interface" ? natMappedIp(d, r) : isIp(r.to) ? r.to : objFirst(d.cfg.objects[r.to] || {});
  if (r.obj.type === "host") return r.obj.a;
  return intToIp((ipToInt(objFirst(r.obj)) + (ipToInt(mappedIp) - ipToInt(mFirst))) >>> 0);
}
function mappedCovers(d, r, ip) {
  if (r.to === "interface") return natMappedIp(d, r) === ip;
  if (isIp(r.to)) return r.to === ip;
  const o = d.cfg.objects[r.to]; if (!o) return false;
  if (r.type === "static" && r.obj && r.obj.type !== "host" && o.type !== "host") { const off = ipToInt(ip) - ipToInt(objFirst(o)); return off >= 0 && off < objSize(r.obj); }
  return objMatch(o, ip);
}
// proxy ARP: the ASA answers for mapped addresses on the mapped interface
function asaArpOwns(d, iface, ip) {
  const ifn = nameifOf(d, iface.name); if (!ifn) return false;
  return asaNatRules(d).some(r => (r.mapped === ifn || r.mapped === "any") && r.to !== "interface" && mappedCovers(d, r, ip));
}
const inspectKey = p => p.proto === "icmp" ? "icmp" : p.proto === "tcp" ? (p.tcp.dport === 80 ? "http" : p.tcp.dport === 21 ? "ftp" : null) : p.proto === "udp" ? (p.udp.dport === 53 ? "dns preset_dns_map" : p.udp.dport === 69 ? "tftp" : null) : null;
const P4 = (p, which) => { const L = l4(p); return p.proto === "icmp" ? (p.icmp.id || 0) : L[which]; };
const ASA_DROP = {acl: "(acl-drop) Flow is denied by configured rule", route: "(no-route) No route to host", nameif: "(ifc-classify) Virtual firewall classification failed", box: "(to-the-box) Traffic to the ASA's own address on another interface is dropped", nosess: "(no-session) No matching connection for this return packet", mgmt: "(acl-drop) Management access is not allowed from this address / interface"};
function fwLog(d, sev, id, msg, dry) { if (!dry) devLog(d, `%ASA-${sev}-${id}: ${msg}`, {sev}); }

// decide what happens to packet p arriving on interface inName. dry = packet-tracer (no state changes)
function fwProcess(d, inName, p, dry) {
  const c = d.cfg, ph = [], inIfn = nameifOf(d, inName), L0 = l4(p);
  const add = (type, subtype, result, config, info) => ph.push({type, subtype: subtype || "", result, config: config || "", info: info || ""});
  const res = (verdict, reason, extra) => Object.assign({verdict, reason, phases: ph, inIfn}, extra || {});
  if (!inIfn) { add("INPUT-INTERFACE", "", "DROP", "", `${longIf(inName)} has no nameif: the ASA does not pass traffic on an interface until it is named`); return res("drop", ASA_DROP.nameif); }
  const ptxt = (ip, port) => p.proto === "icmp" ? ip : `${ip}/${port}`;
  // ---- 1. existing connection?
  for (const cn of asaConns(d)) {
    if (cn.proto !== p.proto) continue;
    const fwd = cn.iIfn === inIfn && p.src === cn.srcR && P4(p, "sport") === cn.sportR && p.dst === cn.dstM && P4(p, "dport") === cn.dportM;
    const rev = cn.rIfn === inIfn && p.src === cn.dstR && P4(p, "sport") === cn.dportR && p.dst === cn.srcM && P4(p, "dport") === cn.sportM;
    const err = !fwd && !rev && isIcmpErr(p) && cn.proto === "icmp" && c.inspect["icmp error"] && cn.rIfn === inIfn && p.dst === cn.srcM && p.icmp.id === cn.sportM;
    if (!fwd && !rev && !err) continue;
    if (p.proto === "icmp" && rev && p.icmp.type === "echo") continue;
    add("FLOW-LOOKUP", "", "ALLOW", "", `Found flow with id ${cn.id}, using existing flow`);
    if (!dry) {
      cn.last = Date.now(); cn.bytes += 64; cn.pkts++;
      if (fwd) { p.src = cn.srcM; setPort(p, "sport", cn.sportM); p.dst = cn.dstR; setPort(p, "dport", cn.dportR); }
      else if (rev) { p.src = cn.dstM; setPort(p, "sport", cn.dportM); p.dst = cn.srcR; setPort(p, "dport", cn.sportR); if (cn.proto === "icmp" && p.icmp.type === "reply") cn.done = true; }
      else { p.dst = cn.srcR; setPort(p, "dport", cn.sportR); }
      note(`${d.name}: packet matches connection ${cn.id} (${cn.proto.toUpperCase()}): stateful return traffic, no ACL check`);
    }
    const dst = dry ? (fwd ? cn.dstR : cn.srcR) : p.dst, route = lookup(d, dst);
    if (!route) { add("ROUTE-LOOKUP", "Resolve Egress Interface", "DROP", "", `no route to ${dst}`); return res("drop", ASA_DROP.route); }
    return res("allow", "", {route, outIfn: nameifOf(d, route.iface), conn: cn});
  }
  // ---- 2. UN-NAT: static mappings, then existing dynamic translations (e.g. PAT replies)
  let realDst = p.dst, realDport = P4(p, "dport"), unnat = null;
  for (const r of asaNatRules(d)) {
    if (r.type !== "static" || !(r.mapped === inIfn || r.mapped === "any")) continue;
    if (r.svc ? !(p.proto === r.svc.proto && mappedCovers(d, r, p.dst) && P4(p, "dport") === r.svc.mport) : !mappedCovers(d, r, p.dst)) continue;
    realDst = natRealIp(d, r, p.dst); if (r.svc) realDport = r.svc.rport; unnat = r;
    add("UN-NAT", "static", "ALLOW", r.cfg, `NAT divert to egress interface ${r.real}\nUntranslate ${ptxt(p.dst, P4(p, "dport"))} to ${ptxt(realDst, realDport)}`);
    break;
  }
  let xUn = null;
  if (!unnat) {
    xUn = asaXl(d).find(x => x.kind !== "static" && x.mIf === inIfn && x.mIp === p.dst && x.proto === p.proto && x.mPort === P4(p, "dport"));
    if (xUn) { realDst = xUn.rIp; realDport = xUn.rPort; add("UN-NAT", "dynamic", "ALLOW", "", `Untranslate ${ptxt(p.dst, P4(p, "dport"))} to ${ptxt(realDst, realDport)} using existing ${xUn.kind === "pat" ? "PAT" : "dynamic"} translation`); }
  }
  // ---- 3. traffic to the ASA itself
  const owner = !unnat && !xUn && l3Ifaces(d).find(i => i.ip && i.ip === p.dst);
  if (owner) {
    if (owner.name !== inName) { add("ACCESS-LIST", "", "DROP", "Implicit Rule", `${p.dst} belongs to interface ${owner.name && nameifOf(d, owner.name)}, not ${inIfn}: the ASA only answers on the interface the packet came in on`); return res("drop", ASA_DROP.box); }
    if (p.proto === "icmp") {
      if (p.icmp.type === "echo") { add("ACCESS-LIST", "", "ALLOW", "Implicit Rule", "ICMP to the ASA's own interface is permitted by default (icmp permit any)"); return res("local"); }
      if (WAIT && WAIT.dev === d.id) { add("ACCESS-LIST", "", "ALLOW", "", "reply to a ping sent by the ASA itself"); return res("local"); }
      fwLog(d, 4, 313004, `Denied ICMP type=${ICMP_CODE[p.icmp.type]}, from laddr ${p.src} on interface ${inIfn} to ${p.dst}: no matching session`, dry);
      add("ACCESS-LIST", "", "DROP", "", `no connection or translation matches this ICMP ${ICMP_NAME[p.icmp.type]}${!c.inspect.icmp ? " (ICMP inspection is off, so the ASA kept no state for the echo request)" : ""}`);
      return res("drop", ASA_DROP.nosess);
    }
    if (p.proto === "tcp") {
      const port = p.tcp.dport, kind = port === 22 ? "ssh" : port === 23 ? "telnet" : port === 443 || port === 80 ? "http" : null;
      const ok = kind && c.mgmt[kind].some(r => r.ifn === inIfn && sameNet(p.src, r.net, r.mask)) && (kind !== "http" || c.mgmt.httpServer) && (kind !== "ssh" || c.ssh.keyBits);
      if (ok) { add("ACCESS-LIST", "", "ALLOW", `${kind} ${c.mgmt[kind].find(r => r.ifn === inIfn && sameNet(p.src, r.net, r.mask)).net} ... ${inIfn}`, `management access (${kind}) permitted`); return res("local"); }
      fwLog(d, 3, 710003, `TCP access denied by ACL from ${p.src}/${p.tcp.sport} to ${inIfn}:${p.dst}/${port}`, dry);
      add("ACCESS-LIST", "", "DROP", "", kind ? `no "${kind} <network> <mask> ${inIfn}" rule allows ${p.src}${kind === "ssh" && !c.ssh.keyBits ? " (and no RSA key exists)" : ""}` : `the ASA does not listen on TCP ${port}`);
      return res("drop", ASA_DROP.mgmt);
    }
    add("ACCESS-LIST", "", "DROP", "", "to-the-box traffic not permitted"); return res("drop", ASA_DROP.acl);
  }
  // ---- 4. route lookup (on the real destination)
  const route = lookup(d, realDst);
  if (!route) { add("ROUTE-LOOKUP", "Resolve Egress Interface", "DROP", "", `no route to ${realDst}`); fwLog(d, 6, 110003, `Routing failed to locate next hop for ${p.proto.toUpperCase()} from ${inIfn}:${p.src}/${P4(p, "sport")} to ${inIfn}:${realDst}/${realDport}`, dry); return res("drop", ASA_DROP.route); }
  const outName = route.iface, outIfn = nameifOf(d, outName);
  if (!outIfn) { add("ROUTE-LOOKUP", "Resolve Egress Interface", "DROP", "", `egress interface ${longIf(outName)} has no nameif`); return res("drop", ASA_DROP.nameif); }
  add("ROUTE-LOOKUP", "Resolve Egress Interface", "ALLOW", "", `found next-hop ${route.nh} using egress ifc  ${outIfn}${unnat ? "" : ""}`);
  if (outIfn === inIfn && !c.sameSec.intra) { add("ACCESS-LIST", "", "DROP", "Implicit Rule", "traffic would leave on the interface it came in on (hairpin) and same-security-traffic permit intra-interface is off"); return res("drop", ASA_DROP.acl); }
  // ---- 5. access check: the interface ACL, or else security levels
  const real = Object.assign({}, p, {dst: realDst}); if (p.proto !== "icmp") { real[p.proto] = Object.assign({}, p[p.proto], {dport: realDport}); }
  const ag = (c.accessGroups[inIfn] || {}).in, inSec = secOf(d, inName), outSec = secOf(d, outName);
  const errOk = isIcmpErr(p) && c.inspect["icmp error"] && xUn;
  const denyLog = () => {
    if (ag) fwLog(d, 4, 106023, `Deny ${p.proto} src ${inIfn}:${p.src}${p.proto === "icmp" ? "" : "/" + P4(p, "sport")} dst ${outIfn}:${realDst}${p.proto === "icmp" ? ` (type ${ICMP_CODE[p.icmp.type]}, code 0)` : "/" + realDport} by access-group "${ag}" [0x0, 0x0]`, dry);
    else if (p.proto === "tcp") fwLog(d, 2, 106001, `Inbound TCP connection denied from ${p.src}/${p.tcp.sport} to ${realDst}/${realDport} flags SYN  on interface ${inIfn}`, dry);
    else if (p.proto === "udp") fwLog(d, 2, 106006, `Deny inbound UDP from ${p.src}/${p.udp.sport} to ${realDst}/${realDport} on interface ${inIfn}`, dry);
    else fwLog(d, 3, 106014, `Deny inbound icmp src ${inIfn}:${p.src} dst ${outIfn}:${realDst} (type ${ICMP_CODE[p.icmp.type]}, code 0)`, dry);
  };
  if (errOk) add("INSPECT", "icmp-error", "ALLOW", "inspect icmp error", "ICMP error message matched an existing translation");
  else if (ag) {
    const r = aclEval(d, ag, real);
    if (!r.permit) { add("ACCESS-LIST", "", "DROP", r.implicit ? `Implicit Rule` : `access-group ${ag} in interface ${inIfn}\naccess-list ${ag} extended ${aceText(r.entry, "asa")}`, r.implicit ? `no line of access-list ${ag} matched: implicit deny at the end` : ""); denyLog(); return res("drop", ASA_DROP.acl); }
    add("ACCESS-LIST", "log", "ALLOW", `access-group ${ag} in interface ${inIfn}\naccess-list ${ag} extended ${aceText(r.entry, "asa")}`, "");
    if (r.entry.log) fwLog(d, 6, 106100, `access-list ${ag} permitted ${p.proto} ${inIfn}/${p.src}(${P4(p, "sport")}) -> ${outIfn}/${realDst}(${realDport}) hit-cnt 1 first hit [0x0, 0x0]`, dry);
  } else {
    if (inSec > outSec || (inSec === outSec && c.sameSec.inter)) add("ACCESS-LIST", "", "ALLOW", "Implicit Rule", inSec > outSec ? `permit from a higher (${inSec}) to a lower (${outSec}) security level` : "same-security-traffic permit inter-interface");
    else { add("ACCESS-LIST", "", "DROP", "Implicit Rule", inSec === outSec ? `both interfaces have security level ${inSec} and same-security-traffic permit inter-interface is off` : `traffic from a lower (${inSec}) to a higher (${outSec}) security level needs an access-list on ${inIfn}`); denyLog(); return res("drop", ASA_DROP.acl); }
  }
  // ---- 6. source NAT (unless this is the return half of an un-NATed dynamic translation)
  let srcM = p.src, sportM = P4(p, "sport"), natRule = null, natKind = null;
  if (!xUn) for (const r of asaNatRules(d)) {
    if (!(r.real === inIfn || r.real === "any") || !(r.mapped === outIfn || r.mapped === "any")) continue;
    if (r.obj ? !objMatch(r.obj, p.src) : r.srcName !== "any") continue;
    if (r.svc && !(p.proto === r.svc.proto && P4(p, "sport") === r.svc.rport)) continue;
    if (r.type === "static" && unnat && unnat !== r && !r.svc) continue;
    const mip = natMappedIp(d, r, p.src); if (!mip) continue;
    natRule = r; srcM = mip;
    const pat = r.type === "dynamic" && (r.to === "interface" || isIp(r.to) || (d.cfg.objects[r.to] || {}).type === "host");
    natKind = r.type === "static" ? "static" : pat ? "pat" : "dynamic";
    if (r.svc) sportM = r.svc.mport;
    else if (pat) { const ex = asaXl(d).find(x => x.kind === "pat" && x.rIp === p.src && x.rPort === P4(p, "sport") && x.proto === p.proto && x.mIp === mip); sportM = ex ? ex.mPort : patPort(d, mip, p.proto, P4(p, "sport")); }
    add("NAT", natKind === "static" ? "static" : "", "ALLOW", r.cfg, `${natKind === "static" ? "Static" : "Dynamic"} translate ${ptxt(p.src, P4(p, "sport"))} to ${ptxt(srcM, sportM)}`);
    break;
  }
  if (!natRule && !xUn && !unnat) add("NAT", "", "ALLOW", "", "no NAT rule matches: the packet keeps its source address");
  // ---- 7. inspection + flow creation
  const ik = inspectKey(p), insp = ik && c.inspect[ik];
  if (insp) add("INSPECT", "np-inspect", "ALLOW", `class-map inspection_default\n match default-inspection-traffic\npolicy-map global_policy\n class inspection_default\n  inspect ${ik}\nservice-policy global_policy global`, "");
  const stateful = p.proto !== "icmp" || (insp && p.icmp.type === "echo");
  const id = stateful ? (dry ? CONN_ID + 1 : ++CONN_ID) : null;
  if (stateful) add("FLOW-CREATION", "", "ALLOW", "", `New flow created with id ${id}, packet dispatched to next module`);
  else add("FLOW-CREATION", "", "ALLOW", "", p.proto === "icmp" ? "ICMP is not inspected (no 'inspect icmp'): no connection is created, so the reply will be checked against the outside policy" : "");
  if (dry) return res("allow", "", {route, outIfn});
  // ---- apply: translation entries, connection, syslog, rewrite
  if (natRule) {
    let x = asaXl(d).find(x => x.rIp === p.src && x.mIp === srcM && x.proto === (natKind === "pat" ? p.proto : "ip") && (natKind !== "pat" || x.rPort === P4(p, "sport")));
    if (!x) {
      x = xlateAdd(d, {proto: natKind === "pat" ? p.proto : "ip", rIp: p.src, rPort: natKind === "pat" || natRule.svc ? P4(p, "sport") : null, mIp: srcM, mPort: natKind === "pat" || natRule.svc ? sportM : null, kind: natKind, rIf: inIfn, mIf: outIfn, rule: natRule.key});
      if (natKind === "pat" || natKind === "dynamic") fwLog(d, 6, 305011, `Built dynamic ${p.proto.toUpperCase()} translation from ${inIfn}:${p.src}/${P4(p, "sport")} to ${outIfn}:${srcM}/${sportM}`);
    } else { x.last = Date.now(); x.hits++; }
    const nh = rt(d).natHits || (rt(d).natHits = {}); nh[natRule.key] = nh[natRule.key] || {t: 0, u: 0}; nh[natRule.key].t++;
  }
  if (unnat) { const nh = rt(d).natHits || (rt(d).natHits = {}); nh[unnat.key] = nh[unnat.key] || {t: 0, u: 0}; nh[unnat.key].u++; }
  if (xUn) { xUn.last = Date.now(); }
  if (insp) { const ih = rt(d).inspHits || (rt(d).inspHits = {}); ih[ik.split(" ")[0]] = (ih[ik.split(" ")[0]] || 0) + 1; }
  if (stateful) {
    const cn = {id, proto: p.proto, iIfn: inIfn, rIfn: outIfn, srcR: p.src, sportR: P4(p, "sport"), srcM, sportM, dstM: p.dst, dportM: P4(p, "dport"), dstR: realDst, dportR: realDport, born: Date.now(), last: Date.now(), bytes: 64, pkts: 1, outbound: inSec > outSec};
    asaConns(d).push(cn); const r = rt(d); r.connMax = Math.max(r.connMax || 0, r.conns.length);
    const dir = inSec > outSec ? "outbound" : "inbound";
    if (p.proto === "icmp") fwLog(d, 6, 302020, `Built ${dir} ICMP connection for faddr ${inSec > outSec ? realDst : p.src}/${inSec > outSec ? realDport : sportM} gaddr ${inSec > outSec ? srcM : p.dst}/${sportM} laddr ${inSec > outSec ? p.src : realDst}/${P4(p, "sport")} type 8 code 0`);
    else fwLog(d, 6, p.proto === "tcp" ? 302013 : 302015, inSec > outSec
      ? `Built outbound ${p.proto.toUpperCase()} connection ${id} for ${outIfn}:${realDst}/${realDport} (${p.dst}/${P4(p, "dport")}) to ${inIfn}:${p.src}/${P4(p, "sport")} (${srcM}/${sportM})`
      : `Built inbound ${p.proto.toUpperCase()} connection ${id} for ${inIfn}:${p.src}/${P4(p, "sport")} (${srcM}/${sportM}) to ${outIfn}:${realDst}/${realDport} (${p.dst}/${P4(p, "dport")})`);
  }
  note(`${d.name} (${inIfn} → ${outIfn}): ${ph.map(x => x.type + " " + x.result).join(", ")}`);
  p.src = srcM; setPort(p, "sport", sportM); p.dst = realDst; setPort(p, "dport", realDport);
  return res("allow", "", {route, outIfn});
}
// engine entry point (called from l3In for firewalls)
function fwIn(d, inIf, f) {
  const p = f.ip;
  if (p.udp && p.udp.dhcp) return dhcpIn(d, inIf, f);
  const r = fwProcess(d, inIf.name, p, false);
  if (r.verdict === "local") return deliver(d, inIf, p);
  if (r.verdict !== "allow") { if (CUR) CUR.drop = `${d.name}: ${r.reason}${r.phases.length ? " — " + r.phases[r.phases.length - 1].info : ""}`; note(`${d.name} drops the packet: ${r.reason}`); return; }
  // an ASA forwards without decrementing TTL, so it does not show up in traceroute
  sendVia(d, r.route, p);
}

// ======================================================================= packet-tracer
function asaPacketTracerCmd(s, ifn, l) {
  const d = s.dev, t = restToks(l, 3), n = ifByNameif(d, ifn), base = 3;
  if (!n) { asaErr(s, `ERROR: '${ifn}' is not a valid interface name`); return; }
  const pr = (t[0] || "").toLowerCase(); let p;
  if (pr === "icmp") {
    const [src, type, code, dst] = t.slice(1);
    if (!isIp(src)) { lineErr(s, l, base + 1); return; } if (!/^\d+$/.test(type || "")) { lineErr(s, l, base + 2); return; } if (!/^\d+$/.test(code || "")) { lineErr(s, l, base + 3); return; } if (!isIp(dst)) { lineErr(s, l, base + 4); return; }
    p = {src, dst, ttl: 64, proto: "icmp", icmp: {type: ({8: "echo", 0: "reply", 3: "unreach", 11: "ttl"})[type] || "echo", id: 1, seq: 0}};
  } else if (pr === "tcp" || pr === "udp") {
    const [src, sp, dst, dp] = t.slice(1);
    if (!isIp(src)) { lineErr(s, l, base + 1); return; } if (portNum(sp) == null) { lineErr(s, l, base + 2); return; } if (!isIp(dst)) { lineErr(s, l, base + 3); return; } if (portNum(dp) == null) { lineErr(s, l, base + 4); return; }
    p = {src, dst, ttl: 64, proto: pr}; p[pr] = {sport: portNum(sp), dport: portNum(dp), flags: "SYN", id: 1};
  } else { lineErr(s, l, base); return; }
  iosPr(s, asaPacketTracerText(d, n, p, /detail/i.test(t.join(" "))));
}
function asaPacketTracerRun(d, inName, p) { return fwProcess(d, inName, clone(p), true); }
function asaPacketTracerText(d, inName, p, detailed) {
  const r = asaPacketTracerRun(d, inName, p), out = [];
  r.phases.forEach((x, k) => {
    out.push(`Phase: ${k + 1}`, `Type: ${x.type}`, `Subtype: ${x.subtype}`, `Result: ${x.result}`, "Config:", ...(x.config ? x.config.split("\n") : []), "Additional Information:", ...(x.info ? x.info.split("\n") : []), ...(detailed ? [` Forward Flow based lookup yields rule:`, ` in  id=0x7f${(hash32(x.type + k) % 0xffffff).toString(16)}, priority=${13 - k}, domain=${x.type.toLowerCase()}, deny=${x.result === "DROP"}`] : []), "");
  });
  const outName = r.route ? r.route.iface : null, st = ifStatus(d, inName);
  out.push("Result:", `input-interface: ${r.inIfn || longIf(inName)}`, `input-status: ${st.proto}`, `input-line-status: ${st.proto}`);
  if (r.verdict === "allow" && outName) out.push(`output-interface: ${nameifOf(d, outName)}`, `output-status: ${ifStatus(d, outName).proto}`, `output-line-status: ${ifStatus(d, outName).proto}`);
  if (r.verdict === "local") out.push("output-interface: NP Identity Ifc");
  out.push(`Action: ${r.verdict === "drop" ? "drop" : "allow"}`);
  if (r.verdict === "drop") out.push(`Drop-reason: ${r.reason}, Drop-location: frame 0x000055a1c2b3d4e5 flow (NA)/NA`);
  return out.join("\n");
}

// ======================================================================= show output helpers
function asaShowAcl(d, only) {
  const hits = rt(d).aclHits || {}, names = Object.keys(d.cfg.acls).filter(n => !only || n === only);
  if (only && !names.length) return `ERROR: access-list <${only}> does not exist`;
  const L = [`access-list cached ACL log flows: total 0, denied 0 (deny-flow-max 4096)`, `            alert-interval 300`];
  names.forEach(n => {
    const es = d.cfg.acls[n].entries; let line = 0;
    L.push(`access-list ${n}; ${es.filter(e => e.remark == null).length} elements; name hash: 0x${(hash32(n) >>> 0).toString(16).padStart(8, "0")}`);
    es.forEach(e => {
      line++;
      if (e.remark != null) { L.push(`access-list ${n} line ${line} remark ${e.remark}`); return; }
      L.push(`access-list ${n} line ${line} extended ${aceText(e, "asa")} (hitcnt=${hits[e.id] || 0}) 0x${(hash32(e.id) >>> 0).toString(16).padStart(8, "0")}`);
      const expand = a => a.obj && d.cfg.objects[a.obj] ? (o => o.type === "host" ? "host " + o.a : o.type === "subnet" ? `${o.a} ${o.b}` : `range ${o.a} ${o.b}`)(d.cfg.objects[a.obj]) : null;
      if (expand(e.src) || expand(e.dst)) L.push(`  access-list ${n} line ${line} extended ${e.action} ${e.proto} ${expand(e.src) || aceText(Object.assign({}, e, {proto: e.proto}), "asa").split(" ")[2]} ${expand(e.dst) || ""} (hitcnt=${hits[e.id] || 0}) 0x${(hash32(e.id + "x") >>> 0).toString(16).padStart(8, "0")}`);
    });
  });
  return L.join("\n");
}
const idle = t => { const s = Math.floor((Date.now() - t) / 1000); return `${Math.floor(s / 3600)}:${String(Math.floor(s / 60) % 60).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`; };
function asaStaticXlates(d) {
  return asaNatRules(d).filter(r => r.type === "static" && r.obj).map(r => ({kind: "static", proto: r.svc ? r.svc.proto : "ip", rIf: r.real, mIf: r.mapped, rIp: r.obj.a + (r.obj.type === "subnet" ? "/" + maskToLen(r.obj.b) : ""), mIp: (natMappedIp(d, r, r.obj.a) || "?") + (r.obj.type === "subnet" ? "/" + maskToLen(r.obj.b) : ""), rPort: r.svc ? r.svc.rport : null, mPort: r.svc ? r.svc.mport : null, born: Date.now(), last: Date.now()}));
}
function asaShowXlate(d) {
  const xs = [...asaStaticXlates(d), ...asaXl(d).filter(x => x.kind !== "static")];
  const L = [`${xs.length} in use, ${Math.max(xs.length, rt(d).xlMax || 0)} most used`, "Flags: D - DNS, e - extended, I - identity, i - dynamic, r - portmap,", "       s - static, T - twice, N - net-to-net"];
  rt(d).xlMax = Math.max(rt(d).xlMax || 0, xs.length);
  xs.forEach(x => {
    if (x.kind === "pat") L.push(`${x.proto.toUpperCase()} PAT from ${x.rIf}:${x.rIp}/${x.rPort} to ${x.mIf}:${x.mIp}/${x.mPort} flags ri idle ${idle(x.last)} timeout 0:00:30`);
    else if (x.rPort != null) L.push(`${x.proto.toUpperCase()} PAT from ${x.rIf}:${x.rIp} ${x.rPort}-${x.rPort} to ${x.mIf}:${x.mIp} ${x.mPort}-${x.mPort}\n    flags sr idle ${idle(x.last)} timeout 0:00:00`);
    else L.push(`NAT from ${x.rIf}:${x.rIp} to ${x.mIf}:${x.mIp}\n    flags ${x.kind === "static" ? "s" : "i"} idle ${idle(x.last)} timeout ${x.kind === "static" ? "0:00:00" : "3:00:00"}`);
  });
  return L.join("\n");
}
function asaShowConn(d, detail) {
  const cs = asaConns(d), L = [`${cs.length} in use, ${Math.max(cs.length, rt(d).connMax || 0)} most used`];
  if (detail) L.push("Flags: A - awaiting responder ACK to SYN, B - TCP probe for server, C - CTIQBE media,", "       D - DNS, d - dump, E - outside back connection, e - semi-distributed,", "       F - initiator FIN, f - responder FIN, I - inbound data, i - incomplete,", "       O - responder data, o - offloaded, U - up, X - inspected by service module", "");
  cs.forEach(c => {
    const out = c.outbound, fIf = out ? c.rIfn : c.iIfn, fIp = out ? c.dstR : c.srcR, fP = out ? c.dportR : c.sportR, lIf = out ? c.iIfn : c.rIfn, lIp = out ? c.srcR : c.dstR, lP = out ? c.sportR : c.dportR;
    if (c.proto === "icmp") L.push(`ICMP ${fIf}  ${fIp}:${c.sportM} ${lIf}  ${lIp}:${c.sportR}, idle ${idle(c.last)}, bytes ${c.bytes}, flags ${c.done ? "" : ""}`);
    else L.push(`${c.proto.toUpperCase()} ${fIf}  ${fIp}:${fP} ${lIf}  ${lIp}:${lP}, idle ${idle(c.last)}, bytes ${c.bytes}, flags ${c.proto === "tcp" ? "UO" : "-"}`);
  });
  return L.join("\n");
}
function asaShowNat(d, detail) {
  const rules = asaNatRules(d), hits = rt(d).natHits || {}, L = [];
  const s1 = rules.filter(r => r.sec === 1), s2 = rules.filter(r => r.sec === 2);
  if (s1.length) { L.push("Manual NAT Policies (Section 1)"); s1.forEach((r, k) => { L.push(`${k + 1} (${r.real}) to (${r.mapped}) source ${r.type} ${r.srcName} ${r.to}`, `    translate_hits = ${(hits[r.key] || {}).t || 0}, untranslate_hits = ${(hits[r.key] || {}).u || 0}`); }); L.push(""); }
  if (s2.length) { L.push("Auto NAT Policies (Section 2)"); s2.forEach((r, k) => { L.push(`${k + 1} (${r.real}) to (${r.mapped}) source ${r.type} ${r.name} ${r.to}${r.svc ? ` service ${r.svc.proto} ${ASA_PNAME[r.svc.rport] || r.svc.rport} ${ASA_PNAME[r.svc.mport] || r.svc.mport}` : ""}`, `    translate_hits = ${(hits[r.key] || {}).t || 0}, untranslate_hits = ${(hits[r.key] || {}).u || 0}`); if (detail) L.push(`    Source - Origin: ${r.obj.a}${r.obj.b ? "/" + (r.obj.type === "subnet" ? maskToLen(r.obj.b) : r.obj.b) : "/32"}, Translated: ${natMappedIp(d, r, r.obj.a) || "?"}/32`); }); }
  return L.join("\n");
}
