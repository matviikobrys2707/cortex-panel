// ══════════════════════════════════════════════════════════════
//  Screen Control — трансляция экрана + управление мышью
// ══════════════════════════════════════════════════════════════

let scActive    = false;
let scFpsTimer  = null;
let scPcWidth   = 1920;
let scPcHeight  = 1080;
let scMouseDown = false;
let scFpsCount  = 0;
let scFpsLast   = Date.now();

// ── Открыть трансляцию ──
function openScreenControl() {
  const overlay = document.getElementById("screenCtrlOverlay");
  if (!overlay) {
    toast("❌", "Элемент трансляции не найден", 3000);
    return;
  }

  scActive    = true;
  scFpsCount  = 0;
  scFpsLast   = Date.now();
  scMouseDown = false;

  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  // Сбрасываем hint
  const hint = document.getElementById("scHint");
  if (hint) hint.style.display = "block";

  // FPS счётчик
  scFpsTimer = setInterval(() => {
    const now  = Date.now();
    const diff = (now - scFpsLast) / 1000;
    const fps  = diff > 0 ? Math.round(scFpsCount / diff) : 0;
    scFpsCount = 0;
    scFpsLast  = now;
    const el   = document.getElementById("scFps");
    if (el) el.textContent = fps + " fps";
  }, 1000);

  // Настраиваем события мыши на canvas
  const canvas = document.getElementById("scCanvas");
  _scSetupCanvas(canvas);

  // Запускаем цикл кадров
  _scLoop();
}

// ── Закрыть трансляцию ──
function closeScreenControl() {
  scActive    = false;
  scMouseDown = false;

  if (scFpsTimer) {
    clearInterval(scFpsTimer);
    scFpsTimer = null;
  }

  const overlay = document.getElementById("screenCtrlOverlay");
  if (overlay) overlay.classList.remove("open");

  document.body.style.overflow = "";

  // Сбрасываем FPS и ping
  const fps  = document.getElementById("scFps");
  const ping = document.getElementById("scPing");
  if (fps)  fps.textContent  = "— fps";
  if (ping) ping.textContent = "— ms";
}

// ══════════════════════════════════════════════════════════════
//  Цикл захвата кадров
// ══════════════════════════════════════════════════════════════
async function _scLoop() {
  if (!scActive) return;

  const canvas = document.getElementById("scCanvas");
  const ctx    = canvas ? canvas.getContext("2d") : null;
  const hint   = document.getElementById("scHint");
  const pingEl = document.getElementById("scPing");

  while (scActive) {
    const t0 = Date.now();

    try {
      const res = await apiPost("/api/exec", { cmd: "screenshot_stream" });

      if (!scActive) break;

      if (res?.ok && res.data?.b64) {
        const pingMs = Date.now() - t0;
        if (pingEl) pingEl.textContent = pingMs + " ms";

        // Скрываем hint при первом кадре
        if (hint && hint.style.display !== "none") {
          hint.style.display = "none";
        }

        // Обновляем размеры экрана ПК
        if (res.data.w) scPcWidth  = res.data.w;
        if (res.data.h) scPcHeight = res.data.h;

        // Рисуем кадр
        await _scDrawFrame(canvas, ctx, res.data.b64, res.data.mime || "image/jpeg");
        scFpsCount++;
      }
    } catch (e) {
      // Не останавливаемся на ошибке одного кадра
      if (!scActive) break;
      await _scSleep(200);
    }

    // Небольшая пауза между кадрами (~30fps target)
    const elapsed = Date.now() - t0;
    const wait    = Math.max(0, 33 - elapsed);
    if (wait > 0) await _scSleep(wait);
  }
}

function _scSleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Рисуем кадр на canvas ──
function _scDrawFrame(canvas, ctx, b64, mime) {
  return new Promise((resolve) => {
    if (!canvas || !ctx) { resolve(); return; }

    const img = new Image();
    const url = "data:" + mime + ";base64," + b64;

    img.onload = () => {
      // Подгоняем canvas под контейнер
      const wrap   = document.getElementById("scCanvasWrap");
      const maxW   = wrap ? wrap.clientWidth  : window.innerWidth;
      const maxH   = wrap ? wrap.clientHeight : window.innerHeight;
      const ratio  = Math.min(maxW / scPcWidth, maxH / scPcHeight);
      const drawW  = Math.floor(scPcWidth  * ratio);
      const drawH  = Math.floor(scPcHeight * ratio);

      if (canvas.width !== drawW || canvas.height !== drawH) {
        canvas.width  = drawW;
        canvas.height = drawH;
      }

      ctx.drawImage(img, 0, 0, drawW, drawH);
      resolve();
    };

    img.onerror = () => resolve();
    img.src     = url;
  });
}

