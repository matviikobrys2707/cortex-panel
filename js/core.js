// ══════════════════════════════════════════════════════════════
//  Core
// ══════════════════════════════════════════════════════════════

const tg = window.Telegram?.WebApp;
const params = new URLSearchParams(location.search);
let API_BASE = (params.get("api") || localStorage.getItem("api_base") || "").trim().replace(/\/$/, "");
if (API_BASE) localStorage.setItem("api_base", API_BASE);
const inTG = !!(tg?.initData);
if (inTG) { tg.ready(); tg.expand(); }

const esc = s => String(s ?? "").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;");

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

// ── Overlay ──
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
  } catch { toast("❌", "Ошибка копирования"); }
}

// ── API ──
async function apiPost(path, payload) {
  if (!API_BASE) throw new Error("API URL не задан");
  const h = { "Content-Type": "application/json" };
  if (tg?.initData) h["X-Tg-Init-Data"] = tg.initData;
  const r = await fetch(API_BASE + path, {
    method: "POST", headers: h,
    body: JSON.stringify(payload || {})
  });
  let data = null;
  try { data = await r.json(); } catch {}
  if (!r.ok) throw new Error(data?.message || "HTTP " + r.status);
  return data;
}

// ── execCmd ──
async function execCmd(cmd, extra = {}) {
  toast("⏳", cmd);
  try {
    const res = await apiPost("/api/exec", { cmd, ...extra });
    const ok  = !!res.ok;
    const msg = res.message || (ok ? "OK" : "Error");
    toast(ok ? "✅" : "❌", msg, 3500);
    const d = res.data;
    if (d?.type === "image" && d.b64 && d.mime) {
      const cap = { t: Date.now(), kind: cmd, mediaType: "image", mime: d.mime, b64: d.b64, filename: `${cmd}_${Date.now()}.jpg` };
      window.addCapture?.(cap);
      window.openCapViewer?.(cap);
    }
    if (d?.type === "file" && d.url) {
      const cap = { t: Date.now(), kind: cmd, mediaType: "video_file", url: API_BASE + d.url, filename: d.filename || "file", mime: d.mime || "", size: d.size || 0 };
      window.addCapture?.(cap);
      window.openCapViewer?.(cap);
    }
    return res;
  } catch (e) {
    toast("❌", e?.message || "Ошибка", 5000);
    return null;
  }
}

// ── confirmAction ──
function confirmAction(cmd, title) {
  openFsOverlay(`
    <div class="fs-title">${esc(title)}</div>
    <div class="fs-desc">Это действие не может быть отменено</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="closeFsOverlay(); execCmd('${cmd}')">✅ Подтвердить</button>
    </div>
  `);
}

// ── Navigation ──
let _currentTab = "main";
function openTab(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const pg = document.getElementById("page-" + name);
  if (pg) { pg.classList.add("active"); pg.scrollTop = 0; }
  el.classList.add("active");
  _currentTab = name;
  if (name === "control") window.startWinAutoRefresh?.();
  else window.stopWinAutoRefresh?.();
  if (name === "files") window.fbNavigate?.("drives");
  if (name === "media") window.fetchRealVolumeOnce?.();
}

// ── Форматирование байт ──
function _fmtBytes(n) {
  if (!n || n < 0) return "—";
  if (n >= 1e9) return (n/1e9).toFixed(1) + " GB";
  if (n >= 1e6) return (n/1e6).toFixed(1) + " MB";
  if (n >= 1e3) return (n/1e3).toFixed(1) + " KB";
  return n + " B";
}

// ── System info ──
let _prevNetSent = 0, _prevNetRecv = 0, _netInited = false;

