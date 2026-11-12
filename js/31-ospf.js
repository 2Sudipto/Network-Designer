// ======================================================================= OSPF (single process, multi-area aware)
// Neighbours form over the real layer 2 topology (switches, VLANs, trunks, STP) when area, subnet,
// mask and hello/dead timers match. SPF runs over full adjacencies; costs use reference bandwidth / interface bandwidth.
Object.assign(HELP, {
  router: "Enable a routing process", ospf: "Open Shortest Path First (OSPF)", "router-id": "router-id for this OSPF process", area: "Set the OSPF area ID",
  "passive-interface": "Suppress routing updates on an interface", "default-information": "Control distribution of default information", originate: "Distribute a default route",
  always: "Always advertise default route", "auto-cost": "Calculate OSPF interface cost according to bandwidth", "reference-bandwidth": "Use reference bandwidth method to assign OSPF cost",
  neighbor: "Neighbor list", cost: "Interface cost", "hello-interval": "Time between HELLO packets", "dead-interval": "Interval after which a neighbor is declared dead",
  "log-adjacency-changes": "Log changes in adjacency state", process: "Reset OSPF process", protocols: "IP routing protocol process parameters and statistics",
});
let OSPF_CACHE = null;
function ospfDirty() { OSPF_CACHE = null; }
const ospfRouters = () => S.devices.filter(d => isIOS(d) && !isFw(d) && d.cfg.ospf && (isRouterish(d) || d.cfg.ipRouting));
const wildMatch = (ip, net, wild) => ((ipToInt(ip) & ~ipToInt(wild)) >>> 0) === ((ipToInt(net) & ~ipToInt(wild)) >>> 0);
function bwKbps(n) { return /^Loop/.test(n) ? 8000000 : portKind(parentIf(n)) === "serial" ? 1544 : /^(Te)/i.test(n) ? 10000000 : /^(Twe)/i.test(n) ? 25000000 : /^(Hu)/i.test(n) ? 100000000 : /^(G|Gi)/i.test(n) ? 1000000 : /^Vlan/.test(n) ? 1000000 : 100000; }
function ospfCost(d, n) { const i = d.cfg.ifaces[n] || {}; if (i.ospfCost) return i.ospfCost; return Math.max(1, Math.floor((d.cfg.ospf.refBw || 100) * 1000 / bwKbps(n))); }
// interfaces running OSPF: {name, ip, mask, area, passive, cost, loop, p2p, ifo}
function ospfIfs(d) {
  const o = d.cfg.ospf; if (!o) return [];
  const out = [];
  l3Ifaces(d).forEach(ifo => {
    if (!ifo.ip || !ifo.up) return;
    const i = d.cfg.ifaces[ifo.name] || {};
    let area = i.ospfArea != null ? String(i.ospfArea) : null;
    if (area == null) { const n = o.nets.find(x => wildMatch(ifo.ip, x.net, x.wild)); if (n) area = String(n.area); }
    if (area == null) return;
    const passive = o.passiveDefault ? !o.active[ifo.name] : !!o.passive[ifo.name];
    out.push({name: ifo.name, ip: ifo.ip, mask: ifo.mask, area, passive: passive || !!ifo.loop, cost: ospfCost(d, ifo.name), loop: !!ifo.loop,
      p2p: i.ospfNet === "point-to-point" || portKind(parentIf(ifo.name)) === "serial", hello: i.ospfHello || 10, dead: i.ospfDead || (i.ospfHello ? i.ospfHello * 4 : 40), pri: i.ospfPri != null ? i.ospfPri : 1, ifo});
  });
  return out;
}
function chooseRid(d) {
  const o = d.cfg.ospf;
  if (o.rid) return o.rid;
  const ips = l3Ifaces(d).filter(i => i.ip && i.up), loops = ips.filter(i => i.loop);
  const pick = (loops.length ? loops : ips).map(i => i.ip).sort((a, b) => ipToInt(b) - ipToInt(a))[0];
  return pick || null;
}
// the router ID is chosen once and then sticks (like IOS) until "clear ip ospf process" or a reload
function ridOf(d) { const r = rt(d); if (!r.ospfRid) r.ospfRid = chooseRid(d); return r.ospfRid; }
function computeOspf() {
  const res = {nbrs: {}, ifs: {}, routes: {}, rids: {}};
  const rs = ospfRouters();
  rs.forEach(d => { res.ifs[d.id] = ospfIfs(d); res.rids[d.id] = ridOf(d); res.nbrs[d.id] = []; });
  // adjacencies
  rs.forEach(d => {
    if (!res.rids[d.id]) return;
    res.ifs[d.id].filter(x => !x.passive).forEach(x => {
      const seg = [{dev: d, oi: x}];
      l2Peers(d, x.ifo).forEach(({dev, ifo}) => {
        const oi = (res.ifs[dev.id] || []).find(y => y.name === ifo.name);
        if (!oi || oi.passive || !res.rids[dev.id]) return;
        if (!sameNet(x.ip, oi.ip, x.mask) || x.mask !== oi.mask) return;
        seg.push({dev, oi});
        const ok = oi.area === x.area && oi.hello === x.hello && oi.dead === x.dead && res.rids[dev.id] !== res.rids[d.id];
        res.nbrs[d.id].push({dev, myIf: x, nbrIf: oi, rid: res.rids[dev.id], ok, why: oi.area !== x.area ? "area mismatch" : oi.hello !== x.hello || oi.dead !== x.dead ? "hello/dead timer mismatch" : res.rids[dev.id] === res.rids[d.id] ? "duplicate router ID" : ""});
      });
      // DR/BDR election on broadcast segments
      if (!x.p2p) {
        const cand = seg.filter(m => m.oi.pri > 0 && (m.dev === d || res.nbrs[d.id].some(n => n.dev === m.dev && n.ok)))
          .sort((a, b) => b.oi.pri - a.oi.pri || ipToInt(res.rids[b.dev.id]) - ipToInt(res.rids[a.dev.id]));
        x.dr = cand[0] ? cand[0].oi.ip : null; x.bdr = cand[1] ? cand[1].oi.ip : null;
        x.role = x.ip === x.dr ? "DR" : x.ip === x.bdr ? "BDR" : x.pri === 0 ? "DROTHER" : "DROTHER";
      } else x.role = "P2P";
    });
  });
  // SPF from every router
  rs.forEach(d => {
    const routes = [];
    if (!res.rids[d.id]) { res.routes[d.id] = routes; return; }
    const dist = {[d.id]: 0}, first = {[d.id]: []}, done = new Set(), q = [d];
    while (q.length) {
      q.sort((a, b) => dist[a.id] - dist[b.id]);
      const u = q.shift(); if (done.has(u.id)) continue; done.add(u.id);
      (res.nbrs[u.id] || []).filter(n => n.ok && (res.nbrs[n.dev.id] || []).some(m => m.dev === u && m.ok)).forEach(n => {
        const nd = dist[u.id] + n.myIf.cost, hop = u === d ? [{iface: n.myIf.name, nh: n.nbrIf.ip}] : first[u.id];
        if (dist[n.dev.id] == null || nd < dist[n.dev.id]) { dist[n.dev.id] = nd; first[n.dev.id] = hop.slice(); q.push(n.dev); }
        else if (nd === dist[n.dev.id]) hop.forEach(h => { if (!first[n.dev.id].some(x => x.nh === h.nh)) first[n.dev.id].push(h); });
      });
    }
    const myAreas = new Set(res.ifs[d.id].map(x => x.area));
    const myNets = l3Ifaces(d).filter(i => i.ip && i.up).map(i => netOf(i.ip, i.mask) + "/" + i.mask);
    const best = {};
    rs.forEach(r => {
      if (r === d || dist[r.id] == null) return;
      res.ifs[r.id].forEach(x => {
        const mask = x.loop && x.ifo.loop && (r.cfg.ifaces[x.name] || {}).ospfNet !== "point-to-point" ? "255.255.255.255" : x.mask;
        const net = netOf(x.ip, mask), k = net + "/" + mask;
        if (myNets.includes(k)) return;
        const cost = dist[r.id] + x.cost;
        if (!best[k] || cost < best[k].metric) best[k] = {code: myAreas.has(x.area) ? "O" : "O IA", net, mask, metric: cost, hops: first[r.id].slice()};
        else if (cost === best[k].metric) first[r.id].forEach(h => { if (!best[k].hops.some(y => y.nh === h.nh)) best[k].hops.push(h); });
      });
      const o = r.cfg.ospf;
      if (o.defOrig && (o.defOrigAlways || r.cfg.routes.some(x => x.net === "0.0.0.0" && x.mask === "0.0.0.0"))) {
        const k = "0.0.0.0/0.0.0.0";
        if (!best[k] || dist[r.id] < best[k].d) best[k] = {code: "O*E2", net: "0.0.0.0", mask: "0.0.0.0", metric: 1, d: dist[r.id], hops: first[r.id].slice()};
      }
    });
    Object.values(best).forEach(b => b.hops.forEach(h => routes.push({code: b.code, net: b.net, mask: b.mask, nh: h.nh, iface: h.iface, ad: 110, metric: b.metric, ospf: true})));
    res.routes[d.id] = routes;
  });
  return res;
}
const ospf = () => OSPF_CACHE || (OSPF_CACHE = computeOspf());
function ospfRoutes(d) { if (!d.cfg.ospf || !(isRouterish(d) || d.cfg.ipRouting)) return []; return (ospf().routes[d.id] || []).filter(r => ifUp(d, r.iface)); }
const fullNbrs = d => (ospf().nbrs[d.id] || []).filter(n => n.ok && (ospf().nbrs[n.dev.id] || []).some(m => m.dev === d && m.ok));

