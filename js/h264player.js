// ══════════════════════════════════════════════════════════════
//  H.264 WebSocket Player — Broadway.js decoder
// ══════════════════════════════════════════════════════════════

class H264Player {
  constructor(canvasId, wsUrl) {
    this.canvas = document.getElementById(canvasId);
    this.ctx = this.canvas.getContext('2d');
    this.ws = null;
    this.wsUrl = wsUrl;
    this.decoder = null;
    this.frameCount = 0;
    this.lastFpsTime = Date.now();
    this.currentFps = 0;
    
    // Инициализация Broadway.js декодера
    this._initDecoder();
  }

  _initDecoder() {
    // Используем встроенный браузерный VideoDecoder (Chrome/Edge)
    if (typeof VideoDecoder !== 'undefined') {
      this._initWebCodecs();
    } else {
      console.error('[H264] VideoDecoder API not supported');
      toast('❌', 'Ваш браузер не поддерживает H.264 декодирование', 5000);
    }
  }

  _initWebCodecs() {
    this.decoder = new VideoDecoder({
      output: (frame) => this._renderFrame(frame),
      error: (e) => console.error('[H264] Decode error:', e)
    });

    this.decoder.configure({
      codec: 'avc1.42E01E', // H.264 Baseline Profile
      optimizeForLatency: true
    });

    console.log('[H264] WebCodecs decoder initialized');
  }

  _renderFrame(videoFrame) {
    // Рисуем кадр на canvas
    this.canvas.width = videoFrame.displayWidth;
    this.canvas.height = videoFrame.displayHeight;
    
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

  connect() {
    console.log('[H264] Connecting to', this.wsUrl);
    
    this.ws = new WebSocket(this.wsUrl);
    this.ws.binaryType = 'arraybuffer';

    this.ws.onopen = () => {
      console.log('[H264] Connected');
      toast('✅', 'Подключено к стриму', 2000);
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
          // Декодируем base64 → ArrayBuffer
          const binaryString = atob(data.data);
          const len = binaryString.length;
          const bytes = new Uint8Array(len);
          for (let i = 0; i < len; i++) {
            bytes[i] = binaryString.charCodeAt(i);
          }

          // Отправляем в декодер
          const chunk = new EncodedVideoChunk({
            type: 'key', // Для упрощения считаем все keyframe
            timestamp: data.timestamp * 1000000, // микросекунды
            data: bytes.buffer
          });

          if (this.decoder.state === 'configured') {
            this.decoder.decode(chunk);
          }
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

// Глобальная переменная
window.h264Player = null;