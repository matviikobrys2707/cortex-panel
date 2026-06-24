// webapp/site/js/screenctrl.js
// MJPEG версия — максимальное качество через FFmpeg NVENC

let _scActive   = false;
let _scImg      = null;
let _scRotated  = true;   // По умолчанию повернуто (телефон)
let _scApiBase  = '';
let _scFpsTimer = null;
let _scFrames   = 0;
let _scQuality  = 'medium';

// ══════════════════════════════════════════════════════
//  Открытие трансляции
// ══════════════════════════════════════════════════════
async function openScreenControl() {
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';
  _scActive  = true;
  _scApiBase = window._apiBase || '';

  _showScHint('🔌 Подключение к FFmpeg NVENC…');
  _startStream();
  _startFpsCounter();
  _setupInput();
}

// ══════════════════════════════════════════════════════
//  Запуск MJPEG стрима
// ══════════════════════════════════════════════════════
function _startStream() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap) return;

  // Удаляем старый img если есть
  if (_scImg) {
    _scImg.remove();
    _scImg = null;
  }

  // Создаем img элемент для MJPEG
  _scImg = document.createElement('img');
  _scImg.id  = 'scMjpeg';
  _scImg.alt = 'Screen';

  // Применяем поворот сразу
  _applyRotation(_scRotated, false);

  _scImg.onload = () => {
    _hideScHint();
    _scFrames++;
  };

  _scImg.onerror = () => {
    if (!_scActive) return;
    _showScHint('❌ Ошибка подключения. Переподключение…');
    setTimeout(() => {
      if (_scActive) _startStream();
    }, 2000);
  };

  wrap.appendChild(_scImg);

  // Подключаем MJPEG стрим
  // Добавляем timestamp чтобы браузер не кешировал
  const streamUrl = `${_scApiBase}/api/stream?t=${Date.now()}`;
  _scImg.src = streamUrl;

  console.log('[SC] MJPEG stream:', streamUrl);
}

// ══════════════════════════════════════════════════════
//  Закрытие
// ══════════════════════════════════════════════════════
function closeScreenControl() {
  _scActive = false;

  if (_scFpsTimer) {
    clearInterval(_scFpsTimer);
    _scFpsTimer = null;
  }

  // Останавливаем стрим (убираем src)
  if (_scImg) {
    _scImg.src = '';
    _scImg.remove();
    _scImg = null;
  }

  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'none';
}

