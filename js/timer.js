// ══════════════════════════════════════════════════════════════
//  Timer — управление таймерами
// ══════════════════════════════════════════════════════════════

const TIMER_KEY = "cortex_timers_v1";
let timers = [];

function loadTimers() {
  try { timers = JSON.parse(localStorage.getItem(TIMER_KEY) || "[]"); } catch { timers = []; }
  renderTimers();
}

function saveTimers() {
  localStorage.setItem(TIMER_KEY, JSON.stringify(timers));
}

function addTimer(action, minutes) {
  const t = {
    id: Date.now(),
    action,
    minutes,
    startsAt: Date.now(),
    endsAt: Date.now() + minutes * 60 * 1000
  };
  timers.push(t);
  saveTimers();
  renderTimers();
}

function cancelTimer(id) {
  timers = timers.filter(t => t.id !== id);
  saveTimers();
  renderTimers();
  // Отменить на сервере
  execCmd("cancel");
}

function clearExpired() {
  const now = Date.now();
  timers = timers.filter(t => t.endsAt > now);
  saveTimers();
  renderTimers();
}

function renderTimers() {
  clearExpired();
  const list = document.getElementById("timerList");
  const empty = document.getElementById("timerEmpty");
  if (!list) return;

  if (!timers.length) {
    list.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  list.innerHTML = "";
  for (const t of timers) {
    const now = Date.now();
    const left = Math.max(0, Math.floor((t.endsAt - now) / 1000));
    const m = Math.floor(left / 60);
    const s = left % 60;
    const timeStr = `${m}:${String(s).padStart(2, "0")}`;

    const actions = { shutdown: "Выключение", reboot: "Перезагрузка", lock: "Блокировка", sleep: "Сон", winlock: "WinLock" };
    const div = document.createElement("div");
    div.className = "timer-item";
    div.innerHTML = `
      <div class="timer-body">
        <div class="timer-action">${actions[t.action] || t.action}</div>
        <div class="timer-time">${timeStr}</div>
      </div>
      <button class="btn danger" style="min-width:70px;min-height:40px" onclick="cancelTimer(${t.id})">Отмена</button>
    `;
    list.appendChild(div);
  }
}

function openTimerSheet() {
  openSheet({
    title: "⏰ Новый таймер",
    desc: "Выберите действие и время",
    bodyHtml: `
      <div class="flabel">Действие</div>
      <select class="sel" id="timerAction">
        <option value="shutdown">⏻ Выключение</option>
        <option value="reboot">↺ Перезагрузка</option>
        <option value="lock">🔒 Блокировка</option>
        <option value="sleep">🌙 Сон</option>
        <option value="winlock">🔐 WinLock</option>
      </select>
      <div class="flabel mt12">Через (минут)</div>
      <input class="inp" id="timerMin" type="number" min="1" max="1440" placeholder="1-1440" value="5"/>
    `,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      { text: "✅ Запустить", kind: "ok", onClick: startTimerFromSheet }
    ]
  });
}

async function startTimerFromSheet() {
  const action = document.getElementById("timerAction")?.value || "shutdown";
  const min = Number(document.getElementById("timerMin")?.value || 0);
  if (!min || min < 1 || min > 1440) {
    toast("❌ Минуты 1..1440", 3000);
    return;
  }

  closeSheet();

  // Запускаем на сервере
  const cmd = action === "winlock" ? "winlock_timer" : action;
  const res = await execCmd(cmd, { minutes: min });

  if (res?.ok) {
    addTimer(action, min);
    toast(`✅ Таймер запущен: ${min} мин`);
  }
}

function timerRefresh() {
  loadTimers();
  setInterval(() => renderTimers(), 1000);
}

window.timerRefresh = timerRefresh;
window.openTimerSheet = openTimerSheet;
window.cancelTimer = cancelTimer;