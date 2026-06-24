let _scPlayer  = null;
let _scVideo   = null;
let _scActive  = false;

// ── Открытие оверлея ──────────────────────────────────
async function openScreenControl() {
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';
  _scActive = true;

  // Инициализируем видео-элемент
  _scVideo = document.getElementById('scVideo');
  
  _showScHint('🔌 Установка WebRTC соединения…');
  if (_scVideo) _scVideo.style.display = 'none';

  // Получаем WSS URL от сервера через API
  let wsUrl = null;
  try {
    const apiBase = window._apiBase || '';
    const r = await fetch(apiBase + '/api/ws_url');
    const j = await r.json();
    if (j.ok && j.url) {
      wsUrl = j.url;
    }
  } catch(e) {
    console.warn('[SC] Не удалось получить ws_url:', e);
  }

  // Фолбэк на localhost, если туннель не вернул адрес
  if (!wsUrl) {
    wsUrl = 'ws://127.0.0.1:8765';
    console.warn('[SC] Используем локальный адрес WS:', wsUrl);
  }

  console.log('[SC] Connecting via WebRTC to:', wsUrl);
  _connectStream(wsUrl);
}

// ── Подключение WebRTC потока ──────────────────────────
function _connectStream(wsUrl) {
  if (_scPlayer) {
    _scPlayer.disconnect();
    _scPlayer = null;
  }

  // Создаем экземпляр нашего H.264 WebRTC плеера
  _scPlayer = new WebRTCStreamPlayer(wsUrl, _scVideo, {
    onConnect: () => { 
      _hideScHint(); 
      if (_scVideo) _scVideo.style.display = 'block';
      if (typeof toast === 'function') toast('✅', 'Трансляция подключена', 2000); 
    },
    onDisconnect: () => { 
      _showScHint('🔌 Отключено от ПК'); 
      if (_scVideo) _scVideo.style.display = 'none';
    }
  });

  _scPlayer.connect();
  _setupVideoInput();
}

// ── Закрытие оверлея ──────────────────────────────────
function closeScreenControl() {
  _scActive = false;
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'none';

  if (_scPlayer) {
    _scPlayer.disconnect();
    _scPlayer = null;
  }
  if (_scVideo) {
    _scVideo.style.display = 'none';
  }
}

// ── Хинты состояния ───────────────────────────────────
function _showScHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  const lines = h.querySelectorAll('div,span');
  if (lines.length > 1) lines[1].textContent = text;
  else h.textContent = text;
}

function _hideScHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

// ── Ввод координат с адаптацией под размер видео ──────
function _setupVideoInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap || wrap._scInputBound) return;
  wrap._scInputBound = true;

  // Конвертирует клики по экрану телефона в реальное разрешение монитора ПК
  function toPC(clientX, clientY) {
    const rect = _scVideo.getBoundingClientRect();
    const rx = clientX - rect.left;
    const ry = clientY - rect.top;
    
    // Базовое разрешение твоего монитора для интерполяции (например, Full HD)
    const pcWidth = 1920; 
    const pcHeight = 1080;

    const px = Math.round((rx / rect.width) * pcWidth);
    const py = Math.round((ry / rect.height) * pcHeight);
    
    // Ограничиваем координаты границами экрана на всякий случай
    return { 
      x: Math.max(0, Math.min(pcWidth, px)), 
      y: Math.max(0, Math.min(pcHeight, py)) 
    };
  }

  // Мышь
  wrap.addEventListener('mousemove', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_move', toPC(e.clientX, e.clientY));
  });

  wrap.addEventListener('click', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'left' });
  });

  wrap.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!_scPlayer) return;
    _scPlayer.send('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'right' });
  });

  // Тач-события для мобилок
  wrap.addEventListener('touchstart', (e) => {
    e.preventDefault();
    if (!_scPlayer) return;
    const t = e.touches[0];
    _scPlayer.send('mouse_click', { ...toPC(t.clientX, t.clientY), button: 'left' });
  }, { passive: false });

  wrap.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (!_scPlayer) return;
    const t = e.touches[0];
    _scPlayer.send('mouse_move', toPC(t.clientX, t.clientY));
  }, { passive: false });

  wrap.addEventListener('wheel', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_scroll', { delta: e.deltaY > 0 ? -3 : 3 });
  });
}

function scToggleSettings() {
  const p = document.getElementById('scSettingsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function scToggleJoystick(enabled) {
  const w = document.getElementById('scJoystickWrap');
  if (w) w.style.display = enabled ? 'flex' : 'none';
}

function scSetQuality(val) {
  if (_scPlayer) {
    _scPlayer.send('set_quality', { quality: val });
  }
}
