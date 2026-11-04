/* The lessons controller: the 🔔 "שיעורים" bell + a visual school timetable (today's six
 * periods with a live clock, countdown and a weekly house-points board), the ringing
 * announcement + glowing guide arrow to the open classroom, the walk-up greeting + start
 * button, a polite closed-door sign when you arrive off-period, and the dispatch into each
 * minigame overlay. Reads window.HPSchedule for the clock; self-contained like the map. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  const T = window.THREE;
  const SCH = window.HPSchedule;

  // ---- the subjects: chibi professor, room + a warm Hebrew greeting ----
  const LESSONS = [
    { key: 'potions', subject: 'שיקויים', teacher: 'snape', icon: '⚗️', color: '#7ef0a0', sticker: '⚗️', world: 'inside', room: 'dungeon', greet: 'שב בשקט... היום נבשל שיקוי. בלי לשבור כלום!' },
    { key: 'charms', subject: 'לחשים', teacher: 'flitwick', icon: '🪶', color: '#bfa0ff', sticker: '🪶', world: 'inside', room: 'charms', greet: 'סְוִיש וּפְלִיק! בוא נרחף נוצה יחד!' },
    { key: 'herbology', subject: 'עשבים', teacher: 'sprout', icon: '🌿', color: '#8cff9e', sticker: '🌿', world: 'outside', room: 'greenhouse', trigger: { x: -34, z: -16 }, dest: { world: 'outside', x: -34, z: -10, face: Math.PI, yaw: Math.PI }, greet: 'לחממה! בוא נספור ונשתול עציצים.' },
    { key: 'spells', subject: 'הֲגַנָּה', teacher: 'defence', icon: '🪄', color: '#9fd0ff', sticker: '🪄', world: 'inside', room: 'spells', greet: 'שלוף שרביט! נלמד לומוס, וינגרדיום וחיסול.' },
    { key: 'transfiguration', subject: 'שינוי צורה', teacher: 'mcgon', icon: '🐱', color: '#ffd0a0', sticker: '🐱', world: 'inside', room: 'transfiguration', greet: 'ריכוז! נהפוך חפץ לחפץ אחר.' },
    { key: 'astronomy', subject: 'כוכבים', teacher: 'sinistra', icon: '🔭', color: '#9fb0ff', sticker: '🔭', world: 'inside', room: 'astronomy', greet: 'הלילה יפה. בוא נחבר את הכוכבים לציור.' },
  ];
  HPL.LESSONS = LESSONS;
  const byKey = {}; LESSONS.forEach((l) => (byKey[l.key] = l));

  // ---- progress store (localStorage): best stars + attendance + weekly house points ----
  const KEY = 'hpLessons1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  const store = load();
  store.stars = store.stars || {}; store.got = store.got || {};
  store.att = store.att || {};        // completed-count per subject (feeds difficulty)
  store.points = store.points || 0;   // total house points on the weekly board
  store.pday = store.pday || {};      // points earned per weekday index
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  HPL.progress = {
    // base mastery level 1..6 from stars earned + times attended → ramps across the week
    level(key) { const s = store.stars[key] || 0, a = store.att[key] || 0; return Math.max(1, Math.min(6, 1 + Math.floor((s + a) / 2))); },
    stars(key) { return store.stars[key] || 0; },
    att(key) { return store.att[key] || 0; },
    points() { return store.points; },
    pday() { return store.pday; },
    total() { return LESSONS.reduce((s, l) => s + (store.stars[l.key] || 0), 0); },
    award(key, stars) { store.stars[key] = Math.max(store.stars[key] || 0, stars); store.got[key] = true; save(); refreshBell(); return byKey[key] ? byKey[key].sticker : '⭐'; },
    // a lesson finished: record attendance + house points on the weekly board
    attend(key, stars) {
      store.att[key] = (store.att[key] || 0) + 1;
      const day = (SCH && SCH.state) ? SCH.state().day : 0;
      const pts = stars * 10 + 5;    // 15–35 points per attended lesson
      store.points += pts; store.pday[day] = (store.pday[day] || 0) + pts;
      this.award(key, stars); return pts;
    },
  };

  // ---- CSS ----
  const style = document.createElement('style');
  style.textContent = `
  #bellBtn{position:fixed;top:calc(env(safe-area-inset-top,0px) + 88px);inset-inline-start:calc(env(safe-area-inset-left,0px) + 14px);
    width:66px;height:66px;border-radius:50%;border:4px solid #ffd76a;background:radial-gradient(circle at 35% 30%,#ffcf6a,#b9651a);
    color:#fff;font-size:34px;z-index:12;cursor:pointer;box-shadow:0 4px 14px rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;
    touch-action:manipulation;-webkit-tap-highlight-color:transparent}
  #bellBtn:active{transform:scale(.9)} #bellBtn .bd{position:absolute;top:-4px;inset-inline-end:-4px;background:#7CFC7C;color:#13351a;
    font-size:15px;font-weight:bold;min-width:22px;height:22px;border-radius:12px;border:2px solid #13351a;display:flex;align-items:center;justify-content:center;padding:0 3px}
  #schedOv{position:fixed;inset:0;z-index:46;display:none;align-items:center;justify-content:center;background:rgba(8,6,24,.8);font-family:'Rubik',sans-serif}
  #schedOv.on{display:flex}
  .schedP{width:min(94vw,560px);max-height:92vh;overflow:auto;background:rgba(32,20,70,.97);border:5px solid #ffd76a;border-radius:26px;padding:16px}
  .schedT{text-align:center;color:#ffd76a;font-size:30px;font-weight:bold;text-shadow:0 2px 0 #7a3b00;margin:0}
  .schedClock{text-align:center;color:#fff;font-size:20px;margin:2px 0 4px}
  .schedClock b{color:#ffe9a8;font-size:24px} .schedClock .cd{color:#9effa0}
  .schedBoard{display:flex;align-items:flex-end;gap:5px;justify-content:center;height:48px;margin:4px 0 10px}
  .schedBoard .bar{flex:1;max-width:46px;border-radius:7px 7px 0 0;background:linear-gradient(#ffe48a,#ffb020);position:relative;min-height:5px}
  .schedBoard .bar span{position:absolute;top:-16px;left:0;right:0;text-align:center;font-size:12px;color:#ffe9a8}
  .schedBoard .bar small{position:absolute;bottom:-17px;left:0;right:0;text-align:center;font-size:12px;color:#cdbfff}
  .schedPts{text-align:center;color:#ffe9a8;font-size:19px;margin-bottom:8px}
  .schedRow{display:flex;align-items:center;gap:10px;background:rgba(255,255,255,.06);border:2px solid rgba(255,215,106,.35);border-radius:16px;padding:7px 10px;margin-bottom:8px}
  .schedRow.now{border-color:#9effa0;background:rgba(120,240,160,.16);box-shadow:0 0 14px rgba(120,240,160,.4)}
  .schedRow.past{opacity:.5}
  .schedRow .ic{font-size:34px;flex:0 0 auto;width:44px;text-align:center}
  .schedRow .tm{font-size:19px;color:#cdbfff;width:52px;text-align:center}
  .schedRow .info{flex:1} .schedRow .sub{color:#fff;font-size:21px;font-weight:bold} .schedRow .st{font-size:15px;letter-spacing:1px}
  .schedRow .tag{font-size:15px;font-weight:bold;border-radius:10px;padding:2px 8px}
  .schedRow .tag.open{background:#9effa0;color:#143a1a} .schedRow .tag.shut{background:#6a5a8a;color:#eadcff}
  .schedGo{min-width:58px;height:50px;border-radius:14px;border:3px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:20px;font-weight:bold;cursor:pointer;font-family:inherit;touch-action:manipulation}
  .schedGo:active{transform:scale(.92)} .schedGo:disabled{opacity:.45;filter:grayscale(.5)}
  .schedSkip{display:block;width:100%;margin:4px 0 8px;padding:10px;border-radius:16px;border:3px solid #fff;background:linear-gradient(#b5a0ff,#7a52d6);color:#fff;font-size:20px;font-weight:bold;cursor:pointer;font-family:inherit;touch-action:none;-webkit-user-select:none;user-select:none}
  .schedSkip:active{transform:scale(.97)}
  .schedClose{display:block;margin:2px auto 0;padding:8px 36px;border-radius:40px;border:4px solid #fff;background:linear-gradient(#ffe48a,#ffb020);color:#5a2b00;font-size:24px;font-weight:bold;cursor:pointer;font-family:inherit}
  #lsnAnn{position:fixed;left:50%;top:22%;transform:translate(-50%,-50%) scale(0);z-index:44;pointer-events:none;text-align:center;
    background:rgba(40,25,90,.92);border:4px solid #ffd76a;border-radius:24px;padding:14px 26px;color:#fff;font-size:34px;font-weight:bold;
    text-shadow:0 2px 0 #000;transition:transform .4s cubic-bezier(.3,1.7,.5,1)}
  #lsnAnn.on{transform:translate(-50%,-50%) scale(1)}
  #lsnArrow{position:fixed;left:50%;top:50%;z-index:13;width:96px;height:96px;margin:-48px 0 0 -48px;pointer-events:none;display:none;
    flex-direction:column;align-items:center;justify-content:center;color:#bfffbf}
  #lsnArrow.on{display:flex}
  #lsnArrow .ic{font-size:26px;width:44px;height:44px;border-radius:50%;background:rgba(20,53,26,.92);border:3px solid #7CFC7C;
    display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px #7CFC7C;position:relative;animation:lsnPulse 1.2s infinite}
  #lsnArrow .ic .lk{position:absolute;bottom:-7px;inset-inline-end:-7px;font-size:15px;display:none}
  #lsnArrow.shut .ic{border-color:#ffd76a;box-shadow:0 0 12px #ffd76a;background:rgba(53,40,20,.92)}
  #lsnArrow.shut .ic .lk{display:block}
  #lsnArrow .ar{font-size:54px;line-height:1;filter:drop-shadow(0 0 10px #7CFC7C);margin-top:-2px}
  #lsnStart{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;
    display:none;flex-direction:column;align-items:center;gap:8px;pointer-events:none}
  #lsnStart.on{display:flex}
  #lsnStart .greet{background:rgba(255,245,220,.96);color:#2a1a12;border:3px solid #ffd76a;border-radius:18px;padding:8px 16px;font-size:24px;font-weight:bold;max-width:72vw;text-align:center}
  #lsnStart .go{pointer-events:auto;width:92px;height:92px;border-radius:50%;border:5px solid #fff;background:linear-gradient(#ffe48a,#ffb020);
    color:#5a2b00;font-size:46px;font-weight:bold;cursor:pointer;box-shadow:0 0 26px rgba(255,210,90,.9);animation:lsnPulse 1.1s infinite;font-family:inherit;touch-action:manipulation}
  @keyframes lsnPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.09)}}
  #lsnClosed{position:fixed;left:50%;bottom:calc(150px + env(safe-area-inset-bottom));transform:translateX(-50%);z-index:12;display:none;
    flex-direction:column;align-items:center;gap:6px;pointer-events:none;text-align:center}
  #lsnClosed.on{display:flex}
  #lsnClosed .sign{background:rgba(44,30,70,.96);color:#fff;border:3px solid #b9a0ff;border-radius:18px;padding:10px 18px;font-size:22px;font-weight:bold;max-width:74vw}
  #lsnClosed .when{color:#9effa0;font-size:20px;margin-top:4px}
  #lsnClosed .spk{font-size:26px;animation:lsnPulse 1.3s infinite}
  #lsnTip{position:fixed;left:50%;bottom:calc(240px + env(safe-area-inset-bottom));transform:translateX(-50%) translateY(12px);
    z-index:14;max-width:86vw;background:rgba(40,25,90,.96);border:3px solid #ffd76a;border-radius:18px;padding:11px 18px;
    color:#fff;font-size:19px;font-weight:bold;text-align:center;line-height:1.5;opacity:0;pointer-events:none;
    box-shadow:0 6px 20px rgba(0,0,0,.5);transition:opacity .45s,transform .45s}
  #lsnTip.on{opacity:1;transform:translateX(-50%) translateY(0)}
  #lsnTip b{color:#9effa0} #lsnTip .k{color:#ffe9a8}`;
  document.head.appendChild(style);

  // ---- DOM: bell, schedule, announcement, arrow, start prompt, closed sign ----
  let bellBtn, schedOv, annEl, arrowEl, arrowEm, arrowArr, startEl, goBtn, greetEl, closedEl, closedSign, closedWhen;
  function build() {
    bellBtn = mk('button', 'bellBtn'); bellBtn.innerHTML = '🔔<span class="bd">0</span>'; bellBtn.title = 'שיעורים';
    bellBtn.addEventListener('click', (e) => { e.stopPropagation(); openSchedule(); });
    schedOv = mk('div', 'schedOv'); document.body.appendChild(schedOv);
    schedOv.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === schedOv) closeSchedule(); });
    annEl = mk('div', 'lsnAnn'); document.body.appendChild(annEl);
    arrowEl = mk('div', 'lsnArrow');
    arrowEl.innerHTML = '<div class="ic"><span class="em">✨</span><span class="lk">🔒</span></div><div class="ar">➤</div>';
    arrowEm = arrowEl.querySelector('.em'); arrowArr = arrowEl.querySelector('.ar');
    document.body.appendChild(arrowEl);
    startEl = mk('div', 'lsnStart');
    greetEl = mk('div'); greetEl.className = 'greet'; startEl.appendChild(greetEl);
    goBtn = mk('button'); goBtn.className = 'go'; goBtn.textContent = '▶'; startEl.appendChild(goBtn);
    goBtn.addEventListener('click', (e) => { e.stopPropagation(); if (nearKey) startLesson(nearKey); });
    document.body.appendChild(startEl);
    closedEl = mk('div', 'lsnClosed');
    closedSign = mk('div'); closedSign.className = 'sign'; closedSign.innerHTML = '🔒 הדלת סגורה';
    closedWhen = mk('div'); closedWhen.className = 'when';
    const spk = mk('div'); spk.className = 'spk'; spk.textContent = '✨';
    closedEl.appendChild(closedSign); closedEl.appendChild(closedWhen); closedEl.appendChild(spk);
    document.body.appendChild(closedEl);
    document.body.appendChild(bellBtn);
    tipEl = mk('div', 'lsnTip');
    tipEl.innerHTML = 'עֲקֹב אַחֲרֵי הַחֵץ הַיָּרֹק <b>➤</b> אֶל הַשִּׁעוּר<br>'
      + 'וְהַקֵּשׁ עַל הַ<span class="k">🔔</span> לִרְאוֹת מָתַי כָּל שִׁעוּר';
    document.body.appendChild(tipEl);
    refreshBell();
    if (SCH && SCH.onBell) SCH.onBell((key) => ringBell(key));
  }
  // a gentle one-time coach tip, the first time a child actually starts playing
  let tipEl = null, tipDone = false;
  function maybeTip() {
    if (tipDone) return; tipDone = true;
    try { if (localStorage.getItem('hpLsnTip1')) return; } catch (e) {}
    if (!tipEl) return;
    tipEl.classList.add('on');
    try { localStorage.setItem('hpLsnTip1', '1'); } catch (e) {}
    setTimeout(() => tipEl && tipEl.classList.remove('on'), 8000);
  }
  function mk(t, id) { const e = document.createElement(t); if (id) e.id = id; return e; }
  function refreshBell() { if (bellBtn) bellBtn.querySelector('.bd').textContent = HPL.progress.total(); }

  // the clock rolled into a new lesson period → ring + announce + aim the guide arrow
  function ringBell(key) {
    const l = byKey[key]; if (!l) return;
    activeKey = key;
    announce('🔔 הפעמון מצלצל!', l.icon + ' ' + l.subject);
  }

  // ---- the schedule / timetable screen ----
  let schedTimer = null;
  function openSchedule() {
    setModal(true); try { HP.sfx.flip(); } catch (e) {}
    renderSchedule();
    schedOv.classList.add('on');
    clearInterval(schedTimer); schedTimer = setInterval(renderSchedule, 500);
  }
  function closeSchedule() { schedOv.classList.remove('on'); clearInterval(schedTimer); schedTimer = null; setModal(false); try { HP.sfx.pop(); } catch (e) {} }

  function renderSchedule() {
    if (!SCH) return;
    const t = SCH.today(), st = t.state;
    const status = st.inLesson ? ('שיעור: ' + (byKey[st.openKey] ? byKey[st.openKey].subject : '')) : 'הפסקה — זמן חופשי';
    const p = document.createElement('div'); p.className = 'schedP';
    p.innerHTML = '<div class="schedT">🔔 מערכת שעות</div>'
      + '<div class="schedClock">יום <b>' + t.dayName + '</b> · ' + SCH.timeLabel(st.period) + ' · ' + status
      + ' <span class="cd">(' + SCH.fmt(st.remain) + ')</span></div>';
    // weekly house-points board
    const board = document.createElement('div'); board.className = 'schedBoard';
    const pday = HPL.progress.pday(); let maxP = 1;
    SCH.DAYS.forEach((_, d) => { maxP = Math.max(maxP, pday[d] || 0); });
    SCH.DAYS.forEach((dn, d) => {
      const v = pday[d] || 0; const bar = document.createElement('div'); bar.className = 'bar';
      bar.style.height = (6 + (v / maxP) * 40) + 'px';
      bar.innerHTML = '<span>' + (v || '') + '</span><small>' + dn + '</small>';
      if (d === st.day) bar.style.outline = '2px solid #9effa0';
      board.appendChild(bar);
    });
    p.appendChild(board);
    const pts = document.createElement('div'); pts.className = 'schedPts';
    pts.textContent = '🏆 נקודות בית: ' + HPL.progress.points() + '   ⭐ ' + HPL.progress.total() + '/' + (LESSONS.length * 3);
    p.appendChild(pts);
    // skip-to-next-lesson (tap once, or hold to fast-forward through the break)
    const skip = document.createElement('button'); skip.className = 'schedSkip';
    skip.textContent = '⏩ לדלג לשיעור הבא (החזק/י)';
    bindSkip(skip);
    p.appendChild(skip);
    // today's six periods
    t.rows.forEach((r) => {
      const l = byKey[r.key]; const open = r.now;
      const row = document.createElement('div'); row.className = 'schedRow' + (open ? ' now' : '') + (r.past ? ' past' : '');
      const stn = HPL.progress.stars(r.key);
      const nxt = SCH.nextOpenOf(r.key);
      row.innerHTML = '<div class="ic">' + l.icon + '</div><div class="tm">' + r.time + '</div>'
        + '<div class="info"><div class="sub">' + l.subject + '</div>'
        + '<div class="st">' + ('⭐'.repeat(stn) + '☆'.repeat(3 - stn)) + '</div></div>'
        + '<div class="tag ' + (open ? 'open' : 'shut') + '">' + (open ? 'פתוח' : '🔒') + '</div>';
      const go = document.createElement('button'); go.className = 'schedGo'; go.textContent = 'ללכת';
      go.addEventListener('click', (e) => { e.stopPropagation(); closeSchedule(); goToLesson(r.key); });
      row.appendChild(go); p.appendChild(row);
    });
    const close = document.createElement('button'); close.className = 'schedClose'; close.textContent = 'סגור';
    close.addEventListener('click', (e) => { e.stopPropagation(); closeSchedule(); });
    p.appendChild(close);
    schedOv.innerHTML = ''; schedOv.appendChild(p);
  }

  // skip button: a tap jumps to the next lesson; holding fast-forwards (parent-friendly)
  function bindSkip(btn) {
    let held = null, moved = false;
    const down = (e) => { e.preventDefault(); e.stopPropagation(); moved = false;
      held = setTimeout(function ff() { moved = true; SCH.fastForward(4000); renderSchedule(); held = setTimeout(ff, 90); }, 300); };
    const up = (e) => { if (held) { clearTimeout(held); held = null; } if (!moved) { SCH.skipToNextLesson(); try { HP.sfx.chime && HP.sfx.chime(); } catch (x) {} renderSchedule(); } };
    btn.addEventListener('pointerdown', down);
    btn.addEventListener('pointerup', up); btn.addEventListener('pointercancel', () => { if (held) { clearTimeout(held); held = null; } });
  }

  // chosen from the schedule → travel to its classroom (door-gating handles open/closed)
  let activeKey = null;
  function goToLesson(key) {
    const l = byKey[key]; if (!l) return;
    activeKey = key;
    const dest = l.dest || { world: 'inside', key: l.room };
    try { if (__game.fastTravel) __game.fastTravel(dest); } catch (e) {}
  }
  function announce(a, b) {
    annEl.innerHTML = a + '<br><span style="font-size:26px;color:#ffe9a8">' + b + '</span>';
    annEl.classList.add('on'); try { HP.sfx.hoot(true); } catch (e) {}
    clearTimeout(announce._t); announce._t = setTimeout(() => annEl.classList.remove('on'), 2600);
  }

  // ---- proximity: find the lesson whose teacher the player is standing near ----
  function triggerPos(l) {
    if (l.world === 'outside') return l.trigger;
    const t = (__game.inside && __game.inside.teachers || []).find((x) => x.key === l.key);
    return t ? { x: t.x, z: t.z } : null;
  }
  let nearKey = null, armed = {};
  function startLesson(key) {
    const l = byKey[key]; if (!l || (__game && __game.modal)) return;
    if (SCH && !SCH.isOpen(key)) { showClosed(key); return; }   // door shut off-period
    hideStart(); hideClosed(); arrowEl.classList.remove('on'); armed[key] = false;
    HPL.overlay.open(l, () => { refreshBell(); });   // reward() books attendance + house points
  }

  function setModal(v) { try { __game && __game.setModal && __game.setModal(v); } catch (e) {} }

  // ---- per-frame loop (own rAF; reads __game + the clock) ----
  const tmp = T ? new T.Vector3() : null;
  function frame() {
    requestAnimationFrame(frame);
    const g = window.__game;
    if (!g || !g.started || g.modal) { hideStart(); hideClosed(); arrowEl.classList.remove('on'); return; }
    if (!tipDone) maybeTip();   // first frame of real play → show the coach tip once
    const world = g.world, pp = g.player.position;
    const openKey = SCH ? SCH.state().openKey : null;
    // the arrow always leads to the open lesson (or, in a break, the next one)
    activeKey = openKey || (SCH && SCH.next ? SCH.next().key : activeKey);
    // nearest triggerable lesson in this world
    let best = null, bd = 1e9;
    for (const l of LESSONS) {
      if (l.world !== world) continue;
      const tp = triggerPos(l); if (!tp) continue;
      const d = Math.hypot(pp.x - tp.x, pp.z - tp.z);
      if (d < bd) { bd = d; best = l; }
    }
    const range = 4.2;
    if (best && bd < range) {
      nearKey = best.key;
      if (SCH && !SCH.isOpen(best.key)) {           // standing at a shut door
        hideStart(); showClosed(best.key);
      } else {
        hideClosed(); showStart(best);
        // open + walked right up → auto-begin
        if (openKey === best.key && bd < 2.6 && armed[best.key] !== false) startLesson(best.key);
      }
      if (bd > 3) armed[best.key] = true;           // re-arm after stepping back
    } else { nearKey = null; hideStart(); hideClosed(); if (best) armed[best.key] = true; }
    updateArrow(g, world);
  }
  function showStart(l) {
    hideClosed();
    if (startEl.classList.contains('on') && greetEl.dataset.k === l.key) return;
    greetEl.dataset.k = l.key; greetEl.textContent = l.icon + ' ' + l.greet;
    startEl.classList.add('on');
  }
  function hideStart() { if (startEl) startEl.classList.remove('on'); }
  function showClosed(key) {
    const l = byKey[key]; if (!closedEl) return;
    const info = SCH ? SCH.nextOpenOf(key) : null;
    closedSign.innerHTML = '🔒 ' + l.icon + ' ' + l.subject + ' — הדלת סגורה';
    closedWhen.textContent = info ? ('בוא/י ביום ' + info.dayName + ' בשעה ' + info.time + ' ✨') : '';
    if (closedEl.dataset.k !== key) { closedEl.dataset.k = key; try { HP.sfx.soft && HP.sfx.soft(); } catch (e) {} }
    closedEl.classList.add('on');
  }
  function hideClosed() { if (closedEl) { closedEl.classList.remove('on'); closedEl.dataset.k = ''; } }

  function updateArrow(g, world) {
    const l = activeKey && byKey[activeKey];
    if (!l || l.world !== world || !tmp) { arrowEl.classList.remove('on'); return; }
    const tp = triggerPos(l); if (!tp) { arrowEl.classList.remove('on'); return; }
    if (Math.hypot(g.player.position.x - tp.x, g.player.position.z - tp.z) < 4) { arrowEl.classList.remove('on'); return; }
    const fy = (world === 'inside' && g.inside) ? g.inside.floorH(tp.x, tp.z) + 1.6 : 1.6;
    tmp.set(tp.x, fy, tp.z).project(g.camera);
    const cx = window.innerWidth / 2, cy = window.innerHeight / 2;
    let sx = tmp.x, sy = tmp.y; if (tmp.z > 1) { sx = -sx; sy = -sy; }       // behind camera → flip
    const ang = Math.atan2(-sy, sx);
    const rad = Math.min(window.innerWidth, window.innerHeight) * 0.3;
    arrowEl.style.left = (cx + Math.cos(ang) * rad) + 'px';
    arrowEl.style.top = (cy - Math.sin(ang) * rad) + 'px';
    // the icon chip stays upright so kids can read "this way to [subject]"; only the ➤ turns.
    if (arrowEm) arrowEm.textContent = l.icon;
    if (arrowArr) arrowArr.style.transform = 'rotate(' + (-ang) + 'rad)';
    arrowEl.classList.toggle('shut', !(SCH && SCH.isOpen && SCH.isOpen(l.key)));
    arrowEl.classList.add('on');
  }

  // ---- boot once __game + overlay are ready ----
  (function boot() {
    if (!window.__game || !HPL.overlay || !HPL.teacherAvatar) { return void setTimeout(boot, 120); }
    build(); requestAnimationFrame(frame);
  })();
  HPL.start = startLesson; HPL.go = goToLesson;   // test hooks
})();
