
"use strict";
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? "" : s).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const range = (p, a, b) => Array.from({length: b - a + 1}, (_, i) => p + (a + i));
const f2 = n => n.toFixed(2);

