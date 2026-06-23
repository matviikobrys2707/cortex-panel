// ══════════════════════════════════════════════════════════════
//  Timer — полноэкранное меню выбора таймера
// ══════════════════════════════════════════════════════════════

const TIMER_KEY = "cortex_timers_v1";
let timers = [];

function loadTimers() {
  try {
    timers = JSON.parse(localStorage.getItem(TIMER_KEY) || "[]");
  } catch {
    timers = [];
  }
  renderTimers();
}

function saveTimers() {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
}

function addTimer(action, minutes, endsAt) {
  const t = {
    id: Date.now(),
    action,
    minutes,
    startsAt: Date.now(),
    endsAt: endsAt || Date.now() + minutes * 60 * 1000
  };
  timers.push(t);
  saveTimers();
  renderTimers();
}

function clearExpired() {
  const now = Date.now();
  const before = timers.length;
  timers = timers.filter(t => t.endsAt > now);
  if (timers.length !== before) saveTimers();
}

function renderTimers() {
  clearExpired();
  const status = document.getElementById("timerStatus");
  const actionEl = document.getElementById("timerAction");
  const timeEl = document.getElementById("timerTime");

  if (!timers.length) {
    if (status) status.style.display = "none";
    return;
  }

  // Показываем первый активный таймер
  const t = timers[0];
  const now = Date.now();
  const left = Math.max(0, Math.floor((t.endsAt - now) / 1000));
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

  if (actionEl) actionEl.textContent = icons[t.action] || "⏱";
  if (timeEl) timeEl.textContent = timeStr;
  if (status) status.style.display = "inline-flex";
}

// ── Открыть меню выбора действия ──
function openTimerMenu() {
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
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
    </div>
  `);
}

// ── Выбрали действие → вводим время ──
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

// ── Запуск таймера ──
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
    addTimer(action, min);
    toast("✅", `Таймер запущен: ${min} мин`, 3000);
  }
}

// ── WinLock таймер (с параметрами) ──
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
      <input class="inp" id="wlTimerPw" type="password" placeholder="Пароль"/>
    </div>
    
    <div class="flabel mt12">Озвучка</div>
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
    addTimer("winlock", min);
    toast("✅", `WinLock таймер: ${min} мин`, 3000);
  }
}

// ── Подтверждение отмены ──
function confirmCancelTimer() {
  if (!timers.length) {
    toast("ℹ️", "Нет активных таймеров", 2000);
    return;
  }

  openFsOverlay(`
    <div class="fs-title">⚠️ Отменить таймер?</div>
    <div class="fs-desc">Все запланированные действия будут отменены</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Нет</button>
      <button class="btn danger" onclick="cancelAllTimers()">✅ Да, отменить</button>
    </div>
  `);
}

async function cancelAllTimers() {
  closeFsOverlay();
  toast("⏳", "Отмена таймера...");

  const res = await execCmd("cancel");
  timers = [];
  saveTimers();
  renderTimers();

  if (res?.ok) {
    toast("✅", "Таймер отменён", 2000);
  }
}

function timerRefresh() {
  loadTimers();
  setInterval(() => renderTimers(), 1000);
}

window.timerRefresh = timerRefresh;
window.openTimerMenu = openTimerMenu;
window.selectTimerAction = selectTimerAction;
window.startTimer = startTimer;
window.confirmCancelTimer = confirmCancelTimer;
window.cancelAllTimers = cancelAllTimers;
window.openWinlockTimerMenu = openWinlockTimerMenu;
window.wlTimerTypeChange = wlTimerTypeChange;
window.startWinlockTimer = startWinlockTimer;
