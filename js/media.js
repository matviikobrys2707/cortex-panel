// ══════════════════════════════════════════════════════════════
//  Media — громкость с реальным значением + автообновление
// ══════════════════════════════════════════════════════════════

let isMuted    = false;
let currentVol = 50;
let volCommitTimer  = null;
let volUpdateTimer  = null;
let volUpdateActive = false;

// ── Превью слайдера ──
function volSliderPreview(v) {
  currentVol = Number(v);
  _updateVolDisplay(currentVol);
}

// ── Commit слайдера ──
function volSliderCommit(v) {
  clearTimeout(volCommitTimer);
  volCommitTimer = setTimeout(() => {
    setVolume(Number(v));
  }, 200);
}

// ── Обновить дисплей ──
function _updateVolDisplay(v) {
  const pct    = document.getElementById("volPercent");
  const icon   = document.getElementById("volIcon");
  const slider = document.getElementById("volSlider");

  if (pct) pct.textContent = v + "%";
  if (slider && Number(slider.value) !== v) slider.value = v;

  if (icon) {
    if (isMuted || v === 0) icon.textContent = "🔇";
    else if (v <= 30)       icon.textContent = "🔈";
    else if (v <= 60)       icon.textContent = "🔉";
    else                    icon.textContent = "🔊";
  }

  // Gradient slider
  if (slider) {
    slider.style.background = `linear-gradient(to right,
      rgba(124,110,250,0.7) 0%,
      rgba(90,175,255,0.7) ${v}%,
      rgba(255,255,255,0.1) ${v}%,
      rgba(255,255,255,0.1) 100%)`;
  }
}

// ── Установить громкость ──
async function setVolume(v) {
  currentVol = Math.max(0, Math.min(100, Number(v)));
  _updateVolDisplay(currentVol);
  if (currentVol > 0) isMuted = false;
  _updateMuteBtn();
  await execCmd("volume", { percent: currentVol });
}

// ── Toggle Mute ──
async function toggleMute() {
  const res = await execCmd("mute_unmute");
  if (res?.ok) {
    isMuted = !isMuted;
    _updateMuteBtn();
    _updateVolDisplay(currentVol);
    toast(isMuted ? "🔇" : "🔊", isMuted ? "Звук выключен" : "Звук включён", 2000);
  }
}

// ── Кнопка Mute ──
function _updateMuteBtn() {
  const btn  = document.getElementById("muteBtn");
  const icon = document.getElementById("muteIcon");
  const text = document.getElementById("muteText");

  if (isMuted) {
    if (btn)  btn.className = "btn ok";
    if (icon) icon.textContent = "🔊";
    if (text) text.textContent = "Включить звук";
  } else {
    if (btn)  btn.className = "btn warn";
    if (icon) icon.textContent = "🔇";
    if (text) text.textContent = "Выключить звук";
  }
}

// ── Медиа контроль ──
async function mediaControl(action) {
  await execCmd("media_control", { action });
}

// ══════════════════════════════════════════════════════════════
//  Автообновление громкости (каждую секунду)
// ══════════════════════════════════════════════════════════════
async function _fetchRealVolume() {
  try {
    const res = await apiPost("/api/exec", { cmd: "get_volume" });
    if (res?.ok && res.data?.volume != null) {
      currentVol = res.data.volume;
      _updateVolDisplay(currentVol);
    }
  } catch {}
}

function startVolumeAutoUpdate() {
  if (volUpdateActive) return;
  volUpdateActive = true;
  _fetchRealVolume();
  volUpdateTimer = setInterval(_fetchRealVolume, 1000);
}

function stopVolumeAutoUpdate() {
  volUpdateActive = false;
  if (volUpdateTimer) {
    clearInterval(volUpdateTimer);
    volUpdateTimer = null;
  }
}

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  _updateVolDisplay(50);
  _updateMuteBtn();
});

// ── Exports ──
window.volSliderPreview       = volSliderPreview;
window.volSliderCommit        = volSliderCommit;
window.setVolume              = setVolume;
window.toggleMute             = toggleMute;
window.mediaControl           = mediaControl;
window.startVolumeAutoUpdate  = startVolumeAutoUpdate;
window.stopVolumeAutoUpdate   = stopVolumeAutoUpdate;