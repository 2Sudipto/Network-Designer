// ======================================================================= ACTIVITIES (auto-checked labs) + BREAK IT (troubleshooting)
// ---- helpers used by examples and checks
function runCmds(d, lines) {
  const T = {print() {}, refresh() {}, runAsync(st, done) { st.forEach(([, x]) => { if (typeof x === "function") x(); }); if (done) done(); }, stack: [], push() {}, pop() {}};
  const s = newSession(d, "gui", T); s.mode = "priv"; s.authed = true; T.stack.push(s);
  ["configure terminal", ...lines, "end"].forEach(l => { cliLine(s, l); if (s.pending) { const p = s.pending; s.pending = null; p.fn(""); } });
}
function setHost(d, ip, gw, dns) {
  if (ip === "dhcp") { d.host = Object.assign(defaultHost(d), {dhcp: true}); rt(d).lease = null; return; }
  const c = parseCidr(ip);
  d.host = {dhcp: false, ip: c.ip, mask: c.mask, gw: gw || "", dns: dns || ""};
}
const dn = name => S.devices.find(d => d.name.toLowerCase() === name.toLowerCase());
const cfgOf = name => { const d = dn(name); return d && d.cfg; };
const allIOS = names => names.every(n => !!cfgOf(n));
function canPing(src, ip) { const d = typeof src === "string" ? dn(src) : src; if (!d) return false; for (let i = 0; i < 3; i++) if (pingOnce(d, ip).res.res === "reply") return true; return false; }
function ifHas(name, port, ip, mask) { const c = cfgOf(name); const i = c && c.ifaces[port]; return !!(i && i.ip === ip && (!mask || i.mask === mask)); }
function ifIsUp(name, port) { const d = dn(name); return !!(d && d.cfg && d.cfg.ifaces[port] && ifUp(d, port)); }
const saved = name => { const d = dn(name); return !!(d && d.startup && d.startup === JSON.stringify(d.cfg)); };
const ACT_LOG = {telnet: new Set(), ssh: new Set()};
function actLog(proto, from, to) { ACT_LOG[proto].add(from.id + ">" + to.id); activityCheck(); }

