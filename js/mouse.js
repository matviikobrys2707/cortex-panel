// ══════════════════════════════════════════════════════════════
//  Mouse — ЛКМ/ПКМ/СКМ/Скролл
// ══════════════════════════════════════════════════════════════

async function mouseClick(btn) {
  const cmds = {
    left: "mouse_left",
    right: "mouse_right",
    middle: "mouse_middle"
  };
  await execCmd(cmds[btn] || "mouse_left");
}

async function mouseScroll(dir) {
  await execCmd("mouse_scroll", { direction: dir });
}

window.mouseClick = mouseClick;
window.mouseScroll = mouseScroll;