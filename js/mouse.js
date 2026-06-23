// ══════════════════════════════════════════════════════════════
//  Mouse
// ══════════════════════════════════════════════════════════════

async function mouseClick(btn) {
  await execCmd("mouse_click", { button: btn });
}

async function mouseScroll(dir) {
  await execCmd("mouse_scroll", { direction: dir });
}

window.mouseClick = mouseClick;
window.mouseScroll = mouseScroll;
