// ══════════════════════════════════════════════════════════════
//  Core — API, Toast, Sheet, Navigation
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
function toast(msg, ms = 2800) {
  document.getElementById("tbox").textContent = msg;
  const el = document.getElementById("toast");
  el.classList.add("show");
  clearTimeout(_tt);
  _tt = setTimeout(() => el.classList.remove("show"), ms);
}

// ── Sheet ──
function openSheet({ title = "", desc = "", bodyHtml = "", actions = [] }) {
  document.getElementById("stitle").textContent = title;
  document.getElementById("sdesc").textContent = desc;
  document.getElementById("sbody").innerHTML = bodyHtml;
  const a = document.getElementById("sacts");
  a.innerHTML = "";
  actions.forEach(x => {
    const b = document.createElement("button");
    b.className = "btn " + (x.kind || "blue");
    b.textContent = x.text || "OK";
    b.onclick = x.onClick || closeSheet;
    a.appendChild(b);
  });
  document.getElementById("sbg").classList.add("open");
}
function closeSheet() { document.getElementById("sbg").classList.remove("open"); }
function sbgClick(e) { if (e.target.id === "sbg") closeSheet(); }

async function copyText(s) {
  try {
    await navigator.clipboard.writeText(s);
    toast("✅ Скопировано", 1400);
  } catch {
    toast("❌ Ошибка копирования");
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
  toast("⏳ " + cmd);
  try {
    const res = await apiPost("/api/exec", { cmd, ...extra });
    const ok = !!res.ok, msg = res.message || (ok ? "OK" : "Error");
    toast((ok ? "✅ " : "❌ ") + msg, 3500);
    const d = res.data;
    if (d?.type === "text" && d.text) {
      openSheet({
        title: cmd, desc: msg,
        bodyHtml: `<pre class="code">${esc(d.text)}</pre>`,
        actions: [{ text: "📋 Копировать", kind: "ok", onClick: async () => { await copyText(d.text); } }, { text: "Закрыть", kind: "accent", onClick: closeSheet }]
      });
    }
    if (d?.type === "image" && d.b64 && d.mime) {
      const cap = { t: Date.now(), kind: cmd, type: "image", mime: d.mime, b64: d.b64, filename: `${cmd}_${Date.now()}.jpg` };
      window.addCapture?.(cap);
      window.openImgViewer?.(cap);
    }
    if (d?.type === "file" && d.url) {
      const cap = { t: Date.now(), kind: cmd, type: "file", url: API_BASE + d.url, filename: d.filename || "file", mime: d.mime || "", size: d.size || 0 };
      window.addCapture?.(cap);
      window.openFileViewer?.(cap);
    }
    return res;
  } catch (e) {
    toast("❌ " + (e?.message || "Ошибка"), 5000);
    return null;
  }
}

function confirmAction(cmd, title) {
  openSheet({
    title, desc: "Это может привести к потере несохранённых данных.",
    actions: [{ text: "Отмена", kind: "accent", onClick: closeSheet }, { text: "✅ Подтвердить", kind: "danger", onClick: async () => { closeSheet(); await execCmd(cmd); } }]
  });
}

// ── Navigation ──
function openTab(name, el) {
  document.querySelectorAll(".page").forEach(p => p.classList.remove("active"));
  document.querySelectorAll(".tab").forEach(b => b.classList.remove("active"));
  const pg = document.getElementById("page-" + name);
  if (pg) pg.classList.add("active");
  el.classList.add("active");
  if (name === "files") window.fbNavigate?.("drives");
  if (name === "timer") window.timerRefresh?.();
}

// ── System info ──
async function updateInfo(showToast = false) {
  try {
    const res = await apiPost("/api/info", {});
    const d = res.data || {};
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v || "—"; };
    set("publicIp", d.public_ip); set("localIp", d.local_ip);
    set("cpuVal", d.cpu_percent != null ? d.cpu_percent.toFixed(1) + "%" : null);
    set("ramVal", d.ram); set("diskVal", d.disk_c); set("uptimeVal", d.uptime);
    setOnline(true);
    if (showToast) toast("✅ Обновлено", 1600);
  } catch (e) {
    setOnline(false);
    if (showToast) toast("❌ " + (e?.message || "error"), 4000);
  }
}
function setOnline(on) {
  document.getElementById("dot").classList.toggle("on", on);
  document.getElementById("stxt").textContent = on ? (inTG ? "Telegram · online" : "online") : "offline";
}

// ── Settings ──
function openSettings() {
  const url = location.origin + location.pathname + (API_BASE ? "?api=" + encodeURIComponent(API_BASE) : "");
  openSheet({
    title: "Настройки", desc: "API URL — адрес Cloudflare-туннеля",
    bodyHtml: `
      <div class="flabel">API URL</div>
      <input class="inp" id="apiInp" value="${esc(API_BASE)}" placeholder="https://xxxxx.trycloudflare.com"/>
      <div class="mt8"></div>
      <button class="bprim" onclick="saveApi()">💾 Сохранить</button>
      <div style="font-size:11px;color:var(--muted);margin-top:12px">Ссылка панели:</div>
      <div style="font-size:11px;color:#9cc2ff;word-break:break-all;margin-top:4px">${esc(url)}</div>
      <div class="mt8"></div>
      <button class="brow blue" onclick="copyText('${esc(url)}')"><span class="bri">📋</span><span class="brt">Копировать ссылку</span></button>
    `,
    actions: [{ text: "Закрыть", kind: "accent", onClick: closeSheet }]
  });
}
function saveApi() {
  let v = (document.getElementById("apiInp")?.value || "").trim().replace(/\/$/, "");
  if (!v.startsWith("https://")) { toast("❌ Нужен https://", 3500); return; }
  API_BASE = v; localStorage.setItem("api_base", API_BASE);
  toast("✅ Сохранено", 1800); setOnline(false); closeSheet(); updateInfo(true);
}

// ── Boot ──
async function boot() {
  setOnline(false);
  if (!API_BASE) {
    document.getElementById("stxt").textContent = "Нужен API URL";
    // Показываем только главную вкладку
    document.getElementById("pages").innerHTML = `
      <div class="page active" id="page-main">
        <div class="slabel">Настройка</div>
        <div class="card">
          <div class="card-body">
            <div class="flabel">API URL не задан</div>
            <p style="font-size:12px;color:var(--muted);margin-top:8px">Нажмите кнопку настроек (⚙️) вверху справа.</p>
          </div>
        </div>
      </div>
    `;
    return;
  }

  // Загружаем UI
  try {
    await window.buildUI?.();
  } catch { }

  updateInfo(false);
  setInterval(() => updateInfo(false), 60_000);
}

// Export для других модулей
window.apiPost = apiPost;
window.execCmd = execCmd;
window.confirmAction = confirmAction;
window.toast = toast;
window.openSheet = openSheet;
window.closeSheet = closeSheet;
window.copyText = copyText;
window.openTab = openTab;
window.openSettings = openSettings;
window.saveApi = saveApi;
window.sbgClick = sbgClick;
window.esc = esc;

// Auto-boot
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", boot);
} else {
  boot();
}