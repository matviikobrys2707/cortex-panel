// ══════════════════════════════════════════════════════════════
//  Keyboard — новая логика: клик = нажатие, зажатие = в комбо
// ══════════════════════════════════════════════════════════════

let kbHeldKeys = new Set();     // Зажатые клавиши для комбинации
let kbOrientation = "landscape"; // landscape | portrait
let kbLongPressTimer = null;
let kbLongPressKey = null;

const LONG_PRESS_DELAY = 500; // ms для определения зажатия

// ═════════════════════════════════════════════════════
// Полная клавиатура - Layout
// ═════════════════════════════════════════════════════
const FULL_KB_LAYOUT = [
  // Row 1: Esc, F1-F12, PrtSc, Pause
  [
    {k:"escape",l:"Esc",w:1.3,c:"accent"},
    {k:"f1",l:"F1"},{k:"f2",l:"F2"},{k:"f3",l:"F3"},{k:"f4",l:"F4"},
    {k:"f5",l:"F5"},{k:"f6",l:"F6"},{k:"f7",l:"F7"},{k:"f8",l:"F8"},
    {k:"f9",l:"F9"},{k:"f10",l:"F10"},{k:"f11",l:"F11"},{k:"f12",l:"F12"},
    {k:"printscreen",l:"PrtSc",c:"blue"},{k:"pause",l:"Pause",c:"blue"},
  ],
  // Row 2: `1234567890-= Backspace | Ins Home PgUp
  [
    {k:"grave",l:"`"},{k:"1",l:"1"},{k:"2",l:"2"},{k:"3",l:"3"},{k:"4",l:"4"},
    {k:"5",l:"5"},{k:"6",l:"6"},{k:"7",l:"7"},{k:"8",l:"8"},{k:"9",l:"9"},
    {k:"0",l:"0"},{k:"minus",l:"-"},{k:"equals",l:"="},
    {k:"backspace",l:"⌫",w:1.5,c:"accent"},
    {k:"insert",l:"Ins",c:"blue"},{k:"home",l:"Home",c:"blue"},{k:"pageup",l:"PgUp",c:"blue"},
  ],
  // Row 3: Tab QWERTYUIOP[]\ | Del End PgDn
  [
    {k:"tab",l:"Tab",w:1.3,c:"accent"},
    {k:"q",l:"Q"},{k:"w",l:"W"},{k:"e",l:"E"},{k:"r",l:"R"},
    {k:"t",l:"T"},{k:"y",l:"Y"},{k:"u",l:"U"},{k:"i",l:"I"},
    {k:"o",l:"O"},{k:"p",l:"P"},
    {k:"bracketleft",l:"["},{k:"bracketright",l:"]"},{k:"backslash",l:"\\",w:1.3},
    {k:"delete",l:"Del",c:"blue"},{k:"end",l:"End",c:"blue"},{k:"pagedown",l:"PgDn",c:"blue"},
  ],
  // Row 4: CapsLock ASDFGHJKL;' Enter
  [
    {k:"capslock",l:"Caps",w:1.5,c:"accent"},
    {k:"a",l:"A"},{k:"s",l:"S"},{k:"d",l:"D"},{k:"f",l:"F"},
    {k:"g",l:"G"},{k:"h",l:"H"},{k:"j",l:"J"},{k:"k",l:"K"},
    {k:"l",l:"L"},{k:"semicolon",l:";"},{k:"apostrophe",l:"'"},
    {k:"enter",l:"Enter",w:2,c:"ok"},
  ],
  // Row 5: Shift ZXCVBNM,./ Shift | ↑
  [
    {k:"shift",l:"Shift",w:2,c:"mod"},
    {k:"z",l:"Z"},{k:"x",l:"X"},{k:"c",l:"C"},{k:"v",l:"V"},
    {k:"b",l:"B"},{k:"n",l:"N"},{k:"m",l:"M"},
    {k:"comma",l:","},{k:"period",l:"."},{k:"slash",l:"/"},
    {k:"shift",l:"Shift",w:2,c:"mod"},
    {k:"up",l:"▲",c:"blue"},
  ],
  // Row 6: Ctrl Win Alt Space Alt Win Menu Ctrl | ← ↓ →
  [
    {k:"ctrl",l:"Ctrl",w:1.2,c:"mod"},
    {k:"win",l:"Win",w:1.2,c:"mod"},
    {k:"alt",l:"Alt",w:1.2,c:"mod"},
    {k:"space",l:"Space",w:5,c:"space"},
    {k:"alt",l:"Alt",w:1.2,c:"mod"},
    {k:"win",l:"Win",w:1.2,c:"mod"},
    {k:"ctrl",l:"Ctrl",w:1.2,c:"mod"},
    {k:"left",l:"◄",c:"blue"},
    {k:"down",l:"▼",c:"blue"},
    {k:"right",l:"►",c:"blue"},
  ],
];

