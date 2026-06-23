// ══════════════════════════════════════════════════════════════
//  Keyboard — категории клавиш
// ══════════════════════════════════════════════════════════════

const KB_KEYS = {
  nav: [
    { label: "Enter", value: "enter" },
    { label: "Esc", value: "esc" },
    { label: "Tab", value: "tab" },
    { label: "Space", value: "space" },
    { label: "⬆", value: "up" },
    { label: "⬇", value: "down" },
    { label: "⬅", value: "left" },
    { label: "➡", value: "right" },
    { label: "Home", value: "home" },
    { label: "End", value: "end" },
    { label: "PgUp", value: "pageup" },
    { label: "PgDn", value: "pagedown" },
  ],
  combo: [
    { label: "Ctrl+C", value: "ctrl+c" },
    { label: "Ctrl+V", value: "ctrl+v" },
    { label: "Ctrl+A", value: "ctrl+a" },
    { label: "Ctrl+Z", value: "ctrl+z" },
    { label: "Ctrl+X", value: "ctrl+x" },
    { label: "Ctrl+S", value: "ctrl+s" },
    { label: "Ctrl+W", value: "ctrl+w" },
    { label: "Alt+Tab", value: "alt+tab" },
    { label: "Alt+F4", value: "alt+f4" },
    { label: "Win+D", value: "win+d" },
    { label: "Win+L", value: "win+l" },
    { label: "Win+E", value: "win+e" },
  ],
  fn: [
    { label: "F1", value: "f1" },
    { label: "F2", value: "f2" },
    { label: "F3", value: "f3" },
    { label: "F4", value: "f4" },
    { label: "F5", value: "f5" },
    { label: "F6", value: "f6" },
    { label: "F7", value: "f7" },
    { label: "F8", value: "f8" },
    { label: "F9", value: "f9" },
    { label: "F10", value: "f10" },
    { label: "F11", value: "f11" },
    { label: "F12", value: "f12" },
  ],
};

let currentKbCat = "nav";

function switchKbCat(cat, el) {
  currentKbCat = cat;
  document.querySelectorAll(".kb-cat").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  renderKeyboard();
}

function renderKeyboard() {
  const container = document.getElementById("kbGrid");
  if (!container) return;

  const keys = KB_KEYS[currentKbCat] || [];
  container.innerHTML = "";

  keys.forEach(k => {
    const btn = document.createElement("button");
    btn.className = "kb-key";
    btn.textContent = k.label;
    btn.onclick = () => pressKey(k.value);
    container.appendChild(btn);
  });
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

window.switchKbCat = switchKbCat;
window.renderKeyboard = renderKeyboard;
window.pressKey = pressKey;
window.pressCustomKey = pressCustomKey;
window.typeText = typeText;
