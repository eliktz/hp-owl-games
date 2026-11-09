/* Care of Magical Creatures with Hagrid — a listen-and-remember game by the paddock next to
 * his hut. Hagrid's hungry creatures call out one after another (each has its own voice +
 * wiggle); the child feeds them in the SAME order. A different skill from the maths
 * lessons: memory + rhythm. Adaptive: the sequence starts short and grows with host.lvl()
 * and round; higher levels add creatures, play faster, and sometimes ask for the order
 * BACKWARDS. A slip just replays an easier call (host.hit(false) eases it); too many → retry.
 * Also builds the little paddock outdoors so the lesson has a real place in the world. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  const ALL = [['🐉', 262], ['🦄', 330], ['🦉', 392], ['🐸', 494], ['🦔', 587], ['🐢', 659]];

  HPL.games.creatures = function (host) {
    const el = HPL.el, L = host.level;
    const nC = 4 + (L >= 4 ? 1 : 0) + (L >= 7 ? 1 : 0);
    const N = 4 + (L >= 3 ? 1 : 0) + (L >= 6 ? 1 : 0);
    const tone = (f, d) => { try { window.HPFun && HPFun.sfx.tone(f, d || 0.28, 'triangle', 0.22); } catch (e) {} };
    let round = 0, misses = 0, seq = [], want = [], pos = 0, accepting = false, isBack = false;

    const hint = el('div', { style: 'font-size:34px;min-height:44px;letter-spacing:4px', dir: 'ltr' }, '');
    const pen = el('div', { class: 'lsnRow', style: 'gap:12px;max-width:520px' });
    const btns = [];
    for (let i = 0; i < nC; i++) {
      const b = el('button', { class: 'lsnBtn', style: 'font-size:54px;min-width:104px;min-height:104px;background:linear-gradient(#bff0c8,#58b86a);transition:transform .12s,filter .12s' }, ALL[i][0]);
      b.dataset.i = i;
      b.addEventListener('click', () => tap(i, b));
      btns.push(b); pen.appendChild(b);
    }
    host.stage.appendChild(hint); host.stage.appendChild(pen);
    HPL._creatureNext = () => (accepting && pos < want.length ? btns[want[pos]] : null);

    function flash(i, ms) {
      const b = btns[i]; tone(ALL[i][1], ms / 1000 * 0.8);
      b.style.transform = 'scale(1.22) rotate(-6deg)'; b.style.filter = 'brightness(1.5) drop-shadow(0 0 18px #fff6a0)';
      host.after(ms * 0.62, () => { b.style.transform = ''; b.style.filter = ''; });
    }
    function lock(on) { btns.forEach((b) => { b.style.pointerEvents = on ? 'none' : 'auto'; b.style.opacity = on ? '.75' : '1'; }); }

    function play() {
      host.setProgress(round, N);
      if (round >= N) return finish();
      const lv = host.lvl();
      const len = Math.max(2, Math.min(9, 2 + Math.floor((lv - 1) / 2) + Math.floor(round / 2)));
      const back = lv >= 6 && round >= 2 && host.rnd(0, 2) === 0;          // sometimes: feed them backwards!
      seq = []; for (let k = 0; k < len; k++) { let c; do { c = host.rnd(0, nC - 1); } while (k > 0 && c === seq[k - 1] && nC > 2); seq.push(c); }
      isBack = back; want = back ? seq.slice().reverse() : seq.slice(); pos = 0; accepting = false; lock(true);
      host.say(back ? 'הַקְשֵׁב טוֹב... וְאָז הָפוּךְ! ◀️' : 'הַקְשֵׁב טוֹב... מִי קוֹרֵא?');
      hint.textContent = '👂';
      const step = Math.max(300, 640 - lv * 38);
      seq.forEach((c, k) => host.after(500 + k * step, () => flash(c, step)));
      host.after(500 + len * step + 150, () => {
        accepting = true; lock(false); hint.textContent = (back ? '◀️ ' : '') + '·'.repeat(len);
        host.say(back ? 'עַכְשָׁו אַתָּה — מֵהַסּוֹף לַהַתְחָלָה!' : 'עַכְשָׁו אַתָּה! הַאֲכֵל אוֹתָם לְפִי הַסֵּדֶר 🍖');
      });
    }
    function tap(i, b) {
      if (!accepting) return;
      if (i === want[pos]) {
        pos++; flash(i, 260);
        hint.textContent = (isBack ? '◀️ ' : '') + '🍖'.repeat(pos) + '·'.repeat(want.length - pos);
        if (pos >= want.length) {
          accepting = false; lock(true); host.hit(true);
          const r = b.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
          host.good(r.left - pr.left + 50, r.top - pr.top);
          btns.forEach((x, k) => host.after(k * 70, () => { x.animate([{ transform: 'translateY(0)' }, { transform: 'translateY(-16px)' }, { transform: 'translateY(0)' }], { duration: 320 }); }));
          host.say(['יָאמִי! 😋', 'הֵם מְאֻשָּׁרִים! 💚', 'בְּדִיּוּק כָּכָה!'][host.rnd(0, 2)]);
          round++; host.setProgress(round, N); host.after(1000, play);
        }
      } else {
        misses++; accepting = false; lock(true); host.bad(); host.hit(false);
        try { window.HPFun && HPFun.sfx.burp(); } catch (e) {}
        b.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 300);
        if (misses > N + 2) return host.after(500, () => host.fail('הַיְצוּרִים הִתְבַּלְבְּלוּ... נְנַסֶּה שׁוּב? 🐉'));
        host.say('אוּפְּס! נַקְשִׁיב שׁוּב 👂');
        host.after(1000, play);                       // a fresh (and, after the miss, gentler) call
      }
    }
    function finish() {
      HPL._creatureNext = () => null; lock(true);
      host.say('כֻּלָּם שְׂבֵעִים וּמְאֻשָּׁרִים! 🐉💚'); host.confetti();
      const stars = misses <= 1 ? 3 : misses <= 3 ? 2 : 1;
      host.after(900, () => host.win(stars));
    }
    play();
  };

  // ---- the paddock by Hagrid's hut (pure scenery + the lesson's walk-up spot) ----
  (function buildPaddock() {
    const g = window.__game, T = window.THREE;
    if (!g || !g.scene || !g.terrainH || !T) return void setTimeout(buildPaddock, 150);
    const CX = 68, CZ = 14, y0 = g.terrainH(CX, CZ);
    const pen = new T.Group(); pen.position.set(CX, y0, CZ);
    const wood = new T.MeshStandardMaterial({ color: 0x7a5a36, roughness: 1 });
    const R = 3.4;
    for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2, p = new T.Mesh(new T.CylinderGeometry(0.13, 0.16, 1.3, 6), wood); p.position.set(Math.cos(a) * R, 0.65, Math.sin(a) * R); pen.add(p); }
    [0.55, 1.05].forEach((h) => { const rail = new T.Mesh(new T.TorusGeometry(R, 0.07, 5, 30), wood); rail.rotation.x = Math.PI / 2; rail.position.y = h; pen.add(rail); });
    const straw = new T.Mesh(new T.CircleGeometry(R - 0.2, 20), new T.MeshStandardMaterial({ color: 0xc9a85a, roughness: 1 })); straw.rotation.x = -Math.PI / 2; straw.position.y = 0.06; pen.add(straw);
    const M = (c) => new T.MeshStandardMaterial({ color: c, roughness: 0.7 });
    const critters = [];
    [[0x4fbf5a, -1.2, -0.6, 'dragon'], [0xff9ad0, 1.1, -0.9, 'puff'], [0x8a6ad8, 0.2, 1.2, 'owl']].forEach(([c, x, z, kind], i) => {
      const cr = new T.Group(); cr.position.set(x, 0, z);
      const body = new T.Mesh(new T.SphereGeometry(0.55, 14, 12), M(c)); body.position.y = 0.55; body.scale.set(1, 0.9, 1.1); cr.add(body);
      [-1, 1].forEach((s) => { const e = new T.Mesh(new T.SphereGeometry(0.13, 8, 8), M(0xffffff)); e.position.set(s * 0.2, 0.75, 0.44); cr.add(e); const pu = new T.Mesh(new T.SphereGeometry(0.065, 8, 6), M(0x15101a)); pu.position.set(s * 0.2, 0.76, 0.55); cr.add(pu); });
      if (kind === 'dragon') { [-1, 1].forEach((s) => { const w = new T.Mesh(new T.ConeGeometry(0.3, 0.7, 4), M(0x2f8f3a)); w.position.set(s * 0.6, 0.85, -0.1); w.rotation.z = s * -1.1; cr.add(w); }); for (let k = 0; k < 3; k++) { const sp = new T.Mesh(new T.ConeGeometry(0.1, 0.26, 5), M(0xffd23f)); sp.position.set(0, 1.08 - k * 0.07, 0.1 - k * 0.3); cr.add(sp); } }
      if (kind === 'puff') { const tuft = new T.Mesh(new T.SphereGeometry(0.2, 8, 6), M(0xffc4e6)); tuft.position.set(0, 1.1, 0); cr.add(tuft); }
      if (kind === 'owl') { [-1, 1].forEach((s) => { const ear = new T.Mesh(new T.ConeGeometry(0.11, 0.3, 5), M(c)); ear.position.set(s * 0.28, 1.1, 0.05); cr.add(ear); }); const bk = new T.Mesh(new T.ConeGeometry(0.08, 0.2, 5), M(0xffb020)); bk.position.set(0, 0.62, 0.58); bk.rotation.x = Math.PI / 2; cr.add(bk); }
      pen.add(cr); critters.push({ cr, ph: i * 2.1, x, z });
    });
    const sign = new T.Sprite(new T.SpriteMaterial({ map: HP.canvasTex(128, (c, s) => { c.clearRect(0, 0, s, s); c.fillStyle = 'rgba(40,25,90,.9)'; c.beginPath(); c.arc(64, 64, 58, 0, 7); c.fill(); c.strokeStyle = '#ffd76a'; c.lineWidth = 8; c.stroke(); c.font = '70px serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('🐉', 64, 68); }), transparent: true, depthWrite: false }));
    sign.scale.setScalar(2.2); sign.position.y = 4.2; pen.add(sign);
    g.scene.add(pen);
    g.hooks.push((dt, t, world) => {
      if (world !== 'outside') return;
      const p = g.player.position, near = Math.hypot(p.x - CX, p.z - CZ) < 14;
      for (const c of critters) {
        const k = Math.max(0, Math.sin(t * (near ? 5 : 2.2) + c.ph));
        c.cr.position.y = k * (near ? 0.55 : 0.2); c.cr.rotation.y = near ? Math.atan2(p.x - (CX + c.x), p.z - (CZ + c.z)) : Math.sin(t * 0.5 + c.ph);
      }
      sign.position.y = 4.2 + Math.sin(t * 2) * 0.2;
    });
    HPL.paddock = { x: CX, z: CZ };
  })();
})();
