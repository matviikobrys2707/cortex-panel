// ══════════════════════════════════════════════════════════════
//  Mouse — зажатие кнопок
// ══════════════════════════════════════════════════════════════

let mousePressed = {};

function mouseDown(btn) {
  if (mousePressed[btn]) return;
  mousePressed[btn] = true;
  execCmd("mouse_down", { button: btn });
}

function mouseUp(btn) {
  if (!mousePressed[btn]) return;
  mousePressed[btn] = false;
  execCmd("mouse_up", { button: btn });
}

async function mouseScroll(dir) {
  await execCmd("mouse_scroll", { direction: dir });
}

window.mouseDown = mouseDown;
window.mouseUp = mouseUp;
window.mouseScroll = mouseScroll;