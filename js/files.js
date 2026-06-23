// ══════════════════════════════════════════════════════════════
//  Files — файловый браузер
// ══════════════════════════════════════════════════════════════

let fbCurrentPath = "drives";
let fbItems = [];
let fbLongPressTimer = null;
let fbUploadPath = "";

// ── Навигация ──
async function fbNavigate(path) {
  try {
    toast("⏳", "Загрузка...");
    const res = await apiPost("/api/browse", { path });
    if (!res.ok) {
      toast("❌", res.message || "Ошибка", 3000);
      return;
    }
    const data = res.data || {};
    fbCurrentPath = data.path || "drives";
    fbItems = data.items || [];
    fbUploadPath = fbCurrentPath === "drives" ? "C:\\" : fbCurrentPath;
    fbRender();
    toast("✅", "Загружено", 800);
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

// ── Рендер ──
function fbRender() {
  const pathEl   = document.getElementById("fbPath");
  const listEl   = document.getElementById("fbList");
  const emptyEl  = document.getElementById("fbEmpty");
  const toolEl   = document.getElementById("fbToolbar");

  if (pathEl) {
    pathEl.textContent = fbCurrentPath === "drives"
      ? "💾 Компьютер (диски)"
      : "📂 " + fbCurrentPath;
  }

  if (!listEl) return;
  listEl.innerHTML = "";

  // Кнопка «Назад»
  if (fbCurrentPath !== "drives") {
    const back = _fbRow("⬅️", "Назад", "", false, null);
    back.onclick = () => {
      const parent = fbCurrentPath.includes("\\")
        ? fbCurrentPath.substring(0, fbCurrentPath.lastIndexOf("\\"))
        : "drives";
      fbNavigate(parent || "drives");
    };
    listEl.appendChild(back);
  }

  if (!fbItems.length) {
    if (emptyEl) emptyEl.style.display = "block";
  } else {
    if (emptyEl) emptyEl.style.display = "none";
    fbItems.forEach(it => {
      const row = _fbRow(
        it.is_dir ? "📁" : _fileIco(it.name),
        it.name,
        it.meta || "",
        it.is_dir,
        it
      );
      listEl.appendChild(row);
    });
  }

  // Toolbar загрузки
  if (toolEl) {
    toolEl.innerHTML = "";
  }
}

function _fileIco(name) {
  const ext = name.split(".").pop().toLowerCase();
  const map = {
    txt: "📄", md: "📄", log: "📄",
    jpg: "🖼", jpeg: "🖼", png: "🖼", gif: "🖼", webp: "🖼", bmp: "🖼",
    mp4: "🎥", avi: "🎥", mkv: "🎥", mov: "🎥",
    mp3: "🎵", wav: "🎵", flac: "🎵",
    pdf: "📕", doc: "📘", docx: "📘", xls: "📗", xlsx: "📗", ppt: "📙",
    zip: "🗜", rar: "🗜", "7z": "🗜",
    exe: "⚙️", bat: "⚙️", msi: "⚙️",
    py: "🐍", js: "📜", html: "🌐", css: "🎨", json: "📋",
  };
  return map[ext] || "📄";
}

function _fbRow(ico, name, meta, isDir, item) {
  const div = document.createElement("div");
  div.className = "fb-item";
  div.innerHTML = `
    <div class="fb-ico">${ico}</div>
    <div class="fb-body">
      <div class="fb-name">${esc(name)}</div>
      ${meta ? `<div class="fb-meta">${esc(meta)}</div>` : ""}
    </div>
    <div class="fb-arrow">${isDir ? "›" : ""}</div>
  `;

  if (!item) return div;

  // Клик
  div.addEventListener("click", (e) => {
    if (fbLongPressTimer) return; // был long press — игнорируем
    if (isDir) {
      fbNavigate(item.path);
    } else {
      fbOpenFile(item);
    }
  });

  // Long press (зажатие)
  div.addEventListener("pointerdown", () => {
    fbLongPressTimer = setTimeout(() => {
      fbLongPressTimer = null;
      fbContextMenu(item);
    }, 600);
  });

  div.addEventListener("pointerup", () => {
    clearTimeout(fbLongPressTimer);
    fbLongPressTimer = null;
  });

  div.addEventListener("pointerleave", () => {
    clearTimeout(fbLongPressTimer);
    fbLongPressTimer = null;
  });

  return div;
}

// ── Контекстное меню (зажатие) ──
function fbContextMenu(item) {
  const isDir = item.is_dir;
  openFsOverlay(`
    <div class="fs-title">${_fileIco(item.name)} ${esc(item.name)}</div>
    <div class="fs-desc">${isDir ? "Папка" : (item.meta || "Файл")}</div>
    <div class="grid g2" style="margin-bottom:0">
      ${!isDir ? `
        <button class="btn ok" onclick="closeFsOverlay(); fbOpenFile(${JSON.stringify(item).replace(/"/g, "&quot;")})">
          <span class="bi">👁</span>Открыть
        </button>
        <button class="btn blue" onclick="closeFsOverlay(); fbDownloadFile(${JSON.stringify(item).replace(/"/g, "&quot;")})">
          <span class="bi">📥</span>Скачать
        </button>
      ` : `
        <button class="btn blue" onclick="closeFsOverlay(); fbDownloadDir(${JSON.stringify(item).replace(/"/g, "&quot;")})">
          <span class="bi">📦</span>Скачать ZIP
        </button>
        <button class="btn blue" onclick="closeFsOverlay(); fbNavigate('${esc(item.path)}')">
          <span class="bi">📂</span>Открыть
        </button>
      `}
      <button class="btn warn" onclick="closeFsOverlay(); fbRenamePrompt(${JSON.stringify(item).replace(/"/g, "&quot;")})">
        <span class="bi">✏️</span>Переименовать
      </button>
      <button class="btn danger" onclick="closeFsOverlay(); fbDeleteConfirm(${JSON.stringify(item).replace(/"/g, "&quot;")})">
        <span class="bi">🗑</span>Удалить
      </button>
    </div>
  `);
}

