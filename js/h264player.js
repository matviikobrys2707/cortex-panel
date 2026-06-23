/**
 * H264Player — воспроизведение mpegts потока через MSE (Media Source Extensions)
 *
 * Почему MSE, а не WebCodecs?
 * ─────────────────────────────
 * WebCodecs требует правильно аннотированные EncodedVideoChunk с точным
 * указанием keyframe/delta и корректными timestamp — это сложно сделать
 * без парсинга H.264 битстрима.
 *
 * MSE + mpegts.js гораздо проще: скармливаем сырой mpegts поток,
 * браузер сам разбирает и декодирует через нативный декодер.
 *
 * mpegts.js: https://github.com/xqq/mpegts.js
 * Подключается через CDN (добавь в <head> index.html)
 */

class H264Player {
  /**
   * @param {string} canvasId  — id элемента <canvas> или <video>
   * @param {string} wsUrl     — ws://host:8765
   */
  constructor(canvasId, wsUrl) {
    this.videoEl = null;        // будем использовать <video>, не canvas
    this.canvasId = canvasId;
    this.wsUrl = wsUrl;
    this.ws = null;
    this.ms = null;             // MediaSource
    this.sb = null;             // SourceBuffer
    this.queue = [];            // очередь ArrayBuffer для добавления в SourceBuffer
    this.isAppending = false;
    this.ready = false;
    this.frameCount = 0;
    this.lastFpsTime = performance.now();
    this.currentFps = 0;
    this._pingInterval = null;
    this._pingStart = 0;
    this.connected = false;
  }

  // ══════════════════════════════════════════════
  //  Подключение
  // ══════════════════════════════════════════════

  connect() {
    this._setupVideo();
    this._setupMediaSource();
    this._connectWS();
  }

  // ──────────────────────────────────────────────
  //  Video element
  // ──────────────────────────────────────────────

  _setupVideo() {
    // Заменяем canvas на video элемент (MSE работает только с <video>/<audio>)
    const canvas = document.getElementById(this.canvasId);
    if (!canvas) {
      console.error('[H264] Element not found:', this.canvasId);
      return;
    }

    // Создаём <video> на месте canvas
    this.videoEl = document.createElement('video');
    this.videoEl.id = this.canvasId + '_video';
    this.videoEl.style.cssText = canvas.style.cssText;
    this.videoEl.style.width = '100%';
    this.videoEl.style.height = '100%';
    this.videoEl.style.objectFit = 'contain';
    this.videoEl.style.background = '#000';
    this.videoEl.autoplay = true;
    this.videoEl.muted = true;
    this.videoEl.playsInline = true;

    canvas.parentNode.replaceChild(this.videoEl, canvas);
    console.log('[H264] Video element created');
  }

  // ──────────────────────────────────────────────
  //  MediaSource
  // ──────────────────────────────────────────────

  _setupMediaSource() {
    // Проверяем поддержку MPEG-TS
    const mimeType = 'video/mp2t; codecs="avc1.42E01E"';

    if (!MediaSource.isTypeSupported(mimeType)) {
      console.warn('[H264] mp2t не поддерживается, пробуем через mpegts.js...');
      this._setupMpegtsJs();
      return;
    }

    this.ms = new MediaSource();
    this.videoEl.src = URL.createObjectURL(this.ms);

    this.ms.addEventListener('sourceopen', () => {
      console.log('[H264] MediaSource opened');
      try {
        this.sb = this.ms.addSourceBuffer(mimeType);
        this.sb.mode = 'sequence';   // важно для стриминга без timestamp

        this.sb.addEventListener('updateend', () => {
          this.isAppending = false;
          this._flushQueue();
        });

        this.sb.addEventListener('error', (e) => {
          console.error('[H264] SourceBuffer error:', e);
        });

        this.ready = true;
        console.log('[H264] SourceBuffer ready');
      } catch (e) {
        console.error('[H264] addSourceBuffer failed:', e);
        // Фолбэк на mpegts.js
        this._setupMpegtsJs();
      }
    });
  }

  // ──────────────────────────────────────────────
  //  Фолбэк: mpegts.js (поддерживает больше браузеров)
  // ──────────────────────────────────────────────

