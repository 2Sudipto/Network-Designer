// ======================================================================= NETWORK ENGINE
// A teaching simulator: real ARP, MAC learning, VLAN tagging, STP blocking, routing, ICMP, DHCP, DNS.
// Packets are processed synchronously; every hop is logged as an event so Simulation mode can replay it.
const RT = {};                      // runtime tables per device id (never saved)
const BCAST = "ffff.ffff.ffff";
function rt(d) { return RT[d.id] || (RT[d.id] = {arp: {}, mac: {}, leases: {}, lease: null, stats: {}}); }
function resetRuntime(d) { if (d) delete RT[d.id]; else for (const k in RT) delete RT[k]; netDirty(); }
let STP_CACHE = null;
function netDirty() { STP_CACHE = null; }
function onTopologyChange() {
  netDirty();
  // pulling a cable clears what was learned through it
  for (const id in RT) { const r = RT[id]; r.mac = {}; }
  autoDhcp(600);
}

// ---- links and port state
function linkAt(d, port) {
  const l = S.links.find(x => (x.a === d.id && x.pa === port) || (x.b === d.id && x.pb === port));
  if (!l) return null;
  const mine = l.a === d.id, o = byId(mine ? l.b : l.a);
  return o ? {l, dev: o, port: mine ? l.pb : l.pa, dce: isDCE(l, mine)} : null;
}
function isDCE(l, aEnd) { const c = l.cable; if (c === "serialDCE" || c === "serial") return aEnd; if (c === "serialDTE") return !aEnd; return false; }
function wirelessPeers(d) { return S.links.filter(l => l.cable === "wireless" && (l.a === d.id || l.b === d.id)).map(l => ({l, dev: byId(l.a === d.id ? l.b : l.a), port: "Wireless0"})); }
function adminUp(d, port) {
  if (!isIOS(d)) return true;
  const i = d.cfg.ifaces[port]; return !(i && i.shutdown);
}
function physUp(d, port) {
  const o = linkAt(d, port); if (!o) return false;
  if (o.l.cable === "console") return false;
  if (!cableFits(o.l)) return false;
  return adminUp(d, port) && adminUp(o.dev, o.port);
}
function serialProtoUp(d, port) {
  const o = linkAt(d, port); if (!o) return false;
  const dceDev = o.dce ? d : o.dev, dcePort = o.dce ? port : o.port;
  const i = isIOS(dceDev) && dceDev.cfg.ifaces[dcePort];
  return !!(i && i.clock);
}
function ifStatus(d, n) {
  if (!isIOS(d)) return {status: "up", proto: "up"};
  const i = d.cfg.ifaces[n];
  if (!i) return {status: "down", proto: "down"};
  if (i.shutdown) return {status: "administratively down", proto: "down"};
  if (/^Loopback/.test(n)) return {status: "up", proto: "up"};
  if (/\.\d+$/.test(n)) { const p = ifStatus(d, parentIf(n)); return p.status === "up" ? {status: "up", proto: p.proto} : {status: p.status === "administratively down" ? "down" : p.status, proto: "down"}; }
  if (/^Vlan\d+$/.test(n)) {
    const v = +n.slice(4);
    if (!isSwitch(d) || !d.cfg.vlans[v]) return {status: "down", proto: "down"};
    const any = allPorts(d).some(p => p !== "Console" && isSwitchport(d, p) && physUp(d, p) && !stpBlocked(d, p) && portCarries(d, p, v));
    return any ? {status: "up", proto: "up"} : {status: "down", proto: "down"};
  }
  if (!physUp(d, n)) return {status: "down", proto: "down"};
  if (portKind(n) === "serial" && !serialProtoUp(d, n)) return {status: "up", proto: "down"};
  return {status: "up", proto: "up"};
}
const ifUp = (d, n) => ifStatus(d, n).proto === "up";

// ---- switchports
const isSwitchport = (d, p) => isSwitch(d) && !isVirtualIf(p) && !(d.cfg.ifaces[p] && d.cfg.ifaces[p].routed);
function operTrunk(d, p) {
  const i = d.cfg.ifaces[p]; if (!i) return false;
  if (i.mode === "trunk") return true;
  if (i.mode === "dynamic") { const o = linkAt(d, p); return !!(o && isSwitch(o.dev) && isSwitchport(o.dev, o.port) && o.dev.cfg.ifaces[o.port] && o.dev.cfg.ifaces[o.port].mode === "trunk"); }
  return false;
}
function vlanListHas(list, v) {
  if (list === "all") return true; if (list === "none") return false;
  return String(list).split(",").some(x => { const [a, b] = x.split("-").map(Number); return b ? v >= a && v <= b : v === a; });
}
function portCarries(d, p, v) {
  const i = d.cfg.ifaces[p]; if (!i) return false;
  return operTrunk(d, p) ? vlanListHas(i.allowed, v) && !!d.cfg.vlans[v] : (i.accessVlan || 1) === v;
}

