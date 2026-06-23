// ══════════════════════════════════════════════════════════════
//  Media — громкость (как в Telegram) + плеер
// ══════════════════════════════════════════════════════════════

async function setVolume(v) {
  v = Number(v);
  toast("🔊", `Громкость ${v}%`);
  await execCmd("volume", { percent: v });
}

function openCustomVolumeInput() {
  openFsOverlay(`
    <div class="fs-title">🔊 Установить громкость</div>
    <div class="fs-desc">Введите значение от 0 до 100</div>
    <div class="flabel">Громкость (%)</div>
    <input class="inp" id="customVolInput" type="number" min="0" max="100" placeholder="50" value="50"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn ok" onclick="setCustomVolume()">✅ Установить</button>
    </div>
  `);
  setTimeout(() => document.getElementById("customVolInput")?.focus(), 100);
}

async function setCustomVolume() {
  const v = Number(document.getElementById("customVolInput")?.value || 0);
  if (v < 0 || v > 100) {
    toast("❌", "Значение должно быть от 0 до 100", 3000);
    return;
  }
  closeFsOverlay();
  await setVolume(v);
}

async function mediaControl(action) {
  const icons = {
    play: "⏯",
    next: "⏭",
    prev: "⏮",
    mute: "🔇"
  };
  await execCmd("media_control", { action });
}

window.setVolume = setVolume;
window.openCustomVolumeInput = openCustomVolumeInput;
window.setCustomVolume = setCustomVolume;
window.mediaControl = mediaControl;