// ---- the activities
const LAB1_SW = ["ES-MAIN", "ES-FRONT", "ES-CLINIC"], LAB1_ALL = ["EDISON-SMILES", ...LAB1_SW];
const each = (names, f) => names.every(n => { const c = cfgOf(n); return c && f(c, dn(n)); });
const ACTIVITIES = [
  {id: "kalloo1", title: "Kalloo Lab 01 — Edison Smiles Dental", tag: "Device security · Telnet", desc: "Your Lab 01: hostnames, banner, passwords, console, Telnet-only remote access, then save. Device names on the diagram are already set; the IOS hostnames are yours to configure.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "Kalloo Lab 01 — Edison Smiles Dental";
      const web = D("WEB SERVER", "server"), r = D("EDISON-SMILES", "router", "", "", "ISR4331"), m = D("ES-MAIN", "switch", "", "", "2960-24TT");
      const f = D("ES-FRONT", "switch", "", "Front desk", "2960-24TT"), c = D("ES-CLINIC", "switch", "", "Clinic", "2960-24TT");
      L(web, "Fa0", r, "G0/0/1", "copper"); L(r, "G0/0/0", m, "G0/1", "copper"); L(m, "Fa0/24", f, "Fa0/24", "crossover"); L(m, "Fa0/23", c, "Fa0/24", "crossover");
      ["A", "B", "C"].forEach((x, i) => L(f, "Fa0/" + (i + 1), D("ES-FR-PC" + x, "pc", "", "Front desk"), "Fa0", "copper"));
      ["A", "B", "C"].forEach((x, i) => L(c, "Fa0/" + (i + 1), D("ES-CL-PC" + x, "pc", "", "Clinic"), "Fa0", "copper"));
      return s;
    },
    tasks: [
      {t: "Hostnames: EDISON-SMILES, ES-MAIN, ES-FRONT, ES-CLINIC (IOS hostnames can't contain spaces)", h: "hostname ES-MAIN", c: () => LAB1_ALL.every(n => cfgOf(n) && cfgOf(n).hostname.toUpperCase() === n)},
      {t: 'Banner MOTD on all four: "This is the property of Edison Smiles Dental. All unauthorized Access Prohibited."', h: "banner motd #This is the property of Edison Smiles Dental. All unauthorized Access Prohibited.#", c: () => each(LAB1_ALL, c => /property of Edison Smiles Dental/i.test(c.banner))},
      {t: "Privileged EXEC plaintext password ESpriv on all four", h: "enable password ESpriv", c: () => each(LAB1_ALL, c => pwCheck(c.enablePassword, "ESpriv"))},
      {t: "Privileged EXEC encrypted password (secret) ESsec on all four", h: "enable secret ESsec", c: () => each(LAB1_ALL, c => c.enableSecret && pwCheck(c.enableSecret, "ESsec"))},
      {t: "Console password EScon with login on all four", h: "line con 0 → password EScon → login", c: () => each(LAB1_ALL, c => pwCheck(c.lines.con.password, "EScon") && c.lines.con.login)},
      {t: "Console exec-timeout 5 minutes on all four", h: "line con 0 → exec-timeout 5 0", c: () => each(LAB1_ALL, c => c.lines.con.timeout[0] === 5 && c.lines.con.timeout[1] === 0)},
      {t: "Disable IP domain lookup on all four", h: "no ip domain-lookup", c: () => each(LAB1_ALL, c => !c.domainLookup)},
      {t: "Encrypt all plaintext passwords (no type 0 left)", h: "service password-encryption", c: () => each(LAB1_ALL, c => c.spe && ![c.enablePassword, c.lines.con.password, c.lines.vty.password].some(p => p && p.t === 0))},
      {t: "VTY lines: password EStelnet, login, Telnet only — on all four", h: "line vty 0 4 (router) / 0 15 (switch) → password EStelnet → login → transport input telnet", c: () => each(LAB1_ALL, c => pwCheck(c.lines.vty.password, "EStelnet") && c.lines.vty.login && c.lines.vty.transport === "telnet")},
      {t: "Router G0/0/0 = 192.168.1.254/24 and up", h: "interface g0/0/0 → ip address 192.168.1.254 255.255.255.0 → no shutdown", c: () => ifHas("EDISON-SMILES", "G0/0/0", "192.168.1.254", "255.255.255.0") && ifIsUp("EDISON-SMILES", "G0/0/0")},
      {t: "Switch SVIs (VLAN 1): ES-MAIN .253, ES-FRONT .252, ES-CLINIC .251, up, default gateway .254", h: "interface vlan 1 → ip address 192.168.1.253 255.255.255.0 → no shutdown → exit → ip default-gateway 192.168.1.254", c: () => [["ES-MAIN", "253"], ["ES-FRONT", "252"], ["ES-CLINIC", "251"]].every(([n, x]) => ifHas(n, "Vlan1", "192.168.1." + x, "255.255.255.0") && ifIsUp(n, "Vlan1") && cfgOf(n).defaultGateway === "192.168.1.254")},
      {t: "Every PC has a 192.168.1.x/24 address with gateway .254 and can ping the router", h: "PC → Desktop → IP Configuration (e.g. ES-FR-PCA 192.168.1.11)", c: () => S.devices.filter(d => d.type === "pc").every(d => { const a = hostAddr(d); return a.ip && sameNet(a.ip, "192.168.1.0", "255.255.255.0") && a.gw === "192.168.1.254" && canPing(d, "192.168.1.254"); })},
      {t: "Test Task 9: Telnet from a PC to ES-MAIN (192.168.1.253) and log in", h: "PC → Command Prompt → telnet 192.168.1.253", c: () => { const m = dn("ES-MAIN"); return !!m && [...ACT_LOG.telnet].some(x => x.endsWith(">" + m.id)); }},
      {t: "Save every configuration (startup-config = running-config)", h: "copy running-config startup-config (or write)", c: () => LAB1_ALL.every(saved)},
      {t: "Bonus: give every cabled router/switch interface a description", h: "interface fa0/24 → description Link to ES-FRONT", bonus: true, c: () => each(LAB1_ALL, (c, d) => S.links.filter(l => l.a === d.id || l.b === d.id).every(l => { const p = l.a === d.id ? l.pa : l.pb; return c.ifaces[p] && c.ifaces[p].desc; }))},
    ]},
  {id: "vlans", title: "VLANs and trunking", tag: "Switching", desc: "Two switches, four PCs. Put Sales in VLAN 10 and HR in VLAN 20, then trunk the switches together so each VLAN works across both.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "VLANs and trunking"; s.dir = "TB";
      const s1 = D("S1", "switch"), s2 = D("S2", "switch");
      L(s1, "G0/1", s2, "G0/1", "crossover");
      L(s1, "Fa0/1", D("SALES-1", "pc", "", "VLAN 10 Sales"), "Fa0", "copper"); L(s1, "Fa0/2", D("HR-1", "pc", "", "VLAN 20 HR"), "Fa0", "copper");
      L(s2, "Fa0/1", D("SALES-2", "pc", "", "VLAN 10 Sales"), "Fa0", "copper"); L(s2, "Fa0/2", D("HR-2", "pc", "", "VLAN 20 HR"), "Fa0", "copper");
      return s;
    },
    setup() { setHost(dn("SALES-1"), "192.168.10.11/24", "192.168.10.1"); setHost(dn("SALES-2"), "192.168.10.12/24", "192.168.10.1"); setHost(dn("HR-1"), "192.168.20.11/24", "192.168.20.1"); setHost(dn("HR-2"), "192.168.20.12/24", "192.168.20.1"); },
    tasks: [
      {t: "VLAN 10 named SALES and VLAN 20 named HR on both switches", h: "vlan 10 → name SALES → vlan 20 → name HR", c: () => ["S1", "S2"].every(n => cfgOf(n).vlans[10] === "SALES" && cfgOf(n).vlans[20] === "HR")},
      {t: "Fa0/1 = access VLAN 10 and Fa0/2 = access VLAN 20 on both switches", h: "interface fa0/1 → switchport mode access → switchport access vlan 10", c: () => ["S1", "S2"].every(n => { const c = cfgOf(n); return c.ifaces["Fa0/1"].mode === "access" && c.ifaces["Fa0/1"].accessVlan === 10 && c.ifaces["Fa0/2"].mode === "access" && c.ifaces["Fa0/2"].accessVlan === 20; })},
      {t: "G0/1 is a static trunk on both switches", h: "interface g0/1 → switchport mode trunk", c: () => ["S1", "S2"].every(n => cfgOf(n).ifaces["G0/1"].mode === "trunk")},
      {t: "SALES-1 can ping SALES-2 (192.168.10.12)", h: "SALES-1 → Command Prompt → ping 192.168.10.12", c: () => canPing("SALES-1", "192.168.10.12")},
      {t: "HR-1 can ping HR-2 (192.168.20.12)", h: "both HR ports must be in VLAN 20 and the trunk must carry it", c: () => canPing("HR-1", "192.168.20.12")},
      {t: "Check: show vlan brief and show interfaces trunk agree with your plan", h: "Nothing to fix here: just look!", bonus: true, c: () => true},
    ]},
  {id: "roas", title: "Router-on-a-stick inter-VLAN routing", tag: "Routing · 802.1Q", desc: "VLANs are already built. Configure the trunk to R1 and one sub-interface per VLAN so Sales and HR can talk.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "Router-on-a-stick"; s.dir = "TB";
      const r = D("R1", "router", "", "", "2911"), s1 = D("S1", "switch");
      L(r, "G0/0", s1, "G0/1", "copper");
      L(s1, "Fa0/1", D("SALES-1", "pc", "", "VLAN 10"), "Fa0", "copper"); L(s1, "Fa0/2", D("HR-1", "pc", "", "VLAN 20"), "Fa0", "copper");
      return s;
    },
    setup() { runCmds(dn("S1"), ["vlan 10", "name SALES", "vlan 20", "name HR", "interface fa0/1", "switchport mode access", "switchport access vlan 10", "interface fa0/2", "switchport mode access", "switchport access vlan 20"]); setHost(dn("SALES-1"), "192.168.10.11/24", "192.168.10.1"); setHost(dn("HR-1"), "192.168.20.11/24", "192.168.20.1"); },
    tasks: [
      {t: "S1 G0/1 (to R1) is a trunk", h: "interface g0/1 → switchport mode trunk", c: () => cfgOf("S1").ifaces["G0/1"].mode === "trunk"},
      {t: "R1 G0/0 is up (no shutdown, no IP on the physical port)", h: "interface g0/0 → no shutdown", c: () => ifIsUp("R1", "G0/0")},
      {t: "G0/0.10: encapsulation dot1Q 10, 192.168.10.1/24", h: "interface g0/0.10 → encapsulation dot1Q 10 → ip address 192.168.10.1 255.255.255.0", c: () => { const i = cfgOf("R1").ifaces["G0/0.10"]; return !!(i && i.dot1q === 10 && i.ip === "192.168.10.1" && i.mask === "255.255.255.0"); }},
      {t: "G0/0.20: encapsulation dot1Q 20, 192.168.20.1/24", h: "interface g0/0.20 → encapsulation dot1Q 20 → ip address 192.168.20.1 255.255.255.0", c: () => { const i = cfgOf("R1").ifaces["G0/0.20"]; return !!(i && i.dot1q === 20 && i.ip === "192.168.20.1" && i.mask === "255.255.255.0"); }},
      {t: "SALES-1 can ping its gateway 192.168.10.1", h: "ping 192.168.10.1", c: () => canPing("SALES-1", "192.168.10.1")},
      {t: "SALES-1 can ping HR-1 (192.168.20.11): inter-VLAN routing works", h: "Use Simulation mode to watch the VLAN tag change at R1", c: () => canPing("SALES-1", "192.168.20.11")},
    ]},
  {id: "wan", title: "Static routing over a serial WAN", tag: "Routing · Serial", desc: "Two sites joined by a serial link. Address the routers, set the clock on the DCE end, add static routes and make the PCs talk.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "Static routing over a serial WAN";
      const ny = D("R-NY", "router", "", "New York", "2911"), nj = D("R-NJ", "router", "", "New Jersey", "2911");
      const sny = D("SW-NY", "switch", "", "New York"), snj = D("SW-NJ", "switch", "", "New Jersey");
      L(ny, "S0/0/0", nj, "S0/0/0", "serialDCE"); L(ny, "G0/0", sny, "G0/1", "copper"); L(nj, "G0/0", snj, "G0/1", "copper");
      L(sny, "Fa0/1", D("PC-NY", "pc", "", "New York"), "Fa0", "copper"); L(snj, "Fa0/1", D("PC-NJ", "pc", "", "New Jersey"), "Fa0", "copper");
      s.notes = [{id: "n1", x: 0, y: -120, text: "Addressing\nNY LAN 10.1.1.0/24 (R-NY .1, PC .10)\nNJ LAN 10.2.2.0/24 (R-NJ .1, PC .10)\nWAN 10.0.0.0/30 (R-NY .1 DCE, R-NJ .2)"}];
      return s;
    },
    setup() { setHost(dn("PC-NY"), "10.1.1.10/24", "10.1.1.1"); setHost(dn("PC-NJ"), "10.2.2.10/24", "10.2.2.1"); },
    tasks: [
      {t: "R-NY G0/0 10.1.1.1/24 and R-NJ G0/0 10.2.2.1/24, both up", h: "interface g0/0 → ip address … → no shutdown", c: () => ifHas("R-NY", "G0/0", "10.1.1.1", "255.255.255.0") && ifIsUp("R-NY", "G0/0") && ifHas("R-NJ", "G0/0", "10.2.2.1", "255.255.255.0") && ifIsUp("R-NJ", "G0/0")},
      {t: "Serial addresses: R-NY S0/0/0 10.0.0.1/30, R-NJ S0/0/0 10.0.0.2/30", h: "interface s0/0/0 → ip address 10.0.0.1 255.255.255.252 → no shutdown", c: () => ifHas("R-NY", "S0/0/0", "10.0.0.1", "255.255.255.252") && ifHas("R-NJ", "S0/0/0", "10.0.0.2", "255.255.255.252")},
      {t: "Clock rate set on the DCE end (R-NY) and the serial line protocol is up", h: "R-NY: interface s0/0/0 → clock rate 64000. The clock icon on the cable marks the DCE end.", c: () => ifIsUp("R-NY", "S0/0/0") && ifIsUp("R-NJ", "S0/0/0")},
      {t: "Static routes: R-NY → 10.2.2.0/24, R-NJ → 10.1.1.0/24", h: "R-NY: ip route 10.2.2.0 255.255.255.0 10.0.0.2", c: () => routeTable(dn("R-NY")).some(r => r.code[0] === "S" && sameNet("10.2.2.10", r.net, r.mask)) && routeTable(dn("R-NJ")).some(r => r.code[0] === "S" && sameNet("10.1.1.10", r.net, r.mask))},
      {t: "PC-NY can ping PC-NJ (10.2.2.10)", h: "tracert 10.2.2.10 shows every hop", c: () => canPing("PC-NY", "10.2.2.10")},
      {t: "Both routers saved", h: "write", c: () => saved("R-NY") && saved("R-NJ")},
    ]},
  {id: "dhcp", title: "DHCP server on a router", tag: "Services", desc: "R1 hands out addresses to the office. The PCs are already set to DHCP.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "DHCP on a router"; s.dir = "TB";
      const r = D("R1", "router", "", "", "1941"), sw = D("SW1", "switch");
      L(r, "G0/0", sw, "G0/1", "copper");
      [1, 2, 3].forEach(i => L(sw, "Fa0/" + i, D("PC" + i, "pc"), "Fa0", "copper"));
      return s;
    },
    setup() { ["PC1", "PC2", "PC3"].forEach(n => setHost(dn(n), "dhcp")); },
    tasks: [
      {t: "R1 G0/0 = 192.168.1.1/24 and up", h: "interface g0/0 → ip address 192.168.1.1 255.255.255.0 → no shutdown", c: () => ifHas("R1", "G0/0", "192.168.1.1", "255.255.255.0") && ifIsUp("R1", "G0/0")},
      {t: "Exclude 192.168.1.1 – 192.168.1.10 from DHCP", h: "ip dhcp excluded-address 192.168.1.1 192.168.1.10", c: () => cfgOf("R1").dhcp.excluded.some(([a, b]) => a === "192.168.1.1" && b === "192.168.1.10")},
      {t: "Pool for 192.168.1.0/24 with default-router 192.168.1.1 and a DNS server", h: "ip dhcp pool LAN → network 192.168.1.0 255.255.255.0 → default-router 192.168.1.1 → dns-server 8.8.8.8", c: () => Object.values(cfgOf("R1").dhcp.pools).some(p => p.network === "192.168.1.0" && p.mask === "255.255.255.0" && p.gw === "192.168.1.1" && p.dns)},
      {t: "All three PCs lease an address above .10 with gateway .1", h: "PC → Command Prompt → ipconfig /renew", c: () => { autoDhcp(0); return ["PC1", "PC2", "PC3"].every(n => { const l = rt(dn(n)).lease; return l && !l.apipa && ipToInt(l.ip) > ipToInt("192.168.1.10") && l.gw === "192.168.1.1"; }); }},
      {t: "PC1 can ping R1", h: "ping 192.168.1.1", c: () => canPing("PC1", "192.168.1.1")},
      {t: "Look at the leases: show ip dhcp binding", h: "R1# show ip dhcp binding", bonus: true, c: () => Object.keys(rt(dn("R1")).leases).length >= 3},
    ]},
  {id: "ssh", title: "Secure remote access with SSHv2", tag: "Security", desc: "Replace Telnet with SSH version 2 and local usernames, then log in from the admin PC.",
    build() {
      const {s, D, L} = makeBuilder(); s.title = "SSH remote access"; s.dir = "TB";
      const r = D("R1", "router", "", "", "2911"), sw = D("SW1", "switch");
      L(r, "G0/0", sw, "G0/1", "copper"); L(sw, "Fa0/1", D("ADMIN-PC", "pc"), "Fa0", "copper");
      return s;
    },
    setup() { runCmds(dn("R1"), ["interface g0/0", "ip address 192.168.1.1 255.255.255.0", "no shutdown"]); setHost(dn("ADMIN-PC"), "192.168.1.10/24", "192.168.1.1"); },
    tasks: [
      {t: "Hostname other than Router, and an IP domain name", h: "hostname R1 → ip domain-name lab.local", c: () => cfgOf("R1").hostname !== "Router" && !!cfgOf("R1").domainName},
      {t: "RSA keys of at least 1024 bits", h: "crypto key generate rsa → 1024", c: () => cfgOf("R1").ssh.keyBits >= 1024},
      {t: "SSH version 2 only", h: "ip ssh version 2", c: () => cfgOf("R1").ssh.version === 2},
      {t: "A local user with a secret (type 5) password", h: "username admin secret Cisco123", c: () => Object.values(cfgOf("R1").users).some(u => u.secret)},
      {t: "VTY: login local and transport input ssh", h: "line vty 0 4 → login local → transport input ssh", c: () => cfgOf("R1").lines.vty.loginLocal && cfgOf("R1").lines.vty.transport === "ssh"},
      {t: "Log in from ADMIN-PC with SSH", h: "ADMIN-PC → Command Prompt → ssh -l admin 192.168.1.1", c: () => [...ACT_LOG.ssh].some(x => x.endsWith(">" + dn("R1").id))},
    ]},
];

