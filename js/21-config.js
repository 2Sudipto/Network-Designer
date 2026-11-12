// ======================================================================= DEVICE CONFIGURATION MODEL
// cfg = running-config (saved with the project). startup = saved copy ("copy run start").
// host = PC/server IP settings. svc = server services. Runtime tables (ARP, MAC…) live in RT, never saved.
const IOS_TYPES = ["router", "switch", "l3switch", "firewall"];
const HOST_TYPES = ["pc", "laptop", "server", "printer", "phone", "tablet"];
const isIOS = d => d && IOS_TYPES.includes(d.type);
const isHost = d => d && HOST_TYPES.includes(d.type);
const isSwitch = d => d && (d.type === "switch" || d.type === "l3switch");
const isRouterish = d => d && (d.type === "router" || d.type === "firewall");
const PROMPT_NAME = {router: "Router", switch: "Switch", l3switch: "Switch", firewall: "ciscoasa"};

function defaultCfg(d) {
  const c = {
    hostname: PROMPT_NAME[d.type] || "Router", banner: "", enableSecret: null, enablePassword: null, spe: false,
    domainLookup: true, domainName: "", users: {}, ssh: {version: 0, keyBits: 0},
    lines: {con: {password: null, login: false, loginLocal: false, timeout: [10, 0]}, vty: {password: null, login: true, loginLocal: false, timeout: [10, 0], transport: "all"}},
    ifaces: {}, vlans: {}, ipRouting: isRouterish(d), routes: [], defaultGateway: "", dhcp: {excluded: [], pools: {}}, cdp: true, stpPriority: 32768,
  };
  allPorts(d).filter(p => p !== "Console").forEach(p => {
    c.ifaces[p] = {shutdown: isRouterish(d), desc: "", ip: "", mask: "", helper: [], speed: "auto", duplex: "auto", clock: null};
    if (isSwitch(d)) Object.assign(c.ifaces[p], {mode: "dynamic", accessVlan: 1, nativeVlan: 1, allowed: "all", routed: false});
  });
  if (isSwitch(d)) { c.vlans = {1: "default"}; c.ifaces.Vlan1 = {shutdown: true, desc: "", ip: "", mask: "", helper: []}; }
  if (d.type === "firewall") asaExtend(c, d);   // ASA-style firewall OS (32-asa.js)
  return c;
}
function defaultHost(d) { return {dhcp: d.type === "phone" || d.type === "tablet", ip: "", mask: "", gw: "", dns: ""}; }
function defaultSvc() {
  return {
    dhcp: {on: false, pools: [{name: "serverPool", gw: "0.0.0.0", dns: "0.0.0.0", start: "", mask: "255.255.255.0", max: 50}]},
    dns: {on: false, records: []},
    http: {on: true, page: "<h1>Cisco Packet Tracer-style web server</h1><p>Welcome! Edit this page in Services → HTTP.</p>"},
  };
}
function initDevice(d) {
  if (isIOS(d)) {
    if (!d.cfg || (d.type === "firewall" && !d.cfg.asa)) d.cfg = defaultCfg(d);   // boots as "Router" / "Switch", like real IOS (firewalls ship with a factory-default config)
    // ports added by a model change get defaults
    const def = defaultCfg(d);
    for (const p in def.ifaces) if (!d.cfg.ifaces[p]) d.cfg.ifaces[p] = def.ifaces[p];
  } else if (isHost(d)) {
    if (!d.host) d.host = defaultHost(d);
    if (d.type === "server" && !d.svc) d.svc = defaultSvc();
  }
}
function initAll() { S.devices.forEach(initDevice); if (typeof resetRuntime === "function") resetRuntime(); }
const ifc = (d, name) => d.cfg.ifaces[name] || (d.cfg.ifaces[name] = {shutdown: /^(Vlan)/.test(name) ? true : false, desc: "", ip: "", mask: "", helper: []});

// ---- passwords: {t: 0 | 5 | 7, v}
const pwPlain = v => ({t: 0, v});
function pwCheck(p, typed) {
  if (!p) return false;
  if (p.t === 0) return p.v === typed;
  if (p.t === 7) return type7Decrypt(p.v) === typed;
  if (p.t === 5) return checkSecret(typed, p.v);
  return false;
}
const pwShow = p => p.t === 0 ? p.v : p.t + " " + p.v;
function applySPE(c) {
  const enc = p => p && p.t === 0 ? {t: 7, v: type7Encrypt(p.v)} : p;
  c.enablePassword = enc(c.enablePassword);
  c.lines.con.password = enc(c.lines.con.password); c.lines.vty.password = enc(c.lines.vty.password);
  for (const u in c.users) if (c.users[u].password) c.users[u].password = enc(c.users[u].password);
}

