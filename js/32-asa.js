// ======================================================================= FIREWALL OS (Cisco ASA-style)
// Interfaces pass traffic only once they have a nameif. Security levels decide what flows without an ACL
// (higher → lower is allowed, lower → higher is denied). Access-groups, object NAT / twice NAT, a stateful
// connection table, the inspection policy (ICMP is NOT inspected by default) and to-the-box management rules.
const ASA_INSPECT_DEFAULT = ["dns preset_dns_map", "ftp", "h323 h225", "h323 ras", "ip-options", "netbios", "rsh", "rtsp", "skinny", "esmtp", "sqlnet", "sunrpc", "tftp", "sip", "xdmcp"];
const asaVer = d => /^FPR-2/.test(d.model) ? "9.16(4)" : /^FPR/.test(d.model) ? "9.14(3)" : "9.8(4)";
const asaHw = d => ({"ASA 5506-X": "ASA5506, 4096 MB RAM, CPU Atom C2000 series 1250 MHz, 1 CPU (4 cores)", "ASA 5508-X": "ASA5508, 8192 MB RAM, CPU Atom C2000 series 2000 MHz, 1 CPU (8 cores)", "ASA 5516-X": "ASA5516, 8192 MB RAM, CPU Atom C2000 series 2416 MHz, 1 CPU (8 cores)", "FPR-1010": "FPR-1010, 8192 MB RAM, CPU Atom C3000 series 2200 MHz, 1 CPU (4 cores)", "FPR-1120": "FPR-1120, 8192 MB RAM, CPU Atom C3000 series 2200 MHz, 1 CPU (8 cores)", "FPR-2110": "FPR-2110, 16384 MB RAM, CPU MIPS 1200 MHz, 1 CPU (6 cores)", "ASA 5505": "ASA5505, 512 MB RAM, CPU Geode 500 MHz"})[d.model] || "ASA5506, 4096 MB RAM";
const asaSerial = d => "JAD" + String(hash32(d.id) % 100000000).padStart(8, "0").slice(0, 8);
const nameifOf = (d, n) => ((d.cfg.ifaces[n] || {}).nameif) || "";
const ifByNameif = (d, nm) => Object.keys(d.cfg.ifaces).find(k => d.cfg.ifaces[k].nameif === nm);
const secOf = (d, n) => { const i = d.cfg.ifaces[n]; return i && i.sec != null ? i.sec : 0; };
const asaPhys = d => allPorts(d).filter(p => p !== "Console");

function asaExtend(c, d) {
  Object.assign(c, {asa: 1, hostname: "ciscoasa", ipRouting: true, cdp: false, domainLookup: false});
  asaBlank(c, d);
  asaFactory(c, d);
}
function asaBlank(c, d) {
  Object.assign(c, {objects: {}, acls: {}, accessGroups: {}, twiceNat: [], routes: [], sameSec: {inter: false, intra: false},
    inspect: Object.fromEntries(ASA_INSPECT_DEFAULT.map(k => [k, true])), mgmt: {ssh: [], telnet: [], http: [], httpServer: false, sshTimeout: 5, telnetTimeout: 5},
    aaa: {ssh: false, telnet: false, http: false, serial: false}, dhcpd: {pools: {}, enabled: {}, dns: [], domain: "", router: ""},
    logging: {enable: false, buffered: null, console: null, asdm: null}, mtu: {}, users: {}, enablePassword: null, enableSecret: null, banner: "", domainName: ""});
  c.ssh = {version: 0, keyBits: 0};
  c.lines.con.loginLocal = false;
  for (const n of Object.keys(c.ifaces)) { if (isVirtualIf(n)) delete c.ifaces[n]; }
  asaPhys(d).forEach(p => { c.ifaces[p] = {shutdown: true, desc: "", ip: "", mask: "", helper: [], speed: "auto", duplex: "auto", clock: null, nameif: "", sec: null}; });
}
// the factory-default configuration an ASA ships with: outside / inside, PAT, DHCP server and ASDM access on the inside
function asaFactory(c, d) {
  const ps = asaPhys(d), out = ps[0], ins = ps[1];
  if (out) Object.assign(c.ifaces[out], {nameif: "outside", sec: 0, shutdown: false});
  if (ins) Object.assign(c.ifaces[ins], {nameif: "inside", sec: 100, shutdown: false, ip: "192.168.1.1", mask: "255.255.255.0"});
  c.objects.obj_any = {type: "subnet", a: "0.0.0.0", b: "0.0.0.0", desc: "", nat: {real: "inside", mapped: "outside", type: "dynamic", to: "interface"}};
  c.dhcpd.pools.inside = {start: "192.168.1.5", end: "192.168.1.254"}; c.dhcpd.enabled.inside = true;
  c.mgmt.httpServer = true; c.mgmt.http.push({net: "192.168.1.0", mask: "255.255.255.0", ifn: "inside"});
  c.logging = {enable: true, buffered: 6, console: null, asdm: 6};
}
const LOG_LEVELS = ["emergencies", "alerts", "critical", "errors", "warnings", "notifications", "informational", "debugging"];
const logLevel = w => /^\d$/.test(w) ? +w : LOG_LEVELS.findIndex(x => x.startsWith(String(w).toLowerCase()));

// ---- helpers for commands
const A = m => "asa:" + m;
const AEX = [A("user"), A("priv")];
const asaErr = (s, msg) => iosPr(s, msg.startsWith("ERROR") || msg.startsWith("WARNING") || msg.startsWith("INFO") ? msg : "ERROR: " + msg);
const ip0 = t => t === "0" ? "0.0.0.0" : t;   // the ASA accepts "0 0" for 0.0.0.0 0.0.0.0
Object.assign(HELP, {nameif: "Assign name to interface", "security-level": "Specify the security level of this interface after nameif", object: "Configure an object",
  "same-security-traffic": "Configure same security traffic", "packet-tracer": "Trace packet through the security appliance", xlate: "Current translation information", conn: "Connection",
  nameif_: "", "policy-map": "Configure MPF Policy Map", inspect: "Protocol inspection", dhcpd: "Configure DHCP Server", aaa: "Enable, disable, or view user authentication, authorization and accounting",
  authentication: "Enable or disable user authentication", "factory-default": "Configure factory default", "interface_": "", http: "Configure http server and https related commands",
  pager: "Control page length for pagination", failover: "Show failover status", "service-policy": "Show/configure service policy", host: "Enter a host IP address", subnet: "Enter a network IP address and mask",
  security: "Security", "route_": "", global: "Apply to all interfaces"});

