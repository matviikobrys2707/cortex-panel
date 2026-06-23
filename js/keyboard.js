// ══════════════════════════════════════════════════════════════
//  Keyboard — упрощённая + полная клавиатура в landscape
// ══════════════════════════════════════════════════════════════

let activeMods = new Set();
let holdTimer = null;
let holdInterval = null;

// ── Упрощённая клавиатура (в карточке) ──
function renderKeyboard() {
  const container = document.getElementById("kbGrid");
  if (!container) return;

  // Только самое важное
  const rows = [
    [
      { k:"escape", l:"Esc", c:"accent" },
      { k:"tab",    l:"Tab", c:"accent" },
      { k:"enter",  l:"↵",   c:"ok"     },
      { k:"backspace", l:"⌫", c:"blue"  },
      { k:"delete", l:"Del", c:"blue"   },
    ],
    [
      { k:"up",       l:"⬆", c:"blue"  },
      { k:"down",     l:"⬇", c:"blue"  },
      { k:"left",     l:"⬅", c:"blue"  },
      { k:"right",    l:"➡", c:"blue"  },
      { k:"space",    l:"Sp", c:"accent"},
    ],
    [
      { k:"home",     l:"Home",  c:"blue" },
      { k:"end",      l:"End",   c:"blue" },
      { k:"pageup",   l:"PgUp",  c:"blue" },
      { k:"pagedown", l:"PgDn",  c:"blue" },
      { k:"printscreen", l:"PrtSc", c:"accent"},
    ],
  ];

  container.innerHTML = rows.map(row =>
    `<div class="kb-row">` +
    row.map(k =>
      `<div class="kb-key ${k.c || ''}" data-key="${k.k}">${k.l}</div>`
    ).join("") +
    `</div>`
  ).join("");

  _attachKeyEvents(container);
}

function _attachKeyEvents(container) {
  container.querySelectorAll(".kb-key[data-key]").forEach(el => {
    const key = el.dataset.key;

    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      holdTimer = setTimeout(() => {
        el.classList.add("kb-held");
        holdInterval = setInterval(() => pressKeyWithMods(key), 80);
      }, 450);
    });

    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (holdInterval) {
        clearInterval(holdInterval); holdInterval = null;
        el.classList.remove("kb-held");
      } else if (holdTimer) {
        clearTimeout(holdTimer);
        pressKeyWithMods(key);
      }
      holdTimer = null;
    });

    el.addEventListener("pointerleave", () => {
      clearTimeout(holdTimer); holdTimer = null;
      clearInterval(holdInterval); holdInterval = null;
      el.classList.remove("kb-held");
    });
  });
}

function pressKeyWithMods(key) {
  if (activeMods.size > 0) {
    execCmd("press_key", { key: [...activeMods, key].join("+") });
    // Сбрасываем моды после применения
    clearMods();
  } else {
    execCmd("press_key", { key });
  }
}

// ── Модификаторы ──
function toggleMod(mod) {
  if (activeMods.has(mod)) activeMods.delete(mod);
  else activeMods.add(mod);
  _updateModDisplay();
}

function _updateModDisplay() {
  ["ctrl","alt","shift","win"].forEach(m => {
    document.getElementById(`mod-${m}`)?.classList.toggle("active", activeMods.has(m));
  });
  const statusEl = document.getElementById("modStatus");
  const textEl   = document.getElementById("modStatusText");
  if (activeMods.size > 0) {
    if (statusEl) statusEl.style.display = "flex";
    if (textEl) textEl.textContent = [...activeMods].join(" + ") + " зажат(ы)";
  } else {
    if (statusEl) statusEl.style.display = "none";
  }
}

function execModCombo() {
  if (!activeMods.size) return;
  execCmd("press_key", { key: [...activeMods].join("+") });
  clearMods();
}

function clearMods() {
  activeMods.clear();
  _updateModDisplay();
}

// ══════════════════════════════════════════════════════════════
//  ПОЛНАЯ КЛАВИАТУРА (landscape overlay)
// ══════════════════════════════════════════════════════════════

let fullKbHeld = new Set();  // Зажатые клавиши
let fullKbCombo = [];        // Комбинация

