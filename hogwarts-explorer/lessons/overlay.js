/* The lesson overlay: a full-screen glass-and-gold panel with the professor's chibi
 * portrait + speech bubble, a play-area the minigame fills, a row of progress pips and
 * a reward screen with stars + a sticker. Minigames stay tiny by talking only to the
 * `host` object this hands them. Touch-first, big targets, minimal Hebrew text. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  HPL.games = HPL.games || {};
  let css = false;

  function injectCss() {
    if (css) return; css = true;
    const s = document.createElement('style');
    s.textContent = `
    #lsnOv{position:fixed;inset:0;z-index:50;display:none;align-items:center;justify-content:center;
      background:radial-gradient(ellipse at center,rgba(30,20,80,.6),rgba(5,3,25,.92));
      font-family:'Rubik','Arial Hebrew',sans-serif;touch-action:none}
    #lsnOv.on{display:flex}
    .lsnPanel{position:relative;width:min(94vw,780px);max-height:92vh;overflow:hidden;background:rgba(32,20,70,.96);
      border:5px solid #ffd76a;border-radius:28px;padding:16px 18px 20px;box-shadow:0 14px 50px rgba(0,0,0,.6);display:flex;flex-direction:column;gap:10px}
    .lsnHead{display:flex;align-items:center;gap:14px}
    .lsnAvWrap{position:relative;flex:0 0 auto}
    .lsnAv{width:92px;height:92px;border-radius:50%;border:4px solid #ffd76a;background:rgba(10,6,30,.5);display:block}
    .lsnPaw{position:absolute;bottom:-4px;inset-inline-end:-4px;width:30px;height:30px;border-radius:50%;background:#2a1540;border:2px solid #ffd76a;
      display:none;align-items:center;justify-content:center;font-size:17px;pointer-events:none;animation:lsnPawB 1.1s infinite}
    .lsnPaw.on{display:flex}
    @keyframes lsnPawB{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}
    .lsnName{color:#ffd76a;font-size:30px;font-weight:bold;text-shadow:0 2px 0 #7a3b00}
    .lsnSay{flex:1;min-height:56px;background:rgba(255,245,220,.95);color:#2a1a12;border-radius:18px;
      padding:10px 16px;font-size:26px;font-weight:bold;line-height:1.25;position:relative}
    .lsnSay::after{content:'';position:absolute;right:-16px;top:24px;border:10px solid transparent;border-left-color:rgba(255,245,220,.95)}
    .lsnPips{display:flex;gap:8px;justify-content:center}
    .lsnPip{width:20px;height:20px;border-radius:50%;background:rgba(255,255,255,.2);border:2px solid #ffd76a}
    .lsnPip.on{background:#ffd76a;box-shadow:0 0 10px #ffd76a}
    .lsnStage{flex:1;min-height:200px;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;position:relative}
    .lsnClose{position:absolute;top:-6px;inset-inline-end:-6px;width:44px;height:44px;border-radius:50%;border:3px solid #ffd76a;
      background:#3a2060;color:#fff;font-size:22px;cursor:pointer;z-index:3}
    .lsnBtn{min-width:86px;min-height:86px;padding:8px 20px;border-radius:22px;border:4px solid #fff;
      background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:42px;font-weight:bold;cursor:pointer;
      box-shadow:0 5px 0 #b9842f;display:flex;align-items:center;justify-content:center;font-family:inherit;touch-action:manipulation}
    .lsnBtn:active{transform:translateY(4px);box-shadow:0 1px 0 #b9842f}
    .lsnBtn.wide{min-height:70px;font-size:32px;border-radius:40px}
    .lsnRow{display:flex;gap:14px;flex-wrap:wrap;justify-content:center;align-items:center}
    .lsnSpark{position:absolute;font-size:34px;pointer-events:none;animation:lsnFloat .9s ease-out forwards}
    @keyframes lsnFloat{0%{transform:translate(-50%,-50%) scale(.4);opacity:1}100%{transform:translate(-50%,-160%) scale(1.3);opacity:0}}
    .lsnShake{animation:lsnShake .4s}
    @keyframes lsnShake{0%,100%{transform:translateX(0)}25%{transform:translateX(-10px)}75%{transform:translateX(10px)}}
    .lsnStars{font-size:64px;letter-spacing:6px}
    .lsnReward{display:flex;flex-direction:column;align-items:center;gap:12px;text-align:center;color:#fff}
    .lsnReward .big{font-size:44px;color:#ffd76a;font-weight:bold;text-shadow:0 3px 0 #7a3b00}
    .lsnSticker{font-size:90px;filter:drop-shadow(0 0 20px #ffd76a);animation:lsnPop .5s}
    @keyframes lsnPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}`;
    document.head.appendChild(s);
  }

  let ov, panel, avCanvas, pawEl, nameEl, sayEl, pipsEl, stageEl;
  function build() {
    injectCss();
    ov = document.createElement('div'); ov.id = 'lsnOv';
    panel = document.createElement('div'); panel.className = 'lsnPanel';
    panel.innerHTML = '<button class="lsnClose" aria-label="סגור">✕</button>'
      + '<div class="lsnHead"><div class="lsnAvWrap"><canvas class="lsnAv" width="128" height="128"></canvas><div class="lsnPaw">🐾</div></div>'
      + '<div style="flex:1"><div class="lsnName"></div><div class="lsnSay"></div></div></div>'
      + '<div class="lsnPips"></div><div class="lsnStage"></div>';
    ov.appendChild(panel); document.body.appendChild(ov);
    avCanvas = panel.querySelector('.lsnAv'); pawEl = panel.querySelector('.lsnPaw'); nameEl = panel.querySelector('.lsnName');
    sayEl = panel.querySelector('.lsnSay'); pipsEl = panel.querySelector('.lsnPips'); stageEl = panel.querySelector('.lsnStage');
    panel.querySelector('.lsnClose').addEventListener('click', () => quit());
    avCanvas.style.cursor = 'pointer'; avCanvas.title = 'נגעו בי!';
    avCanvas.addEventListener('click', () => toggleCat());
  }

  let raf = null, timers = [], curClose = null, mood = 0, moodT = 0;
  let avWho = 'defence', catForm = false, canCat = false;
  // McGonagall's cat-form touch: tap her portrait to flip between witch ⇄ tabby, with a
  // little spin-pop and a playful meow. Only the Transfiguration teacher (mcgon) can morph.
  function toggleCat() {
    if (!canCat) { moodT = 0.6; mood = 1; try { HP.sfx.soft(); } catch (e) {} return; }
    catForm = !catForm; avWho = catForm ? 'cat' : 'mcgon';
    avFlip = 1; moodT = 0.9; mood = 1;
    try { catForm ? (HP.sfx.sparkle && HP.sfx.sparkle(), HP.sfx.hoot && HP.sfx.hoot()) : HP.sfx.pop && HP.sfx.pop(); } catch (e) {}
    if (sayEl) { const prev = sayEl.textContent; sayEl.textContent = catForm ? 'מִיָאוּ! 🐱' : 'שוב פרופסור! 🪄'; moodT = 1; clearTimeout(toggleCat._t); toggleCat._t = setTimeout(() => { if (sayEl) sayEl.textContent = prev; }, 1200); }
  }
  let avFlip = 0;
  function animAvatar(who) {
    const ctx = avCanvas.getContext('2d');
    cancelAnimationFrame(raf);
    avWho = who; catForm = false; canCat = (who === 'mcgon'); avFlip = 0;
    if (pawEl) pawEl.classList.toggle('on', canCat);
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (moodT > 0) { moodT -= dt; mood = Math.abs(Math.sin(now / 90)) * (moodT > 0 ? 1 : 0); } else mood *= 0.9;
      // quick spin-pop on a form flip
      if (avFlip > 0) { avFlip = Math.max(0, avFlip - dt * 2.2); const k = 1 + Math.sin(avFlip * Math.PI) * 0.35; ctx.clearRect(0, 0, 128, 128); ctx.save(); ctx.translate(64, 64); ctx.rotate((1 - avFlip) * Math.PI * 2); ctx.scale(k, k); ctx.translate(-64, -64); HPL.teacherAvatar(ctx, avWho, 128, mood); ctx.restore(); }
      else HPL.teacherAvatar(ctx, avWho, 128, mood);
      raf = requestAnimationFrame(loop);
    })(last);
  }

  function clearTimers() { timers.forEach(clearTimeout); timers = []; }
  function quit() { teardown(); if (curDone) curDone(0, true); }
  let curDone = null;
  function teardown() {
    clearTimers(); cancelAnimationFrame(raf); raf = null;
    ov.classList.remove('on'); stageEl.innerHTML = '';
    try { window.__game && __game.setModal && __game.setModal(false); } catch (e) {}
  }

  // open a lesson: def={key,subject,teacher,color,greet}; onComplete(stars, quit)
  let curDef = null;
  function open(def, onComplete) {
    if (!ov) build();
    curDone = onComplete; curDef = def; stageEl.innerHTML = ''; sayEl.textContent = def.greet || 'שלום!';
    nameEl.textContent = def.subject; panel.style.borderColor = def.color || '#ffd76a';
    ov.classList.add('on'); animAvatar(def.teacher);
    try { HP.sfx.flip(); } catch (e) {}
    try { window.__game && __game.setModal && __game.setModal(true); } catch (e) {}
    const host = makeHost(def);
    host.say(def.greet || 'שלום!');
    runGame(def, host, 650);
  }
  function runGame(def, host, delay) {
    clearTimers(); stageEl.innerHTML = ''; pipsEl.innerHTML = '';
    timers.push(setTimeout(() => { try { (HPL.games[def.key] || missing)(host); } catch (e) { console.warn('[lesson]', e); } }, delay || 400));
  }
  function missing(host) { host.say('השיעור בקרוב!'); host.after(1200, () => host.win(1)); }

  // gentle retry screen — a failed attempt never auto-awards; the child chooses to try again
  function failScreen(def, host, msg) {
    clearTimers(); pipsEl.innerHTML = ''; stageEl.innerHTML = '';
    sayEl.textContent = msg || 'כמעט! ננסה שוב?'; moodT = 0.6; mood = 1;
    try { HP.sfx.soft && HP.sfx.soft(); } catch (e) {}
    const box = el('div', { class: 'lsnReward' },
      el('div', { style: 'font-size:72px' }, '💪'),
      el('div', { class: 'big' }, 'כמעט! ננסה שוב'),
      el('button', { class: 'lsnBtn wide', onclick: () => runGame(def, host, 250) }, '🔁 עוד פעם'),
      el('button', { class: 'lsnBtn wide', style: 'font-size:24px;background:linear-gradient(#cdbfe8,#9a86c8)', onclick: () => { teardown(); if (curDone) curDone(0, true); } }, 'אחר כך'));
    stageEl.appendChild(box);
  }

  // a wordless "ooh, harder now!" cue when the child is on a roll (minimal text)
  function levelUp() {
    try { HP.sfx.sparkle && HP.sfx.sparkle(); } catch (e) {}
    moodT = 0.8; mood = 1;
    spark(panel.clientWidth / 2, 52, ['⬆️', '🔥', '✨', '💪']);
  }

  function makeHost(def) {
    const base = (HPL.progress && HPL.progress.level(def.key)) || 1;
    const day = (window.HPSchedule && HPSchedule.state) ? HPSchedule.state().day : 0;
    const level = Math.min(8, base + Math.floor(day / 2));   // mastery + ramps across the week
    // in-session dynamic difficulty: climbs as the child succeeds, eases after misses, so a
    // confident child gets harder questions and a struggling one gets a break — never a dead end.
    let streak = 0, dyn = 0;
    const host = {
      stage: stageEl, subject: def.subject, color: def.color, teacher: def.teacher, key: def.key, level, day,
      // record an answer: two in a row right → one notch harder (capped); any miss → one notch
      // easier (floored). Lessons fold host.lvl()/host.dyn() into their per-round difficulty.
      hit(ok) {
        if (ok) { streak++; if (streak >= 2 && dyn < 3) { dyn++; streak = 0; levelUp(); } }
        else { streak = 0; if (dyn > -2) dyn--; }
        return dyn;
      },
      dyn() { return dyn; },
      lvl() { return Math.max(1, Math.min(9, level + dyn)); },   // effective difficulty right now
      say(t, m) { sayEl.textContent = t; moodT = Math.max(0.3, (t || '').length * 0.045); mood = 1; },
      setProgress(cur, total) {
        pipsEl.innerHTML = '';
        for (let i = 0; i < total; i++) { const p = document.createElement('div'); p.className = 'lsnPip' + (i < cur ? ' on' : ''); pipsEl.appendChild(p); }
      },
      good(x, y) { try { HP.sfx.chime(); HP.sfx.sparkle(); } catch (e) {} spark(x, y, ['✨', '⭐', '🌟', '💫']); },
      bad() { try { HP.sfx.soft(); } catch (e) {} panel.classList.remove('lsnShake'); void panel.offsetWidth; panel.classList.add('lsnShake'); },
      confetti() { for (let i = 0; i < 18; i++) spark(10 + Math.random() * (panel.clientWidth - 20), 40 + Math.random() * (panel.clientHeight - 80), ['✨', '⭐', '🎉', '🌟', '💛']); },
      after(ms, fn) { const id = setTimeout(fn, ms); timers.push(id); return id; },
      rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
      el,
      win(stars) { reward(def, Math.max(1, Math.min(3, stars || 1))); },
      fail(msg) { failScreen(def, host, msg); },      // too many misses → gentle retry, no pity-win
      // a shrinking timer bar for timed-bonus rounds; returns { stop, left() }
      timer(ms, onEnd) {
        const bar = el('div', { style: 'width:70%;max-width:320px;height:14px;border-radius:8px;background:rgba(255,255,255,.15);border:2px solid #ffd76a;overflow:hidden' });
        const fill = el('div', { style: 'height:100%;width:100%;background:linear-gradient(90deg,#9effa0,#ffe48a,#ff8a5a);transition:width .2s linear' });
        bar.appendChild(fill); stageEl.appendChild(bar);
        const t0 = performance.now(); let stopped = false;
        const tick = () => { if (stopped) return; const k = Math.max(0, 1 - (performance.now() - t0) / ms); fill.style.width = (k * 100) + '%';
          if (k <= 0) { stopped = true; bar.remove(); onEnd && onEnd(); } else requestAnimationFrame(tick); };
        requestAnimationFrame(tick);
        return { stop() { stopped = true; bar.remove(); }, left() { return Math.max(0, ms - (performance.now() - t0)); } };
      },
    };
    HPL._host = host;   // test hook: current lesson's host (drive/finish from Playwright)
    return host;
  }

  function spark(x, y, set) {
    const r = panel.getBoundingClientRect();
    const sp = document.createElement('div'); sp.className = 'lsnSpark'; sp.textContent = set[Math.floor(Math.random() * set.length)];
    sp.style.left = (x != null ? x : panel.clientWidth / 2) + 'px'; sp.style.top = (y != null ? y : panel.clientHeight / 2) + 'px';
    panel.appendChild(sp); setTimeout(() => sp.remove(), 950);
  }

  function reward(def, stars) {
    clearTimers(); pipsEl.innerHTML = ''; stageEl.innerHTML = '';
    // attend() records the finish, bumps mastery + stars and books house points on the board
    const pts = (HPL.progress && HPL.progress.attend) ? HPL.progress.attend(def.key, stars) : 0;
    const sticker = def.sticker || def.icon || '⭐';
    sayEl.textContent = 'כל הכבוד! 🎉'; moodT = 1.2; mood = 1;
    const box = el('div', { class: 'lsnReward' },
      el('div', { class: 'lsnStars' }, '⭐'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('div', { class: 'lsnSticker' }, sticker),
      el('div', { class: 'big' }, 'מדבקה חדשה!'),
      el('div', { style: 'font-size:24px;color:#9effa0;font-weight:bold' }, '🏆 +' + pts + ' נקודות בית'),
      el('button', { class: 'lsnBtn wide', onclick: () => { teardown(); if (curDone) curDone(stars, false); } }, 'המשך ✨'));
    stageEl.appendChild(box);
    try { HP.sfx.fanfare(); HP.cheer && HP.cheer(); } catch (e) {}
    for (let i = 0; i < 20; i++) setTimeout(() => spark(10 + Math.random() * (panel.clientWidth - 20), 40 + Math.random() * 160, ['✨', '⭐', '🎉', '🌟']), i * 70);
  }

  function el(tag, props, ...kids) {
    const n = document.createElement(tag);
    for (const k in (props || {})) { if (k === 'class') n.className = props[k]; else if (k.slice(0, 2) === 'on') n.addEventListener(k.slice(2), props[k]); else if (k === 'style') n.style.cssText = props[k]; else n.setAttribute(k, props[k]); }
    kids.flat().forEach((c) => n.appendChild(typeof c === 'string' ? document.createTextNode(c) : c));
    return n;
  }

  HPL.overlay = { open };
  HPL.el = el;
})();