// ======================================================================= EXEC
defCmd(A("user"), "enable", s => doEnable(s));
defCmd(A("priv"), "disable", s => { s.mode = "user"; });
["exit", "quit", "logout"].forEach(k => defCmd(AEX, k, s => { if (s.via === "console") s.term.print("\nLogoff\n\nType help or '?' for a list of available commands.\n"); endSession(s); }));
defCmd(A("priv"), "configure terminal", s => { s.mode = "config"; s.ctx = {}; });
defCmd(AEX, "terminal pager <0-2147483647>", () => {});
defCmd(AEX, "terminal pager lines <0-2147483647>", () => {});
defCmd(AEX, "ping <HOST>", (s, a) => iosPing(s, a[0]));
defCmd(AEX, "ping <WORD> <HOST>", (s, a) => { if (!ifByNameif(s.dev, a[0])) { asaErr(s, `ERROR: % Invalid input detected at '^' marker.`); return; } iosPing(s, a[1]); });
defCmd(AEX, "traceroute <HOST>", (s, a) => iosTrace(s, a[0]));
const asaChecksum = d => { const h = hash32(JSON.stringify(d.cfg)); return [h, hash32("a" + h), hash32("b" + h), hash32("c" + h)].map(x => x.toString(16).padStart(8, "0")).join(" "); };
const asaWrite = s => { const d = s.dev; iosPr(s, `Building configuration...\nCryptochecksum: ${asaChecksum(d)} \n\n${asaRunningConfig(d).length} bytes copied in 0.${100 + hash32(d.id) % 400} secs\n[OK]`); saveStartup(d); if (typeof activityCheck === "function") activityCheck(); };
defCmd(A("priv"), "write memory", asaWrite);
defCmd(A("priv"), "write", asaWrite);
defCmd(A("priv"), "write terminal", s => iosPr(s, asaRunningConfig(s.dev)));
defCmd(A("priv"), "copy running-config startup-config", s => { s.pending = {prompt: "\nSource filename [running-config]? ", fn: () => asaWrite(s)}; });
defCmd(A("priv"), "write erase", s => { s.pending = {prompt: "Erase configuration in flash memory? [confirm]", fn: v => { if (/^n/i.test(v)) return; s.dev.startup = null; save(); iosPr(s, "[OK]"); }}; });
defCmd(A("priv"), "reload", s => {
  const d = s.dev, dirty = !d.startup || d.startup !== JSON.stringify(d.cfg);
  const go = () => { s.pending = {prompt: "Proceed with reload? [confirm]", fn: v => {
    if (/^n/i.test(v)) return;
    const T = s.term;
    T.runAsync([[200, "\n\n***\n*** --- START GRACEFUL SHUTDOWN ---\nShutting down isakmp\nShutting down webvpn\nShutting down sw-module\nShutting down License Controller\nShutting down File system\n\n***\n*** --- SHUTDOWN NOW ---\n"], [700, "\nRebooting....\n\nCisco Systems ROMMON Version (1.1.8) #0: Thu Dec 28 13:42:35 PST 2017\n"], [700, `Booting disk0:/asa${asaVer(d).replace(/\D/g, "")}-lfbff-k8.SPA...\n`], [800, `Loading...\n\nCisco Adaptive Security Appliance Software Version ${asaVer(d)}\n`], [400, `${d.startup ? "" : "\nINFO: Converting to factory-default configuration.\n"}`]], () => {
      if (!d.startup) { d.cfg = null; initDevice(d); resetRuntime(d); render(); save(); } else reloadDevice(d);
      while (T.stack.length) T.pop();
      T.print(`\nType help or '?' for a list of available commands.\n`); T.awaitReturn = true; startIOS(T, d, "console"); T.refresh();
    });
  }}; };
  if (dirty) s.pending = {prompt: "\nSystem config has been modified. Save? [Y]es/[N]o: ", fn: v => { if (!/^n/i.test(v.trim())) asaWrite(s); go(); }};
  else go();
});
defCmd(AEX, "clear xlate", s => { rt(s.dev).xl = []; rt(s.dev).conns = []; });
defCmd(AEX, "clear conn", s => { rt(s.dev).conns = []; });
defCmd(AEX, "clear conn all", s => { rt(s.dev).conns = []; });
defCmd(AEX, "clear access-list <WORD> counters", (s, a) => { const h = rt(s.dev).aclHits || {}; ((s.dev.cfg.acls[a[0]] || {}).entries || []).forEach(e => delete h[e.id]); });
defCmd(AEX, "clear access-list counters", s => { rt(s.dev).aclHits = {}; });
defCmd(AEX, "clear logging buffer", s => { rt(s.dev).log = []; });
defCmd(AEX, "clear arp", s => { rt(s.dev).arp = {}; });
defCmd(AEX, "clear nat counters", s => { rt(s.dev).natHits = {}; });

