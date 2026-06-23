// ══════════════════════════════════════════════════════════════
//  Core — API, Toast, Navigation, Fullscreen Overlay
// ══════════════════════════════════════════════════════════════

const tg = window.Telegram?.WebApp;
const params = new URLSearchParams(location.search);
let API_BASE = (params.get("api") || localStorage.getItem("api_base") || "").trim().replace(/\/$/, "");
if (API_BASE) localStorage.setItem("api_base", API_BASE);
const inTG = !!(tg?.initData);
if (inTG) { tg.ready(); tg.expand(); }

const esc = s => String(s ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

// ── Toast ──
let _tt = null;
function toast(icon, msg, ms = 2800) {
  document.getElementById("toastIcon").textContent = icon;
  document.getElementById("toastText").textContent = msg;
  const el = document.getElementById("toastTop");
  el.classList.add("show");
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove("show"), ms);
}

// ── Fullscreen Overlay (закрытие по клику вне области) ──
function openFsOverlay(content) {
  document.getElementById("fsContent").innerHTML = content;
  document.getElementById("fsOverlay").classList.add("open");
}

function closeFsOverlay() {
  document.getElementById("fsOverlay").classList.remove("open");
}

function closeFsOverlayBg(e) {
  if (e.target.id === "fsOverlay") closeFsOverlay();
}

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    toast("✅", "Скопировано", 1400);
  } catch {
    toast("❌", "Ошибка копирования");
  }
}

// ── API ──
async function apiPost(path, payload) {
  if (!API_BASE) throw new Error("API URL не задан");
  const h = { "Content-Type": "application/json" };
  if (tg?.initData) h["X-Tg-Init-Data"] = tg.initData;
  const r = await fetch(API_BASE + path, { method: "POST", headers: h, body: JSON.stringify(payload || {}) });
  let data = null;
  try { data = await r.json(); } catch { }
  if (!r.ok) throw new Error(data?.message || "HTTP " + r.status);
  return data;
}

// ── execCmd ──
async function execCmd(cmd, extra = {}) {
  toast("⏳", cmd);
  try {
    const res = await apiPost("/api/exec", { cmd, ...extra });
    const ok = !!res.ok, msg = res.message || (ok ? "OK" : "Error");
    toast(ok ? "✅" : "❌", msg, 3500);
    const d = res.data;
    
    if (d?.type === "image" && d.b64 && d.mime) {
      const cap = { t: Date.now(), kind: cmd, type: "image", mime: d.mime, b64: d.b64, filename: `${cmd}_${Date.now()}.jpg` };
      window.addCapture?.(cap);
      window.openCapViewer?.(cap);
    }
    
    if (d?.type === "file" && d.url) {
      const cap = { t: Date.now(), kind: cmd, type: "file", url: API_BASE + d.url, filename: d.filename || "file", mime: d.mime || "", size: d.size || 0 };
      window.addCapture?.(cap);
      window.openCapViewer?.(cap);
    }
    
    return res;
  } catch (e) {
    toast("❌", e?.message || "Ошибка", 5000);
    return null;
  }
}

function confirmAction(cmd, title) {
  openFsOverlay(`
    <div class="fs-title">${esc(title)}</div>
    <div class="fs-desc">Это может привести к потере несохранённых данных</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="closeFsOverlay(); execCmd('${cmd}')">✅ Подтвердить</button>
    </div>
  `);
}

// ── Navigation ──
function openTab(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const pg = document.getElementById("page-" + name);
  if (pg) pg.classList.add("active");
  el.classList.add("active");
  if (name === "files") window.fbNavigate?.("drives");
}

// ── System info ──
async function updateInfo(showToast = false) {
  try {
    const res = await apiPost("/api/info", {});
    const d = res.data || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || "—"; };
    
    set("publicIp", d.public_ip);
    set("localIp", d.local_ip);
    set("cpuVal", d.cpu_percent != null ? d.cpu_percent.toFixed(1) + "%" : null);
    set("ramVal", d.ram);
    set("diskVal", d.disk_c);
    set("uptimeVal", d.uptime);
    set("osVal", d.os);
    set("pcVal", d.pc);
    set("cpuName", d.cpu_name || "—");
    set("gpuName", d.gpu_name || "—");
    
    setOnline(true);
    if (showToast) toast("✅", "Обновлено", 1600);
  } catch (e) {
    setOnline(false);
    if (showToast) toast("❌", e?.message || "error", 4000);
  }
}

function setOnline(on) {
  document.getElementById("dot").classList.toggle("on", on);
  document.getElementById("stxt").textContent = on ? (inTG ? "Telegram · online" : "online") : "offline";
}

// ── Settings ──
function openSettings() {
  const url = location.origin + location.pathname + (API_BASE ? "?api=" + encodeURIComponent(API_BASE) : "");
  openFsOverlay(`
    <div class="fs-title">⚙️ Настройки</div>
    <div class="fs-desc">API URL — адрес Cloudflare-туннеля</div>
    <div class="flabel">API URL</div>
    <input class="inp" id="apiInp" value="${esc(API_BASE)}" placeholder="https://xxxxx.trycloudflare.com"/>
    <div class="mt12"></div>
    <button class="bprim" onclick="saveApi()">💾 Сохранить</button>
    <div style="font-size:11px;color:var(--muted);margin-top:16px">Ссылка панели:</div>
    <div style="font-size:11px;color:#9cc2ff;word-break:break-all;margin-top:4px">${esc(url)}</div>
    <div class="mt8"></div>
    <button class="btn blue" style="width:100%" onclick="copyText('${esc(url).replace(/'/g, "\\'")}')">📋 Копировать ссылку</button>
  `);
}

function saveApi() {
  let v = (document.getElementById("apiInp")?.value || "").trim().replace(/\/$/, "");
  if (!v.startsWith("https://")) { toast("❌", "Нужен https://", 3500); return; }
  API_BASE = v;
  localStorage.setItem("api_base", API_BASE);
  toast("✅", "Сохранено", 1800);
  setOnline(false);
  closeFsOverlay();
  updateInfo(true);
}

// ── Boot ──
async function boot() {
  setOnline(false);
  if (!API_BASE) {
    document.getElementById("stxt").textContent = "Нужен API URL";
    return;
  }
  updateInfo(false);
  setInterval(() => updateInfo(false), 10_000);
}

// Export
window.apiPost = apiPost;
window.execCmd = execCmd;
window.confirmAction = confirmAction;
window.toast = toast;
window.openFsOverlay = openFsOverlay;
window.closeFsOverlay = closeFsOverlay;
window.closeFsOverlayBg = closeFsOverlayBg;
window.copyText = copyText;
window.openTab = openTab;
window.openSettings = openSettings;
window.saveApi = saveApi;
window.esc = esc;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}