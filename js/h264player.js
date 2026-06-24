/**
 * WebRTCStreamPlayer — Прием H.264 видео-потока экрана через WebRTC PeerConnection
 */
class WebRTCStreamPlayer {
  constructor(wsUrl, videoElement, callbacks = {}) {
    this.wsUrl = wsUrl;
    this.videoEl = videoElement;
    this.callbacks = callbacks;
    this.ws = null;
    this.pc = null;
  }

  connect() {
    console.log('[WebRTC] Connecting signaling to:', this.wsUrl);
    this.ws = new WebSocket(this.wsUrl);

    this.ws.onopen = () => {
      console.log('[Signaling] Open. Initializing RTCPeerConnection...');
      this._initPeerConnection();
    };

    this.ws.onmessage = async (ev) => {
      try {
        const msg = JSON.parse(ev.data);
        if (msg.type === 'answer') {
          // Принимаем конфигурацию медиаканалов от ПК
          await this.pc.setRemoteDescription(new RTCSessionDescription(msg));
          this.callbacks.onConnect?.();
        }
      } catch (e) {
        console.error('[WebRTC] Signaling message error:', e);
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
    // cloudflared работает напрямую, сложные STUN сервера не нужны
    this.pc = new RTCPeerConnection({ iceServers: [] });

    // Когда от ПК приходит видеотрек — транслируем его прямо в элемент <video>
    this.pc.ontrack = (event) => {
      if (this.videoEl && event.streams && event.streams[0]) {
        this.videoEl.srcObject = event.streams[0];
      }
    };

    // Указываем, что мы хотим только получать видео (recvonly)
    this.pc.addTransceiver('video', { direction: 'recvonly' });

    // Создаем предложение (Offer) локально на клиенте
    const offer = await this.pc.createOffer();
    await this.pc.setLocalDescription(offer);

    // Отправляем Offer бэкенду на ПК
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