// ---- show
defCmd(AEX, "show version", s => {
  const d = s.dev, up = Math.max(1, Math.round(performance.now() / 1000));
  const ports = asaPhys(d).map((p, k) => ` ${k}: ${/^M/.test(p) ? "Int" : "Ext"}: ${pad(longIf(p), 22)}: address is ${macOf(d, p)}, irq 255`).join("\n");
  iosPr(s, `\nCisco Adaptive Security Appliance Software Version ${asaVer(d)} \nFirepower Extensible Operating System Version 2.2(2.97)\nDevice Manager Version 7.${asaVer(d).split(".")[1].replace(/\D.*/, "")}(1)\n\nCompiled on Fri 23-Mar-18 10:28 PDT by builders\nSystem image file is "disk0:/asa${asaVer(d).replace(/\D/g, "")}-lfbff-k8.SPA"\nConfig file at boot was "startup-config"\n\n${d.cfg.hostname} up ${Math.floor(up / 3600)} hours ${Math.floor(up / 60) % 60} mins\n\nHardware:   ${asaHw(d)}\nInternal ATA Compact Flash, 8000MB\nBIOS Flash M25P32 @ 0xfed01000, 16384KB\n\nEncryption hardware device : Cisco ASA Crypto on-board accelerator (revision 0x1)\n\n${ports}\n\nLicensed features for this platform:\nMaximum Physical Interfaces       : Unlimited      perpetual\nMaximum VLANs                     : 50             perpetual\nInside Hosts                      : Unlimited      perpetual\nFailover                          : Active/Standby perpetual\nEncryption-DES                    : Enabled        perpetual\nEncryption-3DES-AES               : Enabled        perpetual\nCarrier                           : Disabled       perpetual\nAnyConnect Premium Peers          : 4              perpetual\nTotal VPN Peers                   : 50             perpetual\nBotnet Traffic Filter             : Disabled       perpetual\n\nThis platform has an ASA 5506 Security Plus license.\n\nSerial Number: ${asaSerial(d)}\nRunning Permanent Activation Key: 0x2b2b4f53 0x08c4f1d8 0x2c9a0d70 0x8b8810c0 0x0e3a3b11 \nConfiguration register is 0x1\nImage type          : Release\nKey Version         : A\nConfiguration ${d.startup && d.startup !== JSON.stringify(d.cfg) ? "last modified by enable_15 at " + new Date().toTimeString().slice(0, 8) + " UTC" : "has not been modified since last system restart"}.`);
});
defCmd(AEX, "show interface ip brief", s => {
  const d = s.dev, L = ["Interface                  IP-Address      OK? Method Status                Protocol"];
  asaIfOrder(d).forEach(n => { const i = d.cfg.ifaces[n], st = ifStatus(d, n); L.push(pad(longIf(n), 27) + pad(i.ip || "unassigned", 16) + "YES " + pad(i.ip ? "CONFIG" : "unset", 7) + pad(st.status, 22) + st.proto); });
  iosPr(s, L.join("\n"));
});
const asaIfOrder = d => [...asaPhys(d), ...Object.keys(d.cfg.ifaces).filter(n => !asaPhys(d).includes(n)).sort()].filter(n => d.cfg.ifaces[n]);
function asaIfDetail(d, n) {
  const i = d.cfg.ifaces[n], st = ifStatus(d, n), mac = macOf(d, parentIf(n)), stats = rt(d).stats[n] || 0;
  return `Interface ${longIf(n)} "${i.nameif || ""}", is ${st.status}, line protocol is ${st.proto}\n  Hardware is Accelerator rev01, BW 1000 Mbps, DLY 10 usec\n\tAuto-Duplex(${st.proto === "up" ? "Full-duplex" : "Half-duplex"}), Auto-Speed(${st.proto === "up" ? "1000 Mbps" : "10 Mbps"})\n\tInput flow control is unsupported, output flow control is off\n${i.desc ? "\tDescription: " + i.desc + "\n" : ""}\tMAC address ${mac}, MTU ${d.cfg.mtu[i.nameif] || (i.nameif ? 1500 : "not set")}\n\tIP address ${i.ip || "unassigned"}${i.ip ? ", subnet mask " + i.mask : ""}\n\t${stats} packets input, ${stats * 98} bytes, 0 no buffer\n\tReceived 0 broadcasts, 0 runts, 0 giants\n\t0 input errors, 0 CRC, 0 frame, 0 overrun, 0 ignored, 0 abort\n\t0 output errors, 0 collisions, 0 interface resets\n  Traffic Statistics for "${i.nameif || ""}":\n\t${stats} packets input, ${stats * 98} bytes\n\t1 minute input rate 0 pkts/sec,  0 bytes/sec`;
}
defCmd(AEX, "show interface", s => iosPr(s, asaIfOrder(s.dev).map(n => asaIfDetail(s.dev, n)).join("\n")));
defCmd(AEX, "show interface <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); if (!n || !s.dev.cfg.ifaces[n]) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; } iosPr(s, asaIfDetail(s.dev, n)); });
defCmd(AEX, "show nameif", s => {
  const d = s.dev, L = ["Interface                Name                     Security"];
  asaIfOrder(d).filter(n => d.cfg.ifaces[n].nameif).forEach(n => L.push(pad(longIf(n), 25) + pad(d.cfg.ifaces[n].nameif, 25) + String(secOf(d, n)).padStart(3)));
  iosPr(s, L.join("\n"));
});
defCmd(AEX, "show route", s => {
  const d = s.dev, rtab = routeTable(d);
  const L = ["", "Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP", "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area ", "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2", "       E1 - OSPF external type 1, E2 - OSPF external type 2, V - VPN", "       i - IS-IS, su - IS-IS summary, L1 - IS-IS level-1, L2 - IS-IS level-2", "       ia - IS-IS inter area, * - candidate default, U - per-user static route", "       o - ODR, P - periodic downloaded static route, + - replicated route", ""];
  const def = rtab.find(r => r.net === "0.0.0.0" && r.mask === "0.0.0.0");
  L.push(def ? `Gateway of last resort is ${def.nh} to network 0.0.0.0` : "Gateway of last resort is not set", "");
  const nm = n => nameifOf(d, n);
  if (def) L.push(`S*       0.0.0.0 0.0.0.0 [${def.ad || 1}/0] via ${def.nh}, ${nm(def.iface || (lookup(d, def.nh) || {}).iface || "")}`);
  rtab.filter(r => r !== def).sort((a, b) => ipToInt(a.net) - ipToInt(b.net) || maskToLen(a.mask) - maskToLen(b.mask)).forEach(r => {
    const iface = r.iface || (lookup(d, r.nh) || {}).iface;
    L.push(pad(r.code, 9) + `${r.net} ${r.mask} ` + (r.nh ? `[${r.ad || 1}/0] via ${r.nh}, ${nm(iface)}` : `is directly connected, ${nm(iface)}`));
  });
  iosPr(s, L.join("\n"));
});
defCmd(AEX, "show arp", s => { const d = s.dev; iosPr(s, Object.entries(rt(d).arp).map(([ip, e]) => `\t${nameifOf(d, e.iface)} ${ip} ${e.mac} ${e.age || 1}`).join("\n")); });
defCmd(A("priv"), "show running-config", s => iosPr(s, asaRunningConfig(s.dev)));
defCmd(A("priv"), "show running-config <WORD>", (s, a) => iosPr(s, asaRunSection(s.dev, a[0])));
defCmd(A("priv"), "show running-config <WORD> <WORD>", (s, a) => iosPr(s, asaRunSection(s.dev, a[0], a[1])));
defCmd(A("priv"), "show startup-config", s => iosPr(s, s.dev.startup ? asaRunningConfig(s.dev, JSON.parse(s.dev.startup)) : "No Configuration"));
defCmd(AEX, "show clock", s => { const t = new Date(); iosPr(s, `${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, "0")} UTC ${t.toDateString().slice(0, 3)} ${t.toDateString().slice(4)}`); });
defCmd(AEX, "show history", s => iosPr(s, s.hist.map(h => "  " + h).join("\n")));
defCmd(AEX, "show failover", s => iosPr(s, "Failover Off\nFailover unit Primary\nFailover LAN Interface: not Configured\nReconnect timeout 0:00:00\nPoll frequency 1 seconds, holdtime 15 seconds\nInterface Poll frequency 5 seconds, holdtime 25 seconds\nInterface Policy 1\nMonitored Interfaces 0 of 1291 maximum"));
defCmd(AEX, "show cpu usage", s => iosPr(s, "CPU utilization for 5 seconds = 1%; 1 minute: 1%; 5 minutes: 1%"));
defCmd(AEX, "show ssh", s => { const c = s.dev.cfg; iosPr(s, c.mgmt.ssh.map(r => `${pad(r.net, 16)}${pad(r.mask, 16)}${r.ifn}`).join("\n") + (c.mgmt.ssh.length ? "\n" : "") + `\nSSH Version${c.ssh.version === 2 ? " 2" : "s 1 and 2"} ${c.ssh.keyBits ? "are" : "are not"} allowed\n` + (c.ssh.keyBits ? "" : "\nINFO: Please create RSA keys (crypto key generate rsa) to enable SSH.")); });
defCmd(AEX, "show ssh sessions", s => iosPr(s, "SID Client IP       Version Mode Encryption Hmac         State          Username"));
defCmd(AEX, "show dhcpd binding", s => {
  const d = s.dev, L = ["", "IP address       Client Identifier        Lease expiration        Type"];
  Object.entries(rt(d).leases).forEach(([mac, ip]) => L.push(pad(ip, 17) + pad("01" + mac.replace(/\./g, "").replace(/(....)/g, "$1.").replace(/\.$/, ""), 25) + pad("3593 seconds", 24) + "Automatic"));
  iosPr(s, L.join("\n"));
});
defCmd(AEX, "show dhcpd state", s => { const d = s.dev; iosPr(s, `Context  Configured as DHCP Server\n${asaIfOrder(d).filter(n => d.cfg.ifaces[n].nameif).map(n => `Interface ${d.cfg.ifaces[n].nameif}, Configured for DHCP ${d.cfg.dhcpd.enabled[d.cfg.ifaces[n].nameif] ? "SERVER" : "RELAY"}`).join("\n")}`); });
defCmd(AEX, "show logging", s => {
  const d = s.dev, lg = d.cfg.logging, buf = lg.enable && lg.buffered != null ? (rt(d).log || []).filter(e => e.sev <= lg.buffered) : [];
  const lv = v => v == null ? "disabled" : `level ${LOG_LEVELS[v]}, ${buf.length} messages logged`;
  iosPr(s, `Syslog logging: ${lg.enable ? "enabled" : "disabled"}\n    Facility: 20\n    Timestamp logging: disabled\n    Hide Username logging: enabled\n    Standby logging: disabled\n    Debug-trace logging: disabled\n    Console logging: ${lv(lg.console)}\n    Monitor logging: disabled\n    Buffer logging: ${lv(lg.buffered)}\n    Trap logging: disabled\n    Permit-hostdown logging: disabled\n    History logging: disabled\n    Device ID: disabled\n    Mail logging: disabled\n    ASDM logging: ${lv(lg.asdm)}\n${buf.map(e => asaStamp(new Date(e.t)) + ": " + e.msg).join("\n")}`);
});
defCmd(AEX, "show service-policy", s => {
  const d = s.dev, st = rt(d).inspHits || {};
  iosPr(s, `\nGlobal policy: \n  Service-policy: global_policy\n    Class-map: inspection_default\n${Object.keys(d.cfg.inspect).filter(k => d.cfg.inspect[k]).map(k => `      Inspect: ${k}, packet ${st[k.split(" ")[0]] || 0}, lock fail 0, drop 0, reset-drop 0, 5-min-pkt-rate 0 pkts/sec, v6-fail-close 0 sctp-drop-override 0`).join("\n")}`);
});
defCmd(AEX, "show access-list", s => iosPr(s, asaShowAcl(s.dev)));
defCmd(AEX, "show access-list <WORD>", (s, a) => iosPr(s, asaShowAcl(s.dev, a[0])));
defCmd(AEX, "show xlate", s => iosPr(s, asaShowXlate(s.dev)));
defCmd(AEX, "show conn", s => iosPr(s, asaShowConn(s.dev)));
defCmd(AEX, "show conn detail", s => iosPr(s, asaShowConn(s.dev, true)));
defCmd(AEX, "show conn count", s => iosPr(s, `${asaConns(s.dev).length} in use, ${Math.max(asaConns(s.dev).length, rt(s.dev).connMax || 0)} most used`));
defCmd(AEX, "show nat", s => iosPr(s, asaShowNat(s.dev)));
defCmd(AEX, "show nat detail", s => iosPr(s, asaShowNat(s.dev, true)));
defCmd(AEX, "show local-host", s => { const d = s.dev, hosts = {}; asaConns(d).forEach(c => { hosts[c.iIfn + "|" + c.srcR] = 1; hosts[c.rIfn + "|" + c.dstR] = 1; }); iosPr(s, `Interface ${Object.keys(hosts).map(k => k.split("|")[0]).filter((v, i, a) => a.indexOf(v) === i).join(", ") || "none"}: ${Object.keys(hosts).length} active, ${Object.keys(hosts).length} maximum active\n${Object.keys(hosts).map(k => `  local host: <${k.split("|")[1]}>,\n    TCP flow count/limit = 0/unlimited\n    UDP flow count/limit = 0/unlimited`).join("\n")}`); });
defCmd(A("priv"), "packet-tracer input <WORD> <LINE>", (s, a, l) => asaPacketTracerCmd(s, a[0], l));

// ======================================================================= GLOBAL CONFIG
const ACFG = [A("config"), A("if"), A("obj"), A("pmap"), A("pmapc"), A("cmap")];
defCmd(ACFG, "end", s => { s.mode = "priv"; s.ctx = {}; });
defCmd(A("config"), "exit", s => { s.mode = "priv"; s.ctx = {}; });
[A("if"), A("obj"), A("pmap"), A("cmap")].forEach(m => defCmd(m, "exit", s => { s.mode = "config"; s.ctx = {}; }));
defCmd(A("pmapc"), "exit", s => { s.mode = "pmap"; s.ctx = {}; });
defCmd(A("config"), "hostname <WORD>", (s, a) => { s.dev.cfg.hostname = a[0]; });
defCmd(A("config"), "no hostname", s => { s.dev.cfg.hostname = "ciscoasa"; });
defCmd(A("config"), "domain-name <WORD>", (s, a) => { s.dev.cfg.domainName = a[0]; });
defCmd(A("config"), "no domain-name", s => { s.dev.cfg.domainName = ""; });
defCmd(A("config"), "enable password <WORD>", (s, a) => { s.dev.cfg.enablePassword = {t: 5, v: md5Crypt(a[0], randSalt(a[0]))}; });
defCmd(A("config"), "enable password <WORD> level <0-15>", (s, a) => { s.dev.cfg.enablePassword = {t: 5, v: md5Crypt(a[0], randSalt(a[0]))}; });
defCmd(A("config"), "no enable password", s => { s.dev.cfg.enablePassword = null; });
const asaUser = (s, n, pw, priv) => { s.dev.cfg.users[n] = {secret: {t: 5, v: md5Crypt(pw, randSalt(pw))}, priv: priv == null ? 2 : +priv}; };
defCmd(A("config"), "username <WORD> password <WORD>", (s, a) => asaUser(s, a[0], a[1]));
defCmd(A("config"), "username <WORD> password <WORD> privilege <0-15>", (s, a) => asaUser(s, a[0], a[1], a[2]));
defCmd(A("config"), "no username <WORD>", (s, a) => { delete s.dev.cfg.users[a[0]]; });
defCmd(A("config"), "banner motd <LINE>", (s, a) => { const c = s.dev.cfg; c.banner = c.banner ? c.banner + "\n" + a[0] : a[0]; });
defCmd(A("config"), "no banner motd", s => { s.dev.cfg.banner = ""; });
defCmd(A("config"), "interface <IFACE>", (s, a) => {
  const d = s.dev, n = resolveIf(d, a[0]);
  if (!n || /^(Vlan|Loopback)/.test(n)) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; }
  if (/\.\d+$/.test(n) && !d.cfg.ifaces[n]) d.cfg.ifaces[n] = {shutdown: false, desc: "", ip: "", mask: "", helper: [], nameif: "", sec: null};
  s.mode = "if"; s.ctx = {ifaces: [n]};
});
defCmd(A("config"), "no interface <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); if (n && /\.\d+$/.test(n)) delete s.dev.cfg.ifaces[n]; });
defCmd(A("config"), "route <WORD> <LINE>", (s, a, l) => {
  const d = s.dev, t = restToks(l, 2), net = ip0(t[0]), mask = ip0(t[1]), gw = t[2], metric = t[3] ? +t[3] : 1;
  if (!ifByNameif(d, a[0])) { lineErr(s, l, 1); return; }
  if (!isIp(net)) { lineErr(s, l, 2); return; } if (!isMask(mask)) { lineErr(s, l, 3); return; } if (!isIp(gw)) { lineErr(s, l, 4); return; }
  if (t[4] || !(metric >= 1 && metric <= 255)) { lineErr(s, l, 5); return; }
  if (netOf(net, mask) !== net) { asaErr(s, "ERROR: Cannot add route entry, possible conflict with existing routes. (network and mask are inconsistent)"); return; }
  d.cfg.routes = d.cfg.routes.filter(r => !(r.net === net && r.mask === mask && r.nh === gw));
  d.cfg.routes.push({net, mask, nh: gw, ad: metric, ifn: a[0]});
});
defCmd(A("config"), "no route <WORD> <LINE>", (s, a, l) => { const t = restToks(l, 3), net = ip0(t[0]), mask = ip0(t[1]); s.dev.cfg.routes = s.dev.cfg.routes.filter(r => !(r.ifn === a[0] && r.net === net && r.mask === mask && (!t[2] || r.nh === t[2]))); });
defCmd(A("config"), "object network <WORD>", (s, a) => { const c = s.dev.cfg; if (!c.objects[a[0]]) c.objects[a[0]] = {type: "", a: "", b: "", desc: ""}; s.mode = "obj"; s.ctx = {obj: a[0]}; });
defCmd(A("config"), "no object network <WORD>", (s, a) => {
  const c = s.dev.cfg, used = Object.values(c.acls).some(x => x.entries.some(e => (e.src && e.src.obj === a[0]) || (e.dst && e.dst.obj === a[0]))) || c.twiceNat.some(r => r.src === a[0] || r.to === a[0]);
  if (used) { asaErr(s, `ERROR: unable to delete object (${a[0]}). Object is being used.`); return; }
  delete c.objects[a[0]];
});
defCmd(A("config"), "access-list <WORD> <LINE>", (s, a, l) => asaAclCmd(s, a[0], l, false));
defCmd(A("config"), "no access-list <WORD> <LINE>", (s, a, l) => asaAclCmd(s, a[0], l, true));
["in", "out"].forEach(dir => {
  defCmd(A("config"), `access-group <WORD> ${dir} interface <WORD>`, (s, a) => {
    const c = s.dev.cfg;
    if (!c.acls[a[0]]) { asaErr(s, `ERROR: access-list ${a[0]} does not exist`); return; }
    if (!ifByNameif(s.dev, a[1])) { asaErr(s, `ERROR: '${a[1]}' is not a valid interface name`); return; }
    (c.accessGroups[a[1]] = c.accessGroups[a[1]] || {})[dir] = a[0];
  });
  defCmd(A("config"), `no access-group <WORD> ${dir} interface <WORD>`, (s, a) => { const g = s.dev.cfg.accessGroups[a[1]]; if (g && g[dir] === a[0]) delete g[dir]; });
});
defCmd(A("config"), "nat <WORD> source <LINE>", (s, a, l) => asaTwiceNat(s, a[0], l, false));
defCmd(A("config"), "no nat <WORD> source <LINE>", (s, a, l) => asaTwiceNat(s, a[0], l, true));
["inter-interface", "intra-interface"].forEach(k => {
  defCmd(A("config"), "same-security-traffic permit " + k, s => { s.dev.cfg.sameSec[k.split("-")[0]] = true; });
  defCmd(A("config"), "no same-security-traffic permit " + k, s => { s.dev.cfg.sameSec[k.split("-")[0]] = false; });
});
defCmd(A("config"), "policy-map global_policy", s => { s.mode = "pmap"; s.ctx = {}; });
defCmd(A("config"), "class-map inspection_default", s => { s.mode = "cmap"; s.ctx = {}; });
defCmd(A("cmap"), "match default-inspection-traffic", () => {});
defCmd(A("config"), "service-policy global_policy global", () => {});
defCmd(A("pmap"), "class inspection_default", s => { s.mode = "pmapc"; s.ctx = {}; });
defCmd(A("pmapc"), "inspect <WORD>", (s, a) => asaInspect(s, a[0], true));
defCmd(A("pmapc"), "inspect <WORD> <WORD>", (s, a) => asaInspect(s, a[0] + " " + a[1], true));
defCmd(A("pmapc"), "no inspect <WORD>", (s, a) => asaInspect(s, a[0], false));
defCmd(A("pmapc"), "no inspect <WORD> <WORD>", (s, a) => asaInspect(s, a[0] + " " + a[1], false));
function asaInspect(s, k, on) {
  const c = s.dev.cfg, key = k.toLowerCase().replace(/^dns$/, "dns preset_dns_map");
  const known = ["icmp", "icmp error", "http", "ftp", "dns preset_dns_map", "tftp", "sip", "sqlnet", "esmtp", "rtsp", "skinny", "sunrpc", "xdmcp", "netbios", "rsh", "h323 h225", "h323 ras", "ip-options", "pptp", "snmp"];
  if (!known.includes(key)) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; }
  if (on) c.inspect[key] = true; else delete c.inspect[key];
}
// management access
["ssh", "telnet", "http"].forEach(k => {
  defCmd(A("config"), `${k} <A.B.C.D> <MASK> <WORD>`, (s, a) => {
    a = [ip0(a[0]), ip0(a[1]), a[2]];
    const c = s.dev.cfg; if (!ifByNameif(s.dev, a[2])) { asaErr(s, `ERROR: '${a[2]}' is not a valid interface name`); return; }
    if (!isMask(a[1])) { asaErr(s, "ERROR: Invalid netmask"); return; }
    if (!c.mgmt[k].some(r => r.net === netOf(a[0], a[1]) && r.mask === a[1] && r.ifn === a[2])) c.mgmt[k].push({net: netOf(a[0], a[1]), mask: a[1], ifn: a[2]});
  });
  defCmd(A("config"), `no ${k} <A.B.C.D> <MASK> <WORD>`, (s, a) => { a = [ip0(a[0]), ip0(a[1]), a[2]]; const c = s.dev.cfg; c.mgmt[k] = c.mgmt[k].filter(r => !(r.net === netOf(a[0], a[1]) && r.mask === a[1] && r.ifn === a[2])); });
});
defCmd(A("config"), "ssh version <1-2>", (s, a) => { s.dev.cfg.ssh.version = +a[0]; });
defCmd(A("config"), "ssh timeout <1-60>", (s, a) => { s.dev.cfg.mgmt.sshTimeout = +a[0]; });
defCmd(A("config"), "telnet timeout <1-1440>", (s, a) => { s.dev.cfg.mgmt.telnetTimeout = +a[0]; });
defCmd(A("config"), "ssh key-exchange group <WORD>", () => {});
defCmd(A("config"), "http server enable", s => { s.dev.cfg.mgmt.httpServer = true; });
defCmd(A("config"), "no http server enable", s => { s.dev.cfg.mgmt.httpServer = false; });
["ssh", "telnet", "http", "serial"].forEach(k => {
  defCmd(A("config"), `aaa authentication ${k} console LOCAL`, s => { s.dev.cfg.aaa[k] = true; if (k === "serial") s.dev.cfg.lines.con.loginLocal = true; });
  defCmd(A("config"), `no aaa authentication ${k} console LOCAL`, s => { s.dev.cfg.aaa[k] = false; if (k === "serial") s.dev.cfg.lines.con.loginLocal = false; });
});
const asaRsa = (s, bits) => {
  const c = s.dev.cfg, go = () => { c.ssh.keyBits = bits; iosPr(s, "INFO: The name for the keys will be: <Default-RSA-Key>\nKeypair generation process begin. Please wait..."); save(); };
  if (c.ssh.keyBits) { iosPr(s, "WARNING: You have a RSA keypair already defined named <Default-RSA-Key>.\n"); s.pending = {prompt: "Do you really want to replace them? [yes/no]: ", fn: v => { if (/^y/i.test(v.trim())) go(); }}; }
  else go();
};
defCmd(A("config"), "crypto key generate rsa", s => asaRsa(s, 2048));
defCmd(A("config"), "crypto key generate rsa modulus <512-4096>", (s, a) => { if (![512, 768, 1024, 2048, 4096].includes(+a[0])) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; } asaRsa(s, +a[0]); });
defCmd(A("config"), "crypto key zeroize rsa", s => { s.pending = {prompt: "WARNING: All RSA keys will be removed.\nWARNING: All device digital certificates issued using these keys will also be removed.\nDo you really want to remove these keys? [yes/no]: ", fn: v => { if (/^y/i.test(v.trim())) s.dev.cfg.ssh.keyBits = 0; }}; });
// DHCP server
defCmd(A("config"), "dhcpd address <WORD> <WORD>", (s, a) => {
  const d = s.dev, m = a[0].match(/^(\d+\.\d+\.\d+\.\d+)-(\d+\.\d+\.\d+\.\d+)$/), n = ifByNameif(d, a[1]);
  if (!m || !isIp(m[1]) || !isIp(m[2]) || ipToInt(m[2]) < ipToInt(m[1])) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; }
  if (!n) { asaErr(s, `ERROR: '${a[1]}' is not a valid interface name`); return; }
  const i = d.cfg.ifaces[n];
  if (!i.ip || !sameNet(m[1], i.ip, i.mask) || !sameNet(m[2], i.ip, i.mask)) { asaErr(s, `ERROR: Address range subnet ${m[1]}/${m[2]} is not the same as ${a[1]} interface subnet`); return; }
  if (ipToInt(m[2]) - ipToInt(m[1]) >= 256) { asaErr(s, "WARNING: Pool range exceeds the maximum of 256 addresses; it was truncated"); }
  d.cfg.dhcpd.pools[a[1]] = {start: m[1], end: intToIp(Math.min(ipToInt(m[2]), ipToInt(m[1]) + 255))};
});
defCmd(A("config"), "no dhcpd address <WORD> <WORD>", (s, a) => { delete s.dev.cfg.dhcpd.pools[a[1]]; });
defCmd(A("config"), "dhcpd dns <A.B.C.D>", (s, a) => { s.dev.cfg.dhcpd.dns = [a[0]]; });
defCmd(A("config"), "dhcpd dns <A.B.C.D> <A.B.C.D>", (s, a) => { s.dev.cfg.dhcpd.dns = [a[0], a[1]]; });
defCmd(A("config"), "dhcpd domain <WORD>", (s, a) => { s.dev.cfg.dhcpd.domain = a[0]; });
defCmd(A("config"), "dhcpd option 3 ip <A.B.C.D>", (s, a) => { s.dev.cfg.dhcpd.router = a[0]; });
defCmd(A("config"), "dhcpd enable <WORD>", (s, a) => {
  const c = s.dev.cfg; if (!ifByNameif(s.dev, a[0])) { asaErr(s, `ERROR: '${a[0]}' is not a valid interface name`); return; }
  if (!c.dhcpd.pools[a[0]]) { asaErr(s, `ERROR: DHCP server address pool is not configured for ${a[0]}`); return; }
  c.dhcpd.enabled[a[0]] = true; autoDhcp(300);
});
defCmd(A("config"), "no dhcpd enable <WORD>", (s, a) => { delete s.dev.cfg.dhcpd.enabled[a[0]]; });
// logging
defCmd(A("config"), "logging enable", s => { s.dev.cfg.logging.enable = true; });
defCmd(A("config"), "no logging enable", s => { s.dev.cfg.logging.enable = false; });
["buffered", "console", "asdm"].forEach(k => {
  defCmd(A("config"), `logging ${k} <WORD>`, (s, a) => { const v = logLevel(a[0]); if (v < 0) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; } s.dev.cfg.logging[k] = v; });
  defCmd(A("config"), `no logging ${k}`, s => { s.dev.cfg.logging[k] = null; });
});
defCmd(A("config"), "logging timestamp", () => {});
defCmd(A("config"), "mtu <WORD> <64-9198>", (s, a) => { s.dev.cfg.mtu[a[0]] = +a[1]; });
defCmd(A("config"), "names", () => {});
defCmd(A("config"), "pager lines <0-2147483647>", () => {});
defCmd(A("config"), "configure factory-default", s => {
  const d = s.dev, c = d.cfg;
  iosPr(s, "WARNING: The boot system configuration will be cleared.\nThe first image found in disk0:/ will be used to boot the\nsystem on the next reload.\nVerify there is a valid image on disk0:/ or the system will\nnot boot.\n\nBegin to apply factory-default configuration:\nClear all configuration");
  c.hostname = "ciscoasa"; asaBlank(c, d); asaFactory(c, d); resetRuntime(d);
  const ps = asaPhys(d);
  iosPr(s, `Executing command: interface ${longIf(ps[1])}\nExecuting command: nameif inside\nINFO: Security level for "inside" set to 100 by default.\nExecuting command: ip address 192.168.1.1 255.255.255.0\nExecuting command: security-level 100\nExecuting command: no shutdown\nExecuting command: exit\nExecuting command: interface ${longIf(ps[0])}\nExecuting command: nameif outside\nINFO: Security level for "outside" set to 0 by default.\nExecuting command: security-level 0\nExecuting command: no shutdown\nExecuting command: exit\nExecuting command: http server enable\nExecuting command: http 192.168.1.0 255.255.255.0 inside\nExecuting command: dhcpd address 192.168.1.5-192.168.1.254 inside\nExecuting command: dhcpd enable inside\nExecuting command: logging asdm informational\nFactory-default configuration is completed`);
  autoDhcp(300);
});
defCmd(A("config"), "clear configure all", s => { const d = s.dev; asaBlank(d.cfg, d); d.cfg.hostname = "ciscoasa"; resetRuntime(d); });
defCmd(A("config"), "clear configure access-list", s => { const c = s.dev.cfg; c.acls = {}; c.accessGroups = {}; });
defCmd(A("config"), "clear configure access-list <WORD>", (s, a) => { const c = s.dev.cfg; delete c.acls[a[0]]; Object.values(c.accessGroups).forEach(g => { if (g.in === a[0]) delete g.in; if (g.out === a[0]) delete g.out; }); });
defCmd(A("config"), "clear configure access-group", s => { s.dev.cfg.accessGroups = {}; });
defCmd(A("config"), "clear configure nat", s => { const c = s.dev.cfg; c.twiceNat = []; Object.values(c.objects).forEach(o => delete o.nat); });
defCmd(A("config"), "clear configure object", s => { const c = s.dev.cfg; c.objects = {}; c.twiceNat = []; });
defCmd(A("config"), "clear configure route", s => { s.dev.cfg.routes = []; });
defCmd(A("config"), "clear configure dhcpd", s => { s.dev.cfg.dhcpd = {pools: {}, enabled: {}, dns: [], domain: "", router: ""}; });