const FULL_KB_LAYOUT = [
  // Ряд 1: Escape, F1-F12, Delete
  [
    {k:"escape",l:"Esc",w:1.5,c:"accent"},
    {k:"f1",l:"F1"},{k:"f2",l:"F2"},{k:"f3",l:"F3"},{k:"f4",l:"F4"},
    {k:"f5",l:"F5"},{k:"f6",l:"F6"},{k:"f7",l:"F7"},{k:"f8",l:"F8"},
    {k:"f9",l:"F9"},{k:"f10",l:"F10"},{k:"f11",l:"F11"},{k:"f12",l:"F12"},
    {k:"printscreen",l:"PrtSc",c:"blue"},{k:"pause",l:"Pause",c:"blue"},
  ],
  // Ряд 2: `1234567890-= Backspace
  [
    {k:"grave",l:"`"},{k:"1",l:"1"},{k:"2",l:"2"},{k:"3",l:"3"},{k:"4",l:"4"},
    {k:"5",l:"5"},{k:"6",l:"6"},{k:"7",l:"7"},{k:"8",l:"8"},{k:"9",l:"9"},
    {k:"0",l:"0"},{k:"minus",l:"-"},{k:"equals",l:"="},
    {k:"backspace",l:"⌫ Back",w:2,c:"accent"},
    {k:"insert",l:"Ins",c:"blue"},{k:"home",l:"Home",c:"blue"},{k:"pageup",l:"PgUp",c:"blue"},
  ],
  // Ряд 3: Tab QWERTYUIOP[]\ Del End PgDn
  [
    {k:"tab",l:"Tab",w:1.5,c:"accent"},
    {k:"q",l:"Q"},{k:"w",l:"W"},{k:"e",l:"E"},{k:"r",l:"R"},
    {k:"t",l:"T"},{k:"y",l:"Y"},{k:"u",l:"U"},{k:"i",l:"I"},
    {k:"o",l:"O"},{k:"p",l:"P"},
    {k:"bracketleft",l:"["},{k:"bracketright",l:"]"},{k:"backslash",l:"\\",w:1.5},
    {k:"delete",l:"Del",c:"blue"},{k:"end",l:"End",c:"blue"},{k:"pagedown",l:"PgDn",c:"blue"},
  ],
  // Ряд 4: CapsLock ASDFGHJKL;' Enter
  [
    {k:"capslock",l:"Caps",w:1.8,c:"accent"},
    {k:"a",l:"A"},{k:"s",l:"S"},{k:"d",l:"D"},{k:"f",l:"F"},
    {k:"g",l:"G"},{k:"h",l:"H"},{k:"j",l:"J"},{k:"k",l:"K"},
    {k:"l",l:"L"},{k:"semicolon",l:";"},{k:"apostrophe",l:"'"},
    {k:"enter",l:"Enter",w:2.3,c:"ok"},
  ],
  // Ряд 5: Shift ZXCVBNM,./ Shift Up
  [
    {k:"shift",l:"⇧ Shift",w:2.5,c:"mod"},
    {k:"z",l:"Z"},{k:"x",l:"X"},{k:"c",l:"C"},{k:"v",l:"V"},
    {k:"b",l:"B"},{k:"n",l:"N"},{k:"m",l:"M"},
    {k:"comma",l:","},{k:"period",l:"."},{k:"slash",l:"/"},
    {k:"shift",l:"⇧ Shift",w:2.5,c:"mod"},
    {k:"up",l:"⬆",c:"blue"},
  ],
  // Ряд 6: Ctrl Win Alt Space Alt Win Ctrl ← ↓ →
  [
    {k:"ctrl",l:"Ctrl",w:1.5,c:"mod"},
    {k:"win",l:"⊞",w:1.2,c:"mod"},
    {k:"alt",l:"Alt",w:1.3,c:"mod"},
    {k:"space",l:"Space",w:6,c:"space"},
    {k:"alt",l:"Alt",w:1.3,c:"mod"},
    {k:"win",l:"⊞",w:1.2,c:"mod"},
    {k:"ctrl",l:"Ctrl",w:1.5,c:"mod"},
    {k:"left",l:"⬅",c:"blue"},
    {k:"down",l:"⬇",c:"blue"},
    {k:"right",l:"➡",c:"blue"},
  ],
];

const MOD_KEYS = new Set(["ctrl","shift","alt","win","capslock"]);

