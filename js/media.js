// ══════════════════════════════════════════════════════════════
//  Media — громкость + состояние mute
// ══════════════════════════════════════════════════════════════

let isMuted = false;
let currentVol = 50;
let volCommitTimer = null;

function volSliderPreview(v) {
  currentVol = Number(v);
  _updateVolDisplay(currentVol);
}

function volSliderCommit(v) {
  // Дебаунс - не отправляем каждый пиксель
  clearTimeout(volCommitTimer);
  volCommitTimer = setTimeout(() => {
    setVolume(Number(v));
  }, 200);
}

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

  // Градиент слайдера
  if (slider) {
    slider.style.background = `linear-gradient(to right,
      rgba(124,110,250,0.7) 0%,
      rgba(90,175,255,0.7) ${v}%,
      rgba(255,255,255,0.1) ${v}%,
      rgba(255,255,255,0.1) 100%)`;
  }
}

async function setVolume(v) {
  currentVol = Math.max(0, Math.min(100, Number(v)));
  _updateVolDisplay(currentVol);
  if (currentVol > 0) isMuted = false;
  _updateMuteBtn();
  await execCmd("volume", { percent: currentVol });
}

async function toggleMute() {
  const res = await execCmd("mute_unmute");
  if (res?.ok) {
    isMuted = !isMuted;
    _updateMuteBtn();
    _updateVolDisplay(currentVol);
    toast(isMuted ? "🔇" : "🔊", isMuted ? "Звук выключен" : "Звук включён", 2000);
  }
}

function _updateMuteBtn() {
  const btn  = document.getElementById("muteBtn");
  const icon = document.getElementById("muteIcon");
  const text = document.getElementById("muteText");

  if (isMuted) {
    if (btn)  btn.className  = "btn ok";
    if (icon) icon.textContent = "🔊";
    if (text) text.textContent = "Включить звук";
  } else {
    if (btn)  btn.className  = "btn warn";
    if (icon) icon.textContent = "🔇";
    if (text) text.textContent = "Выключить звук";
  }
}

async function mediaControl(action) {
  await execCmd("media_control", { action });
}

document.addEventListener("DOMContentLoaded", () => {
  _updateVolDisplay(50);
  _updateMuteBtn();
});

window.volSliderPreview = volSliderPreview;
window.volSliderCommit  = volSliderCommit;
window.setVolume        = setVolume;
window.toggleMute       = toggleMute;
window.mediaControl     = mediaControl;