// ══════════════════════════════════════════════════════════════
//  Keyboard — клавиши + печать текста
// ══════════════════════════════════════════════════════════════

const KEYS = [
  { label: "Enter", value: "enter" },
  { label: "Esc", value: "esc" },
  { label: "Tab", value: "tab" },
  { label: "Space", value: "space" },
  { label: "⬆", value: "up" },
  { label: "⬇", value: "down" },
  { label: "⬅", value: "left" },
  { label: "➡", value: "right" },
  { label: "Ctrl+C", value: "ctrl+c" },
  { label: "Ctrl+V", value: "ctrl+v" },
  { label: "Ctrl+A", value: "ctrl+a" },
  { label: "Ctrl+Z", value: "ctrl+z" },
  { label: "Alt+Tab", value: "alt+tab" },
  { label: "Win+D", value: "win+d" },
  { label: "Win+L", value: "win+l" },
  { label: "F5", value: "f5" },
];

async function pressKey(key) {
  await execCmd("key:" + key);
}

async function typeText() {
  const t = (document.getElementById("typeText")?.value || "").trim();
  if (!t) {
    toast("❌ Введите текст");
    return;
  }
  await execCmd("type:" + t);
  document.getElementById("typeText").value = "";
}

function renderKeyboard() {
  const container = document.getElementById("keyboardGrid");
  if (!container) return;

  container.innerHTML = "";
  KEYS.forEach(k => {
    const btn = document.createElement("button");
    btn.className = "btn blue";
    btn.textContent = k.label;
    btn.onclick = () => pressKey(k.value);
    container.appendChild(btn);
  });
}

window.pressKey = pressKey;
window.typeText = typeText;
window.renderKeyboard = renderKeyboard;