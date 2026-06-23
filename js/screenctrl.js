// ══════════════════════════════════════════════════════
//  Screen Control — FULLSCREEN PORTRAIT MODE
// ══════════════════════════════════════════════════════

let _player = null;
let _canvas = null;
let _ctx = null;
let _active = false;
let _pcW = 1280;
let _pcH = 720;

async function openScreenControl() {
  _active = true;

  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';

  // Полноэкранный режим + портретная ориентация
  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '99999';

  _canvas = document.getElementById('scCanvas');
  _ctx = _canvas.getContext('2d', { alpha: false, desynchronized: true });

  _showHint('🔌 Подключение...');
  _updateStatus('connecting');

  // Получение WSS URL
  let wsUrl = null;
  try {
    const base = window._apiBase || '';
    const r = await fetch(base + '/api/ws_url', {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache' }
    });
    const j = await r.json();
    if (j.ok && j.url && j.url.startsWith('wss://')) {
      wsUrl = j.url;
    }
  } catch (e) {
    console.warn('[SC] API error:', e);
  }

  if (!wsUrl) {
    _showHint('❌ Не удалось получить URL туннеля\n\nПерезапустите бота');
    return;
  }

  console.log('[SC] WSS URL:', wsUrl);
  _startPlayer(wsUrl);
  _bindInput();
  _requestFullscreen();
}

function _requestFullscreen() {
  const overlay = document.getElementById('screenCtrlOverlay');
  if (!overlay) return;

  try {
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen();
    } else if (overlay.webkitRequestFullscreen) {
      overlay.webkitRequestFullscreen();
    } else if (overlay.mozRequestFullScreen) {
      overlay.mozRequestFullScreen();
    } else if (overlay.msRequestFullscreen) {
      overlay.msRequestFullscreen();
    }

    // Блокируем ориентацию в портретный режим
    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {
    console.warn('[SC] Fullscreen error:', e);
  }
}

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

      // Отправляем команду установки качества
      _player.send('set_quality', { quality: 'low' });
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

      // Поворачиваем canvas на 90 градусов (альбомный → портретный)
      _canvas.width = h;
      _canvas.height = w;

      _ctx.save();
      _ctx.translate(_canvas.width / 2, _canvas.height / 2);
      _ctx.rotate(Math.PI / 2);
      _ctx.drawImage(bitmap, -w / 2, -h / 2, w, h);
      _ctx.restore();
    },

    onFps(fps) {
      const el = document.getElementById('scFps');
      if (el) el.textContent = fps + ' fps';
    },

    onConfig(cfg) {
      _pcW = cfg.width || 1280;
      _pcH = cfg.height || 720;
    },
  });

  _player.connect();
}

function closeScreenControl() {
  _active = false;

  // Выход из полноэкранного режима
  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    } else if (document.mozFullScreenElement) {
      document.mozCancelFullScreen();
    } else if (document.msFullscreenElement) {
      document.msExitFullscreen();
    }

    // Разблокируем ориентацию
    if (screen.orientation && screen.orientation.unlock) {
      screen.orientation.unlock();
    }
  } catch (e) {}

  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'none';

  if (_player) {
    _player.disconnect();
    _player = null;
  }

  _updateStatus('off');
}

function _bindInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap || wrap._bound) return;
  wrap._bound = true;

  function toPC(cx, cy) {
    const r = _canvas.getBoundingClientRect();
    
    // Учитываем поворот на 90 градусов
    const rx = cx - r.left;
    const ry = cy - r.top;

    // Инверсия координат из-за поворота
    const px = Math.round((r.height - ry) / r.height * _pcW);
    const py = Math.round(rx / r.width * _pcH);

    return { x: px, y: py };
  }

  // Тач (телефон)
  let lastTouch = null;
  let touchTimer = null;

  wrap.addEventListener('touchstart', e => {
    e.preventDefault();
    const t = e.touches[0];
    lastTouch = t;
    const p = toPC(t.clientX, t.clientY);

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

  // Мышь (ПК)
  wrap.addEventListener('mousedown', e => {
    const p = toPC(e.clientX, e.clientY);
    const btn = e.button === 2 ? 'right' : 'left';
    _player?.send('mouse_click', { ...p, button: btn });
  });

  wrap.addEventListener('mousemove', e => {
    const p = toPC(e.clientX, e.clientY);
    _player?.send('mouse_move', p);
  });

  wrap.addEventListener('contextmenu', e => {
    e.preventDefault();
  });
}

function _showHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  h.innerHTML = `<div style="font-size:36px;margin-bottom:12px">🖥</div>${text}`;
}

function _hideHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

function _updateStatus(state) {
  const fps = document.getElementById('scFps');
  const ping = document.getElementById('scPing');
  if (state === 'live') {
    if (fps) fps.style.color = '#4ade80';
    if (ping) ping.style.color = '#4ade80';
  } else {
    if (fps) fps.style.color = '#888';
    if (ping) ping.style.color = '#888';
    if (fps) fps.textContent = '— fps';
    if (ping) ping.textContent = '— ms';
  }
}

function scToggleSettings() {
  const p = document.getElementById('scSettingsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function scSetQuality(val) {
  if (_player) {
    _player.send('set_quality', { quality: val });
    toast('⚙️', `Качество: ${val}`, 2000);
  }
}

function scToggleJoystick() {
  // Убрали джойстик
}
