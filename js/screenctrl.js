// ══════════════════════════════════════════════════════
//  Screen Control — Ручной ввод WSS URL (сохраняется)
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

  overlay.style.position = 'fixed';
  overlay.style.top = '0';
  overlay.style.left = '0';
  overlay.style.width = '100%';
  overlay.style.height = '100%';
  overlay.style.zIndex = '99999';

  _canvas = document.getElementById('scCanvas');
  _ctx = _canvas.getContext('2d', { alpha: false, desynchronized: true });

  _showHint('🔌 Получение URL...');
  _updateStatus('connecting');

  // Получаем WSS URL
  let wsUrl = await _getWssUrl();

  if (!wsUrl) {
    _showHint('❌ Не удалось подключиться');
    closeScreenControl();
    return;
  }

  console.log('[SC] WSS URL:', wsUrl);
  _startPlayer(wsUrl);
  _bindInput();
  _requestFullscreen();
}

// ══════════════════════════════════════════════════════
//  Получение WSS URL — с вводом вручную
// ══════════════════════════════════════════════════════

async function _getWssUrl() {
  // 1. Проверяем localStorage
  let saved = localStorage.getItem('cortex_wss_url');
  if (saved && saved.startsWith('wss://')) {
    console.log('[SC] WSS из localStorage:', saved);
    
    // Проверяем что URL рабочий
    if (await _testWssUrl(saved)) {
      return saved;
    } else {
      console.warn('[SC] Сохранённый URL не работает');
      localStorage.removeItem('cortex_wss_url');
    }
  }

  // 2. Пробуем получить через API (если не GitHub Pages)
  try {
    const base = window._apiBase || '';
    if (base && !base.includes('github')) {
      const r = await fetch(base + '/api/ws_url', {
        cache: 'no-store',
        headers: { 'Cache-Control': 'no-cache' }
      });
      const j = await r.json();
      if (j.ok && j.url && j.url.startsWith('wss://')) {
        localStorage.setItem('cortex_wss_url', j.url);
        return j.url;
      }
    }
  } catch(e) {
    console.warn('[SC] API недоступен:', e);
  }

  // 3. Запрашиваем у пользователя
  return await _promptWssUrl();
}

async function _promptWssUrl() {
  return new Promise((resolve) => {
    // Создаём модальное окно для ввода
    const modal = document.createElement('div');
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0,0,0,0.95);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 999999;
      padding: 20px;
      box-sizing: border-box;
    `;

    modal.innerHTML = `
      <div style="
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        padding: 30px;
        border-radius: 16px;
        max-width: 500px;
        width: 100%;
        box-shadow: 0 20px 60px rgba(0,0,0,0.5);
      ">
        <h2 style="
          margin: 0 0 20px 0;
          color: white;
          font-size: 24px;
          text-align: center;
        ">🔗 Введите WSS URL</h2>
        
        <p style="
          color: rgba(255,255,255,0.9);
          font-size: 14px;
          margin-bottom: 20px;
          line-height: 1.5;
        ">
          Запустите бота на ПК и скопируйте строку из консоли:<br>
          <code style="background:rgba(0,0,0,0.3);padding:4px 8px;border-radius:4px;display:inline-block;margin-top:8px;">
            [WS Tunnel] ✅ wss://...
          </code>
        </p>

        <input 
          type="text" 
          id="wssInput" 
          placeholder="wss://example.trycloudflare.com"
          style="
            width: 100%;
            padding: 14px;
            border: 2px solid rgba(255,255,255,0.3);
            border-radius: 8px;
            background: rgba(255,255,255,0.15);
            color: white;
            font-size: 14px;
            box-sizing: border-box;
            margin-bottom: 16px;
            font-family: monospace;
          "
        />

        <div style="display:flex;gap:12px;">
          <button id="wssSubmit" style="
            flex: 1;
            padding: 14px;
            background: linear-gradient(135deg, #11998e 0%, #38ef7d 100%);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 4px 15px rgba(56,239,125,0.3);
          ">✓ Подключиться</button>
          
          <button id="wssCancel" style="
            flex: 1;
            padding: 14px;
            background: rgba(255,255,255,0.2);
            color: white;
            border: none;
            border-radius: 8px;
            font-size: 16px;
            font-weight: 600;
            cursor: pointer;
          ">✕ Отмена</button>
        </div>

        <div id="wssError" style="
          color: #ff6b6b;
          font-size: 13px;
          margin-top: 12px;
          text-align: center;
          display: none;
        "></div>
      </div>
    `;

    document.body.appendChild(modal);

    const input = modal.querySelector('#wssInput');
    const submit = modal.querySelector('#wssSubmit');
    const cancel = modal.querySelector('#wssCancel');
    const error = modal.querySelector('#wssError');

    // Автофокус
    setTimeout(() => input.focus(), 100);

    // Enter = submit
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submit.click();
    });

    submit.addEventListener('click', async () => {
      const url = input.value.trim();

      if (!url) {
        error.textContent = '⚠️ Введите URL';
        error.style.display = 'block';
        return;
      }

      if (!url.startsWith('wss://')) {
        error.textContent = '⚠️ URL должен начинаться с wss://';
        error.style.display = 'block';
        return;
      }

      // Проверка подключения
      submit.disabled = true;
      submit.textContent = '⏳ Проверка...';

      const ok = await _testWssUrl(url);

      if (ok) {
        localStorage.setItem('cortex_wss_url', url);
        document.body.removeChild(modal);
        resolve(url);
      } else {
        submit.disabled = false;
        submit.textContent = '✓ Подключиться';
        error.textContent = '❌ Не удалось подключиться к этому URL';
        error.style.display = 'block';
      }
    });

    cancel.addEventListener('click', () => {
      document.body.removeChild(modal);
      resolve(null);
    });
  });
}

async function _testWssUrl(url) {
  return new Promise((resolve) => {
    try {
      const ws = new WebSocket(url);
      const timeout = setTimeout(() => {
        ws.close();
        resolve(false);
      }, 5000);

      ws.onopen = () => {
        clearTimeout(timeout);
        ws.close();
        resolve(true);
      };

      ws.onerror = () => {
        clearTimeout(timeout);
        resolve(false);
      };
    } catch(e) {
      resolve(false);
    }
  });
}

// ══════════════════════════════════════════════════════
//  Остальной код (без изменений)
// ══════════════════════════════════════════════════════

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
    }

    if (screen.orientation && screen.orientation.lock) {
      screen.orientation.lock('portrait').catch(() => {});
    }
  } catch (e) {}
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

  try {
    if (document.fullscreenElement) {
      document.exitFullscreen();
    } else if (document.webkitFullscreenElement) {
      document.webkitExitFullscreen();
    }

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
    const rx = cx - r.left;
    const ry = cy - r.top;
    const px = Math.round((r.height - ry) / r.height * _pcW);
    const py = Math.round(rx / r.width * _pcH);
    return { x: px, y: py };
  }

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

function scToggleJoystick() {}

// ══════════════════════════════════════════════════════
//  Сброс сохранённого URL (для разработки)
// ══════════════════════════════════════════════════════
function scResetUrl() {
  localStorage.removeItem('cortex_wss_url');
  toast('🔄', 'URL сброшен', 2000);
}