const MOD_KEYS = new Set(["ctrl","shift","alt","win","capslock"]);

// ═════════════════════════════════════════════════════
// Открыть клавиатуру
// ═════════════════════════════════════════════════════
function openFullKeyboard() {
  const overlay = document.getElementById("fullKbOverlay");
  if (!overlay) return;

  kbHeldKeys.clear();
  kbOrientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";

  _renderFullKb();
  overlay.classList.add("open");
  overlay.classList.remove("landscape","portrait");
  overlay.classList.add(kbOrientation);
  document.body.style.overflow = "hidden";

  _updateKbCombo();
}

function closeFullKeyboard() {
  const overlay = document.getElementById("fullKbOverlay");
  if (overlay) {
    overlay.classList.remove("open","landscape","portrait");
  }
  document.body.style.overflow = "";
  kbHeldKeys.clear();
}

// ═════════════════════════════════════════════════════
// Переключение ориентации
// ═════════════════════════════════════════════════════
function kbToggleOrientation() {
  kbOrientation = kbOrientation === "landscape" ? "portrait" : "landscape";
  const overlay = document.getElementById("fullKbOverlay");
  if (overlay) {
    overlay.classList.remove("landscape","portrait");
    overlay.classList.add(kbOrientation);
  }
  const btn = document.getElementById("kbOrientBtn");
  if (btn) {
    btn.textContent = kbOrientation === "landscape" ? "↻ Portrait" : "↻ Landscape";
  }
  toast("🔄", `Ориентация: ${kbOrientation}`, 1500);
}

// ═════════════════════════════════════════════════════
// Рендер клавиатуры
// ═════════════════════════════════════════════════════
function _renderFullKb() {
  const body = document.getElementById("fullKbBody");
  if (!body) return;

  body.innerHTML = FULL_KB_LAYOUT.map((row) =>
    `<div class="fkb-row">` +
    row.map(k => {
      const isMod = MOD_KEYS.has(k.k);
      const cls = [
        "fkb-key",
        k.c ? `fkb-${k.c}` : "",
        isMod ? "fkb-modifier" : "",
      ].filter(Boolean).join(" ");
      const style = k.w ? `style="flex:${k.w}"` : "";
      return `<div class="${cls}" data-key="${k.k}" ${style}>${k.l}</div>`;
    }).join("") +
    `</div>`
  ).join("");

  // Вешаем события
  body.querySelectorAll(".fkb-key").forEach(el => {
    const key = el.dataset.key;
    const isMod = MOD_KEYS.has(key);

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      el.setPointerCapture(e.pointerId);

      // Запускаем таймер на зажатие
      kbLongPressKey = key;
      kbLongPressTimer = setTimeout(() => {
        // Зажатие — добавляем в комбо
        _addToCombo(key);
        el.classList.add("fkb-held");
        kbLongPressTimer = null;
      }, LONG_PRESS_DELAY);
    });

    el.addEventListener("pointerup", (e) => {
      e.preventDefault();

      if (kbLongPressTimer) {
        // Не было зажатия — просто нажатие
        clearTimeout(kbLongPressTimer);
        kbLongPressTimer = null;

        if (kbHeldKeys.size > 0) {
          // Есть зажатые клавиши — добавляем в комбо
          _addToCombo(key);
          el.classList.add("fkb-held");
        } else {
          // Простое нажатие
          _pressKey(key);
          el.classList.add("fkb-pressed");
          setTimeout(() => el.classList.remove("fkb-pressed"), 150);
        }
      }
    });

    el.addEventListener("pointerleave", () => {
      if (kbLongPressTimer) {
        clearTimeout(kbLongPressTimer);
        kbLongPressTimer = null;
      }
    });
  });
}

// ═════════════════════════════════════════════════════
// Добавить клавишу в комбо
// ═════════════════════════════════════════════════════
function _addToCombo(key) {
  if (kbHeldKeys.has(key)) {
    // Повторное нажатие — убираем из комбо
    kbHeldKeys.delete(key);
    const el = document.querySelector(`.fkb-key[data-key="${key}"]`);
    if (el) el.classList.remove("fkb-held");
  } else {
    // Добавляем
    kbHeldKeys.add(key);
  }
  _updateKbCombo();
}

