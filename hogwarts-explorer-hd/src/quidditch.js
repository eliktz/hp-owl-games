// QUIDDITCH in the HD world — the same match v1 plays (see ../hogwarts-explorer/quidditch/
// match.js for the full design notes), rebuilt on the HD engine: fly a broom over a pitch
// south of the gates, score with the Quaffle through three hoops past a Keeper, out-fly a rival
// Chaser, dodge two Bludgers and catch the Golden Snitch (+150) to end the match.
// Thumb-friendly: the stick steers (camera-relative), the broom finds its own height, ⚡ is a
// boost and 🤾 throws. Everything repeated is instanced, nothing casts shadows, so the whole
// pitch + crowd costs ~10 draw calls. Start from the 🧹 stand or the lesson picker.
import {
  Group, Mesh, InstancedMesh, Object3D, Color, Vector3, SphereGeometry, CylinderGeometry, BoxGeometry,
  ConeGeometry, TorusGeometry, CircleGeometry, PlaneGeometry, MeshStandardMaterial, MeshBasicMaterial, DoubleSide, CanvasTexture, SRGBColorSpace,
} from 'three';
import { buildChibi, animateChibi } from './chibi.js';
import { PLACES } from './config.js';
import * as fun from './fun.js';

const STAND = { x: PLACES.pitch.x, z: PLACES.pitch.z + 6 };
const C = { x: PLACES.pitch.x, z: PLACES.pitch.z + 34 }, AX = 29, AZ = 21;
const HOOP_DZ = [-6, 0, 6], HOOP_Y = [10.5, 12.5, 10.5];
const GOAL_X = C.x + 20, HOME_X = C.x - 20;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const M = (color, o = {}) => new MeshStandardMaterial({ color, roughness: 0.7, ...o });

