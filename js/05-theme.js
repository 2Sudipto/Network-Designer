// ======================================================================= THEME
let themePref = "auto";
try { themePref = localStorage.getItem("ndb.theme") || "auto"; } catch (e) {}
const mq = matchMedia("(prefers-color-scheme: dark)");
const isDark = () => themePref === "dark" || (themePref === "auto" && mq.matches);
function applyTheme() { document.documentElement.setAttribute("data-theme", isDark() ? "dark" : "light"); TH = isDark() ? THEMES.dark : THEMES.light; render(); }
mq.addEventListener("change", () => { if (themePref === "auto") applyTheme(); });
$("themeBtn").onclick = () => { themePref = themePref === "auto" ? "light" : themePref === "light" ? "dark" : "auto"; try { localStorage.setItem("ndb.theme", themePref); } catch (e) {} applyTheme(); toast("Theme: " + themePref); };

