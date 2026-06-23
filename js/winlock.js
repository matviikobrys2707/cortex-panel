// ══════════════════════════════════════════════════════════════
//  WinLock
// ══════════════════════════════════════════════════════════════

async function winlockRefresh() {
  try {
    const res = await apiPost("/api/winlock", { op: "status" });
    const locked = !!(res.data?.value?.locked);
    const dot = document.getElementById("wlDot");
    const txt = document.getElementById("wlStatus");
    if (dot) dot.classList.toggle("on", !locked);
    if (txt) txt.textContent = locked ? "Заблокировано" : "Разблокировано";
  } catch {}
}

function openWinlockMenu() {
  openFsOverlay(`
    <div class="fs-title">🔒 WinLock</div>
    <div class="fs-desc">Настройте блокировку экрана</div>
    
    <div class="flabel">Сообщение на экране</div>
    <input class="inp" id="wlMsg" placeholder="Например: Компьютер заблокирован"/>
    
    <div class="flabel mt12">Тип блокировки</div>
    <select class="sel" id="wlType" onchange="wlTypeChange()">
      <option value="remote">📱 Только через Telegram</option>
      <option value="password">🔑 С паролем</option>
    </select>
    
    <div id="wlPwWrap" style="display:none" class="mt12">
      <div class="flabel">Пароль (мин. 4 символа)</div>
      <input class="inp" id="wlPw" type="password" placeholder="Введите пароль"/>
    </div>
    
    <div class="flabel mt12">Озвучка сообщения</div>
    <select class="sel" id="wlVoice">
      <option value="0">🔇 Без озвучки</option>
      <option value="1">🔊 С озвучкой</option>
    </select>
    
    <div class="fs-actions">
      <button class="btn accent" onclick="closeFsOverlay()">Отмена</button>
      <button class="btn danger" onclick="doWinlockLock()">🔒 Заблокировать</button>
    </div>
  `);
}

function wlTypeChange() {
  const sel = document.getElementById("wlType");
  const wr = document.getElementById("wlPwWrap");
  if (wr) wr.style.display = sel?.value === "password" ? "block" : "none";
}

async function doWinlockLock() {
  const msg = document.getElementById("wlMsg")?.value?.trim() || "";
  const lt = document.getElementById("wlType")?.value || "remote";
  const pw = document.getElementById("wlPw")?.value?.trim() || "";
  const vo = document.getElementById("wlVoice")?.value === "1";

  if (lt === "password" && pw.length < 4) {
    toast("❌", "Пароль минимум 4 символа", 3000);
    return;
  }

  closeFsOverlay();
  toast("⏳", "Блокировка...");

  const res = await apiPost("/api/winlock", {
    op: "lock",
    message: msg,
    lock_type: lt,
    password: pw,
    voice: vo
  });

  const ok = !!res?.ok;
  const m = res?.message || (ok ? "OK" : "Ошибка");
  toast(ok ? "✅" : "❌", m, 3000);
  
  if (ok) {
    setTimeout(() => winlockRefresh(), 500);
  }
}

async function winlockUnlock() {
  toast("⏳", "Разблокировка...");
  const res = await apiPost("/api/winlock", { op: "unlock" });
  const ok = !!res?.ok;
  toast(ok ? "✅" : "❌", res?.message || (ok ? "Разблокировано" : "Ошибка"), 3000);
  if (ok) {
    setTimeout(() => winlockRefresh(), 500);
  }
}

setInterval(() => winlockRefresh(), 10000);

window.winlockRefresh = winlockRefresh;
window.openWinlockMenu = openWinlockMenu;
window.wlTypeChange = wlTypeChange;
window.doWinlockLock = doWinlockLock;
window.winlockUnlock = winlockUnlock;