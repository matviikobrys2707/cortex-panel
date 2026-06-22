// ══════════════════════════════════════════════════════════════
//  Files — файловый менеджер с ZIP архивацией
// ══════════════════════════════════════════════════════════════

let fbData = { path: "drives", items: [] };
let fbSelected = new Set();
let fbSearch = "";

async function fbNavigate(path) {
  try {
    const res = await apiPost("/api/browse", { path });
    if (!res.ok) throw new Error(res.message);
    const d = res.data;
    fbData = { path: d.path, items: d.items };
    fbSelected.clear();
    fbSearch = "";
    const si = document.getElementById("fbSearch");
    if (si) si.value = "";
    renderFB();
  } catch (e) {
    toast("❌ " + e.message, 4000);
  }
}

function fbFilter(q) {
  fbSearch = q.toLowerCase();
  renderFB();
}

function renderFB() {
  const items = fbData.items.filter(i => !fbSearch || i.name.toLowerCase().includes(fbSearch));
  const pathEl = document.getElementById("fbPath");
  const toolbar = document.getElementById("fbToolbar");
  const list = document.getElementById("fbList");
  const empty = document.getElementById("fbEmpty");
  if (!list) return;

  // Path
  if (pathEl) {
    pathEl.textContent = fbData.path === "drives" ? "💿 Диски" : fbData.path;
  }

  // Toolbar
  if (toolbar) {
    const hasSel = fbSelected.size > 0;
    toolbar.innerHTML = `
      ${fbData.path !== "drives" ? `<button class="fb-tbtn" onclick="fbUp()">⬆️ Вверх</button>` : ""}
      <button class="fb-tbtn" onclick="fbNavigate('drives')">💿 Диски</button>
      <button class="fb-tbtn" onclick="fbMkdir()">📁 Новая папка</button>
      ${hasSel ? `
        <button class="fb-tbtn ok" onclick="fbDownloadSel()">⬇ Скачать</button>
        <button class="fb-tbtn" onclick="fbZipSel()">📦 ZIP</button>
        <button class="fb-tbtn" onclick="fbRenameSel()">✏️ Переименовать</button>
        <button class="fb-tbtn danger" onclick="fbDeleteSel()">🗑 Удалить</button>
      ` : ""}
    `;
  }

  // List
  list.innerHTML = "";
  if (!items.length) {
    empty.style.display = "block";
    return;
  }
  empty.style.display = "none";

  for (const item of items) {
    const isSel = fbSelected.has(item.path);
    const div = document.createElement("div");
    div.className = "fb-item" + (isSel ? " fb-sel" : "");
    div.innerHTML = `
      <div class="fb-ico">${item.is_dir ? "📁" : "📄"}</div>
      <div class="fb-body">
        <div class="fb-name">${esc(item.name)}</div>
        <div class="fb-meta">${esc(item.meta || "")}${item.modified ? " · " + esc(item.modified) : ""}</div>
      </div>
      <div class="fb-arrow">›</div>
    `;
    div.onclick = () => {
      if (item.is_dir) fbNavigate(item.path);
      else fbOpenFile(item);
    };
    div.oncontextmenu = (e) => {
      e.preventDefault();
      fbToggleSel(item.path);
    };
    // Long press → select
    let pressTimer;
    div.addEventListener("touchstart", () => {
      pressTimer = setTimeout(() => fbToggleSel(item.path), 500);
    });
    div.addEventListener("touchend", () => clearTimeout(pressTimer));
    list.appendChild(div);
  }
}

function fbToggleSel(path) {
  if (fbSelected.has(path)) fbSelected.delete(path);
  else fbSelected.add(path);
  renderFB();
  toast(fbSelected.size > 0 ? `Выбрано: ${fbSelected.size}` : "Выбор снят", 1200);
}

function fbUp() {
  if (fbData.path === "drives" || !fbData.path) return fbNavigate("drives");
  const parent = fbData.path.replace(/[/\\][^/\\]+$|[/\\]$/, "");
  if (!parent || parent === fbData.path) return fbNavigate("drives");
  fbNavigate(parent);
}

