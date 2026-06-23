// ══════════════════════════════════════════════════════════════
//  Keyboard — стрелки, зажатие, модификаторы
// ══════════════════════════════════════════════════════════════

let activeMods = new Set();
let holdTimer = null;
let holdKey = null;
let holdInterval = null;

function renderKeyboard() {
  const container = document.getElementById("kbGrid");
  if (!container) return;

  container.innerHTML = `
    <div class="kb-section">
      <div class="kb-section-title">Навигация</div>
      <div class="kb-arrows">
        <div class="kb-key empty"></div>
        <div class="kb-key blue" data-key="up">⬆</div>
        <div class="kb-key empty"></div>
        <div class="kb-key blue" data-key="left">⬅</div>
        <div class="kb-key accent" data-key="space">Sp</div>
        <div class="kb-key blue" data-key="right">➡</div>
        <div class="kb-key empty"></div>
        <div class="kb-key blue" data-key="down">⬇</div>
        <div class="kb-key empty"></div>
      </div>
    </div>
    <div class="kb-section">
      <div class="kb-section-title">Основные</div>
      <div class="grid g3">
        <div class="kb-key ok"     data-key="enter">Enter</div>
        <div class="kb-key accent" data-key="escape">Esc</div>
        <div class="kb-key accent" data-key="tab">Tab</div>
        <div class="kb-key blue"   data-key="backspace">⌫ Back</div>
        <div class="kb-key blue"   data-key="delete">Del</div>
        <div class="kb-key blue"   data-key="home">Home</div>
        <div class="kb-key blue"   data-key="end">End</div>
        <div class="kb-key blue"   data-key="pageup">PgUp</div>
        <div class="kb-key blue"   data-key="pagedown">PgDn</div>
      </div>
    </div>
    <div class="kb-section">
      <div class="kb-section-title">Буквы / Цифры</div>
      <div class="grid g4">
        ${["1","2","3","4","5","6","7","8","9","0"].map(k =>
          `<div class="kb-key accent" data-key="${k}">${k}</div>`
        ).join("")}
      </div>
      <div class="grid g4" style="margin-top:8px">
        ${["a","b","c","d","e","f","g","h"].map(k =>
          `<div class="kb-key" data-key="${k}">${k.toUpperCase()}</div>`
        ).join("")}
      </div>
    </div>
    <div class="kb-section">
      <div class="kb-section-title">F-клавиши</div>
      <div class="grid g4">
        ${[1,2,3,4,5,6,7,8,9,10,11,12].map(n =>
          `<div class="kb-key accent" data-key="f${n}">F${n}</div>`
        ).join("")}
      </div>
    </div>
  `;

  // Вешаем события на все кнопки
  container.querySelectorAll(".kb-key[data-key]").forEach(el => {
    const key = el.dataset.key;

    // Зажатие
    el.addEventListener("pointerdown", (e) => {
      e.preventDefault();
      holdKey = key;
      holdTimer = setTimeout(() => {
        // Зажато - начинаем повтор
        el.classList.add("kb-held");
        holdInterval = setInterval(() => {
          pressKeyWithMods(key);
        }, 80);
      }, 500);
    });

    el.addEventListener("pointerup", (e) => {
      e.preventDefault();
      if (holdInterval) {
        // Было зажато
        clearInterval(holdInterval);
        holdInterval = null;
        el.classList.remove("kb-held");
      } else if (holdTimer) {
        // Просто клик
        clearTimeout(holdTimer);
        pressKeyWithMods(key);
      }
      holdTimer = null;
      holdKey = null;
    });

    el.addEventListener("pointerleave", () => {
      clearTimeout(holdTimer);
      clearInterval(holdInterval);
      holdTimer = null;
      holdInterval = null;
      el.classList.remove("kb-held");
    });
  });
}

function pressKeyWithMods(key) {
  if (activeMods.size > 0) {
    const combo = [...activeMods, key].join("+");
    execCmd("press_key", { key: combo });
  } else {
    execCmd("press_key", { key });
  }
}

// ── Модификаторы ──
function toggleMod(mod) {
  if (activeMods.has(mod)) {
    activeMods.delete(mod);
  } else {
    activeMods.add(mod);
  }
  updateModDisplay();
}

function updateModDisplay() {
  // Обновляем кнопки модификаторов
  ["ctrl", "alt", "shift", "win"].forEach(m => {
    const el = document.getElementById(`mod-${m}`);
    if (el) el.classList.toggle("active", activeMods.has(m));
  });

  // Показываем статус если что-то зажато
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
  if (activeMods.size === 0) return;
  const combo = [...activeMods].join("+");
  execCmd("press_key", { key: combo });
  clearMods();
}

function clearMods() {
  activeMods.clear();
  updateModDisplay();
}

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

// ── Открыть URL ──
async function openUrl() {
  const url = (document.getElementById("urlInput")?.value || "").trim();
  if (!url) { toast("❌", "Введите URL", 2000); return; }
  await execCmd("open_url", { url });
  document.getElementById("urlInput").value = "";
}

// ── Список окон ──
async function refreshWindows() {
  const listEl = document.getElementById("windowsList");
  if (!listEl) return;
  listEl.innerHTML = `<div class="empty"><div class="empty-ico">⏳</div>Загрузка…</div>`;

  try {
    const res = await execCmd("get_windows");
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
        <div class="win-ico">🪟</div>
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
  await execCmd("focus_window", { hwnd });
}

async function closeWindow(hwnd) {
  await execCmd("close_window", { hwnd });
  setTimeout(refreshWindows, 500);
}

// CSS для зажатой клавиши
const kbStyle = document.createElement("style");
kbStyle.textContent = `
  .kb-key.kb-held {
    background: rgba(124, 110, 250, 0.4) !important;
    border-color: #7C6EFA !important;
    transform: scale(0.95);
    box-shadow: 0 0 16px rgba(124, 110, 250, 0.5);
  }
`;
document.head.appendChild(kbStyle);

window.renderKeyboard = renderKeyboard;
window.pressKey = pressKey;
window.pressCustomKey = pressCustomKey;
window.typeText = typeText;
window.toggleMod = toggleMod;
window.execModCombo = execModCombo;
window.clearMods = clearMods;
window.openUrl = openUrl;
window.refreshWindows = refreshWindows;
window.focusWindow = focusWindow;
window.closeWindow = closeWindow;