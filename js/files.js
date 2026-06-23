// ══════════════════════════════════════════════════════════════
//  Files — файловый браузер
// ══════════════════════════════════════════════════════════════

let fbCurrentPath = "drives";
let fbItems = [];
let fbSelected = [];

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
    fbSelected = [];
    fbRender();
    toast("✅", "Загружено", 1000);
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

function fbRender() {
  const pathEl = document.getElementById("fbPath");
  const listEl = document.getElementById("fbList");
  const emptyEl = document.getElementById("fbEmpty");
  const toolEl = document.getElementById("fbToolbar");

  if (pathEl) pathEl.textContent = fbCurrentPath === "drives" ? "💾 Диски" : fbCurrentPath;

  if (!listEl) return;
  listEl.innerHTML = "";

  // Кнопка "Назад"
  if (fbCurrentPath !== "drives") {
    const back = document.createElement("div");
    back.className = "fb-item";
    back.innerHTML = `
      <div class="fb-ico">⬅️</div>
      <div class="fb-body"><div class="fb-name">Назад</div></div>
    `;
    back.onclick = () => {
      if (fbCurrentPath === "drives") return;
      const parent = fbCurrentPath.substring(0, fbCurrentPath.lastIndexOf("\\"));
      fbNavigate(parent || "drives");
    };
    listEl.appendChild(back);
  }

  if (!fbItems.length) {
    if (emptyEl) emptyEl.style.display = "block";
  } else {
    if (emptyEl) emptyEl.style.display = "none";
    fbItems.forEach(it => {
      const div = document.createElement("div");
      div.className = "fb-item";
      if (fbSelected.includes(it.path)) div.classList.add("fb-sel");

      const ico = it.is_dir ? "📁" : "📄";
      div.innerHTML = `
        <div class="fb-ico">${ico}</div>
        <div class="fb-body">
          <div class="fb-name">${esc(it.name)}</div>
          <div class="fb-meta">${it.meta || ""}</div>
        </div>
        <div class="fb-arrow">${it.is_dir ? "›" : ""}</div>
      `;

      div.onclick = (e) => {
        if (e.shiftKey || e.ctrlKey) {
          fbToggleSelect(it.path);
        } else if (it.is_dir) {
          fbNavigate(it.path);
        } else {
          fbOpenFile(it);
        }
      };

      listEl.appendChild(div);
    });
  }

  // Toolbar
  if (toolEl) {
    if (fbSelected.length > 0) {
      toolEl.innerHTML = `
        <button class="fb-tbtn ok" onclick="fbDownloadSelected()">📥 Скачать (${fbSelected.length})</button>
        <button class="fb-tbtn danger" onclick="fbDeleteSelected()">🗑 Удалить</button>
        <button class="fb-tbtn" onclick="fbClearSelection()">✖ Снять выбор</button>
      `;
    } else {
      toolEl.innerHTML = "";
    }
  }
}

function fbToggleSelect(path) {
  const idx = fbSelected.indexOf(path);
  if (idx >= 0) fbSelected.splice(idx, 1);
  else fbSelected.push(path);
  fbRender();
}

function fbClearSelection() {
  fbSelected = [];
  fbRender();
}

async function fbOpenFile(it) {
  toast("⏳", "Скачивание...");
  try {
    const res = await execCmd("download", { path: it.path });
    if (res?.ok && res.data?.url) {
      window.open(API_BASE + res.data.url, "_blank");
      toast("✅", "Файл готов", 2000);
    }
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

async function fbDownloadSelected() {
  if (!fbSelected.length) return;
  if (fbSelected.length === 1) {
    const it = fbItems.find(x => x.path === fbSelected[0]);
    if (it) fbOpenFile(it);
    return;
  }

  toast("⏳", "Создание ZIP...");
  try {
    const res = await execCmd("zip", { paths: fbSelected });
    if (res?.ok && res.data?.url) {
      window.open(API_BASE + res.data.url, "_blank");
      toast("✅", "ZIP готов", 2000);
      fbClearSelection();
    }
  } catch (e) {
    toast("❌", e.message || "Ошибка", 3000);
  }
}

function fbDeleteSelected() {
  if (!fbSelected.length) return;
  openFsOverlay(`
    <div class="fs-title">🗑 Удалить файлы?</div>
    <div class="fs-desc">Будет удалено: ${fbSelected.length} элемент(ов)</div>
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="doFbDelete()">✅ Удалить</button>
    </div>
  `);
}

async function doFbDelete() {
  closeFsOverlay();
  toast("⏳", "Удаление...");
  let ok = 0;
  for (const path of fbSelected) {
    try {
      const res = await execCmd("delete", { path });
      if (res?.ok) ok++;
    } catch {}
  }
  toast("✅", `Удалено: ${ok}/${fbSelected.length}`, 2000);
  fbSelected = [];
  fbNavigate(fbCurrentPath);
}

function fbFilter(q) {
  q = q.toLowerCase().trim();
  document.querySelectorAll(".fb-item").forEach(el => {
    const name = el.querySelector(".fb-name")?.textContent || "";
    el.style.display = name.toLowerCase().includes(q) ? "" : "none";
  });
}

window.fbNavigate = fbNavigate;
window.fbToggleSelect = fbToggleSelect;
window.fbClearSelection = fbClearSelection;
window.fbDownloadSelected = fbDownloadSelected;
window.fbDeleteSelected = fbDeleteSelected;
window.doFbDelete = doFbDelete;
window.fbFilter = fbFilter;