function openFullKeyboard() {
  const overlay = document.getElementById("fullKbOverlay");
  if (!overlay) return;
  fullKbHeld.clear();
  fullKbCombo = [];
  _renderFullKb();
  overlay.classList.add("open");
  // Блокируем скролл страницы
  document.body.style.overflow = "hidden";
}

function closeFullKeyboard() {
  const overlay = document.getElementById("fullKbOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";
  fullKbHeld.clear();
  fullKbCombo = [];
}

function _renderFullKb() {
  const body = document.getElementById("fullKbBody");
  if (!body) return;

  body.innerHTML = FULL_KB_LAYOUT.map((row, ri) =>
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

      if (isMod) {
        // Зажатые (модификаторы) — добавляем в комбо
        if (fullKbHeld.has(key)) {
          fullKbHeld.delete(key);
          el.classList.remove("fkb-held");
        } else {
          fullKbHeld.add(key);
          el.classList.add("fkb-held");
        }
        _updateFullKbCombo();
      }
    });

    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (!isMod) {
        // Обычная клавиша
        if (fullKbHeld.size > 0) {
          // Есть зажатые модификаторы — делаем комбо
          const combo = [...fullKbHeld, key].join("+");
          fullKbCombo = [...fullKbHeld, key];
          _updateFullKbCombo();
          execCmd("press_key", { key: combo });
          // Сбрасываем моды
          setTimeout(() => {
            fullKbHeld.clear();
            fullKbCombo = [];
            body.querySelectorAll(".fkb-held").forEach(e => e.classList.remove("fkb-held"));
            _updateFullKbCombo();
          }, 300);
        } else {
          // Просто нажатие
          execCmd("press_key", { key });
          // Визуальный отклик
          el.classList.add("fkb-pressed");
          setTimeout(() => el.classList.remove("fkb-pressed"), 150);
        }
      }
    });
  });
}

function _updateFullKbCombo() {
  const display = document.getElementById("fullKbCombo");
  if (!display) return;
  const parts = [...fullKbHeld];
  if (parts.length) {
    display.textContent = parts.join(" + ") + " +…";
    display.style.color = "#A78BFA";
  } else {
    display.textContent = "—";
    display.style.color = "var(--muted)";
  }
}

function fullKbExecute() {
  if (!fullKbHeld.size) return;
  const combo = [...fullKbHeld].join("+");
  execCmd("press_key", { key: combo });
  fullKbHeld.clear();
  fullKbCombo = [];
  document.querySelectorAll(".fkb-held").forEach(e => e.classList.remove("fkb-held"));
  _updateFullKbCombo();
}

function fullKbClear() {
  fullKbHeld.clear();
  fullKbCombo = [];
  document.querySelectorAll(".fkb-held").forEach(e => e.classList.remove("fkb-held"));
  _updateFullKbCombo();
}

// ── Прочие функции ──
async function pressKey(key) {
  await execCmd("press_key", { key });
}

async function pressCustomKey() {
  const k = (document.getElementById("customKey")?.value || "").trim();
  if (!k) { toast("❌", "Введите клавишу", 2000); return; }
  await execCmd("press_key", { key: k });
  document.getElementById("customKey").value = "";
}

async function typeText() {
  const t = (document.getElementById("typeText")?.value || "").trim();
  if (!t) { toast("❌", "Введите текст", 2000); return; }
  await execCmd("type_text", { text: t });
  document.getElementById("typeText").value = "";
}

async function openUrl() {
  const url = (document.getElementById("urlInput")?.value || "").trim();
  if (!url) { toast("❌", "Введите URL", 2000); return; }
  await execCmd("open_url", { url });
  document.getElementById("urlInput").value = "";
}

// ── Список окон с автообновлением ──
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

// Автообновление окон каждые 10 сек
function startWinAutoRefresh() {
  refreshWindows();
  _winRefreshTimer = setInterval(refreshWindows, 10000);
}

function stopWinAutoRefresh() {
  clearInterval(_winRefreshTimer);
}

