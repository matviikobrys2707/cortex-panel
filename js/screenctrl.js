// ══════════════════════════════════════════════════════════════
//  Screen Control — 30-60 FPS трансляция + Chrome RDP управление
// ══════════════════════════════════════════════════════════════

let scActive      = false;
let scFpsTimer    = null;
let scPcWidth     = 1920;
let scPcHeight    = 1080;
let scMouseDown   = false;
let scFpsCount    = 0;
let scFpsLast     = Date.now();
let scOrientation = "landscape"; // landscape | portrait
let scLastMoveTime = 0;
let scMoveThrottle = 16; // ~60fps для движения мыши

// ── Открыть трансляцию ──
function openScreenControl() {
  const overlay = document.getElementById("screenCtrlOverlay");
  if (!overlay) {
    toast("❌", "Элемент не найден", 3000);
    return;
  }

  scActive      = true;
  scFpsCount    = 0;
  scFpsLast     = Date.now();
  scMouseDown   = false;
  scOrientation = window.innerWidth > window.innerHeight ? "landscape" : "portrait";

  overlay.classList.add("open");
  overlay.classList.remove("portrait", "landscape");
  overlay.classList.add(scOrientation);
  document.body.style.overflow = "hidden";

  // Hint
  const hint = document.getElementById("scHint");
  if (hint) hint.style.display = "block";

  // FPS counter
  scFpsTimer = setInterval(() => {
    const now  = Date.now();
    const diff = (now - scFpsLast) / 1000;
    const fps  = diff > 0 ? Math.round(scFpsCount / diff) : 0;
    scFpsCount = 0;
    scFpsLast  = now;
    const el   = document.getElementById("scFps");
    if (el) el.textContent = fps + " fps";
  }, 1000);

  // Canvas setup
  const canvas = document.getElementById("scCanvas");
  _scSetupCanvas(canvas);

  // Start streaming
  _scLoop();
}

// ── Закрыть ──
function closeScreenControl() {
  scActive    = false;
  scMouseDown = false;

  if (scFpsTimer) {
    clearInterval(scFpsTimer);
    scFpsTimer = null;
  }

  const overlay = document.getElementById("screenCtrlOverlay");
  if (overlay) {
    overlay.classList.remove("open", "portrait", "landscape");
  }

  document.body.style.overflow = "";

  const fps  = document.getElementById("scFps");
  const ping = document.getElementById("scPing");
  if (fps)  fps.textContent  = "— fps";
  if (ping) ping.textContent = "— ms";
}

// ── Переключение ориентации ──
function scToggleOrientation() {
  scOrientation = scOrientation === "landscape" ? "portrait" : "landscape";
  const overlay = document.getElementById("screenCtrlOverlay");
  if (overlay) {
    overlay.classList.remove("landscape", "portrait");
    overlay.classList.add(scOrientation);
  }
  const btn = document.getElementById("scOrientBtn");
  if (btn) {
    btn.textContent = scOrientation === "landscape" ? "↻ Portrait" : "↻ Landscape";
  }
  toast("🔄", `Ориентация: ${scOrientation}`, 1500);
}

// ══════════════════════════════════════════════════════════════
//  Цикл захвата (оптимизирован для 30-60fps)
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

        if (hint && hint.style.display !== "none") {
          hint.style.display = "none";
        }

        if (res.data.w) scPcWidth  = res.data.w;
        if (res.data.h) scPcHeight = res.data.h;

        await _scDrawFrame(canvas, ctx, res.data.b64, res.data.mime || "image/jpeg");
        scFpsCount++;
      }
    } catch (e) {
      if (!scActive) break;
      await _scSleep(100);
    }

    // Target ~30fps (33ms) для баланса скорости/трафика
    const elapsed = Date.now() - t0;
    const wait    = Math.max(0, 33 - elapsed);
    if (wait > 0) await _scSleep(wait);
  }
}

function _scSleep(ms) {
  return new Promise(r => setTimeout(r, ms));
}

