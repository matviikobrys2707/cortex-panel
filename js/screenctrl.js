// ══════════════════════════════════════════════════════════════
//  Screen Control — максимальное качество + джойстик для телефона
// ══════════════════════════════════════════════════════════════

let scActive    = false;
let scFpsTimer  = null;
let scPcW = 1920, scPcH = 1080;
let scFpsCount  = 0, scFpsLast = Date.now();
let scLastMove  = 0;

// Настройки качества
const SC_QUALITY = {
  high:   { cmd: "screenshot_stream_hq", w: 1920, quality: 90, fps: 20 },
  medium: { cmd: "screenshot_stream",    w: 1280, quality: 60, fps: 30 },
  low:    { cmd: "screenshot_stream",    w: 800,  quality: 35, fps: 30 },
};
let scCurrentQuality = "medium";

// Джойстик
let scJoystickActive = false;
let scJoystickInterval = null;
let scJoystickDx = 0, scJoystickDy = 0;
let scJoystickEnabled = false;

// ── Открыть ──
function openScreenControl() {
  const overlay = document.getElementById("screenCtrlOverlay");
  if (!overlay) return;

  scActive = true;
  overlay.classList.add("open");
  document.body.style.overflow = "hidden";

  const hint = document.getElementById("scHint");
  if (hint) hint.style.display = "block";

  // 🔥 H.264 плеер
  if (!window.h264Player) {
    window.h264Player = new H264Player('scCanvas', 'ws://localhost:8765');
  }
  window.h264Player.connect();

  setTimeout(() => {
    if (hint) hint.style.display = "none";
  }, 2000);

  scFpsTimer = setInterval(() => {
    // FPS обновляется внутри H264Player
  }, 1000);

  const canvas = document.getElementById("scCanvas");
  _scSetupCanvas(canvas);
}

function closeScreenControl() {
  scActive = false;
  
  if (window.h264Player) {
    window.h264Player.disconnect();
  }

  clearInterval(scFpsTimer);
  scFpsTimer = null;

  const overlay = document.getElementById("screenCtrlOverlay");
  if (overlay) overlay.classList.remove("open");
  
  document.body.style.overflow = "";
}

// ── Настройки ──
function scToggleSettings() {
  const panel = document.getElementById("scSettingsPanel");
  if (!panel) return;
  panel.style.display = panel.style.display === "none" ? "flex" : "none";
  panel.style.flexDirection = "column";
}

function scSetQuality(q) {
  scCurrentQuality = q;
  toast("🎚", `Качество: ${q}`, 1500);
}

// ── Джойстик ──
function scToggleJoystick(enabled) {
  scJoystickEnabled = enabled;
  const wrap = document.getElementById("scJoystickWrap");
  if (wrap) wrap.style.display = enabled ? "block" : "none";
  if (enabled) {
    _scInitJoystick();
  } else {
    _scStopJoystick();
  }
  toast(enabled ? "🕹" : "🖱", enabled ? "Джойстик включён" : "Джойстик выключен", 1500);
}

function _scInitJoystick() {
  const joystick = document.getElementById("scJoystick");
  const knob     = document.getElementById("scJoystickKnob");
  if (!joystick || !knob) return;

  const R = 55; // радиус зоны (половина 110px)
  let originX = 0, originY = 0;
  let activeId = null;

  joystick.addEventListener("touchstart", (e) => {
    e.preventDefault();
    const t = e.changedTouches[0];
    const rect = joystick.getBoundingClientRect();
    originX = rect.left + rect.width / 2;
    originY = rect.top  + rect.height / 2;
    activeId = t.identifier;
    scJoystickActive = true;
    _startJoystickMove();
  }, { passive: false });

  joystick.addEventListener("touchmove", (e) => {
    e.preventDefault();
    for (let i = 0; i < e.changedTouches.length; i++) {
      const t = e.changedTouches[i];
      if (t.identifier !== activeId) continue;

      const dx = t.clientX - originX;
      const dy = t.clientY - originY;
      const dist = Math.sqrt(dx*dx + dy*dy);
      const clamp = Math.min(dist, R);
      const angle = Math.atan2(dy, dx);

      const kx = Math.cos(angle) * clamp;
      const ky = Math.sin(angle) * clamp;

      knob.style.transform = `translate(calc(-50% + ${kx}px), calc(-50% + ${ky}px))`;

      // Нормализуем -1..1
      scJoystickDx = kx / R;
      scJoystickDy = ky / R;
    }
  }, { passive: false });

  const _jEnd = (e) => {
    e.preventDefault();
    scJoystickActive = false;
    scJoystickDx = 0; scJoystickDy = 0;
    knob.style.transform = "translate(-50%, -50%)";
    _stopJoystickMove();
  };
  joystick.addEventListener("touchend",    _jEnd, { passive: false });
  joystick.addEventListener("touchcancel", _jEnd, { passive: false });
}

