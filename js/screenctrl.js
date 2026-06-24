// webapp/site/js/screenctrl.js
// ПОЛНАЯ ВЕРСИЯ с поворотом, высоким качеством и правильным подключением

let _scPlayer = null;
let _scVideo = null;
let _scActive = false;
let _scFpsCounter = 0;
let _scLastFpsTime = Date.now();
let _scFpsInterval = null;
let _scRotated = false;  // Состояние поворота

// ══════════════════════════════════════════════════════
//  Открытие оверлея трансляции
// ══════════════════════════════════════════════════════
async function openScreenControl() {
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';
  _scActive = true;

  // Находим или создаем video элемент
  _scVideo = document.getElementById('scVideo');
  if (!_scVideo) {
    const wrap = document.getElementById('scCanvasWrap');
    _scVideo = document.createElement('video');
    _scVideo.id = 'scVideo';
    _scVideo.autoplay = true;
    _scVideo.playsinline = true;
    _scVideo.muted = true;
    _scVideo.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      object-fit: contain;
      background: #000;
      display: none;
    `;
    wrap.appendChild(_scVideo);
  }

  _showScHint('🔌 Подключение…');
  _scVideo.style.display = 'none';

  // Применяем поворот по умолчанию (вертикально)
  _applyRotation(true);

  // Получаем WSS URL
  const wsUrl = await _getWsUrl();
  console.log('[SC] Connecting to:', wsUrl);
  
  _connectStream(wsUrl);
  _startFpsCounter();
}

// ══════════════════════════════════════════════════════
//  Получение WS URL с ожиданием туннеля
// ══════════════════════════════════════════════════════
async function _getWsUrl() {
  const apiBase = window._apiBase || '';
  
  // Пробуем несколько раз (туннель может еще запускаться)
  for (let attempt = 0; attempt < 10; attempt++) {
    try {
      const r = await fetch(apiBase + '/api/ws_url');
      const j = await r.json();
      
      if (j.ok && j.url && j.url.includes('wss://')) {
        console.log('[SC] Got WSS URL:', j.url);
        return j.url;
      }
      
      console.log(`[SC] WS URL not ready (attempt ${attempt + 1}), waiting...`);
      _showScHint(`⏳ Ожидание туннеля… (${attempt + 1}/10)`);
      
    } catch (e) {
      console.warn('[SC] Failed to get ws_url:', e);
    }
    
    // Ждем 2 секунды перед следующей попыткой
    await new Promise(r => setTimeout(r, 2000));
  }
  
  // Фолбэк
  console.warn('[SC] Using localhost fallback');
  return 'ws://127.0.0.1:8765';
}

// ══════════════════════════════════════════════════════
//  Подключение стрима
// ══════════════════════════════════════════════════════
function _connectStream(wsUrl) {
  if (_scPlayer) {
    _scPlayer.disconnect();
    _scPlayer = null;
  }

  _scPlayer = new WebRTCStreamPlayer(wsUrl, _scVideo, {
    onConnect: () => {
      _hideScHint();
      if (_scVideo) _scVideo.style.display = 'block';
      if (typeof toast === 'function') toast('✅', 'Трансляция подключена', 2000);
    },
    onDisconnect: () => {
      _showScHint('🔌 Отключено. Переподключение…');
      if (_scVideo) _scVideo.style.display = 'none';
      
      // Автопереподключение через 3 сек
      if (_scActive) {
        setTimeout(async () => {
          if (_scActive) {
            const wsUrl = await _getWsUrl();
            _connectStream(wsUrl);
          }
        }, 3000);
      }
    },
    onError: (e) => {
      console.error('[SC] Stream error:', e);
    }
  });

  _scPlayer.connect();
  _setupVideoInput();
}

// ══════════════════════════════════════════════════════
//  Закрытие
// ══════════════════════════════════════════════════════
function closeScreenControl() {
  _scActive = false;
  
  if (_scFpsInterval) {
    clearInterval(_scFpsInterval);
    _scFpsInterval = null;
  }
  
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'none';

  if (_scPlayer) {
    _scPlayer.disconnect();
    _scPlayer = null;
  }
  
  if (_scVideo) {
    _scVideo.srcObject = null;
    _scVideo.style.display = 'none';
  }
}

// ══════════════════════════════════════════════════════
//  ПОВОРОТ ВИДЕО
// ══════════════════════════════════════════════════════
function _applyRotation(rotated) {
  _scRotated = rotated;
  
  if (!_scVideo) return;
  
  const wrap = document.getElementById('scCanvasWrap');
  
  if (rotated) {
    // Поворачиваем на 90 градусов (горизонтальный экран ПК → вертикально на телефоне)
    _scVideo.style.cssText = `
      position: absolute;
      transform-origin: center center;
      transform: rotate(90deg);
      
      /* Меняем размеры чтобы заполнить экран после поворота */
      width: 100vh;
      height: 100vw;
      
      /* Центрируем */
      top: 50%;
      left: 50%;
      margin-top: -50vw;
      margin-left: -50vh;
      
      object-fit: contain;
      background: #000;
      display: block;
    `;
    
    if (wrap) wrap.style.overflow = 'hidden';
  } else {
    // Обычный режим
    _scVideo.style.cssText = `
      position: absolute;
      top: 0; left: 0;
      width: 100%; height: 100%;
      transform: none;
      object-fit: contain;
      background: #000;
      display: block;
    `;
  }
}

function scToggleRotation() {
  _applyRotation(!_scRotated);
  
  const btn = document.getElementById('scRotateBtn');
  if (btn) btn.textContent = _scRotated ? '📱↕' : '📱↔';
}

// ══════════════════════════════════════════════════════
//  Ввод с мыши/тачскрина
// ══════════════════════════════════════════════════════
function _setupVideoInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap) return;
  
  // Сбрасываем предыдущие обработчики
  const newWrap = wrap.cloneNode(true);
  wrap.parentNode.replaceChild(newWrap, wrap);
  
  // Переназначаем video элемент после замены DOM
  _scVideo = document.getElementById('scVideo');

  function toPC(clientX, clientY) {
    if (!_scVideo) return { x: 0, y: 0 };
    
    const rect = _scVideo.getBoundingClientRect();
    
    let rx = clientX - rect.left;
    let ry = clientY - rect.top;
    
    let pcX, pcY;
    
    if (_scRotated) {
      // При повороте на 90° координаты меняются местами
      // Нужно пересчитать с учетом трансформации
      const relX = rx / rect.width;
      const relY = ry / rect.height;
      
      // При повороте +90°: новый X = старый Y, новый Y = (1 - старый X)
      pcX = Math.round(relY * 1920);
      pcY = Math.round((1 - relX) * 1080);
    } else {
      pcX = Math.round((rx / rect.width) * 1920);
      pcY = Math.round((ry / rect.height) * 1080);
    }
    
    return {
      x: Math.max(0, Math.min(1920, pcX)),
      y: Math.max(0, Math.min(1080, pcY))
    };
  }

  // Mouse
  newWrap.addEventListener('mousemove', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_move', toPC(e.clientX, e.clientY));
  });

  newWrap.addEventListener('click', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'left' });
  });

  newWrap.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    if (!_scPlayer) return;
    _scPlayer.send('mouse_click', { ...toPC(e.clientX, e.clientY), button: 'right' });
  });

  // Touch
  let _lastTouch = null;
  let _touchTimer = null;

  newWrap.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const t = e.touches[0];
    _lastTouch = { x: t.clientX, y: t.clientY, time: Date.now() };
    
    // Долгое нажатие = правая кнопка
    _touchTimer = setTimeout(() => {
      if (_scPlayer && _lastTouch) {
        _scPlayer.send('mouse_click', { ...toPC(_lastTouch.x, _lastTouch.y), button: 'right' });
        if (navigator.vibrate) navigator.vibrate(30);
      }
    }, 600);
    
  }, { passive: false });

  newWrap.addEventListener('touchend', (e) => {
    e.preventDefault();
    clearTimeout(_touchTimer);
    
    if (!_lastTouch || !_scPlayer) return;
    
    const now = Date.now();
    const elapsed = now - _lastTouch.time;
    
    // Быстрый тап = левый клик
    if (elapsed < 500) {
      _scPlayer.send('mouse_click', { ...toPC(_lastTouch.x, _lastTouch.y), button: 'left' });
    }
    
    _lastTouch = null;
  }, { passive: false });

  newWrap.addEventListener('touchmove', (e) => {
    e.preventDefault();
    clearTimeout(_touchTimer);
    
    if (!_scPlayer) return;
    const t = e.touches[0];
    _lastTouch = { x: t.clientX, y: t.clientY, time: _lastTouch?.time || Date.now() };
    _scPlayer.send('mouse_move', toPC(t.clientX, t.clientY));
  }, { passive: false });

  newWrap.addEventListener('wheel', (e) => {
    if (!_scPlayer) return;
    _scPlayer.send('mouse_scroll', { delta: e.deltaY > 0 ? -3 : 3 });
  });
}

// ══════════════════════════════════════════════════════
//  Хинты
// ══════════════════════════════════════════════════════
function _showScHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  h.innerHTML = `<div style="font-size:32px;margin-bottom:10px">🖥</div><div>${text}</div>`;
}

function _hideScHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

// ══════════════════════════════════════════════════════
//  Настройки
// ══════════════════════════════════════════════════════
function scToggleSettings() {
  const p = document.getElementById('scSettingsPanel');
  if (p) p.style.display = p.style.display === 'none' ? 'block' : 'none';
}

function scSetQuality(val) {
  if (_scPlayer) {
    _scPlayer.send('set_quality', { quality: val });
  }
}

function scToggleJoystick(enabled) {
  const w = document.getElementById('scJoystickWrap');
  if (w) w.style.display = enabled ? 'flex' : 'none';
}

// ══════════════════════════════════════════════════════
//  FPS Counter
// ══════════════════════════════════════════════════════
function _startFpsCounter() {
  if (_scFpsInterval) clearInterval(_scFpsInterval);
  
  _scFpsCounter = 0;
  _scLastFpsTime = Date.now();
  
  _scFpsInterval = setInterval(() => {
    if (!_scActive) return;
    
    const now = Date.now();
    const elapsed = (now - _scLastFpsTime) / 1000;
    const fps = Math.round(_scFpsCounter / elapsed);
    
    const fpsEl = document.getElementById('scFps');
    if (fpsEl) fpsEl.textContent = `${fps} fps`;
    
    _scFpsCounter = 0;
    _scLastFpsTime = now;
  }, 1000);
}

// ══════════════════════════════════════════════════════
//  WebRTC Stream Player
// ══════════════════════════════════════════════════════
class WebRTCStreamPlayer {
  constructor(wsUrl, videoElement, callbacks = {}) {
    this.wsUrl = wsUrl;
    this.videoEl = videoElement;
    this.callbacks = callbacks;
    this.ws = null;
    this.pc = null;
    this._connected = false;
  }

  connect() {
    console.log('[WebRTC] Connecting to:', this.wsUrl);
    
    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch (e) {
      console.error('[WebRTC] Failed to create WebSocket:', e);
      this.callbacks.onError?.(e);
      return;
    }

    this.ws.onopen = () => {
      console.log('[WebRTC] WS connected, initializing PeerConnection...');
      this._initPeerConnection();
    };

    this.ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        console.log('[WebRTC] Message:', msg.type || msg);
        
        if (msg.type === 'answer') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg));
          console.log('[WebRTC] ✅ Remote description set');
        }
      } catch (e) {
        console.error('[WebRTC] Message error:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.error('[WebRTC] WS error:', e);
      this.callbacks.onError?.(e);
    };

    this.ws.onclose = (e) => {
      console.log('[WebRTC] WS closed:', e.code, e.reason);
      this.disconnect();
      this.callbacks.onDisconnect?.();
    };
  }

  async _initPeerConnection() {
    this.pc = new RTCPeerConnection({
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' },
        { urls: 'stun:stun1.l.google.com:19302' }
      ]
    });

    // Получение видеотрека
    this.pc.ontrack = (event) => {
      console.log('[WebRTC] ✅ Track received!', event.track.kind);
      
      if (event.streams && event.streams[0]) {
        if (this.videoEl) {
          this.videoEl.srcObject = event.streams[0];
          
          this.videoEl.onloadedmetadata = () => {
            this.videoEl.play().then(() => {
              console.log('[WebRTC] ✅ Video playing!');
              this._connected = true;
              this.callbacks.onConnect?.();
            }).catch(e => {
              console.error('[WebRTC] Play error:', e);
            });
          };
        }
      }
    };

    // ICE candidates
    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate generated');
      }
    };

    this.pc.oniceconnectionstatechange = () => {
      console.log('[WebRTC] ICE state:', this.pc.iceConnectionState);
      
      if (this.pc.iceConnectionState === 'connected' || 
          this.pc.iceConnectionState === 'completed') {
        if (!this._connected) {
          this._connected = true;
          this.callbacks.onConnect?.();
        }
      }
      
      if (this.pc.iceConnectionState === 'failed' ||
          this.pc.iceConnectionState === 'disconnected') {
        console.warn('[WebRTC] ICE failed/disconnected');
        this.callbacks.onDisconnect?.();
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
    };

    // Указываем что хотим только получать видео
    this.pc.addTransceiver('video', { direction: 'recvonly' });

    // Создаем Offer с настройками качества
    const offer = await this.pc.createOffer({
      offerToReceiveVideo: true,
      offerToReceiveAudio: false
    });
    
    await this.pc.setLocalDescription(offer);
    
    console.log('[WebRTC] Sending offer...');
    this.ws.send(JSON.stringify({
      type: offer.type,
      sdp: offer.sdp
    }));
  }

  send(cmd, data = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, ...data }));
    }
  }

  disconnect() {
    this._connected = false;
    
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    
    if (this.ws && this.ws.readyState !== WebSocket.CLOSED) {
      this.ws.close();
      this.ws = null;
    }
    
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }
}

window.WebRTCStreamPlayer = WebRTCStreamPlayer;