// ---- spanning tree (one instance, like CST): root bridge, root ports, designated ports, blocking
const portCost = p => /^(Te|Twe|Hu)/i.test(p) ? 2 : /^(G|Gi)/i.test(p) ? 4 : 19;
function bridgeId(d) { return [d.cfg.stpPriority || 32768, macOf(d, "bridge")]; }
const bidStr = b => String(b[0]).padStart(5, "0") + b[1];
function computeStp() {
  const sws = S.devices.filter(isSwitch), res = {root: null, info: {}};
  if (!sws.length) return res;
  // switch-to-switch segments that are physically up
  const edges = [];
  S.links.forEach(l => {
    const a = byId(l.a), b = byId(l.b);
    if (!a || !b || !isSwitch(a) || !isSwitch(b)) return;
    if (!isSwitchport(a, l.pa) || !isSwitchport(b, l.pb) || !physUp(a, l.pa)) return;
    edges.push({a, pa: l.pa, b, pb: l.pb});
  });
  // each connected group of switches elects its own root
  const seen = new Set();
  sws.forEach(s0 => {
    if (seen.has(s0.id)) return;
    const comp = [], q = [s0]; seen.add(s0.id);
    while (q.length) { const s = q.shift(); comp.push(s); edges.forEach(e => { const o = e.a === s ? e.b : e.b === s ? e.a : null; if (o && !seen.has(o.id)) { seen.add(o.id); q.push(o); } }); }
    const root = comp.reduce((m, s) => bidStr(bridgeId(s)) < bidStr(bridgeId(m)) ? s : m);
    const cost = {}; comp.forEach(s => { cost[s.id] = Infinity; }); cost[root.id] = 0;
    for (let k = 0; k < comp.length; k++) edges.forEach(e => {
      if (cost[e.a.id] + portCost(e.pb) < cost[e.b.id]) cost[e.b.id] = cost[e.a.id] + portCost(e.pb);
      if (cost[e.b.id] + portCost(e.pa) < cost[e.a.id]) cost[e.a.id] = cost[e.b.id] + portCost(e.pa);
    });
    const info = {};
    comp.forEach(s => { info[s.id] = {root: root.id, cost: cost[s.id], rootPort: null, ports: {}}; });
    // root port: lowest (cost via neighbor, neighbor BID, neighbor port)
    comp.forEach(s => {
      if (s === root) return;
      let best = null;
      edges.forEach(e => {
        const mine = e.a === s ? {p: e.pa, o: e.b, op: e.pb} : e.b === s ? {p: e.pb, o: e.a, op: e.pa} : null; if (!mine) return;
        const key = [cost[mine.o.id] + portCost(mine.p), bidStr(bridgeId(mine.o)), allPorts(mine.o).indexOf(mine.op), allPorts(s).indexOf(mine.p)];
        if (!best || cmpT(key, best.key) < 0) best = {key, p: mine.p};
      });
      if (best) info[s.id].rootPort = best.p;
    });
    edges.forEach(e => {
      if (!info[e.a.id]) return;
      const ka = [cost[e.a.id], bidStr(bridgeId(e.a)), allPorts(e.a).indexOf(e.pa)], kb = [cost[e.b.id], bidStr(bridgeId(e.b)), allPorts(e.b).indexOf(e.pb)];
      const aDesig = cmpT(ka, kb) < 0;
      const role = (s, p, desig) => info[s.id].rootPort === p ? "Root" : desig ? "Desg" : "Altn";
      info[e.a.id].ports[e.pa] = role(e.a, e.pa, aDesig);
      info[e.b.id].ports[e.pb] = role(e.b, e.pb, !aDesig);
    });
    Object.assign(res.info, info);
  });
  return res;
}
function cmpT(x, y) { for (let i = 0; i < Math.max(x.length, y.length); i++) { if (x[i] === y[i]) continue; if (x[i] == null) return -1; if (y[i] == null) return 1; return x[i] < y[i] ? -1 : 1; } return 0; }
function stp() { return STP_CACHE || (STP_CACHE = computeStp()); }
function stpBlocked(d, p) { if (!isSwitch(d)) return false; const i = stp().info[d.id]; return !!(i && i.ports[p] === "Altn"); }

