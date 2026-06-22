// ══════════════════════════════════════════════════════════════
//  Capture — скрины, камера, запись
// ══════════════════════════════════════════════════════════════

const CAP_KEY = "cortex_caps_v5";
let captures = [];

function loadCaps() {
  try {
    captures = JSON.parse(sessionStorage.getItem(CAP_KEY) || "[]");
  } catch {
    captures = [];
  }
  renderCaps();
}

function saveCaps() {
  sessionStorage.setItem(CAP_KEY, JSON.stringify(captures.slice(0, 30)));
}

function clearCaptures() {
  captures = [];
  saveCaps();
  renderCaps();
  toast("Галерея очищена");
}

function addCapture(cap) {
  captures.unshift(cap);
  captures = captures.slice(0, 30);
  saveCaps();
  renderCaps();
}

function renderCaps() {
  const g = document.getElementById("gallery");
  const empty = document.getElementById("galEmpty");
  if (!g) return;

  if (!captures.length) {
    g.innerHTML = "";
    if (empty) empty.style.display = "block";
    return;
  }
  if (empty) empty.style.display = "none";

  g.innerHTML = "";
  for (const c of captures) {
    const div = document.createElement("div");
    div.className = "thumb";
    const lbl = c.kind === "screenshot" ? "Скрин" : c.kind === "camera_photo" ? "Камера" : "Видео";
    const t = new Date(c.t).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

    if (c.type === "image") {
      div.innerHTML = `<img src="data:${c.mime};base64,${c.b64}"/><div class="thumb-lbl">${lbl} · ${t}</div>`;
      div.onclick = () => openImgViewer(c);
    } else {
      div.innerHTML = `<div style="height:100%;display:flex;align-items:center;justify-content:center;background:rgba(255,255,255,.04)"><div class="thumb-play">▶</div></div><div class="thumb-lbl">${lbl} · ${t}</div>`;
      div.onclick = () => openFileViewer(c);
    }
    g.appendChild(div);
  }
}

async function dlB64({ b64, mime, filename }) {
  const bin = atob(b64), bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: mime }));
  const a = Object.assign(document.createElement("a"), { href: url, download: filename || "file" });
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function openImgViewer(c) {
  openSheet({
    title: c.kind === "screenshot" ? "Скриншот" : "Фото",
    desc: new Date(c.t).toLocaleString(),
    bodyHtml: `<div class="viewer"><img src="data:${c.mime};base64,${c.b64}"/></div>`,
    actions: [
      { text: "💾 Скачать", kind: "ok", onClick: async () => { await dlB64(c); } },
      { text: "Закрыть", kind: "accent", onClick: closeSheet }
    ]
  });
}

function openFileViewer(c) {
  const isVid = (c.mime || "").includes("video");
  openSheet({
    title: c.filename || "Файл",
    desc: c.url || "",
    bodyHtml: `${isVid ? `<div class="viewer"><video controls src="${c.url}"></video></div>` : ""}<div style="font-size:11px;color:var(--muted);word-break:break-all;margin-top:8px">${esc(c.url || "")}</div>`,
    actions: [
      { text: "⬇ Скачать", kind: "ok", onClick: () => window.open(c.url, "_blank") },
      { text: "📋 Копировать", kind: "blue", onClick: async () => { await copyText(c.url || ""); } },
      { text: "Закрыть", kind: "accent", onClick: closeSheet }
    ]
  });
}

// ── Record overlay ──
let _recInterval = null;

function showRecOverlay(title, icon, seconds) {
  document.getElementById("recTitle").textContent = title;
  document.getElementById("recIcon").textContent = icon;
  document.getElementById("recSub").textContent = seconds + " сек";
  document.getElementById("recTimer").textContent = String(seconds).padStart(2, "0");
  document.getElementById("recBar").style.width = "100%";
  document.getElementById("recOverlay").classList.add("show");

  let left = seconds;
  _recInterval = setInterval(() => {
    left--;
    document.getElementById("recTimer").textContent = String(left).padStart(2, "0");
    const pct = (left / seconds) * 100;
    document.getElementById("recBar").style.width = pct + "%";
    if (left <= 0) {
      clearInterval(_recInterval);
      hideRecOverlay();
    }
  }, 1000);
}

function hideRecOverlay() {
  clearInterval(_recInterval);
  document.getElementById("recOverlay").classList.remove("show");
}

function openRecordPicker(kind) {
  const cmd = kind === "screen" ? "record_start_buttons" : "camera_record";
  const title = kind === "screen" ? "🎥 Запись экрана" : "🎬 Запись с камеры";
  const icon = kind === "screen" ? "🎥" : "🎬";

  openSheet({
    title,
    desc: "Выбери длительность",
    bodyHtml: `
      <div class="grid g4" style="margin-bottom:10px">
        ${[5, 10, 15, 30].map(s => `<button class="btn ok" onclick="startRecord('${cmd}','${title}','${icon}',${s})"><span class="bi">▶</span>${s}с</button>`).join("")}
      </div>
      <div class="grid g3">
        ${[45, 60, 90].map(s => `<button class="btn blue" onclick="startRecord('${cmd}','${title}','${icon}',${s})"><span class="bi">▶</span>${s}с</button>`).join("")}
      </div>
      <div class="mt12"></div>
      <div class="flabel">Своё (1..120 сек)</div>
      <div class="row">
        <input class="inp" id="customSec" type="number" min="1" max="120" placeholder="Секунды"/>
        <button class="btn accent" style="min-width:80px;min-height:44px" onclick="startRecordCustom('${cmd}','${title}','${icon}')">Старт</button>
      </div>
    `,
    actions: [{ text: "Закрыть", kind: "accent", onClick: closeSheet }]
  });
}

function startRecordCustom(cmd, title, icon) {
  const v = Number(document.getElementById("customSec")?.value || 0);
  if (!v || v < 1 || v > 120) {
    toast("❌ Секунды 1..120");
    return;
  }
  startRecord(cmd, title, icon, v);
}

async function startRecord(cmd, title, icon, seconds) {
  closeSheet();
  showRecOverlay(title, icon, seconds);
  
  // ✅ ИСПРАВЛЕНИЕ: передаём seconds правильно
  const res = await execCmd(cmd, { seconds: seconds });
  
  hideRecOverlay();
  if (!res) return;
}

window.loadCaps = loadCaps;
window.addCapture = addCapture;
window.clearCaptures = clearCaptures;
window.openImgViewer = openImgViewer;
window.openFileViewer = openFileViewer;
window.openRecordPicker = openRecordPicker;
window.startRecord = startRecord;
window.startRecordCustom = startRecordCustom;