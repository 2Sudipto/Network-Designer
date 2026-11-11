// ======================================================================= NETWORK UTILITIES (names, IPs, hashes)
// ---- interface names: diagram ports are short ("G0/0", "Fa0/1"); IOS shows long names
const IF_TYPES = [
  // [regex for the letters someone might type, long name, short name used in `show ip int brief`-style tables]
  [/^(g|gi|gig|giga|gigabit|gigabitethernet)$/i, "GigabitEthernet", "Gig"],
  [/^(f|fa|fas|fast|fastethernet)$/i, "FastEthernet", "Fa"],
  [/^(s|se|ser|serial)$/i, "Serial", "Se"],
  [/^(t|te|ten|tengigabitethernet)$/i, "TenGigabitEthernet", "Te"],
  [/^(twe|twentyfivegige)$/i, "TwentyFiveGigE", "Twe"],
  [/^(hu|hundredgige)$/i, "HundredGigE", "Hu"],
  [/^(e|et|eth|ethernet)$/i, "Ethernet", "Eth"],
  [/^(v|vl|vla|vlan)$/i, "Vlan", "Vlan"],
  [/^(l|lo|loop|loopback)$/i, "Loopback", "Lo"],
  [/^(port|port )$/i, "Port", "Port"],
];
function splitIf(name) {
  const m = String(name).trim().match(/^([a-z]+(?: (?=\d))?)\s*([\d/.:]+)$/i);
  return m ? {t: m[1].trim(), n: m[2]} : null;
}
function ifType(letters) { const e = IF_TYPES.find(([re]) => re.test(letters)); return e || null; }
function longIf(name) {
  const s = splitIf(name); if (!s) return name;
  const t = ifType(s.t); return t ? t[1] + s.n : name;
}
function shortIf(name) { const s = splitIf(name); if (!s) return name; const t = ifType(s.t); return t ? t[2] + s.n : name; }
// Canonical key so "g0/0", "Gi0/0", "GigabitEthernet0/0" and the model's "G0/0" all match
function ifKey(name) { const s = splitIf(name); if (!s) return String(name).toLowerCase(); const t = ifType(s.t); return (t ? t[1] : s.t).toLowerCase() + s.n; }
// Find a device port (or virtual interface) from what someone typed. Returns the device's own name for it.
function resolveIf(dev, typed) {
  const k = ifKey(typed.replace(/\s+/g, ""));
  const p = allPorts(dev).find(x => ifKey(x) === k);
  if (p) return p;
  const s = splitIf(typed.replace(/\s+/g, "")); if (!s) return null;
  const t = ifType(s.t); if (!t) return null;
  if (t[1] === "Vlan" && /^\d+$/.test(s.n)) return "Vlan" + s.n;
  if (t[1] === "Loopback" && /^\d+$/.test(s.n)) return "Loopback" + s.n;
  // sub-interface on a real port, e.g. g0/0.10
  const sub = s.n.match(/^(.*)\.(\d+)$/);
  if (sub) { const parent = allPorts(dev).find(x => ifKey(x) === (t[1].toLowerCase() + sub[1])); if (parent) return parent + "." + sub[2]; }
  return null;
}
const isVirtualIf = n => /^(Vlan|Loopback)\d+$/.test(n) || /\.\d+$/.test(n);
const parentIf = n => n.replace(/\.\d+$/, "");

// ---- IPv4 helpers
const ipToInt = ip => { const p = String(ip).split(".").map(Number); return p.length === 4 && p.every(x => Number.isInteger(x) && x >= 0 && x <= 255) ? ((p[0] << 24) >>> 0) + (p[1] << 16) + (p[2] << 8) + p[3] : null; };
const intToIp = n => [n >>> 24, (n >>> 16) & 255, (n >>> 8) & 255, n & 255].join(".");
const isIp = ip => ipToInt(ip) !== null && /^\d+\.\d+\.\d+\.\d+$/.test(String(ip));
const maskToLen = m => { const n = ipToInt(m); if (n === null) return null; const len = n.toString(2).replace(/^(1*)0*$/, "$1").length; return ((len ? (0xffffffff << (32 - len)) >>> 0 : 0) === n) ? len : null; };
const lenToMask = len => intToIp(len ? (0xffffffff << (32 - len)) >>> 0 : 0);
const isMask = m => maskToLen(m) !== null;
const netOf = (ip, mask) => intToIp((ipToInt(ip) & ipToInt(mask)) >>> 0);
const sameNet = (a, b, mask) => ((ipToInt(a) & ipToInt(mask)) >>> 0) === ((ipToInt(b) & ipToInt(mask)) >>> 0);
const bcastOf = (ip, mask) => intToIp(((ipToInt(ip) & ipToInt(mask)) | (~ipToInt(mask) >>> 0)) >>> 0);
function classfulMask(ip) { const f = ipToInt(ip) >>> 24; return f < 128 ? "255.0.0.0" : f < 192 ? "255.255.0.0" : "255.255.255.0"; }
// "192.168.1.10/24" → {ip, mask}
function parseCidr(s) { const m = String(s).trim().match(/^(\d+\.\d+\.\d+\.\d+)\s*\/\s*(\d{1,2})$/); if (!m || !isIp(m[1]) || +m[2] > 32) return null; return {ip: m[1], mask: lenToMask(+m[2])}; }

