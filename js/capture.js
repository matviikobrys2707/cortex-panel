// ══════════════════════════════════════════════════════════════
//  Capture — медиа галерея (скрины, фото, видео)
// ══════════════════════════════════════════════════════════════

const CAP_KEY = "cortex_caps_v3";
let captures = [];

function loadCaps() {
  try {
    captures = JSON.parse(localStorage.getItem(CAP_KEY) || "[]");
  } catch {
    captures = [];
  }
  renderCaps();
}

function saveCaps() {
  localStorage.setItem(CAP_KEY, JSON.stringify(captures));
}

function addCapture(cap) {
  if (!["image","video_file"].includes(cap.mediaType)) return;
  captures.unshift(cap);
  if (captures.length > 30) captures = captures.slice(0, 30);
  saveCaps();
  renderCaps();
}

function clearCaptures() {
  if (!captures.length) {
    toast("ℹ️", "Галерея пуста", 2000);
    return;
  }
  openFsOverlay(`
    <div class="fs-title">🗑 Очистить галерею?</div>
    <div class="fs-desc">Все медиа будут удалены</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="doClear()">Очистить</button>
    </div>
  `);
}

function doClear() {
  captures = [];
  saveCaps();
  renderCaps();
  closeFsOverlay();
  toast("✅", "Галерея очищена", 2000);
}

function renderCaps() {
  const gallery = document.getElementById("gallery");
  const empty   = document.getElementById("galEmpty");
  if (!gallery) return;

  if (!captures.length) {
    gallery.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  gallery.innerHTML = "";

  captures.forEach(c => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.onclick = () => openCapViewer(c);

    if (c.mediaType === "image" && c.b64) {
      const img = document.createElement("img");
      img.src = `data:${c.mime};base64,${c.b64}`;
      div.appendChild(img);
    } else if (c.mediaType === "video_file" && c.url) {
      const vid = document.createElement("video");
      vid.src = c.url;
      vid.muted = true;
      div.appendChild(vid);
      const play = document.createElement("div");
      play.className = "thumb-play";
      play.textContent = "▶";
      div.appendChild(play);
    }

    const lbl = document.createElement("div");
    lbl.className = "thumb-lbl";
    lbl.textContent = c.kind || "media";
    div.appendChild(lbl);
    gallery.appendChild(div);
  });
}

function openCapViewer(c) {
  if (c.mediaType === "image" && c.b64) {
    openFsOverlay(`
      <div class="fs-title">📸 ${esc(c.kind || "Фото")}</div>
      <div style="margin:12px 0;border-radius:12px;overflow:hidden">
        <img src="data:${c.mime};base64,${c.b64}" style="width:100%;height:auto;display:block"/>
      </div>
      <div class="fs-actions">
        <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
        <button class="btn ok" onclick="dlCap('${c.b64}','${c.filename || "photo.jpg"}','${c.mime}')">
          📥 Скачать
        </button>
      </div>
    `);
  } else if (c.mediaType === "video_file" && c.url) {
    openFsOverlay(`
      <div class="fs-title">🎥 ${esc(c.kind || "Видео")}</div>
      <div style="margin:12px 0;border-radius:12px;overflow:hidden">
        <video src="${c.url}" controls style="width:100%;display:block"></video>
      </div>
      <div class="fs-actions">
        <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
        <button class="btn ok" onclick="window.open('${c.url}','_blank')">
          📥 Скачать
        </button>
      </div>
    `);
  }
}

function dlCap(b64, filename, mime) {
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅", "Загружено", 2000);
  } catch {
    toast("❌", "Ошибка", 2000);
  }
}

// ═════════════════════════════════════════════════════
// Скриншот
// ═════════════════════════════════════════════════════
async function takeScreenshot() {
  toast("⏳", "Скриншот…");
  const res = await apiPost("/api/exec", { cmd: "screenshot" });
  if (res?.ok && res.data?.b64) {
    const cap = {
      mediaType: "image",
      kind: "screenshot",
      mime: res.data.mime || "image/jpeg",
      b64:  res.data.b64,
      filename: `screenshot_${Date.now()}.jpg`,
      t: Date.now(),
    };
    addCapture(cap);
    toast("✅", "Скриншот готов", 2000);
    openCapViewer(cap);
  } else {
    toast("❌", res?.message || "Ошибка", 3000);
  }
}