// CSS
const _kbStyle = document.createElement("style");
_kbStyle.textContent = `
  .kb-row { display:flex; gap:6px; margin-bottom:6px; }
  .kb-key {
    flex:1; min-height:50px; border-radius:12px; border:1px solid rgba(124,110,250,.2);
    background:rgba(90,175,255,.08); color:var(--blue); font-weight:900; font-size:13px;
    display:flex; align-items:center; justify-content:center;
    user-select:none; cursor:pointer; transition:transform .1s;
  }
  .kb-key:active,.kb-key.kb-held { transform:scale(.92); background:rgba(124,110,250,.3); }
  .kb-key.accent { background:rgba(124,110,250,.1); color:#A78BFA; }
  .kb-key.ok { background:rgba(52,211,153,.1); color:var(--ok); }
  .kb-key.blue { background:rgba(90,175,255,.1); color:var(--blue); }

  /* Полная клавиатура */
  .fullkb-overlay {
    position:fixed; inset:0; z-index:800;
    background:rgba(8,11,20,.97);
    display:none; flex-direction:column;
    overflow:hidden;
  }
  .fullkb-overlay.open { display:flex; }
  .fullkb-header {
    display:flex; align-items:center; gap:8px;
    padding:10px 14px; border-bottom:1px solid rgba(124,110,250,.2);
    flex-shrink:0;
  }
  .fullkb-combo {
    flex:1; font-size:14px; font-weight:900; color:var(--muted);
    font-variant-numeric:tabular-nums;
  }
  .fullkb-exec {
    border:none; border-radius:10px; padding:8px 14px;
    background:linear-gradient(135deg,#7C6EFA,#5AAFFF);
    color:#fff; font-weight:900; cursor:pointer;
  }
  .fullkb-clear {
    border:none; border-radius:10px; padding:8px 12px;
    background:rgba(251,191,36,.14); border:1px solid rgba(251,191,36,.25);
    color:var(--warn); font-weight:900; cursor:pointer;
  }
  .fullkb-close {
    border:none; border-radius:10px; padding:8px 12px;
    background:rgba(255,77,109,.14); border:1px solid rgba(255,77,109,.25);
    color:var(--danger); font-weight:900; cursor:pointer;
  }
  .fullkb-body {
    flex:1; overflow-y:auto; padding:10px 8px;
    display:flex; flex-direction:column; gap:4px;
  }
  .fkb-row {
    display:flex; gap:4px; flex-shrink:0;
  }
  .fkb-key {
    flex:1; min-height:44px; border-radius:8px;
    border:1px solid rgba(255,255,255,.1);
    background:rgba(255,255,255,.06);
    color:var(--text); font-weight:800; font-size:11px;
    display:flex; align-items:center; justify-content:center;
    user-select:none; cursor:pointer;
    transition:transform .08s, background .08s;
    text-align:center; padding:2px;
  }
  .fkb-key:active,.fkb-key.fkb-pressed {
    transform:scale(.9); background:rgba(90,175,255,.25);
  }
  .fkb-accent { background:rgba(124,110,250,.12); color:#A78BFA; border-color:rgba(124,110,250,.22); }
  .fkb-ok { background:rgba(52,211,153,.12); color:var(--ok); border-color:rgba(52,211,153,.22); }
  .fkb-blue { background:rgba(90,175,255,.12); color:var(--blue); border-color:rgba(90,175,255,.22); }
  .fkb-mod { background:rgba(251,191,36,.1); color:var(--warn); border-color:rgba(251,191,36,.22); }
  .fkb-space { background:rgba(255,255,255,.08); border-color:rgba(255,255,255,.18); }
  .fkb-held {
    background:rgba(124,110,250,.35) !important;
    border-color:#7C6EFA !important;
    color:#fff !important;
    box-shadow:0 0 12px rgba(124,110,250,.4);
  }
  .fkb-modifier { font-weight:900; }
`;
document.head.appendChild(_kbStyle);

window.renderKeyboard = renderKeyboard;
window.pressKey = pressKey;
window.pressCustomKey = pressCustomKey;
window.typeText = typeText;
window.toggleMod = toggleMod;
window.execModCombo = execModCombo;
window.clearMods = clearMods;
window.openUrl = openUrl;
window.openFullKeyboard = openFullKeyboard;
window.closeFullKeyboard = closeFullKeyboard;
window.fullKbExecute = fullKbExecute;
window.fullKbClear = fullKbClear;
window.refreshWindows = refreshWindows;
window.focusWindow = focusWindow;
window.closeWindow = closeWindow;
window.startWinAutoRefresh = startWinAutoRefresh;
window.stopWinAutoRefresh = stopWinAutoRefresh;