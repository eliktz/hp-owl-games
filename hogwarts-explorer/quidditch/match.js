/* QUIDDITCH! A full little match over the pitch — fly a broomstick, score with the Quaffle,
 * dodge Bludgers, and catch the Golden Snitch to end the game.
 *
 * Built for a 7-year-old's thumbs: the left stick steers (camera-relative, like walking), the
 * broom rides at the right height by itself (it eases toward whatever you are chasing), ⬆️
 * is a speed BOOST and 🪄 THROWS the Quaffle at the hoop you are facing. Nothing can hurt
 * you: a Bludger just spins you and knocks the Quaffle loose.
 *
 *   • Quaffle (red): fly into it to grab it, carry it to the three golden hoops at the far
 *     end, aim at a hoop the Keeper is NOT guarding and throw → +10.
 *   • An opposing Chaser fights you for the Quaffle and shoots at your hoops (your Keeper
 *     saves some). Bump the rival while they carry it to steal it back.
 *   • Bludgers (dark): one glows red and whistles before it charges — swerve or boost.
 *   • Golden Snitch: appears later, darts about glittering; catch it → +150 and the match ends
 *     with fireworks, a roaring crowd and a trophy screen.
 * Difficulty grows with wins (store.qLevel): faster rival + Keeper, busier Bludgers, a
 * nimbler Snitch. Entry: the 🧹 stand at the pitch, or the Quidditch card in the lesson picker.
 *
 * POSITIONS: the 🧹 stand (or the picker card) opens a four-button chooser, one game per position:
 *   ✨ Seeker  — the Chasers play the Quaffle by themselves; you only hunt the Snitch (and dodge Bludgers).
 *   🔴 Chaser  — the Quaffle game above, for 80 seconds of match time; most goals wins.
 *   🏏 Beater  — Bludgers go for your team-mates: fly into one (🏏 swings wider) to whack it away. 8 attacks.
 *   🧤 Keeper  — hover by your hoops; a red ring shows where the shot is going — slide there to save it. 8 shots.
 * start() with no position is the original all-round match (kept for the picker-less API and its tests).
 * All state lives here; the page only lends its loop through __game.setTakeover(). */
