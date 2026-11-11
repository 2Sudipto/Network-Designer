// ======================================================================= IOS COMMANDS
Object.assign(HELP, {
  enable: "Turn on privileged commands", disable: "Turn off privileged commands", exit: "Exit from the EXEC / current mode", logout: "Exit from the EXEC",
  end: "Exit from configure mode", configure: "Enter configuration mode", terminal: "Configure from the terminal", show: "Show running system information",
  ping: "Send echo messages", traceroute: "Trace route to destination", telnet: "Open a telnet connection", ssh: "Open a secure shell client connection",
  copy: "Copy from one file to another", "running-config": "Current operating configuration", "startup-config": "Contents of startup configuration",
  write: "Write running configuration to memory, network, or terminal", memory: "Write to NV memory", erase: "Erase a filesystem", reload: "Halt and perform a cold restart",
  clear: "Reset functions", "arp-cache": "Clear the entire ARP cache", do: "To run exec commands in config mode",
  hostname: "Set system's network name", banner: "Define a login banner", motd: "Set Message of the Day banner", secret: "Assign the privileged level secret",
  password: "Assign the privileged level password", service: "Modify use of network based services", "password-encryption": "Encrypt system passwords",
  ip: "Global IP configuration subcommands", "domain-lookup": "Enable IP Domain Name System hostname translation", "domain-name": "Define the default domain name",
  domain: "IP DNS Resolver", lookup: "Enable IP Domain Name System hostname translation", name: "Name / define a name", username: "Establish User Name Authentication",
  privilege: "Set user privilege level", crypto: "Encryption module", key: "Long term key operations", generate: "Generate new keys", rsa: "Generate RSA keys",
  "general-keys": "Generate a general purpose RSA key pair for signing and encryption", modulus: "Provide number of modulus bits on the command line",
  zeroize: "Remove keys", version: "Specify protocol version", line: "Configure a terminal line", console: "Primary terminal line", vty: "Virtual terminal",
  interface: "Select an interface to configure", range: "interface range command", vlan: "VLAN commands", no: "Negate a command or set its defaults",
  route: "Establish static routes", "default-gateway": "Specify default gateway (if not routing IP)", routing: "Enable IP routing", dhcp: "Configure DHCP server and relay parameters",
  "excluded-address": "Prevent DHCP from assigning certain addresses", pool: "Configure DHCP address pools", cdp: "Global CDP configuration subcommands", run: "Enable CDP",
  "spanning-tree": "Spanning Tree Subsystem", priority: "Set the bridge priority for the spanning tree", root: "Configure switch as root", primary: "Configure this switch as primary root for this spanning tree",
  address: "Set the IP address of an interface", shutdown: "Shutdown the selected interface", description: "Interface specific description", speed: "Configure speed operation.",
  duplex: "Configure duplex operation.", switchport: "Set switching mode characteristics", mode: "Set trunking mode of the interface", access: "Set access mode characteristics of the interface",
  trunk: "Set trunking characteristics of the interface", native: "Set trunking native characteristics when interface is in trunking mode", allowed: "Set allowed VLAN characteristics when interface is in trunking mode",
  add: "add VLANs to the current list", remove: "remove VLANs from the current list", all: "all VLANs", none: "no VLANs", nonegotiate: "Device will not engage in negotiation protocol on this interface",
  encapsulation: "Set encapsulation type for an interface", dot1q: "Interface uses only 802.1q trunking encapsulation when trunking", dot1Q: "IEEE 802.1Q Virtual LAN",
  "helper-address": "Specify a destination address for UDP broadcasts", clock: "Configure serial interface clock", rate: "Configure serial interface clock speed",
  portfast: "Enable an interface to move directly to forwarding on link up", login: "Enable password checking", local: "Local password checking", "exec-timeout": "Set the EXEC timeout",
  transport: "Define transport protocols for line", input: "Define which protocols to use when connecting to the terminal server", logging: "Modify message logging facilities",
  synchronous: "Synchronized message output", network: "Network number and mask", "default-router": "Default routers", "dns-server": "DNS servers",
  brief: "Brief summary of IP status and configuration", interfaces: "Interface status and configuration", arp: "ARP table", "mac-address-table": "MAC forwarding table",
  "mac": "MAC configuration", "address-table": "MAC forwarding table", neighbors: "CDP neighbor entries", detail: "Show detailed information", binding: "DHCP address bindings",
  history: "Display the session command history", clock_: "", users: "Display information about terminal lines", flash: "display information about flash: file system",
  protocols: "Active network routing protocols", dynamic: "dynamic entry type", auto: "Set trunking mode dynamic negotiation parameter to AUTO", desirable: "Set trunking mode dynamic negotiation parameter to DESIRABLE",
  "-l": "Log in using this user name", status: "Show interface line status", "mac-address": "MAC forwarding table", "ip_": "",
});
// ---- helpers
const IOS_VER = d => d.type === "router" ? (/^ISR4|^C8|^ASR/.test(d.model) ? "Cisco IOS XE Software, Version 16.09.04" : "Cisco IOS Software, C2900 Software (C2900-UNIVERSALK9-M), Version 15.1(4)M5, RELEASE SOFTWARE (fc2)") : "Cisco IOS Software, C2960 Software (C2960-LANBASEK9-M), Version 15.0(2)SE4, RELEASE SOFTWARE (fc1)";
const pr = (s, t) => s.term.print(t.endsWith("\n") ? t : t + "\n");
const pad = (x, n) => String(x).padEnd(n);
const shortPort = p => shortIf(p);
function savePw(c, v) { return c.spe ? {t: 7, v: type7Encrypt(v)} : pwPlain(v); }
function curIfs(s) { return s.ctx.ifaces || []; }
function needSwitchport(s) { const d = s.dev; if (!isSwitch(d) || curIfs(s).some(n => isVirtualIf(n))) { pr(s, "% Invalid input detected at '^' marker."); return false; } return true; }
function ifSnap(d) { const o = {}; Object.keys(d.cfg.ifaces).forEach(n => { o[n] = ifStatus(d, n); }); return o; }
function ifDiff(s, before) {
  const d = s.dev; netDirty();
  for (const n of Object.keys(d.cfg.ifaces)) {
    const a = before[n] || {status: "down", proto: "down"}, b = ifStatus(d, n);
    if (a.status !== b.status) pr(s, `\n%LINK-${b.status === "up" ? 5 : b.status === "down" ? 3 : 5}-${b.status === "up" || b.status.startsWith("admin") ? "CHANGED" : "UPDOWN"}: Interface ${longIf(n)}, changed state to ${b.status}`);
    if (a.proto !== b.proto) pr(s, `%LINEPROTO-5-UPDOWN: Line protocol on Interface ${longIf(n)}, changed state to ${b.proto}`);
  }
}
function unsupported(what) { return s => pr(s, `% ${what} is not simulated in this version (see the README roadmap).`); }
function parseRange(d, str) {
  const out = [];
  for (const part of str.split(",")) {
    const m = part.trim().match(/^([a-z]+)\s*((?:\d+\/)*)(\d+)\s*(?:-\s*(\d+))?$/i);
    if (!m) return null;
    const a = +m[3], b = m[4] ? +m[4] : a;
    if (b < a) return null;
    for (let n = a; n <= b; n++) { const r = resolveIf(d, m[1] + m[2] + n); if (!r || isVirtualIf(r) && !/^Vlan/.test(r)) return null; out.push(r); }
  }
  return out;
}
function setPorts(s, fn) { curIfs(s).forEach(n => fn(ifc(s.dev, n), n)); }

