/* Herbology with Professor Sprout — raise magical plants from seed, properly hands-on.
 * Every plant is grown in THREE different steps, each a different skill:
 *   1. SEEDS  (mental maths)  the pot asks for a number; pick the seed packets that ADD UP to
 *                             it — two packets, later three, with tempting near-misses.
 *   2. WATER  (timing)        a drop slides back and forth over the gauge; tap 💧 exactly when
 *                             it is over the green zone. The zone shrinks and the drop speeds
 *                             up as you get good; the zone moves after every hit.
 *   3. BUGS   (aim + self-control) pests pop up on the leaves — squash them fast, but leave
 *                             the friendly bees and ladybirds alone!
 * The plant visibly grows after each step (🫘 → 🌱 → 🌿 → bloom). 3–5 plants per lesson by
 * level; everything scales with host.lvl() (rises on a streak, eases on a slip). Slips are
 * gentle, but too many → host.fail() (retry), never a pity win.
 * Test hook: HPL._herbStep() → { kind:'seeds'|'water'|'bugs', … } describing what to tap. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});

  HPL.games.herbology = function (host) {
    const el = HPL.el, L = host.level;
    const PLANTS = 3 + (L >= 4 ? 1 : 0) + (L >= 7 ? 1 : 0);
    const BLOOMS = ['🌻', '🌷', '🌵', '🍄', '🌺'];
    const STEPS = PLANTS * 3;
    let plant = 0, step = 0, misses = 0, done = false, raf = 0;
    const maxMiss = STEPS + 3;
    const sfx = (n, a) => { try { window.HPFun && HPFun.sfx[n] && HPFun.sfx[n](a); } catch (e) {} };

    // ---- layout: the growing plant on top, the current step's play area below ----
    const top = el('div', { style: 'display:flex;align-items:flex-end;justify-content:center;gap:14px;min-height:96px' });
    const grow = el('div', { style: 'font-size:76px;line-height:1;transition:transform .4s cubic-bezier(.3,1.7,.5,1)' }, '🫘');
    const pot = el('div', { style: 'font-size:30px;font-weight:bold;color:#fff;background:#8a5a2e;border:3px solid #ffd76a;border-radius:10px 10px 18px 18px;padding:4px 16px;min-width:70px;text-align:center', dir: 'ltr' }, '');
    const steps = el('div', { style: 'display:flex;gap:6px;font-size:26px' });
    const icons = ['🔢', '💧', '🐛'].map((e) => { const s = el('span', { style: 'opacity:.35;transition:all .2s' }, e); steps.appendChild(s); return s; });
    top.appendChild(steps); top.appendChild(grow); top.appendChild(pot);
    const area = el('div', { style: 'width:100%;display:flex;flex-direction:column;align-items:center;gap:12px;min-height:210px;justify-content:center' });
    host.stage.appendChild(top); host.stage.appendChild(area);
    HPL._herbStep = () => null;
    HPL._herbAnswer = () => null;      // legacy hook (old single-question lesson) — kept harmless

    function miss(msg) {
      misses++; host.bad(); host.hit(false); host.say(msg || 'כמעט! 🌱');
      if (misses > maxMiss && !done) { done = true; stop(); host.after(500, () => host.fail('אופס, הצמחים קצת התבלבלו — ננסה שוב! 🌿')); return true; }
      return false;
    }
    function stop() { cancelAnimationFrame(raf); raf = 0; HPL._herbStep = () => null; }
    function mark(i) { icons.forEach((s, k) => { s.style.opacity = k < i ? '1' : k === i ? '1' : '.35'; s.style.transform = k === i ? 'scale(1.35)' : 'scale(1)'; s.style.filter = k < i ? 'grayscale(0)' : ''; }); }
    function grew(emoji) {
      grow.textContent = emoji; grow.style.transform = 'scale(1.35)'; host.after(260, () => (grow.style.transform = 'scale(1)'));
      const r = grow.getBoundingClientRect(), pr = host.stage.getBoundingClientRect();
      host.good(r.left - pr.left + r.width / 2, r.top - pr.top + 20);
    }
    function next() {
      step++; host.setProgress(plant * 3 + step, STEPS);
      if (step >= 3) { plant++; step = 0; if (plant >= PLANTS) return finish(); return host.after(900, begin); }
      host.after(650, begin);
    }
    function begin() {
      if (done) return;
      stop(); area.innerHTML = ''; mark(step);
      if (step === 0) { grow.textContent = '🫘'; seeds(); } else if (step === 1) water(); else bugs();
    }

    // ================= 1. SEEDS — pick the packets that add up =================
    function seeds() {
      const lv = host.lvl();
      const need = lv >= 5 && plant >= 1 ? 3 : 2;                    // three packets once you're good
      const hi = Math.min(9 + lv * 3, 40);
      // build the answer first, then decoys that never accidentally form another valid set
      let parts, target, guard = 0, packs;
      do {
        parts = []; for (let k = 0; k < need; k++) parts.push(host.rnd(lv >= 3 ? 2 : 1, Math.max(4, Math.floor(hi / need))));
        target = parts.reduce((a, b) => a + b, 0);
        packs = parts.slice();
        const total = need === 3 ? 6 : (lv >= 4 ? 6 : 5); let g2 = 0;
        while (packs.length < total && g2++ < 80) {
          const c = host.rnd(1, Math.max(6, Math.floor(hi / need) + 3));
          if (packs.includes(c)) continue;
          const t = packs.concat([c]);
          if (countSets(t, need, target) === 1) packs.push(c);
        }
      } while ((packs.length < 5 || new Set(parts).size < need || countSets(packs, need, target) !== 1) && guard++ < 60);
      packs.sort(() => Math.random() - 0.5);
      pot.textContent = String(target);
      host.say(need === 3 ? 'שלוש שקיות שביחד נותנות ' + target + '!' : 'אילו שתי שקיות ביחד נותנות ' + target + '?');
      const sum = el('div', { style: 'font-size:30px;font-weight:bold;color:#ffe9a8;min-height:38px', dir: 'ltr' }, '? + ?' + (need === 3 ? ' + ?' : '') + ' = ' + target);
      const row = el('div', { class: 'lsnRow', style: 'max-width:520px' });
      const picked = [];
      const btns = packs.map((n) => {
        const b = el('button', { class: 'lsnBtn', style: 'min-width:78px;min-height:92px;flex-direction:column;font-size:34px;line-height:1;background:linear-gradient(#f4e6c0,#d8b878)', dir: 'ltr' },
          el('span', { style: 'font-size:22px' }, '🌰'), el('span', {}, String(n)));
        b.dataset.n = n;
        b.addEventListener('click', () => {
          const i = picked.indexOf(b);
          if (i >= 0) { picked.splice(i, 1); b.style.outline = ''; b.style.transform = ''; }
          else { if (picked.length >= need) return; picked.push(b); b.style.outline = '5px solid #9effa0'; b.style.transform = 'translateY(-8px)'; sfx('tink', picked.length); }
          const vals = picked.map((x) => +x.dataset.n);
          sum.textContent = vals.concat(Array(need - vals.length).fill('?')).join(' + ') + ' = ' + (vals.length === need ? vals.reduce((a, c) => a + c, 0) : target);
          if (picked.length === need) {
            row.style.pointerEvents = 'none';
            if (vals.reduce((a, c) => a + c, 0) === target) { host.hit(true); sum.style.color = '#9effa0'; grew('🌱'); host.say('נזרע! 🌱'); next(); }
            else host.after(450, () => { if (miss('לא יוצא ' + target + ' — נסו שוב')) return; picked.splice(0).forEach((x) => { x.style.outline = ''; x.style.transform = ''; }); sum.textContent = '? + ?' + (need === 3 ? ' + ?' : '') + ' = ' + target; row.style.pointerEvents = 'auto'; });
          }
        });
        row.appendChild(b); return b;
      });
      area.appendChild(sum); area.appendChild(row);
      HPL._herbStep = () => ({ kind: 'seeds', els: btns.filter((b) => parts.includes(+b.dataset.n) && !picked.includes(b)), wrong: picked.filter((b) => !parts.includes(+b.dataset.n)) });
    }
    function countSets(arr, need, target) {
      let c = 0; const n = arr.length;
      for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) {
        if (need === 2) { if (arr[a] + arr[b] === target) c++; }
        else for (let d = b + 1; d < n; d++) if (arr[a] + arr[b] + arr[d] === target) c++;
      }
      return c;
    }

    // ================= 2. WATER — tap when the drop is over the green zone =================
    function water() {
      const lv = host.lvl();
      const NEED = lv >= 5 ? 4 : 3, W = 300;
      const zoneW = Math.max(0.13, 0.3 - lv * 0.022);                // fraction of the gauge
      const period = Math.max(1050, 2300 - lv * 150);               // ms for one full sweep
      let got = 0, zone = 0.5, t0 = performance.now(), x = 0, locked = false;
      pot.textContent = '💧×' + NEED;
      host.say('השקו בדיוק כשהטיפה מעל הירוק!');
      const bar = el('div', { style: 'position:relative;width:' + W + 'px;max-width:86%;height:34px;border-radius:18px;background:rgba(255,255,255,.14);border:3px solid #ffd76a;overflow:hidden' });
      const z = el('div', { style: 'position:absolute;top:0;bottom:0;background:linear-gradient(#9effa0,#3fbf6a);border-radius:10px;transition:left .25s' });
      const drop = el('div', { style: 'position:absolute;top:-4px;font-size:34px;line-height:1;margin-left:-17px;will-change:left' }, '💧');
      bar.appendChild(z); bar.appendChild(drop);
      const tally = el('div', { style: 'font-size:30px;letter-spacing:4px;min-height:36px' }, '◌'.repeat(NEED));
      const btn = el('button', { class: 'lsnBtn', style: 'min-width:130px;min-height:100px;font-size:56px;background:linear-gradient(#bfe8ff,#4da6e8)' }, '🚿');
      area.appendChild(bar); area.appendChild(tally); area.appendChild(btn);
      function place() { zone = zoneW / 2 + 0.04 + Math.random() * (1 - zoneW - 0.08); z.style.left = ((zone - zoneW / 2) * 100) + '%'; z.style.width = (zoneW * 100) + '%'; }
      place();
      const inZone = () => Math.abs(x - zone) <= zoneW / 2;
      (function loop(now) {
        if (done || step !== 1) return;
        const k = ((now - t0) % period) / period;                   // 0..1 → ping-pong, eased at the ends
        x = 0.5 - 0.5 * Math.cos(k * Math.PI * 2);
        drop.style.left = (x * 100) + '%';
        raf = requestAnimationFrame(loop);
      })(t0);
      btn.addEventListener('click', () => {
        if (locked) return;
        if (inZone()) {
          got++; sfx('tink', got); host.hit(true);
          tally.textContent = '💧'.repeat(got) + '◌'.repeat(NEED - got);
          btn.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.15)' }, { transform: 'scale(1)' }], 220);
          if (got >= NEED) { locked = true; stop(); grew('🌿'); host.say('שתה יפה! 🌿'); next(); }
          else place();
        } else {
          locked = true; bar.animate([{ transform: 'translateX(-8px)' }, { transform: 'translateX(8px)' }, { transform: 'translateX(0)' }], 260);
          if (!miss(x < zone ? 'מוקדם מדי! חכו לירוק' : 'מאוחר מדי! חכו לירוק')) host.after(420, () => (locked = false));
        }
      });
      HPL._herbStep = () => ({ kind: 'water', inZone: !locked && inZone(), btn });
    }

    // ================= 3. BUGS — squash the pests, spare the friends =================
    function bugs() {
      const lv = host.lvl();
      const NEED = Math.min(8, 4 + Math.floor(lv / 2));
      const life = Math.max(850, 1900 - lv * 130), gap = Math.max(380, 900 - lv * 60);
      const PEST = ['🐛', '🐌', '🪲'], PAL = ['🐝', '🐞', '🦋'];
      let got = 0, alive = true;
      pot.textContent = '🐛×' + NEED;
      host.say('מעכו את המזיקים — אבל לא את החברים! 🐝');
      const box = el('div', { style: 'position:relative;width:340px;max-width:92%;height:190px;border-radius:20px;border:3px solid #ffd76a;background:radial-gradient(ellipse at 50% 100%,#2f6b39,#173a22);overflow:hidden' });
      const leafs = el('div', { style: 'position:absolute;inset:0;font-size:120px;opacity:.28;display:flex;align-items:flex-end;justify-content:center;pointer-events:none' }, '🌿');
      box.appendChild(leafs); area.appendChild(box);
      const tally = el('div', { style: 'font-size:26px;letter-spacing:3px;min-height:32px' }, '◌'.repeat(NEED)); area.appendChild(tally);
      const live = new Set();
      function spawn() {
        if (!alive || done) return;
        const friend = live.size > 0 && Math.random() < (lv >= 3 ? 0.36 : 0.25);
        const b = el('button', { style: 'position:absolute;width:70px;height:70px;margin:-35px 0 0 -35px;border-radius:50%;border:0;background:rgba(255,255,255,.12);font-size:46px;line-height:1;padding:0;cursor:pointer;touch-action:manipulation;transform:scale(0);transition:transform .16s cubic-bezier(.3,1.7,.5,1)' }, (friend ? PAL : PEST)[host.rnd(0, 2)]);
        b.dataset.pest = friend ? '' : '1';
        b.style.left = (14 + Math.random() * 72) + '%'; b.style.top = (22 + Math.random() * 58) + '%';
        box.appendChild(b); live.add(b);
        requestAnimationFrame(() => (b.style.transform = 'scale(1)'));
        const gone = () => { if (!live.has(b)) return; live.delete(b); b.style.transform = 'scale(0)'; host.after(170, () => b.remove()); };
        host.after(life * (friend ? 1.25 : 1), gone);
        b.addEventListener('click', () => {
          if (!live.has(b) || !alive) return;
          if (friend) { b.animate([{ transform: 'rotate(-20deg)' }, { transform: 'rotate(20deg)' }, { transform: 'rotate(0)' }], 300); sfx('squeak'); miss('אוי! זה חבר של הצמח 🐝'); return; }
          live.delete(b); got++; host.hit(true); sfx('boing');
          b.textContent = '💥'; b.style.pointerEvents = 'none'; host.after(220, () => b.remove());
          tally.textContent = '✅'.repeat(got) + '◌'.repeat(NEED - got);
          if (got >= NEED) { alive = false; HPL._herbStep = () => null; live.forEach((x) => x.remove()); live.clear(); grew(BLOOMS[plant % BLOOMS.length]); host.say('איזה צמח יפה! ' + BLOOMS[plant % BLOOMS.length]); next(); }
        });
        host.after(gap * (0.7 + Math.random() * 0.6), spawn);
      }
      spawn(); host.after(gap * 0.5, spawn);
      HPL._herbStep = () => ({ kind: 'bugs', els: [...live].filter((b) => b.dataset.pest === '1') });
    }

    function finish() {
      done = true; stop(); area.innerHTML = '';
      const garden = el('div', { style: 'font-size:64px;letter-spacing:6px' }, BLOOMS.slice(0, PLANTS).join(''));
      area.appendChild(garden);
      host.confetti(); host.say('החממה פורחת! 🌿');
      const stars = misses <= 2 ? 3 : misses <= 5 ? 2 : 1;
      host.after(900, () => host.win(stars));
    }

    host.setProgress(0, STEPS);
    begin();
  };
})();