// ---- working example: two sites, VLANs, router-on-a-stick, DHCP, DNS/web, WAN (also the base for Break it)
function exampleCampus() {
  const {s, D, L} = makeBuilder(); s.title = "Campus + WAN (working example)";
  const r1 = D("R1", "router", "", "HQ", "2911"), s1 = D("S1", "switch", "", "HQ"), r2 = D("R2", "router", "", "Branch", "2911"), s2 = D("S2", "switch", "", "Branch");
  L(r1, "G0/0", s1, "G0/1", "copper"); L(r1, "S0/0/0", r2, "S0/0/0", "serialDCE"); L(r2, "G0/0", s2, "G0/1", "copper");
  L(s1, "Fa0/1", D("SALES-PC", "pc", "", "HQ"), "Fa0", "copper"); L(s1, "Fa0/2", D("HR-PC", "pc", "", "HQ"), "Fa0", "copper");
  L(s2, "Fa0/1", D("WEB-DNS", "server", "", "Branch"), "Fa0", "copper"); L(s2, "Fa0/2", D("BRANCH-PC", "pc", "", "Branch"), "Fa0", "copper");
  return s;
}
function setupCampus() {
  runCmds(dn("S1"), ["hostname S1", "vlan 10", "name SALES", "vlan 20", "name HR", "interface g0/1", "switchport mode trunk", "interface fa0/1", "switchport mode access", "switchport access vlan 10", "interface fa0/2", "switchport mode access", "switchport access vlan 20"]);
  runCmds(dn("R1"), ["hostname R1", "interface g0/0", "no shutdown", "interface g0/0.10", "encapsulation dot1Q 10", "ip address 192.168.10.1 255.255.255.0", "interface g0/0.20", "encapsulation dot1Q 20", "ip address 192.168.20.1 255.255.255.0",
    "interface s0/0/0", "ip address 10.0.0.1 255.255.255.252", "clock rate 64000", "no shutdown", "ip dhcp excluded-address 192.168.10.1 192.168.10.9", "ip dhcp excluded-address 192.168.20.1 192.168.20.9",
    "ip dhcp pool SALES", "network 192.168.10.0 255.255.255.0", "default-router 192.168.10.1", "dns-server 172.16.2.10", "ip dhcp pool HR", "network 192.168.20.0 255.255.255.0", "default-router 192.168.20.1", "dns-server 172.16.2.10", "ip route 172.16.2.0 255.255.255.0 10.0.0.2"]);
  runCmds(dn("R2"), ["hostname R2", "interface g0/0", "ip address 172.16.2.1 255.255.255.0", "no shutdown", "interface s0/0/0", "ip address 10.0.0.2 255.255.255.252", "no shutdown", "ip route 192.168.10.0 255.255.255.0 10.0.0.1", "ip route 192.168.20.0 255.255.255.0 10.0.0.1"]);
  runCmds(dn("S2"), ["hostname S2"]);
  setHost(dn("SALES-PC"), "dhcp"); setHost(dn("HR-PC"), "dhcp");
  setHost(dn("BRANCH-PC"), "172.16.2.20/24", "172.16.2.1", "172.16.2.10");
  const w = dn("WEB-DNS"); setHost(w, "172.16.2.10/24", "172.16.2.1", "172.16.2.10");
  w.svc.dns.on = true; w.svc.dns.records = [{name: "www.campus.lab", ip: "172.16.2.10"}];
  w.svc.http.page = "<h1>Campus intranet</h1><p>If you can read this, DNS, routing and HTTP all work. 🎉</p>";
  ["R1", "R2", "S1", "S2"].forEach(n => saveStartup(dn(n)));
  rt(dn("SALES-PC")).lease = null; rt(dn("HR-PC")).lease = null;
  dhcpRequest(dn("SALES-PC")); dhcpRequest(dn("HR-PC"));
}
function exampleLanSetup() {
  runCmds(dn("R1"), ["hostname R1", "interface g0/0", "ip address 192.168.1.1 255.255.255.0", "no shutdown"]);
  runCmds(dn("SW1"), ["hostname SW1", "interface vlan 1", "ip address 192.168.1.2 255.255.255.0", "no shutdown", "exit", "ip default-gateway 192.168.1.1"]);
  [1, 2, 3].forEach(i => setHost(dn("PC" + i), `192.168.1.${10 + i}/24`, "192.168.1.1"));
}
function exampleWanSetup() {
  runCmds(dn("R-NY"), ["hostname R-NY", "interface g0/0", "ip address 10.1.1.1 255.255.255.0", "no shutdown", "interface s0/0/0", "ip address 10.0.0.1 255.255.255.252", "clock rate 64000", "no shutdown", "ip route 10.2.2.0 255.255.255.0 10.0.0.2"]);
  runCmds(dn("R-NJ"), ["hostname R-NJ", "interface g0/0", "ip address 10.2.2.1 255.255.255.0", "no shutdown", "interface s0/0/0", "ip address 10.0.0.2 255.255.255.252", "no shutdown", "ip route 10.1.1.0 255.255.255.0 10.0.0.1"]);
  setHost(dn("PC-NY"), "10.1.1.10/24", "10.1.1.1"); setHost(dn("PC-NJ"), "10.2.2.10/24", "10.2.2.1");
}
function loadConfigured(state, setup, msg) {
  state.devices.forEach(d => { d.ip = ""; });
  loadProject(state, msg); setup(); netDirty(); onTopologyChange(); render(); save(); outputs();
}

