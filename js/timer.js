// ══════════════════════════════════════════════════════════════
//  Timer — правильная логика с threading.Timer на сервере
// ══════════════════════════════════════════════════════════════

const TIMER_KEY = "cortex_timers_v4";
let timers = []; // [{id, action, endsAt, label}]
let timerInterval = null;

function timerInit() {
  _loadTimers();
  timerInterval = setInterval(_tickTimers, 1000);
  _renderTimers();
}

function _loadTimers() {
  try {
    const d = localStorage.getItem(TIMER_KEY);
    timers = d ? JSON.parse(d) : [];
    // Убираем истёкшие
    timers = timers.filter(t => t.endsAt > Date.now());
  } catch {
    timers = [];
  }
}

function _saveTimers() {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
}

function _addTimer(action, totalSeconds) {
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const icons = { shutdown:"⏻", reboot:"↺", lock:"🔒", sleep:"🌙", winlock:"🔐" };
  const names = { shutdown:"Выключение", reboot:"Перезагрузка", lock:"Блокировка", sleep:"Сон", winlock:"WinLock" };
  timers.push({
    id,
    action,
    endsAt: Date.now() + totalSeconds * 1000,
    icon: icons[action] || "⏱",
    label: names[action] || action
  });
  _saveTimers();
  _renderTimers();
  return id;
}

function _removeTimer(id) {
  timers = timers.filter(t => t.id !== id);
  _saveTimers();
  _renderTimers();
}

function _tickTimers() {
  const now = Date.now();
  let changed = false;
  timers = timers.filter(t => {
    if (t.endsAt <= now) { changed = true; return false; }
    return true;
  });
  if (changed) { _saveTimers(); }
  _renderTimers();
}