// ═════════════════════════════════════════════════════
// Обновить дисплей комбо
// ═════════════════════════════════════════════════════
function _updateKbCombo() {
  const display = document.getElementById("fullKbCombo");
  if (!display) return;

  if (kbHeldKeys.size > 0) {
    const combo = [...kbHeldKeys].join(" + ");
    display.textContent = combo;
    display.style.color = "#A78BFA";
  } else {
    display.textContent = "Нажмите клавишу";
    display.style.color = "var(--muted)";
  }
}

// ═════════════════════════════════════════════════════
// Выполнить комбо
// ═════════════════════════════════════════════════════
function fullKbExecute() {
  if (kbHeldKeys.size === 0) return;
  const combo = [...kbHeldKeys].join("+");
  _pressKey(combo);
  fullKbClear();
}

// ═════════════════════════════════════════════════════
// Очистить комбо
// ═════════════════════════════════════════════════════
function fullKbClear() {
  kbHeldKeys.clear();
  document.querySelectorAll(".fkb-held").forEach(e => e.classList.remove("fkb-held"));
  _updateKbCombo();
}

// ═════════════════════════════════════════════════════
// Нажать клавишу
// ═════════════════════════════════════════════════════
async function _pressKey(key) {
  await apiPost("/api/exec", { cmd: "press_key", key });
}

async function pressCustomKey() {
  const k = (document.getElementById("customKey")?.value || "").trim();
  if (!k) { toast("❌", "Введите комбинацию", 2000); return; }
  await _pressKey(k);
  document.getElementById("customKey").value = "";
}

async function typeText() {
  const t = (document.getElementById("typeText")?.value || "").trim();
  if (!t) { toast("❌", "Введите текст", 2000); return; }
  await apiPost("/api/exec", { cmd: "type_text", text: t });
  document.getElementById("typeText").value = "";
}

async function openUrl() {
  const url = (document.getElementById("urlInput")?.value || "").trim();
  if (!url) { toast("❌", "Введите URL", 2000); return; }
  await apiPost("/api/exec", { cmd: "open_url", url });
  document.getElementById("urlInput").value = "";
}

// ═════════════════════════════════════════════════════
// Список окон с автообновлением
// ═════════════════════════════════════════════════════
let _winRefreshTimer = null;

async function refreshWindows() {
  const listEl = document.getElementById("windowsList");
  if (!listEl) return;

  try {
    const res = await apiPost("/api/exec", { cmd: "get_windows" });
    const wins = res?.data?.windows || [];

    if (!wins.length) {
      listEl.innerHTML = `<div class="empty"><div class="empty-ico">🪟</div>Нет окон</div>`;
      return;
    }

    listEl.innerHTML = "";
    wins.forEach(w => {
      const div = document.createElement("div");
      div.className = "win-item";
      div.innerHTML = `
        <div class="win-ico">${w.icon || "🪟"}</div>
        <div class="win-body">
          <div class="win-title">${esc(w.title)}</div>
          <div class="win-meta">${esc(w.name)} · PID ${w.pid}</div>
        </div>
        <button class="win-close" onclick="event.stopPropagation();closeWindow(${w.hwnd})">✕</button>
      `;
      div.onclick = () => focusWindow(w.hwnd);
      listEl.appendChild(div);
    });
  } catch (e) {
    listEl.innerHTML = `<div class="empty"><div class="empty-ico">❌</div>${esc(e.message)}</div>`;
  }
}

async function focusWindow(hwnd) {
  await apiPost("/api/exec", { cmd: "focus_window", hwnd });
}

async function closeWindow(hwnd) {
  await apiPost("/api/exec", { cmd: "close_window", hwnd });
  setTimeout(refreshWindows, 600);
}

function startWinAutoRefresh() {
  refreshWindows();
  _winRefreshTimer = setInterval(refreshWindows, 10000);
}

function stopWinAutoRefresh() {
  clearInterval(_winRefreshTimer);
}

// ═════════════════════════════════════════════════════
// Exports
// ═════════════════════════════════════════════════════
window.openFullKeyboard      = openFullKeyboard;
window.closeFullKeyboard     = closeFullKeyboard;
window.kbToggleOrientation   = kbToggleOrientation;
window.fullKbExecute         = fullKbExecute;
window.fullKbClear           = fullKbClear;
window.pressCustomKey        = pressCustomKey;
window.typeText              = typeText;
window.openUrl               = openUrl;
window.refreshWindows        = refreshWindows;
window.focusWindow           = focusWindow;
window.closeWindow           = closeWindow;
window.startWinAutoRefresh   = startWinAutoRefresh;
window.stopWinAutoRefresh    = stopWinAutoRefresh;