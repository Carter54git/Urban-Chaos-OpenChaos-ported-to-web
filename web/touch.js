// On-screen touch controls for Urban Chaos Web.
//
// The controls are exposed to the game as a virtual "standard" gamepad through
// the Gamepad API, so the engine's own gamepad code handles them: analog
// movement, camera look, menus and driving all behave exactly like a real pad.
'use strict';
(() => {
  const STANDARD = {
    A: 0, B: 1, X: 2, Y: 3, L1: 4, R1: 5, L2: 6, R2: 7, SELECT: 8, START: 9, L3: 10, R3: 11,
    UP: 12, DOWN: 13, LEFT: 14, RIGHT: 15,
  };
  const STICK_RADIUS = 60;
  const LOOK_SCALE = 1 / 45; // px of drag per unit of right-stick deflection

  const buttons = Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 }));
  const axes = [0, 0, 0, 0];
  const pad = {
    id: 'Touch Controls (STANDARD GAMEPAD Vendor: 0000 Product: 0000)',
    index: 0, connected: true, mapping: 'standard', timestamp: performance.now(),
    axes, buttons, vibrationActuator: null,
  };
  let enabled = false;

  const realGetGamepads = navigator.getGamepads ? navigator.getGamepads.bind(navigator) : () => [];
  navigator.getGamepads = () => {
    const real = Array.from(realGetGamepads());
    if (!enabled) return real;
    let slot = real.findIndex((g) => !g);
    if (slot < 0) slot = real.length;
    pad.index = slot;
    real[slot] = pad;
    return real;
  };
  const touched = () => { pad.timestamp = performance.now(); };

  function setButton(i, down) {
    buttons[i].pressed = buttons[i].touched = down;
    buttons[i].value = down ? 1 : 0;
    touched();
  }

  // ---- DOM -----------------------------------------------------------------
  const css = `
  #tc { position: fixed; inset: 0; z-index: 5; display: none; touch-action: none; user-select: none;
    -webkit-user-select: none; -webkit-touch-callout: none; font: 600 13px system-ui, sans-serif; color: #fff; }
  #tc.on { display: block; }
  #tc .zone { position: absolute; top: 0; bottom: 0; }
  #tc .move { left: 0; width: 45%; }
  #tc .look { right: 0; width: 55%; }
  #tc .base, #tc .knob { position: absolute; border-radius: 50%; pointer-events: none; transform: translate(-50%, -50%); }
  #tc .base { width: ${STICK_RADIUS * 2}px; height: ${STICK_RADIUS * 2}px; border: 2px solid rgba(255,255,255,.25);
    background: rgba(255,255,255,.06); display: none; }
  #tc .knob { width: 54px; height: 54px; background: rgba(255,255,255,.3); display: none; }
  #tc .hint { position: absolute; left: 30px; bottom: 30px; width: 120px; height: 120px; border-radius: 50%;
    border: 2px dashed rgba(255,255,255,.18); pointer-events: none; }
  #tc .b { position: absolute; display: grid; place-items: center; border-radius: 50%; background: rgba(20,20,24,.45);
    border: 2px solid rgba(255,255,255,.28); text-shadow: 0 1px 2px #000; box-sizing: border-box; pointer-events: auto; }
  #tc .b.down { background: rgba(200,16,46,.6); border-color: rgba(255,90,110,.9); }
  #tc .b.sq { border-radius: 10px; }
  @media (orientation: portrait) { #tc-rotate { display: grid !important; } }
  #tc-rotate { position: fixed; inset: 0; z-index: 20; display: none; place-items: center; background: #000e;
    color: #ddd; font: 18px system-ui, sans-serif; text-align: center; padding: 30px; }
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const root = document.createElement('div');
  root.id = 'tc';
  root.innerHTML = '<div class="zone move"></div><div class="zone look"></div><div class="hint"></div>' +
    '<div class="base"></div><div class="knob"></div>';
  const rotate = document.createElement('div');
  rotate.id = 'tc-rotate';
  rotate.textContent = (typeof OC_TEXT !== 'undefined' && OC_TEXT.rotate) || 'Rotate your device to landscape';

  // [label, gamepad button, right, bottom, size, square?]  (positions in px from the bottom-right)
  const LAYOUT = [
    ['JUMP', STANDARD.A, 92, 24, 70],
    ['RUN', STANDARD.B, 24, 92, 62],
    ['USE', STANDARD.X, 160, 92, 62],
    ['HIDE', STANDARD.Y, 92, 160, 58],
    ['PUNCH', STANDARD.R2, 24, 196, 62],
    ['KICK', STANDARD.R1, 104, 236, 56],
    ['AIM', STANDARD.L1, 236, 30, 54],
    ['REV', STANDARD.L2, 236, 100, 50],
    ['GUN', STANDARD.R3, 184, 236, 50],
  ];
  const TOP = [
    ['❚❚', STANDARD.START, 'right', 14, 48],
    ['TAB', STANDARD.SELECT, 'right', 72, 48],
  ];
  const DPAD = [['▲', STANDARD.UP, 0, -1], ['▼', STANDARD.DOWN, 0, 1], ['◀', STANDARD.LEFT, -1, 0], ['▶', STANDARD.RIGHT, 1, 0]];

  // Button groups are laid out for a ~600px tall screen and scaled to fit (see fit()).
  function group(styleText) {
    const g = document.createElement('div');
    g.className = 'grp';
    g.style.cssText = 'position:absolute;pointer-events:none;' + styleText;
    root.appendChild(g);
    return g;
  }
  const right = group('right:0;bottom:0;width:310px;height:310px;transform-origin:100% 100%');
  const topRight = group('right:0;top:0;width:140px;height:60px;transform-origin:100% 0');
  const topLeft = group('left:0;top:0;width:170px;height:160px;transform-origin:0 0');

  const btnEls = [];
  function addButton(parent, label, idx, styleText, square) {
    const el = document.createElement('div');
    el.className = 'b' + (square ? ' sq' : '');
    el.textContent = label;
    el.style.cssText = styleText;
    if (idx >= 0) {
      el.dataset.btn = idx;
      btnEls.push(el);
    }
    parent.appendChild(el);
    return el;
  }
  for (const [label, idx, r, b, s] of LAYOUT) {
    addButton(right, label, idx, `right:${r}px;bottom:${b}px;width:${s}px;height:${s}px;font-size:${s > 60 ? 13 : 11}px`);
  }
  for (const [label, idx, , off, s] of TOP) {
    addButton(topRight, label, idx, `right:${off}px;top:12px;width:${s}px;height:${s - 12}px;font-size:12px`, true);
  }
  for (const [label, idx, dx, dy] of DPAD) {
    addButton(topLeft, label, idx, `left:${84 + dx * 44}px;top:${92 + dy * 44}px;width:40px;height:40px;font-size:14px`, true);
  }
  const fsBtn = addButton(topLeft, '⛶', -1, 'left:14px;top:12px;width:40px;height:36px;font-size:18px', true);

  function fit() {
    const s = Math.max(0.55, Math.min(1, innerHeight / 600, innerWidth / 1000));
    for (const g of [right, topRight, topLeft]) g.style.transform = `scale(${s})`;
  }
  fit();
  addEventListener('resize', fit);

  // ---- Touch tracking -------------------------------------------------------
  const base = root.querySelector('.base');
  const knob = root.querySelector('.knob');
  const hint = root.querySelector('.hint');
  const touches = new Map(); // identifier -> {kind, ...}

  function buttonAt(x, y) {
    // Generous hit test: nearest button within 1.25x its radius.
    let best = null, bestD = Infinity;
    for (const el of btnEls) {
      const r = el.getBoundingClientRect();
      const cx = r.left + r.width / 2, cy = r.top + r.height / 2;
      const d = Math.hypot(x - cx, y - cy);
      if (d < Math.max(r.width, r.height) * 0.62 && d < bestD) { best = el; bestD = d; }
    }
    return best;
  }
  function pressEl(el, down) {
    el.classList.toggle('down', down);
    setButton(+el.dataset.btn, down);
  }
  function holdCount(el) {
    let n = 0;
    for (const t of touches.values()) if (t.kind === 'btn' && t.el === el) n++;
    return n;
  }

  function onStart(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const x = t.clientX, y = t.clientY;
      if (fsBtn.contains(document.elementFromPoint(x, y))) { toggleFullscreen(); continue; }
      const el = buttonAt(x, y);
      if (el) {
        touches.set(t.identifier, { kind: 'btn', el });
        pressEl(el, true);
        if (navigator.vibrate) navigator.vibrate(8);
      } else if (x < innerWidth * 0.45 && !touchesHave('move')) {
        touches.set(t.identifier, { kind: 'move', ox: x, oy: y });
        base.style.left = knob.style.left = x + 'px';
        base.style.top = knob.style.top = y + 'px';
        base.style.display = knob.style.display = 'block';
        hint.style.display = 'none';
      } else if (!touchesHave('look')) {
        touches.set(t.identifier, { kind: 'look', lx: x, ly: y });
      }
    }
  }
  function touchesHave(kind) {
    for (const t of touches.values()) if (t.kind === kind) return true;
    return false;
  }
  function onMove(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      if (s.kind === 'move') {
        let dx = t.clientX - s.ox, dy = t.clientY - s.oy;
        const len = Math.hypot(dx, dy);
        if (len > STICK_RADIUS) { dx *= STICK_RADIUS / len; dy *= STICK_RADIUS / len; }
        knob.style.left = s.ox + dx + 'px';
        knob.style.top = s.oy + dy + 'px';
        axes[0] = dx / STICK_RADIUS;
        axes[1] = dy / STICK_RADIUS;
        touched();
      } else if (s.kind === 'look') {
        const dx = t.clientX - s.lx, dy = t.clientY - s.ly;
        s.lx = t.clientX; s.ly = t.clientY;
        // Drag speed -> right stick deflection, decayed every frame below.
        axes[2] = Math.max(-1, Math.min(1, axes[2] + dx * LOOK_SCALE));
        axes[3] = Math.max(-1, Math.min(1, axes[3] + dy * LOOK_SCALE));
        touched();
      } else if (s.kind === 'btn') {
        // Slide between buttons (e.g. JUMP -> RUN) without lifting the finger.
        const el = buttonAt(t.clientX, t.clientY);
        if (el && el !== s.el) {
          const old = s.el;
          s.el = el;
          if (!holdCount(old)) pressEl(old, false);
          pressEl(el, true);
        }
      }
    }
  }
  function onEnd(e) {
    e.preventDefault();
    for (const t of e.changedTouches) {
      const s = touches.get(t.identifier);
      if (!s) continue;
      touches.delete(t.identifier);
      if (s.kind === 'move') {
        axes[0] = axes[1] = 0;
        base.style.display = knob.style.display = 'none';
        hint.style.display = '';
        touched();
      } else if (s.kind === 'look') {
        axes[2] = axes[3] = 0;
        touched();
      } else if (s.kind === 'btn' && !holdCount(s.el)) {
        pressEl(s.el, false);
      }
    }
  }
  root.addEventListener('touchstart', onStart, { passive: false });
  root.addEventListener('touchmove', onMove, { passive: false });
  root.addEventListener('touchend', onEnd, { passive: false });
  root.addEventListener('touchcancel', onEnd, { passive: false });
  root.addEventListener('contextmenu', (e) => e.preventDefault());

  (function decay() {
    if (touchesHave('look')) {
      axes[2] *= 0.6; axes[3] *= 0.6;
      if (Math.abs(axes[2]) < 0.02) axes[2] = 0;
      if (Math.abs(axes[3]) < 0.02) axes[3] = 0;
      touched();
    }
    requestAnimationFrame(decay);
  })();

  function releaseAll() {
    touches.clear();
    axes.fill(0);
    for (const el of btnEls) pressEl(el, false);
    base.style.display = knob.style.display = 'none';
  }
  addEventListener('blur', releaseAll);
  document.addEventListener('visibilitychange', () => { if (document.hidden) releaseAll(); });

  function toggleFullscreen() {
    const d = document.documentElement;
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen).call(document);
    } else if (d.requestFullscreen || d.webkitRequestFullscreen) {
      Promise.resolve((d.requestFullscreen || d.webkitRequestFullscreen).call(d, { navigationUI: 'hide' }))
        .then(() => screen.orientation && screen.orientation.lock && screen.orientation.lock('landscape'))
        .catch(() => {});
    }
  }

  // ---- Public API ------------------------------------------------------------
  // Primary input is touch (phones, tablets). Touch-capable laptops get the
  // controls on their first touch instead (see game.html).
  const isTouchDevice = matchMedia('(pointer: coarse)').matches;
  window.OCTouch = {
    isTouchDevice,
    toggleFullscreen,
    // Must run before the engine starts so SDL sees the pad at init.
    enable() {
      if (enabled) return;
      enabled = true;
      document.body.appendChild(root);
      document.body.appendChild(rotate);
      root.classList.add('on');
      const ev = new Event('gamepadconnected');
      ev.gamepad = pad;
      dispatchEvent(ev);
    },
    setVisible(v) { root.classList.toggle('on', v); if (!v) releaseAll(); },
  };
})();