// ── Открыть файл (просмотр текста или скачать) ──
async function fbOpenFile(item) {
  const ext = item.name.split(".").pop().toLowerCase();
  const textExts = ["txt", "md", "log", "py", "js", "html", "css", "json", "xml", "csv", "ini", "cfg", "bat", "sh"];

  if (textExts.includes(ext)) {
    // Загружаем содержимое и показываем
    toast("⏳", "Загрузка...");
    try {
      const res = await execCmd("read_file", { path: item.path });
      if (res?.ok && res.data?.text != null) {
        openFsOverlay(`
          <div class="fs-title">📄 ${esc(item.name)}</div>
          <div style="
            background: rgba(0,0,0,0.4);
            border: 1px solid rgba(124,110,250,0.3);
            border-radius: 12px;
            padding: 14px;
            max-height: 55vh;
            overflow-y: auto;
            margin-bottom: 16px;
          ">
            <pre style="
              font-family: 'SF Mono', monospace;
              font-size: 12px;
              line-height: 1.6;
              color: #e8eeff;
              white-space: pre-wrap;
              word-break: break-word;
              margin: 0;
            ">${esc(res.data.text)}</pre>
          </div>
          <div class="fs-actions">
            <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
            <button class="btn ok" onclick="closeFsOverlay(); fbDownloadFile(${JSON.stringify(item).replace(/"/g, "&quot;")})">📥 Скачать</button>
          </div>
        `);
      } else {
        fbDownloadFile(item);
      }
    } catch {
      fbDownloadFile(item);
    }
    return;
  }

  // Изображения
  const imgExts = ["jpg", "jpeg", "png", "gif", "webp", "bmp"];
  if (imgExts.includes(ext)) {
    toast("⏳", "Загрузка...");
    try {
      const res = await execCmd("read_image", { path: item.path });
      if (res?.ok && res.data?.b64) {
        openFsOverlay(`
          <div class="fs-title">🖼 ${esc(item.name)}</div>
          <div style="margin:12px 0;border-radius:14px;overflow:hidden;max-height:60vh">
            <img src="data:image/${ext};base64,${res.data.b64}" style="width:100%;height:auto;display:block"/>
          </div>
          <div class="fs-actions">
            <button class="btn accent" onclick="closeFsOverlay()">Закрыть</button>
            <button class="btn ok" onclick="closeFsOverlay(); fbDownloadFile(${JSON.stringify(item).replace(/"/g, "&quot;")})">📥 Скачать</button>
          </div>
        `);
        return;
      }
    } catch {}
  }

  // Всё остальное — скачиваем
  fbDownloadFile(item);
}

