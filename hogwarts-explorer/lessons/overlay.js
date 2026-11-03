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
    .lsnAv{width:92px;height:92px;border-radius:50%;border:4px solid #ffd76a;background:rgba(10,6,30,.5);flex:0 0 auto}
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

  let ov, panel, avCanvas, nameEl, sayEl, pipsEl, stageEl;
  function build() {
    injectCss();
    ov = document.createElement('div'); ov.id = 'lsnOv';
    panel = document.createElement('div'); panel.className = 'lsnPanel';
    panel.innerHTML = '<button class="lsnClose" aria-label="סגור">✕</button>'
      + '<div class="lsnHead"><canvas class="lsnAv" width="128" height="128"></canvas>'
      + '<div style="flex:1"><div class="lsnName"></div><div class="lsnSay"></div></div></div>'
      + '<div class="lsnPips"></div><div class="lsnStage"></div>';
    ov.appendChild(panel); document.body.appendChild(ov);
    avCanvas = panel.querySelector('.lsnAv'); nameEl = panel.querySelector('.lsnName');
    sayEl = panel.querySelector('.lsnSay'); pipsEl = panel.querySelector('.lsnPips'); stageEl = panel.querySelector('.lsnStage');
    panel.querySelector('.lsnClose').addEventListener('click', () => quit());
  }

  let raf = null, timers = [], curClose = null, mood = 0, moodT = 0;
  function animAvatar(who) {
    const ctx = avCanvas.getContext('2d');
    cancelAnimationFrame(raf);
    let last = performance.now();
    (function loop(now) {
      const dt = Math.min(0.05, (now - last) / 1000); last = now;
      if (moodT > 0) { moodT -= dt; mood = Math.abs(Math.sin(now / 90)) * (moodT > 0 ? 1 : 0); } else mood *= 0.9;
      HPL.teacherAvatar(ctx, who, 128, mood);
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
  function open(def, onComplete) {
    if (!ov) build();
    curDone = onComplete; stageEl.innerHTML = ''; sayEl.textContent = def.greet || 'שלום!';
    nameEl.textContent = def.subject; panel.style.borderColor = def.color || '#ffd76a';
    ov.classList.add('on'); animAvatar(def.teacher);
    try { HP.sfx.flip(); } catch (e) {}
    try { window.__game && __game.setModal && __game.setModal(true); } catch (e) {}
    const host = makeHost(def);
    host.say(def.greet || 'שלום!');
    timers.push(setTimeout(() => { try { (HPL.games[def.key] || missing)(host); } catch (e) { console.warn('[lesson]', e); } }, 650));
  }
  function missing(host) { host.say('השיעור בקרוב!'); host.after(1200, () => host.win(1)); }

  function makeHost(def) {
    const level = (HPL.progress && HPL.progress.level(def.key)) || 1;
    const host = {
      stage: stageEl, subject: def.subject, color: def.color, teacher: def.teacher, key: def.key, level,
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
    const sticker = (HPL.progress && HPL.progress.award(def.key, stars)) || def.icon || '⭐';
    sayEl.textContent = 'כל הכבוד! 🎉'; moodT = 1.2; mood = 1;
    const box = el('div', { class: 'lsnReward' },
      el('div', { class: 'lsnStars' }, '⭐'.repeat(stars) + '☆'.repeat(3 - stars)),
      el('div', { class: 'lsnSticker' }, sticker),
      el('div', { class: 'big' }, 'מדבקה חדשה!'),
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