// ---- MAC addresses (stable per device + port)
function hash32(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
function macOf(dev, port) {
  const h = hash32(dev.id + "|" + (port || "")), h2 = hash32(port + "|" + dev.id);
  const b = [0x00, 0x0d ^ (h & 3), (h >>> 8) & 255, (h >>> 16) & 255, (h2 >>> 8) & 255, (h2 >>> 16) & 255];
  const hex = b.map(x => x.toString(16).padStart(2, "0")).join("");
  return hex.slice(0, 4) + "." + hex.slice(4, 8) + "." + hex.slice(8, 12);
}
const macDashed = m => m.replace(/\./g, "").toUpperCase().match(/../g).join("-");

// ---- Cisco "type 7" (Vigenère-style, reversible: that's the point of the lesson)
const XLAT7 = "dsfd;kfoA,.iyewrkldJKDHSUBsgvca69834ncxv9873254k;fg87";
function type7Encrypt(pw, seed) {
  seed = seed == null ? (hash32(pw) % 16) : seed;
  let out = String(seed).padStart(2, "0");
  for (let i = 0; i < pw.length; i++) out += ((pw.charCodeAt(i) ^ XLAT7.charCodeAt((seed + i) % XLAT7.length)) & 255).toString(16).toUpperCase().padStart(2, "0");
  return out;
}
function type7Decrypt(enc) {
  const seed = parseInt(enc.slice(0, 2), 10); let out = "";
  for (let i = 2, j = 0; i + 1 < enc.length; i += 2, j++) out += String.fromCharCode(parseInt(enc.substr(i, 2), 16) ^ XLAT7.charCodeAt((seed + j) % XLAT7.length));
  return out;
}

// ---- MD5 + md5-crypt ("type 5", $1$salt$hash) — a real one-way hash, unlike type 7
function md5Bytes(bytes) {
  const K = [], R = [7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 7, 12, 17, 22, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 5, 9, 14, 20, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 4, 11, 16, 23, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21, 6, 10, 15, 21];
  for (let i = 0; i < 64; i++) K[i] = Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0;
  const len = bytes.length, nBlk = ((len + 8) >> 6) + 1, words = new Array(nBlk * 16).fill(0);
  for (let i = 0; i < len; i++) words[i >> 2] |= bytes[i] << ((i % 4) * 8);
  words[len >> 2] |= 0x80 << ((len % 4) * 8);
  words[nBlk * 16 - 2] = (len * 8) >>> 0; words[nBlk * 16 - 1] = Math.floor(len / 536870912) >>> 0;
  let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
  for (let blk = 0; blk < nBlk; blk++) {
    let A = a0, B = b0, C = c0, D = d0;
    for (let i = 0; i < 64; i++) {
      let F, g;
      if (i < 16) { F = (B & C) | (~B & D); g = i; }
      else if (i < 32) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; }
      else if (i < 48) { F = B ^ C ^ D; g = (3 * i + 5) % 16; }
      else { F = C ^ (B | ~D); g = (7 * i) % 16; }
      F = (F + A + K[i] + words[blk * 16 + g]) >>> 0;
      A = D; D = C; C = B; B = (B + ((F << R[i]) | (F >>> (32 - R[i])))) >>> 0;
    }
    a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
  }
  const out = [];
  for (const v of [a0, b0, c0, d0]) for (let i = 0; i < 4; i++) out.push((v >>> (i * 8)) & 255);
  return out;
}
const utf8 = s => Array.from(unescape(encodeURIComponent(s)), c => c.charCodeAt(0));
const md5Hex = s => md5Bytes(utf8(s)).map(b => b.toString(16).padStart(2, "0")).join("");
const ITOA64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function md5Crypt(pw, salt) {
  salt = (salt || "").slice(0, 8);
  const P = utf8(pw), Sb = utf8(salt), magic = utf8("$1$");
  let fin = md5Bytes([...P, ...Sb, ...P]);
  let ctx = [...P, ...magic, ...Sb];
  for (let pl = P.length; pl > 0; pl -= 16) ctx.push(...fin.slice(0, Math.min(16, pl)));
  for (let i = P.length; i; i >>= 1) ctx.push(i & 1 ? 0 : P[0] || 0);
  fin = md5Bytes(ctx);
  for (let i = 0; i < 1000; i++) {
    let c = [];
    c.push(...(i & 1 ? P : fin));
    if (i % 3) c.push(...Sb);
    if (i % 7) c.push(...P);
    c.push(...(i & 1 ? fin : P));
    fin = md5Bytes(c);
  }
  const to64 = (v, n) => { let s = ""; while (n-- > 0) { s += ITOA64[v & 0x3f]; v >>= 6; } return s; };
  let out = "";
  [[0, 6, 12], [1, 7, 13], [2, 8, 14], [3, 9, 15], [4, 10, 5]].forEach(([a, b, c]) => { out += to64((fin[a] << 16) | (fin[b] << 8) | fin[c], 4); });
  out += to64(fin[11], 2);
  return "$1$" + salt + "$" + out;
}
function randSalt(seed) { let h = hash32(seed + Date.now()), s = ""; for (let i = 0; i < 4; i++) { s += ITOA64[h & 63]; h >>>= 6; } return s; }
function checkSecret(pw, hashStr) { const m = String(hashStr).match(/^\$1\$([^$]*)\$/); return m ? md5Crypt(pw, m[1]) === hashStr : false; }