// ---- interface ordering for show commands
function ifOrder(d) {
  const phys = allPorts(d).filter(p => p !== "Console");
  const virt = Object.keys(d.cfg.ifaces).filter(n => !phys.includes(n));
  const sortKey = n => { const t = n.match(/^[A-Za-z]+/)[0], rank = {Loopback: 0, Vlan: 2}[t]; return [rank == null ? 1 : rank, t, ...n.replace(/^[A-Za-z]+/, "").split(/[/.]/).map(Number)]; };
  const cmp = (a, b) => { const x = sortKey(a), y = sortKey(b); for (let i = 0; i < Math.max(x.length, y.length); i++) { if (x[i] === y[i]) continue; if (x[i] == null) return -1; if (y[i] == null) return 1; return x[i] < y[i] ? -1 : 1; } return 0; };
  const subs = virt.filter(n => /\.\d+$/.test(n));
  const out = [];
  virt.filter(n => /^Loopback/.test(n)).sort(cmp).forEach(n => out.push(n));
  phys.forEach(p => { out.push(p); subs.filter(s => parentIf(s) === p).sort(cmp).forEach(s => out.push(s)); });
  virt.filter(n => /^Vlan/.test(n)).sort(cmp).forEach(n => out.push(n));
  return out;
}
function vlanRanges(list) {
  const n = [...new Set(list)].sort((a, b) => a - b), out = [];
  for (let i = 0; i < n.length; i++) { let j = i; while (j + 1 < n.length && n[j + 1] === n[j] + 1) j++; out.push(j > i + 1 ? `${n[i]}-${n[j]}` : j === i + 1 ? `${n[i]},${n[j]}` : `${n[i]}`); i = j; }
  return out.join(",");
}

