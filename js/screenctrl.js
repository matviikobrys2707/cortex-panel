// ══════════════════════════════════════════════════════════════
//  Screen Control — трансляция экрана ~60fps + управление мышью
// ══════════════════════════════════════════════════════════════

let scActive = false;
let scAnimFrame = null;
let scLastTime = 0;
let scFrameCount = 0;
let scFpsTimer = null;
let scPcWidth = 1920;
let scPcHeight = 1080;
let scIsMouseDown = false;

function openScreenControl() {
  const overlay = document.getElementById("screenCtrlOverlay");
  if (!overlay) return;

  scActive = true;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  const canvas = document.getElementById("scCanvas");
  const hint   = document.getElementById("scHint");

  // Настраиваем обработчики мыши на canvas
  _scSetupMouseEvents(canvas);

  // Запускаем трансляцию
  _scStartStream();
}

function closeScreenControl() {
  scActive = false;
  const overlay = document.getElementById("screenCtrlOverlay");
  if (overlay) overlay.classList.remove("open");
  document.body.style.overflow = "";

  if (scAnimFrame) { cancelAnimationFrame(scAnimFrame); scAnimFrame = null; }
  if (scFpsTimer)  { clearInterval(scFpsTimer); scFpsTimer = null; }
}

// ── Стриминг ──
function _scStartStream() {
  const hint = document.getElementById("scHint");
  const canvas = document.getElementById("scCanvas");
  const ctx = canvas.getContext("2d");
  const img = new Image();
  let fetching = false;

  // FPS счётчик
  let fpsCount = 0;
  let fpsLast = Date.now();
  scFpsTimer = setInterval(() => {
    const now = Date.now();
    const fps = Math.round(fpsCount / ((now - fpsLast) / 1000));
    fpsCount = 0;
    fpsLast = now;
    const el = document.getElementById("scFps");
    if (el) el.textContent = fps + " fps";
  }, 1000);

  // Цикл захвата
  async function _frame() {
    if (!scActive) return;

    if (!fetching) {
      fetching = true;
      const t0 = Date.now();
      try {
        const res = await apiPost("/api/exec", { cmd: "screenshot_stream" });
        if (res?.ok && res.data?.b64) {
          const pingMs = Date.now() - t0;
          const pingEl = document.getElementById("scPing");
          if (pingEl) pingEl.textContent = pingMs + " ms";

          const mime = res.data.mime || "image/jpeg";
          const b64  = res.data.b64;

          // Скрываем подсказку
          if (hint && hint.style.display !== "none") {
            hint.style.display = "none";
          }

          // Рисуем на canvas
          const blob = _b64ToBlob(b64, mime);
          const url  = URL.createObjectURL(blob);

          img.onload = () => {
            // Обновляем размеры PC
            if (res.data.w) scPcWidth  = res.data.w;
            if (res.data.h) scPcHeight = res.data.h;

            // Подгоняем canvas под экран
            const wrap = document.getElementById("scCanvasWrap");
            if (wrap) {
              const maxW = wrap.clientWidth;
              const maxH = wrap.clientHeight;
              const ratio = Math.min(maxW / scPcWidth, maxH / scPcHeight);
              canvas.width  = scPcWidth  * ratio;
              canvas.height = scPcHeight * ratio;
            }

            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
            URL.revokeObjectURL(url);
            fpsCount++;
          };
          img.src = url;
        }
      } catch (e) {
        // Игнорируем ошибки отдельных кадров
      }
      fetching = false;
    }

    if (scActive) {
      // ~30fps (каждые ~33ms)
      setTimeout(_frame, 33);
    }
  }

  _frame();
}

function _b64ToBlob(b64, mime) {
  const bin = atob(b64);
  const arr = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
  return new Blob([arr], { type: mime });
}

// ── Управление мышью на canvas ──
function _scSetupMouseEvents(canvas) {
  if (!canvas) return;

  function _getRelPos(e) {
    const rect = canvas.getBoundingClientRect();
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const relX = (clientX - rect.left) / rect.width;
    const relY = (clientY - rect.top)  / rect.height;
    return {
      x: Math.max(0, Math.min(1, relX)),
      y: Math.max(0, Math.min(1, relY))
    };
  }

  async function _moveMouse(e) {
    if (!scActive) return;
    const pos = _getRelPos(e);
    const pcX = Math.round(pos.x * scPcWidth);
    const pcY = Math.round(pos.y * scPcHeight);
    await apiPost("/api/exec", { cmd: "mouse_move", x: pcX, y: pcY });
  }

  // Pointer events для поддержки touch
  canvas.addEventListener("pointerdown", async (e) => {
    e.preventDefault();
    canvas.setPointerCapture(e.pointerId);
    await _moveMouse(e);
    scIsMouseDown = true;
    await apiPost("/api/exec", { cmd: "mouse_down", button: "left" });
  });

  canvas.addEventListener("pointermove", async (e) => {
    e.preventDefault();
    if (!scIsMouseDown) {
      // Просто движение
      await _moveMouse(e);
    } else {
      // Drag
      await _moveMouse(e);
    }
  });

  canvas.addEventListener("pointerup", async (e) => {
    e.preventDefault();
    if (scIsMouseDown) {
      scIsMouseDown = false;
      await apiPost("/api/exec", { cmd: "mouse_up", button: "left" });
    }
  });

  canvas.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    await _moveMouse(e);
    await apiPost("/api/exec", { cmd: "mouse_click", button: "right" });
  });

  // Скролл колёсиком
  canvas.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? "down" : "up";
    await apiPost("/api/exec", { cmd: "mouse_scroll", direction: dir });
  }, { passive: false });
}

// CSS
const _scStyle = document.createElement("style");
_scStyle.textContent = `
  .screenctrl-overlay {
    position:fixed; inset:0; z-index:700;
    background:#000;
    display:none; flex-direction:column;
  }
  .screenctrl-overlay.open { display:flex; }
  .screenctrl-header {
    display:flex; align-items:center; gap:10px;
    padding:8px 14px; flex-shrink:0;
    background:rgba(8,11,20,.9);
    border-bottom:1px solid rgba(124,110,250,.15);
  }
  .screenctrl-fps {
    font-size:13px; font-weight:900; color:var(--ok);
    font-variant-numeric:tabular-nums; min-width:60px;
  }
  .screenctrl-ping {
    font-size:13px; font-weight:900; color:var(--blue);
    font-variant-numeric:tabular-nums; min-width:60px;
  }
  .screenctrl-close {
    margin-left:auto; border:none; border-radius:10px;
    padding:8px 14px; background:rgba(255,77,109,.14);
    border:1px solid rgba(255,77,109,.25); color:var(--danger);
    font-weight:900; cursor:pointer;
  }
  .screenctrl-canvas-wrap {
    flex:1; display:flex; align-items:center; justify-content:center;
    overflow:hidden; position:relative;
    background:#050810;
  }
  #scCanvas {
    display:block;
    cursor:crosshair;
    touch-action:none;
    image-rendering:optimizeSpeed;
  }
  .screenctrl-hint {
    position:absolute; top:50%; left:50%;
    transform:translate(-50%,-50%);
    color:var(--muted); font-size:14px; font-weight:800;
    text-align:center; pointer-events:none;
  }
`;
document.head.appendChild(_scStyle);

window.openScreenControl  = openScreenControl;
window.closeScreenControl = closeScreenControl;