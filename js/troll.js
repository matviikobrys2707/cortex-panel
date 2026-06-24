// ══════════════════════════════════════════════════════════════
// Troll — ULTIMATE EDITION
// 150+ функций с переключателями и таймерами
// ══════════════════════════════════════════════════════════════

const TROLL_KEY = "cortex_troll_ultimate_v1";

// Состояния всех переключателей
let trollState = {
  // Старые
  mouse: false,
  keyboard: false,
  crazy: false,
  
  // Новые
  invert_colors: false,
  brightness_flash: false,
  window_shake: false,
  invert_mouse_buttons: false,
  giant_cursor: false,
  random_sounds: false,
  game_keys_inverted: false,
};

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
function loadTrollState() {
  try {
    const s = JSON.parse(localStorage.getItem(TROLL_KEY) || "{}");
    trollState = { ...trollState, ...s };
  } catch {
    trollState = {
      mouse: false,
      keyboard: false,
      crazy: false,
      invert_colors: false,
      brightness_flash: false,
      window_shake: false,
      invert_mouse_buttons: false,
      giant_cursor: false,
      random_sounds: false,
      game_keys_inverted: false,
    };
  }
  renderTrollState();
}

function saveTrollState() {
  localStorage.setItem(TROLL_KEY, JSON.stringify(trollState));
}

function renderTrollState() {
  // Старые
  _updateTrollBtn("mouse", "btnMouse", "lblMouse", "badgeMouse", "Блокировка мыши", "Разблокировать мышь");
  _updateTrollBtn("keyboard", "btnKb", "lblKb", "badgeKb", "Блокировка клавиатуры", "Разблокировать клав.");
  _updateTrollBtn("crazy", "btnCrazy", "lblCrazy", "badgeCrazy", "Сумасшедшая мышь", "Остановить");
  
  // Новые
  _updateTrollBtn("invert_colors", "btnInvertColors", "lblInvertColors", "badgeInvertColors", "Инверсия цветов", "Восстановить цвета");
  _updateTrollBtn("brightness_flash", "btnBrightnessFlash", "lblBrightnessFlash", "badgeBrightnessFlash", "Мигание яркостью", "Остановить");
  _updateTrollBtn("window_shake", "btnWindowShake", "lblWindowShake", "badgeWindowShake", "Тряска окон", "Остановить");
  _updateTrollBtn("invert_mouse_buttons", "btnInvertMouseButtons", "lblInvertMouseButtons", "badgeInvertMouseButtons", "Инверсия кнопок мыши", "Восстановить");
  _updateTrollBtn("giant_cursor", "btnGiantCursor", "lblGiantCursor", "badgeGiantCursor", "Гигантский курсор", "Стандартный курсор");
  _updateTrollBtn("random_sounds", "btnRandomSounds", "lblRandomSounds", "badgeRandomSounds", "Случайные звуки", "Остановить");
  _updateTrollBtn("game_keys_inverted", "btnGameKeys", "lblGameKeys", "badgeGameKeys", "Инверсия игровых клавиш", "Восстановить");
}

function _updateTrollBtn(key, btnId, lblId, badgeId, offText, onText) {
  const active = trollState[key];
  const btn = document.getElementById(btnId);
  const lbl = document.getElementById(lblId);
  const badge = document.getElementById(badgeId);
  
  if (!btn) return;
  
  btn.classList.toggle("active", active);
  if (lbl) lbl.textContent = active ? onText : offText;
  if (badge) {
    badge.textContent = active ? "ВКЛ" : "ВЫКЛ";
    badge.className = "ttc-badge " + (active ? "on" : "off");
  }
}

