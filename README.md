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
- Bottom-left device chooser: Routers, Switches, Hubs, Wireless, Security, WAN, End Devices, with real Cisco models (1841, 1941, 2911, ISR 4000, Catalyst 2960/3650/9200/9300, ASA…).
- **Connections**: Automatic, Console (rollover), Copper Straight-Through, Cross-Over, Fiber, Serial DCE (clock icon), Serial DTE, Wireless. When you pick a specific cable, a port picker opens on each device.
- Link lights: green = up, orange = STP blocking, red = down (shutdown, missing clock rate, wrong cable).
- Tools: Select, Inspect (ports plus ARP/MAC/routing tables), Delete, Note, Area, Add Simple PDU.
- Keyboard: `V` select, `C` connect, `I` inspect, `D` delete, `N` note, `A` area, `P` PDU, `Del`, `Ctrl+Z/Y`, `Ctrl+D`, `Ctrl+E`, `F` fit.

**Device windows** (double-click a device)
- Routers/switches: **Physical** (chassis with live port LEDs), **Config** (GUI forms that run real IOS commands and show the *Equivalent IOS Commands*), **CLI**.
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

Not simulated yet: OSPF/EIGRP/RIP, ACLs, NAT, HSRP, EtherChannel, port security, IPv6, VTP/DTP details, Wi-Fi security, and the exec-timeout countdown. Those commands answer *"not simulated in this version"* instead of failing silently. Spanning tree runs a single instance (like CST) and doesn't model per-VLAN priorities. Packets resolve instantly; Simulation mode replays them step by step.

Roadmap ideas: OSPF single-area, standard/extended ACLs, NAT overload, HSRP, EtherChannel, port security, IPv6.