// ---- layer 3 interfaces
function hostAddr(d) {
  const h = d.host || {};
  if (h.dhcp) { const l = rt(d).lease; return l ? {ip: l.ip, mask: l.mask, gw: l.gw, dns: l.dns, dhcp: true} : {ip: "", mask: "", gw: "", dns: "", dhcp: true}; }
  return {ip: h.ip, mask: h.mask, gw: h.gw, dns: h.dns};
}
function hostPort(d) {
  const ports = allPorts(d);
  const wl = wirelessPeers(d); if (wl.length) return "Wireless0";
  return ports.find(p => portKind(p) === "eth" && linkAt(d, p)) || ports.find(p => portKind(p) === "eth") || ports[0];
}
function l3Ifaces(d) {
  if (isHost(d)) { const a = hostAddr(d), p = hostPort(d); return [{name: p, ip: a.ip, mask: a.mask, mac: macOf(d, p), port: p, up: true}]; }
  if (!isIOS(d)) return [];
  const out = [];
  for (const [n, i] of Object.entries(d.cfg.ifaces)) {
    if (!i.ip && !/\.\d+$/.test(n)) continue;
    if (isSwitch(d) && !isVirtualIf(n) && !i.routed) continue;
    const o = {name: n, ip: i.ip, mask: i.mask, mac: macOf(d, n), up: ifUp(d, n)};
    if (/^Vlan/.test(n)) { o.vlan = +n.slice(4); o.svi = true; }
    else if (/\.\d+$/.test(n)) { o.port = parentIf(n); o.tag = i.dot1q || null; o.native = !!i.dot1qNative; o.mac = macOf(d, parentIf(n)); }
    else if (/^Loopback/.test(n)) o.loop = true;
    else o.port = n;
    out.push(o);
  }
  return out;
}
const myIps = d => l3Ifaces(d).filter(i => i.ip).map(i => i.ip);
function ownerOfIp(ip) { return S.devices.find(d => myIps(d).includes(ip)); }

// ---- routing table
function routeTable(d) {
  const out = [];
  if (isHost(d)) {
    const a = hostAddr(d), p = hostPort(d);
    if (a.ip && a.mask) out.push({code: "C", net: netOf(a.ip, a.mask), mask: a.mask, iface: p});
    if (a.gw) out.push({code: "S*", net: "0.0.0.0", mask: "0.0.0.0", nh: a.gw, ad: 1});
    return out;
  }
  if (!isIOS(d)) return out;
  const c = d.cfg;
  l3Ifaces(d).filter(i => i.ip && i.up).forEach(i => {
    out.push({code: "C", net: netOf(i.ip, i.mask), mask: i.mask, iface: i.name});
    if (isRouterish(d) || c.ipRouting) out.push({code: "L", net: i.ip, mask: "255.255.255.255", iface: i.name});
  });
  if (!(isRouterish(d) || c.ipRouting)) {
    if (c.defaultGateway) out.push({code: "S*", net: "0.0.0.0", mask: "0.0.0.0", nh: c.defaultGateway, ad: 1, gwOnly: true});
    return out;
  }
  const conn = out.slice();
  const viaConnected = nh => conn.find(r => r.code === "C" && sameNet(nh, r.net, r.mask));
  c.routes.forEach(r => {
    if (r.iface) { const n = r.iface; if (ifUp(d, n)) out.push({code: r.net === "0.0.0.0" && r.mask === "0.0.0.0" ? "S*" : "S", net: r.net, mask: r.mask, iface: n, ad: r.ad || 1}); return; }
    // recursive next hop: resolvable through a connected (or earlier static) route
    let ok = viaConnected(r.nh);
    if (!ok) ok = c.routes.some(x => x !== r && x.nh && viaConnected(x.nh) && sameNet(r.nh, x.net, x.mask));
    if (ok) out.push({code: r.net === "0.0.0.0" && r.mask === "0.0.0.0" ? "S*" : "S", net: r.net, mask: r.mask, nh: r.nh, ad: r.ad || 1});
  });
  // lower AD wins for the same prefix
  const best = {};
  out.forEach(r => { const k = r.net + "/" + r.mask + r.code[0]; if (r.code[0] !== "S") return; if (!best[r.net + "/" + r.mask] || r.ad < best[r.net + "/" + r.mask].ad) best[r.net + "/" + r.mask] = r; });
  return out.filter(r => r.code[0] !== "S" || best[r.net + "/" + r.mask] === r || best[r.net + "/" + r.mask].ad === r.ad);
}
function lookup(d, dst) {
  let best = null;
  for (const r of routeTable(d)) {
    if (!sameNet(dst, r.net, r.mask)) continue;
    const len = maskToLen(r.mask);
    if (!best || len > best.len) best = Object.assign({len}, r);
  }
  if (!best) return null;
  // resolve next hop to an exit interface
  if (!best.iface) {
    const via = routeTable(d).filter(r => r.code === "C" && sameNet(best.nh, r.net, r.mask))[0];
    if (!via) { const rec = lookup(d, best.nh); if (!rec || rec.nh === best.nh) return null; return {iface: rec.iface, nh: rec.nh || best.nh, route: best}; }
    return {iface: via.iface, nh: best.nh, route: best};
  }
  return {iface: best.iface, nh: best.code === "C" ? dst : (best.nh || dst), route: best};
}

