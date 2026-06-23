// ══════════════════════════════════════════════════════════════
//  Mouse
// ══════════════════════════════════════════════════════════════

let mousePressed = {};

function mouseDown(btn) {
  if (mousePressed[btn]) return;
  mousePressed[btn] = true;
  const el = document.querySelector(`.mouse-btn-${btn}, .mouse-scroll-btn`);
  if (el) el.classList.add("mouse-active");
  execCmd("mouse_down", { button: btn });
}

function mouseUp(btn) {
  if (!mousePressed[btn]) return;
  mousePressed[btn] = false;
  const els = document.querySelectorAll(".mouse-active");
  els.forEach(e => e.classList.remove("mouse-active"));
  execCmd("mouse_up", { button: btn });
}

async function mouseScroll(dir) {
  const el = document.querySelector(`.mouse-wheel[onclick*="${dir}"]`);
  if (el) {
    el.classList.add("mouse-active");
    setTimeout(() => el.classList.remove("mouse-active"), 150);
  }
  await execCmd("mouse_scroll", { direction: dir });
}

// CSS для мыши
const _mouseStyle = document.createElement("style");
_mouseStyle.textContent = `
  .mouse-visual {
    display:flex; flex-direction:column; align-items:center;
    margin:8px 0;
  }
  .mouse-body {
    display:flex; width:160px; height:220px;
    border-radius:80px 80px 50px 50px;
    border:2px solid rgba(124,110,250,.35);
    background:linear-gradient(160deg, rgba(30,41,66,.8), rgba(20,28,50,.95));
    overflow:hidden; position:relative;
    box-shadow:0 8px 32px rgba(0,0,0,.4), inset 0 1px 0 rgba(255,255,255,.08);
  }
  .mouse-btn-left, .mouse-btn-right {
    flex:1; display:flex; align-items:flex-start; justify-content:center;
    padding-top:24px; cursor:pointer; user-select:none;
    font-size:11px; font-weight:900; color:var(--muted);
    transition:background .15s, color .15s;
  }
  .mouse-btn-left {
    border-right:1px solid rgba(124,110,250,.2);
    border-radius:80px 0 0 0;
  }
  .mouse-btn-right {
    border-left:1px solid rgba(124,110,250,.2);
    border-radius:0 80px 0 0;
  }
  .mouse-btn-left:active, .mouse-btn-left.mouse-active {
    background:rgba(90,175,255,.18); color:var(--blue);
  }
  .mouse-btn-right:active, .mouse-btn-right.mouse-active {
    background:rgba(124,110,250,.18); color:#A78BFA;
  }
  .mouse-middle-col {
    display:flex; flex-direction:column; align-items:center;
    justify-content:center; gap:4px; padding:16px 0;
    width:36px; flex-shrink:0;
  }
  .mouse-wheel {
    width:28px; height:28px; border-radius:50%;
    border:1px solid rgba(124,110,250,.25);
    background:rgba(124,110,250,.08);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:12px; color:#A78BFA;
    user-select:none;
    transition:background .12s, transform .1s;
  }
  .mouse-wheel:active, .mouse-wheel.mouse-active {
    background:rgba(124,110,250,.25); transform:scale(.9);
  }
  .mouse-scroll-btn {
    width:28px; height:36px; border-radius:14px;
    border:1px solid rgba(124,110,250,.3);
    background:rgba(124,110,250,.12);
    display:flex; align-items:center; justify-content:center;
    cursor:pointer; font-size:16px; color:#A78BFA;
    user-select:none;
    transition:background .12s;
  }
  .mouse-scroll-btn:active, .mouse-scroll-btn.mouse-active {
    background:rgba(124,110,250,.3);
  }
  .mouse-cable {
    width:8px; height:30px;
    background:linear-gradient(to bottom, rgba(124,110,250,.3), transparent);
    border-radius:0 0 4px 4px;
    margin-top:0;
  }
`;
document.head.appendChild(_mouseStyle);

window.mouseDown = mouseDown;
window.mouseUp = mouseUp;
window.mouseScroll = mouseScroll;