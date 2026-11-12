// ======================================================================= SHARED POLICY ENGINE
// Access lists (IOS + ASA syntax), NAT translation tables, device log buffers and an L2 reachability walk.
// Used by the IOS data path (24-engine hooks), OSPF (31) and the firewall (32–34).
const isFw = d => d && d.type === "firewall";

// ---- logging: every device keeps a buffer (show logging); IOS also prints to an open console
function devLog(d, msg, opts) {
  opts = opts || {};
  const r = rt(d), now = new Date();
  (r.log = r.log || []).push({t: now.getTime(), msg, sev: opts.sev == null ? 6 : opts.sev});
  if (r.log.length > 400) r.log.shift();
  if (opts.quiet) return;
  if (isFw(d)) { const lg = d.cfg.logging || {}; if (!lg.enable || lg.console == null || opts.sev > lg.console) return; }
  else if (d.cfg.loggingConsole === false) return;
  const w = typeof WINS !== "undefined" && WINS[d.id], T = w && w.term;
  if (!T || !T.stack.length || T.stack[0].dev !== d) return;
  T.print((isFw(d) ? asaStamp(now) + ": " : "") + msg + "\n"); T.refresh();
}
const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const asaStamp = t => `${MON[t.getMonth()]} ${String(t.getDate()).padStart(2, "0")} ${t.getFullYear()} ${t.toTimeString().slice(0, 8)}`;
const iosStamp = t => `*${MON[t.getMonth()]} ${String(t.getDate()).padStart(2, " ")} ${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, "0")}`;

// ---- layer 4 view of a packet (ICMP uses the echo id as its "port", like PAT does)
const ICMP_NAME = {echo: "echo", reply: "echo-reply", unreach: "unreachable", ttl: "time-exceeded"};
const ICMP_CODE = {echo: 8, reply: 0, unreach: 3, ttl: 11};
function l4(p) {
  if (p.proto === "tcp") return {sport: p.tcp.sport, dport: p.tcp.dport};
  if (p.proto === "udp") return {sport: p.udp.sport, dport: p.udp.dport};
  if (p.proto === "icmp") return {sport: p.icmp.id || 0, dport: p.icmp.id || 0};
  return {sport: 0, dport: 0};
}
function setPort(p, which, v) {
  if (p.proto === "tcp") p.tcp[which] = v; else if (p.proto === "udp") p.udp[which] = v; else if (p.proto === "icmp") p.icmp.id = v;
}
const isIcmpErr = p => p.proto === "icmp" && (p.icmp.type === "unreach" || p.icmp.type === "ttl");

// ---- port names (ASA shows names, IOS shows a smaller set)
const PORTS = {www: 80, http: 80, https: 443, ssh: 22, telnet: 23, domain: 53, ftp: 21, "ftp-data": 20, smtp: 25, pop3: 110, imap4: 143, ntp: 123, snmp: 161, tftp: 69, bootps: 67, bootpc: 68, ldap: 389, sqlnet: 1521, sip: 5060, rdp: 3389, nfs: 2049};
const ASA_PNAME = {80: "www", 443: "https", 22: "ssh", 23: "telnet", 53: "domain", 21: "ftp", 20: "ftp-data", 25: "smtp", 110: "pop3", 143: "imap4", 123: "ntp", 161: "snmp", 69: "tftp", 67: "bootps", 68: "bootpc", 389: "ldap", 1521: "sqlnet", 5060: "sip"};
const IOS_PNAME = {80: "www", 23: "telnet", 21: "ftp", 20: "ftp-data", 25: "smtp", 53: "domain", 110: "pop3", 67: "bootps", 68: "bootpc", 69: "tftp", 161: "snmp", 123: "ntp", 22: "22", 443: "443"};
const portNum = t => /^\d+$/.test(t) && +t <= 65535 ? +t : PORTS[String(t).toLowerCase()] != null ? PORTS[String(t).toLowerCase()] : null;
const ICMP_TYPES = {"echo": "echo", "echo-reply": "reply", "unreachable": "unreach", "time-exceeded": "ttl", "8": "echo", "0": "reply", "3": "unreach", "11": "ttl"};