// ---- event log (for Simulation mode)
let EVLOG = null, NOW = 0, CUR = null;
function logEv(e) { if (EVLOG) EVLOG.push(e); return e; }
function note(txt) { if (CUR && CUR.notes) CUR.notes.push(txt); }
const ipLabel = f => f.type === "arp" ? "ARP" : f.ip.proto === "icmp" ? "ICMP" : f.ip.udp && f.ip.udp.dhcp ? "DHCP" : f.ip.udp && f.ip.udp.dns ? "DNS" : f.ip.proto === "tcp" ? (f.ip.tcp.dport === 23 || f.ip.tcp.sport === 23 ? "Telnet" : f.ip.tcp.dport === 22 || f.ip.tcp.sport === 22 ? "SSH" : f.ip.tcp.dport === 80 || f.ip.tcp.sport === 80 ? "HTTP" : "TCP") : "IP";
const clone = o => JSON.parse(JSON.stringify(o));

// ---- layer 2: put a frame on a cable
function emit(d, port, frame) {
  if (frame.hops > 40) return;
  const t0 = NOW;
  let peers;
  if (port === "Wireless0" || (d.type === "ap" && port === "wireless")) peers = wirelessPeers(d);
  else { const o = linkAt(d, port); peers = o ? [o] : []; }
  for (const o of peers) {
    NOW = t0 + 1;
    const f = clone(frame); f.hops = (frame.hops || 0) + 1;
    const ev = logEv({t: NOW, from: d.id, fromPort: port, to: o.dev.id, toPort: o.port, kind: ipLabel(f), frame: clone(f), notes: [], drop: ""});
    if (o.l.cable !== "wireless" && !physUp(d, port)) { ev.drop = "link down"; continue; }
    if (portKind(port) === "serial" && !serialProtoUp(d, port)) { ev.drop = "serial line protocol down (clock rate missing on the DCE end?)"; continue; }
    if (isSwitch(d) && stpBlocked(d, port)) { ev.drop = "port blocked by STP"; continue; }
    const prev = CUR; CUR = ev;
    receive(o.dev, o.port, f);
    CUR = prev;
  }
}
function receive(d, port, f) {
  if (isSwitch(d) && isSwitchport(d, port)) return switchIn(d, port, f);
  if (d.type === "hub" || d.type === "ap" || d.type === "cloud" || d.type === "wlc") {
    note(`${TYPES[d.type].label}: repeats the frame out of every other port`);
    const t0 = NOW;
    const ports = [...allPorts(d).filter(p => p !== port && portKind(p) === "eth" && linkAt(d, p)), ...(d.type === "ap" && port !== "wireless" && wirelessPeers(d).length ? ["wireless"] : [])];
    ports.forEach(p => { NOW = t0; emit(d, p, f); });
    return;
  }
  // routers, routed ports, hosts
  let iface;
  if (isHost(d)) iface = l3Ifaces(d)[0];
  else {
    const ifs = l3Ifaces(d).filter(i => i.port === port);
    iface = f.tag ? ifs.find(i => i.tag === f.tag && !i.native) : ifs.find(i => !i.tag || i.native);
    if (!iface) { if (CUR) CUR.drop = f.tag ? `no sub-interface for VLAN ${f.tag} on ${port}` : `${port} has no IP address`; return; }
    if (!iface.up) { if (CUR) CUR.drop = `${iface.name} is down`; return; }
  }
  if (f.dst !== BCAST && f.dst !== iface.mac && f.dst !== "serial") { if (CUR) CUR.drop = "frame not addressed to this device"; return; }
  l3In(d, iface, f);
}
function switchIn(d, port, f) {
  const r = rt(d), i = d.cfg.ifaces[port];
  if (stpBlocked(d, port)) { if (CUR) CUR.drop = "port blocked by STP"; return; }
  let vlan;
  if (operTrunk(d, port)) { vlan = f.tag || i.nativeVlan || 1; if (!vlanListHas(i.allowed, vlan)) { if (CUR) CUR.drop = `VLAN ${vlan} not allowed on trunk ${port}`; return; } }
  else { if (f.tag) { if (CUR) CUR.drop = `tagged frame arrived on access port ${port}`; return; } vlan = i.accessVlan || 1; }
  if (!d.cfg.vlans[vlan]) { if (CUR) CUR.drop = `VLAN ${vlan} does not exist on ${d.name}`; return; }
  r.mac[vlan + "|" + f.src] = {port, vlan, mac: f.src};
  note(`${d.name} learns ${f.src} on ${port} (VLAN ${vlan})`);
  const svi = l3Ifaces(d).find(x => x.svi && x.vlan === vlan && x.up);
  const g = Object.assign({}, f, {tag: null});
  if (svi && (f.dst === svi.mac || f.dst === BCAST)) { const prev = CUR; l3In(d, svi, g); CUR = prev; if (f.dst === svi.mac) return; }
  switchOut(d, vlan, g, port);
}
function switchOut(d, vlan, f, inPort) {
  const r = rt(d), known = f.dst !== BCAST && r.mac[vlan + "|" + f.dst];
  const out = known ? (known.port !== inPort ? [known.port] : []) :
    allPorts(d).filter(p => p !== inPort && p !== "Console" && isSwitchport(d, p) && linkAt(d, p) && portCarries(d, p, vlan));
  note(known ? `MAC ${f.dst} is on ${known.port}: forward there` : `${f.dst === BCAST ? "Broadcast" : "Unknown destination"}: flood VLAN ${vlan}`);
  const t0 = NOW;
  out.forEach(p => {
    const i = d.cfg.ifaces[p];
    const tag = operTrunk(d, p) && vlan !== (i.nativeVlan || 1) ? vlan : null;
    NOW = t0; emit(d, p, Object.assign({}, f, {tag}));
  });
}
// send a frame from a layer 3 interface
function l2Send(d, iface, f) {
  f.src = iface.mac;
  if (iface.svi) { const t = NOW; switchOut(d, iface.vlan, f, null); NOW = t; return; }
  if (iface.tag && !iface.native) f.tag = iface.tag;
  emit(d, iface.port, f);
}

