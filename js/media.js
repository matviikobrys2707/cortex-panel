// ══════════════════════════════════════════════════════════════
//  Media — реальная громкость при загрузке
// ══════════════════════════════════════════════════════════════

let isMuted    = false;
let currentVol = null; // null = не загружено
let volCommitTimer = null;
let _volFetching   = false;
let _volAutoTimer  = null;

// ── Загрузить реальную громкость ──
async function fetchRealVolumeOnce() {
  if (_volFetching) return;
  _volFetching = true;
  try {
    const res = await apiPost("/api/exec", { cmd: "get_volume" });
    if (res?.ok && res.data?.volume != null) {
      currentVol = res.data.volume;
      _updateVolDisplay(currentVol);
    }
  } catch {}
  _volFetching = false;
}

// ── Превью слайдера (только UI, не отправляет на сервер) ──
function volSliderPreview(v) {
  const val = Number(v);
  // Обновляем только текст, не currentVol
  const pct  = document.getElementById("volPercent");
  const icon = document.getElementById("volIcon");
  const slider = document.getElementById("volSlider");
  if (pct) pct.textContent = val + "%";
  if (icon) {
    if (val === 0) icon.textContent = "🔇";
    else if (val <= 30) icon.textContent = "🔈";
    else if (val <= 60) icon.textContent = "🔉";
    else icon.textContent = "🔊";
  }
  _updateSliderGradient(val, slider);
}

// ── Commit слайдера (отправляет на сервер) ──
function volSliderCommit(v) {
  clearTimeout(volCommitTimer);
  volCommitTimer = setTimeout(() => setVolume(Number(v)), 200);
}

// ── Обновить дисплей ──
function _updateVolDisplay(v) {
  const pct    = document.getElementById("volPercent");
  const icon   = document.getElementById("volIcon");
  const slider = document.getElementById("volSlider");

  if (pct) pct.textContent = v + "%";

  // Слайдер — не дёргаем если пользователь тащит
  if (slider && !slider.matches(":active")) slider.value = v;

  if (icon) {
    if (isMuted || v === 0) icon.textContent = "🔇";
    else if (v <= 30) icon.textContent = "🔈";
    else if (v <= 60) icon.textContent = "🔉";
    else icon.textContent = "🔊";
  }

  _updateSliderGradient(v, slider);
}

function _updateSliderGradient(v, slider) {
  if (!slider) return;
  slider.style.background = `linear-gradient(to right,
    rgba(124,110,250,0.7) 0%,
    rgba(90,175,255,0.7) ${v}%,
    rgba(255,255,255,0.1) ${v}%,
    rgba(255,255,255,0.1) 100%)`;
}

// ── Установить громкость ──
async function setVolume(v) {
  currentVol = Math.max(0, Math.min(100, Number(v)));
  _updateVolDisplay(currentVol);
  if (currentVol > 0) { isMuted = false; _updateMuteBtn(); }
  try {
    await apiPost("/api/exec", { cmd: "volume", percent: currentVol });
  } catch (e) {
    toast("❌", e.message, 3000);
  }
}

// ── Toggle Mute ──
async function toggleMute() {
  try {
    const res = await apiPost("/api/exec", { cmd: "mute_unmute" });
    if (res?.ok) {
      isMuted = !isMuted;
      _updateMuteBtn();
      _updateVolDisplay(currentVol ?? 0);
      toast(isMuted ? "🔇" : "🔊", isMuted ? "Звук выключен" : "Звук включён", 2000);
    }
  } catch (e) {
    toast("❌", e.message, 3000);
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

// ── Init ──
document.addEventListener("DOMContentLoaded", () => {
  // Показываем "—%" пока не загрузим реальное значение
  const pct = document.getElementById("volPercent");
  if (pct) pct.textContent = "—%";
  _updateMuteBtn();
  // НЕ вызываем fetchRealVolumeOnce здесь — вызовется при открытии вкладки медиа
});

// ── Exports ──
window.volSliderPreview      = volSliderPreview;
window.volSliderCommit       = volSliderCommit;
window.setVolume             = setVolume;
window.toggleMute            = toggleMute;
window.mediaControl          = mediaControl;
window.fetchRealVolumeOnce   = fetchRealVolumeOnce;