async function updateInfo(showToast = false) {
  try {
    const res = await apiPost("/api/info", {});
    const d = res.data || {};

    // Статусы
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || "—"; };

    set("cpuValMain",   d.cpu_percent != null ? d.cpu_percent.toFixed(1) + "%" : null);
    set("uptimeValMain", d.uptime);
    set("localIpMain",  d.local_ip);
    set("publicIpMain", d.public_ip);
    set("osValMain",    d.os);
    set("pcValMain",    d.pc);
    set("cpuNameMain",  d.cpu_name || "—");
    set("gpuNameMain",  d.gpu_name || "—");
    set("ramValMain",   d.ram);

    // Сеть (дельта)
    if (d.net_sent != null && d.net_recv != null) {
      if (_netInited) {
        const ds = d.net_sent - _prevNetSent;
        const dr = d.net_recv - _prevNetRecv;
        set("netSent", _fmtBytes(d.net_sent));
        set("netRecv", _fmtBytes(d.net_recv));
      } else {
        set("netSent", _fmtBytes(d.net_sent));
        set("netRecv", _fmtBytes(d.net_recv));
        _netInited = true;
      }
      _prevNetSent = d.net_sent;
      _prevNetRecv = d.net_recv;
    }

    // Диски
    if (d.disks?.length) {
      _renderDisks(d.disks);
    }

    setOnline(true);
    if (showToast) toast("✅", "Обновлено", 1600);
  } catch (e) {
    setOnline(false);
    if (showToast) toast("❌", e?.message || "error", 4000);
  }
}

function _renderDisks(disks) {
  const c = document.getElementById("disksContainer");
  if (!c) return;
  c.innerHTML = disks.map(d => {
    const usedGB = (d.used / 1024**3).toFixed(1);
    const totalGB = (d.total / 1024**3).toFixed(1);
    const pct = d.percent || 0;
    const color = pct > 90 ? "#FF4D6D" : pct > 70 ? "#FBBF24" : "#34D399";
    return `
      <div class="disk-row">
        <div class="disk-header">
          <span class="disk-ico">💿</span>
          <span class="disk-name">Диск ${esc(d.mount)}</span>
          <span class="disk-info">${usedGB} / ${totalGB} GB (${pct}%)</span>
        </div>
        <div class="disk-bar-wrap">
          <div class="disk-bar" style="width:${pct}%;background:${color}"></div>
        </div>
      </div>
    `;
  }).join("");
}

function setOnline(on) {
  document.getElementById("dot").classList.toggle("on", on);
  document.getElementById("stxt").textContent = on
    ? (inTG ? "Telegram · online" : "online")
    : "offline";
}

// ── Settings ──
function openSettings() {
  const url = location.origin + location.pathname +
    (API_BASE ? "?api=" + encodeURIComponent(API_BASE) : "");
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
    <button class="btn blue" style="width:100%" onclick="copyText('${esc(url).replace(/'/g,"\\'")}')">
      📋 Копировать ссылку
    </button>
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

// ── WinLock кнопка на главной ──
async function openWinlockMainBtn() {
  try {
    const res = await apiPost("/api/winlock", { op: "status" });
    const locked = !!(res.data?.value?.locked);
    if (locked) {
      // Уже заблокировано — показываем меню разблокировки
      openFsOverlay(`
        <div class="fs-title">🔐 WinLock активен</div>
        <div class="fs-desc">Компьютер заблокирован через WinLock</div>
        <div class="fs-actions">
          <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
          <button class="btn ok" onclick="closeFsOverlay(); winlockUnlock()">🔓 Разблокировать</button>
        </div>
      `);
    } else {
      openWinlockMenu();
    }
  } catch {
    openWinlockMenu();
  }
}

// ── Boot ──
async function boot() {
  setOnline(false);
  if (!API_BASE) {
    document.getElementById("stxt").textContent = "Нужен API URL";
    setTimeout(() => openSettings(), 500);
    return;
  }
  await updateInfo(false);
  setInterval(() => updateInfo(false), 15000);
}

// ── Exports ──
window.apiPost          = apiPost;
window.execCmd          = execCmd;
window.confirmAction    = confirmAction;
window.toast            = toast;
window.openFsOverlay    = openFsOverlay;
window.closeFsOverlay   = closeFsOverlay;
window.closeFsOverlayBg = closeFsOverlayBg;
window.copyText         = copyText;
window.openTab          = openTab;
window.openSettings     = openSettings;
window.saveApi          = saveApi;
window.updateInfo       = updateInfo;
window.setOnline        = setOnline;
window.esc              = esc;
window.openWinlockMainBtn = openWinlockMainBtn;

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else { boot(); }