// ── Рисуем кадр ──
function _scDrawFrame(canvas, ctx, b64, mime) {
  return new Promise((resolve) => {
    if (!canvas || !ctx) { resolve(); return; }

    const img = new Image();
    const url = "data:" + mime + ";base64," + b64;

    img.onload = () => {
      const wrap  = document.getElementById("scCanvasWrap");
      const maxW  = wrap ? wrap.clientWidth  : window.innerWidth;
      const maxH  = wrap ? wrap.clientHeight : window.innerHeight;
      const ratio = Math.min(maxW / scPcWidth, maxH / scPcHeight);
      const drawW = Math.floor(scPcWidth  * ratio);
      const drawH = Math.floor(scPcHeight * ratio);

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
//  Управление мышью (Chrome Remote Desktop style)
// ══════════════════════════════════════════════════════════════
function _scSetupCanvas(canvas) {
  if (!canvas) return;

  // Clone для сброса обработчиков
  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const c = newCanvas;

  // ── Координаты ПК ──
  function _getPcCoords(e) {
    const rect    = c.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const clientY = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);
    const relX    = (clientX - rect.left) / rect.width;
    const relY    = (clientY - rect.top)  / rect.height;
    return {
      x: Math.round(Math.max(0, Math.min(1, relX)) * scPcWidth),
      y: Math.round(Math.max(0, Math.min(1, relY)) * scPcHeight),
    };
  }

  // ── Движение с throttle (60fps) ──
  async function _handleMove(e) {
    if (!scActive) return;
    const now = Date.now();
    if (now - scLastMoveTime < scMoveThrottle) return;
    scLastMoveTime = now;

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

    // Сначала перемещаем мышь
    try { 
      await apiPost("/api/exec", { cmd: "mouse_move", x, y }); 
    } catch {}

    // Определяем кнопку
    let btn = "left";
    if (e.button === 2) btn = "right";
    if (e.button === 1) btn = "middle";

    scMouseDown = true;
    try { 
      await apiPost("/api/exec", { cmd: "mouse_down", button: btn }); 
    } catch {}
  }, { passive: false });

  // ── Pointer Move (drag) ──
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

    if (scMouseDown) {
      scMouseDown = false;
      try { 
        await apiPost("/api/exec", { cmd: "mouse_up", button: btn }); 
      } catch {}
    }
  }, { passive: false });

  // ── Pointer Cancel ──
  c.addEventListener("pointercancel", async () => {
    if (scMouseDown) {
      scMouseDown = false;
      try { 
        await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); 
      } catch {}
    }
  });

  // ── Context Menu (ПКМ) ──
  c.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    const { x, y } = _getPcCoords(e);
    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
      await apiPost("/api/exec", { cmd: "mouse_click", button: "right" });
    } catch {}
  });

  // ── Scroll ──
  c.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? "down" : "up";
    try { 
      await apiPost("/api/exec", { cmd: "mouse_scroll", direction: dir }); 
    } catch {}
  }, { passive: false });

  // ── Touch Support ──
  let touchStartTime = 0;
  let touchMoved = false;

  c.addEventListener("touchstart", async (e) => {
    e.preventDefault();
    touchStartTime = Date.now();
    touchMoved = false;

    const touch = e.touches[0];
    const rect  = c.getBoundingClientRect();
    const relX  = (touch.clientX - rect.left) / rect.width;
    const relY  = (touch.clientY - rect.top)  / rect.height;
    const x     = Math.round(Math.max(0, Math.min(1, relX)) * scPcWidth);
    const y     = Math.round(Math.max(0, Math.min(1, relY)) * scPcHeight);

    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
    } catch {}

    scMouseDown = true;
  }, { passive: false });

  c.addEventListener("touchmove", async (e) => {
    e.preventDefault();
    touchMoved = true;

    if (!scActive) return;
    const now = Date.now();
    if (now - scLastMoveTime < scMoveThrottle) return;
    scLastMoveTime = now;

    const touch = e.touches[0];
    const rect  = c.getBoundingClientRect();
    const relX  = (touch.clientX - rect.left) / rect.width;
    const relY  = (touch.clientY - rect.top)  / rect.height;
    const x     = Math.round(Math.max(0, Math.min(1, relX)) * scPcWidth);
    const y     = Math.round(Math.max(0, Math.min(1, relY)) * scPcHeight);

    try { 
      await apiPost("/api/exec", { cmd: "mouse_move", x, y }); 
    } catch {}
  }, { passive: false });

  c.addEventListener("touchend", async (e) => {
    e.preventDefault();

    const touchDuration = Date.now() - touchStartTime;

    if (scMouseDown) {
      scMouseDown = false;

      // Если короткий тап без движения — это клик
      if (touchDuration < 300 && !touchMoved) {
        try { 
          await apiPost("/api/exec", { cmd: "mouse_click", button: "left" }); 
        } catch {}
      } else {
        // Долгий или с движением — release
        try { 
          await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); 
        } catch {}
      }
    }
  }, { passive: false });
}

// ══════════════════════════════════════════════════════════════
//  Exports
// ══════════════════════════════════════════════════════════════
window.openScreenControl     = openScreenControl;
window.closeScreenControl    = closeScreenControl;
window.scToggleOrientation   = scToggleOrientation;