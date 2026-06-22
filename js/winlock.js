// ══════════════════════════════════════════════════════════════
//  WinLock — управление блокировкой
// ══════════════════════════════════════════════════════════════

async function winlockRefresh() {
  try {
    const res = await apiPost("/api/winlock", { op: "status" });
    const locked = !!(res.data?.value?.locked);
    const dot = document.getElementById("wlDot");
    const txt = document.getElementById("wlStatus");
    if (dot) dot.classList.toggle("on", !locked);
    if (txt) txt.textContent = locked ? "Заблокировано" : "Разблокировано";
  } catch { }
}

async function winlockUnlock() {
  await execCmd("winlock_unlock");
  winlockRefresh();
}

function openWinlockSheet() {
  openSheet({
    title: "🔒 WinLock",
    desc: "Настройте блокировку",
    bodyHtml: `
      <div class="flabel">Сообщение на экране</div>
      <input class="inp" id="wlMsg" placeholder="Необязательно"/>
      <div class="flabel mt12">Тип</div>
      <select class="sel" id="wlType" onchange="wlTypeChange()">
        <option value="remote">📱 Только через Telegram</option>
        <option value="password">🔑 С паролем</option>
      </select>
      <div id="wlPwWrap" style="display:none" class="mt12">
        <div class="flabel">Пароль (мин. 4 символа)</div>
        <input class="inp" id="wlPw" placeholder="Пароль"/>
      </div>
      <div class="flabel mt12">Озвучка</div>
      <select class="sel" id="wlVoice">
        <option value="0">🔇 Без</option>
        <option value="1">🔊 С озвучкой</option>
      </select>
    `,
    actions: [
      { text: "Отмена", kind: "accent", onClick: closeSheet },
      { text: "🔒 Заблокировать", kind: "danger", onClick: doWinlockLock }
    ]
  });
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
    toast("❌ Пароль мин. 4 символа", 3000);
    return;
  }
  
  closeSheet();
  const res = await apiPost("/api/exec", { cmd: "winlock_lock", message: msg, lock_type: lt, password: pw, voice: vo });
  const ok = !!res?.ok, m = res?.message || (ok ? "OK" : "Ошибка");
  toast((ok ? "✅ " : "❌ ") + m, 3000);
  winlockRefresh();
}

// Auto-refresh
setInterval(() => winlockRefresh(), 10_000);

window.winlockRefresh = winlockRefresh;
window.winlockUnlock = winlockUnlock;
window.openWinlockSheet = openWinlockSheet;
window.wlTypeChange = wlTypeChange;