  _setupMpegtsJs() {
    if (typeof mpegts === 'undefined') {
      console.error('[H264] mpegts.js не загружен! Добавь CDN в <head>');
      this._showHint('❌ Добавь mpegts.js в <head>');
      return;
    }

    if (!mpegts.isSupported()) {
      console.error('[H264] mpegts.js: браузер не поддерживается');
      this._showHint('❌ Браузер не поддерживает стрим');
      return;
    }

    // mpegts.js умеет работать с кастомным источником данных
    const self = this;

    // Создаём виртуальный поток через ReadableStream
    let controller;
    this._streamController = null;

    const readableStream = new ReadableStream({
      start(c) {
        controller = c;
        self._streamController = c;
      }
    });

    // Создаём URL из потока (trick для mpegts.js)
    // mpegts.js поддерживает customLoader
    this._mpegtsPlayer = mpegts.createPlayer({
      type: 'mpegts',
      isLive: true,
      // Используем кастомный загрузчик данных
      url: 'ws://fake', // заглушка, реально данные пушим вручную
    }, {
      enableWorker: false,
      lazyLoadMaxDuration: 3,
      seekType: 'range',
      liveBufferLatencyChasing: true,
      liveBufferLatencyMinRemain: 0.3,
    });

    // Более простой подход — используем MSEPlayer напрямую
    this._useMpegtsManual();
  }

  _useMpegtsManual() {
    /**
     * Самый надёжный способ: mpegts.js с CustomTransmuxer
     * Или ещё проще — используем broadway.js / broadway decoder
     *
     * Но самое простое решение: WebCodecs с правильным парсингом
     */
    console.log('[H264] Используем WebCodecs с парсингом MPEG-TS...');
    this._setupWebCodecs();
  }

  // ──────────────────────────────────────────────
  //  WebCodecs с парсингом MPEG-TS
  // ──────────────────────────────────────────────

  _setupWebCodecs() {
    if (typeof VideoDecoder === 'undefined') {
      this._showHint('❌ VideoDecoder не поддерживается');
      return;
    }

    // Создаём offscreen canvas для рендеринга
    const canvas = this.videoEl;
    // Заменяем video обратно на canvas для WebCodecs
    const parentEl = this.videoEl.parentNode;
    if (parentEl) {
      const newCanvas = document.createElement('canvas');
      newCanvas.id = this.canvasId;
      newCanvas.style.cssText = this.videoEl.style.cssText;
      newCanvas.width = 1280;
      newCanvas.height = 720;
      parentEl.replaceChild(newCanvas, this.videoEl);
      this.videoEl = null;
      this.canvasEl = newCanvas;
      this.ctx2d = newCanvas.getContext('2d', { alpha: false });
    }

    this.decoder = new VideoDecoder({
      output: (frame) => this._onDecodedFrame(frame),
      error: (e) => console.error('[WebCodecs] decode error:', e),
    });

    // Определяем профиль — ultrafast дает Baseline
    this.decoder.configure({
      codec: 'avc1.42E01E',         // Baseline Profile L3.0
      optimizeForLatency: true,
      hardwareAcceleration: 'prefer-hardware',
    });

    this.useWebCodecs = true;
    this.frameIndex = 0;
    this.ready = true;
    console.log('[H264] WebCodecs decoder ready');
  }

  // ──────────────────────────────────────────────
  //  WebSocket
  // ──────────────────────────────────────────────

  _connectWS() {
    console.log('[H264] Connecting:', this.wsUrl);

    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      this.connected = true;
      console.log('[H264] WS connected');
      this._hideHint();
      toast('✅', 'Трансляция подключена', 2000);
      this._startPing();
    };

    this.ws.onmessage = (ev) => this._onMessage(ev);

    this.ws.onerror = (e) => {
      console.error('[H264] WS error', e);
      toast('❌', 'Ошибка WebSocket', 3000);
    };