// ---- ACL parsing. Returns {entry} or {err: tokenIndex, msg?}
// flavour "ios-std" | "ios-ext" | "asa". Address forms:
//   ios: any | host A | A W  (std: A alone = host)      asa: any | any4 | host A | A M | object N | interface IFN
function parseAce(toks, flavour, d) {
  let i = 0;
  const t = () => toks[i] != null ? String(toks[i]) : null, tl = () => (t() || "").toLowerCase();
  const e = {action: tl()};
  if (e.action !== "permit" && e.action !== "deny") return {err: i};
  i++;
  if (flavour === "ios-std") {
    const a = parseAddr("ios-std"); if (a.err != null) return a;
    e.proto = "ip"; e.src = a; e.dst = {any: true};
  } else {
    const pr = tl();
    const PR = {ip: "ip", tcp: "tcp", udp: "udp", icmp: "icmp", "6": "tcp", "17": "udp", "1": "icmp", "0": "ip"};
    if (!PR[pr]) return {err: i};
    e.proto = PR[pr]; i++;
    const s = parseAddr(flavour); if (s.err != null) return s; e.src = s;
    if (e.proto === "tcp" || e.proto === "udp") { const sp = parsePortOp(); if (sp && sp.err != null) return sp; if (sp) e.sport = sp; }
    const ds = parseAddr(flavour); if (ds.err != null) return ds; e.dst = ds;
    if (e.proto === "tcp" || e.proto === "udp") { const dp = parsePortOp(); if (dp && dp.err != null) return dp; if (dp) e.dport = dp; }
    if (e.proto === "icmp" && t() && ICMP_TYPES[tl()]) { e.icmp = ICMP_TYPES[tl()]; i++; }
    if (e.proto === "tcp" && tl() === "established" && flavour !== "asa") { e.est = true; i++; }
  }
  while (t()) {
    if (tl() === "log") { e.log = true; i++; if (flavour === "asa" && /^\d$|^(informational|warnings|notifications|debugging|errors|critical|alerts|emergencies)$/i.test(t() || "")) i++; continue; }
    if (tl() === "inactive" && flavour === "asa") { e.inactive = true; i++; continue; }
    return {err: i};
  }
  return {entry: e};

  function parseAddr(fl) {
    const w = tl();
    if (!w) return {err: i, msg: "incomplete"};
    if (w === "any" || (fl === "asa" && (w === "any4"))) { i++; return {any: true}; }
    if (w === "host") { i++; if (!isIp(t())) return {err: i}; const ip = t(); i++; return {host: ip}; }
    if (fl === "asa" && w === "object") { i++; const n = t(); if (!n) return {err: i}; if (d && !(d.cfg.objects || {})[n]) return {err: i, msg: `ERROR: specified object (${n}) does not exist`}; i++; return {obj: n}; }
    if (fl === "asa" && w === "interface") { i++; const n = t(); if (!n) return {err: i}; i++; return {ifn: n}; }
    if (isIp(t())) {
      const ip = t(); i++;
      if (fl === "ios-std") {
        if (isIp(t())) { const wc = t(); i++; return {ip: intToIp((ipToInt(ip) & ~ipToInt(wc)) >>> 0), wild: wc}; }
        return {host: ip};
      }
      if (!isIp(t())) return {err: i};
      const m = t(); i++;
      if (fl === "asa") { if (!isMask(m)) return {err: i - 1}; if (m === "255.255.255.255") return {host: ip}; return {ip: netOf(ip, m), mask: m}; }
      return m === "0.0.0.0" ? {host: ip} : {ip: intToIp((ipToInt(ip) & ~ipToInt(m)) >>> 0), wild: m};
    }
    return {err: i};
  }
  function parsePortOp() {
    const op = tl();
    if (!["eq", "lt", "gt", "neq", "range"].includes(op)) return null;
    i++;
    const a = portNum(t()); if (a == null) return {err: i}; i++;
    if (op !== "range") return {op, a};
    const b = portNum(t()); if (b == null) return {err: i}; i++;
    return {op, a, b};
  }
}
// textual form of an entry, for running-config and show access-list
function aceText(e, flavour) {
  if (e.remark != null) return "remark " + e.remark;
  const pn = flavour === "asa" ? (n => ASA_PNAME[n] || String(n)) : (n => IOS_PNAME[n] || String(n));
  const addr = a => a.any ? "any" : a.host ? (flavour === "ios-std" ? a.host : "host " + a.host) : a.obj ? "object " + a.obj : a.ifn ? "interface " + a.ifn : `${a.ip} ${a.mask || a.wild}`;
  const port = p => p ? (p.op === "range" ? ` range ${pn(p.a)} ${pn(p.b)}` : ` ${p.op} ${pn(p.a)}`) : "";
  if (flavour === "ios-std") return `${e.action} ${addr(e.src)}${e.log ? " log" : ""}`;
  return `${e.action} ${e.proto} ${addr(e.src)}${port(e.sport)} ${addr(e.dst)}${port(e.dport)}${e.icmp ? " " + Object.keys(ICMP_TYPES).find(k => ICMP_TYPES[k] === e.icmp && !/^\d/.test(k)) : ""}${e.est ? " established" : ""}${e.log ? " log" : ""}${e.inactive ? " inactive" : ""}`;
}
function addrMatch(a, ip, d) {
  if (!a || a.any) return true;
  if (a.host) return a.host === ip;
  if (a.wild) return ((ipToInt(ip) & ~ipToInt(a.wild)) >>> 0) === ((ipToInt(a.ip) & ~ipToInt(a.wild)) >>> 0);
  if (a.mask) return sameNet(ip, a.ip, a.mask);
  if (a.obj) { const o = (d.cfg.objects || {})[a.obj]; return !!o && objMatch(o, ip); }
  if (a.ifn) { const n = Object.keys(d.cfg.ifaces).find(k => d.cfg.ifaces[k].nameif === a.ifn); return !!n && d.cfg.ifaces[n].ip === ip; }
  return false;
}
function objMatch(o, ip) {
  if (o.type === "host") return o.a === ip;
  if (o.type === "subnet") return sameNet(ip, o.a, o.b);
  if (o.type === "range") { const n = ipToInt(ip); return n >= ipToInt(o.a) && n <= ipToInt(o.b); }
  return false;
}
const portOk = (p, v) => !p || (p.op === "eq" ? v === p.a : p.op === "lt" ? v < p.a : p.op === "gt" ? v > p.a : p.op === "neq" ? v !== p.a : v >= p.a && v <= p.b);
function aceMatch(e, p, d) {
  if (e.remark != null || e.inactive) return false;
  if (e.proto !== "ip" && e.proto !== p.proto) return false;
  if (!addrMatch(e.src, p.src, d) || !addrMatch(e.dst, p.dst, d)) return false;
  const L = l4(p);
  if (p.proto === "tcp" || p.proto === "udp") { if (!portOk(e.sport, L.sport) || !portOk(e.dport, L.dport)) return false; }
  if (e.icmp && p.proto === "icmp" && e.icmp !== p.icmp.type) return false;
  if (e.est && !(p.proto === "tcp" && p.tcp.flags !== "SYN")) return false;
  return true;
}
// evaluate an ACL: returns {permit, entry, idx}. A missing ACL permits everything (IOS behaviour).
function aclEval(d, name, p) {
  const acl = (d.cfg.acls || {})[name];
  if (!acl) return {permit: true, missing: true};
  const list = acl.entries || acl;
  for (let k = 0; k < list.length; k++) {
    const e = list[k];
    if (aceMatch(e, p, d)) {
      const h = rt(d).aclHits || (rt(d).aclHits = {});
      h[e.id] = (h[e.id] || 0) + 1;
      return {permit: e.action === "permit", entry: e, idx: k};
    }
  }
  return {permit: false, implicit: true};
}
let ACE_ID = 1;
const newAceId = () => "ace" + (Date.now().toString(36)) + (ACE_ID++);