// ======================================================================= INTERFACE CONFIG
const asaIf = s => s.dev.cfg.ifaces[s.ctx.ifaces[0]];
defCmd(A("if"), "nameif <WORD>", (s, a) => {
  const d = s.dev, n = s.ctx.ifaces[0], other = ifByNameif(d, a[0]);
  if (!/^[A-Za-z][\w.-]{0,47}$/.test(a[0])) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; }
  if (other && other !== n) { asaErr(s, `ERROR: Name ${a[0]} is already used by interface ${longIf(other)}`); return; }
  const i = asaIf(s), old = i.nameif; i.nameif = a[0];
  if (i.sec == null || old !== a[0]) { i.sec = a[0].toLowerCase() === "inside" ? 100 : 0; iosPr(s, `INFO: Security level for "${a[0]}" set to ${i.sec} by default.`); }
});
defCmd(A("if"), "no nameif", s => { const i = asaIf(s); i.nameif = ""; i.sec = null; });
defCmd(A("if"), "security-level <0-100>", (s, a) => { const i = asaIf(s); i.sec = +a[0]; });
defCmd(A("if"), "no security-level", s => { asaIf(s).sec = null; });
defCmd(A("if"), "ip address <A.B.C.D> <MASK>", (s, a) => {
  const d = s.dev, n = s.ctx.ifaces[0], [ip, mask] = a;
  if (!isMask(mask)) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; }
  if (ip === netOf(ip, mask) || ip === bcastOf(ip, mask)) { asaErr(s, `ERROR: ${ip === netOf(ip, mask) ? "Network" : "Broadcast"} address cannot be assigned to an interface`); return; }
  const clash = Object.entries(d.cfg.ifaces).find(([k, x]) => k !== n && x.ip && (sameNet(ip, x.ip, x.mask) || sameNet(x.ip, ip, mask)));
  if (clash) { asaErr(s, `ERROR: Failed to set IP address. ${netOf(ip, mask)} overlaps with interface ${longIf(clash[0])} (${clash[1].nameif || "no nameif"}).`); return; }
  Object.assign(asaIf(s), {ip, mask});
});
defCmd(A("if"), "no ip address", s => Object.assign(asaIf(s), {ip: "", mask: ""}));
defCmd(A("if"), "shutdown", s => { asaIf(s).shutdown = true; });
defCmd(A("if"), "no shutdown", s => { asaIf(s).shutdown = false; });
defCmd(A("if"), "description <LINE>", (s, a) => { asaIf(s).desc = a[0]; });
defCmd(A("if"), "no description", s => { asaIf(s).desc = ""; });
defCmd(A("if"), "vlan <1-4094>", (s, a) => { if (!/\.\d+$/.test(s.ctx.ifaces[0])) { asaErr(s, "ERROR: % Invalid input detected at '^' marker."); return; } asaIf(s).dot1q = +a[0]; });
["10", "100", "1000", "auto"].forEach(v => defCmd(A("if"), "speed " + v, s => { asaIf(s).speed = v; }));
["half", "full", "auto"].forEach(v => defCmd(A("if"), "duplex " + v, s => { asaIf(s).duplex = v; }));
defCmd(A("if"), "management-only", () => {});