// ======================================================================= EXEC (user + privileged)
const EXEC = ["user", "priv"];
defCmd("user", "enable", s => doEnable(s));
defCmd("priv", "enable", () => {});
defCmd("priv", "disable", s => { s.mode = "user"; });
defCmd(EXEC, "exit", s => endSession(s));
defCmd(EXEC, "logout", s => endSession(s));
defCmd(EXEC, "terminal length <0-512>", () => {});
defCmd("priv", "configure terminal", s => { pr(s, "Enter configuration commands, one per line.  End with CNTL/Z."); s.mode = "config"; s.ctx = {}; });
defCmd("priv", "configure", s => { s.pending = {prompt: "Configuring from terminal, memory, or network [terminal]? ", fn: v => { if (!v.trim() || /^t/i.test(v.trim())) { pr(s, "Enter configuration commands, one per line.  End with CNTL/Z."); s.mode = "config"; } }}; });
function copyRunStart(s) {
  s.pending = {prompt: "Destination filename [startup-config]? ", fn: () => { pr(s, "Building configuration...\n[OK]"); saveStartup(s.dev); if (typeof activityCheck === "function") activityCheck(); }};
}
defCmd("priv", "copy running-config startup-config", copyRunStart);
defCmd("priv", "copy startup-config running-config", s => {
  if (!s.dev.startup) { pr(s, "%% Non-volatile configuration memory invalid or not present"); return; }
  s.pending = {prompt: "Destination filename [running-config]? ", fn: () => { const st = JSON.parse(s.dev.startup); Object.assign(s.dev.cfg, st); pr(s, `${s.dev.startup.length} bytes copied in 0.416 secs`); save(); }};
});
defCmd("priv", "write", s => { pr(s, "Building configuration...\n[OK]"); saveStartup(s.dev); if (typeof activityCheck === "function") activityCheck(); });
defCmd("priv", "write memory", s => { pr(s, "Building configuration...\n[OK]"); saveStartup(s.dev); if (typeof activityCheck === "function") activityCheck(); });
const eraseNv = s => { s.pending = {prompt: "Erasing the nvram filesystem will remove all configuration files! Continue? [confirm]", fn: v => { if (/^n/i.test(v)) return; s.dev.startup = null; save(); pr(s, "[OK]\nErase of nvram: complete\n%SYS-7-NV_BLOCK_INIT: Initialized the geometry of nvram"); }}; };
defCmd("priv", "write erase", eraseNv);
defCmd("priv", "erase startup-config", eraseNv);
defCmd("priv", "reload", s => {
  const d = s.dev, dirty = !d.startup || d.startup !== JSON.stringify(d.cfg);
  const go = () => {
    s.pending = {prompt: "Proceed with reload? [confirm]", fn: v => {
      if (/^n/i.test(v)) return;
      const T = s.term;
      T.runAsync([[300, `%SYS-5-RELOAD: Reload requested by console. Reload Reason: Reload Command.\n`], [600, "\nSystem Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\n"], [500, "Initializing memory for ECC\n..\n"], [700, "Self decompressing the image : ###########################  [OK]\n"], [500, `\n${d.startup ? "" : "         --- System Configuration Dialog ---\n\nWould you like to enter the initial configuration dialog? [yes/no]: no\n"}`]], () => {
        reloadDevice(d);
        while (T.stack.length) T.pop();
        T.print(`\nPress RETURN to get started!\n\n`);
        T.awaitReturn = true;
      });
    }};
  };
  if (dirty) s.pending = {prompt: "System configuration has been modified. Save? [yes/no]:", fn: v => {
    if (/^y/i.test(v.trim())) { pr(s, "Building configuration...\n[OK]"); saveStartup(d); go(); }
    else if (/^n/i.test(v.trim())) go();
    else pr(s, "% Please answer 'yes' or 'no'.");
  }};
  else go();
});
defCmd("priv", "clear arp-cache", s => { rt(s.dev).arp = {}; });
defCmd("priv", "clear mac-address-table dynamic", s => { rt(s.dev).mac = {}; });
defCmd("priv", "clear mac address-table dynamic", s => { rt(s.dev).mac = {}; });

// ---- ping / traceroute / telnet / ssh
function resolveHost(s, host) { return isIp(host) ? host : null; }
function iosPing(s, host) {
  const ip = resolveHost(s, host);
  if (!ip) { pr(s, "% Unrecognized host or address, or protocol not running.\n"); return; }
  const T = s.term;
  pr(s, `Type escape sequence to abort.\nSending 5, 100-byte ICMP Echos to ${ip}, timeout is 2 seconds:`);
  let ok = 0;
  const seq = [];
  for (let k = 0; k < 5; k++) seq.push([k ? 280 : 80, () => {
    const R = pingOnce(s.dev, ip, {seq: k}); simCapture(s.dev, "ICMP", R.events);
    const r = R.res;
    const ch = r.res === "reply" ? "!" : r.res === "unreach" ? "U" : r.res === "ttl" ? "&" : ".";
    if (ch === "!") ok++;
    T.print(ch);
  }]);
  T.runAsync(seq, () => T.print(`
Success rate is ${ok * 20} percent (${ok}/5)${ok ? ", round-trip min/avg/max = 0/0/1 ms" : ""}
`));
}
defCmd(EXEC, "ping <HOST>", (s, a) => iosPing(s, a[0]));
function iosTrace(s, host) {
  const ip = resolveHost(s, host);
  if (!ip) { pr(s, "% Unrecognized host or address, or protocol not running.\n"); return; }
  const T = s.term;
  pr(s, `Type escape sequence to abort.\nTracing the route to ${ip}\n`);
  let ttl = 1, done = false, miss = 0;
  const step = () => {
    if (done || ttl > 30 || miss >= 4 || T.cancel) { T.busy = false; T.cancel = false; T.refresh(); return; }
    const R = pingOnce(s.dev, ip, {ttl}); simCapture(s.dev, "ICMP", R.events);
    const r = R.res;
    const r2 = r.res ? r : pingOnce(s.dev, ip, {ttl}).res;
    if (r2.res === "reply" || r2.res === "ttl" || r2.res === "unreach") { T.print(`  ${String(ttl).padStart(2)}   ${pad(r2.from, 16)}0 msec    0 msec    1 msec\n`); miss = 0; if (r2.res !== "ttl") done = true; }
    else { T.print(`  ${String(ttl).padStart(2)}   *         *         *\n`); miss++; }
    ttl++;
    setTimeout(step, r2.res ? 250 : 700);
  };
  T.busy = true; T.refresh(); setTimeout(step, 200);
}
defCmd(EXEC, "traceroute <HOST>", (s, a) => iosTrace(s, a[0]));
function remoteLogin(T, fromDev, ip, proto, user) {
  const port = proto === "ssh" ? 22 : 23;
  if (proto === "telnet") T.print(`Trying ${ip} ...`);
  const r = tcpConnect(fromDev, ip, port);
  simCapture(fromDev, proto, r.events);
  if (!r.ok) {
    T.print(proto === "telnet" ? (r.refused ? "\n% Connection refused by remote host\n" : "\n% Connection timed out; remote host not responding\n") : (r.refused ? "% Connection refused by remote host\n" : "% Connection timed out; remote host not responding\n"));
    return null;
  }
  const dev = r.dev;
  if (!isIOS(dev)) { T.print("\n% Connection refused by remote host\n"); return null; }
  if (proto === "telnet") T.print("Open\n");
  if (proto === "ssh") {
    const v = dev.cfg.lines.vty;
    if (!v.loginLocal) { T.print("% SSH needs local usernames: set 'login local' under line vty (simulator hint)\n"); return null; }
    const s = newSession(dev, "ssh", T); s.remoteAddr = ip; T.push(s);
    let tries = 0;
    const ask = () => {
      s.pending = {prompt: "Password: ", secret: true, fn: pw => {
        const u = dev.cfg.users[user];
        if (u && pwCheck(u.secret || u.password, pw)) { if (dev.cfg.banner) T.print(dev.cfg.banner + "\n"); s.authed = true; s.mode = u.priv === 15 ? "priv" : "user"; T.refresh(); return; }
        if (++tries >= 3) { T.print("% Login invalid\n"); endSession(s); return; }
        T.print("% Login invalid\n"); ask(); T.refresh();
      }};
    };
    ask(); T.refresh(); return s;
  }
  const s = startIOS(T, dev, "telnet");
  if (s) s.remoteAddr = ip;
  return s;
}
defCmd(EXEC, "telnet <HOST>", (s, a) => { const ip = resolveHost(s, a[0]); if (!ip) { pr(s, "% Unknown command or computer name, or unable to find computer address"); return; } remoteLogin(s.term, s.dev, ip, "telnet"); });
defCmd(EXEC, "ssh -l <WORD> <HOST>", (s, a) => { const ip = resolveHost(s, a[1]); if (!ip) { pr(s, "% Unknown command or computer name, or unable to find computer address"); return; } remoteLogin(s.term, s.dev, ip, "ssh", a[0]); });

