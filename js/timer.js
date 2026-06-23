// ══════════════════════════════════════════════════════════════
//  Timer — только один активный таймер
// ══════════════════════════════════════════════════════════════

const TIMER_KEY = "cortex_timer_v2";
let activeTimer = null;

function loadTimer() {
  try {
    const data = localStorage.getItem(TIMER_KEY);
    if (data) activeTimer = JSON.parse(data);
    else activeTimer = null;
  } catch {
    activeTimer = null;
  }
  renderTimer();
}

function saveTimer() {
  if (activeTimer) {
    localStorage.setItem(TIMER_KEY, JSON.stringify(activeTimer));
  } else {
    localStorage.removeItem(TIMER_KEY);
  }
}

function setTimer(action, minutes, endsAt) {
  activeTimer = {
    action,
    minutes,
    startsAt: Date.now(),
    endsAt: endsAt || Date.now() + minutes * 60 * 1000
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
  const activeEl = document.getElementById("timerActive");
  const inactiveEl = document.getElementById("timerInactive");
  const iconEl = document.getElementById("timerActiveIcon");
  const actionEl = document.getElementById("timerActiveAction");
  const timeEl = document.getElementById("timerActiveTime");

  if (!activeTimer || activeTimer.endsAt < Date.now()) {
    if (activeTimer) clearTimer();
    if (activeEl) activeEl.style.display = "none";
    if (inactiveEl) inactiveEl.style.display = "block";
    return;
  }

  const now = Date.now();
  const left = Math.max(0, Math.floor((activeTimer.endsAt - now) / 1000));
  const m = Math.floor(left / 60);
  const s = left % 60;
  const timeStr = `${m}:${String(s).padStart(2, "0")}`;

  const icons = {
    shutdown: "⏻",
    reboot: "↺",
    lock: "🔒",
    sleep: "🌙",
    winlock: "🔐"
  };

  const actions = {
    shutdown: "Выключение",
    reboot: "Перезагрузка",
    lock: "Блокировка",
    sleep: "Сон",
    winlock: "WinLock"
  };

  if (iconEl) iconEl.textContent = icons[activeTimer.action] || "⏱";
  if (actionEl) actionEl.textContent = actions[activeTimer.action] || activeTimer.action;
  if (timeEl) timeEl.textContent = `через ${timeStr}`;
  if (activeEl) activeEl.style.display = "block";
  if (inactiveEl) inactiveEl.style.display = "none";
}

// ── Открыть меню выбора действия ──
function openTimerMenu() {
  if (activeTimer) {
    toast("ℹ️", "Уже есть активный таймер", 2500);
    return;
  }

  openFsOverlay(`
    <div class="fs-title">⏰ Добавить таймер</div>
    <div class="fs-desc">Выберите действие</div>
    <div class="grid g2" style="margin-bottom:16px">
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
    <div class="fs-desc">Через сколько минут?</div>
    <div class="flabel">Минуты (1-1440)</div>
    <input class="inp" id="timerMinInput" type="number" min="1" max="1440" placeholder="Например: 30" value="5"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="openTimerMenu()">Назад</button>
      <button class="btn ok" onclick="startTimer('${action}')">✅ Запустить</button>
    </div>
  `);
  setTimeout(() => document.getElementById("timerMinInput")?.focus(), 100);
}

async function startTimer(action) {
  const min = Number(document.getElementById("timerMinInput")?.value || 0);
  if (!min || min < 1 || min > 1440) {
    toast("❌", "Минуты должны быть от 1 до 1440", 3000);
    return;
  }

  closeFsOverlay();
  toast("⏳", "Запуск таймера...");

  const res = await execCmd("create", { action, minutes: min });
  if (res?.ok) {
    setTimer(action, min);
    toast("✅", `Таймер запущен: ${min} мин`, 3000);
  }
}

// ── WinLock таймер ──
function openWinlockTimerMenu() {
  openFsOverlay(`
    <div class="fs-title">🔐 Таймер WinLock</div>
    <div class="fs-desc">Настройте блокировку</div>
    
    <div class="flabel">Минуты (1-1440)</div>
    <input class="inp" id="wlTimerMin" type="number" min="1" max="1440" value="5"/>
    
    <div class="flabel mt12">Сообщение на экране</div>
    <input class="inp" id="wlTimerMsg" placeholder="Необязательно"/>
    
    <div class="flabel mt12">Тип блокировки</div>
    <select class="sel" id="wlTimerType" onchange="wlTimerTypeChange()">
      <option value="remote">📱 Только через Telegram</option>
      <option value="password">🔑 С паролем</option>
    </select>
    
    <div id="wlTimerPwWrap" style="display:none" class="mt12">
      <div class="flabel">Пароль (мин. 4 символа)</div>
      <input class="inp" id="wlTimerPw" type="password" placeholder="Введите пароль"/>
    </div>
    
    <div class="flabel mt12">Озвучка сообщения</div>
    <select class="sel" id="wlTimerVoice">
      <option value="0">🔇 Без озвучки</option>
      <option value="1">🔊 С озвучкой</option>
    </select>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="openTimerMenu()">Назад</button>
      <button class="btn danger" onclick="startWinlockTimer()">🔐 Запустить</button>
    </div>
  `);
}

function wlTimerTypeChange() {
  const sel = document.getElementById("wlTimerType");
  const wr = document.getElementById("wlTimerPwWrap");
  if (wr) wr.style.display = sel?.value === "password" ? "block" : "none";
}

async function startWinlockTimer() {
  const min = Number(document.getElementById("wlTimerMin")?.value || 0);
  const msg = document.getElementById("wlTimerMsg")?.value?.trim() || "";
  const lt = document.getElementById("wlTimerType")?.value || "remote";
  const pw = document.getElementById("wlTimerPw")?.value?.trim() || "";
  const vo = document.getElementById("wlTimerVoice")?.value === "1";

  if (!min || min < 1 || min > 1440) {
    toast("❌", "Минуты должны быть от 1 до 1440", 3000);
    return;
  }

  if (lt === "password" && pw.length < 4) {
    toast("❌", "Пароль минимум 4 символа", 3000);
    return;
  }

  closeFsOverlay();
  toast("⏳", "Запуск таймера WinLock...");

  const res = await execCmd("create", {
    action: "winlock",
    minutes: min,
    message: msg,
    lock_type: lt,
    password: pw,
    voice: vo
  });

  if (res?.ok) {
    setTimer("winlock", min);
    toast("✅", `WinLock таймер: ${min} мин`, 3000);
  }
}

// ── Подтверждение отмены ──
function confirmCancelTimer() {
  if (!activeTimer) {
    toast("ℹ️", "Нет активного таймера", 2000);
    return;
  }

  openFsOverlay(`
    <div class="fs-title">⚠️ Отменить таймер?</div>
    <div class="fs-desc">Запланированное действие будет отменено</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Нет</button>
      <button class="btn danger" onclick="cancelTimer()">✅ Да, отменить</button>
    </div>
  `);
}

async function cancelTimer() {
  closeFsOverlay();
  toast("⏳", "Отмена таймера...");

  const res = await execCmd("cancel");
  clearTimer();

  if (res?.ok) {
    toast("✅", "Таймер отменён", 2000);
  }
}

function timerRefresh() {
  loadTimer();
  setInterval(() => renderTimer(), 1000);
}

window.timerRefresh = timerRefresh;
window.openTimerMenu = openTimerMenu;
window.selectTimerAction = selectTimerAction;
window.startTimer = startTimer;
window.confirmCancelTimer = confirmCancelTimer;
window.cancelTimer = cancelTimer;
window.openWinlockTimerMenu = openWinlockTimerMenu;
window.wlTimerTypeChange = wlTimerTypeChange;
window.startWinlockTimer = startWinlockTimer;