// ---- Break it! random faults on the working campus
const FAULTS = [
  {id: "shutTrunk", area: "an interface", apply() { runCmds(dn("R1"), ["interface g0/0", "shutdown"]); }, fix: "R1 G0/0 was shut down → interface g0/0, no shutdown"},
  {id: "wrongVlan", area: "a switch port", apply() { runCmds(dn("S1"), ["interface fa0/2", "switchport access vlan 10"]); }, fix: "S1 Fa0/2 (HR-PC) was moved to VLAN 10 → switchport access vlan 20"},
  {id: "trunkAllowed", area: "a trunk", apply() { runCmds(dn("S1"), ["interface g0/1", "switchport trunk allowed vlan 1,10"]); }, fix: "S1 G0/1 stopped carrying VLAN 20 → switchport trunk allowed vlan all"},
  {id: "noClock", area: "the WAN link", apply() { runCmds(dn("R1"), ["interface s0/0/0", "no clock rate"]); }, fix: "R1 S0/0/0 (DCE) lost its clock rate → clock rate 64000"},
  {id: "noRoute", area: "routing", apply() { runCmds(dn("R2"), ["no ip route 192.168.20.0 255.255.255.0 10.0.0.1"]); }, fix: "R2 lost its route to 192.168.20.0/24 → ip route 192.168.20.0 255.255.255.0 10.0.0.1"},
  {id: "badGw", area: "a PC", apply() { dn("BRANCH-PC").host.gw = "172.16.2.254"; }, fix: "BRANCH-PC's default gateway was 172.16.2.254 → 172.16.2.1"},
  {id: "badMask", area: "a server", apply() { dn("WEB-DNS").host.mask = "255.255.255.252"; }, fix: "WEB-DNS had mask 255.255.255.252 → 255.255.255.0"},
  {id: "wrongTag", area: "a sub-interface", apply() { runCmds(dn("R1"), ["interface g0/0.20", "encapsulation dot1Q 30"]); }, fix: "R1 G0/0.20 was tagged for VLAN 30 → encapsulation dot1Q 20"},
  {id: "poolGw", area: "DHCP", apply() { runCmds(dn("R1"), ["ip dhcp pool SALES", "default-router 192.168.10.254"]); rt(dn("SALES-PC")).lease = null; }, fix: "DHCP pool SALES handed out gateway 192.168.10.254 → default-router 192.168.10.1, then ipconfig /renew on SALES-PC"},
  {id: "shutWanR2", area: "an interface", apply() { runCmds(dn("R2"), ["interface s0/0/0", "shutdown"]); }, fix: "R2 S0/0/0 was shut down → no shutdown"},
];
const BREAK_GOALS = [
  {t: "SALES-PC can ping HR-PC", c: () => { const b = rt(dn("HR-PC")).lease; return !!b && canPing("SALES-PC", b.ip); }},
  {t: "SALES-PC can open http://www.campus.lab (DNS + HTTP)", c: () => { const r = dnsResolve(dn("SALES-PC"), "www.campus.lab"); return !!r.ip && tcpConnect(dn("SALES-PC"), r.ip, 80).ok; }},
  {t: "HR-PC can ping the web server 172.16.2.10", c: () => canPing("HR-PC", "172.16.2.10")},
  {t: "BRANCH-PC can ping SALES-PC", c: () => { const a = rt(dn("SALES-PC")).lease; return !!a && canPing("BRANCH-PC", a.ip); }},
  {t: "BRANCH-PC can ping its gateway and the HQ router (10.0.0.1)", c: () => canPing("BRANCH-PC", "10.0.0.1")},
];
function startBreakIt(n) {
  loadConfigured(exampleCampus(), setupCampus, "");
  const pool = FAULTS.slice().sort(() => Math.random() - .5).slice(0, n || 3);
  pool.forEach(f => f.apply());
  S.devices.filter(d => d.host && d.host.dhcp).forEach(d => { rt(d).lease = null; });
  autoDhcp(0);
  S.activity = {id: "breakit", faults: pool.map(f => f.id), revealed: false, started: Date.now()};
  S.title = "Break it! Troubleshooting";
  netDirty(); render(); save(); openActivityPanel(); activityCheck(true); fit();
  toast(`${pool.length} faults injected. Use ping, show commands and Simulation mode to find them.`);
}