// ======================================================================= NETWORK OBJECTS + object NAT
const asaObj = s => s.dev.cfg.objects[s.ctx.obj];
defCmd(A("obj"), "host <A.B.C.D>", (s, a) => Object.assign(asaObj(s), {type: "host", a: a[0], b: ""}));
defCmd(A("obj"), "subnet <A.B.C.D> <MASK>", (s, a) => { if (!isMask(a[1])) { asaErr(s, "ERROR: Invalid netmask"); return; } if (netOf(a[0], a[1]) !== a[0]) { asaErr(s, `ERROR: IP address,mask <${a[0]},${a[1]}> doesn't pair`); return; } Object.assign(asaObj(s), {type: "subnet", a: a[0], b: a[1]}); });
defCmd(A("obj"), "range <A.B.C.D> <A.B.C.D>", (s, a) => { if (ipToInt(a[1]) < ipToInt(a[0])) { asaErr(s, "ERROR: Invalid IP address range. Start address must be less than or equal to the end address"); return; } Object.assign(asaObj(s), {type: "range", a: a[0], b: a[1]}); });
defCmd(A("obj"), "description <LINE>", (s, a) => { asaObj(s).desc = a[0]; });
defCmd(A("obj"), "nat <WORD> <LINE>", (s, a, l) => {
  const d = s.dev, o = asaObj(s), m = a[0].match(/^\(([\w.-]+),([\w.-]+)\)$/), t = restToks(l, 2);
  if (!m) { lineErr(s, l, 1); return; }
  for (const nm of [m[1], m[2]]) if (nm !== "any" && !ifByNameif(d, nm)) { asaErr(s, `ERROR: '${nm}' is not a valid interface name`); return; }
  if (!o.type) { asaErr(s, "ERROR: NAT is not supported for an object without a host, subnet or range"); return; }
  const type = (t[0] || "").toLowerCase();
  if (type !== "dynamic" && type !== "static") { lineErr(s, l, 2); return; }
  const to = t[1]; if (!to) { lineErr(s, l, 3); return; }
  if (to !== "interface" && !isIp(to) && !d.cfg.objects[to]) { asaErr(s, `ERROR: specified object (${to}) does not exist`); return; }
  let svc = null;
  if (t[2]) {
    if (t[2].toLowerCase() !== "service" || type !== "static") { lineErr(s, l, 4); return; }
    const pr = (t[3] || "").toLowerCase(), rp = portNum(t[4]), mp = portNum(t[5]);
    if (!["tcp", "udp"].includes(pr)) { lineErr(s, l, 5); return; } if (rp == null) { lineErr(s, l, 6); return; } if (mp == null) { lineErr(s, l, 7); return; }
    if (o.type !== "host") { asaErr(s, "ERROR: Port translation is only supported for a host object"); return; }
    svc = {proto: pr, rport: rp, mport: mp};
  }
  if (to === "interface" && type === "static" && !svc) { asaErr(s, "ERROR: Static NAT to the interface address requires a service (port forwarding) clause"); return; }
  o.nat = {real: m[1], mapped: m[2], type, to, svc};
});
defCmd(A("obj"), "no nat", s => { delete asaObj(s).nat; });
defCmd(A("obj"), "no nat <WORD> <LINE>", s => { delete asaObj(s).nat; });

