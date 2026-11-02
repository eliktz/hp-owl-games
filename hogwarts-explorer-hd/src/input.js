// Input: a dynamic virtual joystick (left half of screen) + keyboard (WASD/arrows),
// plus a camera-look drag on the right half. move is a unit-ish {x,y} in screen space.
export class Input {
  constructor(dom = document.body) {
    this.move = { x: 0, y: 0 };     // -1..1, y+ = forward (up on screen)
    this.look = { x: 0, y: 0 };     // consumed per-frame by the camera
    this.keys = {};
    this.joy = { id: null, cx: 0, cy: 0 };
    this.lookId = null; this.lookLast = { x: 0, y: 0 };
    this._initKeyboard();
    this._initTouch(dom);
  }

  _initKeyboard() {
    addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  _joyEl() { return { ring: document.getElementById('joy'), knob: document.getElementById('joyKnob') }; }

  _initTouch(dom) {
    const half = () => window.innerWidth / 2;
    dom.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        // left half -> joystick; right half -> look (unless on a button)
        if (t.target.closest && t.target.closest('.gamebtn')) continue;
        if (t.clientX < half() && this.joy.id === null) {
          this.joy = { id: t.identifier, cx: t.clientX, cy: t.clientY };
          this._place(t.clientX, t.clientY, true);
        } else if (this.lookId === null) {
          this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });

    dom.addEventListener('touchmove', e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          const dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy;
          const max = 55, len = Math.hypot(dx, dy) || 1;
          const cl = Math.min(len, max);
          this.move.x = (dx / len) * (cl / max);
          this.move.y = -(dy / len) * (cl / max);
          this._place(this.joy.cx + dx / len * cl, this.joy.cy + dy / len * cl, false);
        } else if (t.identifier === this.lookId) {
          this.look.x += (t.clientX - this.lookLast.x);
          this.look.y += (t.clientY - this.lookLast.y);
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });

    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.move.x = this.move.y = 0; this._hide(); }
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    dom.addEventListener('touchend', end, { passive: true });
    dom.addEventListener('touchcancel', end, { passive: true });
  }

  _place(cx, cy, showRing) {
    const { ring, knob } = this._joyEl();
    if (!ring) return;
    if (showRing) { ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.classList.add('on'); knob.classList.add('on'); }
    knob.style.left = cx + 'px'; knob.style.top = cy + 'px';
  }
  _hide() { const { ring, knob } = this._joyEl(); if (ring) { ring.classList.remove('on'); knob.classList.remove('on'); } }

  // Combined movement vector from keys + joystick, each frame.
  axis() {
    let x = this.move.x, y = this.move.y;
    if (this.keys['w'] || this.keys['arrowup']) y += 1;
    if (this.keys['s'] || this.keys['arrowdown']) y -= 1;
    if (this.keys['a'] || this.keys['arrowleft']) x -= 1;
    if (this.keys['d'] || this.keys['arrowright']) x += 1;
    const len = Math.hypot(x, y);
    if (len > 1) { x /= len; y /= len; }
    return { x, y, running: !!this.keys['shift'] };
  }

  // Pull & reset the accumulated look delta (for keyboard too via Q/E).
  consumeLook() {
    let { x, y } = this.look;
    if (this.keys['q']) x -= 8; if (this.keys['e']) x += 8;
    this.look.x = 0; this.look.y = 0;
    return { x, y };
  }
}
