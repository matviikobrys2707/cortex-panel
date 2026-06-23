// ══════════════════════════════════════════════════════════════
//  Troll — расширенный + Fake BSOD
// ══════════════════════════════════════════════════════════════

const TROLL_KEY = "cortex_troll_v3";
let trollState = { mouse: false, keyboard: false, crazy: false };

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
  _updateTrollBtn("mouse",    "btnMouse", "lblMouse", "badgeMouse", "Блокировка мыши",       "Разблокировать мышь");
  _updateTrollBtn("keyboard", "btnKb",    "lblKb",    "badgeKb",    "Блокировка клавиатуры", "Разблокировать клав.");
  _updateTrollBtn("crazy",    "btnCrazy", "lblCrazy", "badgeCrazy", "Сумасшедшая мышь",      "Остановить");
}

function _updateTrollBtn(key, btnId, lblId, badgeId, offText, onText) {
  const active = trollState[key];
  const btn    = document.getElementById(btnId);
  const lbl    = document.getElementById(lblId);
  const badge  = document.getElementById(badgeId);
  if (!btn) return;
  btn.classList.toggle("active", active);
  if (lbl) lbl.textContent = active ? onText : offText;
  if (badge) {
    badge.textContent = active ? "ВКЛ" : "ВЫКЛ";
    badge.className = "ttc-badge " + (active ? "on" : "off");
  }
}

async function trollToggle(key) {
  const current = trollState[key];
  const cmds = {
    mouse:    { on: "disable_mouse",    off: "enable_mouse" },
    keyboard: { on: "disable_keyboard", off: "enable_keyboard" },
    crazy:    { on: "crazy_mouse",      off: "crazy_mouse" },
  };
  const cmd = current ? cmds[key].off : cmds[key].on;

  toast("⏳", cmd);
  try {
    const res = await apiPost("/api/exec", { cmd });
    if (res?.ok) {
      trollState[key] = !current;
      saveTrollState();
      renderTrollState();
      toast("✅", res.message, 2000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ── Спам клавишами ──
function openSpamMenu() {
  openFsOverlay(`
    <div class="fs-title">📢 Спам клавишами</div>
    <div class="fs-desc">Клавиша будет нажата многократно</div>
    <div class="flabel">Клавиша</div>
    <input class="inp" id="spamKey" value="space" placeholder="enter, space, a…"/>
    <div class="flabel mt12">Количество нажатий</div>
    <input class="inp" id="spamCount" type="number" value="50" min="1" max="500"/>
    <div class="flabel mt12">Задержка (мс)</div>
    <input class="inp" id="spamDelay" type="number" value="30" min="10" max="500"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn warn" onclick="startSpam()">📢 Запустить</button>
    </div>
  `);
}

async function startSpam() {
  const key   = document.getElementById("spamKey")?.value?.trim() || "space";
  const count = Math.min(500, Math.max(1, Number(document.getElementById("spamCount")?.value || 50)));
  const delay = Math.min(500, Math.max(10, Number(document.getElementById("spamDelay")?.value || 30)));
  closeFsOverlay();
  toast("⏳", `Спам: ${key} × ${count}`);
  for (let i = 0; i < count; i++) {
    await apiPost("/api/exec", { cmd: "press_key", key });
    await new Promise(r => setTimeout(r, delay));
  }
  toast("✅", "Спам завершён", 2000);
}

// ── Скролл атака ──
async function scrollAttack(direction) {
  toast("⏳", `Скролл ${direction} × 20`);
  for (let i = 0; i < 20; i++) {
    await apiPost("/api/exec", { cmd: "mouse_scroll", direction });
    await new Promise(r => setTimeout(r, 50));
  }
  toast("✅", "Атака завершена", 2000);
}

// ── Кликомания ──
async function clickSpam(button) {
  toast("⏳", `Кликспам × 50`);
  for (let i = 0; i < 50; i++) {
    await apiPost("/api/exec", { cmd: "mouse_click", button });
    await new Promise(r => setTimeout(r, 50));
  }
  toast("✅", "Спам завершён", 2000);
}

// ── Хаос громкости ──
async function volumeChaos() {
  toast("⏳", "Хаос громкости…");
  const levels = [0,100,25,75,50,0,100,30,80,50];
  for (const vol of levels) {
    await apiPost("/api/exec", { cmd: "volume", percent: vol });
    await new Promise(r => setTimeout(r, 350));
  }
  toast("✅", "Хаос завершён", 2000);
}

// ── Мигание Mute ──
async function muteChaos() {
  toast("⏳", "Мигание Mute…");
  for (let i = 0; i < 10; i++) {
    await apiPost("/api/exec", { cmd: "mute_unmute" });
    await new Promise(r => setTimeout(r, 300));
  }
  toast("✅", "Завершено", 2000);
}

// ── Открыть 10 окон ──
async function openMultiWindows() {
  toast("⏳", "Открываем 10 окон…");
  const urls = [
    "https://google.com","https://youtube.com","https://github.com",
    "https://wikipedia.org","https://reddit.com","https://stackoverflow.com",
    "https://twitter.com","https://facebook.com","https://amazon.com","https://netflix.com",
  ];
  for (const url of urls) {
    await apiPost("/api/exec", { cmd: "open_url", url });
    await new Promise(r => setTimeout(r, 250));
  }
  toast("✅", "10 окон открыто", 2000);
}

// ── Свернуть все ──
async function minimizeAllWindows() {
  toast("⏳", "Сворачиваем…");
  await apiPost("/api/exec", { cmd: "press_key", key: "win+d" });
  toast("✅", "Окна свёрнуты", 2000);
}

// ── Fake BSOD ──
async function fakeBsod(style) {
  openFsOverlay(`
    <div class="fs-title">💙 Fake BSOD (${style})</div>
    <div class="fs-desc">Безопасный — только визуальный эффект</div>
    <div class="flabel">Длительность (секунды)</div>
    <input class="inp" id="bsodSec" type="number" value="15" min="3" max="120"/>
    <div class="flabel mt12">Язык</div>
    <select class="sel" id="bsodLang">
      <option value="ru">🇷🇺 Русский</option>
      <option value="en">🇺🇸 English</option>
    </select>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn warn" onclick="startFakeBsod('${style}')">💙 Запустить</button>
    </div>
  `);
}

async function startFakeBsod(style) {
  const sec  = Math.min(120, Math.max(3, Number(document.getElementById("bsodSec")?.value || 15)));
  const lang = document.getElementById("bsodLang")?.value || "ru";
  closeFsOverlay();
  toast("⏳", "Запуск Fake BSOD…");
  try {
    const res = await apiPost("/api/exec", { cmd: "fake_bsod", op: "start", style, lang, seconds: sec });
    if (res?.ok) toast("💙", `Fake BSOD запущен на ${sec}с`, 3000);
    else toast("❌", res?.message || "Ошибка", 3000);
  } catch (e) { toast("❌", e.message, 3000); }
}

// ── Init ──
document.addEventListener("DOMContentLoaded", loadTrollState);

// ── Exports ──
window.trollToggle        = trollToggle;
window.openSpamMenu       = openSpamMenu;
window.startSpam          = startSpam;
window.scrollAttack       = scrollAttack;
window.clickSpam          = clickSpam;
window.volumeChaos        = volumeChaos;
window.muteChaos          = muteChaos;
window.openMultiWindows   = openMultiWindows;
window.minimizeAllWindows = minimizeAllWindows;
window.fakeBsod           = fakeBsod;
window.startFakeBsod      = startFakeBsod;