// ══════════════════════════════════════════════════════════════
//  Управление мышью на canvas
// ══════════════════════════════════════════════════════════════
function _scSetupCanvas(canvas) {
  if (!canvas) return;

  // Убираем старые обработчики (пересоздаём canvas clone)
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const c   = newCanvas;
  const ctx = c.getContext("2d");

  // ── Получаем координаты мыши относительно экрана ПК ──
  function _getPcCoords(e) {
    const rect   = c.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);
    const relX    = (clientX - rect.left)  / rect.width;
    const relY    = (clientY - rect.top)   / rect.height;
    return {
      x: Math.round(Math.max(0, Math.min(1, relX)) * scPcWidth),
      y: Math.round(Math.max(0, Math.min(1, relY)) * scPcHeight),
    };
  }

  // ── Движение мыши (throttle 30ms) ──
  let _lastMove = 0;
  async function _handleMove(e) {
    if (!scActive) return;
    const now = Date.now();
    if (now - _lastMove < 30) return;  // throttle
    _lastMove = now;
    const { x, y } = _getPcCoords(e);
    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
    } catch {}
  }

  // ── Pointer Down ──
  c.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    c.setPointerCapture(e.pointerId);

    const { x, y } = _getPcCoords(e);

    // Сначала двигаем мышь
    try { await apiPost("/api/exec", { cmd: "mouse_move", x, y }); } catch {}

    // Определяем кнопку
    let btn = "left";
    if (e.button === 2) btn = "right";
    if (e.button === 1) btn = "middle";

    scMouseDown = true;
    try { await apiPost("/api/exec", { cmd: "mouse_down", button: btn }); } catch {}
  }, { passive: false });

  // ── Pointer Move ──
  c.addEventListener("pointermove", async (e) => {
    e.preventDefault();
    await _handleMove(e);
  }, { passive: false });

  // ── Pointer Up ──
  c.addEventListener("pointerup", async (e) => {
    e.preventDefault();

    let btn = "left";
    if (e.button === 2) btn = "right";
    if (e.button === 1) btn = "middle";

    scMouseDown = false;
    try { await apiPost("/api/exec", { cmd: "mouse_up", button: btn }); } catch {}
  }, { passive: false });

  // ── Pointer Cancel ──
  c.addEventListener("pointercancel", async (e) => {
    scMouseDown = false;
    try { await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); } catch {}
  });

  // ── Правая кнопка ──
  c.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    const { x, y } = _getPcCoords(e);
    try {
      await apiPost("/api/exec", { cmd: "mouse_move",  x, y });
      await apiPost("/api/exec", { cmd: "mouse_click", button: "right" });
    } catch {}
  });

  // ── Колёсико (скролл) ──
  c.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? "down" : "up";
    try { await apiPost("/api/exec", { cmd: "mouse_scroll", direction: dir }); } catch {}
  }, { passive: false });

  // ── Touch (для мобильных) ──
  c.addEventListener("touchstart", async (e) => {
    e.preventDefault();
    const touch  = e.touches[0];
    const rect   = c.getBoundingClientRect();
    const relX   = (touch.clientX - rect.left) / rect.width;
    const relY   = (touch.clientY - rect.top)  / rect.height;
    const x      = Math.round(Math.max(0,Math.min(1,relX)) * scPcWidth);
    const y      = Math.round(Math.max(0,Math.min(1,relY)) * scPcHeight);
    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
      await apiPost("/api/exec", { cmd: "mouse_down", button: "left" });
    } catch {}
    scMouseDown = true;
  }, { passive: false });

  c.addEventListener("touchmove", async (e) => {
    e.preventDefault();
    if (!scActive) return;
    const now = Date.now();
    if (now - _lastMove < 40) return;
    _lastMove = now;
    const touch = e.touches[0];
    const rect  = c.getBoundingClientRect();
    const relX  = (touch.clientX - rect.left) / rect.width;
    const relY  = (touch.clientY - rect.top)  / rect.height;
    const x     = Math.round(Math.max(0,Math.min(1,relX)) * scPcWidth);
    const y     = Math.round(Math.max(0,Math.min(1,relY)) * scPcHeight);
    try { await apiPost("/api/exec", { cmd: "mouse_move", x, y }); } catch {}
  }, { passive: false });

  c.addEventListener("touchend", async (e) => {
    e.preventDefault();
    scMouseDown = false;
    try { await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); } catch {}
  }, { passive: false });
}

// ══════════════════════════════════════════════════════════════
//  Exports
// ══════════════════════════════════════════════════════════════
window.openScreenControl  = openScreenControl;
window.closeScreenControl = closeScreenControl;