// ---- twice NAT:  nat (inside,outside) source dynamic|static <any|obj> <interface|obj|ip>
function asaTwiceNat(s, ifpair, l, del) {
  const d = s.dev, m = ifpair.match(/^\(([\w.-]+),([\w.-]+)\)$/), base = del ? 4 : 3, t = restToks(l, base);
  if (!m) { lineErr(s, l, base - 2); return; }
  const type = (t[0] || "").toLowerCase(), src = t[1], to = t[2];
  if (!["dynamic", "static"].includes(type)) { lineErr(s, l, base); return; }
  if (!src) { lineErr(s, l, base + 1); return; }
  if (src !== "any" && !d.cfg.objects[src]) { asaErr(s, `ERROR: specified object (${src}) does not exist`); return; }
  if (!to) { lineErr(s, l, base + 2); return; }
  if (to !== "interface" && !isIp(to) && !d.cfg.objects[to]) { asaErr(s, `ERROR: specified object (${to}) does not exist`); return; }
  if (t[3]) { lineErr(s, l, base + 3); return; }
  const rule = {real: m[1], mapped: m[2], type, src, to};
  const same = r => r.real === rule.real && r.mapped === rule.mapped && r.type === rule.type && r.src === rule.src && r.to === rule.to;
  if (del) d.cfg.twiceNat = d.cfg.twiceNat.filter(r => !same(r));
  else if (!d.cfg.twiceNat.some(same)) d.cfg.twiceNat.push(rule);
}