// ---- panel
let actTimer = 0, ACT_DONE = false, BRK = null;
const actPanel = document.createElement("div"); actPanel.className = "actpanel hidden"; $("stage").appendChild(actPanel);
function currentActivity() {
  const a = S.activity; if (!a) return null;
  if (a.id === "breakit") return BRK && BRK.src === a ? BRK : (BRK = {src: a, id: "breakit", title: "Break it! Troubleshooting", tag: `${a.faults.length} hidden faults`, desc: "Something broke in this working network. Get every goal green again. The goals are re-checked as you work.",
    tasks: BREAK_GOALS.map(g => Object.assign({h: "Start with ping and tracert from the PC, then show ip interface brief / show ip route / show vlan brief / show interfaces trunk on the devices in the path."}, g)), faults: a.faults});
  return ACTIVITIES.find(x => x.id === a.id) || null;
}
function activityCheck(now) {
  if (!S.activity) return;
  clearTimeout(actTimer);
  actTimer = setTimeout(() => {
    const act = currentActivity(); if (!act) return;
    const saveEv = EVLOG; EVLOG = null;
    act.results = act.tasks.map(t => { try { return !!t.c(); } catch (e) { return false; } });
    EVLOG = saveEv;
    renderActPanel(act);
  }, now ? 0 : 450);
}
function renderActPanel(act) {
  act = act || currentActivity();
  if (!act) { actPanel.classList.add("hidden"); return; }
  const res = act.results || [], req = act.tasks.map((t, i) => [t, i]).filter(([t]) => !t.bonus);
  const done = req.filter(([, i]) => res[i]).length, pct = Math.round(done / req.length * 100);
  const allDone = done === req.length;
  if (allDone && !ACT_DONE && res.length) { ACT_DONE = true; toast(`🎉 ${act.title}: complete!`); }
  if (!allDone) ACT_DONE = false;
  actPanel.classList.remove("hidden");
  actPanel.classList.toggle("min", !!S.activity.min);
  actPanel.innerHTML = `<div class="ah"><span class="atag">${esc(act.tag)}</span><b>${esc(act.title)}</b><span class="grow"></span><button class="mini" data-a="min" title="${S.activity.min ? "Expand" : "Minimise"}">${S.activity.min ? "▢" : "–"}</button><button class="mini" data-a="close" title="Leave activity">✕</button></div>
    <div class="abar"><span style="width:${pct}%"></span></div><div class="apct">${done}/${req.length} tasks · ${pct}%${allDone ? " · complete 🎉" : ""}</div>
    <div class="ab"><p class="muted">${esc(act.desc)}</p><ol class="atasks">${act.tasks.map((t, i) => `<li class="${res[i] ? "ok" : ""}${t.bonus ? " bonus" : ""}"><span class="ck">${res[i] ? "✓" : ""}</span><div><span>${esc(t.t)}</span>${t.h ? `<details><summary>Hint</summary><code>${esc(t.h)}</code></details>` : ""}</div></li>`).join("")}</ol>
    ${act.faults ? `<div class="row"><button class="btn" data-a="reveal">${S.activity.revealed ? "Hide answers" : "Reveal the faults"}</button><button class="btn" data-a="again">New faults</button></div>${S.activity.revealed ? `<ul class="faults">${act.faults.map(id => `<li>${esc(FAULTS.find(f => f.id === id).fix)}</li>`).join("")}</ul>` : `<p class="muted">Areas: ${[...new Set(act.faults.map(id => FAULTS.find(f => f.id === id).area))].map(esc).join(", ")}</p>`}` : ""}
    <div class="row"><button class="btn primary" data-a="check">Check now</button><button class="btn" data-a="export">Copy checklist</button></div></div>`;
  actPanel.querySelectorAll("[data-a]").forEach(b => b.onclick = () => {
    const a = b.dataset.a;
    if (a === "min") { S.activity.min = !S.activity.min; save(); renderActPanel(act); }
    else if (a === "close") { if (confirm("Leave this activity? Your network stays as it is.")) { S.activity = null; save(); actPanel.classList.add("hidden"); } }
    else if (a === "check") activityCheck(true);
    else if (a === "reveal") { S.activity.revealed = !S.activity.revealed; save(); renderActPanel(act); }
    else if (a === "again") startBreakIt(act.faults.length);
    else if (a === "export") copyText(taskChecklist(), "Checklist copied ✓ Paste it into your lab note");
  });
}
function taskChecklist() {
  const act = currentActivity(); if (!act) return "";
  const res = act.results || [];
  return `### Tasks: ${act.title}\n` + act.tasks.map((t, i) => `- [${res[i] ? "x" : " "}] ${t.t}${t.bonus ? " *(bonus)*" : ""}`).join("\n") + "\n";
}
function openActivityPanel() { ACT_DONE = false; renderActPanel(); }
function startActivity(a) {
  ACT_LOG.telnet.clear(); ACT_LOG.ssh.clear();
  const st = a.build(); st.devices.forEach(d => { d.ip = ""; });
  loadProject(st, "");
  if (a.setup) a.setup();
  S.activity = {id: a.id, started: Date.now()};
  netDirty(); onTopologyChange(); render(); save(); outputs();
  openActivityPanel(); activityCheck(true); fit();
  toast(`Activity: ${a.title}. Double-click a device to configure it.`);
}
// ---- chooser dialog
const actDlg = document.createElement("dialog"); actDlg.className = "exp actdlg"; document.body.appendChild(actDlg);
function openActivities() {
  closeMenus();
  actDlg.innerHTML = `<div class="exh"><h2>Activities & labs</h2><button class="btn icon" data-x aria-label="Close">✕</button></div>
    <div class="actgrid">${ACTIVITIES.map(a => `<button class="actcard" data-id="${a.id}"><span class="atag">${esc(a.tag)}</span><b>${esc(a.title)}</b><small>${esc(a.desc)}</small><em>${a.tasks.filter(t => !t.bonus).length} auto-checked tasks</em></button>`).join("")}
      <button class="actcard brk" data-break><span class="atag">Troubleshooting</span><b>Break it!</b><small>A working two-site network gets random faults (shut ports, wrong VLANs, missing routes, bad gateways…). Find and fix them.</small><em><label>Faults <select data-n><option>2</option><option selected>3</option><option>4</option><option>5</option></select></label></em></button></div>
    <p class="muted" style="margin:10px 4px 0">Starting an activity replaces the current diagram (Ctrl+Z brings it back). Progress is checked live as you configure.</p>`;
  actDlg.querySelector("[data-x]").onclick = () => actDlg.close();
  actDlg.querySelectorAll("[data-id]").forEach(b => b.onclick = () => { actDlg.close(); startActivity(ACTIVITIES.find(a => a.id === b.dataset.id)); });
  const brk = actDlg.querySelector("[data-break]");
  brk.onclick = e => { if (e.target.closest("select")) return; actDlg.close(); startBreakIt(+actDlg.querySelector("[data-n]").value); };
  actDlg.showModal();
}
actDlg.addEventListener("click", e => { if (e.target === actDlg) actDlg.close(); });
$("openActs").onclick = openActivities;
$("exBreak").onclick = () => { closeMenus(); startBreakIt(3); };
$("exCampus").onclick = () => { closeMenus(); S.activity = null; renderActPanel(); loadConfigured(exampleCampus(), setupCampus, "Loaded working campus + WAN: try ping www.campus.lab from SALES-PC"); };
$("exLan").onclick = () => { closeMenus(); S.activity = null; renderActPanel(); loadConfigured(exampleLan(), exampleLanSetup, "Loaded small LAN (configured)"); };
$("exWan").onclick = () => { closeMenus(); S.activity = null; renderActPanel(); loadConfigured(exampleWan(), exampleWanSetup, "Loaded two-site WAN (configured)"); };
$("exLab").onclick = () => { closeMenus(); startActivity(ACTIVITIES[0]); };
