/* The school timetable + a game-time clock. A Hogwarts week is five short days
 * (ראשון…חמישי); each day has six periods, one per subject, the order rotating so a
 * child can reach every lesson each day. A classroom door only opens during its period;
 * the rest is free time to explore. Time runs off a localStorage epoch so it survives a
 * reload and the "skip to next period" hold can nudge it forward. Self-contained: owns no
 * DOM, only exposes window.HPSchedule for the bell/map/lesson controllers to read. */
(function () {
  const S = (window.HPSchedule = window.HPSchedule || {});

  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
  const PERIODS = 6;                 // one slot per subject each day
  const LESSON_MS = 75000;           // a lesson period is open this long (real ms) ~1¼ min
  const BREAK_MS = 25000;            // free time between periods
  const SLOT_MS = LESSON_MS + BREAK_MS;
  const DAY_MS = PERIODS * SLOT_MS;
  const WEEK_MS = DAYS.length * DAY_MS;
  // subject keys in the order the bell/overlay use; grid rotates them per day
  const KEYS = ['potions', 'charms', 'herbology', 'spells', 'transfiguration', 'astronomy'];
  S.DAYS = DAYS; S.PERIODS = PERIODS; S.KEYS = KEYS;
  S.LESSON_MS = LESSON_MS; S.BREAK_MS = BREAK_MS; S.SLOT_MS = SLOT_MS;

  // which subject sits in [day][period] — rotate so day 0 period 0 is Potions
  S.subjectAt = function (day, period) { return KEYS[(period + day) % KEYS.length]; };
  // a pretty 24h-ish clock label for a period (school hours 09:00 → 14:00)
  S.timeLabel = function (period) { return (9 + period) + ':00'; };

  // ---- the clock: elapsed game-time from a persisted epoch ----
  const EKEY = 'hpSchedEpoch1';
  function now() { return (performance && performance.timeOrigin ? performance.timeOrigin : 0) + performance.now(); }
  let _epoch = null;                     // cached so the per-frame clock never hits localStorage
  function epoch() {
    if (_epoch == null) {
      _epoch = +localStorage.getItem(EKEY);
      if (!_epoch || !isFinite(_epoch)) { _epoch = now(); try { localStorage.setItem(EKEY, String(_epoch)); } catch (x) {} }
    }
    return _epoch;
  }
  function setEpoch(e) { _epoch = e; try { localStorage.setItem(EKEY, String(e)); } catch (x) {} }

  // the heart: where are we in the week right now?
  S.state = function () {
    const weekT = ((now() - epoch()) % WEEK_MS + WEEK_MS) % WEEK_MS;
    const day = Math.floor(weekT / DAY_MS);
    const dayT = weekT % DAY_MS;
    const period = Math.floor(dayT / SLOT_MS);
    const slotT = dayT % SLOT_MS;
    const inLesson = slotT < LESSON_MS;
    const openKey = inLesson ? S.subjectAt(day, period) : null;
    const remain = inLesson ? (LESSON_MS - slotT) : (SLOT_MS - slotT);  // ms left in this phase
    return { day, dayName: DAYS[day], period, slotT, inLesson, openKey, remain };
  };

  // is this subject's classroom open right now?
  S.isOpen = function (key) { return S.state().openKey === key; };

  // the next lesson to attend (this period if open, else the upcoming one) + ms until it opens
  S.next = function () {
    const weekT0 = ((now() - epoch()) % WEEK_MS + WEEK_MS) % WEEK_MS;
    const st = S.state();
    if (st.inLesson) return { key: st.openKey, day: st.day, period: st.period, inMs: 0, dayName: st.dayName };
    // walk forward slot-by-slot to the next lesson start
    let t = weekT0, guard = 0;
    while (guard++ < DAYS.length * PERIODS + 2) {
      const toNextSlot = SLOT_MS - (t % SLOT_MS);
      t += toNextSlot;
      const wt = t % WEEK_MS;
      const day = Math.floor(wt / DAY_MS), period = Math.floor((wt % DAY_MS) / SLOT_MS);
      return { key: S.subjectAt(day, period), day, period, inMs: (t - weekT0), dayName: DAYS[day] };
    }
    return { key: KEYS[0], day: 0, period: 0, inMs: 0, dayName: DAYS[0] };
  };

  // when (label) does a given subject next open? → "חמישי 11:00" + ms away
  S.nextOpenOf = function (key) {
    const weekT0 = ((now() - epoch()) % WEEK_MS + WEEK_MS) % WEEK_MS;
    for (let s = 0; s < DAYS.length * PERIODS; s++) {
      const slotStart = Math.ceil(weekT0 / SLOT_MS) * SLOT_MS + s * SLOT_MS;
      const wt = slotStart % WEEK_MS;
      const day = Math.floor(wt / DAY_MS), period = Math.floor((wt % DAY_MS) / SLOT_MS);
      if (S.subjectAt(day, period) === key) {
        const inMs = slotStart - weekT0;
        // if we're currently inside this very slot's lesson, it's open now
        if (S.isOpen(key)) return { inMs: 0, open: true, dayName: S.state().dayName, time: S.timeLabel(S.state().period) };
        return { inMs, open: false, dayName: DAYS[day], time: S.timeLabel(period) };
      }
    }
    return { inMs: 0, open: S.isOpen(key), dayName: DAYS[0], time: S.timeLabel(0) };
  };

  // today's six periods for the schedule screen
  S.today = function () {
    const st = S.state();
    const rows = [];
    for (let p = 0; p < PERIODS; p++) {
      rows.push({ period: p, key: S.subjectAt(st.day, p), time: S.timeLabel(p),
        now: st.inLesson && p === st.period, past: p < st.period || (p === st.period && !st.inLesson) });
    }
    return { day: st.day, dayName: st.dayName, rows, state: st };
  };

  // jump time forward to the start of the next lesson period (the parent "skip" button)
  S.skipToNextLesson = function () {
    const n = S.next();
    if (n.inMs <= 0) return;             // already in a lesson
    setEpoch(epoch() - n.inMs - 30);     // rewind epoch → advance game-time to that start
  };
  // fast-forward by dt ms (held skip button zooms through the week)
  S.fastForward = function (dtMs) { setEpoch(epoch() - Math.max(0, dtMs)); };
  // test hook: jump straight to a subject's open period
  S.jumpToOpen = function (key) {
    const info = S.nextOpenOf(key);
    if (info.inMs > 0) setEpoch(epoch() - info.inMs - 30);
  };

  // ---- bell: fire a callback when a new lesson period begins ----
  const listeners = [];
  S.onBell = function (fn) { listeners.push(fn); };
  let lastOpen = null, lastInLesson = null;
  (function tick() {
    const st = S.state();
    const openChanged = st.inLesson && st.openKey && (st.openKey !== lastOpen || lastInLesson === false);
    if (openChanged) listeners.forEach((fn) => { try { fn(st.openKey, st); } catch (e) {} });
    lastOpen = st.openKey; lastInLesson = st.inLesson;
    setTimeout(tick, 500);
  })();

  // mm:ss (or "Xד") countdown helper
  S.fmt = function (ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60), r = s % 60;
    return m > 0 ? (m + ':' + String(r).padStart(2, '0')) : (r + ' שׁנ\'');
  };
})();