// ---- access-list  NAME [line N] extended permit|deny ...  |  NAME remark TEXT
function asaAclCmd(s, name, l, del) {
  const d = s.dev, base = del ? 3 : 2, t = restToks(l, base);
  let k = 0, line = null;
  if ((t[0] || "").toLowerCase() === "remark") {
    if (del) return;
    const acl = d.cfg.acls[name] || (d.cfg.acls[name] = {type: "extended", entries: []});
    acl.entries.push({id: newAceId(), remark: t.slice(1).join(" ")}); return;
  }
  if ((t[0] || "").toLowerCase() === "line") { line = +t[1]; if (!(line >= 1)) { lineErr(s, l, base + 1); return; } k = 2; }
  if (line && (t[k] || "").toLowerCase() === "remark" && !del) { const acl = d.cfg.acls[name] || (d.cfg.acls[name] = {type: "extended", entries: []}); acl.entries.splice(aclIndexOfLine(acl, line), 0, {id: newAceId(), remark: t.slice(k + 1).join(" ")}); return; }
  if ((t[k] || "").toLowerCase() !== "extended") { lineErr(s, l, base + k); return; }
  const r = parseAce(t.slice(k + 1), "asa", d);
  if (r.err != null) { lineErr(s, l, base + k + 1 + r.err, r.msg); return; }
  const txt = aceText(r.entry, "asa");
  if (del) { const acl = d.cfg.acls[name]; if (!acl) { asaErr(s, `ERROR: access-list <${name}> does not exist`); return; } acl.entries = acl.entries.filter(e => e.remark != null || aceText(e, "asa") !== txt); if (!acl.entries.length) delete d.cfg.acls[name]; return; }
  const acl = d.cfg.acls[name] || (d.cfg.acls[name] = {type: "extended", entries: []});
  if (acl.entries.some(e => e.remark == null && aceText(e, "asa") === txt)) { iosPr(s, `WARNING: <${name}> found duplicate element`); return; }
  const e = Object.assign({id: newAceId()}, r.entry);
  if (line) acl.entries.splice(Math.min(acl.entries.length, aclIndexOfLine(acl, line)), 0, e); else acl.entries.push(e);
}
const aclIndexOfLine = (acl, line) => { let n = 0; for (let i = 0; i < acl.entries.length; i++) { n++; if (n === line) return i; } return acl.entries.length; };

