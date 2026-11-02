// Input: a dynamic virtual joystick (left half) with acceleration/dead-zone, a camera
// look-drag (right half / mouse), two-finger pinch + wheel zoom, and keyboard (WASD move,
// arrows/Q/E orbit, +/- zoom). Joystick, look and pinch touches are tracked by pointer id
// so they never fight each other on an iPad (true multitouch).
const DEADZONE = 0.12;
const now = () => performance.now();

export class Input {
  constructor(dom = document.body) {
    this.target = { x: 0, y: 0 };   // joystick's raw intent (-1..1)
    this.cur = { x: 0, y: 0 };      // smoothed movement (accel/decel)
    this.look = { x: 0, y: 0 };     // accumulated orbit delta, consumed per frame
    this.zoomAcc = 0;               // accumulated zoom delta, consumed per frame
    this.keys = {};
    this.joy = { id: null, cx: 0, cy: 0 };
    this.lookId = null; this.lookLast = { x: 0, y: 0 };
    this.pinch = { a: null, b: null, dist: 0 };
    this._t = now();
    this._initKeyboard();
    this._initTouch(dom);
    this._initMouse(dom);
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
        if (t.target.closest && t.target.closest('.gamebtn')) continue;
        if (t.clientX < half() && this.joy.id === null) {
          this.joy = { id: t.identifier, cx: t.clientX, cy: t.clientY };
          this._place(t.clientX, t.clientY, true);
        } else if (this.lookId === null) {
          this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY };
        } else if (this.pinch.a === null) {
          // a second right-side finger starts a pinch-zoom with the look finger
          this.pinch.a = this.lookId; this.pinch.b = t.identifier;
          this.pinch.dist = this._touchDist(e, this.pinch.a, this.pinch.b);
        }
      }
    }, { passive: true });

    dom.addEventListener('touchmove', e => {
      if (this.pinch.a !== null) {
        const d = this._touchDist(e, this.pinch.a, this.pinch.b);
        if (d && this.pinch.dist) this.zoomAcc += (d - this.pinch.dist) * 0.03;
        if (d) this.pinch.dist = d;
      }
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) {
          const dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy;
          const max = 55, len = Math.hypot(dx, dy) || 1, cl = Math.min(len, max);
          this.target.x = (dx / len) * (cl / max);
          this.target.y = -(dy / len) * (cl / max);
          this._place(this.joy.cx + dx / len * cl, this.joy.cy + dy / len * cl, false);
        } else if (t.identifier === this.lookId && this.pinch.a === null) {
          this.look.x += (t.clientX - this.lookLast.x);
          this.look.y += (t.clientY - this.lookLast.y);
          this.lookLast = { x: t.clientX, y: t.clientY };
        }
      }
    }, { passive: true });

    const end = e => {
      for (const t of e.changedTouches) {
        if (t.identifier === this.joy.id) { this.joy.id = null; this.target.x = this.target.y = 0; this._hide(); }
        if (t.identifier === this.pinch.a || t.identifier === this.pinch.b) { this.pinch.a = this.pinch.b = null; }
        if (t.identifier === this.lookId) this.lookId = null;
      }
    };
    dom.addEventListener('touchend', end, { passive: true });
    dom.addEventListener('touchcancel', end, { passive: true });
  }

  _touchDist(e, idA, idB) {
    let a = null, b = null;
    for (const t of e.touches) { if (t.identifier === idA) a = t; if (t.identifier === idB) b = t; }
    return a && b ? Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) : 0;
  }

  // Mouse: drag anywhere empty to orbit, wheel to zoom.
  _initMouse(dom) {
    let down = false, lx = 0, ly = 0;
    dom.addEventListener('mousedown', e => {
      if (e.target.closest && e.target.closest('.gamebtn')) return;
      down = true; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mousemove', e => {
      if (!down) return;
      this.look.x += e.clientX - lx; this.look.y += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mouseup', () => { down = false; });
    dom.addEventListener('wheel', e => { this.zoomAcc += -e.deltaY * 0.01; e.preventDefault(); }, { passive: false });
  }

  _place(cx, cy, showRing) {
    const { ring, knob } = this._joyEl();
    if (!ring) return;
    if (showRing) { ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.classList.add('on'); knob.classList.add('on'); }
    knob.style.left = cx + 'px'; knob.style.top = cy + 'px';
  }
  _hide() { const { ring, knob } = this._joyEl(); if (ring) { ring.classList.remove('on'); knob.classList.remove('on'); } }

  // Smoothed movement vector from keys + joystick, with dead-zone + accel/decel.
  axis() {
    const t = now(), dt = Math.min((t - this._t) / 1000, 0.05); this._t = t;
    let tx = this.target.x, ty = this.target.y;
    if (this.keys['w']) ty += 1;
    if (this.keys['s']) ty -= 1;
    if (this.keys['a']) tx -= 1;
    if (this.keys['d']) tx += 1;
    let len = Math.hypot(tx, ty);
    if (len < DEADZONE) { tx = ty = 0; len = 0; }
    if (len > 1) { tx /= len; ty /= len; }
    // accelerate quickly, decelerate a touch slower for a planted feel
    const rate = len > Math.hypot(this.cur.x, this.cur.y) ? 14 : 10;
    const k = 1 - Math.exp(-rate * dt);
    this.cur.x += (tx - this.cur.x) * k;
    this.cur.y += (ty - this.cur.y) * k;
    if (Math.abs(this.cur.x) < 0.002) this.cur.x = 0;
    if (Math.abs(this.cur.y) < 0.002) this.cur.y = 0;
    return { x: this.cur.x, y: this.cur.y, running: !!this.keys['shift'] };
  }

  // Pull & reset the accumulated orbit delta (keyboard arrows + Q/E too).
  consumeLook() {
    let { x, y } = this.look;
    if (this.keys['q'] || this.keys['arrowleft']) x -= 7;
    if (this.keys['e'] || this.keys['arrowright']) x += 7;
    if (this.keys['arrowup']) y -= 7;
    if (this.keys['arrowdown']) y += 7;
    this.look.x = 0; this.look.y = 0;
    return { x, y };
  }

  // Pull & reset the accumulated zoom delta (wheel + pinch + keys).
  consumeZoom() {
    let z = this.zoomAcc;
    if (this.keys['='] || this.keys['+']) z += 0.12;
    if (this.keys['-'] || this.keys['_']) z -= 0.12;
    this.zoomAcc = 0;
    return z;
  }
}
