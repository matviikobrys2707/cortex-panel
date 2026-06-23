/**
 * MJPEGPlayer — JPEG стрим через WebSocket
 * createImageBitmap = аппаратное декодирование, работает везде
 */
class MJPEGPlayer {
  constructor(wsUrl, callbacks = {}) {
    this.wsUrl     = wsUrl;
    this.ws        = null;
    this.cb        = callbacks;
    this._fCount   = 0;
    this._fTime    = performance.now();
    this._pingT    = null;
    this._pingAt   = 0;
    this._alive    = false;
  }

  connect() {
    this._alive = true;
    console.log('[MJPEG] →', this.wsUrl);
    this._open();
  }

  _open() {
    try {
      this.ws = new WebSocket(this.wsUrl);
    } catch(e) {
      console.error('[MJPEG] WS create error:', e);
      this.cb.onError?.(e);
      return;
    }

    this.ws.onopen = () => {
      console.log('[MJPEG] connected');
      this._startPing();
      this.cb.onConnect?.();
    };

    this.ws.onmessage = (ev) => this._onMsg(ev);

    this.ws.onerror = (e) => {
      console.warn('[MJPEG] ws error', e);
      this.cb.onError?.(e);
    };

    this.ws.onclose = () => {
      console.log('[MJPEG] closed');
      this._stopPing();
      this.cb.onDisconnect?.();

      // Авто-реконнект через 2 сек если не закрыли вручную
      if (this._alive) {
        setTimeout(() => {
          if (this._alive) {
            console.log('[MJPEG] reconnecting...');
            this._open();
          }
        }, 2000);
      }
    };
  }

  _onMsg(ev) {
    let msg;
    try {
      msg = JSON.parse(ev.data);
    } catch(e) {
      return;
    }

    if (msg.type === 'config') {
      console.log('[MJPEG] config:', msg);
      this.cb.onConfig?.(msg);
      return;
    }

    if (msg.type === 'frame') {
      this._drawFrame(msg);
      return;
    }
  }

  _drawFrame(msg) {
    // base64 → Uint8Array → Blob → ImageBitmap
    // createImageBitmap — нативный декодер браузера (GPU)
    try {
      const bin = atob(msg.data);
      const u8  = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);

      const blob = new Blob([u8], { type: 'image/jpeg' });

      createImageBitmap(blob, {
        resizeQuality: 'medium',
      }).then(bitmap => {
        this.cb.onFrame?.(bitmap, msg.width || 1280, msg.height || 720);
        bitmap.close();
        this._fps();
      }).catch(e => {
        console.warn('[MJPEG] bitmap err:', e);
      });
    } catch(e) {
      console.warn('[MJPEG] frame err:', e);
    }
  }

  _fps() {
    this._fCount++;
    const now  = performance.now();
    const diff = now - this._fTime;
    if (diff >= 1000) {
      this.cb.onFps?.(Math.round(this._fCount * 1000 / diff));
      this._fCount = 0;
      this._fTime  = now;
    }
  }

  _startPing() {
    this._pingT = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this._pingAt = performance.now();
        this.ws.send(JSON.stringify({ cmd: 'ping' }));
      }
    }, 2000);
  }

  _stopPing() {
    clearInterval(this._pingT);
    this._pingT = null;
  }

  send(cmd, data = {}) {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, ...data }));
    }
  }

  disconnect() {
    this._alive = false;
    this._stopPing();
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
  }
}

window.MJPEGPlayer = MJPEGPlayer;