// ======================================================================= RUNNING CONFIG (ASA format)
function asaRunningConfig(d, c) {
  c = c || d.cfg;
  const L = [": Saved", ":", `: Serial Number: ${asaSerial(d)}`, `: Hardware:   ${asaHw(d)}`, ":", `ASA Version ${asaVer(d)} `, "!", `hostname ${c.hostname}`];
  if (c.domainName) L.push(`domain-name ${c.domainName}`);
  if (c.enablePassword) L.push(`enable password ${c.enablePassword.v.replace(/^\$1\$/, "$sha512$5000$").slice(0, 44)} pbkdf2`);
  L.push("names", "no mac-address auto", "");
  const order = [...asaPhys(d), ...Object.keys(c.ifaces).filter(n => !asaPhys(d).includes(n)).sort()];
  order.forEach(n => {
    const i = c.ifaces[n]; if (!i) return;
    L.push("!", `interface ${longIf(n)}`);
    if (i.desc) L.push(` description ${i.desc}`);
    if (i.shutdown) L.push(" shutdown");
    if (i.dot1q) L.push(` vlan ${i.dot1q}`);
    L.push(i.nameif ? ` nameif ${i.nameif}` : " no nameif", i.sec != null ? ` security-level ${i.sec}` : " no security-level", i.ip ? ` ip address ${i.ip} ${i.mask}` : " no ip address");
  });
  L.push("!", "ftp mode passive");
  if (c.domainName) L.push("dns server-group DefaultDNS", ` domain-name ${c.domainName}`);
  if (c.sameSec.inter) L.push("same-security-traffic permit inter-interface");
  if (c.sameSec.intra) L.push("same-security-traffic permit intra-interface");
  Object.entries(c.objects).forEach(([n, o]) => { L.push(`object network ${n}`); if (o.type === "host") L.push(` host ${o.a}`); else if (o.type === "subnet") L.push(` subnet ${o.a} ${o.b}`); else if (o.type === "range") L.push(` range ${o.a} ${o.b}`); if (o.desc) L.push(` description ${o.desc}`); });
  Object.entries(c.acls).forEach(([n, a]) => a.entries.forEach(e => L.push(e.remark != null ? `access-list ${n} remark ${e.remark}` : `access-list ${n} extended ${aceText(e, "asa")}`)));
  L.push("pager lines 24");
  if (c.logging.enable) L.push("logging enable");
  if (c.logging.console != null) L.push(`logging console ${LOG_LEVELS[c.logging.console]}`);
  if (c.logging.buffered != null) L.push(`logging buffered ${LOG_LEVELS[c.logging.buffered]}`);
  if (c.logging.asdm != null) L.push(`logging asdm ${LOG_LEVELS[c.logging.asdm]}`);
  order.forEach(n => { const i = c.ifaces[n]; if (i && i.nameif) L.push(`mtu ${i.nameif} ${c.mtu[i.nameif] || 1500}`); });
  L.push("icmp unreachable rate-limit 1 burst-size 1", "no asdm history enable", "arp timeout 14400", "no arp permit-nonconnected", "arp rate-limit 16384");
  c.twiceNat.forEach(r => L.push(`nat (${r.real},${r.mapped}) source ${r.type} ${r.src} ${r.to}`));
  Object.entries(c.objects).filter(([, o]) => o.nat).forEach(([n, o]) => L.push(`object network ${n}`, ` nat (${o.nat.real},${o.nat.mapped}) ${o.nat.type} ${o.nat.to}${o.nat.svc ? ` service ${o.nat.svc.proto} ${ASA_PNAME[o.nat.svc.rport] || o.nat.svc.rport} ${ASA_PNAME[o.nat.svc.mport] || o.nat.svc.mport}` : ""}`));
  Object.entries(c.accessGroups).forEach(([ifn, g]) => { if (g.in) L.push(`access-group ${g.in} in interface ${ifn}`); if (g.out) L.push(`access-group ${g.out} out interface ${ifn}`); });
  c.routes.forEach(r => L.push(`route ${r.ifn || nameifOf(d, (lookup(d, r.nh) || {}).iface || "")} ${r.net} ${r.mask} ${r.nh} ${r.ad || 1}`));
  L.push("timeout xlate 3:00:00", "timeout pat-xlate 0:00:30", "timeout conn 1:00:00 half-closed 0:10:00 udp 0:02:00 sctp 0:02:00 icmp 0:00:02", "timeout sunrpc 0:10:00 h323 0:05:00 h225 1:00:00 mgcp 0:05:00 mgcp-pat 0:05:00", "timeout floating-conn 0:00:00", "timeout conn-holddown 0:00:15", "user-identity default-domain LOCAL");
  ["ssh", "telnet", "http", "serial"].forEach(k => { if (c.aaa[k]) L.push(`aaa authentication ${k} console LOCAL`); });
  if (c.mgmt.httpServer) L.push("http server enable");
  c.mgmt.http.forEach(r => L.push(`http ${r.net} ${r.mask} ${r.ifn}`));
  L.push("no snmp-server location", "no snmp-server contact", "crypto ipsec security-association pmtu-aging infinite", "crypto ca trustpool policy");
  c.mgmt.telnet.forEach(r => L.push(`telnet ${r.net} ${r.mask} ${r.ifn}`));
  L.push(`telnet timeout ${c.mgmt.telnetTimeout}`, "ssh stricthostkeycheck");
  c.mgmt.ssh.forEach(r => L.push(`ssh ${r.net} ${r.mask} ${r.ifn}`));
  L.push(`ssh timeout ${c.mgmt.sshTimeout}`);
  if (c.ssh.version) L.push(`ssh version ${c.ssh.version}`);
  L.push("ssh key-exchange group dh-group1-sha1", "console timeout 0");
  if (c.dhcpd.dns.length) L.push(`dhcpd dns ${c.dhcpd.dns.join(" ")}`);
  if (c.dhcpd.domain) L.push(`dhcpd domain ${c.dhcpd.domain}`);
  if (c.dhcpd.router) L.push(`dhcpd option 3 ip ${c.dhcpd.router}`);
  Object.entries(c.dhcpd.pools).forEach(([ifn, p]) => { L.push("!", `dhcpd address ${p.start}-${p.end} ${ifn}`); if (c.dhcpd.enabled[ifn]) L.push(`dhcpd enable ${ifn}`); });
  L.push("!", "threat-detection basic-threat", "threat-detection statistics access-list", "no threat-detection statistics tcp-intercept", "dynamic-access-policy-record DfltAccessPolicy");
  Object.entries(c.users).forEach(([u, o]) => L.push(`username ${u} password ${o.secret.v.replace(/^\$1\$/, "$sha512$5000$").slice(0, 44)} pbkdf2${o.priv != null && o.priv !== 2 ? " privilege " + o.priv : ""}`));
  L.push("!", "class-map inspection_default", " match default-inspection-traffic", "!", "!", "policy-map type inspect dns preset_dns_map", " parameters", "  message-length maximum client auto", "  message-length maximum 512", "  no tcp-inspection", "policy-map global_policy", " class inspection_default");
  Object.keys(c.inspect).filter(k => c.inspect[k]).forEach(k => L.push(`  inspect ${k} `));
  L.push(" policy-map type inspect dns migrated_dns_map_1", "!", "service-policy global_policy global", "prompt hostname context ", "no call-home reporting anonymous");
  if (c.banner) c.banner.split("\n").forEach(b => L.push(`banner motd ${b}`));
  L.push(`Cryptochecksum:${asaChecksum({cfg: c}).replace(/ /g, "")}`, ": end");
  return L.join("\n");
}
// show running-config <section>: interface, access-list, nat, object, route, access-group, ssh, http, dhcpd, policy-map, logging, username…
function asaRunSection(d, w, w2) {
  const all = asaRunningConfig(d).split("\n"), key = w.toLowerCase();
  if (key === "all") return all.join("\n");
  if (key === "nat") { const c = d.cfg; return [...c.twiceNat.map(r => `nat (${r.real},${r.mapped}) source ${r.type} ${r.src} ${r.to}`), ...Object.entries(c.objects).filter(([, o]) => o.nat).flatMap(([n, o]) => [`object network ${n}`, ` nat (${o.nat.real},${o.nat.mapped}) ${o.nat.type} ${o.nat.to}${o.nat.svc ? ` service ${o.nat.svc.proto} ${ASA_PNAME[o.nat.svc.rport] || o.nat.svc.rport} ${ASA_PNAME[o.nat.svc.mport] || o.nat.svc.mport}` : ""}`])].join("\n"); }
  if (key === "object") { const c = d.cfg; return Object.entries(c.objects).flatMap(([n, o]) => [`object network ${n}`, ...(o.type === "host" ? [` host ${o.a}`] : o.type === "subnet" ? [` subnet ${o.a} ${o.b}`] : o.type === "range" ? [` range ${o.a} ${o.b}`] : []), ...(o.desc ? [` description ${o.desc}`] : [])]).join("\n"); }
  const blocks = [];
  for (let i = 0; i < all.length; i++) {
    const ln = all[i]; if (/^[ :!]/.test(ln) || !ln) continue;
    const words = ln.toLowerCase().split(" ");
    if (!(words[0].startsWith(key) && key.length >= 2) || (w2 && words[1] !== w2.toLowerCase() && !ln.toLowerCase().includes(" " + w2.toLowerCase()))) continue;
    blocks.push(ln); let j = i + 1; while (j < all.length && /^ /.test(all[j])) blocks.push(all[j++]);
    if (/^(interface|policy-map|class-map)/.test(words[0])) blocks.push("!");
  }
  return blocks.join("\n");
}

// ======================================================================= remote management sessions (telnet / ssh to the ASA)
function asaRemoteLogin(T, fromDev, ip, proto, user, dev) {
  const c = dev.cfg;
  if (!c.aaa[proto === "ssh" ? "ssh" : "telnet"] || !Object.keys(c.users).length) {
    T.print(proto === "ssh" ? "% Connection closed by remote host\n(simulator hint: the ASA needs 'aaa authentication ssh console LOCAL' and a local username)\n" : "\n[Connection closed by foreign host]\n(simulator hint: the ASA needs 'aaa authentication telnet console LOCAL' and a local username)\n");
    return null;
  }
  const s = newSession(dev, proto, T); s.remoteAddr = ip; T.push(s);
  let tries = 0;
  const done = name => { if (typeof actLog === "function") actLog(proto, fromDev, dev); devLog(dev, `%ASA-6-605005: Login permitted from ${hostAddrOf(fromDev)}/${1025 + tries} to ${nameifOf(dev, (l3Ifaces(dev).find(i => i.ip === ip) || {}).name)}:${ip}/${proto} for user "${name}"`, {sev: 6}); if (c.banner) T.print(c.banner + "\n"); T.print("Type help or '?' for a list of available commands.\n"); s.authed = true; s.mode = "user"; T.refresh(); };
  const askPw = name => { s.pending = {prompt: proto === "ssh" ? `${name}@${ip}'s password: ` : "Password: ", secret: true, fn: pw => {
    const u = c.users[name];
    if (u && pwCheck(u.secret || u.password, pw)) { done(name); return; }
    devLog(dev, `%ASA-6-113015: AAA user authentication Rejected : reason = Invalid password : local database : user = ${name}`, {sev: 6});
    if (++tries >= 3) { T.print(proto === "ssh" ? "Permission denied (password).\n" : "Error: Authentication failed\n"); endSession(s); return; }
    T.print(proto === "ssh" ? "Permission denied, please try again.\n" : "Error: Authentication failed\n"); proto === "ssh" ? askPw(name) : askUser(); T.refresh();
  }}; };
  const askUser = () => { s.pending = {prompt: "Username: ", fn: u => askPw(u.trim())}; };
  if (proto === "ssh") askPw(user); else { T.print("\nUser Access Verification\n\n"); askUser(); }
  T.refresh(); return s;
}
const hostAddrOf = d => (l3Ifaces(d).find(i => i.ip) || {}).ip || "0.0.0.0";