// ══════════════════════════════════════════════════════
//  Поворот изображения
// ══════════════════════════════════════════════════════
function _applyRotation(rotated, restart) {
  _scRotated = rotated;

  if (!_scImg) return;

  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap) return;

  if (rotated) {
    // Поворот 90° — горизонтальный экран ПК в вертикальный телефон
    const vw = wrap.clientWidth;
    const vh = wrap.clientHeight;

    _scImg.style.cssText = `
      position: absolute;
      transform-origin: center center;
      transform: rotate(90deg);
      width: ${vh}px;
      height: ${vw}px;
      top: ${(vh - vw) / 2}px;
      left: ${(vw - vh) / 2}px;
      object-fit: contain;
      display: block;
      image-rendering: crisp-edges;
    `;
  } else {
    _scImg.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      transform: none;
      object-fit: contain;
      display: block;
      image-rendering: crisp-edges;
    `;
  }

  // Пересоздаем стрим при смене поворота
  if (restart && _scActive) {
    _startStream();
  }
}

function scToggleRotation() {
  _applyRotation(!_scRotated, false);
  const btn = document.getElementById('scRotateBtn');
  if (btn) btn.textContent = _scRotated ? '📱↕' : '📱↔';
  
  // Обновляем чекбокс в настройках
  const cb = document.getElementById('scRotateCheck');
  if (cb) cb.checked = _scRotated;
}

// ══════════════════════════════════════════════════════
//  Управление мышью
// ══════════════════════════════════════════════════════
function _setupInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap) return;

  // Пересоздаем wrap чтобы убрать старые обработчики
  const clone = wrap.cloneNode(false); // false = без детей
  // Переносим детей
  while (wrap.firstChild) clone.appendChild(wrap.firstChild);
  wrap.parentNode.replaceChild(clone, wrap);

  function toPC(clientX, clientY) {
    const el = _scImg;
    if (!el) return { x: 0, y: 0 };

    const rect = el.getBoundingClientRect();
    let rx = clientX - rect.left;
    let ry = clientY - rect.top;
    let pcX, pcY;

    if (_scRotated) {
      // При повороте +90° координаты меняются
      const relX = rx / rect.width;
      const relY = ry / rect.height;
      pcX = Math.round(relY * 1920);
      pcY = Math.round((1 - relX) * 1080);
    } else {
      pcX = Math.round((rx / rect.width)  * 1920);
      pcY = Math.round((ry / rect.height) * 1080);
    }

    return {
      x: Math.max(0, Math.min(1920, pcX)),
      y: Math.max(0, Math.min(1080, pcY))
    };
  }

  function sendMouse(cmd, data) {
    if (!_scApiBase && !window._apiBase) return;
    const base = window._apiBase || _scApiBase;

    fetch(base + '/api/exec', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tg-Init-Data': window._initData || ''
      },
      body: JSON.stringify({ cmd, ...data })
    }).catch(() => {});
  }

  // ── Мышь ──
  clone.addEventListener('mousemove', (e) => {
    sendMouse('mouse_move', toPC(e.clientX, e.clientY));
  });

  clone.addEventListener('click', (e) => {
    sendMouse('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'left' });
  });

  clone.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    sendMouse('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'right' });
  });

  clone.addEventListener('wheel', (e) => {
    e.preventDefault();
    sendMouse('mouse_scroll', { direction: e.deltaY > 0 ? 'down' : 'up' });
  }, { passive: false });

  // ── Тач ──
  let _touchStart = null;
  let _longTapTimer = null;
  let _moved = false;

  clone.addEventListener('touchstart', (e) => {
    e.preventDefault();
    _moved = false;
    const t = e.touches[0];
    _touchStart = { x: t.clientX, y: t.clientY, time: Date.now() };

    // Долгое нажатие = ПКМ
    _longTapTimer = setTimeout(() => {
      if (!_moved) {
        sendMouse('mouse_click', { ...toPC(t.clientX, t.clientY), button: 'right' });
        if (navigator.vibrate) navigator.vibrate([30, 10, 30]);
      }
    }, 600);

  }, { passive: false });

  clone.addEventListener('touchmove', (e) => {
    e.preventDefault();
    _moved = true;
    clearTimeout(_longTapTimer);

    const t = e.touches[0];
    sendMouse('mouse_move', toPC(t.clientX, t.clientY));
  }, { passive: false });

  clone.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(_longTapTimer);

    if (!_touchStart || _moved) return;

    const elapsed = Date.now() - _touchStart.time;
    if (elapsed < 500) {
      // Быстрый тап = ЛКМ
      sendMouse('mouse_click', {
        ...toPC(_touchStart.x, _touchStart.y),
        button: 'left'
      });
    }
    _touchStart = null;
  }, { passive: false });

  // ── Двойной тап = двойной клик ──
  let _lastTap = 0;
  clone.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - _lastTap < 300 && !_moved) {
      // Двойной тап
      const t = e.changedTouches[0];
      sendMouse('mouse_click', { ...toPC(t.clientX, t.clientY), button: 'left' });
      sendMouse('mouse_click', { ...toPC(t.clientX, t.clientY), button: 'left' });
    }
    _lastTap = now;
  }, { passive: false });
}

// ══════════════════════════════════════════════════════
//  FPS счетчик
// ══════════════════════════════════════════════════════
function _startFpsCounter() {
  if (_scFpsTimer) clearInterval(_scFpsTimer);

  _scFrames = 0;
  let lastTime = Date.now();

  _scFpsTimer = setInterval(() => {
    if (!_scActive) return;

    const now     = Date.now();
    const elapsed = (now - lastTime) / 1000;
    const fps     = Math.round(_scFrames / elapsed);

    const el = document.getElementById('scFps');
    if (el) el.textContent = `${fps} fps`;

    // Цвет FPS
    if (el) {
      el.style.color = fps >= 25 ? '#4ade80' : fps >= 15 ? '#fbbf24' : '#f87171';
    }

    _scFrames = 0;
    lastTime  = now;

    // Считаем реальный FPS через img
    if (_scImg) {
      const observer = new IntersectionObserver(() => {});
      observer.observe(_scImg);
      observer.disconnect();
    }
  }, 1000);

  // Считаем загрузки изображения
  if (_scImg) {
    _scImg.addEventListener('load', () => _scFrames++);
  }
}

// ══════════════════════════════════════════════════════
//  Настройки
// ══════════════════════════════════════════════════════
function scToggleSettings() {
  const p = document.getElementById('scSettingsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

async function scSetQuality(val) {
  _scQuality = val;

  const base = window._apiBase || _scApiBase;
  try {
    await fetch(base + '/api/stream/quality', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Tg-Init-Data': window._initData || ''
      },
      body: JSON.stringify({ quality: val })
    });
  } catch (e) {
    console.error('Quality change error:', e);
  }

  if (typeof toast === 'function') {
    const labels = { high: '60 FPS', medium: '30 FPS', low: '15 FPS' };
    toast('⚙️', `Качество: ${labels[val] || val}`, 2000);
  }
}

// ══════════════════════════════════════════════════════
//  Хинты
// ══════════════════════════════════════════════════════
function _showScHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  h.innerHTML = `
    <div style="font-size:40px;margin-bottom:12px">🖥</div>
    <div style="text-align:center;padding:0 20px">${text}</div>
  `;
}

function _hideScHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

function scToggleJoystick(e) {}  // Заглушка для совместимости