(function () {
  const F = window.HPFun, T = window.THREE;
  const C = { x: 44, z: 66 }, AX = 29, AZ = 21;               // pitch centre + flyable ellipse radii
  const HOOP_Z = [60, 66, 72], HOOP_Y = [10.5, 12.5, 10.5];
  const GOAL_X = 64, HOME_X = 24;                              // you score east, defend west
  const STAND = { x: 44, z: 50 };                              // just inside the south edge of the oval

  F.boot(function (g) {
    const st = F.store; st.qLevel = st.qLevel || 1; st.qWins = st.qWins || 0;
    F.badge('quidditch', '🏆', 'קווידיץ׳');
    const scene = g.scene, gy = g.terrainH(C.x, C.z);
    const M = (c, o) => new T.MeshStandardMaterial(Object.assign({ color: c, roughness: 0.7 }, o || {}));
    const mk = (par, geo, mat, x, y, z) => { const m = new T.Mesh(geo, mat); m.position.set(x || 0, y || 0, z || 0); m.frustumCulled = false; par.add(m); return m; };
    const v = () => new T.Vector3();
    const clampArena = (p) => { const dx = (p.x - C.x) / AX, dz = (p.z - C.z) / AZ, d = Math.hypot(dx, dz); if (d > 1) { p.x = C.x + dx / d * AX; p.z = C.z + dz / d * AZ; return true; } return false; };

    // ---------------- always-there scenery: stands + crowd + the broom stand ----------------
    const dummy = new T.Object3D(), col = new T.Color();
    const standM = M(0x6a4a2e, { roughness: 1 });
    const CROWD = [];
    const crowd = new T.InstancedMesh(new T.SphereGeometry(0.55, 8, 6), M(0xffffff, { roughness: 0.8 }), 192);
    crowd.frustumCulled = false; scene.add(crowd);
    [[-1, 0xb8322e], [1, 0x2a7a4a]].forEach(([side, teamCol]) => {
      for (let tier = 0; tier < 3; tier++) {
        const z = C.z + side * (25.5 + tier * 1.9), y = gy + 1 + tier * 1.5;
        mk(scene, new T.BoxGeometry(46, 1.2 + tier * 1.5, 1.9), standM, C.x, gy + (1.2 + tier * 1.5) / 2 - 0.2, z);
        for (let i = 0; i < 32; i++) CROWD.push({ x: C.x - 21.7 + i * 1.4, y: y + 0.75, z, ph: Math.random() * 7, c: i % 5 === 0 ? 0xffd76a : (Math.random() < 0.7 ? teamCol : 0xf2e2c8) });
      }
      // a tall team banner tower at each end of the stand
      [-1, 1].forEach((e) => { mk(scene, new T.CylinderGeometry(0.35, 0.45, 11, 8), standM, C.x + e * 24.5, gy + 5.5, C.z + side * 27); mk(scene, new T.ConeGeometry(1.6, 2.6, 8), M(teamCol), C.x + e * 24.5, gy + 12.2, C.z + side * 27); });
    });
    CROWD.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.scale.set(1, 1.25, 1); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); crowd.setColorAt(i, col.setHex(p.c)); });
    crowd.instanceMatrix.needsUpdate = true; if (crowd.instanceColor) crowd.instanceColor.needsUpdate = true;
    // the broom stand by the pitch (walk up → 🧹)
    const stand = new T.Group(); stand.position.set(STAND.x, g.terrainH(STAND.x, STAND.z), STAND.z);
    mk(stand, new T.BoxGeometry(2.6, 0.2, 0.9), standM, 0, 0.9, 0);
    [-1, 1].forEach((s) => mk(stand, new T.BoxGeometry(0.2, 1, 0.9), standM, s * 1.1, 0.45, 0));
    for (let i = 0; i < 3; i++) { const b = mk(stand, new T.CylinderGeometry(0.05, 0.05, 2.4, 6), M(0x8a5a2e), -0.8 + i * 0.8, 1.9, 0); b.rotation.z = 0.12 * (i - 1); mk(stand, new T.ConeGeometry(0.22, 0.7, 8), M(0xc9a85a), -0.8 + i * 0.8 - 0.14 * (i - 1), 0.95, 0); }
    const signS = F.emojiSprite('🧹', 2.2); signS.position.y = 4.4; stand.add(signS);
    const sGlow = F.glow(0xffd76a, 5, 0.4); sGlow.position.y = 2; stand.add(sGlow);
    scene.add(stand);

    // ---------------- match actors (hidden until kick-off) ----------------
    const actors = new T.Group(); actors.visible = false; scene.add(actors);
    function ball(color, r, emissive) { const b = mk(actors, new T.SphereGeometry(r, 14, 12), M(color, { emissive: emissive || 0, emissiveIntensity: 0.6, roughness: 0.5 })); return b; }
    const quaffle = ball(0xc8321e, 0.6, 0x5a1008);
    const qGlow = F.glow(0xff6a4a, 3, 0.4); quaffle.add(qGlow);
    const bludgers = [0, 1].map((i) => { const b = ball(0x2a2a33, 0.62, 0x9a2a2a); b.material.emissiveIntensity = 0.12; const gl = F.glow(0xff2a2a, 3.4, 0); b.add(gl); return { m: b, gl, ph: i * 3.1, state: 'roam', t: 6 + i * 5, dir: v(), pos: b.position }; });
    const snitch = HP.makeSnitch(); snitch.scale.setScalar(1.5); snitch.visible = false; actors.add(snitch);
    const sGl = F.glow(0xffe08a, 4, 0.6); snitch.add(sGl);
    snitch.traverse((m) => { if (m.isMesh) m.frustumCulled = false; });
    function flyer(who, robe) {                                   // a rival/keeper chibi on a broom
      const c = HP.makeChibi(who); c.scale.setScalar(1.05);
      c.traverse((m) => { if (m.isMesh) { m.frustumCulled = false; if (m.material && m.material.color && m.material.color.getHex() === 0x272437) { m.material = m.material.clone(); m.material.color.setHex(robe); } } });
      c.add(broom()); actors.add(c); return c;
    }
    function broom() {
      const b = new T.Group();
      const stick = mk(b, new T.CylinderGeometry(0.06, 0.07, 2.8, 8), M(0x7a4a22), 0, 0, 0.2); stick.rotation.x = Math.PI / 2;
      const tail = mk(b, new T.ConeGeometry(0.3, 1.1, 10), M(0xc9a85a), 0, 0, -1.6); tail.rotation.x = Math.PI / 2;
      b.position.y = 0.55; return b;
    }
    const rival = flyer('ron', 0x1a5236), keepA = flyer('hermione', 0x1a5236), keepB = flyer('harry', 0x7a1420);
    const mate = flyer('hermione', 0x7a1420);                      // your team's Chaser (Seeker + Beater games)
    const myBroom = broom();
    const myBat = mk(new T.Group(), new T.CylinderGeometry(0.09, 0.16, 1.5, 8), M(0x5a3a1e), 0, 0.75, 0).parent; myBat.position.set(0.75, 1.5, 0.5); myBat.rotation.z = -0.5;
    const ROLES = { seeker: { e: '✨', n: 'מְחַפֵּשׂ', btn: '⚡' }, chaser: { e: '🔴', n: 'רוֹדֵף', btn: '🤾' }, beater: { e: '🏏', n: 'חוֹבֵט', btn: '🏏' }, keeper: { e: '🧤', n: 'שׁוֹמֵר', btn: '🧤' } };
    const aimRing = mk(actors, new T.TorusGeometry(1.9, 0.14, 8, 24), new T.MeshBasicMaterial({ color: 0x9effa0, fog: false })); aimRing.rotation.y = Math.PI / 2; aimRing.visible = false;
    const warn = F.emojiSprite('⚠️', 1.6); warn.visible = false; actors.add(warn);

    // ---------------- HUD ----------------
    const css = document.createElement('style');
    css.textContent = `
    #qBoard{position:fixed;top:calc(12px + env(safe-area-inset-top));left:50%;transform:translateX(-50%);z-index:14;display:none;align-items:center;gap:12px;
      background:rgba(20,12,50,.86);border:4px solid #ffd76a;border-radius:22px;padding:6px 18px;color:#fff;font:bold 38px 'Rubik',sans-serif;direction:ltr;text-shadow:0 2px 0 #000}
    #qBoard .tm{display:flex;align-items:center;gap:8px} #qBoard .sn{font-size:30px;opacity:.25;transition:opacity .3s} #qBoard .sn.on{opacity:1;animation:qBlink .6s infinite}
    #qBoard .pop{animation:hpPop .4s} @keyframes qBlink{50%{transform:scale(1.35)}}
    #qExit{position:fixed;top:calc(14px + env(safe-area-inset-top));right:calc(14px + env(safe-area-inset-right));z-index:14;width:64px;height:64px;border-radius:50%;
      border:4px solid #ffd76a;background:rgba(40,25,90,.8);color:#fff;font-size:28px;display:none;align-items:center;justify-content:center;padding:0}
    #qHint{position:fixed;left:50%;top:calc(96px + env(safe-area-inset-top));transform:translateX(-50%);z-index:13;display:none;background:rgba(40,25,90,.85);border:3px solid #ffd76a;
      border-radius:20px;padding:4px 18px;color:#ffe9a8;font:bold 26px 'Rubik',sans-serif;white-space:nowrap;pointer-events:none}
    body.inMatch #qBoard,body.inMatch #qExit,body.inMatch #qHint{display:flex}
    body.inMatch .hp-score,body.inMatch #inv,body.inMatch #badgeBtn,body.inMatch #cardBtn,body.inMatch #bellBtn,body.inMatch #mapBtn,body.inMatch #flyBtn,
    body.inMatch #camctl,body.inMatch a.hp-btn,body.inMatch #enterHint,body.inMatch #lsnStart,body.inMatch #lsnArrow,body.inMatch #funPrompt,body.inMatch #lsnTip,body.inMatch #bubble{display:none !important}
    body.inMatch #wandBtn{width:104px;height:104px;font-size:52px;bottom:calc(140px + env(safe-area-inset-bottom))}
    body.inMatch #wandBtn.ready{box-shadow:0 0 0 6px #9effa0,0 0 30px #9effa0;animation:lsnPulse .7s infinite}
    #qEnd{position:fixed;inset:0;z-index:48;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
    #qEnd.on{display:flex}
    #qEnd .p{background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:18px 26px 22px;text-align:center;color:#fff;width:min(90vw,520px)}
    #qEnd .tr{font-size:110px;line-height:1.05;animation:lsnPop .6s} #qEnd .ti{font-size:44px;font-weight:bold;color:#ffd76a;text-shadow:0 3px 0 #7a3b00}
    #qEnd .sc{font-size:54px;font-weight:bold;direction:ltr;margin:6px 0} #qEnd .st{font-size:54px;letter-spacing:6px}
    #qEnd .row{display:flex;gap:14px;justify-content:center;margin-top:14px}
    #qEnd button{min-width:150px;min-height:76px;border-radius:40px;border:4px solid #fff;font:bold 30px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation}
    #qEnd .again{background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00} #qEnd .done{background:linear-gradient(#b5a0ff,#7a52d6);color:#fff}
    #qEnd .swap{min-width:84px;background:linear-gradient(#9ff0c0,#3fae7a);color:#0b3a22}
    #qBoard .sn.txt{opacity:1;font-size:26px;animation:none;min-width:58px;text-align:center}
    #qPick{position:fixed;inset:0;z-index:47;display:none;align-items:center;justify-content:center;background:radial-gradient(ellipse at center,rgba(40,24,90,.7),rgba(5,3,25,.92));font-family:'Rubik',sans-serif;direction:rtl}
    #qPick.on{display:flex}
    #qPick .p{position:relative;background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:28px;padding:14px 22px 20px;text-align:center;color:#fff;width:min(92vw,560px);box-sizing:border-box}
    #qPick .ti{font-size:64px;line-height:1.1} #qPick .g{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-top:8px}
    #qPick .qR{min-height:150px;border-radius:26px;border:4px solid #ffd76a;background:linear-gradient(#4a2f9a,#2a1a66);color:#fff;font:bold 28px 'Rubik',sans-serif;cursor:pointer;touch-action:manipulation;
      display:flex;flex-direction:column;align-items:center;justify-content:center;gap:2px;padding:6px}
    #qPick .qR:active{transform:scale(.95)} #qPick .qR .e{font-size:62px;line-height:1.1} #qPick .qR .s{font-size:22px;letter-spacing:3px;min-height:26px}
    #qPick .x{position:absolute;top:10px;left:10px;width:58px;height:58px;border-radius:50%;border:4px solid #ffd76a;background:rgba(40,25,90,.9);color:#fff;font-size:26px;padding:0}`;
    document.head.appendChild(css);
    const board = document.createElement('div'); board.id = 'qBoard';
    board.innerHTML = '<span class="tm"><span class="me">🦁</span><span class="a">0</span></span><span>:</span><span class="tm"><span class="b">0</span><span>🐍</span></span><span class="sn">✨</span>';
    document.body.appendChild(board);
    const exitB = document.createElement('button'); exitB.id = 'qExit'; exitB.textContent = '✕'; document.body.appendChild(exitB);
    exitB.addEventListener('click', (e) => { e.stopPropagation(); quit(); });
    const hint = document.createElement('div'); hint.id = 'qHint'; document.body.appendChild(hint);
    const endOv = document.createElement('div'); endOv.id = 'qEnd'; document.body.appendChild(endOv);
    endOv.addEventListener('pointerdown', (e) => e.stopPropagation());
    const pickOv = document.createElement('div'); pickOv.id = 'qPick'; document.body.appendChild(pickOv);
    pickOv.addEventListener('pointerdown', (e) => e.stopPropagation());
    const elA = board.querySelector('.a'), elB = board.querySelector('.b'), elSn = board.querySelector('.sn'), elMe = board.querySelector('.me');
    const wandBtn = () => document.getElementById('wandBtn');
    function setHint(t) { if (hint.textContent !== t) hint.textContent = t; }
    function bumpEl(e) { e.classList.remove('pop'); void e.offsetWidth; e.classList.add('pop'); }

    // ---------------- match state ----------------
    const S = { on: false };
    const P = g.player, pv = v(), tmp = v(), tmp2 = v();
    let yaw = 0, bank = 0;
    const camPos = v(), camLook = v();
    function reset() {
      const lv = st.qLevel;
      Object.assign(S, { t: 0, a: 0, b: 0, holder: null, stun: 0, boost: 0, boostCd: 0, snitchOn: false, snitchSpd: 13 + lv * 0.9, juke: 0, goals: 0, over: false, throwT: 0, shot: null,
        rivalSpd: 9.5 + lv * 1.3, keepSpd: 2.6 + lv * 0.55, save: Math.max(0.25, 0.6 - lv * 0.05), bludGap: Math.max(5, 12 - lv), cheer: 0, kick: 1.6, stealCd: 0, snTarget: v(), rivalShot: 0, aim: 1, hits: 0, dodges: 0, saves: 0, calm: false,
        swing: 0, whacks: 0, endT: 0, len: 80, mateSpd: 9.5 + lv * 0.7, kq: { n: 0, total: 8, phase: 'wait', t: 2.2, z: C.z, hoop: 1 }, bq: { n: 0, total: 8 } });
      const role = S.role || 'classic';
      P.position.set(C.x - 10, gy + 5, C.z); yaw = Math.PI / 2; pv.set(0, 0, 0);
      quaffle.position.set(C.x, gy + 7, C.z);
      rival.position.set(C.x + 12, gy + 6, C.z); keepA.position.set(GOAL_X - 2.2, gy + 11, C.z); keepB.position.set(HOME_X + 2.2, gy + 11, C.z);
      keepA.rotation.y = -Math.PI / 2; keepB.rotation.y = Math.PI / 2;
      bludgers.forEach((b, i) => { b.state = 'roam'; b.t = 5 + i * 4; b.pos.set(C.x + (i ? 14 : -14), gy + 9, C.z + (i ? -10 : 10)); b.gl.material.opacity = 0; });
      snitch.visible = false; warn.visible = false; aimRing.visible = false;
      elA.textContent = '0'; elB.textContent = '0'; elSn.classList.remove('on');
      const h = window.HPI && HPI.HOUSES.find((x) => x.key === st.house); elMe.textContent = h ? h.crest : '🦁';
      // ---- position-specific kick-off ----
      mate.visible = role === 'seeker' || role === 'beater'; mate.position.set(C.x - 6, gy + 8, C.z + 6); mate.userData.spin = 0; keepB.userData.spin = 0;
      keepB.visible = role !== 'keeper'; myBat.visible = role === 'beater';
      aimRing.material.color.setHex(role === 'keeper' ? 0xff5a5a : 0x9effa0);
      elSn.classList.toggle('txt', role === 'chaser' || role === 'keeper' || role === 'beater'); elSn.textContent = '✨';
      if (role === 'keeper') { P.position.set(HOME_X + 2.4, gy + 11.3, C.z); rival.position.set(HOME_X + 20, gy + 11, C.z); S.holder = 'rival'; }
      if (role === 'beater') { P.position.set(C.x - 8, gy + 9, C.z); S.holder = 'mate'; rival.position.set(C.x + 18, gy + 8, C.z - 12); bludgers.forEach((b, i) => { b.t = 3 + i * 3.5; }); }
      const w = wandBtn(); if (S.on && w) w.textContent = ROLES[role] ? ROLES[role].btn : '🤾';
      camPos.set(P.position.x - 9, P.position.y + 5, P.position.z); camLook.copy(P.position);
    }
    // ---- the position chooser ----
    function openPick() {
      if (S.on || g.modal || !g.started) return false;
      st.qRoles = st.qRoles || {};
      pickOv.innerHTML = '<div class="p"><button class="x" type="button">✕</button><div class="ti">🧹</div><div class="g">' + Object.keys(ROLES).map((k) => '<button class="qR" type="button" data-r="' + k + '"><span class="e">' + ROLES[k].e
        + '</span><span class="n">' + ROLES[k].n + '</span><span class="s">' + '⭐'.repeat(st.qRoles[k] || 0) + '</span></button>').join('') + '</div></div>';
      pickOv.querySelector('.x').addEventListener('click', (e) => { e.stopPropagation(); closePick(); });
      pickOv.querySelectorAll('.qR').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); closePick(); start(b.dataset.r); }));
      g.setModal(true); pickOv.classList.add('on'); try { HP.sfx.flip(); } catch (e) {}
      return true;
    }
    function closePick() { if (!pickOv.classList.contains('on')) return; pickOv.classList.remove('on'); g.setModal(false); }
    function start(role) {
      if (S.on || g.modal || !g.started) return false;
      S.role = ROLES[role] ? role : 'classic';
      if (g.world !== 'outside' || F.dist(g.player.position, C.x, C.z) > 60) g.fastTravel({ world: 'outside', x: STAND.x, z: STAND.z + 2, face: 0, yaw: Math.PI });
      S.on = true; reset(); actors.visible = true; P.add(myBroom); P.add(myBat);
      document.body.classList.add('inMatch');
      endOv.classList.remove('on');
      g.setTakeover({ update, action, boost });
      whistle(); F.toast(ROLES[S.role] ? ROLES[S.role].e : '🧹', ROLES[S.role] ? ROLES[S.role].n + '!' : 'קְוִוידִיץ׳!', 1500); setHint(roleHint());
      return true;
    }
    function leave() {                                            // back on your feet by the stand
      S.on = false; actors.visible = false; P.remove(myBroom); P.remove(myBat); P.rotation.set(0, 0, 0);
      document.body.classList.remove('inMatch'); const w = wandBtn(); if (w) { w.textContent = '🪄'; w.classList.remove('ready'); }
      g.setTakeover(null);
      g.fastTravel({ world: 'outside', x: STAND.x, z: STAND.z - 3, face: 0, yaw: Math.PI });
      settleCrowd();
    }
    function quit() { if (!S.on) return; endOv.classList.remove('on'); leave(); }
    function whistle() { F.sfx.tone(2300, 0.35, 'square', 0.08, 0, 2500); F.sfx.tone(2300, 0.5, 'square', 0.08, 0.4, 2100); }
    function roar(big) { F.sfx.noise(big ? 2.4 : 1.3, big ? 0.3 : 0.2, 0, 900, 0.5); F.sfx.noise(big ? 2.0 : 1.0, 0.12, 0.1, 2200, 0.7); S.cheer = big ? 6 : 2.4; }
    function settleCrowd() { CROWD.forEach((p, i) => { dummy.position.set(p.x, p.y, p.z); dummy.scale.set(1, 1.25, 1); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); }); crowd.instanceMatrix.needsUpdate = true; }

    const canHold = () => S.role === 'classic' || S.role === 'chaser';      // only these positions handle the Quaffle themselves
    const bgMatch = () => S.role === 'seeker';                               // the Chasers (mate vs rival) play the Quaffle on their own
    function action() { return canHold() ? throwQuaffle() : S.role === 'beater' ? swing() : boost(); }
    function swing() { if (!S.on || S.over || S.swing > 0) return false; S.swing = 0.45; try { HP.sfx.whoosh(); } catch (e) {} return true; }
    function roleHint() {
      return S.role === 'keeper' ? '🧤 עִצְרוּ אֶת הַכַּדּוּר!' : S.role === 'beater' ? '🏏 חִבְטוּ בַּכַּדּוּר הַשָּׁחֹר!' : S.role === 'seeker' ? (S.snitchOn ? '✨ תִּפְסוּ אֶת הַסְּנִיץ׳!' : '👀 ✨ ?')
        : '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!';
    }
    function addScore(mine, n) { if (mine) { S.a += n; elA.textContent = S.a; bumpEl(elA); } else { S.b += n; elB.textContent = S.b; bumpEl(elB); } }
    function boost() { if (!S.on || S.over || S.boostCd > 0 || S.stun > 0) return false; S.boost = 0.9; S.boostCd = 2.2; F.sfx.zap(); return true; }
    function nearestHoop() {                                       // the hoop your broom is pointing at
      let best = 1, bd = 1e9; const fx = Math.sin(yaw), fz = Math.cos(yaw);
      for (let i = 0; i < 3; i++) { const dx = GOAL_X - P.position.x, dz = HOOP_Z[i] - P.position.z, d = Math.hypot(dx, dz) || 1; const ang = Math.acos(Math.max(-1, Math.min(1, (dx * fx + dz * fz) / d))); const sc = ang + Math.abs(dz) * 0.02; if (sc < bd) { bd = sc; best = i; } }
      return best;
    }
    const inRange = () => S.holder === 'me' && GOAL_X - P.position.x < 20 && GOAL_X - P.position.x > 1.5;
    function throwQuaffle() {
      if (!S.on || S.over || S.holder !== 'me' || S.shot) return false;
      if (!inRange()) { setHint('➡️ קָרוֹב יוֹתֵר לַטַּבָּעוֹת!'); F.sfx.squeak(); return false; }
      const i = S.aim; S.holder = null;
      S.shot = { from: quaffle.position.clone(), to: new T.Vector3(GOAL_X, gy + HOOP_Y[i], HOOP_Z[i]), t: 0, dur: 0.55, by: 'me', hoop: i };
      F.sfx.boing(); g.cheer(0.5); return true;
    }
    function goal(mine) {
      S.goals++;
      if (mine) { S.a += 10; elA.textContent = S.a; bumpEl(elA); F.toast('🥅', '+10', 1100); F.confetti(['🔴', '⭐', '🎉'], 12); roar(false); F.sfx.tada(); g.fx.fireworks(new T.Vector3(GOAL_X, gy + 12, C.z), 6, 3); }
      else { S.b += 10; elB.textContent = S.b; bumpEl(elB); F.sfx.tone(300, 0.4, 'sawtooth', 0.12, 0, 160); }
      S.holder = null; S.shot = null; quaffle.position.set(C.x, gy + 7, C.z); S.kick = 1.4; whistle();
      rival.position.set(C.x + 10, gy + 6, C.z + (Math.random() - 0.5) * 12);
      if (bgMatch()) mate.position.set(C.x - 10, gy + 6, C.z + (Math.random() - 0.5) * 12);
    }
    function releaseSnitch() {
      if (S.snitchOn || S.over) return; S.snitchOn = true; snitch.visible = true;
      snitch.position.set(C.x + (Math.random() - 0.5) * 20, gy + 12, C.z + (Math.random() - 0.5) * 16); S.snTarget.copy(snitch.position);
      elSn.classList.add('on'); F.toast('✨', 'הַסְּנִיץ׳ הַזָּהוֹב!', 1600); F.sfx.tune([1568, 2093, 2637, 3136], 0.09, 'sine');
    }
    function finish() {
      S.over = true; S.a += 150; elA.textContent = S.a; bumpEl(elA);
      snitch.visible = false; elSn.classList.remove('on'); S.holder = null;
      endMatch();
    }
    // the final whistle for the positions that do not end on the Snitch (Chaser: time; Keeper: 8 shots; Beater: 8 Bludgers)
    function finishRole() {
      if (S.over) return;
      S.over = true; S.holder = null; S.shot = null; aimRing.visible = false; warn.visible = false; whistle();
      endMatch();
    }
    function endMatch() {
      roar(true); F.sfx.tada(); F.confetti(['✨', '🏆', '🎉', '⭐', '💛'], 34); g.cheer(4);
      // two volleys of four bursts: festive, but never hundreds of sprites on screen at once (iPad)
      for (let k = 0; k < 2; k++) setTimeout(() => g.fx.fireworks(new T.Vector3(C.x + (k ? 12 : -12), gy + 16, C.z), 10, 4), k * 1100);
      const win = S.a > S.b; st.qWins += win ? 1 : 0;
      const stars = (S.role === 'classic' || S.role === 'seeker') ? (S.b === 0 && S.a >= 180 ? 3 : S.a - S.b >= 150 ? 3 : win ? 2 : 1) : (win ? (S.b === 0 || S.a - S.b >= 40 ? 3 : 2) : 1);
      if (ROLES[S.role]) { st.qRoles = st.qRoles || {}; st.qRoles[S.role] = Math.max(st.qRoles[S.role] || 0, stars); }
      if (win && stars >= 2) st.qLevel = Math.min(8, st.qLevel + 1); F.save();
      try { if (window.HPLessons && HPLessons.progress.bonus) HPLessons.progress.bonus(win ? 30 : 10); } catch (e) {}
      S.result = { a: S.a, b: S.b, win, stars, level: st.qLevel, role: S.role };
      setTimeout(() => {
        endOv.innerHTML = '<div class="p"><div class="tr">🏆</div><div class="ti">' + (win ? 'נִצָּחוֹן!' : 'מִשְׂחָק מְצֻיָּן!') + '</div><div class="sc">' + elMe.textContent + ' ' + S.a + ' : ' + S.b + ' 🐍</div><div class="st">' + '⭐'.repeat(stars) + '☆'.repeat(3 - stars)
          + '</div><div class="row"><button class="again">🔁 שׁוּב</button>' + (ROLES[S.role] ? '<button class="swap">🧹</button>' : '') + '<button class="done">סִיּוּם</button></div></div>';
        const sw = endOv.querySelector('.swap'); if (sw) sw.addEventListener('click', () => { endOv.classList.remove('on'); leave(); setTimeout(openPick, 350); });      // try another position
        endOv.querySelector('.again').addEventListener('click', () => { endOv.classList.remove('on'); reset(); whistle(); });
        endOv.querySelector('.done').addEventListener('click', () => { endOv.classList.remove('on'); leave(); });
        endOv.classList.add('on'); F.award('quidditch');
      }, 2600);
    }

    // ---------------- per-frame ----------------
    function steer(obj, tx, ty, tz, spd, dt) {                   // fly an actor toward a point; returns distance left
      tmp.set(tx - obj.position.x, ty - obj.position.y, tz - obj.position.z); const d = tmp.length();
      if (d > 0.05) { tmp.multiplyScalar(Math.min(1, spd * dt / d)); obj.position.add(tmp); obj.rotation.y = Math.atan2(tx - obj.position.x, tz - obj.position.z); }
      return d;
    }
    // Keeper game: the rival Chaser lines up, a red ring shows the hoop, then the shot flies — be in front of that hoop
    function keeperAI(dt, t) {
      const k = S.kq; k.t -= dt;
      if (k.phase === 'wait') {
        S.holder = 'rival'; const d = steer(rival, HOME_X + 15, gy + 11, k.z, S.rivalSpd, dt);
        if (k.t <= 0 && d < 3) { k.phase = 'aim'; k.hoop = (Math.random() * 3) | 0; k.t = Math.max(0.7, 1.5 - st.qLevel * 0.08); rival.rotation.y = -Math.PI / 2; F.sfx.tone(600, 0.25, 'triangle', 0.1, 0, 900); }
      } else if (k.phase === 'aim') {
        aimRing.visible = true; aimRing.position.set(HOME_X + 0.2, gy + HOOP_Y[k.hoop], HOOP_Z[k.hoop]); aimRing.scale.setScalar(1 + Math.sin(t * 9) * 0.08);
        if (k.t <= 0) { S.holder = null; S.shot = { from: quaffle.position.clone(), to: new T.Vector3(HOME_X + 1.6, gy + HOOP_Y[k.hoop], HOOP_Z[k.hoop]), t: 0, dur: Math.max(0.55, 1.05 - st.qLevel * 0.05), by: 'shooter', hoop: k.hoop }; k.phase = 'fly'; F.sfx.boing(); }
      }
      HP.animateChibi(rival, dt, t, 0);
    }
    function shotLands(s) {
      const k = S.kq; S.shot = null; aimRing.visible = false;
      if (Math.abs(P.position.z - s.to.z) < 2.5) { S.saves++; addScore(true, 10); F.toast('🧤', '', 800); roar(false); F.sfx.boing(); F.sfx.tada(); g.cheer(0.6); g.fx.burst(quaffle.position, [0xffffff, 0xffd34d, 0x9effa0], 22, 6, 0.7); }
      else { addScore(false, 10); F.sfx.tone(300, 0.4, 'sawtooth', 0.12, 0, 160); }
      k.n++;
      if (k.n >= k.total) { S.endT = 1.2; S.holder = null; quaffle.position.set(HOME_X + 8, gy + 8, C.z); }
      else { k.phase = 'wait'; k.t = 1.4; k.z = C.z + (Math.random() - 0.5) * 10; S.holder = 'rival'; }
    }
    // Beater game: touch the charging Bludger (🏏 swings wider) and it sails away
    function whack(b) {
      const pp = P.position, reach = S.swing > 0 ? 5 : 3.1;
      if (Math.hypot(b.pos.x - pp.x, (b.pos.y - pp.y - 1) * 0.5, b.pos.z - pp.z) > reach) return false;
      S.whacks++; addScore(true, 10); S.swing = 0.45;
      F.sfx.tone(170, 0.14, 'square', 0.22); F.sfx.noise(0.16, 0.28, 0, 1300, 1); F.toast('💥', '', 700); roar(false); g.cheer(0.6);
      g.fx.burst(b.pos, [0xffffff, 0xffd34d, 0xff8a5a], 24, 8, 0.7);
      b.dir.set(1, 0.3, (Math.random() - 0.5) * 0.8).normalize(); b.state = 'gone'; b.t = 1.1; b.gl.material.opacity = 0; warn.visible = false;
      S.bq.n++; if (S.bq.n >= S.bq.total) S.endT = 1.4;
      return true;
    }
    function attackDone(b) { b.state = 'roam'; b.t = 2 + Math.random() * 1.5; b.gl.material.opacity = 0; warn.visible = false; S.bq.n++; if (S.bq.n >= S.bq.total) S.endT = 1.4; }
    function update(dt, t, ax, playing) {
      if (!S.on) return;
      const cam = g.camera, pp = P.position;
      if (!playing || g.modal) { cam.position.copy(camPos); cam.lookAt(camLook); return; }
      S.t += dt; if (S.kick > 0) S.kick -= dt;
      if (S.boostCd > 0) S.boostCd -= dt; if (S.boost > 0) S.boost -= dt; if (S.stealCd > 0) S.stealCd -= dt;
      if (S.swing > 0) S.swing -= dt; myBat.rotation.x = S.swing > 0 ? Math.sin((1 - S.swing / 0.45) * Math.PI) * 2.2 : 0;
      if (S.endT > 0 && !S.over) { S.endT -= dt; if (S.endT <= 0) finishRole(); }
      if (S.role === 'chaser' && !S.over) { const left = Math.max(0, S.len - S.t); elSn.textContent = '⏱' + Math.ceil(left); if (left <= 0) finishRole(); }
      else if (S.role === 'keeper') elSn.textContent = '🧤' + Math.min(S.kq.n + 1, S.kq.total) + '/' + S.kq.total;
      else if (S.role === 'beater') elSn.textContent = '🏏' + Math.min(S.bq.n + 1, S.bq.total) + '/' + S.bq.total;

      // ---- you: stick steers relative to the chase camera; height looks after itself ----
      if (S.role === 'keeper') {
        // Keeper: the stick slides you left/right in front of your three hoops (⬆️ / 🧤 = a quick dash); the broom finds the hoop's height
        const kspd = S.boost > 0 ? 20 : 11.5;
        pv.x = 0; pv.z += ((S.over ? 0 : ax.x * kspd) - pv.z) * Math.min(1, dt * 8);
        bank += (-ax.x * 0.5 - bank) * Math.min(1, dt * 6); yaw = Math.PI / 2;
        P.rotation.set(0.1, yaw, HPI.clamp(bank, -0.6, 0.6), 'YXZ');
      }
      else if (S.stun > 0) { S.stun -= dt; P.rotation.y += dt * 16; pv.multiplyScalar(1 - dt * 3); }
      else if (!S.over) {
        const camYaw = Math.atan2(pp.x - camPos.x, pp.z - camPos.z);
        const mx = ax.y * Math.sin(camYaw) - ax.x * Math.cos(camYaw), mz = ax.y * Math.cos(camYaw) + ax.x * Math.sin(camYaw);   // forward + right of the camera
        const spd = (S.boost > 0 ? 31 : 20) * (S.holder === 'me' ? 0.92 : 1);
        const want = ax.l > 0.05 ? spd * ax.l : (S.calm ? 0 : 2.5);   // (practice/calm mode: the broom hovers in place)              // the broom always drifts forward a little
        if (ax.l > 0.05) { const wy = Math.atan2(mx, mz); let d = ((wy - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yaw += d * Math.min(1, dt * 5.5); bank += (-d * 0.9 - bank) * Math.min(1, dt * 6); }
        else bank *= 1 - Math.min(1, dt * 4);
        pv.x += (Math.sin(yaw) * want - pv.x) * Math.min(1, dt * 4); pv.z += (Math.cos(yaw) * want - pv.z) * Math.min(1, dt * 4);
        P.rotation.set(0.18, yaw, HPI.clamp(bank, -0.6, 0.6), 'YXZ');
      }
      pp.x += pv.x * dt; pp.z += pv.z * dt;
      if (S.role === 'keeper') { pp.x = HOME_X + 2.4; pp.z = HPI.clamp(pp.z, HOOP_Z[0] - 2.5, HOOP_Z[2] + 2.5); }
      else if (clampArena(pp)) { const out = Math.atan2(pp.x - C.x, pp.z - C.z); let d = ((out + Math.PI - yaw + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI; yaw += d * Math.min(1, dt * 2); }
      // smart altitude: ease toward whatever you are after
      let wantY = gy + 7;
      if (S.role === 'keeper') wantY = gy + 10.5 + 2 * Math.max(0, 1 - Math.abs(pp.z - HOOP_Z[1]) / 6);          // the middle hoop is the high one
      else if (S.role === 'seeker') wantY = S.snitchOn ? snitch.position.y : gy + 9;
      else if (S.role === 'beater') { const hot = bludgers.find((b) => b.state === 'aim' || b.state === 'charge'); wantY = hot ? hot.pos.y - 1 : gy + 9; }
      else if (S.holder === 'me') wantY = gy + 7 + 4.5 * HPI.clamp(1 - (GOAL_X - pp.x) / 22, 0, 1);
      else {
        const dq = quaffle.position.distanceTo(pp), ds = S.snitchOn ? snitch.position.distanceTo(pp) : 1e9;
        wantY = (ds < dq * 1.3 ? snitch.position.y : (S.holder === 'rival' ? rival.position.y : quaffle.position.y));
      }
      pp.y += (HPI.clamp(wantY, gy + 2.5, gy + 18) - pp.y) * Math.min(1, dt * 2.6) + Math.sin(t * 3) * 0.004;
      HP.animateChibi(P, dt, t, S.over ? 1 : 0);
      if (S.boost > 0 || Math.random() < 0.3) g.fx.trail(tmp.set(pp.x - Math.sin(yaw) * 1.6, pp.y + 0.5, pp.z - Math.cos(yaw) * 1.6), S.boost > 0 ? 0x7cf0ff : 0xffe9a0, 0.4);

      // ---- Quaffle ----
      const w = wandBtn();
      if (S.shot) {
        const s = S.shot; s.t += dt; const k = Math.min(1, s.t / s.dur);
        quaffle.position.lerpVectors(s.from, s.to, k); quaffle.position.y += Math.sin(k * Math.PI) * 1.6;
        if (k >= 1) {
          if (s.by === 'me') { const kd = Math.abs(keepA.position.z - s.to.z); if (kd < 2.4) { S.shot = null; S.holder = null; quaffle.position.set(GOAL_X - 6, gy + 8, C.z + (Math.random() - 0.5) * 10); F.sfx.boing(); F.toast('🧤', '', 800); S.saves++; setHint('הַשּׁוֹעֵר עָצַר! כַּוְּנוּ לְטַבַּעַת רֵיקָה'); S.kick = 0.6; } else goal(true); }
          else if (s.by === 'mate') { if (Math.random() < 0.45) { S.shot = null; quaffle.position.set(GOAL_X - 7, gy + 8, C.z); F.sfx.boing(); S.kick = 0.5; } else goal(true); }
          else if (s.by === 'shooter') shotLands(s);
          else { if (Math.random() < S.save) { S.shot = null; quaffle.position.set(HOME_X + 7, gy + 8, C.z); F.sfx.boing(); S.kick = 0.5; } else goal(false); }
        }
      } else if (S.holder === 'me') {
        quaffle.position.set(pp.x + Math.sin(yaw) * 0.9, pp.y + 1.5, pp.z + Math.cos(yaw) * 0.9);
        S.aim = nearestHoop();
        const ok = inRange(); if (w) w.classList.toggle('ready', ok);
        aimRing.visible = ok; if (ok) { aimRing.position.set(GOAL_X - 0.2, gy + HOOP_Y[S.aim], HOOP_Z[S.aim]); aimRing.scale.setScalar(1 + Math.sin(t * 9) * 0.08); }
        setHint(ok ? '🤾 זִרְקוּ לַטַּבַּעַת!' : '➡️ טוּסוּ לַטַּבָּעוֹת!');
      } else {
        if (w) w.classList.remove('ready'); if (S.role !== 'keeper') aimRing.visible = false;
        if (S.holder === 'rival') quaffle.position.set(rival.position.x, rival.position.y + 1.5, rival.position.z);
        else if (S.holder === 'mate') quaffle.position.set(mate.position.x, mate.position.y + 1.5, mate.position.z);
        else { quaffle.position.y += Math.sin(t * 2.5) * 0.01; if (canHold() && S.kick <= 0 && S.stun <= 0 && quaffle.position.distanceTo(pp) < 2.4) { S.holder = 'me'; F.sfx.tink(4); try { HP.sfx.pop(); } catch (e) {} } }
        if (!S.over) setHint(!canHold() ? roleHint() : S.snitchOn ? '✨ תִּפְסוּ אֶת הַסְּנִיץ׳!' : S.holder === 'rival' ? '💥 הִתְנַגְּשׁוּ בַּיָּרִיב לַחֲטֹף!' : '🔴 תִּפְסוּ אֶת הַכַּדּוּר הָאָדֹם!');
      }
      quaffle.rotation.y += dt * 3;

      // ---- rival Chaser ----
      if (S.role === 'keeper') { if (!S.over && !S.calm) keeperAI(dt, t); }
      else if (S.role === 'beater') {
        // the Beater game: your Chaser loops about with the Quaffle and your Keeper minds the hoops — keep the Bludgers off them
        if (mate.userData.spin > 0) { mate.userData.spin -= dt; mate.rotation.y += dt * 16; }
        else { mate.position.set(C.x + Math.sin(t * 0.3) * 15, gy + 9 + Math.sin(t * 0.8) * 1.5, C.z + Math.sin(t * 0.6) * 9); mate.rotation.y = Math.atan2(Math.cos(t * 0.3) * 4.5, Math.cos(t * 0.6) * 5.4); }
        if (keepB.userData.spin > 0) { keepB.userData.spin -= dt; keepB.rotation.y += dt * 16; if (keepB.userData.spin <= 0) keepB.rotation.y = Math.PI / 2; }
        rival.position.y = gy + 8 + Math.sin(t * 1.3) * 0.6;
        HP.animateChibi(mate, dt, t, 0); HP.animateChibi(rival, dt, t, 0);
      }
      else if (!S.over && !S.calm) {
        if (bgMatch()) {                                             // your team's Chaser plays the Quaffle for you
          if (S.holder === 'mate') {
            const d = steer(mate, GOAL_X - 9, gy + 11, C.z + Math.cos(S.t * 0.6) * 5, S.mateSpd * 0.9, dt);
            if (mate.position.x > GOAL_X - 13 || d < 1) { S.holder = null; const i = (Math.random() * 3) | 0; S.shot = { from: quaffle.position.clone(), to: new T.Vector3(GOAL_X, gy + HOOP_Y[i], HOOP_Z[i]), t: 0, dur: 0.6, by: 'mate', hoop: i }; }
            else { steer(rival, mate.position.x, mate.position.y, mate.position.z, S.rivalSpd * 0.75, dt); if (S.stealCd <= 0 && rival.position.distanceTo(mate.position) < 1.8 && Math.random() < dt * 0.9) { S.holder = 'rival'; S.stealCd = 2; } }
          } else if (S.holder === 'rival') {
            steer(mate, rival.position.x, rival.position.y, rival.position.z, S.mateSpd * 0.8, dt);
            if (S.stealCd <= 0 && rival.position.distanceTo(mate.position) < 1.8 && Math.random() < dt * 0.9) { S.holder = 'mate'; S.stealCd = 2; }
          } else if (!S.shot && S.kick <= 0.4) {
            if (steer(mate, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.mateSpd, dt) < 1.6 && S.kick <= 0 && !S.holder) S.holder = 'mate';
          }
          HP.animateChibi(mate, dt, t, 0);
        }
        if (S.holder === 'mate') { /* the rival is already chasing your Chaser (above) */ }
        else if (S.holder === 'rival') {
          const d = steer(rival, HOME_X + 9, gy + 11, C.z + Math.sin(S.t * 0.7) * 5, S.rivalSpd * 0.9, dt);
          if (rival.position.x < HOME_X + 13 || d < 1) { S.holder = null; const i = (Math.random() * 3) | 0; S.shot = { from: quaffle.position.clone(), to: new T.Vector3(HOME_X, gy + HOOP_Y[i], HOOP_Z[i]), t: 0, dur: 0.6, by: 'rival', hoop: i }; }
          else if (canHold() && S.stealCd <= 0 && S.stun <= 0 && rival.position.distanceTo(pp) < 2.3) { S.holder = 'me'; S.stealCd = 1.5; F.sfx.boing(); F.toast('💪', '', 700); }
        } else if (S.holder === 'me') {
          steer(rival, pp.x + pv.x * 0.4, pp.y, pp.z + pv.z * 0.4, S.rivalSpd * 0.8, dt);
          if (S.stealCd <= 0 && rival.position.distanceTo(pp) < 1.7) { S.holder = 'rival'; S.stealCd = 1.6; F.sfx.yelp(); }
        } else if (!S.shot && S.kick <= 0.4) {
          if (steer(rival, quaffle.position.x, quaffle.position.y - 1, quaffle.position.z, S.rivalSpd, dt) < 1.6 && S.kick <= 0 && !S.holder) S.holder = 'rival';
        }
        HP.animateChibi(rival, dt, t, 0);
      }
      // ---- Keepers: theirs shadows your aim (with a lag you can beat); yours drifts ----
      const kz = S.holder === 'me' ? HOOP_Z[S.aim] : C.z + Math.sin(t * 0.8) * 5;
      keepA.position.z += HPI.clamp(kz - keepA.position.z, -S.keepSpd * dt, S.keepSpd * dt); keepA.position.y = gy + 11 + Math.sin(t * 2) * 0.3;
      if (!(keepB.userData.spin > 0)) { keepB.position.z = C.z + Math.sin(t * 0.9 + 1) * 5; keepB.position.y = gy + 11 + Math.cos(t * 2) * 0.3; }

      // ---- Bludgers ----
      // (Beater game: one at a time goes for a team-mate, slower, and you whack it away; everywhere else they go for you)
      const nightGlow = (window.HPI && window.HPI.nightness) || 0;
      const beater = S.role === 'beater', quiet = S.role === 'keeper' || S.calm || S.over;
      for (const b of bludgers) {
        b.t -= dt;
        if (b.state === 'roam') {
          b.pos.set(C.x + Math.sin(t * 0.5 + b.ph) * 22, gy + 9 + Math.sin(t * 0.9 + b.ph) * 3, C.z + Math.cos(t * 0.37 + b.ph * 2) * 15);
          if (b.t <= 0 && !quiet && (beater ? !bludgers.some((o) => o !== b && o.state !== 'roam') && S.bq.n < S.bq.total && S.endT <= 0 : S.stun <= 0)) {
            b.state = 'aim'; b.t = beater ? 1.9 : 1.15; b.victim = beater ? (S.bq.n % 3 === 2 ? keepB : mate) : null; F.sfx.tone(700, 1.0, 'sawtooth', 0.07, 0, 1500);
          }
        } else if (b.state === 'aim') {                            // glows red + a ⚠️ over the target's head: swerve! (or, as Beater: get there!)
          const vp = b.victim ? b.victim.position : pp;
          b.gl.material.opacity = 0.5 + 0.4 * Math.sin(t * 30); warn.visible = true; warn.position.set(vp.x, vp.y + 4.2, vp.z);
          if (beater && whack(b)) continue;
          if (b.t <= 0) { b.dir.set(vp.x - b.pos.x, vp.y + 1 - b.pos.y, vp.z - b.pos.z).normalize(); b.state = 'charge'; b.t = beater ? 6 : 1.5; b.hit = false; }
        } else if (b.state === 'gone') {                           // whacked: it sails off toward the other end
          b.pos.addScaledVector(b.dir, 40 * dt); if (b.t <= 0) { b.state = 'roam'; b.t = 2 + Math.random() * 1.5; }
        } else if (beater) {
          const vp = b.victim.position;
          b.dir.set(vp.x - b.pos.x, vp.y + 1 - b.pos.y, vp.z - b.pos.z).normalize();         // it homes on your team-mate…
          b.pos.addScaledVector(b.dir, (12.5 + st.qLevel * 0.8) * dt); warn.visible = true; warn.position.set(vp.x, vp.y + 4.2, vp.z);
          if (whack(b)) continue;                                                           // …unless you get to it first
          if (b.pos.distanceTo(tmp.set(vp.x, vp.y + 1, vp.z)) < 1.8) {
            b.victim.userData.spin = 1; addScore(false, 10); F.sfx.yelp(); F.sfx.burp(); g.fx.burst(vp, [0xffffff, 0xff8a5a], 16, 6, 0.6);
            attackDone(b);
          } else if (b.t <= 0) attackDone(b);
        } else {
          b.pos.addScaledVector(b.dir, 30 * dt); warn.visible = false;
          if (!b.hit && S.stun <= 0 && Math.hypot(b.pos.x - pp.x, (b.pos.y - pp.y - 1) * 0.5, b.pos.z - pp.z) < 1.9) {   // forgiving in height: the broom picks its own altitude
            b.hit = true; S.stun = 1.0; S.hits++; F.sfx.burp(); F.sfx.yelp(); g.fx.burst(pp, [0xffffff, 0xff8a5a], 16, 6, 0.6);
            if (S.holder === 'me') { S.holder = null; S.kick = 0.9; quaffle.position.set(pp.x + 3, pp.y, pp.z + 3); clampArena(quaffle.position); }
          }
          if (b.t <= 0) { if (!b.hit) { S.dodges++; if (!S.over) { roar(false); F.toast('💨', 'אוֹלֶה!', 800); } }   // the crowd loves a good dodge
            b.state = 'roam'; b.t = S.bludGap * (0.7 + Math.random() * 0.6); b.gl.material.opacity = 0; }
        }
        b.m.rotation.x += dt * 5;
        b.m.material.emissiveIntensity = 0.12 + nightGlow * 0.95;      // after dark the Bludgers smoulder red, so they still show against the night sky
      }
      if (!bludgers.some((b) => b.state === 'aim' || (beater && b.state === 'charge'))) warn.visible = false;

      // ---- Golden Snitch ----
      if (!S.snitchOn && !S.over && !S.calm && (S.role === 'classic' ? (S.t > 55 || S.goals >= 3) : S.role === 'seeker' && S.t > 6)) releaseSnitch();
      if (S.snitchOn && !S.over) {
        const ds = snitch.position.distanceTo(tmp.set(pp.x, pp.y + 1.2, pp.z));
        S.juke -= dt;
        if (snitch.position.distanceTo(S.snTarget) < 1.5 || (ds < 6 && S.juke <= 0)) {
          if (ds < 6) { S.juke = 1.3; S.snitchSpd = Math.max(9.5, S.snitchSpd * 0.95); }
          S.snTarget.set(C.x + (Math.random() - 0.5) * AX * 1.6, gy + 5 + Math.random() * 9, C.z + (Math.random() - 0.5) * AZ * 1.6); clampArena(S.snTarget);
        }
        if (S.t > 150) S.snitchSpd = Math.min(S.snitchSpd, 9);
        tmp2.subVectors(S.snTarget, snitch.position); const dl = tmp2.length() || 1;
        snitch.position.addScaledVector(tmp2, Math.min(1, S.snitchSpd * dt / dl)); snitch.position.y += Math.sin(t * 9) * 0.03;
        HP.animateSnitch(snitch, t); if (Math.random() < 0.5) g.fx.trail(snitch.position, 0xffe08a, 0.35);
        if (ds < 2.1 && S.stun <= 0) finish();
      }

      // ---- crowd: a gentle sway, a wild bounce after goals ----
      if (S.cheer > 0) S.cheer -= dt;
      const amp = S.cheer > 0 ? 0.9 : 0.12, f = S.cheer > 0 ? 9 : 2;
      for (let i = 0; i < CROWD.length; i++) { const p = CROWD[i]; dummy.position.set(p.x, p.y + Math.abs(Math.sin(t * f + p.ph)) * amp, p.z); dummy.scale.set(1, 1.25, 1); dummy.updateMatrix(); crowd.setMatrixAt(i, dummy.matrix); }
      crowd.instanceMatrix.needsUpdate = true;

      // ---- chase camera: behind + above, a little wider when boosting ----
      const back = S.boost > 0 ? 12 : 10;
      if (S.role === 'keeper') {
        camPos.lerp(tmp.set(HOME_X - 11, gy + 15.5, C.z + (pp.z - C.z) * 0.35), 1 - Math.exp(-dt * 3.2));
        camLook.lerp(tmp2.set(HOME_X + 12, gy + 10, C.z + (pp.z - C.z) * 0.5), 1 - Math.exp(-dt * 6));
        cam.position.copy(camPos); cam.lookAt(camLook);
        return;
      }
      tmp.set(pp.x - Math.sin(yaw) * back, pp.y + 4.6, pp.z - Math.cos(yaw) * back);
      camPos.lerp(tmp, 1 - Math.exp(-dt * 3.2));
      camPos.y = Math.max(camPos.y, g.terrainH(camPos.x, camPos.z) + 1.5);
      camLook.lerp(tmp2.set(pp.x + Math.sin(yaw) * 5, pp.y + 1.6, pp.z + Math.cos(yaw) * 5), 1 - Math.exp(-dt * 6));
      cam.position.copy(camPos); cam.lookAt(camLook);
    }

    // ---------------- ways in: the stand on the grounds + a card in the lesson picker ----------------
    F.always(function (dt, t, player, world) {
      if (S.on || world !== 'outside') return;
      const d = F.dist(player.position, STAND.x, STAND.z);
      signS.position.y = 4.4 + Math.sin(t * 2) * 0.2; sGlow.material.opacity = 0.3 + 0.15 * Math.sin(t * 3);
      if (d < 5) F.offer('quidditch', '🧹', d, openPick);
    });
    const obs = new MutationObserver(() => {
      const p = document.querySelector('#pickOv .pickP'); if (!p || p.querySelector('.qCard')) return;
      const b = document.createElement('button'); b.className = 'pickClose qCard'; b.type = 'button';
      b.style.cssText = 'background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;margin-top:12px;font-size:24px;padding:10px 34px';
      b.textContent = '🧹 קְוִוידִיץ׳ — מִשְׂחָק!' + (st.qWins ? '  🏆×' + st.qWins : '');
      b.addEventListener('click', (e) => { e.stopPropagation(); const c = p.querySelector('.pickClose:not(.qCard)'); if (c) c.click(); setTimeout(openPick, 60); });
      p.insertBefore(b, p.querySelector('.pickClose'));
    });
    (function watch() { const ov = document.getElementById('pickOv'); if (!ov) return void setTimeout(watch, 300); obs.observe(ov, { childList: true }); })();

    F.mods.quidditch = {
      start, quit, boost, throwQuaffle, releaseSnitch, openPick, closePick, swing, roles: Object.keys(ROLES), stand: STAND, centre: C, goalX: GOAL_X, hoopZ: HOOP_Z,
      state: () => ({ role: S.role || null, pick: pickOv.classList.contains('on'), whacks: S.whacks, shots: S.kq ? S.kq.n : 0, kPhase: S.kq ? S.kq.phase : null, kHoop: S.kq ? S.kq.hoop : null, attacks: S.bq ? S.bq.n : 0, left: S.len - S.t,
        mateSpin: mate.userData.spin > 0, on: S.on, over: !!S.over, a: S.a, b: S.b, holder: S.holder, stun: S.stun > 0, snitch: !!S.snitchOn, t: S.t, aim: S.aim, hits: S.hits, dodges: S.dodges, saves: S.saves, level: st.qLevel, result: S.result || null,
        me: { x: P.position.x, y: P.position.y, z: P.position.z }, quaffle: { x: quaffle.position.x, y: quaffle.position.y, z: quaffle.position.z }, snitchPos: { x: snitch.position.x, y: snitch.position.y, z: snitch.position.z },
        shot: !!S.shot, boosting: S.boost > 0, speed: Math.hypot(pv.x, pv.z), keeperZ: keepA.position.z, inRange: inRange(), bludgers: bludgers.map((b) => b.state), inArena: Math.hypot((P.position.x - C.x) / AX, (P.position.z - C.z) / AZ) <= 1.001 }),
      // test helpers: put things somewhere exact (the match logic itself still runs for real)
      _place(x, y, z, yw) { P.position.set(x, y, z); pv.set(0, 0, 0); if (yw != null) yaw = yw; },
      _give() { S.holder = 'me'; S.shot = null; S.kick = 0; },      // tests: you are holding the Quaffle
      _quaffleAt(x, y, z) { S.holder = null; S.shot = null; S.kick = 0; quaffle.position.set(x, y, z); },
      _calm(on) { S.calm = !!on; },                     // tests: rival + Bludgers hold off unless told (so each rule is checked on its own)
      _rivalAway() { rival.position.set(C.x - 20, gy + 6, C.z - 14); S.stealCd = 5; },
      _keeperTo(z) { keepA.position.z = z; },
      _bludger() { const b = bludgers[0]; b.state = 'aim'; b.t = 0.05; b.pos.set(P.position.x + 8, P.position.y + 1, P.position.z); },
      _snitchTo(x, y, z) { snitch.position.set(x, y, z); S.snTarget.set(x, y, z); S.juke = 5; },
      _shoot(i) { const k = S.kq; rival.position.set(HOME_X + 15, gy + 11, C.z); S.holder = 'rival'; k.phase = 'aim'; k.hoop = i; k.t = 0.4; },   // Keeper: the next shot goes at hoop i
      _attack(atMate) { const b = bludgers[0]; bludgers[1].state = 'roam'; bludgers[1].t = 99; b.state = 'aim'; b.t = 0.3; b.victim = atMate === false ? keepB : mate; },   // Beater: a Bludger goes for a team-mate now
      _bludgerPos() { const b = bludgers[0]; return { x: b.pos.x, y: b.pos.y, z: b.pos.z, state: b.state, glow: b.m.material.emissiveIntensity }; },
      _timeLeft(sec) { S.t = S.len - sec; },                          // Chaser: jump to the last seconds
    };
  });
})();