// ---- ARP
function arpResolve(d, iface, ip) {
  const r = rt(d);
  if (portKind(iface.port || "") === "serial") return "serial";
  if (r.arp[ip]) return r.arp[ip].mac;
  logNote(d, `ARP: who has ${ip}? (asking from ${iface.name})`);
  l2Send(d, iface, {type: "arp", dst: BCAST, arp: {op: "request", sip: iface.ip, smac: iface.mac, tip: ip, tmac: "0000.0000.0000"}});
  return r.arp[ip] ? r.arp[ip].mac : null;
}
function logNote(d, txt) { if (EVLOG) EVLOG.push({t: NOW, at: d.id, kind: "note", notes: [txt]}); }
function l3In(d, iface, f) {
  const r = rt(d);
  if (f.type === "arp") {
    const a = f.arp;
    if (a.tip === iface.ip || a.op === "reply") {
      r.arp[a.sip] = {mac: a.smac, iface: iface.name, age: 0};
      note(`${d.name} adds ${a.sip} → ${a.smac} to its ARP table`);
    }
    if (a.op === "request" && a.tip === iface.ip) {
      note(`${d.name} owns ${a.tip}: sends an ARP reply`);
      l2Send(d, iface, {type: "arp", dst: a.smac, arp: {op: "reply", sip: iface.ip, smac: iface.mac, tip: a.sip, tmac: a.smac}});
    } else if (a.op === "request") note(`${d.name} is not ${a.tip}: ignores the ARP request`);
    return;
  }
  const p = f.ip;
  const mine = myIps(d).includes(p.dst) || p.dst === "255.255.255.255" || (iface.ip && iface.mask && p.dst === bcastOf(iface.ip, iface.mask));
  if (p.udp && p.udp.dhcp) return dhcpIn(d, iface, f);
  if (mine) return deliver(d, iface, p);
  if (isHost(d) || !(isRouterish(d) || d.cfg.ipRouting)) { if (CUR) CUR.drop = `${d.name} is not a router: drops a packet for ${p.dst}`; return; }
  forward(d, iface, p);
}
function forward(d, inIf, p) {
  p.ttl--;
  if (p.ttl <= 0) { note(`TTL expired at ${d.name}: ICMP time exceeded back to ${p.src}`); ipOut(d, {src: inIf.ip, dst: p.src, ttl: 255, proto: "icmp", icmp: {type: "ttl", id: p.icmp ? p.icmp.id : 0, seq: p.icmp ? p.icmp.seq : 0}}); return; }
  const rt0 = lookup(d, p.dst);
  if (!rt0) { note(`${d.name} has no route to ${p.dst}: sends ICMP unreachable`); if (CUR) CUR.drop = `no route to ${p.dst}`; ipOut(d, {src: inIf.ip, dst: p.src, ttl: 255, proto: "icmp", icmp: {type: "unreach", id: p.icmp ? p.icmp.id : 0}}); return; }
  note(`${d.name} routing table: ${p.dst} → ${rt0.route.code} ${rt0.route.net}/${maskToLen(rt0.route.mask)} via ${rt0.nh === p.dst ? "directly connected" : rt0.nh} out ${rt0.iface}`);
  sendVia(d, rt0, p);
}
// send an IP packet out of the interface chosen by a route
function sendVia(d, route, p) {
  const iface = l3Ifaces(d).find(i => i.name === route.iface);
  if (!iface || !iface.up) { if (CUR) CUR.drop = `${route.iface} is down`; return false; }
  if (iface.loop) return false;
  const had = !!rt(d).arp[route.nh] || portKind(iface.port || "") === "serial";
  const mac = arpResolve(d, iface, route.nh);
  if (!mac) { note(`ARP for ${route.nh} got no reply: packet dropped`); return false; }
  // a router drops the packet that made it ARP (that's why the first ping is often ".")
  if (!had) { logNote(d, `${d.name} had to ARP for ${route.nh} first: this packet is dropped`); return false; }
  l2Send(d, iface, {type: "ip", dst: mac, ip: p});
  return true;
}
// originate a packet from this device
function ipOut(d, p) {
  if (p.dst === "255.255.255.255") { const i = l3Ifaces(d)[0]; if (!i) return false; if (!p.src) p.src = i.ip || "0.0.0.0"; l2Send(d, i, {type: "ip", dst: BCAST, ip: p}); return true; }
  const rt0 = lookup(d, p.dst);
  if (!rt0) { if (CUR) CUR.drop = `${d.name} has no route to ${p.dst}`; logNote(d, `${d.name}: no route to ${p.dst}${isHost(d) ? " (check the default gateway)" : ""}`); return false; }
  const iface = l3Ifaces(d).find(i => i.name === rt0.iface);
  if (!p.src) p.src = iface ? iface.ip : "";
  logNote(d, `${d.name} sends ${p.proto.toUpperCase()} to ${p.dst} via ${rt0.nh === p.dst ? "directly connected network" : "next hop " + rt0.nh} out ${rt0.iface}`);
  const r = rt(d);
  const hadArp = !!r.arp[rt0.nh] || portKind(rt0.iface) === "serial";
  const mac = iface && iface.up ? arpResolve(d, iface, rt0.nh) : null;
  if (!mac) { logNote(d, `${d.name}: ${iface && !iface.up ? rt0.iface + " is down" : "ARP for " + rt0.nh + " failed"}`); return false; }
  // IOS drops the packet that triggered ARP; PCs hold it until the reply arrives
  if (!hadArp && isIOS(d) && p.proto === "icmp" && p.icmp.type === "echo") { logNote(d, `${d.name} needed ARP first: this echo is dropped (".")`); return false; }
  l2Send(d, iface, {type: "ip", dst: mac, ip: p});
  return true;
}