// ---- show commands
const SHOWM = ["user", "priv"];
defCmd("priv", "show running-config", s => pr(s, runningConfig(s.dev)));
defCmd("priv", "show startup-config", s => pr(s, startupConfig(s.dev) || "startup-config is not present"));
defCmd(SHOWM, "show version", s => {
  const d = s.dev, ports = allPorts(d).filter(p => p !== "Console");
  const ge = ports.filter(p => /^G/i.test(p)).length, fe = ports.filter(p => /^Fa/i.test(p)).length, se = ports.filter(p => portKind(p) === "serial").length;
  pr(s, `${IOS_VER(d)}\nTechnical Support: http://www.cisco.com/techsupport\nCopyright (c) 1986-2016 by Cisco Systems, Inc.\n\nROM: System Bootstrap, Version 15.1(4)M4, RELEASE SOFTWARE (fc1)\n\n${d.cfg.hostname} uptime is ${Math.max(1, Math.round(performance.now() / 60000))} minutes\nSystem returned to ROM by power-on\nSystem image file is "flash:${d.type === "router" ? "c2900-universalk9-mz.SPA.151-4.M5.bin" : "c2960-lanbasek9-mz.150-2.SE4.bin"}"\n\ncisco ${d.model} (revision 1.0) with 491520K/32768K bytes of memory.\n${fe ? fe + " FastEthernet interfaces\n" : ""}${ge ? ge + " Gigabit Ethernet interfaces\n" : ""}${se ? se + " Serial(sync/async) interfaces\n" : ""}64K bytes of non-volatile configuration memory.\n\nConfiguration register is 0x2102`);
});
defCmd(SHOWM, "show ip interface brief", s => {
  const d = s.dev, L = ["Interface              IP-Address      OK? Method Status                Protocol "];
  ifOrder(d).forEach(n => {
    const i = d.cfg.ifaces[n]; if (!i) return; const st = ifStatus(d, n);
    L.push(pad(longIf(n), 23) + pad(i.ip || "unassigned", 16) + "YES " + pad(i.ip ? "manual" : "unset", 7) + pad(st.status, 22) + st.proto + " ");
  });
  pr(s, L.join("\n"));
});
function showIfDetail(s, n) {
  const d = s.dev, i = d.cfg.ifaces[n], st = ifStatus(d, n), mac = macOf(d, parentIf(n));
  const L = [`${longIf(n)} is ${st.status}, line protocol is ${st.proto}${!isVirtualIf(n) ? ` (${st.proto === "up" ? "connected" : st.status.startsWith("admin") ? "disabled" : "notconnect"})` : ""}`];
  L.push(`  Hardware is ${portKind(n) === "serial" ? "HD64570" : /^Vlan/.test(n) ? "CPU Interface" : /^Loop/.test(n) ? "Loopback" : /^G/i.test(n) ? "CN Gigabit Ethernet" : "Lance"}, address is ${mac} (bia ${mac})`);
  if (i.desc) L.push("  Description: " + i.desc);
  if (i.ip) L.push(`  Internet address is ${i.ip}/${maskToLen(i.mask)}`);
  L.push(`  MTU 1500 bytes, BW ${portKind(n) === "serial" ? "1544" : /^G/i.test(n) ? "1000000" : "100000"} Kbit, DLY ${portKind(n) === "serial" ? "20000" : "100"} usec,`, "     reliability 255/255, txload 1/255, rxload 1/255");
  L.push(`  Encapsulation ${portKind(n) === "serial" ? "HDLC" : i.dot1q ? "802.1Q Virtual LAN, Vlan ID  " + i.dot1q : "ARPA"}, loopback not set`);
  if (portKind(n) === "eth" && !isVirtualIf(n)) L.push(`  ${i.duplex === "half" ? "Half" : "Full"}-duplex, ${i.speed && i.speed !== "auto" ? i.speed + "Mb/s" : /^G/i.test(n) ? "1000Mb/s" : "100Mb/s"}, media type is RJ45`);
  L.push("  ARP type: ARPA, ARP Timeout 04:00:00", "  Last input never, output never, output hang never", `     ${rt(d).stats[n] || 0} packets input, 0 bytes, 0 no buffer`);
  return L.join("\n");
}
defCmd(SHOWM, "show interfaces", s => pr(s, ifOrder(s.dev).filter(n => s.dev.cfg.ifaces[n]).map(n => showIfDetail(s, n)).join("\n")));
defCmd(SHOWM, "show interfaces <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); if (!n || !s.dev.cfg.ifaces[n]) { pr(s, "% Invalid input detected at '^' marker."); return; } pr(s, showIfDetail(s, n)); });
defCmd(SHOWM, "show interfaces status", s => {
  if (!isSwitch(s.dev)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  const d = s.dev, L = ["Port      Name               Status       Vlan       Duplex  Speed Type"];
  allPorts(d).filter(p => p !== "Console").forEach(p => { const i = d.cfg.ifaces[p], st = ifStatus(d, p); L.push(pad(shortPort(p), 10) + pad((i.desc || "").slice(0, 18), 19) + pad(st.proto === "up" ? "connected" : st.status.startsWith("admin") ? "disabled" : "notconnect", 13) + pad(i.routed ? "routed" : operTrunk(d, p) ? "trunk" : i.accessVlan, 11) + pad(i.duplex === "auto" ? "auto" : i.duplex, 8) + pad(i.speed, 6) + (/^G/i.test(p) ? "10/100/1000BaseTX" : "10/100BaseTX")); });
  pr(s, L.join("\n"));
});
defCmd(SHOWM, "show interfaces trunk", s => {
  const d = s.dev; if (!isSwitch(d)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  const tr = allPorts(d).filter(p => p !== "Console" && isSwitchport(d, p) && operTrunk(d, p) && ifUp(d, p));
  if (!tr.length) { pr(s, ""); return; }
  const vl = Object.keys(d.cfg.vlans).map(Number);
  const L = ["Port        Mode         Encapsulation  Status        Native vlan"];
  tr.forEach(p => { const i = d.cfg.ifaces[p]; L.push(pad(shortPort(p), 12) + pad(i.mode === "trunk" ? "on" : "auto", 13) + pad("802.1q", 15) + pad("trunking", 14) + (i.nativeVlan || 1)); });
  L.push("", "Port        Vlans allowed on trunk"); tr.forEach(p => L.push(pad(shortPort(p), 12) + (d.cfg.ifaces[p].allowed === "all" ? "1-1005" : d.cfg.ifaces[p].allowed)));
  L.push("", "Port        Vlans allowed and active in management domain"); tr.forEach(p => L.push(pad(shortPort(p), 12) + vlanRanges(vl.filter(v => vlanListHas(d.cfg.ifaces[p].allowed, v)))));
  L.push("", "Port        Vlans in spanning tree forwarding state and not pruned"); tr.forEach(p => L.push(pad(shortPort(p), 12) + (stpBlocked(d, p) ? "none" : vlanRanges(vl.filter(v => vlanListHas(d.cfg.ifaces[p].allowed, v))))));
  pr(s, L.join("\n"));
});
function showVlan(s) {
  const d = s.dev; if (!isSwitch(d)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  const L = ["", "VLAN Name                             Status    Ports", "---- -------------------------------- --------- -------------------------------"];
  Object.keys(d.cfg.vlans).map(Number).sort((a, b) => a - b).forEach(v => {
    const ports = allPorts(d).filter(p => p !== "Console" && isSwitchport(d, p) && !operTrunk(d, p) && (d.cfg.ifaces[p].accessVlan || 1) === v).map(shortPort);
    const chunks = []; for (let i = 0; i < ports.length; i += 4) chunks.push(ports.slice(i, i + 4).join(", "));
    L.push(pad(v, 5) + pad(d.cfg.vlans[v], 33) + pad("active", 10) + (chunks[0] || ""));
    chunks.slice(1).forEach(c => L.push(" ".repeat(48) + c));
  });
  L.push("1002 fddi-default                     active    ", "1003 token-ring-default               active    ", "1004 fddinet-default                  active    ", "1005 trnet-default                    active    ");
  pr(s, L.join("\n"));
}
defCmd(SHOWM, "show vlan brief", showVlan);
defCmd(SHOWM, "show vlan", showVlan);
function showMac(s) {
  const d = s.dev; if (!isSwitch(d)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  const L = ["          Mac Address Table", "-------------------------------------------", "", "Vlan    Mac Address       Type        Ports", "----    -----------       --------    -----", ""];
  Object.values(rt(d).mac).sort((a, b) => a.vlan - b.vlan || a.port.localeCompare(b.port)).forEach(e => L.push(`${String(e.vlan).padStart(4)}    ${e.mac}    DYNAMIC     ${shortPort(e.port)}`));
  pr(s, L.join("\n"));
}
defCmd(SHOWM, "show mac-address-table", showMac);
defCmd(SHOWM, "show mac address-table", showMac);
function showArp(s) {
  const d = s.dev, L = ["Protocol  Address          Age (min)  Hardware Addr   Type   Interface"];
  l3Ifaces(d).filter(i => i.ip && i.up && !i.loop).forEach(i => L.push(`Internet  ${pad(i.ip, 17)}${"-".padStart(8)}   ${i.mac}  ARPA   ${longIf(i.name)}`));
  Object.entries(rt(d).arp).forEach(([ip, e]) => L.push(`Internet  ${pad(ip, 17)}${String(e.age || 0).padStart(8)}   ${e.mac}  ARPA   ${longIf(e.iface)}`));
  pr(s, L.join("\n"));
}
defCmd(SHOWM, "show arp", showArp);
defCmd(SHOWM, "show ip arp", showArp);
defCmd(SHOWM, "show ip route", s => {
  const d = s.dev, rtab = routeTable(d);
  const L = ["Codes: L - local, C - connected, S - static, R - RIP, M - mobile, B - BGP", "       D - EIGRP, EX - EIGRP external, O - OSPF, IA - OSPF inter area", "       N1 - OSPF NSSA external type 1, N2 - OSPF NSSA external type 2", "       E1 - OSPF external type 1, E2 - OSPF external type 2, E - EGP", "       i - IS-IS, L1 - IS-IS level-1, L2 - IS-IS level-2, ia - IS-IS inter area", "       * - candidate default, U - per-user static route, o - ODR", "       P - periodic downloaded static route", ""];
  if (!(isRouterish(d) || d.cfg.ipRouting)) { pr(s, d.cfg.defaultGateway ? `Default gateway is ${d.cfg.defaultGateway}\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty` : "Default gateway is not set\n\nHost               Gateway           Last Use    Total Uses  Interface\nICMP redirect cache is empty"); return; }
  const def = rtab.find(r => r.code === "S*");
  L.push(def ? `Gateway of last resort is ${def.nh || "0.0.0.0"} to network 0.0.0.0` : "Gateway of last resort is not set", "");
  // group by classful network like IOS
  const groups = {};
  rtab.filter(r => r.code !== "S*").forEach(r => { const cn = netOf(r.net, classfulMask(r.net)) + "/" + maskToLen(classfulMask(r.net)); (groups[cn] = groups[cn] || []).push(r); });
  Object.keys(groups).sort((a, b) => ipToInt(a.split("/")[0]) - ipToInt(b.split("/")[0])).forEach(cn => {
    const rs = groups[cn].sort((a, b) => ipToInt(a.net) - ipToInt(b.net) || maskToLen(a.mask) - maskToLen(b.mask));
    const masks = new Set(rs.map(r => r.mask));
    const [cnet, clen] = cn.split("/");
    if (rs.length > 1 || maskToLen(rs[0].mask) !== +clen) L.push(`     ${cnet}/${masks.size > 1 ? clen : maskToLen(rs[0].mask)} is ${masks.size > 1 ? "variably " : ""}subnetted, ${rs.length} subnet${rs.length > 1 ? "s" : ""}${masks.size > 1 ? ", " + masks.size + " masks" : ""}`);
    rs.forEach(r => {
      const pre = (r.code + "       ").slice(0, rs.length > 1 || maskToLen(rs[0].mask) !== +clen ? 8 : 5);
      const tgt = rs.length > 1 || maskToLen(rs[0].mask) !== +clen ? `${r.net}/${maskToLen(r.mask)}` : `${r.net}/${maskToLen(r.mask)}`;
      L.push(r.code === "C" || r.code === "L" ? `${pre}${tgt} is directly connected, ${longIf(r.iface)}` : r.nh ? `${pre}${tgt} [${r.ad || 1}/0] via ${r.nh}` : `${pre}${tgt} is directly connected, ${longIf(r.iface)}`);
    });
  });
  if (def) L.push(def.nh ? `S*   0.0.0.0/0 [${def.ad || 1}/0] via ${def.nh}` : `S*   0.0.0.0/0 is directly connected, ${longIf(def.iface)}`);
  pr(s, L.join("\n"));
});
function cdpNeighbors(d) {
  if (!isIOS(d) || !d.cfg.cdp) return [];
  return allPorts(d).filter(p => p !== "Console").map(p => ({p, o: linkAt(d, p)})).filter(x => x.o && physUp(d, x.p) && ((isIOS(x.o.dev) && x.o.dev.cfg.cdp) || x.o.dev.type === "phone"));
}
defCmd(SHOWM, "show cdp neighbors", s => {
  const L = ["Capability Codes: R - Router, T - Trans Bridge, B - Source Route Bridge", "                  S - Switch, H - Host, I - IGMP, r - Repeater, P - Phone", "Device ID    Local Intrfce   Holdtme    Capability   Platform    Port ID"];
  cdpNeighbors(s.dev).forEach(({p, o}) => { const cap = o.dev.type === "router" ? "R" : o.dev.type === "l3switch" ? "R S" : o.dev.type === "phone" ? "H P" : "S"; L.push(pad(isIOS(o.dev) ? o.dev.cfg.hostname : o.dev.name, 13) + pad(shortPort(p).replace(/(\D+)/, "$1 "), 16) + pad("163", 11) + pad(cap, 13) + pad(o.dev.model, 12) + shortPort(o.port).replace(/(\D+)/, "$1 ")); });
  pr(s, L.join("\n"));
});
defCmd(SHOWM, "show cdp neighbors detail", s => {
  pr(s, cdpNeighbors(s.dev).map(({p, o}) => { const ip = l3Ifaces(o.dev).find(i => i.ip); return `-------------------------\nDevice ID: ${isIOS(o.dev) ? o.dev.cfg.hostname : o.dev.name}\nEntry address(es): \n${ip ? "  IP address : " + ip.ip + "\n" : ""}Platform: cisco ${o.dev.model}, Capabilities: ${o.dev.type === "router" ? "Router" : "Switch"}\nInterface: ${longIf(p)}, Port ID (outgoing port): ${longIf(o.port)}\nHoldtime: 163\n\nVersion :\n${isIOS(o.dev) ? IOS_VER(o.dev) : ""}\n`; }).join("\n") || "");
});
defCmd(SHOWM, "show spanning-tree", s => {
  const d = s.dev; if (!isSwitch(d)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  const st = stp().info[d.id], me = bridgeId(d);
  const L = ["VLAN0001", "  Spanning tree enabled protocol ieee"];
  if (st) {
    const root = byId(st.root), rb = bridgeId(root), isRoot = st.root === d.id;
    L.push(`  Root ID    Priority    ${rb[0] + 1}`, `             Address     ${rb[1]}`);
    if (isRoot) L.push("             This bridge is the root"); else L.push(`             Cost        ${st.cost}`, `             Port        ${allPorts(d).indexOf(st.rootPort) + 1}(${longIf(st.rootPort)})`);
  } else L.push(`  Root ID    Priority    ${me[0] + 1}`, `             Address     ${me[1]}`, "             This bridge is the root");
  L.push("             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec", "", `  Bridge ID  Priority    ${me[0] + 1}  (priority ${me[0]} sys-id-ext 1)`, `             Address     ${me[1]}`, "             Hello Time  2 sec  Max Age 20 sec  Forward Delay 15 sec", "             Aging Time  20", "", "Interface        Role Sts Cost      Prio.Nbr Type", "---------------- ---- --- --------- -------- --------------------------------");
  allPorts(d).filter(p => p !== "Console" && isSwitchport(d, p) && ifUp(d, p) && portCarries(d, p, 1)).forEach((p, k) => {
    const role = st && st.ports[p] ? st.ports[p] : "Desg";
    L.push(pad(shortPort(p), 17) + pad(role, 5) + pad(role === "Altn" ? "BLK" : "FWD", 4) + pad(portCost(p), 10) + pad("128." + (allPorts(d).indexOf(p) + 1), 9) + "P2p");
  });
  pr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip dhcp binding", s => {
  const L = ["IP address       Client-ID/              Lease expiration        Type", "                 Hardware address"];
  Object.entries(rt(s.dev).leases).forEach(([mac, ip]) => L.push(pad(ip, 17) + pad(mac.toUpperCase(), 24) + pad("--", 24) + "Automatic"));
  pr(s, L.join("\n"));
});
defCmd(SHOWM, "show ip dhcp pool", s => pr(s, Object.entries(s.dev.cfg.dhcp.pools).map(([n, p]) => `\nPool ${n} :\n Utilization mark (high/low)    : 100 / 0\n Subnet size (first/next)       : 0 / 0 \n Total addresses                : ${p.network ? (1 << (32 - maskToLen(p.mask))) - 2 : 0}\n Leased addresses               : ${Object.keys(rt(s.dev).leases).length}\n Excluded addresses             : ${s.dev.cfg.dhcp.excluded.length}\n Pending event                  : none`).join("\n")));
defCmd(SHOWM, "show ip ssh", s => { const c = s.dev.cfg; pr(s, c.ssh.keyBits ? `SSH Enabled - version ${c.ssh.version === 2 ? "2.0" : "1.99"}\nAuthentication timeout: 120 secs; Authentication retries: 3` : "SSH Disabled - version 1.99\n%Please create RSA keys (of atleast 768 bits size) to enable SSH v2.\nAuthentication timeout: 120 secs; Authentication retries: 3"); });
defCmd(SHOWM, "show history", s => pr(s, s.hist.map(h => "  " + h).join("\n")));
defCmd(SHOWM, "show clock", s => { const t = new Date(); pr(s, `*${t.toTimeString().slice(0, 8)}.${String(t.getMilliseconds()).padStart(3, "0")} UTC ${t.toDateString().slice(0, 3)} ${t.toDateString().slice(4)}`); });
defCmd(SHOWM, "show users", s => pr(s, `    Line       User       Host(s)              Idle       Location\n*  0 con 0                idle                 00:00:00 `));
defCmd(SHOWM, "show flash", s => pr(s, `System flash directory:\nFile  Length   Name/status\n  3   33591768 ${s.dev.type === "router" ? "c2900-universalk9-mz.SPA.151-4.M5.bin" : "c2960-lanbasek9-mz.150-2.SE4.bin"}\n[33591768 bytes used, 221896232 available, 255488000 total]`));
defCmd(SHOWM, "show protocols", s => pr(s, "Global values:\n  Internet Protocol routing is " + (isRouterish(s.dev) || s.dev.cfg.ipRouting ? "enabled" : "disabled") + "\n" + ifOrder(s.dev).filter(n => s.dev.cfg.ifaces[n]).map(n => { const st = ifStatus(s.dev, n), i = s.dev.cfg.ifaces[n]; return `${longIf(n)} is ${st.status}, line protocol is ${st.proto}${i.ip ? `\n  Internet address is ${i.ip}/${maskToLen(i.mask)}` : ""}`; }).join("\n")));

// ======================================================================= GLOBAL CONFIG
const CFG = ["config", "if", "line", "vlan", "dhcp"];
defCmd(CFG, "end", s => { s.mode = "priv"; s.ctx = {}; pr(s, `\n%SYS-5-CONFIG_I: Configured from console by console`); });
defCmd("config", "exit", s => { s.mode = "priv"; s.ctx = {}; pr(s, `\n%SYS-5-CONFIG_I: Configured from console by console`); });
["if", "line", "vlan", "dhcp"].forEach(m => defCmd(m, "exit", s => { s.mode = "config"; s.ctx = {}; }));
defCmd("config", "hostname <WORD>", (s, a) => { s.dev.cfg.hostname = a[0]; });
defCmd("config", "no hostname", s => { s.dev.cfg.hostname = PROMPT_NAME[s.dev.type]; });
defCmd("config", "banner motd <LINE>", (s, a) => {
  const t = a[0], delim = t[0], rest = t.slice(1), end = rest.indexOf(delim);
  if (end >= 0) { s.dev.cfg.banner = rest.slice(0, end); return; }
  pr(s, `Enter TEXT message.  End with the character '${delim}'.`);
  let buf = rest ? [rest] : [];
  const more = () => { s.pending = {prompt: "", keep: true, fn: line => { const k = line.indexOf(delim); if (k >= 0) { buf.push(line.slice(0, k)); s.dev.cfg.banner = buf.join("\n"); save(); return; } buf.push(line); more(); }}; };
  more();
});
defCmd("config", "no banner motd", s => { s.dev.cfg.banner = ""; });
defCmd("config", "enable secret <WORD>", (s, a) => { s.dev.cfg.enableSecret = {t: 5, v: md5Crypt(a[0], randSalt(a[0]))}; });
defCmd("config", "enable secret 0 <WORD>", (s, a) => { s.dev.cfg.enableSecret = {t: 5, v: md5Crypt(a[0], randSalt(a[0]))}; });
defCmd("config", "enable secret 5 <WORD>", (s, a) => { if (!/^\$1\$/.test(a[0])) { pr(s, "ERROR: The secret you entered is not a valid encrypted secret.\nTo enter an UNENCRYPTED secret, do not specify type 5 encryption.\nWhen you properly enter an UNENCRYPTED secret, it will be encrypted."); return; } s.dev.cfg.enableSecret = {t: 5, v: a[0]}; });
defCmd("config", "no enable secret", s => { s.dev.cfg.enableSecret = null; });
defCmd("config", "enable password <WORD>", (s, a) => {
  const c = s.dev.cfg;
  if (c.enableSecret && checkSecret(a[0], c.enableSecret.v)) pr(s, "The enable password you have chosen is the same as your enable secret.\nThis is not recommended.  Re-enter the enable password.");
  c.enablePassword = savePw(c, a[0]);
});
defCmd("config", "enable password 7 <WORD>", (s, a) => { s.dev.cfg.enablePassword = {t: 7, v: a[0].toUpperCase()}; });
defCmd("config", "no enable password", s => { s.dev.cfg.enablePassword = null; });
defCmd("config", "service password-encryption", s => { s.dev.cfg.spe = true; applySPE(s.dev.cfg); });
defCmd("config", "no service password-encryption", s => { s.dev.cfg.spe = false; });
defCmd("config", "no ip domain-lookup", s => { s.dev.cfg.domainLookup = false; });
defCmd("config", "no ip domain lookup", s => { s.dev.cfg.domainLookup = false; });
defCmd("config", "ip domain-lookup", s => { s.dev.cfg.domainLookup = true; });
defCmd("config", "ip domain lookup", s => { s.dev.cfg.domainLookup = true; });
defCmd("config", "ip domain-name <WORD>", (s, a) => { s.dev.cfg.domainName = a[0]; });
defCmd("config", "ip domain name <WORD>", (s, a) => { s.dev.cfg.domainName = a[0]; });
defCmd("config", "no ip domain-name", s => { s.dev.cfg.domainName = ""; });
const setUser = (s, name, priv, kind, pw) => { const c = s.dev.cfg; c.users[name] = {priv: priv == null ? null : +priv}; if (kind === "secret") c.users[name].secret = {t: 5, v: md5Crypt(pw, randSalt(pw))}; else c.users[name].password = savePw(c, pw); };
defCmd("config", "username <WORD> secret <WORD>", (s, a) => setUser(s, a[0], null, "secret", a[1]));
defCmd("config", "username <WORD> password <WORD>", (s, a) => setUser(s, a[0], null, "password", a[1]));
defCmd("config", "username <WORD> privilege <0-15> secret <WORD>", (s, a) => setUser(s, a[0], a[1], "secret", a[2]));
defCmd("config", "username <WORD> privilege <0-15> password <WORD>", (s, a) => setUser(s, a[0], a[1], "password", a[2]));
defCmd("config", "no username <WORD>", (s, a) => { delete s.dev.cfg.users[a[0]]; });
function genRsa(s, bits) {
  const c = s.dev.cfg;
  if (c.hostname === PROMPT_NAME[s.dev.type]) { pr(s, `% Please define a hostname other than ${c.hostname}.`); return; }
  if (!c.domainName) { pr(s, "% Please define a domain-name first."); return; }
  const go = b => {
    b = +b || 512;
    if (b < 360 || b > 4096) { pr(s, "% Invalid modulus"); return; }
    pr(s, `% Generating ${b} bit RSA keys, keys will be non-exportable...[OK]\n`);
    c.ssh.keyBits = b;
    if (!c.ssh.version) c.ssh.version = 0;
    pr(s, `*Mar 1 0:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}:${String(Math.floor(Math.random() * 59)).padStart(2, "0")}.554: %SSH-5-ENABLED: SSH 1.99 has been enabled`);
    save();
  };
  pr(s, `The name for the keys will be: ${c.hostname}.${c.domainName}`);
  if (bits) { go(bits); return; }
  pr(s, "Choose the size of the key modulus in the range of 360 to 4096 for your\n  General Purpose Keys. Choosing a key modulus greater than 512 may take\n  a few minutes.\n");
  s.pending = {prompt: "How many bits in the modulus [512]: ", fn: v => go(v.trim())};
}
defCmd("config", "crypto key generate rsa", s => genRsa(s));
defCmd("config", "crypto key generate rsa general-keys", s => genRsa(s));
defCmd("config", "crypto key generate rsa modulus <360-4096>", (s, a) => genRsa(s, a[0]));
defCmd("config", "crypto key generate rsa general-keys modulus <360-4096>", (s, a) => genRsa(s, a[0]));
defCmd("config", "crypto key zeroize rsa", s => { s.dev.cfg.ssh.keyBits = 0; pr(s, "% All keys will be removed.\n% All router certs issued using these keys will also be removed."); });
defCmd("config", "ip ssh version <1-2>", (s, a) => { const c = s.dev.cfg; if (+a[0] === 2 && c.ssh.keyBits && c.ssh.keyBits < 768) { pr(s, "Please create RSA keys (of at least 768 bits size) to enable SSH v2."); return; } if (+a[0] === 2 && !c.ssh.keyBits) { pr(s, "Please create RSA keys to enable SSH (and of atleast 768 bits for SSH v2)."); } c.ssh.version = +a[0]; });
defCmd("config", "line console <0-0>", s => { s.mode = "line"; s.ctx = {line: "con"}; });
defCmd("config", "line vty <0-15> <0-15>", (s, a) => { if (isRouterish(s.dev) && +a[1] > 4) { pr(s, "% Invalid input detected at '^' marker."); return; } s.mode = "line"; s.ctx = {line: "vty"}; });
defCmd("config", "line vty <0-15>", s => { s.mode = "line"; s.ctx = {line: "vty"}; });
defCmd("config", "interface <IFACE>", (s, a) => {
  const n = resolveIf(s.dev, a[0]);
  if (!n || (/^Vlan/.test(n) && !isSwitch(s.dev)) || (/\.\d+$/.test(n) && isSwitch(s.dev) && !(s.dev.cfg.ifaces[parentIf(n)] || {}).routed)) { pr(s, ERR_INVALID(promptOf(s), "interface " + a[0], 10)); return; }
  if (/^Vlan(\d+)$/.test(n) && (+n.slice(4) < 1 || +n.slice(4) > 4094)) { pr(s, "% Invalid input detected at '^' marker."); return; }
  ifc(s.dev, n);
  s.mode = /\.\d+$/.test(n) ? "subif" : "if"; s.ctx = {ifaces: [n]};
});
defCmd("config", "interface range <RANGE>", (s, a) => {
  const list = parseRange(s.dev, a[0]);
  if (!list || !list.length) { pr(s, "% Invalid input detected at '^' marker."); return; }
  list.forEach(n => ifc(s.dev, n));
  s.mode = "range"; s.ctx = {ifaces: list};
});
defCmd("config", "no interface <IFACE>", (s, a) => { const n = resolveIf(s.dev, a[0]); if (n === "Vlan1") { pr(s, "% Cannot remove Vlan1"); return; } if (n && isVirtualIf(n)) delete s.dev.cfg.ifaces[n]; else pr(s, "% Invalid input detected at '^' marker."); });
defCmd("config", "vlan <1-4094>", (s, a) => { if (!isSwitch(s.dev)) { pr(s, "% Invalid input detected at '^' marker."); return; } const v = +a[0]; if (!s.dev.cfg.vlans[v]) s.dev.cfg.vlans[v] = "VLAN" + String(v).padStart(4, "0"); s.mode = "vlan"; s.ctx = {vlan: v}; });
defCmd("config", "no vlan <2-4094>", (s, a) => { if (isSwitch(s.dev)) delete s.dev.cfg.vlans[+a[0]]; });
defCmd("vlan", "name <WORD>", (s, a) => { s.dev.cfg.vlans[s.ctx.vlan] = a[0]; });
defCmd("vlan", "no name", s => { s.dev.cfg.vlans[s.ctx.vlan] = "VLAN" + String(s.ctx.vlan).padStart(4, "0"); });
const addRoute = (s, net, mask, via, ad) => {
  if (!isMask(mask)) { pr(s, "%Inconsistent address and mask"); return; }
  if (netOf(net, mask) !== net) { pr(s, "%Inconsistent address and mask"); return; }
  const r = {net, mask, ad: ad ? +ad : 1};
  if (isIp(via)) r.nh = via; else { const n = resolveIf(s.dev, via); if (!n) { pr(s, "% Invalid input detected at '^' marker."); return; } r.iface = n; }
  const c = s.dev.cfg;
  c.routes = c.routes.filter(x => !(x.net === net && x.mask === mask && (x.nh || x.iface) === (r.nh || r.iface)));
  c.routes.push(r);
};
defCmd("config", "ip route <A.B.C.D> <MASK> <A.B.C.D>", (s, a) => addRoute(s, ...a));
defCmd("config", "ip route <A.B.C.D> <MASK> <A.B.C.D> <1-255>", (s, a) => addRoute(s, ...a));
defCmd("config", "ip route <A.B.C.D> <MASK> <IFACE>", (s, a) => addRoute(s, ...a));
defCmd("config", "ip route <A.B.C.D> <MASK> <IFACE> <1-255>", (s, a) => addRoute(s, ...a));
const delRoute = (s, a) => { s.dev.cfg.routes = s.dev.cfg.routes.filter(r => !(r.net === a[0] && r.mask === a[1] && (!a[2] || r.nh === a[2] || (r.iface && r.iface === resolveIf(s.dev, a[2]))))); };
defCmd("config", "no ip route <A.B.C.D> <MASK>", delRoute);
defCmd("config", "no ip route <A.B.C.D> <MASK> <A.B.C.D>", delRoute);
defCmd("config", "no ip route <A.B.C.D> <MASK> <IFACE>", delRoute);
defCmd("config", "ip default-gateway <A.B.C.D>", (s, a) => { s.dev.cfg.defaultGateway = a[0]; });
defCmd("config", "no ip default-gateway", s => { s.dev.cfg.defaultGateway = ""; });
defCmd("config", "ip routing", s => { if (s.dev.type === "switch") { pr(s, "% Invalid input detected at '^' marker. (a Layer 2 switch can't route: use a multilayer switch)"); return; } s.dev.cfg.ipRouting = true; });
defCmd("config", "no ip routing", s => { s.dev.cfg.ipRouting = false; });
defCmd("config", "ip dhcp excluded-address <A.B.C.D>", (s, a) => { s.dev.cfg.dhcp.excluded.push([a[0], a[0]]); });
defCmd("config", "ip dhcp excluded-address <A.B.C.D> <A.B.C.D>", (s, a) => { s.dev.cfg.dhcp.excluded.push([a[0], a[1]]); });
defCmd("config", "no ip dhcp excluded-address <A.B.C.D>", (s, a) => { s.dev.cfg.dhcp.excluded = s.dev.cfg.dhcp.excluded.filter(x => x[0] !== a[0]); });
defCmd("config", "no ip dhcp excluded-address <A.B.C.D> <A.B.C.D>", (s, a) => { s.dev.cfg.dhcp.excluded = s.dev.cfg.dhcp.excluded.filter(x => x[0] !== a[0]); });
defCmd("config", "ip dhcp pool <WORD>", (s, a) => { const p = s.dev.cfg.dhcp.pools; if (!p[a[0]]) p[a[0]] = {network: "", mask: "", gw: "", dns: "", domain: ""}; s.mode = "dhcp"; s.ctx = {pool: a[0]}; });
defCmd("config", "no ip dhcp pool <WORD>", (s, a) => { delete s.dev.cfg.dhcp.pools[a[0]]; });
const pool = s => s.dev.cfg.dhcp.pools[s.ctx.pool];
defCmd("dhcp", "network <A.B.C.D> <MASK>", (s, a) => { if (!isMask(a[1])) { pr(s, "% Invalid mask"); return; } Object.assign(pool(s), {network: netOf(a[0], a[1]), mask: a[1]}); });
defCmd("dhcp", "default-router <A.B.C.D>", (s, a) => { pool(s).gw = a[0]; });
defCmd("dhcp", "dns-server <A.B.C.D>", (s, a) => { pool(s).dns = a[0]; });
defCmd("dhcp", "domain-name <WORD>", (s, a) => { pool(s).domain = a[0]; });
defCmd("config", "cdp run", s => { s.dev.cfg.cdp = true; });
defCmd("config", "no cdp run", s => { s.dev.cfg.cdp = false; });
defCmd("config", "spanning-tree vlan <VLIST> priority <0-61440>", (s, a) => { if (+a[1] % 4096) { pr(s, "% Bridge Priority must be in increments of 4096.\n% Allowed values are: \n  0     4096  8192  12288 16384 20480 24576 28672\n  32768 36864 40960 45056 49152 53248 57344 61440"); return; } s.dev.cfg.stpPriority = +a[1]; });
defCmd("config", "spanning-tree vlan <VLIST> root primary", s => { s.dev.cfg.stpPriority = 24576; });
defCmd("config", "spanning-tree vlan <VLIST> root secondary", s => { s.dev.cfg.stpPriority = 28672; });
defCmd("config", "spanning-tree mode <WORD>", () => {});
["router", "access-list", "ip access-list", "ip nat", "standby", "ipv6", "ntp", "snmp-server", "logging", "aaa", "vtp", "port-channel"].forEach(w => defCmd("config", w + " <LINE>", unsupported(w)));

// ======================================================================= INTERFACE CONFIG
defCmd("if", "shutdown", s => setPorts(s, i => { i.shutdown = true; }));
defCmd("if", "no shutdown", s => setPorts(s, i => { i.shutdown = false; }));
defCmd("if", "description <LINE>", (s, a) => setPorts(s, i => { i.desc = a[0]; }));
defCmd("if", "no description", s => setPorts(s, i => { i.desc = ""; }));
defCmd("if", "ip address <A.B.C.D> <MASK>", (s, a) => {
  const d = s.dev, [ip, mask] = a;
  for (const n of curIfs(s)) {
    if (isSwitch(d) && !isVirtualIf(n) && !d.cfg.ifaces[n].routed) { pr(s, "% Invalid input detected at '^' marker."); return; }
    if (/\.\d+$/.test(n) && !d.cfg.ifaces[n].dot1q) { pr(s, "% Configuring IP routing on a LAN subinterface is only allowed if that\nsubinterface is already configured as part of an IEEE 802.10, IEEE 802.1Q,\nor ISL vLAN."); return; }
    const len = maskToLen(mask);
    if (len === null) { pr(s, `Bad mask 0x${(ipToInt(mask) >>> 0).toString(16).toUpperCase()} for address ${ip}`); return; }
    if (len < 31 && (ip === netOf(ip, mask) || ip === bcastOf(ip, mask))) { pr(s, `Bad mask /${len} for address ${ip}`); return; }
    const clash = l3Ifaces(d).find(o => o.name !== n && o.ip && (sameNet(ip, o.ip, o.mask) || sameNet(o.ip, ip, mask)));
    if (clash) { pr(s, `% ${netOf(ip, mask)} overlaps with ${longIf(clash.name)}`); return; }
    Object.assign(d.cfg.ifaces[n], {ip, mask});
  }
});
defCmd("if", "no ip address", s => setPorts(s, i => { i.ip = ""; i.mask = ""; }));
defCmd("if", "ip helper-address <A.B.C.D>", (s, a) => setPorts(s, i => { i.helper = [...new Set([...(i.helper || []), a[0]])]; }));
defCmd("if", "no ip helper-address", s => setPorts(s, i => { i.helper = []; }));
defCmd("if", "no ip helper-address <A.B.C.D>", (s, a) => setPorts(s, i => { i.helper = (i.helper || []).filter(h => h !== a[0]); }));
["10", "100", "1000", "auto"].forEach(v => defCmd("if", "speed " + v, s => setPorts(s, i => { i.speed = v; })));
["half", "full", "auto"].forEach(v => defCmd("if", "duplex " + v, s => setPorts(s, i => { i.duplex = v; })));
const swMode = m => s => {
  if (!needSwitchport(s)) return;
  if (m === "trunk" && s.dev.type === "l3switch" && curIfs(s).some(n => s.dev.cfg.ifaces[n].encap !== "dot1q")) { pr(s, 'Command rejected: An interface whose trunk encapsulation is "Auto" can not be configured to "trunk" mode.'); return; }
  setPorts(s, i => { i.mode = m; });
};
defCmd("if", "switchport mode access", swMode("access"));
defCmd("if", "switchport mode trunk", swMode("trunk"));
defCmd("if", "switchport mode dynamic auto", swMode("dynamic"));
defCmd("if", "switchport mode dynamic desirable", swMode("dynamic"));
defCmd("if", "switchport trunk encapsulation dot1q", s => { if (needSwitchport(s)) setPorts(s, i => { i.encap = "dot1q"; }); });
defCmd("if", "switchport nonegotiate", s => { needSwitchport(s); });
defCmd("if", "switchport access vlan <1-4094>", (s, a) => {
  if (!needSwitchport(s)) return;
  const v = +a[0];
  if (!s.dev.cfg.vlans[v]) { pr(s, `% Access VLAN does not exist. Creating vlan ${v}`); s.dev.cfg.vlans[v] = "VLAN" + String(v).padStart(4, "0"); }
  setPorts(s, i => { i.accessVlan = v; });
});
defCmd("if", "no switchport access vlan", s => { if (needSwitchport(s)) setPorts(s, i => { i.accessVlan = 1; }); });
defCmd("if", "switchport trunk native vlan <1-4094>", (s, a) => { if (needSwitchport(s)) setPorts(s, i => { i.nativeVlan = +a[0]; }); });
defCmd("if", "no switchport trunk native vlan", s => { if (needSwitchport(s)) setPorts(s, i => { i.nativeVlan = 1; }); });
const expand = list => String(list).split(",").flatMap(x => { const [a, b] = x.split("-").map(Number); return b ? Array.from({length: b - a + 1}, (_, k) => a + k) : [a]; });
defCmd("if", "switchport trunk allowed vlan <VLIST>", (s, a) => { if (needSwitchport(s)) setPorts(s, i => { i.allowed = a[0]; }); });
defCmd("if", "switchport trunk allowed vlan all", s => { if (needSwitchport(s)) setPorts(s, i => { i.allowed = "all"; }); });
defCmd("if", "switchport trunk allowed vlan none", s => { if (needSwitchport(s)) setPorts(s, i => { i.allowed = "none"; }); });
defCmd("if", "switchport trunk allowed vlan add <VLIST>", (s, a) => { if (needSwitchport(s)) setPorts(s, i => { if (i.allowed === "all") return; i.allowed = vlanRanges([...(i.allowed === "none" ? [] : expand(i.allowed)), ...expand(a[0])]); }); });
defCmd("if", "switchport trunk allowed vlan remove <VLIST>", (s, a) => { if (needSwitchport(s)) setPorts(s, i => { const cur = i.allowed === "all" ? Array.from({length: 4094}, (_, k) => k + 1) : i.allowed === "none" ? [] : expand(i.allowed); const rm = new Set(expand(a[0])); i.allowed = vlanRanges(cur.filter(v => !rm.has(v))) || "none"; }); });
defCmd("if", "no switchport", s => { if (s.dev.type !== "l3switch") { pr(s, "% Invalid input detected at '^' marker."); return; } setPorts(s, i => { i.routed = true; }); });
defCmd("if", "switchport", s => { if (s.dev.type !== "l3switch") return; setPorts(s, i => { i.routed = false; i.ip = ""; i.mask = ""; }); });
defCmd("if", "spanning-tree portfast", s => { if (!needSwitchport(s)) return; pr(s, "%Warning: portfast should only be enabled on ports connected to a single\n host. Connecting hubs, concentrators, switches, bridges, etc... to this\n interface  when portfast is enabled, can cause temporary bridging loops.\n Use with CAUTION\n"); setPorts(s, i => { i.portfast = true; }); });
defCmd("if", "no spanning-tree portfast", s => setPorts(s, i => { i.portfast = false; }));
const RATES = [1200, 2400, 4800, 9600, 19200, 38400, 56000, 64000, 72000, 125000, 128000, 148000, 250000, 500000, 800000, 1000000, 1300000, 2000000, 4000000];
defCmd("if", "clock rate <300-4000000>", (s, a) => {
  for (const n of curIfs(s)) {
    if (portKind(n) !== "serial") { pr(s, "% Invalid input detected at '^' marker."); return; }
    if (!RATES.includes(+a[0])) { pr(s, "unknown clock rate"); return; }
    const o = linkAt(s.dev, n);
    if (o && !o.dce) { pr(s, "This command applies only to DCE interfaces"); return; }
    s.dev.cfg.ifaces[n].clock = +a[0];
  }
});
defCmd("if", "no clock rate", s => setPorts(s, i => { i.clock = null; }));
defCmd("if", "encapsulation dot1Q <1-4094>", (s, a) => { if (!curIfs(s).every(n => /\.\d+$/.test(n))) { pr(s, "% Invalid input detected at '^' marker."); return; } setPorts(s, i => { i.dot1q = +a[0]; i.dot1qNative = false; }); });
defCmd("if", "encapsulation dot1Q <1-4094> native", (s, a) => { if (!curIfs(s).every(n => /\.\d+$/.test(n))) { pr(s, "% Invalid input detected at '^' marker."); return; } setPorts(s, i => { i.dot1q = +a[0]; i.dot1qNative = true; }); });
["switchport port-security", "channel-group", "ip ospf", "standby", "ip nat", "ip access-group", "ipv6"].forEach(w => defCmd("if", w + " <LINE>", unsupported(w)));

// ======================================================================= LINE CONFIG
const lineObj = s => s.dev.cfg.lines[s.ctx.line];
defCmd("line", "password <WORD>", (s, a) => { lineObj(s).password = savePw(s.dev.cfg, a[0]); });
defCmd("line", "password 7 <WORD>", (s, a) => { lineObj(s).password = {t: 7, v: a[0].toUpperCase()}; });
defCmd("line", "no password", s => { lineObj(s).password = null; });
defCmd("line", "login", s => { const l = lineObj(s); l.login = true; l.loginLocal = false; if (!l.password) pr(s, `% Login disabled on line ${s.ctx.line === "con" ? 0 : 1}, until 'password' is set`); });
defCmd("line", "login local", s => { const l = lineObj(s); l.loginLocal = true; l.login = false; });
defCmd("line", "no login", s => { const l = lineObj(s); l.login = false; l.loginLocal = false; });
defCmd("line", "exec-timeout <0-35791>", (s, a) => { lineObj(s).timeout = [+a[0], 0]; });
defCmd("line", "exec-timeout <0-35791> <0-2147483>", (s, a) => { lineObj(s).timeout = [+a[0], +a[1]]; });
defCmd("line", "logging synchronous", s => { lineObj(s).logsync = true; });
["telnet", "ssh", "all", "none"].forEach(t => defCmd("line", "transport input " + t, s => { if (s.ctx.line !== "vty") { pr(s, "% Invalid input detected at '^' marker."); return; } lineObj(s).transport = t; }));
defCmd("line", "transport input telnet ssh", s => { lineObj(s).transport = "telnet ssh"; });
defCmd("line", "transport input ssh telnet", s => { lineObj(s).transport = "telnet ssh"; });