function _formatTime(ms) {
  const s = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2,"0")}:${String(sec).padStart(2,"0")}`;
  return `${m}:${String(sec).padStart(2,"0")}`;
}

function _renderTimers() {
  const container = document.getElementById("timersList");
  if (!container) return;

  if (!timers.length) {
    container.innerHTML = "";
    return;
  }

  container.innerHTML = timers.map(t => {
    const left = t.endsAt - Date.now();
    const timeStr = _formatTime(left);
    return `
      <div class="timer-card" id="tcard-${t.id}">
        <div class="timer-card-icon">${t.icon}</div>
        <div class="timer-card-body">
          <div class="timer-card-label">${t.label}</div>
          <div class="timer-card-time" id="ttime-${t.id}">${timeStr}</div>
        </div>
        <button class="timer-card-del" onclick="confirmCancelTimer('${t.id}')">✕</button>
      </div>
    `;
  }).join("");
}

// ── Меню создания таймера ──
function openTimerMenu() {
  openFsOverlay(`
    <div class="fs-title">⏰ Новый таймер</div>
    <div class="fs-desc">Выберите действие</div>
    <div class="grid g2" style="margin-bottom:12px">
      <button class="btn danger" onclick="selectTimerAction('shutdown')">
        <span class="bi">⏻</span>Выключение
      </button>
      <button class="btn warn" onclick="selectTimerAction('reboot')">
        <span class="bi">↺</span>Перезагрузка
      </button>
      <button class="btn accent" onclick="selectTimerAction('lock')">
        <span class="bi">🔒</span>Блокировка
      </button>
      <button class="btn blue" onclick="selectTimerAction('sleep')">
        <span class="bi">🌙</span>Сон
      </button>
    </div>
    <button class="btn" style="width:100%;border-color:rgba(124,110,250,.3)"
      onclick="selectTimerAction('winlock')">
      <span class="bi">🔐</span>WinLock
    </button>
  `);
}

function selectTimerAction(action) {
  if (action === "winlock") {
    openWinlockTimerMenu();
    return;
  }
  const icons = { shutdown:"⏻", reboot:"↺", lock:"🔒", sleep:"🌙" };
  const names = { shutdown:"Выключение", reboot:"Перезагрузка", lock:"Блокировка", sleep:"Сон" };
  openFsOverlay(`
    <div class="fs-title">${icons[action]} ${names[action]}</div>
    <div class="fs-desc">Через какое время?</div>
    ${_timeInputHTML()}
    <div class="fs-actions">
      <button class="btn accent" onclick="openTimerMenu()">← Назад</button>
      <button class="btn ok" onclick="startTimer('${action}')">▶ Запустить</button>
    </div>
  `);
  _injectTimeInputStyles();
}

async function startTimer(action) {
  const sec = _getTimeInputSeconds();
  if (!sec || sec < 1) { toast("❌", "Укажите время", 2500); return; }
  if (sec > 86400) { toast("❌", "Максимум 24 часа", 2500); return; }

  closeFsOverlay();
  toast("⏳", "Запуск таймера…");

  const res = await apiPost("/api/exec", {
    cmd: "create",
    action,
    minutes: sec / 60
  });

  if (res?.ok) {
    _addTimer(action, sec);
    toast("✅", `Таймер запущен`, 2500);
  } else {
    toast("❌", res?.message || "Ошибка", 3000);
  }
}

function openWinlockTimerMenu() {
  openFsOverlay(`
    <div class="fs-title">🔐 Таймер WinLock</div>
    ${_timeInputHTML()}
    <div class="flabel mt12">Сообщение</div>
    <input class="inp" id="wlTimerMsg" placeholder="Необязательно"/>
    <div class="flabel mt12">Тип</div>
    <select class="sel" id="wlTimerType" onchange="wlTimerTypeChange()">
      <option value="remote">📱 Через Telegram</option>
      <option value="password">🔑 С паролем</option>
    </select>
    <div id="wlTimerPwWrap" style="display:none" class="mt12">
      <div class="flabel">Пароль (мин. 4 симв.)</div>
      <input class="inp" id="wlTimerPw" type="password" placeholder="Пароль"/>
    </div>
    <div class="flabel mt12">Озвучка</div>
    <select class="sel" id="wlTimerVoice">
      <option value="0">🔇 Без</option>
      <option value="1">🔊 С озвучкой</option>
    </select>
    <div class="fs-actions">
      <button class="btn accent" onclick="openTimerMenu()">← Назад</button>
      <button class="btn danger" onclick="startWinlockTimer()">🔐 Запустить</button>
    </div>
  `);
  _injectTimeInputStyles();
}

function wlTimerTypeChange() {
  const v = document.getElementById("wlTimerType")?.value;
  const w = document.getElementById("wlTimerPwWrap");
  if (w) w.style.display = v === "password" ? "block" : "none";
}

async function startWinlockTimer() {
  const sec = _getTimeInputSeconds();
  const msg = document.getElementById("wlTimerMsg")?.value?.trim() || "";
  const lt  = document.getElementById("wlTimerType")?.value || "remote";
  const pw  = document.getElementById("wlTimerPw")?.value?.trim() || "";
  const vo  = document.getElementById("wlTimerVoice")?.value === "1";

  if (!sec || sec < 1) { toast("❌", "Укажите время", 2500); return; }
  if (lt === "password" && pw.length < 4) { toast("❌", "Пароль мин. 4 символа", 2500); return; }

  closeFsOverlay();
  const res = await apiPost("/api/exec", {
    cmd: "create",
    action: "winlock",
    minutes: sec / 60,
    message: msg,
    lock_type: lt,
    password: pw,
    voice: vo
  });

  if (res?.ok) {
    _addTimer("winlock", sec);
    toast("✅", "WinLock таймер запущен", 2500);
  } else {
    toast("❌", res?.message || "Ошибка", 3000);
  }
}

// ── Отмена таймера ──
function confirmCancelTimer(id) {
  const t = timers.find(x => x.id === id);
  if (!t) return;
  openFsOverlay(`
    <div class="fs-title">⚠️ Отменить таймер?</div>
    <div class="fs-desc">${t.icon} ${t.label} — будет отменён</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Нет</button>
      <button class="btn danger" onclick="doCancelTimer('${id}')">Да, отменить</button>
    </div>
  `);
}

async function doCancelTimer(id) {
  closeFsOverlay();
  toast("⏳", "Отмена…");

  // Отменяем на сервере — cancel_all отменяет ВСЕ threading.Timer
  const res = await apiPost("/api/exec", { cmd: "cancel" });

  // Удаляем из UI независимо от результата
  _removeTimer(id);
  toast("✅", "Таймер отменён", 2000);
}

// ── Вспомогательные ──
function _timeInputHTML() {
  return `
    <div class="time-input-row">
      <div class="time-input-block">
        <input class="time-inp" id="tHours" type="number" min="0" max="23" value="0"/>
        <div class="time-inp-label">часы</div>
      </div>
      <div class="time-input-sep">:</div>
      <div class="time-input-block">
        <input class="time-inp" id="tMinutes" type="number" min="0" max="59" value="5"/>
        <div class="time-inp-label">мин</div>
      </div>
      <div class="time-input-sep">:</div>
      <div class="time-input-block">
        <input class="time-inp" id="tSeconds" type="number" min="0" max="59" value="0"/>
        <div class="time-inp-label">сек</div>
      </div>
    </div>
  `;
}

function _getTimeInputSeconds() {
  const h = Number(document.getElementById("tHours")?.value || 0);
  const m = Number(document.getElementById("tMinutes")?.value || 0);
  const s = Number(document.getElementById("tSeconds")?.value || 0);
  return h * 3600 + m * 60 + s;
}

function _injectTimeInputStyles() {
  if (document.getElementById("timeInputCSS")) return;
  const s = document.createElement("style");
  s.id = "timeInputCSS";
  s.textContent = `
    .time-input-row{display:flex;align-items:center;justify-content:center;gap:8px;margin:16px 0}
    .time-input-block{display:flex;flex-direction:column;align-items:center;gap:4px}
    .time-inp{width:80px;background:rgba(30,41,66,0.6);border:1.5px solid rgba(124,110,250,0.4);
      border-radius:12px;color:#e8eeff;font-size:28px;font-weight:900;text-align:center;
      padding:12px 8px;outline:none;font-variant-numeric:tabular-nums}
    .time-inp:focus{border-color:#7C6EFA;box-shadow:0 0 0 3px rgba(124,110,250,0.2)}
    .time-inp-label{font-size:10px;font-weight:700;color:#6B7A99;letter-spacing:0.5px;text-transform:uppercase}
    .time-input-sep{font-size:28px;font-weight:900;color:#7C6EFA;margin-bottom:20px}
  `;
  document.head.appendChild(s);
}

window.timerInit = timerInit;
window.openTimerMenu = openTimerMenu;
window.selectTimerAction = selectTimerAction;
window.startTimer = startTimer;
window.openWinlockTimerMenu = openWinlockTimerMenu;
window.wlTimerTypeChange = wlTimerTypeChange;
window.startWinlockTimer = startWinlockTimer;
window.confirmCancelTimer = confirmCancelTimer;
window.doCancelTimer = doCancelTimer;