let _jMoveTimer = null;
function _startJoystickMove() {
  if (_jMoveTimer) return;
  _jMoveTimer = setInterval(async () => {
    if (!scJoystickActive || !scActive) return;
    const speed = 20; // пикселей за тик
    const dx = Math.round(scJoystickDx * speed);
    const dy = Math.round(scJoystickDy * speed);
    if (dx === 0 && dy === 0) return;
    try {
      await apiPost("/api/exec", { cmd: "mouse_move_relative", dx, dy });
    } catch {}
  }, 50); // 20fps для джойстика
}

function _stopJoystickMove() {
  // Продолжаем тикать, только если активен тач
}

function _scStopJoystick() {
  clearInterval(_jMoveTimer);
  _jMoveTimer = null;
  scJoystickActive = false;
}

// ══ Цикл захвата (МАКСИМАЛЬНОЕ КАЧЕСТВО) ══
async function _scLoop() {
  const pingEl = document.getElementById("scPing");
  const hint   = document.getElementById("scHint");

  while (scActive) {
    const q = SC_QUALITY[scCurrentQuality] || SC_QUALITY.medium;
    const targetFps = q.fps;
    const frameMs = 1000 / targetFps;
    const t0 = Date.now();

    try {
      const res = await apiPost("/api/exec", {
        cmd: "screenshot_stream",
        quality: q.quality,
        width: q.w
      });

      if (!scActive) break;

      if (res?.ok && res.data?.b64) {
        const ping = Date.now() - t0;
        if (pingEl) pingEl.textContent = ping + " ms";
        if (hint && hint.style.display !== "none") hint.style.display = "none";

        if (res.data.w) scPcW = res.data.w;
        if (res.data.h) scPcH = res.data.h;

        const canvas = document.getElementById("scCanvas");
        const ctx = canvas?.getContext("2d");
        if (canvas && ctx) {
          await _scDrawFrame(canvas, ctx, res.data.b64, res.data.mime || "image/jpeg");
          scFpsCount++;
        }
      }
    } catch { if (!scActive) break; }

    const elapsed = Date.now() - t0;
    const wait = Math.max(0, frameMs - elapsed);
    if (wait > 0) await new Promise(r => setTimeout(r, wait));
  }
}

function _scDrawFrame(canvas, ctx, b64, mime) {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => {
      const wrap = document.getElementById("scCanvasWrap");
      const maxW = wrap?.clientWidth  || window.innerWidth;
      const maxH = wrap?.clientHeight || window.innerHeight;
      const ratio = Math.min(maxW / scPcW, maxH / scPcH);
      const dW = Math.floor(scPcW * ratio);
      const dH = Math.floor(scPcH * ratio);
      if (canvas.width !== dW || canvas.height !== dH) {
        canvas.width = dW; canvas.height = dH;
      }
      // imageSmoothingQuality = high для максимального качества
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.drawImage(img, 0, 0, dW, dH);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = "data:" + mime + ";base64," + b64;
  });
}