// ---- running-config text, in IOS order
function runningConfig(d, c) {
  c = c || d.cfg;
  if (d.type === "firewall") return asaRunningConfig(d, c);
  const L = ["Building configuration...", "", `Current configuration : ${1200 + JSON.stringify(c).length} bytes`, "!", "version 15.2", "no service timestamps log datetime msec", "no service timestamps debug datetime msec"];
  L.push(c.spe ? "service password-encryption" : "no service password-encryption", "!", "hostname " + c.hostname, "!");
  if (c.enableSecret) L.push("enable secret 5 " + c.enableSecret.v);
  if (c.enablePassword) L.push("enable password " + pwShow(c.enablePassword));
  if (c.enableSecret || c.enablePassword) L.push("!");
  c.dhcp.excluded.forEach(([a, b]) => L.push(`ip dhcp excluded-address ${a}${b && b !== a ? " " + b : ""}`));
  if (c.dhcp.excluded.length) L.push("!");
  for (const [name, p] of Object.entries(c.dhcp.pools)) {
    L.push("ip dhcp pool " + name);
    if (p.network) L.push(` network ${p.network} ${p.mask}`);
    if (p.gw) L.push(" default-router " + p.gw);
    if (p.dns) L.push(" dns-server " + p.dns);
    if (p.domain) L.push(" domain-name " + p.domain);
    L.push("!");
  }
  if (isRouterish(d)) L.push("no ip cef", "no ipv6 cef", "!");
  if (c.errRecovery) L.push("errdisable recovery cause psecure-violation", "!");
  for (const [u, o] of Object.entries(c.users)) L.push(`username ${u}${o.priv != null ? " privilege " + o.priv : ""} ${o.secret ? "secret 5 " + o.secret.v : "password " + pwShow(o.password)}`);
  if (Object.keys(c.users).length) L.push("!");
  if (c.ssh.version) L.push("ip ssh version " + c.ssh.version);
  if (!c.domainLookup) L.push("no ip domain-lookup");
  if (c.domainName) L.push("ip domain-name " + c.domainName);
  if (d.type === "l3switch" && c.ipRouting) L.push("ip routing");
  L.push("!");
  if (isSwitch(d)) L.push("spanning-tree mode pvst", ...(c.stpPriority !== 32768 ? [`spanning-tree vlan 1 priority ${c.stpPriority}`] : []), "!");
  for (const n of ifOrder(d)) {
    const i = c.ifaces[n]; if (!i) continue;
    L.push("interface " + longIf(n));
    if (i.desc) L.push(" description " + i.desc);
    if (i.dot1q) L.push(" encapsulation dot1Q " + i.dot1q + (i.dot1qNative ? " native" : ""));
    const sw = isSwitch(d) && !isVirtualIf(n) && !i.routed;
    if (isSwitch(d) && !isVirtualIf(n) && i.routed) L.push(" no switchport");
    if (sw) {
      if (i.mode === "access") { if (i.accessVlan !== 1) L.push(" switchport access vlan " + i.accessVlan); L.push(" switchport mode access"); }
      else if (i.mode === "trunk") {
        if (i.nativeVlan !== 1) L.push(" switchport trunk native vlan " + i.nativeVlan);
        if (i.allowed !== "all") L.push(" switchport trunk allowed vlan " + i.allowed);
        L.push(" switchport mode trunk");
      } else if (i.accessVlan !== 1) L.push(" switchport access vlan " + i.accessVlan);
      if (i.noneg) L.push(" switchport nonegotiate");
      if (i.mode === "desirable") L.push(" switchport mode dynamic desirable");
      if (i.ps && i.ps.on) {
        L.push(" switchport port-security");
        if (i.ps.max !== 1) L.push(" switchport port-security maximum " + i.ps.max);
        if (i.ps.viol !== "shutdown") L.push(" switchport port-security violation " + i.ps.viol);
        if (i.ps.sticky) L.push(" switchport port-security mac-address sticky");
        i.ps.macs.forEach(m => L.push(" switchport port-security mac-address " + (m.sticky ? "sticky " : "") + m.mac));
      }
      if (i.portfast) L.push(" spanning-tree portfast");
    } else {
      L.push(i.ip ? ` ip address ${i.ip} ${i.mask}` : " no ip address");
      (i.helper || []).forEach(h => L.push(" ip helper-address " + h));
      if (i.aclIn) L.push(` ip access-group ${i.aclIn} in`);
      if (i.aclOut) L.push(` ip access-group ${i.aclOut} out`);
      if (i.nat) L.push(" ip nat " + i.nat);
      if (i.ospfHello) L.push(" ip ospf hello-interval " + i.ospfHello);
      if (i.ospfDead) L.push(" ip ospf dead-interval " + i.ospfDead);
      if (i.ospfNet) L.push(" ip ospf network " + i.ospfNet);
      if (i.ospfPri != null) L.push(" ip ospf priority " + i.ospfPri);
      if (i.ospfCost) L.push(" ip ospf cost " + i.ospfCost);
      if (i.ospfArea != null) L.push(` ip ospf ${i.ospfPid || 1} area ${i.ospfArea}`);
    }
    if (i.clock) L.push(" clock rate " + i.clock);
    if (!isVirtualIf(n) && portKind(n) === "eth") { if (i.duplex && i.duplex !== "auto") L.push(" duplex " + i.duplex); if (i.speed && i.speed !== "auto") L.push(" speed " + i.speed); }
    if (i.shutdown) L.push(" shutdown");
    L.push("!");
  }
  if (c.ospf) L.push(...ospfConfig(c), "!");
  if (c.defaultGateway) L.push("ip default-gateway " + c.defaultGateway);
  if (isRouterish(d) || c.ipRouting) L.push("ip classless");
  c.routes.forEach(r => L.push(`ip route ${r.net} ${r.mask} ${r.nh || r.iface}${r.ad && r.ad !== 1 ? " " + r.ad : ""}`));
  L.push("!", "ip flow-export version 9", "!");
  const nat = iosNatConfig(c), acl = iosAclConfig(c);
  if (nat.length) L.push(...nat, "!");
  if (acl.length) L.push(...acl, "!");
  if (c.banner) L.push(`banner motd ^C${c.banner}^C`, "!");
  const line = (name, o, extra) => {
    L.push(name);
    if (o.timeout && (o.timeout[0] !== 10 || o.timeout[1] !== 0)) L.push(` exec-timeout ${o.timeout[0]} ${o.timeout[1]}`);
    if (o.password) L.push(" password " + pwShow(o.password));
    if (o.loginLocal) L.push(" login local"); else if (o.login) L.push(" login");
    (extra || []).forEach(x => L.push(x));
    L.push("!");
  };
  line("line con 0", c.lines.con);
  if (isRouterish(d)) L.push("line aux 0", "!");
  line(isRouterish(d) ? "line vty 0 4" : "line vty 0 15", c.lines.vty, [...(c.lines.vty.accessClass ? [" access-class " + c.lines.vty.accessClass + " in"] : []), ...(c.lines.vty.transport !== "all" ? [" transport input " + c.lines.vty.transport] : [])]);
  L.push("!", "end");
  return L.join("\n");
}
function startupConfig(d) {
  if (!d.startup) return null;
  return runningConfig(d, JSON.parse(d.startup)).replace(/^Building configuration\.\.\.\n\nCurrent configuration/, "Using " + (1000 + d.startup.length) + " bytes\n!\nCurrent configuration");
}
function saveStartup(d) { d.startup = JSON.stringify(d.cfg); save(); }
function reloadDevice(d) {
  d.cfg = d.startup ? JSON.parse(d.startup) : null;
  if (!d.cfg) { d.cfg = defaultCfg(d); }
  initDevice(d);
  if (typeof resetRuntime === "function") resetRuntime(d);
  render(); save();
}
// addresses configured on a device, for labels / addressing tables
function configuredAddrs(d) {
  const out = [];
  if (isIOS(d)) ifOrder(d).forEach(n => { const i = d.cfg.ifaces[n]; if (i && i.ip) out.push({iface: n, ip: i.ip, mask: i.mask, shut: i.shutdown}); });
  else if (isHost(d)) { const a = typeof hostAddr === "function" ? hostAddr(d) : d.host; if (a && a.ip) out.push({iface: (allPorts(d)[0] || "NIC"), ip: a.ip, mask: a.mask, gw: a.gw}); }
  return out;
}
