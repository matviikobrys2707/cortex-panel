// ══════════════════════════════════════════════════════════════
//  Keyboard — стрелки 3x3, комбинации, F-клавиши
// ══════════════════════════════════════════════════════════════

function renderKeyboard() {
  const container = document.getElementById("kbGrid");
  if (!container) return;

  container.innerHTML = `
    <div class="kb-section">
      <div class="kb-section-title">Стрелки</div>
      <div class="kb-arrows">
        <div class="kb-key empty"></div>
        <div class="kb-key blue" onclick="pressKey('up')">⬆</div>
        <div class="kb-key empty"></div>
        <div class="kb-key blue" onclick="pressKey('left')">⬅</div>
        <div class="kb-key accent" onclick="pressKey('space')">Space</div>
        <div class="kb-key blue" onclick="pressKey('right')">➡</div>
        <div class="kb-key empty"></div>
        <div class="kb-key blue" onclick="pressKey('down')">⬇</div>
        <div class="kb-key empty"></div>
      </div>
    </div>

    <div class="kb-section">
      <div class="kb-section-title">Основные</div>
      <div class="grid g3">
        <div class="kb-key ok" onclick="pressKey('enter')">Enter</div>
        <div class="kb-key accent" onclick="pressKey('esc')">Esc</div>
        <div class="kb-key accent" onclick="pressKey('tab')">Tab</div>
        <div class="kb-key blue" onclick="pressKey('backspace')">← Back</div>
        <div class="kb-key blue" onclick="pressKey('delete')">Delete</div>
        <div class="kb-key blue" onclick="pressKey('home')">Home</div>
        <div class="kb-key blue" onclick="pressKey('end')">End</div>
        <div class="kb-key blue" onclick="pressKey('pageup')">PgUp</div>
        <div class="kb-key blue" onclick="pressKey('pagedown')">PgDn</div>
      </div>
    </div>

    <div class="kb-section">
      <div class="kb-section-title">Комбинации</div>
      <div class="grid g3">
        <div class="kb-key ok" onclick="pressKey('ctrl+c')">Ctrl+C</div>
        <div class="kb-key ok" onclick="pressKey('ctrl+v')">Ctrl+V</div>
        <div class="kb-key ok" onclick="pressKey('ctrl+a')">Ctrl+A</div>
        <div class="kb-key accent" onclick="pressKey('ctrl+z')">Ctrl+Z</div>
        <div class="kb-key accent" onclick="pressKey('ctrl+x')">Ctrl+X</div>
        <div class="kb-key accent" onclick="pressKey('ctrl+s')">Ctrl+S</div>
        <div class="kb-key blue" onclick="pressKey('alt+tab')">Alt+Tab</div>
        <div class="kb-key blue" onclick="pressKey('alt+f4')">Alt+F4</div>
        <div class="kb-key blue" onclick="pressKey('win+d')">Win+D</div>
        <div class="kb-key blue" onclick="pressKey('win+l')">Win+L</div>
        <div class="kb-key blue" onclick="pressKey('win+e')">Win+E</div>
        <div class="kb-key blue" onclick="pressKey('ctrl+shift+esc')">Task Mgr</div>
      </div>
    </div>

    <div class="kb-section">
      <div class="kb-section-title">F-клавиши</div>
      <div class="grid g4">
        <div class="kb-key accent" onclick="pressKey('f1')">F1</div>
        <div class="kb-key accent" onclick="pressKey('f2')">F2</div>
        <div class="kb-key accent" onclick="pressKey('f3')">F3</div>
        <div class="kb-key accent" onclick="pressKey('f4')">F4</div>
        <div class="kb-key accent" onclick="pressKey('f5')">F5</div>
        <div class="kb-key accent" onclick="pressKey('f6')">F6</div>
        <div class="kb-key accent" onclick="pressKey('f7')">F7</div>
        <div class="kb-key accent" onclick="pressKey('f8')">F8</div>
        <div class="kb-key accent" onclick="pressKey('f9')">F9</div>
        <div class="kb-key accent" onclick="pressKey('f10')">F10</div>
        <div class="kb-key accent" onclick="pressKey('f11')">F11</div>
        <div class="kb-key accent" onclick="pressKey('f12')">F12</div>
      </div>
    </div>
  `;
}

async function pressKey(key) {
  await execCmd("press_key", { key });
}

async function pressCustomKey() {
  const k = (document.getElementById("customKey")?.value || "").trim();
  if (!k) {
    toast("❌", "Введите клавишу", 2000);
    return;
  }
  await execCmd("press_key", { key: k });
  document.getElementById("customKey").value = "";
}

async function typeText() {
  const t = (document.getElementById("typeText")?.value || "").trim();
  if (!t) {
    toast("❌", "Введите текст", 2000);
    return;
  }
  await execCmd("type_text", { text: t });
  document.getElementById("typeText").value = "";
}

window.renderKeyboard = renderKeyboard;
window.pressKey = pressKey;
window.pressCustomKey = pressCustomKey;
window.typeText = typeText;