// ═══════════════════════════════════════════════════════
//  СТАРЫЕ ФУНКЦИИ (СОВМЕСТИМОСТЬ)
// ═══════════════════════════════════════════════════════
async function trollToggle(key) {
  const current = trollState[key];
  const cmds = {
    mouse: { on: "disable_mouse", off: "enable_mouse" },
    keyboard: { on: "disable_keyboard", off: "enable_keyboard" },
    crazy: { on: "crazy_mouse", off: "crazy_mouse" },
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

// ═══════════════════════════════════════════════════════
//  НОВЫЕ ПЕРЕКЛЮЧАТЕЛИ
// ═══════════════════════════════════════════════════════
async function trollToggleNew(key, opName) {
  const current = trollState[key];
  
  toast("⏳", "Переключение...");
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: opName 
    });
    
    if (res?.ok) {
      trollState[key] = res.data?.active !== undefined ? res.data.active : !current;
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

// Обёртки для каждой функции
async function toggleInvertColors() {
  await trollToggleNew("invert_colors", "toggle_invert_colors");
}

async function toggleBrightnessFlash() {
  await trollToggleNew("brightness_flash", "toggle_brightness_flash");
}

async function toggleWindowShake() {
  await trollToggleNew("window_shake", "toggle_window_shake");
}

async function toggleInvertMouseButtons() {
  await trollToggleNew("invert_mouse_buttons", "toggle_invert_mouse_buttons");
}

async function toggleGiantCursor() {
  await trollToggleNew("giant_cursor", "toggle_giant_cursor");
}

async function toggleRandomSounds() {
  await trollToggleNew("random_sounds", "toggle_random_sounds");
}

async function toggleGameKeys() {
  await trollToggleNew("game_keys_inverted", "toggle_game_keys");
}

// ═══════════════════════════════════════════════════════
//  1. ПОВОРОТ ЭКРАНА
// ═══════════════════════════════════════════════════════
function openRotateScreen() {
  openFsOverlay(`
    <div class="fs-title">🔄 Поворот экрана</div>
    <div class="fs-desc">Выберите угол поворота</div>
    
    <div class="grid g2 mt12">
      <button class="btn accent" onclick="rotateScreen(0)">↑ 0°<br><small>Норма</small></button>
      <button class="btn warn" onclick="rotateScreen(90)">→ 90°</button>
      <button class="btn danger" onclick="rotateScreen(180)">↓ 180°</button>
      <button class="btn blue" onclick="rotateScreen(270)">← 270°</button>
    </div>
    
    <div class="fs-actions mt12">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
    </div>
  `);
}

async function rotateScreen(degrees) {
  closeFsOverlay();
  toast("⏳", `Поворот на ${degrees}°...`);
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "rotate_screen", 
      degrees 
    });
    
    if (res?.ok) {
      toast("✅", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  12. ЗЕРКАЛЬНОЕ ОТРАЖЕНИЕ
// ═══════════════════════════════════════════════════════
async function mirrorScreen() {
  toast("⏳", "Зеркальное отражение...");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "mirror_screen" 
    });
    
    if (res?.ok) {
      toast("✅", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  62. ОЗВУЧКА ТЕКСТА
// ═══════════════════════════════════════════════════════
function openSpeakText() {
  openFsOverlay(`
    <div class="fs-title">🔊 Озвучка текста</div>
    <div class="fs-desc">Введите текст для озвучивания роботом</div>
    
    <textarea class="ta" id="speakTextInput" rows="4" placeholder="Привет, я робот!"></textarea>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn ok" onclick="speakText()">🔊 Озвучить</button>
    </div>
  `);
}

async function speakText() {
  const text = document.getElementById("speakTextInput")?.value?.trim();
  
  if (!text) {
    toast("⚠️", "Введите текст", 2000);
    return;
  }
  
  closeFsOverlay();
  toast("⏳", "Озвучивание...");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "speak_text", 
      text 
    });
    
    if (res?.ok) {
      toast("🔊", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  80. CMD ОКНА
// ═══════════════════════════════════════════════════════
function openCmdWindows() {
  openFsOverlay(`
    <div class="fs-title">⌨️ CMD окна</div>
    <div class="fs-desc">Открыть окна командной строки в случайных местах</div>
    
    <div class="flabel">Количество окон</div>
    <input class="inp" id="cmdWindowsCount" type="number" value="5" min="1" max="50"/>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn warn" onclick="openCmdWindowsRun()">⌨️ Открыть</button>
    </div>
  `);
}

async function openCmdWindowsRun() {
  const count = Number(document.getElementById("cmdWindowsCount")?.value || 5);
  
  closeFsOverlay();
  toast("⏳", `Открываем ${count} окон...`);
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "open_cmd_windows", 
      count 
    });
    
    if (res?.ok) {
      toast("✅", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  96. ОТКРЫТИЕ ВКЛАДОК
// ═══════════════════════════════════════════════════════
function openTabsMenu() {
  openFsOverlay(`
    <div class="fs-title">🌐 Открытие вкладок</div>
    <div class="fs-desc">Открыть N вкладок с указанным URL</div>
    
    <div class="flabel">URL сайта</div>
    <input class="inp" id="tabsUrl" value="https://google.com" placeholder="https://example.com"/>
    
    <div class="flabel mt12">Количество вкладок</div>
    <input class="inp" id="tabsCount" type="number" value="10" min="1" max="100"/>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn blue" onclick="openTabsRun()">🌐 Открыть</button>
    </div>
  `);
}

async function openTabsRun() {
  const url = document.getElementById("tabsUrl")?.value?.trim();
  const count = Number(document.getElementById("tabsCount")?.value || 10);
  
  if (!url) {
    toast("⚠️", "Введите URL", 2000);
    return;
  }
  
  closeFsOverlay();
  toast("⏳", `Открываем ${count} вкладок...`);
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "open_tabs", 
      url, 
      count 
    });
    
    if (res?.ok) {
      toast("✅", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  121. KILL EXPLORER.EXE
// ═══════════════════════════════════════════════════════
async function killExplorer() {
  openFsOverlay(`
    <div class="fs-title">💀 Убить explorer.exe</div>
    <div class="fs-desc">Рабочий стол и панель задач исчезнут на 5 секунд, затем восстановятся автоматически</div>
    
    <div class="troll-warning" style="margin-top:16px">
      ⚠️ Безопасно - восстановится автоматически
    </div>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="killExplorerRun()">💀 Убить</button>
    </div>
  `);
}

async function killExplorerRun() {
  closeFsOverlay();
  toast("⏳", "Убиваем explorer.exe...");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "kill_explorer" 
    });
    
    if (res?.ok) {
      toast("💀", res.message, 5000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  127. CPU LOAD
// ═══════════════════════════════════════════════════════
function openCpuLoad() {
  openFsOverlay(`
    <div class="fs-title">🔥 Загрузка CPU</div>
    <div class="fs-desc">Загрузить процессор на 100% на указанное время</div>
    
    <div class="flabel">Длительность (секунды)</div>
    <input class="inp" id="cpuLoadSeconds" type="number" value="10" min="1" max="300"/>
    
    <div class="troll-warning" style="margin-top:16px">
      ⚠️ ПК может сильно нагреться и зависнуть
    </div>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="cpuLoadRun()">🔥 Запустить</button>
    </div>
  `);
}

async function cpuLoadRun() {
  const seconds = Number(document.getElementById("cpuLoadSeconds")?.value || 10);
  
  closeFsOverlay();
  toast("⏳", `Загружаем CPU на ${seconds} сек...`);
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "cpu_load", 
      seconds 
    });
    
    if (res?.ok) {
      toast("🔥", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  138. МАТРИЦА РЕЖИМ
// ═══════════════════════════════════════════════════════
async function matrixMode() {
  toast("⏳", "Запуск Matrix mode...");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "matrix_mode" 
    });
    
    if (res?.ok) {
      toast("🟢", res.message, 5000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  142. СКРИНШОТ КАК ОБОИ
// ═══════════════════════════════════════════════════════
async function screenshotWallpaper() {
  toast("⏳", "Создание фейкового рабочего стола...");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "troll", 
      op: "screenshot_wallpaper" 
    });
    
    if (res?.ok) {
      toast("✅", res.message, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  СТАРЫЕ ФУНКЦИИ (СОВМЕСТИМОСТЬ)
// ═══════════════════════════════════════════════════════
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
  const key = document.getElementById("spamKey")?.value?.trim() || "space";
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

async function scrollAttack(direction) {
  toast("⏳", `Скролл ${direction} × 20`);
  
  for (let i = 0; i < 20; i++) {
    await apiPost("/api/exec", { cmd: "mouse_scroll", direction });
    await new Promise(r => setTimeout(r, 50));
  }
  
  toast("✅", "Атака завершена", 2000);
}

async function clickSpam(button) {
  toast("⏳", `Кликспам × 50`);
  
  for (let i = 0; i < 50; i++) {
    await apiPost("/api/exec", { cmd: "mouse_click", button });
    await new Promise(r => setTimeout(r, 50));
  }
  
  toast("✅", "Спам завершён", 2000);
}

async function volumeChaos() {
  toast("⏳", "Хаос громкости…");
  const levels = [0,100,25,75,50,0,100,30,80,50];
  
  for (const vol of levels) {
    await apiPost("/api/exec", { cmd: "volume", percent: vol });
    await new Promise(r => setTimeout(r, 350));
  }
  
  toast("✅", "Хаос завершён", 2000);
}

async function muteChaos() {
  toast("⏳", "Мигание Mute…");
  
  for (let i = 0; i < 10; i++) {
    await apiPost("/api/exec", { cmd: "mute_unmute" });
    await new Promise(r => setTimeout(r, 300));
  }
  
  toast("✅", "Завершено", 2000);
}

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

async function minimizeAllWindows() {
  toast("⏳", "Сворачиваем…");
  await apiPost("/api/exec", { cmd: "press_key", key: "win+d" });
  toast("✅", "Окна свёрнуты", 2000);
}

function fakeBsod(style) {
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
  const sec = Math.min(120, Math.max(3, Number(document.getElementById("bsodSec")?.value || 15)));
  const lang = document.getElementById("bsodLang")?.value || "ru";
  
  closeFsOverlay();
  toast("⏳", "Запуск Fake BSOD…");
  
  try {
    const res = await apiPost("/api/exec", { 
      cmd: "fake_bsod", 
      op: "start", 
      style, 
      lang, 
      seconds: sec 
    });
    
    if (res?.ok) {
      toast("💙", `Fake BSOD запущен на ${sec}с`, 3000);
    } else {
      toast("❌", res?.message || "Ошибка", 3000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ═══════════════════════════════════════════════════════
//  INIT
// ═══════════════════════════════════════════════════════
document.addEventListener("DOMContentLoaded", loadTrollState);

// ═══════════════════════════════════════════════════════
//  EXPORTS
// ═══════════════════════════════════════════════════════
window.trollToggle = trollToggle;
window.trollToggleNew = trollToggleNew;
window.toggleInvertColors = toggleInvertColors;
window.toggleBrightnessFlash = toggleBrightnessFlash;
window.toggleWindowShake = toggleWindowShake;
window.toggleInvertMouseButtons = toggleInvertMouseButtons;
window.toggleGiantCursor = toggleGiantCursor;
window.toggleRandomSounds = toggleRandomSounds;
window.toggleGameKeys = toggleGameKeys;
window.openRotateScreen = openRotateScreen;
window.rotateScreen = rotateScreen;
window.mirrorScreen = mirrorScreen;
window.openSpeakText = openSpeakText;
window.speakText = speakText;
window.openCmdWindows = openCmdWindows;
window.openCmdWindowsRun = openCmdWindowsRun;
window.openTabsMenu = openTabsMenu;
window.openTabsRun = openTabsRun;
window.killExplorer = killExplorer;
window.killExplorerRun = killExplorerRun;
window.openCpuLoad = openCpuLoad;
window.cpuLoadRun = cpuLoadRun;
window.matrixMode = matrixMode;
window.screenshotWallpaper = screenshotWallpaper;
window.openSpamMenu = openSpamMenu;
window.startSpam = startSpam;
window.scrollAttack = scrollAttack;
window.clickSpam = clickSpam;
window.volumeChaos = volumeChaos;
window.muteChaos = muteChaos;
window.openMultiWindows = openMultiWindows;
window.minimizeAllWindows = minimizeAllWindows;
window.fakeBsod = fakeBsod;
window.startFakeBsod = startFakeBsod;
