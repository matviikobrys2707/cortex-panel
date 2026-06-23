// ══════════════════════════════════════════════════════════════
//  Capture — галерея
// ══════════════════════════════════════════════════════════════

const CAP_KEY = "cortex_captures_v1";
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
  captures.unshift(cap);
  if (captures.length > 50) captures = captures.slice(0, 50);
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
      <button class="btn danger" onclick="doClearCaptures()">✅ Очистить</button>
    </div>
  `);
}

function doClearCaptures() {
  captures = [];
  saveCaps();
  renderCaps();
  closeFsOverlay();
  toast("✅", "Галерея очищена", 2000);
}

function renderCaps() {
  const gallery = document.getElementById("gallery");
  const empty = document.getElementById("galEmpty");
  if (!gallery) return;

  if (!captures.length) {
    gallery.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }

  if (empty) empty.style.display = "none";
  gallery.innerHTML = "";

  captures.forEach((c) => {
    const div = document.createElement("div");
    div.className = "thumb";
    div.onclick = () => openCapViewer(c);

    if (c.type === "image" && c.b64) {
      const img = document.createElement("img");
      img.src = `data:${c.mime};base64,${c.b64}`;
      div.appendChild(img);
    } else if (c.type === "file" && c.url) {
      if (c.mime.startsWith("video/")) {
        const vid = document.createElement("video");
        vid.src = c.url;
        vid.muted = true;
        div.appendChild(vid);
        const play = document.createElement("div");
        play.className = "thumb-play";
        play.textContent = "▶";
        div.appendChild(play);
      } else {
        const ico = document.createElement("div");
        ico.style = "display:flex;align-items:center;justify-content:center;height:100%;font-size:32px;";
        ico.textContent = "📄";
        div.appendChild(ico);
      }
    }

    const lbl = document.createElement("div");
    lbl.className = "thumb-lbl";
    lbl.textContent = c.kind || "media";
    div.appendChild(lbl);

    gallery.appendChild(div);
  });
}

function openCapViewer(c) {
  let content = "";

  if (c.type === "image" && c.b64) {
    content = `
      <div class="fs-title">📸 ${esc(c.kind || "Изображение")}</div>
      <div style="margin:12px 0;border-radius:14px;overflow:hidden;max-height:60vh">
        <img src="data:${c.mime};base64,${c.b64}" style="width:100%;height:auto;display:block"/>
      </div>
      <div class="fs-actions">
        <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
        <button class="btn ok" onclick="downloadCapture('${c.b64}','${c.filename}','${c.mime}')">📥 Скачать</button>
      </div>
    `;
  } else if (c.type === "file" && c.url) {
    if (c.mime.startsWith("video/")) {
      content = `
        <div class="fs-title">🎥 ${esc(c.kind || "Видео")}</div>
        <div style="margin:12px 0;border-radius:14px;overflow:hidden;max-height:60vh">
          <video src="${c.url}" controls style="width:100%;height:auto;display:block"></video>
        </div>
        <div class="fs-actions">
          <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
          <button class="btn ok" onclick="window.open('${c.url}','_blank')">📥 Скачать</button>
        </div>
      `;
    } else {
      content = `
        <div class="fs-title">📄 ${esc(c.filename || "Файл")}</div>
        <div class="fs-desc">Размер: ${formatSize(c.size || 0)}</div>
        <div class="fs-actions">
          <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
          <button class="btn ok" onclick="window.open('${c.url}','_blank')">📥 Скачать</button>
        </div>
      `;
    }
  }

  openFsOverlay(content);
}

function downloadCapture(b64, filename, mime) {
  try {
    const bin = atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) arr[i] = bin.charCodeAt(i);
    const blob = new Blob([arr], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    toast("✅", "Скачивание началось", 2000);
  } catch (e) {
    toast("❌", "Ошибка скачивания", 3000);
  }
}

function formatSize(n) {
  if (n >= 1 << 30) return (n / (1 << 30)).toFixed(2) + " GB";
  if (n >= 1 << 20) return (n / (1 << 20)).toFixed(1) + " MB";
  if (n >= 1 << 10) return (n / (1 << 10)).toFixed(1) + " KB";
  return n + " B";
}

function openRecordPicker(type) {
  const title = type === "screen" ? "🎥 Запись экрана" : "🎬 Запись с камеры";
  openFsOverlay(`
    <div class="fs-title">${title}</div>
    <div class="fs-desc">Выберите длительность записи</div>
    <div class="grid g3" style="margin-bottom:12px">
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
  
  const cmd = type === "screen" ? "screen_record" : "camera_record";
  const overlay = document.getElementById("recOverlay");
  const icon = document.getElementById("recIcon");
  const title = document.getElementById("recTitle");
  const sub = document.getElementById("recSub");
  const timer = document.getElementById("recTimer");
  const bar = document.getElementById("recBar");

  icon.textContent = type === "screen" ? "🎥" : "🎬";
  title.textContent = type === "screen" ? "Запись экрана" : "Запись камеры";
  overlay.classList.add("show");

  let elapsed = 0;
  const interval = setInterval(() => {
    elapsed++;
    sub.textContent = `${elapsed} сек`;
    timer.textContent = String(elapsed).padStart(2, "0");
    bar.style.width = `${(elapsed / sec) * 100}%`;
  }, 1000);

  const res = await execCmd(cmd, { seconds: sec });

  clearInterval(interval);
  overlay.classList.remove("show");

  if (res?.ok && res.data?.url) {
    const cap = {
      t: Date.now(),
      kind: cmd,
      type: "file",
      url: API_BASE + res.data.url,
      filename: res.data.filename || "record.mp4",
      mime: res.data.mime || "video/mp4",
      size: res.data.size || 0
    };
    addCapture(cap);
    setTimeout(() => openCapViewer(cap), 500);
  }
}

window.loadCaps = loadCaps;
window.addCapture = addCapture;
window.clearCaptures = clearCaptures;
window.openCapViewer = openCapViewer;
window.openRecordPicker = openRecordPicker;
window.startRecord = startRecord;