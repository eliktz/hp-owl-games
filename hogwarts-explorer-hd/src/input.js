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
    this._t = now(); this._lt = now();
    this._lv = { x: 0, y: 0 };      // look velocity (px/s) for the little flick-coast
    this.enabled = true;            // false while a full-screen overlay (lesson, picker) owns the screen
    this._initKeyboard();
    this._initTouch(dom);
    this._initMouse(dom);
  }

  _initKeyboard() {
    addEventListener('keydown', e => { this.keys[e.key.toLowerCase()] = true; });
    addEventListener('keyup', e => { this.keys[e.key.toLowerCase()] = false; });
  }

  _joyEl() { return { ring: document.getElementById('joy'), knob: document.getElementById('joyKnob') }; }

  // Only touches that land on the 3D view (or the bare page) steer — a finger that starts on
  // any HUD button / panel never blooms a stick or drags the camera.
  _steers(target) {
    if (!this.enabled) return false;
    return !target || target.id === 'view' || target === document.body || target === document.documentElement;
  }

  // Drop every finger (an overlay opened / the app went to the background).
  releaseAll() {
    this.joy.id = null; this.target.x = this.target.y = 0; this._hide();
    this.lookId = null; this.pinch.a = this.pinch.b = null;
    this.look.x = this.look.y = 0; this._lv.x = this._lv.y = 0;
  }
  setEnabled(on) { this.enabled = !!on; if (!on) this.releaseAll(); }

  _initTouch(dom) {
    const half = () => window.innerWidth / 2;
    const R = 62;                                   // stick radius (px)
    dom.addEventListener('touchstart', e => {
      for (const t of e.changedTouches) {
        if (!this._steers(t.target)) continue;
        if (t.clientX < half() && this.joy.id === null) {
          this.joy = { id: t.identifier, cx: t.clientX, cy: t.clientY };
          this._place(t.clientX, t.clientY, true);
        } else if (this.lookId === null) {
          this.lookId = t.identifier; this.lookLast = { x: t.clientX, y: t.clientY };
          this._lv.x = this._lv.y = 0;              // a new touch catches any coasting spin
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
          let dx = t.clientX - this.joy.cx, dy = t.clientY - this.joy.cy, len = Math.hypot(dx, dy) || 1;
          // the ring trails the thumb once it leaves the rim → reversing is instant and a
          // drifting thumb never "loses" the stick
          if (len > R) {
            const over = len - R; this.joy.cx += dx / len * over; this.joy.cy += dy / len * over;
            this._ring(this.joy.cx, this.joy.cy);
            dx = t.clientX - this.joy.cx; dy = t.clientY - this.joy.cy; len = R;
          }
          // radial dead-zone + soft response curve: wobbles rest, small tilts tiptoe, full tilt runs
          const m = len / R, DZ = 0.16, k = m <= DZ ? 0 : Math.pow((m - DZ) / (1 - DZ), 1.3);
          this.target.x = (dx / len) * k;
          this.target.y = -(dy / len) * k;
          this._place(this.joy.cx + dx, this.joy.cy + dy, false);
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
    addEventListener('blur', () => this.releaseAll());
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.releaseAll(); });
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
      if (!this._steers(e.target)) return;
      down = true; lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mousemove', e => {
      if (!down) return;
      this.look.x += e.clientX - lx; this.look.y += e.clientY - ly;
      lx = e.clientX; ly = e.clientY;
    });
    addEventListener('mouseup', () => { down = false; });
    dom.addEventListener('wheel', e => { if (!this._steers(e.target)) return; this.zoomAcc += -e.deltaY * 0.01; e.preventDefault(); }, { passive: false });
  }

  _place(cx, cy, showRing) {
    const { ring, knob } = this._joyEl();
    if (!ring) return;
    if (showRing) { ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; ring.classList.add('on'); knob.classList.add('on'); }
    knob.style.left = cx + 'px'; knob.style.top = cy + 'px';
  }
  _ring(cx, cy) { const { ring } = this._joyEl(); if (ring) { ring.style.left = cx + 'px'; ring.style.top = cy + 'px'; } }
  _hide() { const { ring, knob } = this._joyEl(); if (ring) { ring.classList.remove('on'); knob.classList.remove('on'); } }

  // Smoothed movement vector from keys + joystick, with dead-zone + accel/decel.
  axis() {
    const t = now(), dt = Math.min((t - this._t) / 1000, 0.05); this._t = t;
    let tx = this.target.x, ty = this.target.y;
    if (!this.enabled) { this.cur.x = this.cur.y = 0; return { x: 0, y: 0, running: false }; }
    if (this.keys['w']) ty += 1;
    if (this.keys['s']) ty -= 1;
    if (this.keys['a']) tx -= 1;
    if (this.keys['d']) tx += 1;
    let len = Math.hypot(tx, ty);
    if (len < 0.05) { tx = ty = 0; len = 0; }      // (the stick has its own radial dead-zone)
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

  // Pull the orbit delta for this frame. Finger deltas are QUEUED by the touch events and fed
  // out here with an exponential ease (no jitter from uneven event timing), and a flick keeps
  // coasting for a moment after the finger lifts. Keyboard arrows + Q/E add on top.
  consumeLook() {
    const t = now(), dt = Math.min((t - this._lt) / 1000, 0.05); this._lt = t;
    const k = 1 - Math.exp(-dt * 30);
    let x = this.look.x * k, y = this.look.y * k;
    this.look.x -= x; this.look.y -= y;
    const held = this.lookId !== null;
    if (held) {
      const a = Math.min(1, dt * 12), inv = 1 / Math.max(dt, 0.008);
      this._lv.x += (Math.max(-1400, Math.min(1400, x * inv)) - this._lv.x) * a;
      this._lv.y += (Math.max(-900, Math.min(900, y * inv)) - this._lv.y) * a;
    } else if (Math.abs(this._lv.x) > 30 || Math.abs(this._lv.y) > 30) {
      x += this._lv.x * dt * 0.6; y += this._lv.y * dt * 0.6;
      const d = Math.exp(-dt * 7); this._lv.x *= d; this._lv.y *= d;
    } else { this._lv.x = this._lv.y = 0; }
    if (this.enabled) {
      if (this.keys['q'] || this.keys['arrowleft']) x -= 7;
      if (this.keys['e'] || this.keys['arrowright']) x += 7;
      if (this.keys['arrowup']) y -= 7;
      if (this.keys['arrowdown']) y += 7;
    }
    if (Math.abs(x) + Math.abs(y) < 0.02) return { x: 0, y: 0 };
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