// ---- adjacency change messages (%OSPF-5-ADJCHG) after each command
function ospfSnapshot() { const o = {}; ospfRouters().forEach(d => { o[d.id] = new Set(fullNbrs(d).map(n => n.rid + "|" + n.myIf.name)); }); return o; }
function ospfNotify(before) {
  netDirty();
  const after = ospfSnapshot();
  const ids = new Set([...Object.keys(before), ...Object.keys(after)]);
  ids.forEach(id => {
    const d = byId(id); if (!d || !d.cfg.ospf) return;
    const a = before[id] || new Set(), b = after[id] || new Set(), pid = d.cfg.ospf.pid;
    b.forEach(k => { if (!a.has(k)) { const [rid, ifn] = k.split("|"); devLog(d, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${rid} on ${longIf(ifn)} from LOADING to FULL, Loading Done`, {sev: 5}); } });
    a.forEach(k => { if (!b.has(k)) { const [rid, ifn] = k.split("|"); devLog(d, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${rid} on ${longIf(ifn)} from FULL to DOWN, Neighbor Down: Interface down or detached`, {sev: 5}); } });
  });
}

// ---- configuration commands
const ospfObj = s => s.dev.cfg.ospf;
defCmd("config", "router ospf <1-65535>", (s, a) => {
  const d = s.dev;
  if (d.type === "switch") { iosPr(s, "% Invalid input detected at '^' marker."); return; }
  if (d.cfg.ospf && d.cfg.ospf.pid !== +a[0]) { iosPr(s, `% This simulator runs one OSPF process: remove "router ospf ${d.cfg.ospf.pid}" first`); return; }
  if (!d.cfg.ospf) {
    d.cfg.ospf = {pid: +a[0], rid: "", nets: [], passive: {}, active: {}, passiveDefault: false, defOrig: false, defOrigAlways: false, refBw: 100};
    if (!chooseRid(d)) iosPr(s, `%OSPF-4-NORTRID: OSPF process ${a[0]} failed to allocate unique router-id and cannot start`);
  }
  s.mode = "router"; s.ctx = {pid: +a[0]};
});
defCmd("config", "no router ospf <1-65535>", s => { delete s.dev.cfg.ospf; delete rt(s.dev).ospfRid; });
defCmd("router", "network <A.B.C.D> <A.B.C.D> area <0-4294967295>", (s, a) => {
  const o = ospfObj(s), net = intToIp((ipToInt(a[0]) & ~ipToInt(a[1])) >>> 0);
  if (!o.nets.some(x => x.net === net && x.wild === a[1])) o.nets.push({net, wild: a[1], area: +a[2]});
  else o.nets.find(x => x.net === net && x.wild === a[1]).area = +a[2];
});
defCmd("router", "no network <A.B.C.D> <A.B.C.D> area <0-4294967295>", (s, a) => { const o = ospfObj(s), net = intToIp((ipToInt(a[0]) & ~ipToInt(a[1])) >>> 0); o.nets = o.nets.filter(x => !(x.net === net && x.wild === a[1])); });
defCmd("router", "router-id <A.B.C.D>", (s, a) => {
  const d = s.dev; ospfObj(s).rid = a[0];
  if (fullNbrs(d).length) iosPr(s, `% OSPF: Reload or use "clear ip ospf process" command, for this to take effect`);
  else rt(d).ospfRid = a[0];
});
defCmd("router", "no router-id", s => { ospfObj(s).rid = ""; });
defCmd("router", "passive-interface <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); if (!n) { iosPr(s, "% Invalid input detected at '^' marker."); return; } const o = ospfObj(s); if (o.passiveDefault) delete o.active[n]; else o.passive[n] = true; });
defCmd("router", "no passive-interface <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); const o = ospfObj(s); if (o.passiveDefault) o.active[n] = true; else delete o.passive[n]; });
defCmd("router", "passive-interface default", s => { const o = ospfObj(s); o.passiveDefault = true; o.active = {}; o.passive = {}; });
defCmd("router", "no passive-interface default", s => { const o = ospfObj(s); o.passiveDefault = false; o.active = {}; });
defCmd("router", "default-information originate", s => { Object.assign(ospfObj(s), {defOrig: true, defOrigAlways: false}); });
defCmd("router", "default-information originate always", s => { Object.assign(ospfObj(s), {defOrig: true, defOrigAlways: true}); });
defCmd("router", "no default-information originate", s => { Object.assign(ospfObj(s), {defOrig: false, defOrigAlways: false}); });
defCmd("router", "auto-cost reference-bandwidth <1-4294967>", (s, a) => { ospfObj(s).refBw = +a[0]; iosPr(s, "% OSPF: Reference bandwidth is changed.\n        Please ensure reference bandwidth is consistent across all routers."); });
defCmd("router", "log-adjacency-changes", () => {});
defCmd("router", "log-adjacency-changes detail", () => {});
defCmd("if", "ip ospf cost <1-65535>", (s, a) => setPorts(s, i => { i.ospfCost = +a[0]; }));
defCmd("if", "no ip ospf cost", s => setPorts(s, i => { delete i.ospfCost; }));
defCmd("if", "ip ospf <1-65535> area <0-4294967295>", (s, a) => {
  if (!s.dev.cfg.ospf) s.dev.cfg.ospf = {pid: +a[0], rid: "", nets: [], passive: {}, active: {}, passiveDefault: false, defOrig: false, defOrigAlways: false, refBw: 100};
  setPorts(s, i => { i.ospfArea = +a[1]; i.ospfPid = +a[0]; });
});
defCmd("if", "no ip ospf <1-65535> area <0-4294967295>", s => setPorts(s, i => { delete i.ospfArea; delete i.ospfPid; }));
defCmd("if", "ip ospf hello-interval <1-65535>", (s, a) => setPorts(s, i => { i.ospfHello = +a[0]; }));
defCmd("if", "no ip ospf hello-interval", s => setPorts(s, i => { delete i.ospfHello; }));
defCmd("if", "ip ospf dead-interval <1-65535>", (s, a) => setPorts(s, i => { i.ospfDead = +a[0]; }));
defCmd("if", "no ip ospf dead-interval", s => setPorts(s, i => { delete i.ospfDead; }));
defCmd("if", "ip ospf priority <0-255>", (s, a) => setPorts(s, i => { i.ospfPri = +a[0]; }));
defCmd("if", "no ip ospf priority", s => setPorts(s, i => { delete i.ospfPri; }));
defCmd("if", "ip ospf network point-to-point", s => setPorts(s, i => { i.ospfNet = "point-to-point"; }));
defCmd("if", "ip ospf network broadcast", s => setPorts(s, i => { delete i.ospfNet; }));
defCmd("priv", "clear ip ospf process", s => {
  s.pending = {prompt: "Reset ALL OSPF processes? [no]: ", fn: v => {
    if (!/^y/i.test(v.trim())) return;
    const before = ospfSnapshot();
    delete rt(s.dev).ospfRid; netDirty();
    // every neighbour goes down and comes back
    const d = s.dev, pid = (d.cfg.ospf || {}).pid;
    (before[d.id] || new Set()).forEach(k => { const [rid, ifn] = k.split("|"); devLog(d, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${rid} on ${longIf(ifn)} from FULL to DOWN, Neighbor Down: Interface down or detached`, {sev: 5}); });
    const after = ospfSnapshot(); (after[d.id] || new Set()).forEach(k => { const [rid, ifn] = k.split("|"); devLog(d, `%OSPF-5-ADJCHG: Process ${pid}, Nbr ${rid} on ${longIf(ifn)} from LOADING to FULL, Loading Done`, {sev: 5}); });
  }};
});
function ospfConfig(c) {
  const o = c.ospf, L = [`router ospf ${o.pid}`];
  if (o.rid) L.push(` router-id ${o.rid}`);
  L.push(" log-adjacency-changes");
  if (o.refBw && o.refBw !== 100) L.push(` auto-cost reference-bandwidth ${o.refBw}`);
  if (o.passiveDefault) { L.push(" passive-interface default"); Object.keys(o.active).forEach(n => L.push(" no passive-interface " + longIf(n))); }
  else Object.keys(o.passive).forEach(n => L.push(" passive-interface " + longIf(n)));
  o.nets.forEach(n => L.push(` network ${n.net} ${n.wild} area ${n.area}`));
  if (o.defOrig) L.push(" default-information originate" + (o.defOrigAlways ? " always" : ""));
  return L;
}

// ---- show commands
const dead = () => "00:00:" + String(31 + Math.floor(Math.random() * 9)).padStart(2, "0");
defCmd(SHOWM, "show ip ospf neighbor", s => {
  const d = s.dev; if (!d.cfg.ospf) { iosPr(s, ""); return; }
  const L = ["", "Neighbor ID     Pri   State           Dead Time   Address         Interface"];
  const myIfs = ospf().ifs[d.id] || [];
  fullNbrs(d).forEach(n => {
    const mi = myIfs.find(x => x.name === n.myIf.name) || n.myIf;
    let st;
    if (mi.p2p) st = "FULL/  -";
    else { const role = n.nbrIf.ip === mi.dr ? "DR" : n.nbrIf.ip === mi.bdr ? "BDR" : "DROTHER"; st = (mi.role === "DROTHER" && role === "DROTHER" ? "2WAY/" : "FULL/") + role; }
    L.push(pad(n.rid, 16) + pad(String(n.nbrIf.pri).padStart(3), 6) + pad(st, 16) + pad(dead(), 12) + pad(n.nbrIf.ip, 16) + longIf(n.myIf.name));
  });
  iosPr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip ospf interface brief", s => {
  const d = s.dev; if (!d.cfg.ospf) { iosPr(s, ""); return; }
  const L = ["Interface    PID   Area            IP Address/Mask    Cost  State Nbrs F/C"];
  (ospf().ifs[d.id] || []).forEach(x => { const n = fullNbrs(d).filter(m => m.myIf.name === x.name).length; L.push(pad(shortIf(x.name), 13) + pad(d.cfg.ospf.pid, 6) + pad(x.area, 16) + pad(`${x.ip}/${maskToLen(x.mask)}`, 19) + pad(x.cost, 6) + pad(x.loop ? "LOOP" : x.p2p ? "P2P" : x.role === "DROTHER" ? "DROTH" : x.role || "WAIT", 6) + `${n}/${n}`); });
  iosPr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip ospf interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]), x = (ospf().ifs[d.id] || []).find(y => y.name === n);
  if (!x) { iosPr(s, `${longIf(n || a[0])} is ${n && ifUp(d, n) ? "up" : "down"}, line protocol is ${n && ifUp(d, n) ? "up" : "down"}\n  OSPF not enabled on this interface`); return; }
  const nb = fullNbrs(d).filter(m => m.myIf.name === x.name);
  iosPr(s, `${longIf(x.name)} is up, line protocol is up\n  Internet Address ${x.ip}/${maskToLen(x.mask)}, Area ${x.area}, Attached via Network Statement\n  Process ID ${d.cfg.ospf.pid}, Router ID ${ridOf(d)}, Network Type ${x.loop ? "LOOPBACK" : x.p2p ? "POINT_TO_POINT" : "BROADCAST"}, Cost: ${x.cost}\n${x.loop ? "  Loopback interface is treated as a stub Host" : `  Transmit Delay is 1 sec, State ${x.p2p ? "POINT_TO_POINT" : x.role}, Priority ${x.pri}\n${x.p2p ? "" : `  Designated Router (ID) ${x.dr || "0.0.0.0"}, Interface address ${x.dr || "0.0.0.0"}\n  Backup Designated router (ID) ${x.bdr || "0.0.0.0"}, Interface address ${x.bdr || "0.0.0.0"}\n`}  Timer intervals configured, Hello ${x.hello}, Dead ${x.dead}, Wait ${x.dead}, Retransmit 5\n${x.passive ? "    No Hellos (Passive interface)" : `    Hello due in 00:00:0${Math.floor(Math.random() * 9)}`}\n  Neighbor Count is ${nb.length}, Adjacent neighbor count is ${nb.length}\n${nb.map(m => `    Adjacent with neighbor ${m.rid}`).join("\n")}`}`);
});
defCmd(SHOWM, "show ip ospf", s => {
  const d = s.dev, o = d.cfg.ospf; if (!o) { iosPr(s, "%OSPF: Router process not running"); return; }
  const areas = [...new Set((ospf().ifs[d.id] || []).map(x => x.area))];
  iosPr(s, ` Routing Process "ospf ${o.pid}" with ID ${ridOf(d) || "0.0.0.0"}\n Start time: 00:00:12.340, Time elapsed: ${Math.round(performance.now() / 60000)}m\n Supports only single TOS(TOS0) routes\n Supports opaque LSA\n${areas.length > 1 && areas.includes("0") ? " It is an area border router\n" : ""}${o.defOrig ? " It is an autonomous system boundary router\n" : ""} SPF schedule delay 5 secs, Hold time between two SPFs 10 secs\n Number of areas in this router is ${areas.length}. ${areas.length} normal 0 stub 0 nssa\n Reference bandwidth unit is ${o.refBw || 100} mbps\n${areas.map(a => `    Area ${a === "0" ? "BACKBONE(0)" : a}\n        Number of interfaces in this area is ${(ospf().ifs[d.id] || []).filter(x => x.area === a).length}\n        Area has no authentication\n        SPF algorithm executed 4 times`).join("\n")}`);
});
defCmd(SHOWM, "show ip protocols", s => {
  const d = s.dev, o = d.cfg.ospf;
  if (!o) { iosPr(s, ""); return; }
  const srcs = fullNbrs(d).map(n => `    ${pad(n.rid, 15)}      110      00:0${Math.floor(Math.random() * 9)}:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}`);
  const pas = o.passiveDefault ? ifOrder(d).filter(n => !o.active[n] && d.cfg.ifaces[n] && d.cfg.ifaces[n].ip) : Object.keys(o.passive);
  iosPr(s, `\n*** IP Routing is NSF aware ***\n\nRouting Protocol is "ospf ${o.pid}"\n  Outgoing update filter list for all interfaces is not set\n  Incoming update filter list for all interfaces is not set\n  Router ID ${ridOf(d) || "0.0.0.0"}\n  Number of areas in this router is ${new Set((ospf().ifs[d.id] || []).map(x => x.area)).size}. ${new Set((ospf().ifs[d.id] || []).map(x => x.area)).size} normal 0 stub 0 nssa\n  Maximum path: 4\n  Routing for Networks:\n${o.nets.map(n => `    ${n.net} ${n.wild} area ${n.area}`).join("\n")}${pas.length ? "\n  Passive Interface(s):\n" + pas.map(n => "    " + longIf(n)).join("\n") : ""}\n  Routing Information Sources:\n    Gateway         Distance      Last Update\n${srcs.join("\n")}\n  Distance: (default is 110)`);
});

// ---- show ip route (replaces the basic version): OSPF metrics, ECMP, filters
function showIpRoute(s, filter) {
  const d = s.dev, rtab = routeTable(d);
  const L = ["Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP", "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area", "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2", "       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP", "       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area", "       * - candidate default, U - per-user static route, o - ODR", "       P - periodic downloaded static route", ""];
  if (!(isRouterish(d) || d.cfg.ipRouting)) { iosPr(s, d.cfg.defaultGateway ? `Default gateway is ${d.cfg.defaultGateway}\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty` : "Default gateway is not set\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty"); return; }
  const isDef = r => r.net === "0.0.0.0" && r.mask === "0.0.0.0";
  const defs = rtab.filter(isDef);
  const want = r => !filter || (filter === "ospf" ? r.code[0] === "O" : filter === "static" ? r.code[0] === "S" : filter === "connected" ? r.code === "C" || r.code === "L" : true);
  L.push(defs.length ? `Gateway of last resort is ${defs[0].nh || "0.0.0.0"} to network 0.0.0.0` : "Gateway of last resort is not set", "");
  const age = () => `00:${String(Math.floor(performance.now() / 60000) % 60).padStart(2, "0")}:${String(Math.floor(performance.now() / 1000) % 60).padStart(2, "0")}`;
  const line = (r, pre, tgt, cont) => r.code === "C" || r.code === "L" || !r.nh ? `${pre}${tgt} is directly connected, ${longIf(r.iface)}`
    : r.ospf ? `${cont ? " ".repeat(pre.length + tgt.length) : pre + tgt} [110/${r.metric}] via ${r.nh}, ${age()}, ${longIf(r.iface)}` : `${cont ? " ".repeat(pre.length + tgt.length) : pre + tgt} [${r.ad || 1}/0] via ${r.nh}`;
  const groups = {};
  rtab.filter(r => !isDef(r) && want(r)).forEach(r => { const cn = netOf(r.net, classfulMask(r.net)) + "/" + maskToLen(classfulMask(r.net)); (groups[cn] = groups[cn] || []).push(r); });
  Object.keys(groups).sort((a, b) => ipToInt(a.split("/")[0]) - ipToInt(b.split("/")[0])).forEach(cn => {
    const rs = groups[cn].sort((a, b) => ipToInt(a.net) - ipToInt(b.net) || maskToLen(a.mask) - maskToLen(b.mask));
    const masks = new Set(rs.map(r => r.mask)), [cnet, clen] = cn.split("/"), sub = rs.length > 1 || maskToLen(rs[0].mask) !== +clen;
    const nets = new Set(rs.map(r => r.net + "/" + r.mask));
    if (sub) L.push(`     ${cnet}/${masks.size > 1 ? clen : maskToLen(rs[0].mask)} is ${masks.size > 1 ? "variably " : ""}subnetted, ${nets.size} subnet${nets.size > 1 ? "s" : ""}${masks.size > 1 ? ", " + masks.size + " masks" : ""}`);
    let prev = "";
    rs.forEach(r => {
      const k = r.net + "/" + r.mask, pre = (r.code + "        ").slice(0, sub ? 9 : 5), tgt = `${r.net}/${maskToLen(r.mask)}`;
      L.push(line(r, pre, tgt, k === prev && r.code === "O")); prev = k;
    });
  });
  defs.filter(want).forEach((r, k) => L.push(line(r, (r.code + "     ").slice(0, 5), "0.0.0.0/0", k > 0)));
  iosPr(s, L.join("\n"));
}
defCmd(SHOWM, "show ip route", s => showIpRoute(s));
["ospf", "static", "connected"].forEach(f => defCmd(SHOWM, "show ip route " + f, s => showIpRoute(s, f)));
