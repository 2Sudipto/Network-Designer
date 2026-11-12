# Network Simulator

A Packet Tracer-style network simulator that runs in the browser, for CCNA practice.
You can build a topology, cable it, configure the devices with an IOS-like CLI, ping, and watch packets hop by hop. Then you can export the lab to Obsidian.

It's a plain HTML/CSS/JavaScript app: no install, no server and no build step needed to run it.

## Run it

| Option | How |
|---|---|
| **Locally** | Double-click `index.html` (or `dist/network-simulator.html`, a single self-contained file). |
| **GitHub Pages** | Push this repo to GitHub → **Settings → Pages** → *Deploy from a branch* → `main` / `/ (root)`. Your simulator is then at `https://<you>.github.io/<repo>/`. |
| **Obsidian** | `python tools/build.py --vault` copies the single-file build into the vault's `07_Templates` folder. |

Your work saves automatically in the browser (localStorage). Use **Project → Save project file** to keep a `.json` copy.

## What it does

**Workspace (Packet Tracer look)**
- Shaded device artwork in two styles (inspector → Icon style): *Cisco classic* topology symbols (router puck, switch, brick-wall firewall…) and *Realistic* rack hardware with ports and LEDs.
- Bottom-left device chooser: Routers, Switches, Hubs, Wireless, Security, WAN, End Devices, with real Cisco models (1841, 1941, 2911, ISR 4000, Catalyst 2960/3650/9200/9300, ASA…).
- **Connections**: Automatic, Console (rollover), Copper Straight-Through, Cross-Over, Fiber, Serial DCE (clock icon), Serial DTE, Wireless. When you pick a specific cable, a port picker opens on each device.
- Link lights: green = up, orange = STP blocking, red = down (shutdown, missing clock rate, wrong cable).
- Tools: Select, Inspect (ports plus ARP/MAC/routing tables), Delete, Note, Area, Add Simple PDU.
- Keyboard: `V` select, `C` connect, `I` inspect, `D` delete, `N` note, `A` area, `P` PDU, `Del`, `Ctrl+Z/Y`, `Ctrl+D`, `Ctrl+E`, `F` fit.

