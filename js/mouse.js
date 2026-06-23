// ══════════════════════════════════════════════════════════════
//  Mouse — зажатие кнопок с визуальным индикатором
// ══════════════════════════════════════════════════════════════

let _mouseHeld = {};   // { left: bool, right: bool, middle: bool }
let _mouseHoldEl = {}; // ссылки на элементы

// ── Зажатие кнопки ──
async function mouseHoldStart(btn, el) {
  if (_mouseHeld[btn]) return;
  _mouseHeld[btn] = true;
  _mouseHoldEl[btn] = el;

  // Визуальный эффект
  el.classList.add("holding");

  // Показываем статус
  _showHoldStatus(btn);

  try {
    await apiPost("/api/exec", { cmd: "mouse_down", button: btn });
  } catch (e) {
    console.warn("[Mouse] down error:", e);
  }
}

// ── Отпускание ──
async function mouseHoldStop(btn, el) {
  if (!_mouseHeld[btn]) return;
  _mouseHeld[btn] = false;

  const held = _mouseHoldEl[btn];
  if (held) held.classList.remove("holding");
  _mouseHoldEl[btn] = null;

  // Скрываем статус если все кнопки отпущены
  if (!Object.values(_mouseHeld).some(Boolean)) {
    _hideHoldStatus();
  }

  try {
    await apiPost("/api/exec", { cmd: "mouse_up", button: btn });
  } catch (e) {
    console.warn("[Mouse] up error:", e);
  }
}

// ── Принудительное отпускание всех ──
async function mouseForceRelease() {
  for (const btn of ["left", "right", "middle"]) {
    if (_mouseHeld[btn]) {
      _mouseHeld[btn] = false;
      const el = _mouseHoldEl[btn];
      if (el) el.classList.remove("holding");
      _mouseHoldEl[btn] = null;
      try {
        await apiPost("/api/exec", { cmd: "mouse_up", button: btn });
      } catch {}
    }
  }
  _hideHoldStatus();
  toast("✅", "Все кнопки отпущены", 1500);
}

// ── Скролл ──
async function mouseScroll(dir) {
  await execCmd("mouse_scroll", { direction: dir });
}

// ── Статус-бар зажатия ──
function _showHoldStatus(btn) {
  const names = { left: "ЛКМ", right: "ПКМ", middle: "Колёсико" };
  const statusEl = document.getElementById("mouseHoldStatus");
  const textEl   = document.getElementById("mouseHoldStatusText");
  if (!statusEl) return;
  if (textEl) textEl.textContent = `Зажато: ${names[btn]} — кнопка активна на ПК`;
  statusEl.style.display = "flex";
}

function _hideHoldStatus() {
  const el = document.getElementById("mouseHoldStatus");
  if (el) el.style.display = "none";
}

// ── Exports ──
window.mouseHoldStart   = mouseHoldStart;
window.mouseHoldStop    = mouseHoldStop;
window.mouseForceRelease= mouseForceRelease;
window.mouseScroll      = mouseScroll;
// Совместимость со старым кодом
window.mouseDown = (btn) => {
  const el = btn === "left"
    ? document.querySelector(".mouse-btn-left")
    : btn === "right"
    ? document.querySelector(".mouse-btn-right")
    : document.querySelector(".mouse-scroll-btn");
  if (el) mouseHoldStart(btn, el);
};
window.mouseUp = (btn) => {
  const el = _mouseHoldEl[btn];
  if (el) mouseHoldStop(btn, el);
};