// ══════════════════════════════════════════════════════════════
//  Media — громкость (pycaw) + плеер
// ══════════════════════════════════════════════════════════════

let currentVolume = 50;

function volSliderChange(v) {
  currentVolume = Number(v);
  updateVolDisplay(currentVolume);
}

function updateVolDisplay(v) {
  const percentEl = document.getElementById("volPercent");
  const iconEl = document.getElementById("volIcon");
  const slider = document.getElementById("volSlider");

  if (percentEl) percentEl.textContent = v + "%";
  if (slider) slider.value = v;

  // Иконки
  let icon = "🔊";
  if (v === 0) icon = "🔇";
  else if (v <= 30) icon = "🔈";
  else if (v <= 60) icon = "🔉";
  
  if (iconEl) iconEl.textContent = icon;

  // Градиент на слайдере
  if (slider) {
    slider.style.background = `linear-gradient(to right, 
      rgba(124, 110, 250, 0.6) 0%, 
      rgba(90, 175, 255, 0.6) ${v}%, 
      rgba(255, 255, 255, 0.1) ${v}%, 
      rgba(255, 255, 255, 0.1) 100%)`;
  }
}

async function setVolume(v) {
  currentVolume = Number(v);
  updateVolDisplay(currentVolume);
  toast("🔊", `Громкость ${currentVolume}%`, 1500);
  await execCmd("volume", { percent: currentVolume });
}

async function toggleMute() {
  await execCmd("mute_unmute");
}

async function mediaControl(action) {
  await execCmd("media_control", { action });
}

// Инициализация при загрузке
document.addEventListener("DOMContentLoaded", () => {
  updateVolDisplay(50);
});

window.volSliderChange = volSliderChange;
window.setVolume = setVolume;
window.toggleMute = toggleMute;
window.mediaControl = mediaControl;