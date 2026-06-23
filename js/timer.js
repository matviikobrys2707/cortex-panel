// ══════════════════════════════════════════════════════════════
//  Timer — один активный таймер, умный ввод времени
// ══════════════════════════════════════════════════════════════

const TIMER_KEY = "cortex_timer_v3";
let activeTimer = null;

function loadTimer() {
  try {
    const d = localStorage.getItem(TIMER_KEY);
    activeTimer = d ? JSON.parse(d) : null;
    if (activeTimer && activeTimer.endsAt < Date.now()) {
      activeTimer = null;
      localStorage.removeItem(TIMER_KEY);
    }
  } catch { activeTimer = null; }
  renderTimer();
}

function saveTimer() {
  if (activeTimer) localStorage.setItem(TIMER_KEY, JSON.stringify(activeTimer));
  else localStorage.removeItem(TIMER_KEY);
}

function setTimer(action, totalSeconds) {
  activeTimer = {
    action,
    startsAt: Date.now(),
    endsAt:   Date.now() + totalSeconds * 1000
  };
  saveTimer();
  renderTimer();
}

function clearTimer() {
  activeTimer = null;
  saveTimer();
  renderTimer();
}

function renderTimer() {
  const badgeWrap  = document.getElementById("timerBadgeWrap");
  const badgeIcon  = document.getElementById("timerBadgeIcon");
  const badgeText  = document.getElementById("timerBadgeText");

  if (!activeTimer || activeTimer.endsAt < Date.now()) {
    if (activeTimer) clearTimer();
    if (badgeWrap) badgeWrap.style.display = "none";
    return;
  }

  const left = Math.max(0, Math.floor((activeTimer.endsAt - Date.now()) / 1000));
  const h = Math.floor(left / 3600);
  const m = Math.floor((left % 3600) / 60);
  const s = left % 60;

  let timeStr = "";
  if (h > 0) timeStr = `${h}:${String(m).padStart(2,"0")}:${String(s).padStart(2,"0")}`;
  else timeStr = `${m}:${String(s).padStart(2,"0")}`;

  const icons   = { shutdown:"⏻", reboot:"↺", lock:"🔒", sleep:"🌙", winlock:"🔐" };
  const actions = { shutdown:"Выключение", reboot:"Перезагрузка", lock:"Блокировка", sleep:"Сон", winlock:"WinLock" };

  if (badgeIcon) badgeIcon.textContent = icons[activeTimer.action] || "⏱";
  if (badgeText) badgeText.textContent = `${actions[activeTimer.action] || "Действие"} через ${timeStr}`;
  if (badgeWrap) badgeWrap.style.display = "block";
}

// ── Ввод времени (часы/минуты/секунды) ──
function timeInputHTML() {
  return `
    <div class="time-input-row">
      <div class="time-input-block">
        <input class="time-inp" id="tHours"   type="number" min="0" max="23"  value="0" placeholder="0"/>
        <div class="time-inp-label">часы</div>
      </div>
      <div class="time-input-sep">:</div>
      <div class="time-input-block">
        <input class="time-inp" id="tMinutes" type="number" min="0" max="59"  value="5" placeholder="0"/>
        <div class="time-inp-label">мин</div>
      </div>
      <div class="time-input-sep">:</div>
      <div class="time-input-block">
        <input class="time-inp" id="tSeconds" type="number" min="0" max="59"  value="0" placeholder="0"/>
        <div class="time-inp-label">сек</div>
      </div>
    </div>
  `;
}

function getTimeInputSeconds() {
  const h = Number(document.getElementById("tHours")?.value   || 0);
  const m = Number(document.getElementById("tMinutes")?.value || 0);
  const s = Number(document.getElementById("tSeconds")?.value || 0);
  return h * 3600 + m * 60 + s;
}

// ── Меню выбора действия ──
function openTimerMenu() {
  if (activeTimer) {
    toast("ℹ️", "Уже есть активный таймер", 2500);
    return;
  }
  openFsOverlay(`
    <div class="fs-title">⏰ Новый таймер</div>
    <div class="fs-desc">Выберите действие</div>
    <div class="grid g2" style="margin-bottom:12px">
      <button class="btn danger" onclick="selectTimerAction('shutdown','⏻ Выключение')">
        <span class="bi">⏻</span>Выключение
      </button>
      <button class="btn warn" onclick="selectTimerAction('reboot','↺ Перезагрузка')">
        <span class="bi">↺</span>Перезагрузка
      </button>
      <button class="btn accent" onclick="selectTimerAction('lock','🔒 Блокировка')">
        <span class="bi">🔒</span>Блокировка
      </button>
      <button class="btn blue" onclick="selectTimerAction('sleep','🌙 Сон')">
        <span class="bi">🌙</span>Сон
      </button>
    </div>
    <button class="btn danger" style="width:100%" onclick="selectTimerAction('winlock','🔐 WinLock')">
      <span class="bi">🔐</span>WinLock
    </button>
  `);
}