// ---- local delivery
let WAIT = null;     // what the originating device is waiting for
function deliver(d, iface, p) {
  if (p.proto === "icmp") {
    const ic = p.icmp;
    if (ic.type === "echo") { note(`${d.name} answers the echo request`); ipOut(d, {src: p.dst === "255.255.255.255" ? iface.ip : p.dst, dst: p.src, ttl: 255, proto: "icmp", icmp: {type: "reply", id: ic.id, seq: ic.seq}}); return; }
    if (WAIT && WAIT.dev === d.id && ic.id === WAIT.id) { WAIT.res = ic.type; WAIT.from = p.src; WAIT.ttl = p.ttl; note(`${d.name} receives ICMP ${ic.type === "reply" ? "echo reply" : ic.type === "ttl" ? "time exceeded" : "unreachable"} from ${p.src}`); }
    return;
  }
  if (p.proto === "udp" && p.udp.dns) {
    if (p.udp.dns.q && d.svc && d.svc.dns.on) {
      const rec = d.svc.dns.records.find(x => x.name.toLowerCase() === p.udp.dns.q.toLowerCase());
      note(`DNS server ${d.name}: ${rec ? p.udp.dns.q + " is " + rec.ip : "no record for " + p.udp.dns.q}`);
      ipOut(d, {src: p.dst, dst: p.src, ttl: 255, proto: "udp", udp: {sport: 53, dport: p.udp.sport, dns: {a: rec ? rec.ip : null, name: p.udp.dns.q, id: p.udp.dns.id}}});
    } else if (p.udp.dns.q) { if (CUR) CUR.drop = `${d.name} is not running a DNS server`; }
    else if (WAIT && WAIT.dev === d.id && WAIT.id === p.udp.dns.id) { WAIT.res = "dns"; WAIT.answer = p.udp.dns.a; }
    return;
  }
  if (p.proto === "tcp") {
    const t = p.tcp;
    if (t.flags === "SYN") {
      const ok = tcpListening(d, t.dport);
      note(ok ? `${d.name} is listening on TCP ${t.dport}: SYN-ACK` : `${d.name} is not listening on TCP ${t.dport}: RST`);
      ipOut(d, {src: p.dst, dst: p.src, ttl: 255, proto: "tcp", tcp: {sport: t.dport, dport: t.sport, flags: ok ? "SYN-ACK" : "RST", id: t.id}});
    } else if (WAIT && WAIT.dev === d.id && WAIT.id === t.id) { WAIT.res = t.flags; WAIT.from = p.src; }
  }
}
function tcpListening(d, port) {
  if (isIOS(d)) { const tr = d.cfg.lines.vty.transport; if (port === 23) return tr === "all" || /telnet/.test(tr); if (port === 22) return (tr === "all" || /ssh/.test(tr)) && d.cfg.ssh.keyBits > 0; return false; }
  if (d.svc && port === 80) return d.svc.http.on;
  return false;
}