// ══ Canvas управление мышью ══
function _scSetupCanvas(canvas) {
  if (!canvas) return;
  const newC = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newC, canvas);
  const c = newC;

  function _coords(e) {
    const rect = c.getBoundingClientRect();
    const cx = e.touches ? e.touches[0].clientX : (e.clientX ?? 0);
    const cy = e.touches ? e.touches[0].clientY : (e.clientY ?? 0);
    return {
      x: Math.round(Math.max(0, Math.min(1, (cx - rect.left) / rect.width))  * scPcW),
      y: Math.round(Math.max(0, Math.min(1, (cy - rect.top)  / rect.height)) * scPcH),
    };
  }

  let held = false;
  let lastMoveT = 0;
  const MOVE_THROTTLE = 16; // ~60fps

  // ── Pointer ──
  c.addEventListener("pointerdown", async (e) => {
    // Если джойстик включён — не обрабатываем тач
    if (scJoystickEnabled && e.pointerType === "touch") return;
    e.preventDefault();
    c.setPointerCapture(e.pointerId);
    const { x, y } = _coords(e);
    let btn = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    held = true;
    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
      await apiPost("/api/exec", { cmd: "mouse_down", button: btn });
    } catch {}
  }, { passive: false });

  c.addEventListener("pointermove", async (e) => {
    if (scJoystickEnabled && e.pointerType === "touch") return;
    e.preventDefault();
    const now = Date.now();
    if (now - lastMoveT < MOVE_THROTTLE) return;
    lastMoveT = now;
    const { x, y } = _coords(e);
    try { await apiPost("/api/exec", { cmd: "mouse_move", x, y }); } catch {}
  }, { passive: false });

  c.addEventListener("pointerup", async (e) => {
    if (scJoystickEnabled && e.pointerType === "touch") return;
    e.preventDefault();
    let btn = e.button === 2 ? "right" : e.button === 1 ? "middle" : "left";
    if (held) {
      held = false;
      try { await apiPost("/api/exec", { cmd: "mouse_up", button: btn }); } catch {}
    }
  }, { passive: false });

  c.addEventListener("pointercancel", async () => {
    if (held) {
      held = false;
      try { await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); } catch {}
    }
  });

  c.addEventListener("contextmenu", async (e) => {
    e.preventDefault();
    const { x, y } = _coords(e);
    try {
      await apiPost("/api/exec", { cmd: "mouse_move", x, y });
      await apiPost("/api/exec", { cmd: "mouse_click", button: "right" });
    } catch {}
  });

  c.addEventListener("wheel", async (e) => {
    e.preventDefault();
    const dir = e.deltaY > 0 ? "down" : "up";
    try { await apiPost("/api/exec", { cmd: "mouse_scroll", direction: dir }); } catch {}
  }, { passive: false });

  // ── Touch (когда джойстик выключен) ──
  let touchT = 0, touchMoved = false;

  c.addEventListener("touchstart", async (e) => {
    if (scJoystickEnabled) return;
    e.preventDefault();
    touchT = Date.now(); touchMoved = false;
    const t = e.touches[0];
    const rect = c.getBoundingClientRect();
    const x = Math.round(((t.clientX - rect.left) / rect.width)  * scPcW);
    const y = Math.round(((t.clientY - rect.top)  / rect.height) * scPcH);
    held = true;
    try { await apiPost("/api/exec", { cmd: "mouse_move", x, y }); } catch {}
  }, { passive: false });

  c.addEventListener("touchmove", async (e) => {
    if (scJoystickEnabled) return;
    e.preventDefault();
    touchMoved = true;
    const now = Date.now();
    if (now - lastMoveT < MOVE_THROTTLE) return;
    lastMoveT = now;
    const t = e.touches[0];
    const rect = c.getBoundingClientRect();
    const x = Math.round(((t.clientX - rect.left) / rect.width)  * scPcW);
    const y = Math.round(((t.clientY - rect.top)  / rect.height) * scPcH);
    try { await apiPost("/api/exec", { cmd: "mouse_move", x, y }); } catch {}
  }, { passive: false });

  c.addEventListener("touchend", async (e) => {
    if (scJoystickEnabled) return;
    e.preventDefault();
    const dur = Date.now() - touchT;
    if (held) {
      held = false;
      if (dur < 300 && !touchMoved) {
        try { await apiPost("/api/exec", { cmd: "mouse_click", button: "left" }); } catch {}
      } else {
        try { await apiPost("/api/exec", { cmd: "mouse_up", button: "left" }); } catch {}
      }
    }
  }, { passive: false });
}

// ── Exports ──
window.openScreenControl  = openScreenControl;
window.closeScreenControl = closeScreenControl;
window.scToggleSettings   = scToggleSettings;
window.scSetQuality       = scSetQuality;
window.scToggleJoystick   = scToggleJoystick;