function fbOpenFile(item) {
  openSheet({
    title: item.name,
    desc: item.meta || "",
    bodyHtml: `<div class="flabel">Путь</div><div style="font-size:11px;color:var(--muted);word-break:break-all">${esc(item.path)}</div>`,
    actions: [
      { text: "⬇ Скачать", kind: "ok", onClick: () => { closeSheet(); fbDownloadFile(item.path); } },
      { text: "📦 ZIP", kind: "blue", onClick: () => { closeSheet(); fbZipFile(item.path); } },
      { text: "✏️ Переименовать", kind: "accent", onClick: () => { closeSheet(); fbRenamePrompt(item.path, item.name); } },
      { text: "🗑 Удалить", kind: "danger", onClick: () => { closeSheet(); fbDeleteFile(item.path); } },
    ]
  });
}

async function fbDownloadFile(path) {
  await execCmd("fb_download", { path });
}

async function fbZipFile(path) {
  await execCmd("fb_zip", { path });
}

function fbRenamePrompt(path, oldName) {
  openSheet({
    title: "Переименовать",
    desc: oldName,
    bodyHtml: `<div class="flabel">Новое имя</div><input class="inp" id="renameInp" value="${esc(oldName)}"/>`,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      {
        text: "✅ OK", kind: "ok", onClick: async () => {
          const n = document.getElementById("renameInp")?.value?.trim();
          if (!n) { toast("❌ Введите имя"); return; }
          closeSheet();
          await execCmd("fb_rename", { path, new_name: n });
          fbNavigate(fbData.path);
        }
      }
    ]
  });
}

async function fbDeleteFile(path) {
  openSheet({
    title: "Удалить?",
    desc: path.split(/[/\\]/).pop() || path,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      {
        text: "🗑 Удалить", kind: "danger", onClick: async () => {
          closeSheet();
          await execCmd("fb_delete", { path });
          fbNavigate(fbData.path);
        }
      }
    ]
  });
}

async function fbDownloadSel() {
  for (const p of fbSelected) await fbDownloadFile(p);
  fbSelected.clear();
  renderFB();
}

async function fbZipSel() {
  if (fbSelected.size === 1) {
    await fbZipFile([...fbSelected][0]);
  } else {
    toast("ZIP нескольких — выберите по одному", 3000);
  }
  fbSelected.clear();
  renderFB();
}

function fbRenameSel() {
  if (fbSelected.size !== 1) {
    toast("❌ Выберите один элемент", 2000);
    return;
  }
  const path = [...fbSelected][0];
  const name = path.split(/[/\\]/).pop() || path;
  fbRenamePrompt(path, name);
}

function fbDeleteSel() {
  openSheet({
    title: "Удалить выбранное?",
    desc: `${fbSelected.size} элементов`,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      {
        text: "🗑 Удалить", kind: "danger", onClick: async () => {
          closeSheet();
          for (const p of fbSelected) await execCmd("fb_delete", { path: p });
          fbSelected.clear();
          fbNavigate(fbData.path);
        }
      }
    ]
  });
}

function fbMkdir() {
  openSheet({
    title: "Новая папка",
    desc: fbData.path,
    bodyHtml: `<div class="flabel">Название</div><input class="inp" id="mkdirInp" placeholder="Имя папки"/>`,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      {
        text: "✅ Создать", kind: "ok", onClick: async () => {
          const n = document.getElementById("mkdirInp")?.value?.trim();
          if (!n) { toast("❌ Введите название"); return; }
          closeSheet();
          await execCmd("fb_mkdir", { path: fbData.path, name: n });
          fbNavigate(fbData.path);
        }
      }
    ]
  });
}

window.fbNavigate = fbNavigate;
window.fbFilter = fbFilter;
window.fbUp = fbUp;
window.fbToggleSel = fbToggleSel;
window.fbDownloadSel = fbDownloadSel;
window.fbZipSel = fbZipSel;
window.fbRenameSel = fbRenameSel;
window.fbDeleteSel = fbDeleteSel;
window.fbMkdir = fbMkdir;