// ---- DHCP
function dhcpIn(d, iface, f) {
  const p = f.ip, m = p.udp.dhcp;
  if (m.op === "offer" || m.op === "ack") {
    // relay agent passing the reply back to the client's segment
    if (!isHost(d) && myIps(d).includes(p.dst) && m.relayIf) {
      const out = l3Ifaces(d).find(i => i.name === m.relayIf);
      note(`${d.name} relays the DHCP ${m.op.toUpperCase()} back to the client`);
      if (out) l2Send(d, out, {type: "ip", dst: m.chaddr, ip: Object.assign({}, p, {src: out.ip, dst: "255.255.255.255"})});
      return;
    }
    if (isHost(d) && m.chaddr === iface.mac && WAIT && WAIT.dev === d.id) { WAIT.res = m.op; WAIT.offer = m; note(`${d.name} gets DHCP ${m.op.toUpperCase()}: ${m.yiaddr}`); }
    return;
  }
  // discover / request
  const server = dhcpServe(d, iface, m, p);
  if (server) return;
  if (!isHost(d) && isIOS(d) && (d.cfg.ifaces[iface.name] || {}).helper && d.cfg.ifaces[iface.name].helper.length && !m.giaddr) {
    const h = d.cfg.ifaces[iface.name].helper[0];
    note(`${d.name} has ip helper-address ${h}: relays the DHCP ${m.op.toUpperCase()} as unicast`);
    ipOut(d, {src: iface.ip, dst: h, ttl: 255, proto: "udp", udp: {sport: 67, dport: 67, dhcp: Object.assign({}, m, {giaddr: iface.ip, relayIf: iface.name})}});
  } else if (p.dst !== "255.255.255.255" && !myIps(d).includes(p.dst)) forward(d, iface, p);
}
function dhcpServe(d, iface, m, p) {
  let pool = null;
  const net = m.giaddr || iface.ip;
  if (isIOS(d)) {
    const entry = Object.entries(d.cfg.dhcp.pools).find(([, x]) => x.network && net && sameNet(net, x.network, x.mask));
    if (entry) pool = {name: entry[0], network: entry[1].network, mask: entry[1].mask, gw: entry[1].gw || "", dns: entry[1].dns || "", excluded: d.cfg.dhcp.excluded};
  } else if (d.svc && d.svc.dhcp.on) {
    const x = d.svc.dhcp.pools.find(q => q.start && net && sameNet(net, q.start, q.mask)) || (!m.giaddr && d.svc.dhcp.pools[0]);
    if (x && x.start) pool = {name: x.name, network: netOf(x.start, x.mask), mask: x.mask, gw: x.gw !== "0.0.0.0" ? x.gw : "", dns: x.dns !== "0.0.0.0" ? x.dns : "", start: x.start, max: x.max, excluded: []};
  }
  if (!pool) return false;
  const r = rt(d);
  let ip = r.leases[m.chaddr];
  if (!ip) {
    const used = new Set(Object.values(r.leases)), base = ipToInt(pool.start || pool.network) + (pool.start ? 0 : 1), last = ipToInt(bcastOf(pool.network, pool.mask)) - 1;
    const excluded = n => pool.excluded.some(([a, b]) => n >= ipToInt(a) && n <= ipToInt(b || a));
    for (let n = base; n <= last && (!pool.max || n < base + pool.max); n++) { const s = intToIp(n); if (!used.has(s) && !excluded(n) && s !== pool.gw && !ownerOfIp(s)) { ip = s; break; } }
    if (!ip) { note(`DHCP pool ${pool.name} on ${d.name} is out of addresses`); return true; }
    r.leases[m.chaddr] = ip;
  }
  const op = m.op === "discover" ? "offer" : "ack";
  note(`${d.name} (DHCP pool ${pool.name}) ${op === "offer" ? "offers" : "acknowledges"} ${ip}`);
  const reply = {op, chaddr: m.chaddr, yiaddr: ip, mask: pool.mask, gw: pool.gw, dns: pool.dns, server: iface.ip, relayIf: m.relayIf};
  if (m.giaddr) ipOut(d, {src: iface.ip, dst: m.giaddr, ttl: 255, proto: "udp", udp: {sport: 67, dport: 67, dhcp: reply}});
  else l2Send(d, iface, {type: "ip", dst: m.chaddr, ip: {src: iface.ip, dst: "255.255.255.255", ttl: 255, proto: "udp", udp: {sport: 67, dport: 68, dhcp: reply}}});
  return true;
}

