// ══════════════════════════════════════════════════════
//  Screen Control
// ══════════════════════════════════════════════════════

let _player  = null;
let _canvas  = null;
let _ctx     = null;
let _active  = false;
let _pcW     = 1280;
let _pcH     = 720;

// ── Открыть ───────────────────────────────────────────
async function openScreenControl() {
  _active = true;

  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';

  _canvas = document.getElementById('scCanvas');
  _ctx    = _canvas.getContext('2d', { alpha: false });

  _showHint('🔌 Подключение…');
  _updateStatus('connecting');

  // Получаем WSS URL
  const wsUrl = await _getWsUrl();
  console.log('[SC] wsUrl =', wsUrl);

  if (!wsUrl) {
    _showHint('❌ Туннель не готов\nПодожди 10 сек и попробуй снова');
    return;
  }

  _startPlayer(wsUrl);
  _bindInput();
}

// ── Получить WSS URL с сервера ────────────────────────
async function _getWsUrl() {
  // Пробуем до 10 раз с паузой (туннель может стартовать медленно)
  for (let i = 0; i < 10; i++) {
    try {
      const base = window._apiBase || '';
      const r    = await fetch(base + '/api/ws_url', { cache: 'no-store' });
      const j    = await r.json();
      if (j.ok && j.url) return j.url;
    } catch(e) {
      console.warn('[SC] ws_url fetch err:', e);
    }
    await new Promise(r => setTimeout(r, 1500));
  }
  return null;
}

// ── Запустить плеер ───────────────────────────────────
function _startPlayer(wsUrl) {
  if (_player) {
    _player.disconnect();
    _player = null;
  }

  _player = new MJPEGPlayer(wsUrl, {
    onConnect() {
      _hideHint();
      _updateStatus('live');
      toast('✅', 'Трансляция идёт', 2000);
    },

    onDisconnect() {
      _showHint('🔄 Переподключение…');
      _updateStatus('connecting');
    },

    onError(e) {
      _showHint('❌ Ошибка подключения');
      _updateStatus('error');
    },

    onFrame(bitmap, w, h) {
      _pcW = w;
      _pcH = h;
      if (_canvas.width !== w || _canvas.height !== h) {
        _canvas.width  = w;
        _canvas.height = h;
      }
      _ctx.drawImage(bitmap, 0, 0);
    },

    onFps(fps) {
      const el = document.getElementById('scFps');
      if (el) el.textContent = fps + ' fps';
    },

    onConfig(cfg) {
      _pcW = cfg.width  || 1280;
      _pcH = cfg.height || 720;
    },
  });

  _player.connect();
}

// ── Закрыть ───────────────────────────────────────────
function closeScreenControl() {
  _active = false;
  document.getElementById('screenCtrlOverlay').style.display = 'none';

  if (_player) {
    _player.disconnect();
    _player = null;
  }

  _updateStatus('off');
}

// ── Ввод: мышь + тач ─────────────────────────────────
function _bindInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap || wrap._bound) return;
  wrap._bound = true;

  function toPC(cx, cy) {
    const r  = _canvas.getBoundingClientRect();
    const x  = Math.round((cx - r.left) / r.width  * _pcW);
    const y  = Math.round((cy - r.top)  / r.height * _pcH);
    return { x, y };
  }

  // ── Мышь ──
  let mouseDown = false;

  wrap.addEventListener('mousedown', e => {
    mouseDown = true;
    const p   = toPC(e.clientX, e.clientY);
    const btn = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    _player?.send('mouse_down', { ...p, button: btn });
  });

  wrap.addEventListener('mouseup', e => {
    mouseDown = false;
    const p   = toPC(e.clientX, e.clientY);
    const btn = e.button === 2 ? 'right' : e.button === 1 ? 'middle' : 'left';
    _player?.send('mouse_up', { ...p, button: btn });
    _player?.send('mouse_click', { ...p, button: btn });
  });

  wrap.addEventListener('mousemove', e => {
    const p = toPC(e.clientX, e.clientY);
    _player?.send('mouse_move', p);
  });

  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
  });

  wrap.addEventListener('wheel', e => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -3 : 3;
    _player?.send('mouse_scroll', { delta });
  }, { passive: false });

  // ── Тач ──
  let lastTouch = null;
  let touchTimer = null;

  wrap.addEventListener('touchstart', e => {
    e.preventDefault();
    const t  = e.touches[0];
    lastTouch = t;
    const p  = toPC(t.clientX, t.clientY);

    // Долгий тап = ПКМ
    touchTimer = setTimeout(() => {
      _player?.send('mouse_click', { ...p, button: 'right' });
      touchTimer = null;
    }, 500);

    _player?.send('mouse_move', p);
  }, { passive: false });

  wrap.addEventListener('touchend', e => {
    e.preventDefault();
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
      // Короткий тап = ЛКМ
      if (lastTouch) {
        const p = toPC(lastTouch.clientX, lastTouch.clientY);
        _player?.send('mouse_click', { ...p, button: 'left' });
      }
    }
    lastTouch = null;
  }, { passive: false });

  wrap.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    lastTouch = t;
    if (touchTimer) {
      clearTimeout(touchTimer);
      touchTimer = null;
    }
    const p = toPC(t.clientX, t.clientY);
    _player?.send('mouse_move', p);
  }, { passive: false });
}

// ── UI helpers ────────────────────────────────────────
function _showHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  h.innerHTML = `<div style="font-size:36px;margin-bottom:8px">🖥</div><div>${text}</div>`;
}

function _hideHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

function _updateStatus(state) {
  // state: 'connecting' | 'live' | 'error' | 'off'
  const fps  = document.getElementById('scFps');
  const ping = document.getElementById('scPing');
  if (state === 'live') {
    if (fps)  fps.style.color  = '#4ade80';
    if (ping) ping.style.color = '#4ade80';
  } else {
    if (fps)  fps.style.color  = '#888';
    if (ping) ping.style.color = '#888';
    if (fps)  fps.textContent  = '— fps';
    if (ping) ping.textContent = '— ms';
  }
}

// ── Настройки ─────────────────────────────────────────
function scToggleSettings() {
  const p = document.getElementById('scSettingsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function scToggleJoystick(on) {
  const w = document.getElementById('scJoystickWrap');
  if (w) w.style.display = on ? 'flex' : 'none';
}

function scSetQuality(val) {
  // TODO: отправить на сервер новый quality
  console.log('[SC] quality:', val);
}
