// ══════════════════════════════════════════════════════════════
//  Troll — управление троллинг-функциями с сохранением состояния
// ══════════════════════════════════════════════════════════════

const TROLL_KEY = "cortex_troll_v1";

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
  _updateTrollBtn(
    "mouse", "btnMouse", "lblMouse", "badgeMouse",
    "🖱 Откл. мышь", "🖱 Вкл. мышь"
  );
  _updateTrollBtn(
    "keyboard", "btnKb", "lblKb", "badgeKb",
    "⌨️ Откл. клав.", "⌨️ Вкл. клав."
  );
  _updateTrollBtn(
    "crazy", "btnCrazy", "lblCrazy", "badgeCrazy",
    "🎲 Сумасшедшая мышь", "🎲 Остановить"
  );
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
      badge.className = "troll-badge on";
    }
  } else {
    btn.classList.remove("active");
    if (lbl) lbl.textContent = offText;
    if (badge) {
      badge.textContent = "ВЫКЛ";
      badge.className = "troll-badge off";
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

function openSpamMenu() {
  openFsOverlay(`
    <div class="fs-title">📢 Спам клавишами</div>
    <div class="fs-desc">Клавиша будет нажата много раз</div>
    <div class="flabel">Клавиша</div>
    <input class="inp" id="spamKey" value="space" placeholder="enter, space, a…"/>
    <div class="flabel mt12">Количество нажатий</div>
    <input class="inp" id="spamCount" type="number" value="20" min="1" max="200"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn warn" onclick="startSpam()">📢 Запустить</button>
    </div>
  `);
}

async function startSpam() {
  const key   = document.getElementById("spamKey")?.value?.trim() || "space";
  const count = Math.min(200, Math.max(1, Number(document.getElementById("spamCount")?.value || 10)));
  closeFsOverlay();
  toast("⏳", `Спам: ${key} × ${count}`);

  for (let i = 0; i < count; i++) {
    await execCmd("press_key", { key });
    await new Promise(r => setTimeout(r, 50));
  }
  toast("✅", "Спам завершён", 2000);
}

// Загружаем при старте
document.addEventListener("DOMContentLoaded", loadTrollState);

window.trollToggle = trollToggle;
window.openSpamMenu = openSpamMenu;
window.startSpam = startSpam;