    this.ws.onclose = () => {
      this.connected = false;
      this.ready = false;
      this._stopPing();
      console.log('[H264] WS closed');
      toast('ℹ️', 'Трансляция отключена', 2000);
      this._showHint('🔌 Отключено');
    };
  }

  // ──────────────────────────────────────────────
  //  Обработка входящих сообщений
  // ──────────────────────────────────────────────

  _onMessage(ev) {
    try {
      const msg = JSON.parse(ev.data);

      switch (msg.type) {
        case 'config':
          this._onConfig(msg);
          break;

        case 'h264_ts':
          this._onPacket(msg);
          break;

        case 'pong':
          this._onPong(msg);
          break;

        default:
          console.warn('[H264] Unknown message type:', msg.type);
      }
    } catch (e) {
      console.error('[H264] Message parse error:', e, ev.data?.slice?.(0, 100));
    }
  }

  _onConfig(cfg) {
    console.log('[H264] Config received:', cfg);
    if (this.canvasEl) {
      this.canvasEl.width = cfg.width;
      this.canvasEl.height = cfg.height;
    }
  }

  _onPacket(msg) {
    // Декодируем base64 → Uint8Array
    const binary = atob(msg.data);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) {
      buf[i] = binary.charCodeAt(i);
    }

    if (this.sb && this.ready && !this.useWebCodecs) {
      // MSE путь
      this._appendToSourceBuffer(buf.buffer);
    } else if (this.useWebCodecs && this.decoder) {
      // WebCodecs путь — нужно извлечь H.264 из MPEG-TS
      this._demuxAndDecode(buf, msg);
    }

    // FPS counter
    this._countFps();
  }

  // ──────────────────────────────────────────────
  //  MSE: добавление данных в SourceBuffer
  // ──────────────────────────────────────────────

  _appendToSourceBuffer(arrayBuffer) {
    this.queue.push(arrayBuffer);
    if (!this.isAppending) {
      this._flushQueue();
    }
  }

  _flushQueue() {
    if (this.isAppending || !this.sb || this.queue.length === 0) return;
    if (this.sb.updating) return;

    try {
      // Ограничиваем буфер — удаляем старые данные
      if (this.sb.buffered.length > 0) {
        const bufferedEnd = this.sb.buffered.end(0);
        const bufferedStart = this.sb.buffered.start(0);
        const bufferLen = bufferedEnd - bufferedStart;

        // Если буфер > 3 сек — чистим
        if (bufferLen > 3 && !this.sb.updating) {
          this.sb.remove(bufferedStart, bufferedEnd - 1);
          return;
        }
      }

      const chunk = this.queue.shift();
      this.isAppending = true;
      this.sb.appendBuffer(chunk);
    } catch (e) {
      this.isAppending = false;
      if (e.name === 'QuotaExceededError') {
        // Очищаем буфер
        this.queue = [];
        if (this.sb.buffered.length > 0 && !this.sb.updating) {
          this.sb.remove(
            this.sb.buffered.start(0),
            this.sb.buffered.end(0)
          );
        }
      } else {
        console.error('[MSE] appendBuffer error:', e);
      }
    }
  }

  // ──────────────────────────────────────────────
  //  WebCodecs: демультиплексирование MPEG-TS → H.264
  // ──────────────────────────────────────────────

  /**
   * Простой MPEG-TS демультиплексор.
   * MPEG-TS пакет = 188 байт, начинается с 0x47 (sync byte).
   * PES (Packetized Elementary Stream) содержит H.264 NAL units.
   */
  _demuxAndDecode(tsData, msg) {
    const PACKET_SIZE = 188;
    const SYNC_BYTE = 0x47;

    // Извлекаем PES payload из TS пакетов
    const pesPayload = this._extractPESPayload(tsData, PACKET_SIZE, SYNC_BYTE);

    if (!pesPayload || pesPayload.length === 0) return;

    try {
      const isKey = msg.keyframe === true;
      const ts = (msg.timestamp || 0) * 1_000_000; // → микросекунды

      const chunk = new EncodedVideoChunk({
        type: isKey ? 'key' : 'delta',
        timestamp: ts,
        duration: 33_333,          // ~30fps = 33.3ms = 33333 мкс
        data: pesPayload,
      });

      if (this.decoder.state === 'configured') {
        this.decoder.decode(chunk);
      }
    } catch (e) {
      // Если chunk невалидный — пропускаем
      if (e.name !== 'DataError') {
        console.warn('[WebCodecs] decode chunk error:', e.message);
      }
    }
  }

  _extractPESPayload(tsData, packetSize, syncByte) {
    const allPES = [];
    let offset = 0;

    // Синхронизация с первым sync byte
    while (offset < tsData.length && tsData[offset] !== syncByte) {
      offset++;
    }

    while (offset + packetSize <= tsData.length) {
      if (tsData[offset] !== syncByte) {
        offset++;
        continue;
      }

      const header1 = tsData[offset + 1];
      const header2 = tsData[offset + 2];

      // Payload Unit Start Indicator
      // const pusi = (header1 >> 6) & 1;  // не используем — берём всё

      // Адаптационное поле
      const adaptationFieldControl = (tsData[offset + 3] >> 4) & 0x3;
      let payloadOffset = 4;

      if (adaptationFieldControl === 2) {
        // Только адаптационное поле, нет payload
        offset += packetSize;
        continue;
      }

      if (adaptationFieldControl === 3) {
        // Адаптационное поле + payload
        const afLen = tsData[offset + 4];
        payloadOffset = 5 + afLen;
      }

      // Берём payload пакета
      const payloadStart = offset + payloadOffset;
      const payloadEnd = offset + packetSize;

      if (payloadStart < payloadEnd && payloadStart < tsData.length) {
        const payload = tsData.slice(payloadStart, payloadEnd);

        // Проверяем PES заголовок (начинается с 0x000001)
        if (payload[0] === 0x00 && payload[1] === 0x00 && payload[2] === 0x01) {
          // Пропускаем PES заголовок (минимум 9 байт)
          const pesHeaderDataLen = payload[8];
          const esStart = 9 + pesHeaderDataLen;
          if (esStart < payload.length) {
            allPES.push(payload.slice(esStart));
          }
        } else {
          allPES.push(payload);
        }
      }

      offset += packetSize;
    }

    if (allPES.length === 0) return null;

    // Объединяем все части
    const totalLen = allPES.reduce((s, a) => s + a.length, 0);
    const result = new Uint8Array(totalLen);
    let pos = 0;
    for (const part of allPES) {
      result.set(part, pos);
      pos += part.length;
    }
    return result;
  }

  // ──────────────────────────────────────────────
  //  WebCodecs: отрисовка декодированного кадра
  // ──────────────────────────────────────────────

  _onDecodedFrame(frame) {
    if (!this.ctx2d) {
      frame.close();
      return;
    }

    if (
      this.canvasEl.width !== frame.displayWidth ||
      this.canvasEl.height !== frame.displayHeight
    ) {
      this.canvasEl.width = frame.displayWidth;
      this.canvasEl.height = frame.displayHeight;
    }

    this.ctx2d.drawImage(frame, 0, 0);
    frame.close();   // обязательно! иначе утечка памяти
  }

  // ──────────────────────────────────────────────
  //  FPS счётчик
  // ──────────────────────────────────────────────

  _countFps() {
    this.frameCount++;
    const now = performance.now();
    const diff = now - this.lastFpsTime;

    if (diff >= 1000) {
      this.currentFps = Math.round(this.frameCount * 1000 / diff);
      this.frameCount = 0;
      this.lastFpsTime = now;

      const el = document.getElementById('scFps');
      if (el) el.textContent = this.currentFps + ' fps';
    }
  }

  // ──────────────────────────────────────────────
  //  Ping/Pong для измерения задержки
  // ──────────────────────────────────────────────

  _startPing() {
    this._pingInterval = setInterval(() => {
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        this._pingStart = performance.now();
        this.ws.send(JSON.stringify({ cmd: 'ping', t: this._pingStart }));
      }
    }, 2000);
  }

  _stopPing() {
    if (this._pingInterval) {
      clearInterval(this._pingInterval);
      this._pingInterval = null;
    }
  }

  _onPong(msg) {
    const rtt = Math.round(performance.now() - this._pingStart);
    const el = document.getElementById('scPing');
    if (el) el.textContent = rtt + ' ms';
  }

  // ──────────────────────────────────────────────
  //  Отправка команд на сервер
  // ──────────────────────────────────────────────

  sendCommand(cmd, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.dumps({ cmd, ...data }));
    }
  }

  send(cmd, data = {}) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ cmd, ...data }));
    }
  }

  // ──────────────────────────────────────────────
  //  UI хелперы
  // ──────────────────────────────────────────────

  _showHint(text) {
    const hint = document.getElementById('scHint');
    if (hint) {
      hint.style.display = 'flex';
      hint.querySelector?.('div') && (hint.children[1].textContent = text);
    }
  }

  _hideHint() {
    const hint = document.getElementById('scHint');
    if (hint) hint.style.display = 'none';
  }

  // ──────────────────────────────────────────────
  //  Отключение
  // ──────────────────────────────────────────────

  disconnect() {
    this._stopPing();
    this.ready = false;

    if (this.ws) {
      this.ws.onclose = null; // предотвращаем toast при ручном закрытии
      this.ws.close();
      this.ws = null;
    }

    if (this.decoder) {
      try { this.decoder.close(); } catch (_) {}
      this.decoder = null;
    }

    if (this.ms && this.ms.readyState === 'open') {
      try { this.ms.endOfStream(); } catch (_) {}
    }

    if (this.videoEl?.src) {
      URL.revokeObjectURL(this.videoEl.src);
    }
  }
}

window.H264Player = H264Player;
