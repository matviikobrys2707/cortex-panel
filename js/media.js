// ══════════════════════════════════════════════════════════════
//  Media — громкость + плеер
// ══════════════════════════════════════════════════════════════

function volPreview(v) {
  const el = document.getElementById("volNum");
  if (el) el.textContent = v;
  const r = document.getElementById("volRange");
  if (r) r.style.background = `linear-gradient(to right,var(--accent) ${v}%,rgba(255,255,255,.1) ${v}%)`;
}

async function setVolume(v) {
  v = Number(v);
  document.getElementById("volRange").value = v;
  volPreview(v);
  await execCmd("volume:" + v);
}

async function mediaControl(action) {
  const cmds = {
    play: "media_play",
    next: "media_next",
    prev: "media_prev",
    mute: "mute_unmute"
  };
  await execCmd(cmds[action] || action);
}

window.volPreview = volPreview;
window.setVolume = setVolume;
window.mediaControl = mediaControl;