// ---- public API used by the CLI, the PC desktop and Simulation mode
let PKT_ID = 1;
function runTraced(fn) { const saved = EVLOG; EVLOG = []; NOW = 0; CUR = null; let res; try { res = fn(); } finally { var ev = EVLOG; EVLOG = saved; } return {res, events: ev}; }
function pingOnce(d, dst, opts) {
  opts = opts || {};
  const id = PKT_ID++;
  return runTraced(() => {
    WAIT = {dev: d.id, id, res: null};
    const p = {src: opts.src || "", dst, ttl: opts.ttl || (isHost(d) ? 128 : 255), proto: "icmp", icmp: {type: "echo", id, seq: opts.seq || 0}};
    const sent = ipOut(d, p);
    const w = WAIT; WAIT = null;
    return {sent, res: w.res, from: w.from, ttl: w.ttl};
  });
}
function dnsResolve(d, name, retry) {
  if (isIp(name)) return {ip: name};
  const a = isHost(d) ? hostAddr(d) : {dns: ""};
  if (!a.dns) return {ip: null, err: "no DNS server"};
  const id = PKT_ID++;
  const r = runTraced(() => { WAIT = {dev: d.id, id, res: null}; ipOut(d, {dst: a.dns, ttl: 128, proto: "udp", udp: {sport: 1025, dport: 53, dns: {q: name, id}}}); const w = WAIT; WAIT = null; return w; });
  if (r.res.res !== "dns" && !retry) { const r2 = dnsResolve(d, name, true); r2.events = r.events.concat(r2.events || []); return r2; }
  return {ip: r.res.res === "dns" ? r.res.answer : null, events: r.events, err: r.res.res === "dns" ? (r.res.answer ? "" : "no record") : "DNS server didn't answer"};
}
function tcpConnect(d, dst, port, retry) {
  const id = PKT_ID++;
  const r = runTraced(() => { WAIT = {dev: d.id, id, res: null}; ipOut(d, {dst, ttl: 128, proto: "tcp", tcp: {sport: 1025 + (id % 3000), dport: port, flags: "SYN", id}}); const w = WAIT; WAIT = null; return w; });
  if (!r.res.res && !retry) { const r2 = tcpConnect(d, dst, port, true); r2.events = r.events.concat(r2.events); return r2; }
  return {ok: r.res.res === "SYN-ACK", refused: r.res.res === "RST", dev: ownerOfIp(dst), events: r.events};
}
function dhcpRequest(d, tries) {
  tries = tries || 0;
  const i = l3Ifaces(d)[0], mac = macOf(d, hostPort(d));
  const r = runTraced(() => {
    WAIT = {dev: d.id, res: null};
    ipOut(d, {src: "0.0.0.0", dst: "255.255.255.255", ttl: 128, proto: "udp", udp: {sport: 68, dport: 67, dhcp: {op: "discover", chaddr: mac}}});
    let w = WAIT;
    if (w.res === "offer") { WAIT = {dev: d.id, res: null}; ipOut(d, {src: "0.0.0.0", dst: "255.255.255.255", ttl: 128, proto: "udp", udp: {sport: 68, dport: 67, dhcp: {op: "request", chaddr: mac, want: w.offer.yiaddr}}}); w = WAIT; }
    WAIT = null; return w;
  });
  const w = r.res;
  if (w.res === "ack") { rt(d).lease = {ip: w.offer.yiaddr, mask: w.offer.mask, gw: w.offer.gw, dns: w.offer.dns, server: w.offer.server}; rt(d).arp = {}; }
  else {
    rt(d).lease = null;
    if (tries < 2) { const r2 = dhcpRequest(d, tries + 1); r2.events = r.events.concat(r2.events); return r2; }
  }
  return {ok: w.res === "ack", lease: rt(d).lease, events: r.events};
}
// a 169.254 address is what Windows shows when DHCP fails
function apipa(d) { const h = hash32(d.id); return `169.254.${(h >>> 8) & 255 || 1}.${h & 255 || 1}`; }
// DHCP clients ask for an address when the project loads or the cabling changes (like PCs booting up)
let dhcpTimer = 0;
function autoDhcp(delay) {
  clearTimeout(dhcpTimer);
  dhcpTimer = setTimeout(() => {
    let changed = false;
    S.devices.forEach(d => { if (isHost(d) && d.host && d.host.dhcp && (!rt(d).lease || rt(d).lease.apipa)) { const r = dhcpRequest(d); if (!r.ok) rt(d).lease = {ip: apipa(d), mask: "255.255.0.0", gw: "", dns: "", apipa: true}; changed = true; } });
    if (changed) { scheduleRender(); if (typeof refreshDevWins === "function") refreshDevWins(); }
  }, delay == null ? 300 : delay);
}