// ── Скачать файл ──
async function fbDownloadFile(item) {
  toast("⏳", "Подготовка...");
  try {
    const res = await execCmd("download", { path: item.path });
    if (res?.ok && res.data?.url) {
      window.open(API_BASE + res.data.url, "_blank");
      toast("✅", "Файл готов", 2000);
    }
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

// ── Скачать папку как ZIP ──
async function fbDownloadDir(item) {
  toast("⏳", "Создание ZIP...");
  try {
    const res = await execCmd("zip", { path: item.path });
    if (res?.ok && res.data?.url) {
      window.open(API_BASE + res.data.url, "_blank");
      toast("✅", "ZIP готов", 2000);
    }
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

// ── Переименование ──
function fbRenamePrompt(item) {
  openFsOverlay(`
    <div class="fs-title">✏️ Переименовать</div>
    <div class="fs-desc">${esc(item.name)}</div>
    <div class="flabel">Новое имя</div>
    <input class="inp" id="fbNewName" value="${esc(item.name)}" placeholder="Новое имя"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn ok" onclick="fbDoRename(${JSON.stringify(item).replace(/"/g, "&quot;")})">✅ Сохранить</button>
    </div>
  `);
  setTimeout(() => {
    const inp = document.getElementById("fbNewName");
    if (inp) {
      inp.focus();
      const dot = inp.value.lastIndexOf(".");
      inp.setSelectionRange(0, dot > 0 ? dot : inp.value.length);
    }
  }, 100);
}

async function fbDoRename(item) {
  const newName = document.getElementById("fbNewName")?.value?.trim();
  if (!newName || newName === item.name) {
    toast("❌", "Введите новое имя", 2000);
    return;
  }
  closeFsOverlay();
  toast("⏳", "Переименование...");
  const res = await execCmd("rename", { path: item.path, new_name: newName });
  if (res?.ok) {
    toast("✅", "Переименовано", 2000);
    fbNavigate(fbCurrentPath);
  }
}

// ── Удаление ──
function fbDeleteConfirm(item) {
  openFsOverlay(`
    <div class="fs-title">🗑 Удалить?</div>
    <div class="fs-desc">${esc(item.name)}</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="fbDoDelete(${JSON.stringify(item).replace(/"/g, "&quot;")})">✅ Удалить</button>
    </div>
  `);
}

async function fbDoDelete(item) {
  closeFsOverlay();
  toast("⏳", "Удаление...");
  const res = await execCmd("delete", { path: item.path });
  if (res?.ok) {
    toast("✅", "Удалено", 2000);
    fbNavigate(fbCurrentPath);
  }
}

// ── Создать папку ──
function fbCreateFolder() {
  if (fbCurrentPath === "drives") {
    toast("❌", "Выберите диск", 2000);
    return;
  }
  openFsOverlay(`
    <div class="fs-title">📁 Новая папка</div>
    <div class="fs-desc">В: ${esc(fbCurrentPath)}</div>
    <div class="flabel">Название</div>
    <input class="inp" id="fbFolderName" placeholder="Новая папка"/>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn ok" onclick="fbDoCreateFolder()">✅ Создать</button>
    </div>
  `);
  setTimeout(() => document.getElementById("fbFolderName")?.focus(), 100);
}

async function fbDoCreateFolder() {
  const name = document.getElementById("fbFolderName")?.value?.trim();
  if (!name) {
    toast("❌", "Введите название", 2000);
    return;
  }
  closeFsOverlay();
  toast("⏳", "Создание...");
  const res = await execCmd("fb_mkdir", { path: fbCurrentPath, name });
  if (res?.ok) {
    toast("✅", "Папка создана", 2000);
    fbNavigate(fbCurrentPath);
  }
}

// ── Рекурсивный поиск ──
let fbSearchQuery = "";

function fbSearchInput(v) {
  fbSearchQuery = v.trim();
}

async function fbSearchRun() {
  const q = document.getElementById("fbSearch")?.value?.trim();
  if (!q) {
    fbNavigate(fbCurrentPath);
    return;
  }

  if (fbCurrentPath === "drives") {
    toast("❌", "Сначала выберите папку", 2000);
    return;
  }

  toast("⏳", "Поиск...");
  try {
    const res = await execCmd("search_files", { path: fbCurrentPath, query: q });
    if (!res?.ok) {
      toast("❌", res?.message || "Ошибка", 3000);
      return;
    }
    const items = res.data?.items || [];
    fbItems = items;

    const listEl = document.getElementById("fbList");
    const emptyEl = document.getElementById("fbEmpty");
    const pathEl = document.getElementById("fbPath");

    if (pathEl) pathEl.textContent = `🔍 "${q}" в ${fbCurrentPath}`;

    if (!listEl) return;
    listEl.innerHTML = "";

    const back = _fbRow("⬅️", "Назад", "", false, null);
    back.onclick = () => fbNavigate(fbCurrentPath);
    listEl.appendChild(back);

    if (!items.length) {
      if (emptyEl) emptyEl.style.display = "block";
      toast("ℹ️", "Ничего не найдено", 2000);
      return;
    }

    if (emptyEl) emptyEl.style.display = "none";
    toast("✅", `Найдено: ${items.length}`, 2000);

    items.forEach(it => {
      const row = _fbRow(
        it.is_dir ? "📁" : _fileIco(it.name),
        it.path.replace(fbCurrentPath, ""),
        it.meta || "",
        it.is_dir,
        it
      );
      listEl.appendChild(row);
    });
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

// ── Загрузка файла на ПК ──
function openUploadDialog() {
  if (fbCurrentPath === "drives") {
    toast("❌", "Выберите папку для загрузки", 2000);
    return;
  }

  openFsOverlay(`
    <div class="fs-title">📤 Загрузить файл</div>
    <div class="fs-desc">Файл будет сохранён на ПК</div>
    <div class="flabel">Папка назначения</div>
    <input class="inp" id="uploadTargetPath" value="${esc(fbCurrentPath)}"/>
    <div class="mt12"></div>
    <button class="btn ok" style="width:100%" onclick="triggerFileUpload()">
      <span class="bi">📂</span>Выбрать файл
    </button>
    <div class="mt8"></div>
    <div id="uploadStatus" style="font-size:12px;color:var(--muted);text-align:center;min-height:20px;margin-top:8px"></div>
  `);
}

function triggerFileUpload() {
  document.getElementById("fileUploadInput").click();
}

async function handleFileUpload(file) {
  if (!file) return;

  const targetPath = document.getElementById("uploadTargetPath")?.value?.trim() || fbCurrentPath;
  const statusEl = document.getElementById("uploadStatus");

  if (statusEl) statusEl.textContent = `📤 Загрузка: ${file.name}...`;
  toast("⏳", `Загрузка ${file.name}...`);

  try {
    const formData = new FormData();
    formData.append("file", file);
    formData.append("path", targetPath);

    const h = {};
    if (window.tg?.initData) h["X-Tg-Init-Data"] = window.tg.initData;

    const r = await fetch(API_BASE + "/api/upload", {
      method: "POST",
      headers: h,
      body: formData
    });

    const res = await r.json();

    if (res.ok) {
      if (statusEl) statusEl.textContent = `✅ Загружено: ${file.name}`;
      toast("✅", "Файл загружен", 2500);
      setTimeout(() => {
        closeFsOverlay();
        fbNavigate(targetPath);
      }, 1000);
    } else {
      if (statusEl) statusEl.textContent = `❌ Ошибка: ${res.message}`;
      toast("❌", res.message || "Ошибка загрузки", 3000);
    }
  } catch (e) {
    if (statusEl) statusEl.textContent = `❌ ${e.message}`;
    toast("❌", e.message || "Ошибка", 3000);
  }

  // Сбрасываем input
  document.getElementById("fileUploadInput").value = "";
}

window.fbNavigate = fbNavigate;
window.fbRender = fbRender;
window.fbContextMenu = fbContextMenu;
window.fbOpenFile = fbOpenFile;
window.fbDownloadFile = fbDownloadFile;
window.fbDownloadDir = fbDownloadDir;
window.fbRenamePrompt = fbRenamePrompt;
window.fbDoRename = fbDoRename;
window.fbDeleteConfirm = fbDeleteConfirm;
window.fbDoDelete = fbDoDelete;
window.fbCreateFolder = fbCreateFolder;
window.fbDoCreateFolder = fbDoCreateFolder;
window.fbSearchInput = fbSearchInput;
window.fbSearchRun = fbSearchRun;
window.openUploadDialog = openUploadDialog;
window.triggerFileUpload = triggerFileUpload;
window.handleFileUpload = handleFileUpload;