// ═════════════════════════════════════════════════════
// Фото
// ═════════════════════════════════════════════════════
async function takePhoto() {
  toast("⏳", "Фото…");
  const res = await apiPost("/api/exec", { cmd: "camera_photo" });
  if (res?.ok && res.data?.b64) {
    const cap = {
      mediaType: "image",
      kind: "camera",
      mime: res.data.mime || "image/jpeg",
      b64:  res.data.b64,
      filename: `photo_${Date.now()}.jpg`,
      t: Date.now(),
    };
    addCapture(cap);
    toast("✅", "Фото готово", 2000);
    openCapViewer(cap);
  } else {
    toast("❌", res?.message || "Ошибка", 3000);
  }
}

// ═════════════════════════════════════════════════════
// Запись
// ═════════════════════════════════════════════════════
function openRecordPicker(type) {
  const title = type === "screen" ? "🎥 Запись экрана" : "🎬 Запись камеры";
  openFsOverlay(`
    <div class="fs-title">${title}</div>
    <div class="fs-desc">Выберите длительность</div>
    <div class="grid g3">
      <button class="btn blue" onclick="startRecord('${type}',5)">5 сек</button>
      <button class="btn blue" onclick="startRecord('${type}',10)">10 сек</button>
      <button class="btn blue" onclick="startRecord('${type}',15)">15 сек</button>
      <button class="btn blue" onclick="startRecord('${type}',30)">30 сек</button>
      <button class="btn blue" onclick="startRecord('${type}',60)">1 мин</button>
      <button class="btn blue" onclick="startRecord('${type}',120)">2 мин</button>
    </div>
  `);
}

async function startRecord(type, sec) {
  closeFsOverlay();
  const cmd     = type === "screen" ? "screen_record" : "camera_record";
  const overlay = document.getElementById("recOverlay");
  const icon    = document.getElementById("recIcon");
  const title   = document.getElementById("recTitle");
  const sub     = document.getElementById("recSub");
  const timer   = document.getElementById("recTimer");
  const bar     = document.getElementById("recBar");

  icon.textContent  = type === "screen" ? "🎥" : "🎬";
  title.textContent = type === "screen" ? "Запись экрана" : "Запись камеры";
  bar.style.width   = "100%";
  overlay.classList.add("show");

  let elapsed = 0;
  const iv = setInterval(() => {
    elapsed++;
    sub.textContent   = `${elapsed} сек`;
    timer.textContent = String(elapsed).padStart(2, "0");
    bar.style.width   = `${100 - (elapsed / sec) * 100}%`;
  }, 1000);

  const res = await apiPost("/api/exec", { cmd, seconds: sec });
  clearInterval(iv);
  overlay.classList.remove("show");

  if (res?.ok && res.data?.url) {
    const cap = {
      mediaType: "video_file",
      kind: cmd,
      url: API_BASE + res.data.url,
      filename: res.data.filename || "record.mp4",
      mime: "video/mp4",
      t: Date.now(),
    };
    addCapture(cap);
    toast("✅", "Запись готова", 2000);
    setTimeout(() => openCapViewer(cap), 300);
  } else {
    toast("❌", res?.message || "Ошибка", 3000);
  }
}

// ═════════════════════════════════════════════════════
// Exports
// ═════════════════════════════════════════════════════
window.loadCaps         = loadCaps;
window.addCapture       = addCapture;
window.clearCaptures    = clearCaptures;
window.openCapViewer    = openCapViewer;
window.takeScreenshot   = takeScreenshot;
window.takePhoto        = takePhoto;
window.openRecordPicker = openRecordPicker;
window.startRecord      = startRecord;