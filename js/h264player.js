// ══════════════════════════════════════════════════════════════
//  H.264 WebSocket Player — WebCodecs API
// ══════════════════════════════════════════════════════════════

class H264Player {
  constructor(canvasId, wsUrl) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.ws = null;
    this.wsUrl = wsUrl;
    this.decoder = null;
    this.frameCount = 0;
    this.lastFpsTime = Date.now();
    this.currentFps = 0;
    this.pendingFrames = [];
  }

  connect() {
    console.log('[H264] Connecting to', this.wsUrl);
    
    // Проверка поддержки WebCodecs
    if (typeof VideoDecoder === 'undefined') {
      console.error('[H264] VideoDecoder not supported');
      toast('❌', 'Ваш браузер не поддерживает H.264', 5000);
      return;
    }

    this._initDecoder();

    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[H264] Connected');
      toast('✅', 'H.264 стрим подключён', 2000);
    };

    this.ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'config') {
          console.log('[H264] Config:', data);
          this.canvas.width = data.width;
          this.canvas.height = data.height;
        }
        
        else if (data.type === 'h264') {
          this._decodeH264(data.data, data.timestamp);
        }
      } catch (e) {
        console.error('[H264] Message error:', e);
      }
    };

    this.ws.onerror = (e) => {
      console.error('[H264] WebSocket error:', e);
      toast('❌', 'Ошибка подключения', 3000);
    };

    this.ws.onclose = () => {
      console.log('[H264] Disconnected');
      toast('ℹ️', 'Отключено', 2000);
    };
  }

  _initDecoder() {
    this.decoder = new VideoDecoder({
      output: (frame) => this._renderFrame(frame),
      error: (e) => console.error('[H264] Decode error:', e)
    });

    this.decoder.configure({
      codec: 'avc1.42E01E', // H.264 Baseline Profile Level 3.0
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware'
    });

    console.log('[H264] WebCodecs decoder initialized');
  }

  _decodeH264(base64Data, timestamp) {
    if (!this.decoder || this.decoder.state !== 'configured') return;

    // Декодируем base64 → ArrayBuffer
    const binaryString = atob(base64Data);
    const len = binaryString.length;
    const bytes = new Uint8Array(len);
    for (let i = 0; i < len; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // Создаём EncodedVideoChunk
    const chunk = new EncodedVideoChunk({
      type: 'key', // Упрощение: считаем все кадры keyframe
      timestamp: timestamp * 1000000, // микросекунды
      data: bytes.buffer
    });

    try {
      this.decoder.decode(chunk);
    } catch (e) {
      console.error('[H264] Decode failed:', e);
    }
  }

  _renderFrame(videoFrame) {
    // Рисуем кадр на canvas
    if (this.canvas.width !== videoFrame.displayWidth ||
        this.canvas.height !== videoFrame.displayHeight) {
      this.canvas.width = videoFrame.displayWidth;
      this.canvas.height = videoFrame.displayHeight;
    }
    
    this.ctx.drawImage(videoFrame, 0, 0);
    videoFrame.close();

    // FPS counter
    this.frameCount++;
    const now = Date.now();
    if (now - this.lastFpsTime >= 1000) {
      this.currentFps = this.frameCount;
      this.frameCount = 0;
      this.lastFpsTime = now;
      
      const fpsEl = document.getElementById('scFps');
      if (fpsEl) fpsEl.textContent = this.currentFps + ' fps';
    }
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    if (this.decoder) {
      this.decoder.close();
      this.decoder = null;
    }
  }

  sendCommand(cmd, data) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, ...data }));
    }
  }
}

window.H264Player = H264Player;