**Device windows** (double-click a device)
- Routers/switches: **Physical** (chassis with live port LEDs), **Config** (GUI forms that run real IOS commands and show the *Equivalent IOS Commands*), **CLI**.
- Firewalls: **Physical**, **Firewall Manager** (a web GUI like a real firewall's) and **CLI** (ASA-style).
- PCs/laptops: **Desktop** with IP Configuration (static or DHCP), Command Prompt, Terminal (console over a rollover cable) and Web Browser.
- Servers: **Services** for HTTP (editable page), DHCP (pool) and DNS (A records).

**IOS-like CLI**
- Modes `>` `#` `(config)` `(config-if)` `(config-subif)` `(config-if-range)` `(config-line)` `(config-vlan)` `(dhcp-config)`.
- `?` help, Tab completion, abbreviations (`sh ip int br`, `conf t`), history (↑/↓), `do`, `Ctrl+Z`, and output filters (`| include`, `| exclude`, `| begin`, `| section`).
- If you type an unknown word, it tries to resolve it as a hostname (`Translating "foo"...domain server`), which is why `no ip domain-lookup` exists.
- Security: `hostname`, `banner motd`, `enable password` / `enable secret` (real MD5-crypt type 5), `service password-encryption` (real reversible type 7), `line con 0` / `line vty`, `password`, `login`, `login local`, `exec-timeout`, `transport input`, `username … secret`, `ip domain-name`, `crypto key generate rsa`, `ip ssh version 2`.
- Interfaces: `ip address`, `shutdown`, `description`, `speed`, `duplex`, `clock rate` (DCE only), sub-interfaces with `encapsulation dot1Q`, `ip helper-address`, `interface range`, loopbacks, SVIs.
- Switching: `vlan` / `name`, `switchport mode access|trunk`, `switchport access vlan`, `switchport trunk native|allowed vlan`, `no switchport` (multilayer), `spanning-tree portfast`, `spanning-tree vlan … priority|root primary`, `ip default-gateway`.
- Routing: `ip route` (next hop or exit interface, AD), `ip routing`, DHCP pools (`network`, `default-router`, `dns-server`) and `ip dhcp excluded-address`.
- Show: `running-config`, `startup-config`, `version`, `ip interface brief`, `interfaces [x|status|trunk]`, `ip route`, `vlan [brief]`, `mac address-table`, `arp`, `cdp neighbors [detail]`, `spanning-tree`, `ip dhcp binding|pool`, `ip ssh`, `history`, `protocols`, `flash`, `clock`.
- `copy running-config startup-config`, `write`, `erase startup-config`, `reload` (unsaved changes are lost, like the real thing), `ping`, `traceroute`, `telnet`, `ssh -l`.

**Firewalls (ASA-style OS, models ASA 5506-X/5508-X/5516-X and Firepower 1010/1120/2110)**
- Boots with the real factory-default config: `outside` (G1/1, level 0) and `inside` (G1/2, 192.168.1.1/24, level 100), DHCP server on inside, PAT for everything inside, ASDM/HTTPS access from inside.
- Interfaces pass no traffic until they have a `nameif`; `nameif inside` defaults to security level 100, anything else to 0.
- Without an ACL, traffic flows from a higher to a lower security level only; `same-security-traffic permit inter-interface|intra-interface`.
- Stateful: TCP/UDP flows (and ICMP when `inspect icmp` is on) create connections, so return traffic passes without a rule. ICMP is **not** inspected by default, so pings from inside fail until you enable it or permit `echo-reply` (the classic ASA gotcha). The ASA does not decrement TTL, so it's invisible to traceroute.
- `access-list NAME extended permit|deny ip|tcp|udp|icmp any|host|net mask|object|interface … eq|lt|gt|neq|range … log inactive`, `line N`, `remark`, `access-group NAME in|out interface IFN`, hit counts.
- `object network` (host/subnet/range) with object NAT: `nat (inside,outside) dynamic interface|IP`, `nat (…) static IP`, port forwarding with `static interface service tcp 80 8080`, plus twice NAT `nat (in,out) source dynamic|static …`. Proxy ARP for mapped addresses. ACLs match the real (untranslated) address, like ASA 8.3+.
- To-the-box rules: the ASA only answers on the interface the packet arrived on; SSH/Telnet/HTTPS need `ssh|telnet|http NET MASK IFN`, an RSA key and `aaa authentication ssh console LOCAL`.
- `route IFN 0 0 GW`, `dhcpd address/dns/domain/enable`, `policy-map global_policy` → `class inspection_default` → `inspect icmp`, `logging enable|buffered|console`, `configure factory-default`, `clear configure …`, `write memory`, `reload`.
- Show: `running-config [section]`, `nameif`, `interface ip brief`, `route`, `xlate`, `conn [detail|count]`, `nat [detail]`, `access-list`, `logging` (real syslog IDs: 302013/302015/302020, 305011, 106001/106006/106014/106023, 313004, 710003, 605005…), `arp`, `dhcpd binding`, `service-policy`, `version`, `failover`.
- **`packet-tracer input IFN tcp|udp|icmp …`** shows every phase (UN-NAT, ROUTE-LOOKUP, ACCESS-LIST, NAT, INSPECT, FLOW-CREATION) and the drop reason.
- Show/ping/write/clear work straight from config mode (no `do`), and errors use the ASA's `ERROR: %` format.
- **Firewall Manager GUI**: dashboard (connections, translations, denies, interface status, latest events), interfaces, static routes + routing table, network objects, access rules per interface (ordered, enable/disable, move, hit counts, implicit rules shown), NAT rules, DHCP server, device management (users, management access, AAA, RSA keys, inspection policy, logging, factory reset), live monitoring (connections, xlates, syslog with filter, ARP) and a visual packet tracer. Every action runs the equivalent CLI, shown in the *Commands* drawer.

**More IOS behaviour (routers / switches)**
- ACLs: numbered standard (1–99) and extended (100–199), named `ip access-list standard|extended` with sequence numbers, `ip access-group … in|out`, vty `access-class`, `log` (`%SEC-6-IPACCESSLOGP`), match counters, the implicit deny, ICMP administratively-prohibited replies (`U` in ping). A missing ACL permits everything, like IOS. Outbound ACLs don't filter router-originated traffic.
- NAT/PAT: `ip nat inside|outside`, `ip nat inside source list … interface … overload`, pools (`netmask`/`prefix-length`), static NAT and static port forwarding, `show ip nat translations|statistics`, `clear ip nat translation *`. Order of operations matches IOS (inbound ACL → NAT outside→inside → routing → NAT inside→outside → outbound ACL).
- OSPF: `router ospf`, `network … area`, `ip ospf N area A`, `router-id` (sticky until `clear ip ospf process`), `passive-interface [default]`, `default-information originate [always]`, `auto-cost reference-bandwidth`, interface cost/priority/hello/dead/network point-to-point. Neighbours only form when area, subnet, mask and timers match, over the real L2 path (VLANs, trunks, STP). DR/BDR election, `O`, `O IA`, `O*E2` routes with ECMP, `%OSPF-5-ADJCHG` messages. Show `ip ospf neighbor|interface [brief]`, `ip ospf`, `ip protocols`, `ip route ospf|static|connected`.
- Port security: `switchport port-security` (rejected on dynamic/trunk ports like the real switch), `maximum`, `violation protect|restrict|shutdown`, `mac-address sticky`, err-disabled ports (recover with `shutdown` / `no shutdown`), `show port-security [interface|address]`.
- DTP: dynamic auto / desirable / trunk / `nonegotiate` negotiate like real switches (auto + auto stays access).
- Also: `show running-config interface X`, `show interfaces X switchport`, `show interfaces description`, `show ip interface X`, `show logging`, `ping X repeat N source IF`, `default interface X`.

**Network engine**
- Port and line-protocol state, serial clocking (DCE/DTE), spanning tree (root election, root/designated/blocked ports), MAC learning, 802.1Q tagging and native VLANs, ARP (a router drops the first packet while it ARPs, the classic `.!!!!`), connected/static routing with longest-prefix match, inter-VLAN routing, ICMP echo/unreachable/TTL-exceeded, DHCP (router pools, server pools, relay with `ip helper-address`), DNS, HTTP, Telnet and SSH reachability.
- PC commands: `ipconfig [/all|/release|/renew]`, `ping [-n]`, `tracert`, `arp -a|-d`, `nslookup`, `telnet`, `ssh -l`.

**Simulation mode**
- Event list with play / step / back / reset, speed control, and protocol filters (ARP, ICMP, DHCP, DNS, TCP).
- Coloured envelopes move along the cables. A red ✕ shows where a frame was dropped and why (STP blocking, wrong VLAN, no route…).
- Click an event to see that hop's layers 1–7 and what each device decided ("S1 learns … on Fa0/1", "R1 routing table: … via …").

**Activities**
- Auto-checked labs with live progress and hints: **Kalloo Lab 01 (Edison Smiles Dental)**, VLANs & trunking, router-on-a-stick, static routing over a serial WAN, DHCP on a router, SSHv2.
- **Break it!** injects 2–5 random faults into a working two-site network (shut ports, wrong VLANs, trunks missing a VLAN, missing clock rate or route, bad gateways or masks, wrong 802.1Q tags, a bad DHCP pool). You find and fix them, and can reveal the answers.
- Working configured examples: campus + WAN, small LAN, two-site WAN.

**Obsidian export** (`Ctrl+E`)
- Copy or download the picture (PNG/SVG), plus note text with a Mermaid diagram, cabling table, an addressing table built from the device configs, the activity checklist (`- [x]`), and each running-config in a collapsible callout.

## Develop

```
index.html          page layout (loads css/ and js/ directly)
css/style.css       all styles
js/00-…19-*.js      workspace: state, drawing, dock, tools, inspector, export
js/20-netutil.js    interface names, IPv4 maths, MAC addresses, type 7 + MD5-crypt
js/21-config.js     device config model, running-config text, startup/reload
js/22-cli-core.js   CLI parser (?, Tab, abbreviations, do, pipes), terminal, login
js/23-cli-commands.js  every IOS command and show output
js/24-engine.js     link state, STP, switching, ARP, routing, ICMP, DHCP, DNS, TCP
js/25-devwin.js     device windows: Physical, Config, CLI, Services
js/26-desktop.js    PC desktop apps
js/27-sim.js        Simulation mode
js/28-activities.js activities, Break it!, working examples
js/29-policy.js     shared ACL matching, NAT tables, device logging, L2 reachability
js/30-ios-extra.js  IOS ACLs, NAT, port security, DTP, extra show commands
js/31-ospf.js       OSPF neighbours, DR/BDR, SPF, show ip route
js/32-asa.js        firewall OS: config model, CLI commands, running-config
js/33-asa-engine.js firewall data path (stateful), packet-tracer, show xlate/conn/nat
js/34-asa-gui.js    Firewall Manager web GUI
js/99-start.js      startup (always last)
tools/build.py      refreshes the script list, builds dist/network-simulator.html
```

The files are classic scripts that load in name order and share one global scope. A file may only *call* functions from earlier files while it loads. At runtime everything can see everything.

After editing, run:

```
python tools/build.py           # update index.html + dist/
python tools/build.py --vault   # …and copy into the Obsidian vault
```

## Limits (it's a teaching simulator)

Not simulated yet: EIGRP/RIP/BGP, HSRP, EtherChannel, VPNs, firewall failover/contexts, IPv6, VTP/DTP details, Wi-Fi security, and the exec-timeout countdown. Those commands answer *"not simulated in this version"* instead of failing silently. Spanning tree runs a single instance (like CST) and doesn't model per-VLAN priorities. Packets resolve instantly; Simulation mode replays them step by step.

Roadmap ideas: EIGRP, HSRP, EtherChannel, site-to-site VPN on the firewall, IPv6.