function selectTimerAction(action, title) {
  if (action === "winlock") {
    openWinlockTimerMenu();
    return;
  }
  openFsOverlay(`
    <div class="fs-title">${esc(title)}</div>
    <div class="fs-desc">Через какое время?</div>
    ${timeInputHTML()}
    <div class="fs-actions">
      <button class="btn accent" onclick="openTimerMenu()">Назад</button>
      <button class="btn ok" onclick="startTimer('${action}')">▶ Запустить</button>
    </div>
  `);
  // Добавляем стили если нет
  injectTimeInputStyles();
}

async function startTimer(action) {
  const sec = getTimeInputSeconds();
  if (!sec || sec < 1) { toast("❌", "Укажите время", 2500); return; }
  if (sec > 86400)     { toast("❌", "Максимум 24 часа", 2500); return; }

  closeFsOverlay();
  toast("⏳", "Запуск...");

  const minutes = sec / 60;
  const res = await execCmd("create", { action, minutes });
  if (res?.ok) {
    setTimer(action, sec);
    toast("✅", `Таймер запущен`, 2500);
  }
}

function openWinlockTimerMenu() {
  openFsOverlay(`
    <div class="fs-title">🔐 Таймер WinLock</div>
    ${timeInputHTML()}
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
      <button class="btn accent" onclick="openTimerMenu()">Назад</button>
      <button class="btn danger" onclick="startWinlockTimer()">🔐 Запустить</button>
    </div>
  `);
  injectTimeInputStyles();
}

function wlTimerTypeChange() {
  const v = document.getElementById("wlTimerType")?.value;
  const w = document.getElementById("wlTimerPwWrap");
  if (w) w.style.display = v === "password" ? "block" : "none";
}

async function startWinlockTimer() {
  const sec = getTimeInputSeconds();
  const msg = document.getElementById("wlTimerMsg")?.value?.trim() || "";
  const lt  = document.getElementById("wlTimerType")?.value || "remote";
  const pw  = document.getElementById("wlTimerPw")?.value?.trim() || "";
  const vo  = document.getElementById("wlTimerVoice")?.value === "1";

  if (!sec || sec < 1) { toast("❌", "Укажите время", 2500); return; }
  if (lt === "password" && pw.length < 4) { toast("❌", "Пароль мин. 4 символа", 2500); return; }

  closeFsOverlay();
  const minutes = sec / 60;
  const res = await execCmd("create", { action:"winlock", minutes, message:msg, lock_type:lt, password:pw, voice:vo });
  if (res?.ok) {
    setTimer("winlock", sec);
    toast("✅", "WinLock таймер запущен", 2500);
  }
}

function confirmCancelTimer() {
  if (!activeTimer) { toast("ℹ️", "Нет активного таймера", 2000); return; }
  openFsOverlay(`
    <div class="fs-title">⚠️ Отменить таймер?</div>
    <div class="fs-desc">Действие будет отменено</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Нет</button>
      <button class="btn danger" onclick="doCancelTimer()">Да, отменить</button>
    </div>
  `);
}

async function doCancelTimer() {
  closeFsOverlay();
  toast("⏳", "Отмена...");
  // Отменяем системный shutdown
  await execCmd("cancel");
  // Очищаем локальный
  clearTimer();
  toast("✅", "Таймер отменён", 2000);
}

function injectTimeInputStyles() {
  if (document.getElementById("timeInputCSS")) return;
  const s = document.createElement("style");
  s.id = "timeInputCSS";
  s.textContent = `
    .time-input-row {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      margin: 16px 0;
    }
    .time-input-block {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
    }
    .time-inp {
      width: 80px;
      background: rgba(30,41,66,0.6);
      border: 1.5px solid rgba(124,110,250,0.4);
      border-radius: 12px;
      color: #e8eeff;
      font-size: 28px;
      font-weight: 900;
      text-align: center;
      padding: 12px 8px;
      outline: none;
      font-variant-numeric: tabular-nums;
    }
    .time-inp:focus {
      border-color: #7C6EFA;
      box-shadow: 0 0 0 3px rgba(124,110,250,0.2);
    }
    .time-inp-label {
      font-size: 10px;
      font-weight: 700;
      color: #6B7A99;
      letter-spacing: 0.5px;
      text-transform: uppercase;
    }
    .time-input-sep {
      font-size: 28px;
      font-weight: 900;
      color: #7C6EFA;
      margin-bottom: 20px;
    }
  `;
  document.head.appendChild(s);
}

function timerRefresh() {
  loadTimer();
  setInterval(renderTimer, 1000);
}

window.timerRefresh = timerRefresh;
window.openTimerMenu = openTimerMenu;
window.selectTimerAction = selectTimerAction;
window.startTimer = startTimer;
window.confirmCancelTimer = confirmCancelTimer;
window.doCancelTimer = doCancelTimer;
window.openWinlockTimerMenu = openWinlockTimerMenu;
window.wlTimerTypeChange = wlTimerTypeChange;
window.startWinlockTimer = startWinlockTimer;