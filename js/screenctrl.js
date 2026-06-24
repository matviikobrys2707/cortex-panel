// webapp/site/js/screenctrl.js

let _scPlayer = null;
let _scVideo = null;
let _scActive = false;
let _scFpsCounter = 0;
let _scLastFpsTime = Date.now();

// ══════════════════════════════════════════════════════
//  Открытие оверлея трансляции
// ══════════════════════════════════════════════════════
async function openScreenControl() {
  const overlay = document.getElementById('screenCtrlOverlay');
  overlay.style.display = 'flex';
  _scActive = true;

  // Находим video элемент
  _scVideo = document.getElementById('scVideo');
  
  // Если нет — создаем динамически
  if (!_scVideo) {
    const wrap = document.getElementById('scCanvasWrap');
    _scVideo = document.createElement('video');
    _scVideo.id = 'scVideo';
    _scVideo.autoplay = true;
    _scVideo.playsinline = true;
    _scVideo.muted = true;
    _scVideo.style.cssText = 'width:100%;height:100%;object-fit:contain;background:#000';
    wrap.appendChild(_scVideo);
  }
  
  _showScHint('🔌 Подключение к WebRTC…');
  _scVideo.style.display = 'none';

  // Получаем WSS URL
  let wsUrl = await _getWsUrl();
  
  console.log('[SC] WebRTC WebSocket URL:', wsUrl);
  _connectStream(wsUrl);
  
  // Счетчик FPS
  _startFpsCounter();
}

// ══════════════════════════════════════════════════════
//  Получение WS URL от сервера
// ══════════════════════════════════════════════════════
async function _getWsUrl() {
  try {
    const apiBase = window._apiBase || '';
    const r = await fetch(apiBase + '/api/ws_url');
    const j = await r.json();
    
    if (j.ok && j.url) {
      return j.url;
    }
  } catch (e) {
    console.warn('[SC] Failed to get ws_url:', e);
  }
  
  // Фолбэк на localhost
  return 'ws://127.0.0.1:8765';
}

// ══════════════════════════════════════════════════════
//  Подключение WebRTC стрима
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
      if (typeof toast === 'function') {
        toast('✅', 'Трансляция подключена', 2000);
      }
    },
    onDisconnect: () => { 
      _showScHint('🔌 Отключено');
      if (_scVideo) _scVideo.style.display = 'none';
    },
    onFrame: () => {
      _scFpsCounter++;
    }
  });

  _scPlayer.connect();
  _setupVideoInput();
}

// ══════════════════════════════════════════════════════
//  Закрытие оверлея
// ══════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════
//  Хинты состояния
// ══════════════════════════════════════════════════════
function _showScHint(text) {
  const h = document.getElementById('scHint');
  if (!h) return;
  h.style.display = 'flex';
  h.innerHTML = `<div style="font-size:40px;margin-bottom:12px">🖥</div>${text}`;
}

function _hideScHint() {
  const h = document.getElementById('scHint');
  if (h) h.style.display = 'none';
}

// ══════════════════════════════════════════════════════
//  Ввод с мыши/тачскрина
// ══════════════════════════════════════════════════════
function _setupVideoInput() {
  const wrap = document.getElementById('scCanvasWrap');
  if (!wrap || wrap._scInputBound) return;
  wrap._scInputBound = true;

  function toPC(clientX, clientY) {
    const rect = _scVideo.getBoundingClientRect();
    const rx = clientX - rect.left;
    const ry = clientY - rect.top;
    
    const pcWidth = 1920;
    const pcHeight = 1080;

    const px = Math.round((rx / rect.width) * pcWidth);
    const py = Math.round((ry / rect.height) * pcHeight);
    
    return { 
      x: Math.max(0, Math.min(pcWidth, px)), 
      y: Math.max(0, Math.min(pcHeight, py)) 
    };
  }

  // Mouse events
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

  // Touch events
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

// ══════════════════════════════════════════════════════
//  Настройки
// ══════════════════════════════════════════════════════
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

// ══════════════════════════════════════════════════════
//  FPS Counter
// ══════════════════════════════════════════════════════
function _startFpsCounter() {
  setInterval(() => {
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
//  WebRTC Stream Player Class
// ══════════════════════════════════════════════════════
class WebRTCStreamPlayer {
  constructor(wsUrl, videoElement, callbacks = {}) {
    this.wsUrl = wsUrl;
    this.videoEl = videoElement;
    this.callbacks = callbacks;
    this.ws = null;
    this.pc = null;
  }

  connect() {
    console.log('[WebRTC] Connecting to:', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('[WebRTC] WebSocket connected');
      this._initPeerConnection();
    };

    this.ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        
        if (msg.type === 'answer') {
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg));
          console.log('[WebRTC] Answer received');
          this.callbacks.onConnect?.();
        }
      } catch (e) {
        console.error('[WebRTC] Message error:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.error('[WebRTC] WS error', e);
    };

    this.ws.onclose = () => {
      console.log('[WebRTC] Connection closed');
      this.disconnect();
      this.callbacks.onDisconnect?.();
    };
  }

  async _initPeerConnection() {
    this.pc = new RTCPeerConnection({ 
      iceServers: [
        { urls: 'stun:stun.l.google.com:19302' }
      ] 
    });

    this.pc.ontrack = (event) => {
      console.log('[WebRTC] Track received');
      if (this.videoEl && event.streams && event.streams[0]) {
        this.videoEl.srcObject = event.streams[0];
        
        // Обработка кадров для счетчика FPS
        const stream = event.streams[0];
        const track = stream.getVideoTracks()[0];
        
        if (track) {
          const settings = track.getSettings();
          console.log('[WebRTC] Video settings:', settings);
        }
      }
    };

    this.pc.onicecandidate = (event) => {
      if (event.candidate) {
        console.log('[WebRTC] ICE candidate:', event.candidate);
      }
    };

    this.pc.onconnectionstatechange = () => {
      console.log('[WebRTC] Connection state:', this.pc.connectionState);
    };

    // Добавляем transceiver для получения видео
    this.pc.addTransceiver('video', { direction: 'recvonly' });

    // Создаем Offer
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Отправляем Offer на сервер
    this.ws.send(JSON.stringify({
      type: offer.type,
      sdp: offer.sdp
    }));
    
    console.log('[WebRTC] Offer sent');
  }

  send(cmd, data = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, ...data }));
    }
  }

  disconnect() {
    if (this.pc) {
      this.pc.close();
      this.pc = null;
    }
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.videoEl) {
      this.videoEl.srcObject = null;
    }
  }
}

window.WebRTCStreamPlayer = WebRTCStreamPlayer;
