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
    .lsnClose{position:absolute;top:8px;inset-inline-end:8px;width:54px;height:54px;border-radius:50%;border:3px solid #ffd76a;
      background:#3a2060;color:#fff;font-size:24px;cursor:pointer;z-index:4;padding:0;touch-action:manipulation}
    /* the ✕ sits fully INSIDE the panel (it used to straddle the rounded, clipped corner, where a
       small finger could land on the panel instead) and the header keeps clear of it */
    .lsnHead{padding-inline-end:58px}
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
    .lsnCombo{position:absolute;top:66px;inset-inline-end:8px;background:linear-gradient(#ff9a3c,#e8352e);color:#fff;font-weight:bold;font-size:22px;
      border:3px solid #ffd76a;border-radius:20px;padding:2px 12px;transform:scale(0);transition:transform .25s cubic-bezier(.3,1.8,.5,1);z-index:3;direction:ltr}
    .lsnCombo.on{transform:scale(1)} .lsnCombo.bump{animation:lsnPawB .3s}
    .lsnReact{position:absolute;top:-10px;inset-inline-start:-10px;font-size:40px;pointer-events:none;opacity:0;transform:scale(.3)}
    .lsnReact.on{animation:lsnReact 1.3s ease-out}
    @keyframes lsnReact{0%{opacity:0;transform:scale(.3) rotate(-20deg)}18%{opacity:1;transform:scale(1.25) rotate(8deg)}70%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.8) translateY(-14px)}}
    .lsnRank{display:flex;align-items:center;gap:10px;font-size:22px;color:#ffe9a8;font-weight:bold}
    .lsnRank .bar{width:150px;height:14px;border-radius:8px;background:rgba(255,255,255,.15);border:2px solid #ffd76a;overflow:hidden;direction:ltr}
    .lsnRank .bar i{display:block;height:100%;background:linear-gradient(90deg,#9effa0,#ffe48a);transition:width .9s ease-out}
    .lsnUp{font-size:26px;color:#9effa0;font-weight:bold;animation:lsnPop .5s}
    .lsnReward{gap:8px !important}
    .lsnSticker{font-size:90px;filter:drop-shadow(0 0 20px #ffd76a);animation:lsnPop .5s}
    @keyframes lsnPop{0%{transform:scale(0)}60%{transform:scale(1.3)}100%{transform:scale(1)}}`;
    document.head.appendChild(s);
  }

  let ov, panel, avCanvas, pawEl, nameEl, sayEl, pipsEl, stageEl, comboEl, reactEl;
  // each professor reacts in character: [happy faces, praise lines, oops faces]
  const PERSONA = {
    snape:    { yay: ['😏', '🧐'], praise: ['...לֹא רַע.', 'מַפְתִּיעַ. הַמְשֵׁךְ.', 'אֲפִלּוּ אֲנִי מִתְרַשֵּׁם.'], oops: ['🙄', '😒'] },
    flitwick: { yay: ['🤩', '🥳'], praise: ['נִפְלָא! נִפְלָא!', 'אֵיזֶה סְוִישׁ!', 'מֻשְׁלָם לְגַמְרֵי!'], oops: ['😅', '🙈'] },
    sprout:   { yay: ['🥰', '🌻'], praise: ['אֶצְבַּע יְרֻקָּה!', 'הַצְּמָחִים אוֹהֲבִים אוֹתְךָ!', 'פּוֹרֵחַ!'], oops: ['🤗', '🌱'] },
    defence:  { yay: ['💪', '⚡'], praise: ['אֵיזֶה שַׁרְבִיט!', 'מְהִירוּת בָּזָק!', 'גִּבּוֹר אֲמִתִּי!'], oops: ['😬', '🛡️'] },
    mcgon:    { yay: ['😌', '🐱'], praise: ['עֲבוֹדָה מְדֻיֶּקֶת.', 'חָמֵשׁ נְקֻדּוֹת לְבֵיתְךָ!', 'מְצֻיָּן. בֶּאֱמֶת.'], oops: ['🤨', '😼'] },
    sinistra: { yay: ['🌟', '😍'], praise: ['כּוֹכָב עוֹלֶה!', 'הַשָּׁמַיִם גֵּאִים בְּךָ!', 'זוֹהֵר!'], oops: ['🌥️', '😯'] },
    hagrid:   { yay: ['🤗', '😄'], praise: ['וָואוּ! אַלּוּף!', 'הֵם מֵתִים עָלֶיךָ!', 'יוֹפִי שֶׁל עֲבוֹדָה!'], oops: ['😅', '🫣'] },
  };
  const pick = (a) => a[(Math.random() * a.length) | 0];
  function react(e) { if (!reactEl) return; reactEl.textContent = e; reactEl.classList.remove('on'); void reactEl.offsetWidth; reactEl.classList.add('on'); }
  function showCombo(n) {
    if (!comboEl) return;
    if (n >= 2) { comboEl.textContent = '🔥×' + n; comboEl.classList.add('on'); comboEl.classList.remove('bump'); void comboEl.offsetWidth; comboEl.classList.add('bump'); }
    else comboEl.classList.remove('on');
  }
  function build() {
    injectCss();
    ov = document.createElement('div'); ov.id = 'lsnOv';
    panel = document.createElement('div'); panel.className = 'lsnPanel';
    panel.innerHTML = '<button class="lsnClose" aria-label="סגור">✕</button>'
      + '<div class="lsnCombo"></div>'
      + '<div class="lsnHead"><div class="lsnAvWrap"><canvas class="lsnAv" width="128" height="128"></canvas><div class="lsnPaw">🐾</div><div class="lsnReact"></div></div>'
      + '<div style="flex:1"><div class="lsnName"></div><div class="lsnSay"></div></div></div>'
      + '<div class="lsnPips"></div><div class="lsnStage"></div>';
    ov.appendChild(panel); document.body.appendChild(ov);
    comboEl = panel.querySelector('.lsnCombo'); reactEl = panel.querySelector('.lsnReact');
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
  // Every lesson run gets a generation number. Closing a lesson bumps it, so anything the old
  // mini-game still has in flight (a round timer, a late animation callback) finds its host
  // stale and does nothing — it can never talk over, or fail, the NEXT lesson you open.
  let gen = 0;
  function teardown() {
    gen++;
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
    // the starting difficulty is the child's own skill rating for this subject (1..8)
    const level = (HPL.progress && HPL.progress.level(def.key)) || 1;
    const day = (window.HPSchedule && HPSchedule.state) ? HPSchedule.state().day : 0;
    const who = PERSONA[def.teacher] || PERSONA.defence;
    let combo = 0, best = 0, hits = 0, misses = 0;
    showCombo(0);
    // in-session dynamic difficulty: climbs as the child succeeds, eases after misses, so a
    // confident child gets harder questions and a struggling one gets a break — never a dead end.
    let streak = 0, dyn = 0;
    const myGen = gen, live = () => myGen === gen;
    const host = {
      stage: stageEl, subject: def.subject, color: def.color, teacher: def.teacher, key: def.key, level, day,
      // record an answer: two in a row right → one notch harder (capped); any miss → one notch
      // easier (floored). Lessons fold host.lvl()/host.dyn() into their per-round difficulty.
      hit(ok) {
        if (!live()) return dyn;
        if (ok) {
          streak++; hits++; combo++; best = Math.max(best, combo); showCombo(combo);
          if (combo >= 2) { try { window.HPFun && HPFun.sfx.tink(Math.min(combo, 9)); } catch (e) {} }
          // on a roll: the professor reacts in character (a face always; a line at 3, 5, 8…)
          if (combo >= 2) react(pick(who.yay));
          if (combo === 3 || combo === 5 || combo === 8) host.after(260, () => { sayEl.textContent = pick(who.praise); moodT = 1; mood = 1; });
          if (streak >= 2 && dyn < 3) { dyn++; streak = 0; levelUp(); }
        } else { streak = 0; misses++; if (combo >= 2) react(pick(who.oops)); combo = 0; showCombo(0); if (dyn > -2) dyn--; }
        return dyn;
      },
      stats() { return { combo, best, hits, misses, dyn }; },
      dyn() { return dyn; },
      lvl() { return Math.max(1, Math.min(9, level + dyn)); },   // effective difficulty right now
      say(t, m) { if (!live()) return; sayEl.textContent = t; moodT = Math.max(0.3, (t || '').length * 0.045); mood = 1; },
      setProgress(cur, total) {
        if (!live()) return;
        pipsEl.innerHTML = '';
        for (let i = 0; i < total; i++) { const p = document.createElement('div'); p.className = 'lsnPip' + (i < cur ? ' on' : ''); pipsEl.appendChild(p); }
      },
      good(x, y) { if (!live()) return; try { HP.sfx.chime(); HP.sfx.sparkle(); } catch (e) {} spark(x, y, ['✨', '⭐', '🌟', '💫']); },
      bad() { if (!live()) return; try { HP.sfx.soft(); } catch (e) {} panel.classList.remove('lsnShake'); void panel.offsetWidth; panel.classList.add('lsnShake'); },
      confetti() { if (!live()) return; for (let i = 0; i < 18; i++) spark(10 + Math.random() * (panel.clientWidth - 20), 40 + Math.random() * (panel.clientHeight - 80), ['✨', '⭐', '🎉', '🌟', '💛']); },
      after(ms, fn) { const id = setTimeout(() => { if (live()) fn(); }, ms); timers.push(id); return id; },
      rnd(a, b) { return a + Math.floor(Math.random() * (b - a + 1)); },
      el,
      win(stars) { if (!live()) return; reward(def, Math.max(1, Math.min(3, stars || 1)), host); },
      fail(msg) { if (!live()) return; if (HPL.progress && HPL.progress.rate) HPL.progress.rate(def.key, 0, dyn); combo = 0; streak = 0; dyn = Math.min(dyn, 0); showCombo(0); failScreen(def, host, msg); },      // too many misses → gentle retry, no pity-win
      // a shrinking timer bar for timed-bonus rounds; returns { stop, left() }
      timer(ms, onEnd) {
        const bar = el('div', { style: 'width:70%;max-width:320px;height:14px;border-radius:8px;background:rgba(255,255,255,.15);border:2px solid #ffd76a;overflow:hidden' });
        const fill = el('div', { style: 'height:100%;width:100%;background:linear-gradient(90deg,#9effa0,#ffe48a,#ff8a5a);transition:width .2s linear' });
        bar.appendChild(fill); stageEl.appendChild(bar);
        const t0 = performance.now(); let stopped = false;
        const tick = () => { if (stopped) return; if (!live()) { stopped = true; return; } const k = Math.max(0, 1 - (performance.now() - t0) / ms); fill.style.width = (k * 100) + '%';
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

  function reward(def, stars, host) {
    clearTimers(); pipsEl.innerHTML = ''; stageEl.innerHTML = ''; showCombo(0);
    const P = HPL.progress, st = host && host.stats ? host.stats() : { best: 0, dyn: 0 };
    // the skill rating moves with how this lesson really went → next time is a touch harder/easier
    const rated = (P && P.rate) ? P.rate(def.key, stars, st.dyn) : { before: 1, after: 1, up: false };
    // attend() records the finish, bumps stars and books house points (+ a little combo bonus)
    let pts = (P && P.attend) ? P.attend(def.key, stars) : 0;
    const bonus = Math.min(15, Math.max(0, st.best - 2) * 3);
    if (bonus && P.bonus) { P.bonus(bonus); pts += bonus; }
    const sticker = def.sticker || def.icon || '⭐';
    const fun = window.HPFun, house = fun && fun.store.house && window.HPI ? HPI.HOUSES.find((h) => h.key === fun.store.house) : null;
    const rk = P && P.rank ? P.rank(def.key) : { e: '🥉', n: '' }, skill = P && P.skill ? P.skill(def.key) : 1;
    sayEl.textContent = 'כל הכבוד! 🎉'; moodT = 1.2; mood = 1;
    const fill = el('i', { style: 'width:0%' });
    const box = el('div', { class: 'lsnReward' },
      el('div', { class: 'lsnStars' }, '⭐'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('div', { class: 'lsnSticker' }, sticker),
      el('div', { class: 'big' }, 'מדבקה חדשה!'),
      el('div', { style: 'font-size:24px;color:#9effa0;font-weight:bold' }, '🏆 +' + pts + (house ? ' ' + house.crest : ' נקודות בית') + (st.best >= 3 ? '   🔥×' + st.best : '')),
      el('div', { class: 'lsnRank' }, el('span', {}, rk.e + ' ' + rk.n), el('div', { class: 'bar' }, fill), el('span', {}, String(rated.after))));
    if (rated.up) box.appendChild(el('div', { class: 'lsnUp' }, '⬆️ רָמָה ' + rated.after + '!'));
    // a perfect lesson shakes a little prize out of the professor's pocket (feeds the castle quests)
    let prize = null;
    if (stars >= 3 && window.__game && __game.give) {
      prize = Math.random() < 0.5 ? 'snitch' : 'frog'; const n = 1 + (st.best >= 5 ? 1 : 0);
      try { __game.give(prize, n); } catch (e) {}
      box.appendChild(el('div', { class: 'lsnPrize', style: 'font-size:24px;color:#ffe9a8;font-weight:bold' }, '🎁 +' + n + ' ' + (prize === 'snitch' ? '✨' : '🐸')));
    }
    box.appendChild(el('button', { class: 'lsnBtn wide', onclick: () => { teardown(); if (curDone) curDone(stars, false); if (fun && stars >= 2) { try { fun.confetti([sticker, '⭐', '✨'], 14); __game.cheer(2.5); } catch (e) {} } } }, 'המשך ✨'));
    stageEl.appendChild(box);
    timers.push(setTimeout(() => { fill.style.width = Math.round(((skill - 1) / 7) * 100) + '%'; }, 120));
    HPL._lastReward = { key: def.key, stars, pts, bonus, prize, level: rated };
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
