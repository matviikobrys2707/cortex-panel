// ══════════════════════════════════════════════════════════════
//  Troll — расширенный набор функций
// ══════════════════════════════════════════════════════════════

const TROLL_KEY = "cortex_troll_v2";

let trollState = {
  mouse: false,
  keyboard: false,
  crazy: false,
};

function loadTrollState() {
  try {
    const s = JSON.parse(localStorage.getItem(TROLL_KEY) || "{}");
    trollState = { mouse: false, keyboard: false, crazy: false, ...s };
  } catch {
    trollState = { mouse: false, keyboard: false, crazy: false };
  }
  renderTrollState();
}

function saveTrollState() {
  localStorage.setItem(TROLL_KEY, JSON.stringify(trollState));
}

function renderTrollState() {
  _updateTrollBtn("mouse", "btnMouse", "lblMouse", "badgeMouse",
    "Блокировка мыши", "Разблокировать");
  _updateTrollBtn("keyboard", "btnKb", "lblKb", "badgeKb",
    "Блокировка клавиатуры", "Разблокировать");
  _updateTrollBtn("crazy", "btnCrazy", "lblCrazy", "badgeCrazy",
    "Сумасшедшая мышь", "Остановить");
}

function _updateTrollBtn(key, btnId, lblId, badgeId, offText, onText) {
  const active = trollState[key];
  const btn    = document.getElementById(btnId);
  const lbl    = document.getElementById(lblId);
  const badge  = document.getElementById(badgeId);

  if (!btn) return;

  if (active) {
    btn.classList.add("active");
    if (lbl) lbl.textContent = onText;
    if (badge) {
      badge.textContent = "ВКЛ";
      badge.className = "ttc-badge on";
    }
  } else {
    btn.classList.remove("active");
    if (lbl) lbl.textContent = offText;
    if (badge) {
      badge.textContent = "ВЫКЛ";
      badge.className = "ttc-badge off";
    }
  }
}

async function trollToggle(key) {
  const current = trollState[key];
  const cmdMap = {
    mouse:    { on: "disable_mouse",    off: "enable_mouse" },
    keyboard: { on: "disable_keyboard", off: "enable_keyboard" },
    crazy:    { on: "crazy_mouse",      off: "crazy_mouse" },
  };

  const cmd = current ? cmdMap[key].off : cmdMap[key].on;
  const res = await execCmd(cmd);

  if (res?.ok) {
    trollState[key] = !current;
    saveTrollState();
    renderTrollState();
  }
}

// ═════════════════════════════════════════════════════
// Спам клавишами
// ═════════════════════════════════════════════════════
function openSpamMenu() {
  openFsOverlay(`
    <div class="fs-title">📢 Спам клавишами</div>
    <div class="fs-desc">Клавиша будет нажата много раз</div>
    <div class="flabel">Клавиша</div>
    <input class="inp" id="spamKey" value="space" placeholder="enter, space, a…"/>
    <div class="flabel mt12">Количество</div>
    <input class="inp" id="spamCount" type="number" value="50" min="1" max="500"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn warn" onclick="startSpam()">📢 Запустить</button>
    </div>
  `);
}

async function startSpam() {
  const key   = document.getElementById("spamKey")?.value?.trim() || "space";
  const count = Math.min(500, Math.max(1, Number(document.getElementById("spamCount")?.value || 50)));
  closeFsOverlay();
  toast("⏳", `Спам: ${key} × ${count}`);

  for (let i = 0; i < count; i++) {
    await apiPost("/api/exec", { cmd: "press_key", key });
    await new Promise(r => setTimeout(r, 30));
  }
  toast("✅", "Спам завершён", 2000);
}

// ═════════════════════════════════════════════════════
// Скролл атака
// ═════════════════════════════════════════════════════
async function scrollAttack(direction) {
  toast("⏳", `Скролл ${direction} × 20`);
  for (let i = 0; i < 20; i++) {
    await apiPost("/api/exec", { cmd: "mouse_scroll", direction });
    await new Promise(r => setTimeout(r, 50));
  }
  toast("✅", "Атака завершена", 2000);
}

// ═════════════════════════════════════════════════════
// Клик спам
// ═════════════════════════════════════════════════════
async function clickSpam(button) {
  toast("⏳", `Кликспам ${button.toUpperCase()} × 50`);
  for (let i = 0; i < 50; i++) {
    await apiPost("/api/exec", { cmd: "mouse_click", button });
    await new Promise(r => setTimeout(r, 50));
  }
  toast("✅", "Спам завершён", 2000);
}

// ═════════════════════════════════════════════════════
// Хаос громкости
// ═════════════════════════════════════════════════════
async function volumeChaos() {
  toast("⏳", "Хаос громкости…");
  const levels = [0, 25, 50, 75, 100, 50, 0, 100, 25, 75, 50];
  for (const vol of levels) {
    await apiPost("/api/exec", { cmd: "volume", percent: vol });
    await new Promise(r => setTimeout(r, 300));
  }
  toast("✅", "Хаос завершён", 2000);
}

// ═════════════════════════════════════════════════════
// Мигание Mute
// ═════════════════════════════════════════════════════
async function muteChaos() {
  toast("⏳", "Мигание Mute…");
  for (let i = 0; i < 10; i++) {
    await apiPost("/api/exec", { cmd: "mute_unmute" });
    await new Promise(r => setTimeout(r, 300));
  }
  toast("✅", "Мигание завершено", 2000);
}

// ═════════════════════════════════════════════════════
// Открыть 10 окон
// ═════════════════════════════════════════════════════
async function openMultiWindows() {
  toast("⏳", "Открываем 10 окон…");
  const urls = [
    "https://google.com",
    "https://youtube.com",
    "https://github.com",
    "https://wikipedia.org",
    "https://reddit.com",
    "https://stackoverflow.com",
    "https://twitter.com",
    "https://facebook.com",
    "https://amazon.com",
    "https://netflix.com",
  ];
  for (const url of urls) {
    await apiPost("/api/exec", { cmd: "open_url", url });
    await new Promise(r => setTimeout(r, 200));
  }
  toast("✅", "10 окон открыто", 2000);
}

// ═════════════════════════════════════════════════════
// Свернуть все окна
// ═════════════════════════════════════════════════════
async function minimizeAllWindows() {
  toast("⏳", "Сворачиваем все окна…");
  await apiPost("/api/exec", { cmd: "press_key", key: "win+d" });
  toast("✅", "Окна свёрнуты", 2000);
}

// ═════════════════════════════════════════════════════
// Init
// ═════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", loadTrollState);

// ═════════════════════════════════════════════════════
// Exports
// ═════════════════════════════════════════════════════
window.trollToggle          = trollToggle;
window.openSpamMenu         = openSpamMenu;
window.startSpam            = startSpam;
window.scrollAttack         = scrollAttack;
window.clickSpam            = clickSpam;
window.volumeChaos          = volumeChaos;
window.muteChaos            = muteChaos;
window.openMultiWindows     = openMultiWindows;
window.minimizeAllWindows   = minimizeAllWindows;