// ---- NAT translation table (runtime). One entry per flow or per static mapping.
// {proto, rIp, rPort, mIp, mPort, oIp, oPort, kind: "static"|"dynamic"|"pat", rIf, mIf, born, last, hits}
function xlates(d) { const r = rt(d); return r.xl || (r.xl = []); }
function patPort(d, mIp, proto, want) {
  const used = new Set(xlates(d).filter(x => x.mIp === mIp && x.proto === proto).map(x => x.mPort));
  if (!used.has(want)) return want;
  for (let k = 1024; k < 65535; k++) if (!used.has(k)) return k;
  return want;
}
function xlateAdd(d, x) { x.born = x.last = Date.now(); x.hits = 1; xlates(d).push(x); if (xlates(d).length > 500) xlates(d).shift(); return x; }

// ---- L2 walk: which layer-3 interfaces share a broadcast domain with this one?
// Follows cables through switches (VLANs, trunks, native VLAN, STP blocking), hubs and APs.
function l2Peers(d, ifo) {
  const out = [], seen = new Set();
  const emitFrom = (dev, port, tag) => {
    const o = linkAt(dev, port);
    if (!o || !physUp(dev, port) || o.l.cable === "console") return;
    if (portKind(port) === "serial" && !serialProtoUp(dev, port)) return;
    if (isSwitch(dev) && stpBlocked(dev, port)) return;
    arrive(o.dev, o.port, tag);
  };
  const floodVlan = (dev, vlan, except) => {
    const k = dev.id + "|v" + vlan; if (seen.has(k)) return; seen.add(k);
    const svi = l3Ifaces(dev).find(x => x.svi && x.vlan === vlan && x.up && x.ip);
    if (svi && !(dev === d && ifo.svi && ifo.vlan === vlan)) out.push({dev, ifo: svi});
    allPorts(dev).forEach(p => {
      if (p === except || p === "Console" || !isSwitchport(dev, p) || !linkAt(dev, p) || !portCarries(dev, p, vlan) || stpBlocked(dev, p)) return;
      const i = dev.cfg.ifaces[p];
      emitFrom(dev, p, operTrunk(dev, p) && vlan !== (i.nativeVlan || 1) ? vlan : null);
    });
  };
  const arrive = (dev, port, tag) => {
    const k = dev.id + "|" + port + "|" + tag; if (seen.has(k)) return; seen.add(k);
    if (isSwitch(dev) && isSwitchport(dev, port)) {
      if (stpBlocked(dev, port)) return;
      const i = dev.cfg.ifaces[port]; let vlan;
      if (operTrunk(dev, port)) { vlan = tag || i.nativeVlan || 1; if (!vlanListHas(i.allowed, vlan)) return; }
      else { if (tag) return; vlan = i.accessVlan || 1; }
      if (!dev.cfg.vlans[vlan]) return;
      floodVlan(dev, vlan, port);
      return;
    }
    if (["hub", "ap", "cloud", "wlc"].includes(dev.type)) { allPorts(dev).filter(p => p !== port && portKind(p) === "eth" && linkAt(dev, p)).forEach(p => emitFrom(dev, p, tag)); return; }
    const hit = l3Ifaces(dev).find(x => x.port === port && x.ip && x.up && (tag ? x.tag === tag && !x.native : (!x.tag || x.native)));
    if (hit && !(dev === d && hit.name === ifo.name)) out.push({dev, ifo: hit});
  };
  if (ifo.svi) floodVlan(d, ifo.vlan, null);
  else if (ifo.port) emitFrom(d, ifo.port, ifo.tag && !ifo.native ? ifo.tag : null);
  return out;
}