export function createQuidditch({ scene, camera, player, heightAt, interiors, registerOutdoor, setTakeover, isModal }) {
  const st = fun.store; st.qLevel = st.qLevel || 1; st.qWins = st.qWins || 0;
  const gy = heightAt(C.x, C.z) + 0.4;
  const d = new Object3D(), col = new Color(), tmp = new Vector3(), tmp2 = new Vector3();
  const mk = (par, geo, mat, x = 0, y = 0, z = 0) => { const m = new Mesh(geo, mat); m.position.set(x, y, z); m.frustumCulled = false; par.add(m); return m; };
  const clampArena = (p) => { const dx = (p.x - C.x) / AX, dz = (p.z - C.z) / AZ, k = Math.hypot(dx, dz); if (k > 1) { p.x = C.x + dx / k * AX; p.z = C.z + dz / k * AZ; return true; } return false; };

  // ---------------- the pitch (always there, cheap) ----------------
  const pitch = new Group(); pitch.name = 'quidditch-pitch';
  const oval = mk(pitch, new CircleGeometry(1, 44), M(0x3f8a45, { roughness: 1 }), C.x, gy, C.z); oval.rotation.x = -Math.PI / 2; oval.scale.set(AX - 2, AZ - 2, 1);
  const poles = new InstancedMesh(new CylinderGeometry(0.2, 0.2, 1, 8), M(0xcfc2a0), 6);
  const rings = new InstancedMesh(new TorusGeometry(1.5, 0.2, 8, 20), M(0xe6b422, { metalness: 0.5, roughness: 0.3, emissive: new Color(0x3a2a00) }), 6);
  let hi = 0;
  for (const gx of [GOAL_X, HOME_X]) for (let i = 0; i < 3; i++) {
    const h = HOOP_Y[i] - 1.5;
    d.position.set(gx, gy + h / 2, C.z + HOOP_DZ[i]); d.rotation.set(0, 0, 0); d.scale.set(1, h, 1); d.updateMatrix(); poles.setMatrixAt(hi, d.matrix);
    d.position.set(gx, gy + HOOP_Y[i], C.z + HOOP_DZ[i]); d.rotation.set(0, Math.PI / 2, 0); d.scale.set(1, 1, 1); d.updateMatrix(); rings.setMatrixAt(hi, d.matrix); hi++;
  }
  const stands = new InstancedMesh(new BoxGeometry(46, 1, 1.9), M(0x6a4a2e, { roughness: 1 }), 6);
  const CROWD = [];
  const crowd = new InstancedMesh(new SphereGeometry(0.55, 8, 6), M(0xffffff, { roughness: 0.8 }), 192);
  let si = 0;
  for (const [side, teamCol] of [[-1, 0xb8322e], [1, 0x2a7a4a]]) for (let tier = 0; tier < 3; tier++) {
    const z = C.z + side * (23.5 + tier * 1.9), hgt = 1.2 + tier * 1.5;
    d.position.set(C.x, gy + hgt / 2 - 0.2, z); d.rotation.set(0, 0, 0); d.scale.set(1, hgt, 1); d.updateMatrix(); stands.setMatrixAt(si++, d.matrix);
    for (let i = 0; i < 32; i++) CROWD.push({ x: C.x - 21.7 + i * 1.4, y: gy + 1 + tier * 1.5 + 0.75, z, ph: Math.random() * 7, c: i % 5 === 0 ? 0xffd76a : (Math.random() < 0.7 ? teamCol : 0xf2e2c8) });
  }
  function settleCrowd(amp = 0, f = 0, t = 0) {
    for (let i = 0; i < CROWD.length; i++) { const p = CROWD[i]; d.position.set(p.x, p.y + (amp ? Math.abs(Math.sin(t * f + p.ph)) * amp : 0), p.z); d.rotation.set(0, 0, 0); d.scale.set(1, 1.25, 1); d.updateMatrix(); crowd.setMatrixAt(i, d.matrix); }
    crowd.instanceMatrix.needsUpdate = true;
  }
  CROWD.forEach((p, i) => crowd.setColorAt(i, col.setHex(p.c))); settleCrowd();
  if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
  for (const im of [poles, rings, stands, crowd]) { im.frustumCulled = false; im.castShadow = false; pitch.add(im); }
  // the broom stand (walk up → 🧹)
  const stand = new Group(); stand.position.set(STAND.x, heightAt(STAND.x, STAND.z), STAND.z);
  mk(stand, new BoxGeometry(2.6, 1.0, 0.9), M(0x6a4a2e), 0, 0.5, 0);
  for (let i = 0; i < 3; i++) { const b = mk(stand, new CylinderGeometry(0.05, 0.05, 2.4, 6), M(0x8a5a2e), -0.8 + i * 0.8, 2.0, 0); b.rotation.z = 0.12 * (i - 1); }
  const signTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d'); g.fillStyle = 'rgba(40,25,90,.9)'; g.beginPath(); g.arc(64, 64, 58, 0, 7); g.fill(); g.strokeStyle = '#ffd76a'; g.lineWidth = 8; g.stroke(); g.font = '70px serif'; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText('🧹', 64, 68); return c; })();
  const signT = new CanvasTexture(signTex); signT.colorSpace = SRGBColorSpace;
  const sign = mk(stand, new PlaneGeometry(2, 2), new MeshBasicMaterial({ map: signT, transparent: true, side: DoubleSide }), 0, 4.6, 0);
  pitch.add(stand); scene.add(pitch); registerOutdoor(pitch);

  // ---------------- match actors ----------------
  const actors = new Group(); actors.visible = false; scene.add(actors);
  const quaffle = mk(actors, new SphereGeometry(0.6, 14, 12), M(0xc8321e, { emissive: new Color(0x5a1008), emissiveIntensity: 0.8, roughness: 0.5 }));
  const bludgers = [0, 1].map(i => { const m = mk(actors, new SphereGeometry(0.62, 14, 12), M(0x2a2a33, { emissive: new Color(0xff2a2a), emissiveIntensity: 0 })); return { m, pos: m.position, ph: i * 3.1, state: 'roam', t: 6 + i * 5, dir: new Vector3(), hit: false }; });
  const snitch = new Group(); snitch.visible = false; actors.add(snitch);
  mk(snitch, new SphereGeometry(0.34, 12, 10), M(0xffd23f, { metalness: 0.6, roughness: 0.25, emissive: new Color(0xffb000), emissiveIntensity: 1.2 }));
  const wings = [-1, 1].map(s => { const w = mk(snitch, new PlaneGeometry(0.9, 0.3), M(0xfff6d8, { side: DoubleSide, emissive: new Color(0xfff0c0), emissiveIntensity: 0.6 }), s * 0.55, 0.1, 0); w.userData.s = s; return w; });
  function broom() { const b = new Group(); const stick = mk(b, new CylinderGeometry(0.05, 0.06, 2.4, 8), M(0x7a4a22), 0, 0, 0.2); stick.rotation.x = Math.PI / 2; const tail = mk(b, new ConeGeometry(0.26, 0.9, 10), M(0xc9a85a), 0, 0, -1.4); tail.rotation.x = Math.PI / 2; b.position.y = 0.72; return b; }
  function flyer(look) { const c = buildChibi(look); c.traverse(o => { if (o.isMesh) o.castShadow = false; }); c.add(broom()); actors.add(c); return c; }
  const rival = flyer({ robe: 0x1a5236, trim: 0x123a26, house: 0xc9cdd2, hair: 0xcf5a1e });
  const keepA = flyer({ robe: 0x1a5236, trim: 0x123a26, house: 0xc9cdd2, hair: 0x6a4322 });
  const keepB = flyer({ robe: 0x7a1420, trim: 0x4a0c14, house: 0xd9b24a, hair: 0x14100c, glasses: true });
  const myBroom = broom();
  const aimRing = mk(actors, new TorusGeometry(1.9, 0.14, 8, 24), new MeshBasicMaterial({ color: 0x9effa0 })); aimRing.rotation.y = Math.PI / 2; aimRing.visible = false;
  const warn = mk(actors, new ConeGeometry(0.5, 1, 4), new MeshBasicMaterial({ color: 0xff3030 })); warn.rotation.x = Math.PI; warn.visible = false;

  // ---------------- HUD ----------------
  const css = document.createElement('style');
  css.textContent = `
  #qBoard{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:14;display:none;align-items:center;gap:12px;
    background:rgba(20,12,50,.86);border:4px solid #ffd76a;border-radius:22px;padding:6px 18px;color:#fff;font:bold 38px 'Rubik',sans-serif;direction:ltr;text-shadow:0 2px 0 #000}
  #qBoard .tm{display:flex;align-items:center;gap:8px} #qBoard .sn{font-size:30px;opacity:.25} #qBoard .sn.on{opacity:1;animation:qBlink .6s infinite}
  @keyframes qBlink{50%{transform:scale(1.35)}}
  #qExit{right:calc(18px + env(safe-area-inset-right));top:calc(14px + env(safe-area-inset-top));width:64px;height:64px;font-size:28px;display:none}
  #qThrow{right:calc(18px + env(safe-area-inset-right));bottom:calc(140px + env(safe-area-inset-bottom));width:104px;height:104px;font-size:52px;display:none;
    background:radial-gradient(circle at 50% 35%,rgba(255,190,90,.95),rgba(150,70,20,.85))}
  #qThrow.ready{box-shadow:0 0 0 6px #9effa0,0 0 30px #9effa0}
  #qBoost{right:calc(18px + env(safe-area-inset-right));bottom:calc(32px + env(safe-area-inset-bottom));display:none}
  #qHint{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:13;display:none;background:rgba(40,25,90,.85);border:3px solid #ffd76a;
    border-radius:20px;padding:4px 18px;color:#ffe9a8;font:bold 26px 'Rubik',sans-serif;white-space:nowrap;pointer-events:none}
  body.inMatch #qBoard,body.inMatch #qExit,body.inMatch #qHint,body.inMatch #qThrow,body.inMatch #qBoost{display:flex}
  body.inMatch .pill,body.inMatch #quest,body.inMatch #mapBtn,body.inMatch #muteBtn,body.inMatch #timeBtn,body.inMatch #camctl,body.inMatch #bellBtn,body.inMatch #enterBtn,
  body.inMatch #exitBtn,body.inMatch #bubble,body.inMatch #wandBtn,body.inMatch .funBub{display:none !important}
  #qEnd{position:fixed;inset:0;z-index:48;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
  #qEnd.on{display:flex}
  #qEnd .p{background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 26px 22px;text-align:center;color:#fff;width:min(90vw,520px);box-sizing:border-box}
  #qEnd .tr{font-size:110px;line-height:1.05} #qEnd .ti{font-size:44px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00}
  #qEnd .sc{font-size:54px;font-weight:bold;direction:ltr;margin:6px 0} #qEnd .st{font-size:54px;letter-spacing:6px}
  #qEnd .row{display:flex;gap:14px;justify-content:center;margin-top:14px}
  #qEnd button{min-width:150px;min-height:76px;border-radius:40px;border:4px solid #fff;font:bold 30px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
  #qEnd .again{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00} #qEnd .done{background:linear-gradient(#b5a0ff,#7a52d6);color:#fff}`;
  document.head.appendChild(css);
  const el = (tag, id, cls, html) => { const e = document.createElement(tag); e.id = id; if (cls) e.className = cls; if (html) e.innerHTML = html; document.body.appendChild(e); return e; };
  const board = el('div', 'qBoard', '', '<span class="tm"><span class="me">🦁</span><span class="a">0</span></span><span>:</span><span class="tm"><span class="b">0</span><span>🐍</span></span><span class="sn">✨</span>');
  const exitB = el('button', 'qExit', 'gamebtn', '✕'), throwB = el('button', 'qThrow', 'gamebtn', '🤾'), boostB = el('button', 'qBoost', 'gamebtn', '⚡');
  const hint = el('div', 'qHint'), endOv = el('div', 'qEnd');
  exitB.addEventListener('click', e => { e.stopPropagation(); quit(); });
  throwB.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); throwQuaffle(); });
  boostB.addEventListener('pointerdown', e => { e.stopPropagation(); e.preventDefault(); boost(); });
  addEventListener('keydown', e => { if (!S.on) return; if (e.key === ' ') boost(); if (e.key === 'Enter' || e.key.toLowerCase() === 'f') throwQuaffle(); });
  const elA = board.querySelector('.a'), elB = board.querySelector('.b'), elSn = board.querySelector('.sn'), elMe = board.querySelector('.me');
  const setHint = (t) => { if (hint.textContent !== t) hint.textContent = t; };
  const CREST = { gryf: '🦁', slyt: '🐍', rave: '🦅', huff: '🦡' };

  // ---------------- state ----------------
  const S = { on: false };
  const P = player.pos, pv = new Vector3(), camPos = new Vector3(), camLook = new Vector3();
  let yaw = 0, bank = 0, T = 0;
  function reset() {
    const lv = st.qLevel;
    Object.assign(S, { t: 0, a: 0, b: 0, holder: null, stun: 0, boost: 0, boostCd: 0, snitchOn: false, snitchSpd: 13 + lv * 0.9, juke: 0, goals: 0, over: false, shot: null,
      rivalSpd: 9.5 + lv * 1.3, keepSpd: 2.6 + lv * 0.55, save: Math.max(0.25, 0.6 - lv * 0.05), bludGap: Math.max(5, 12 - lv), cheer: 0, kick: 1.6, stealCd: 0, snTarget: new Vector3(), aim: 1, hits: 0, dodges: 0, saves: 0, calm: false, result: null });
    P.set(C.x - 10, gy + 5, C.z); yaw = Math.PI / 2; pv.set(0, 0, 0);
    quaffle.position.set(C.x, gy + 7, C.z);
    rival.position.set(C.x + 12, gy + 6, C.z); keepA.position.set(GOAL_X - 2.2, gy + 11, C.z); keepB.position.set(HOME_X + 2.2, gy + 11, C.z);
    keepA.rotation.y = -Math.PI / 2; keepB.rotation.y = Math.PI / 2;
    bludgers.forEach((b, i) => { b.state = 'roam'; b.t = 5 + i * 4; b.pos.set(C.x + (i ? 14 : -14), gy + 9, C.z + (i ? -10 : 10)); b.m.material.emissiveIntensity = 0; });
    snitch.visible = false; warn.visible = false; aimRing.visible = false;
    elA.textContent = '0'; elB.textContent = '0'; elSn.classList.remove('on'); elMe.textContent = CREST[st.house] || '🦁';
    camPos.set(P.x - 9, P.y + 5, P.z); camLook.copy(P);
  }
  function whistle() { fun.sfx.tone(2300, 0.35, 'square', 0.08, 0, 2500); fun.sfx.tone(2300, 0.5, 'square', 0.08, 0.4, 2100); }
  function roar(big) { fun.sfx.noise(big ? 2.4 : 1.3, big ? 0.3 : 0.2, 0, 900, 0.5); fun.sfx.noise(big ? 2.0 : 1.0, 0.12, 0.1, 2200, 0.7); S.cheer = big ? 6 : 2.4; }
  function start() {
    if (S.on || isModal()) return false;
    if (interiors.active) interiors.exit();
    S.on = true; reset(); actors.visible = true; pitch.visible = true; player.model.add(myBroom);
    document.body.classList.add('inMatch'); endOv.classList.remove('on');
    setTakeover({ update });
    whistle(); fun.toast('🧹', 'קְוִוידִיץ׳!', 1500); setHint('🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!');
    return true;
  }
  function leave() {
    S.on = false; actors.visible = false; player.model.remove(myBroom); player.model.rotation.set(0, 0, 0);
    document.body.classList.remove('inMatch'); throwB.classList.remove('ready');
    setTakeover(null);
    player.yaw = Math.PI; player.teleport(STAND.x, STAND.z - 3); settleCrowd();
  }
  function quit() { if (!S.on) return; endOv.classList.remove('on'); leave(); }
  function boost() { if (!S.on || S.over || S.boostCd > 0 || S.stun > 0) return false; S.boost = 0.9; S.boostCd = 2.2; fun.sfx.zap(); return true; }
  function nearestHoop() {
    let best = 1, bd = 1e9; const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let i = 0; i < 3; i++) { const dx = GOAL_X - P.x, dz = C.z + HOOP_DZ[i] - P.z, k = Math.hypot(dx, dz) || 1; const sc = Math.acos(clamp((dx * fx + dz * fz) / k, -1, 1)) + Math.abs(dz) * 0.02; if (sc < bd) { bd = sc; best = i; } }
    return best;
  }
  const inRange = () => S.holder === 'me' && GOAL_X - P.x < 20 && GOAL_X - P.x > 1.5;
  function throwQuaffle() {
    if (!S.on || S.over || S.holder !== 'me' || S.shot) return false;
    if (!inRange()) { setHint('➡️ קָרוֹב יוֹתֵר לַטַּבָּעוֹת!'); fun.sfx.squeak(); return false; }
    const i = S.aim; S.holder = null;
    S.shot = { from: quaffle.position.clone(), to: new Vector3(GOAL_X, gy + HOOP_Y[i], C.z + HOOP_DZ[i]), t: 0, dur: 0.55, by: 'me' };
    fun.sfx.boing(); return true;
  }
  function goal(mine) {
    S.goals++;
    if (mine) { S.a += 10; elA.textContent = S.a; fun.toast('🥅', '+10', 1100); fun.confetti(['🔴', '⭐', '🎉'], 12); roar(false); fun.sfx.tada(); }
    else { S.b += 10; elB.textContent = S.b; fun.sfx.tone(300, 0.4, 'sawtooth', 0.12, 0, 160); }
    S.holder = null; S.shot = null; quaffle.position.set(C.x, gy + 7, C.z); S.kick = 1.4; whistle();
    rival.position.set(C.x + 10, gy + 6, C.z + (Math.random() - 0.5) * 12);
  }
  function releaseSnitch() {
    if (S.snitchOn || S.over) return; S.snitchOn = true; snitch.visible = true;
    snitch.position.set(C.x + (Math.random() - 0.5) * 20, gy + 12, C.z + (Math.random() - 0.5) * 16); S.snTarget.copy(snitch.position);
    elSn.classList.add('on'); fun.toast('✨', 'הַסְּנִיץ׳ הַזָּהוֹב!', 1600); fun.sfx.tune([1568, 2093, 2637, 3136], 0.09, 'sine');
  }
  function finish() {
    S.over = true; S.a += 150; elA.textContent = S.a; snitch.visible = false; elSn.classList.remove('on'); S.holder = null;
    roar(true); fun.sfx.tada(); fun.confetti(['✨', '🏆', '🎉', '⭐', '💛'], 34);
    const win = S.a > S.b; st.qWins += win ? 1 : 0;
    const stars = S.a - S.b >= 150 ? 3 : win ? 2 : 1;
    if (win && stars >= 2) st.qLevel = Math.min(8, st.qLevel + 1); fun.save();
    try { window.HPLessons.progress.bonus(win ? 30 : 10); } catch { /* lessons not loaded */ }
    S.result = { a: S.a, b: S.b, win, stars, level: st.qLevel };
    setTimeout(() => {
      endOv.innerHTML = '<div class="p"><div class="tr">🏆</div><div class="ti">' + (win ? 'נִצָּחוֹן!' : 'מִשְׂחָק מְצֻיָּן!') + '</div><div class="sc">' + elMe.textContent + ' ' + S.a + ' : ' + S.b + ' 🐍</div><div class="st">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars)
        + '</div><div class="row"><button class="again">🔁 שׁוּב</button><button class="done">סִיּוּם</button></div></div>';
      endOv.querySelector('.again').addEventListener('click', () => { endOv.classList.remove('on'); reset(); whistle(); });
      endOv.querySelector('.done').addEventListener('click', () => { endOv.classList.remove('on'); leave(); });
      endOv.classList.add('on');
    }, 2600);
  }
  function steer(obj, tx, ty, tz, spd, dt) {
    tmp.set(tx - obj.position.x, ty - obj.position.y, tz - obj.position.z); const k = tmp.length();
    if (k > 0.05) { obj.rotation.y = Math.atan2(tmp.x, tmp.z); tmp.multiplyScalar(Math.min(1, spd * dt / k)); obj.position.add(tmp); }
    return k;
  }

  // ---------------- per-frame (owns the hero + camera while a match is on) ----------------
  function update(dt, ax) {
    if (!S.on) return;
    T += dt; const t = T;
    if (isModal()) { camera.position.copy(camPos); camera.lookAt(camLook); return; }
    S.t += dt; if (S.kick > 0) S.kick -= dt;
    if (S.boostCd > 0) S.boostCd -= dt; if (S.boost > 0) S.boost -= dt; if (S.stealCd > 0) S.stealCd -= dt;
    const model = player.model, l = Math.min(1, Math.hypot(ax.x, ax.y));
    if (S.stun > 0) { S.stun -= dt; yaw += dt * 16; pv.multiplyScalar(1 - dt * 3); }
    else if (!S.over) {
      const cy = Math.atan2(P.x - camPos.x, P.z - camPos.z);
      const mx = ax.y * Math.sin(cy) - ax.x * Math.cos(cy), mz = ax.y * Math.cos(cy) + ax.x * Math.sin(cy);
      const spd = (S.boost > 0 ? 31 : 20) * (S.holder === 'me' ? 0.92 : 1), want = l > 0.05 ? spd * l : 2.5;
      if (l > 0.05) { const wy = Math.atan2(mx, mz); const dd = ((wy - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yaw += dd * Math.min(1, dt * 5.5); bank += (-dd * 0.9 - bank) * Math.min(1, dt * 6); }
      else bank *= 1 - Math.min(1, dt * 4);
      pv.x += (Math.sin(yaw) * want - pv.x) * Math.min(1, dt * 4); pv.z += (Math.cos(yaw) * want - pv.z) * Math.min(1, dt * 4);
    }
    P.x += pv.x * dt; P.z += pv.z * dt;
    if (clampArena(P)) { const out = Math.atan2(P.x - C.x, P.z - C.z); const dd = ((out + Math.PI - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yaw += dd * Math.min(1, dt * 2); }
    let wantY = gy + 7;
    if (S.holder === 'me') wantY = gy + 7 + 4.5 * clamp(1 - (GOAL_X - P.x) / 22, 0, 1);
    else { const dq = quaffle.position.distanceTo(P), ds = S.snitchOn ? snitch.position.distanceTo(P) : 1e9; wantY = ds < dq * 1.3 ? snitch.position.y : (S.holder === 'rival' ? rival.position.y : quaffle.position.y); }
    P.y += (clamp(wantY, gy + 2.5, gy + 18) - P.y) * Math.min(1, dt * 2.6);
    model.position.copy(P); model.rotation.set(0.18, yaw, clamp(bank, -0.6, 0.6), 'YXZ'); model.visible = true;
    player.yaw = yaw; player.smoothY = P.y; player._lastPos.copy(P);
    animateChibi(player._rig, dt, { moving: false });

    // ---- Quaffle ----
    if (S.shot) {
      const s = S.shot; s.t += dt; const k = Math.min(1, s.t / s.dur);
      quaffle.position.lerpVectors(s.from, s.to, k); quaffle.position.y += Math.sin(k * Math.PI) * 1.6;
      if (k >= 1) {
        if (s.by === 'me') { if (Math.abs(keepA.position.z - s.to.z) < 2.4) { S.shot = null; quaffle.position.set(GOAL_X - 6, gy + 8, C.z + (Math.random() - 0.5) * 10); fun.sfx.boing(); fun.toast('🧤', '', 800); S.saves++; setHint('הַשּׁוֹעֵר עָצַר! כַּוְּנוּ לְטַבַּעַת רֵיקָה'); S.kick = 0.6; } else goal(true); }
        else if (Math.random() < S.save) { S.shot = null; quaffle.position.set(HOME_X + 7, gy + 8, C.z); fun.sfx.boing(); S.kick = 0.5; } else goal(false);
      }
    } else if (S.holder === 'me') {
      quaffle.position.set(P.x + Math.sin(yaw) * 0.9, P.y + 1.5, P.z + Math.cos(yaw) * 0.9);
      S.aim = nearestHoop(); const ok = inRange(); throwB.classList.toggle('ready', ok);
      aimRing.visible = ok; if (ok) { aimRing.position.set(GOAL_X - 0.2, gy + HOOP_Y[S.aim], C.z + HOOP_DZ[S.aim]); aimRing.scale.setScalar(1 + Math.sin(t * 9) * 0.08); }
      setHint(ok ? '🤾 זִרְקוּ לַטַּבַּעַת!' : '➡️ טוּסוּ לַטַּבָּעוֹת!');
    } else {
      throwB.classList.remove('ready'); aimRing.visible = false;
      if (S.holder === 'rival') quaffle.position.set(rival.position.x, rival.position.y + 1.5, rival.position.z);
      else if (S.kick <= 0 && S.stun <= 0 && quaffle.position.distanceTo(P) < 2.4) { S.holder = 'me'; fun.sfx.pop(); }
      if (!S.over) setHint(S.snitchOn ? '✨ תִּפְסוּ אֶת הַסְּנִיץ׳!' : S.holder === 'rival' ? '💥 הִתְנַגְּשׁוּ בַּיָּרִיב לַחֲטֹף!' : '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!');
    }
    quaffle.rotation.y += dt * 3;

    // ---- rival Chaser ----
    if (!S.over && !S.calm) {
      if (S.holder === 'rival') {
        const k = steer(rival, HOME_X + 9, gy + 11, C.z + Math.sin(S.t * 0.7) * 5, S.rivalSpd * 0.9, dt);
        if (rival.position.x < HOME_X + 13 || k < 1) { S.holder = null; const i = (Math.random() * 3) | 0; S.shot = { from: quaffle.position.clone(), to: new Vector3(HOME_X, gy + HOOP_Y[i], C.z + HOOP_DZ[i]), t: 0, dur: 0.6, by: 'rival' }; }
        else if (S.stealCd <= 0 && S.stun <= 0 && rival.position.distanceTo(P) < 2.3) { S.holder = 'me'; S.stealCd = 1.5; fun.sfx.boing(); fun.toast('💪', '', 700); }
      } else if (S.holder === 'me') {
        steer(rival, P.x + pv.x * 0.4, P.y, P.z + pv.z * 0.4, S.rivalSpd * 0.8, dt);
        if (S.stealCd <= 0 && rival.position.distanceTo(P) < 1.7) { S.holder = 'rival'; S.stealCd = 1.6; fun.sfx.yelp(); }
      } else if (!S.shot && S.kick <= 0.4) {
        if (steer(rival, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.rivalSpd, dt) < 1.6 && S.kick <= 0) S.holder = 'rival';
      }
    }
    const kz = S.holder === 'me' ? C.z + HOOP_DZ[S.aim] : C.z + Math.sin(t * 0.8) * 5;
    keepA.position.z += clamp(kz - keepA.position.z, -S.keepSpd * dt, S.keepSpd * dt); keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
    keepB.position.z = C.z + Math.sin(t * 0.9 + 1) * 5; keepB.position.y = gy + 11 + Math.cos(t * 2) * 0.3;

    // ---- Bludgers ----
    for (const b of bludgers) {
      b.t -= dt;
      if (b.state === 'roam') {
        b.pos.set(C.x + Math.sin(t * 0.5 + b.ph) * 22, gy + 9 + Math.sin(t * 0.9 + b.ph) * 3, C.z + Math.cos(t * 0.37 + b.ph * 2) * 15);
        if (b.t <= 0 && !S.over && S.stun <= 0 && !S.calm) { b.state = 'aim'; b.t = 1.15; fun.sfx.tone(700, 1.0, 'sawtooth', 0.07, 0, 1500); }
      } else if (b.state === 'aim') {
        b.m.material.emissiveIntensity = 1.5 + Math.sin(t * 30); warn.visible = true; warn.position.set(P.x, P.y + 3.4, P.z); warn.rotation.y = t * 6;
        if (b.t <= 0) { b.dir.set(P.x - b.pos.x, P.y + 1 - b.pos.y, P.z - b.pos.z).normalize(); b.state = 'charge'; b.t = 1.5; b.hit = false; }
      } else {
        b.pos.addScaledVector(b.dir, 30 * dt); warn.visible = false;
        if (!b.hit && S.stun <= 0 && Math.hypot(b.pos.x - P.x, (b.pos.y - P.y - 1) * 0.5, b.pos.z - P.z) < 1.9) {   // forgiving in height: the broom picks its own altitude
          b.hit = true; S.stun = 1.0; S.hits++; fun.sfx.burp(); fun.sfx.yelp();
          if (S.holder === 'me') { S.holder = null; S.kick = 0.9; quaffle.position.set(P.x + 3, P.y, P.z + 3); clampArena(quaffle.position); }
        }
        if (b.t <= 0) { if (!b.hit) S.dodges++; b.state = 'roam'; b.t = S.bludGap * (0.7 + Math.random() * 0.6); b.m.material.emissiveIntensity = 0; }
      }
    }
    if (!bludgers.some(b => b.state === 'aim')) warn.visible = false;

    // ---- Golden Snitch ----
    if (!S.snitchOn && !S.over && (S.t > 55 || S.goals >= 3)) releaseSnitch();
    if (S.snitchOn && !S.over) {
      const ds = snitch.position.distanceTo(tmp.set(P.x, P.y + 1.2, P.z)); S.juke -= dt;
      if (snitch.position.distanceTo(S.snTarget) < 1.5 || (ds < 6 && S.juke <= 0)) {
        if (ds < 6) { S.juke = 1.3; S.snitchSpd = Math.max(9.5, S.snitchSpd * 0.95); }
        S.snTarget.set(C.x + (Math.random() - 0.5) * AX * 1.6, gy + 5 + Math.random() * 9, C.z + (Math.random() - 0.5) * AZ * 1.6); clampArena(S.snTarget);
      }
      if (S.t > 150) S.snitchSpd = Math.min(S.snitchSpd, 9);
      tmp2.subVectors(S.snTarget, snitch.position); const dl = tmp2.length() || 1;
      snitch.position.addScaledVector(tmp2, Math.min(1, S.snitchSpd * dt / dl));
      for (const w of wings) w.rotation.z = w.userData.s * Math.sin(t * 40) * 0.9;
      if (ds < 2.1 && S.stun <= 0) finish();
    }
    if (S.cheer > 0) S.cheer -= dt;
    settleCrowd(S.cheer > 0 ? 0.9 : 0.12, S.cheer > 0 ? 9 : 2, t);

    const back = S.boost > 0 ? 12 : 10;
    camPos.lerp(tmp.set(P.x - Math.sin(yaw) * back, P.y + 4.6, P.z - Math.cos(yaw) * back), 1 - Math.exp(-dt * 3.2));
    camPos.y = Math.max(camPos.y, heightAt(camPos.x, camPos.z) + 1.5);
    camLook.lerp(tmp2.set(P.x + Math.sin(yaw) * 5, P.y + 1.6, P.z + Math.cos(yaw) * 5), 1 - Math.exp(-dt * 6));
    camera.position.copy(camPos); camera.lookAt(camLook);
  }

  // called every frame by main (when no match is on): the stand's 🧹 prompt + far-away culling
  function idle(dt, inside) {
    if (S.on || inside) return;
    T += dt;
    const dd = Math.hypot(player.pos.x - C.x, player.pos.z - C.z);
    pitch.visible = dd < 150;                        // far from the pitch it costs nothing
    if (sign) { sign.position.y = 4.6 + Math.sin(T * 2) * 0.2; sign.rotation.y += dt * 0.8; }
    const k = Math.hypot(player.pos.x - STAND.x, player.pos.z - STAND.z);
    if (k < 5 && !isModal()) fun.offer('quidditch', '🧹', k, start);
  }

  const api = {
    start, quit, boost, throwQuaffle, releaseSnitch, idle, stand: STAND, centre: C, goalX: GOAL_X, hoopZ: HOOP_DZ.map(z => C.z + z),
    state: () => ({ on: S.on, over: !!S.over, a: S.a, b: S.b, holder: S.holder, stun: S.stun > 0, snitch: !!S.snitchOn, t: S.t, aim: S.aim, hits: S.hits, dodges: S.dodges, saves: S.saves, level: st.qLevel, result: S.result || null,
      me: { x: P.x, y: P.y, z: P.z }, quaffle: { x: quaffle.position.x, y: quaffle.position.y, z: quaffle.position.z }, snitchPos: { x: snitch.position.x, y: snitch.position.y, z: snitch.position.z },
      boosting: S.boost > 0, speed: Math.hypot(pv.x, pv.z), b0: { x: bludgers[0].pos.x, y: bludgers[0].pos.y, z: bludgers[0].pos.z, hit: bludgers[0].hit, t: bludgers[0].t }, keeperZ: keepA.position.z, inRange: inRange(), bludgers: bludgers.map(b => b.state), inArena: Math.hypot((P.x - C.x) / AX, (P.z - C.z) / AZ) <= 1.001 }),
    _place(x, y, z, yw) { P.set(x, y, z); pv.set(0, 0, 0); if (yw != null) yaw = yw; },
    _quaffleAt(x, y, z) { S.holder = null; S.shot = null; S.kick = 0; quaffle.position.set(x, y, z); },
    _calm(on) { S.calm = !!on; }, _rivalAway() { rival.position.set(C.x - 20, gy + 6, C.z - 14); S.stealCd = 5; },
    _keeperTo(z) { keepA.position.z = z; },
    _bludger() { const b = bludgers[0]; b.pos.set(P.x + pv.x * 0.2 + 7, P.y + 1, P.z + pv.z * 0.2); b.dir.set(-1, 0, 0); b.state = 'charge'; b.t = 1.5; b.hit = false; },   // tests: a Bludger already charging at you
    _snitchTo(x, y, z) { snitch.position.set(x, y, z); S.snTarget.set(x, y, z); S.juke = 5; },
  };
  fun.mods.quidditch = api;
  return api;
}
