// ======================================================================= DEVICES & MODELS
const TYPES = {
  router:   {label: "Router",            prefix: "R",   cat: "infra", def: "ISR4331"},
  switch:   {label: "Switch",            prefix: "SW",  cat: "sw",    def: "2960-24TT"},
  l3switch: {label: "Multilayer switch", prefix: "MLS", cat: "sw",    def: "3650-24PS"},
  firewall: {label: "Firewall",          prefix: "FW",  cat: "infra", def: "ASA 5506-X"},
  cloud:    {label: "Internet / ISP",    prefix: "ISP", cat: "cloud", def: "Cloud-PT"},
  hub:      {label: "Hub",               prefix: "HUB", cat: "sw",    def: "Hub-PT"},
  ap:       {label: "Access point",      prefix: "AP",  cat: "host",  def: "AP-PT"},
  wlc:      {label: "Wireless LAN ctrl", prefix: "WLC", cat: "infra", def: "WLC-2504"},
  pc:       {label: "PC",                prefix: "PC",  cat: "host",  def: "PC-PT"},
  laptop:   {label: "Laptop",            prefix: "LT",  cat: "host",  def: "Laptop-PT"},
  server:   {label: "Server",            prefix: "SRV", cat: "host",  def: "Server-PT"},
  printer:  {label: "Printer",           prefix: "PRN", cat: "host",  def: "Printer-PT"},
  phone:    {label: "IP phone",          prefix: "PH",  cat: "host",  def: "7960"},
  tablet:   {label: "Tablet",            prefix: "TAB", cat: "host",  def: "TabletPC-PT"},
};
const M = (name, desc, access, up) => ({name, desc, access, up: up || []});
const MODELS = {
  router: [
    ["ISR G1/G2 · Packet Tracer classics", [
      M("1841", "2 × Fast Ethernet + serial WIC", ["Fa0/0", "Fa0/1", "S0/0/0", "S0/0/1"]),
      M("1941", "2 × Gigabit + serial HWIC", ["G0/0", "G0/1", "S0/0/0", "S0/0/1"]),
      M("2901", "2 × Gigabit + serial HWIC", ["G0/0", "G0/1", "S0/0/0", "S0/0/1"]),
      M("2911", "3 × Gigabit + serial HWIC", ["G0/0", "G0/1", "G0/2", "S0/0/0", "S0/0/1"])]],
    ["ISR 4000 series", [
      M("ISR4221", "2 × Gigabit", ["G0/0/0", "G0/0/1"]),
      M("ISR4321", "2 × Gigabit + serial NIM", ["G0/0/0", "G0/0/1", "S0/1/0", "S0/1/1"]),
      M("ISR4331", "3 × Gigabit + serial NIM", ["G0/0/0", "G0/0/1", "G0/0/2", "S0/1/0", "S0/1/1"]),
      M("ISR4351", "3 × Gigabit + serial NIM", ["G0/0/0", "G0/0/1", "G0/0/2", "S0/1/0", "S0/1/1"])]],
    ["ISR 1000 · Catalyst 8000 (current)", [
      M("C1111-8P", "2 × WAN Gigabit + 8 switch ports", ["G0/0/0", "G0/0/1", ...range("G0/1/", 0, 7)]),
      M("C8200-1N-4T", "4 × Gigabit", range("G0/0/", 0, 3)),
      M("C8300-1N1S-6T", "6 × Gigabit", range("G0/0/", 0, 5))]],
    ["Service provider edge", [
      M("ASR1001-X", "6 × Gigabit + 2 × 10G", [...range("G0/0/", 0, 5), "Te0/0/0", "Te0/0/1"])]],
  ],
  switch: [
    ["Catalyst 2900 · access (Packet Tracer)", [
      M("2950-24", "24 × Fast Ethernet", range("Fa0/", 1, 24)),
      M("2950T-24", "24 × Fast Ethernet + 2 × Gigabit", range("Fa0/", 1, 24), ["G0/1", "G0/2"]),
      M("2960-24TT", "24 × Fast Ethernet + 2 × Gigabit", range("Fa0/", 1, 24), ["G0/1", "G0/2"]),
      M("2960-24TC", "24 × Fast Ethernet + 2 dual-purpose Gigabit", range("Fa0/", 1, 24), ["G0/1", "G0/2"]),
      M("2960X-48TS", "48 × Gigabit + 4 × SFP", range("G1/0/", 1, 48), range("G1/0/", 49, 52))]],
    ["Catalyst 9000 · access", [
      M("C9200-24P", "24 × Gigabit PoE+ + 4 × uplink", range("G1/0/", 1, 24), range("G1/1/", 1, 4)),
      M("C9200-48P", "48 × Gigabit PoE+ + 4 × uplink", range("G1/0/", 1, 48), range("G1/1/", 1, 4)),
      M("C9300-48P", "48 × Gigabit PoE+ + 4 × 10G", range("G1/0/", 1, 48), range("Te1/1/", 1, 4))]],
  ],
  l3switch: [
    ["Catalyst 3000 · distribution (Packet Tracer)", [
      M("3560-24PS", "24 × Fast Ethernet PoE + 2 × Gigabit", range("Fa0/", 1, 24), ["G0/1", "G0/2"]),
      M("3650-24PS", "24 × Gigabit PoE + 4 × uplink", range("G1/0/", 1, 24), range("G1/1/", 1, 4)),
      M("3850-24P", "24 × Gigabit PoE+ + 4 × uplink", range("G1/0/", 1, 24), range("G1/1/", 1, 4))]],
    ["Catalyst 9000 · distribution / core", [
      M("C9300-24P", "24 × Gigabit + 4 × 10G", range("G1/0/", 1, 24), range("Te1/1/", 1, 4)),
      M("C9500-24Y4C", "24 × 25G + 4 × 100G (core)", range("Twe1/0/", 1, 24), range("Hu1/0/", 25, 28))]],
    ["Nexus · data center", [
      M("N9K-C93180YC-FX", "48 × 25G + 6 × 100G (spine/leaf)", range("Eth1/", 1, 48), range("Eth1/", 49, 54))]],
  ],
  firewall: [
    ["ASA", [
      M("ASA 5505", "8 × Fast Ethernet switch ports", range("E0/", 0, 7)),
      M("ASA 5506-X", "8 × Gigabit", range("G1/", 1, 8))]],
    ["Firepower", [
      M("FPR-1010", "8 × Gigabit", range("Eth1/", 1, 8)),
      M("FPR-2110", "12 × Gigabit + 4 × SFP", range("Eth1/", 1, 16))]],
  ],
  cloud: [["Packet Tracer", [M("Cloud-PT", "ISP / internet cloud", range("Eth", 0, 5)), M("ISP", "Generic provider", range("Eth", 0, 5))]]],
  hub: [["Packet Tracer", [M("Hub-PT", "6 ports, one collision domain", range("Port ", 0, 5))]]],
  ap: [
    ["Packet Tracer", [M("AP-PT", "Autonomous AP", ["Port 0"]), M("LAP-PT", "Lightweight AP (needs a WLC)", ["G0"])]],
    ["Cisco", [M("AIR-AP2802", "Aironet 2800 (Wi-Fi 5)", ["G0"]), M("C9120AXI", "Catalyst 9120 (Wi-Fi 6)", ["G0"]), M("Meraki MR36", "Cloud-managed (Wi-Fi 6)", ["Eth0"])]],
  ],
  wlc: [
    ["AireOS", [M("WLC-2504", "4 × Gigabit", range("Gi", 1, 4)), M("WLC-3504", "4 × Gigabit + mGig", range("Gi", 1, 4))]],
    ["Catalyst 9800", [M("C9800-L", "4 × Gigabit", range("G0/0/", 0, 3)), M("C9800-CL", "Virtual (cloud)", ["G1", "G2"])]],
  ],
  pc: [["Packet Tracer", [M("PC-PT", "Desktop", ["Fa0", "G0", "RS232"])]]],
  laptop: [["Packet Tracer", [M("Laptop-PT", "Laptop", ["Fa0", "Wireless0"])]]],
  server: [["Packet Tracer", [M("Server-PT", "Generic server", ["Fa0", "G0"])]], ["Cisco UCS", [M("UCS C220 M5", "Rack server", ["eth0", "eth1"])]]],
  printer: [["Packet Tracer", [M("Printer-PT", "Network printer", ["Fa0"])]]],
  phone: [["Cisco IP phones", [M("7960", "Classic IP phone (PT)", ["Switch", "PC"]), M("8865", "Video IP phone", ["Switch", "PC"])]]],
  tablet: [["Packet Tracer", [M("TabletPC-PT", "Wireless tablet", ["Wireless0"])]]],
};
const ALLMODELS = Object.entries(MODELS).flatMap(([t, series]) => series.flatMap(([s, ms]) => ms.map(m => Object.assign({type: t, series: s}, m))));
const findModel = (type, name) => ALLMODELS.find(m => m.type === type && m.name === name);
const PALETTE = [["Network", ["router", "switch", "l3switch", "firewall", "cloud", "hub"]], ["Wireless", ["ap", "wlc"]], ["End devices", ["pc", "laptop", "server", "printer", "phone", "tablet"]]];
const CABLES = {
  copper:    {label: "Copper straight-through", color: "#7d8796", w: 2,   dash: "",         lights: true},
  crossover: {label: "Copper crossover",        color: "#2f7fe0", w: 2,   dash: "7 5",      lights: true},
  fiber:     {label: "Fiber",                   color: "#f08a24", w: 2.6, dash: "",         lights: true},
  trunk:     {label: "Trunk / EtherChannel",    color: "#8b46c9", w: 4.5, dash: "",         lights: true},
  serial:    {label: "Serial (WAN)",            color: "#d6362b", w: 2.4, dash: "",         lights: true, zig: true},
  wireless:  {label: "Wireless",                color: "#18a37f", w: 2,   dash: "2 6",      lights: false},
  console:   {label: "Console (rollover)",      color: "#3aa7d6", w: 2,   dash: "10 4 2 4", lights: false},
};
const EMOJI = {router:"🔀",switch:"🔲",l3switch:"🔳",hub:"⬛",firewall:"🧱",cloud:"☁️",ap:"📶",wlc:"📡",pc:"💻",laptop:"💻",server:"🖥️",printer:"🖨️",phone:"☎️",tablet:"📱"};
const MSHAPE = {router:["((", "))"], server:["[(", ")]"], cloud:["{{", "}}"], firewall:["[[", "]]"], ap:["([", "])"]};
const GROUP_COLORS = ["#0a84ff", "#16a34a", "#d97706", "#9333ea", "#dc2626", "#0891b2"];
const THEMES = {
  light: {text: "#16202e", muted: "#66728a", ip: "#0a5bc4", port: "#344052", canvas: "#fbfcfe", accent: "#0a66d6"},
  dark:  {text: "#e6ebf2", muted: "#98a4b8", ip: "#73b6ff", port: "#c8d1de", canvas: "#0c1118", accent: "#4d9bff"},
  white: {text: "#16202e", muted: "#66728a", ip: "#0a5bc4", port: "#344052", canvas: "#ffffff", accent: "#0a66d6"},
};
$("sharedDefs").innerHTML = DEFS;

