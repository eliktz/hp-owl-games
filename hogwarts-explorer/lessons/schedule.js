/* Lesson availability — now a calm, child-led model: every classroom is ALWAYS open and
 * the child freely picks which lesson to attend, any time, in any order, never interrupted.
 * There is no wall-clock gating, no rotating timetable, no auto-closing doors and no bell.
 * We keep a gentle free-running clock ONLY so the window day/night (HPI.skyMode reads
 * state().period) is unaffected — it gates nothing. The window.HPSchedule surface is kept
 * API-compatible so the map / lesson controllers keep working without special-casing. */
(function () {
  const S = (window.HPSchedule = window.HPSchedule || {});

  const DAYS = ['ראשון', 'שני', 'שלישי', 'רביעי', 'חמישי'];
  const PERIODS = 6;                 // kept for compatibility (one slot per subject)
  const LESSON_MS = 75000;           // timing constants retained for any code that reads them;
  const BREAK_MS = 25000;            // nothing is gated by time any more
  const SLOT_MS = LESSON_MS + BREAK_MS;
  const DAY_MS = PERIODS * SLOT_MS;
  const WEEK_MS = DAYS.length * DAY_MS;
  const KEYS = ['potions', 'charms', 'herbology', 'spells', 'transfiguration', 'astronomy'];
  S.DAYS = DAYS; S.PERIODS = PERIODS; S.KEYS = KEYS;
  S.LESSON_MS = LESSON_MS; S.BREAK_MS = BREAK_MS; S.SLOT_MS = SLOT_MS;

  S.subjectAt = function (day, period) { return KEYS[(period + day) % KEYS.length]; };
  S.timeLabel = function (period) { return (9 + period) + ':00'; };

  // ---- a gentle free-running clock, used ONLY by the window day/night (textures.skyMode) ----
  const EKEY = 'hpSchedEpoch1';
  function now() { return (performance && performance.timeOrigin ? performance.timeOrigin : 0) + performance.now(); }
  let _epoch = null;
  function epoch() {
    if (_epoch == null) {
      _epoch = +localStorage.getItem(EKEY);
      if (!_epoch || !isFinite(_epoch)) { _epoch = now(); try { localStorage.setItem(EKEY, String(_epoch)); } catch (x) {} }
    }
    return _epoch;
  }
  function setEpoch(e) { _epoch = e; try { localStorage.setItem(EKEY, String(e)); } catch (x) {} }

  // where we are in the (cosmetic) week — only day/period matter now, and only for the sky.
  // No lesson is ever auto-open: openKey stays null, inLesson stays false, so nothing gates.
  S.state = function () {
    const weekT = ((now() - epoch()) % WEEK_MS + WEEK_MS) % WEEK_MS;
    const day = Math.floor(weekT / DAY_MS);
    const dayT = weekT % DAY_MS;
    const period = Math.floor(dayT / SLOT_MS);
    return { day, dayName: DAYS[day], period, slotT: 0, inLesson: false, openKey: null, remain: 0 };
  };

  // every classroom is always open — the child chooses freely
  S.isOpen = function () { return true; };

  // compatibility shims for the old timetable callers: there's always a lesson to attend,
  // it's always open now, and every subject is "open now".
  S.next = function () { const st = S.state(); return { key: KEYS[0], day: st.day, period: 0, inMs: 0, dayName: st.dayName }; };
  S.nextOpenOf = function () { const st = S.state(); return { inMs: 0, open: true, dayName: st.dayName, time: S.timeLabel(st.period) }; };

  // today's six subjects (all open) — kept for any caller; the timetable UI is gone
  S.today = function () {
    const st = S.state(); const rows = [];
    for (let p = 0; p < PERIODS; p++) rows.push({ period: p, key: KEYS[p % KEYS.length], time: S.timeLabel(p), now: false, past: false });
    return { day: st.day, dayName: st.dayName, rows, state: st };
  };

  // no-ops: nothing to skip to, and every room is already open
  S.skipToNextLesson = function () {};
  S.jumpToOpen = function () {};
  // fastForward still nudges the cosmetic clock (harmless) so old callers don't break
  S.fastForward = function (dtMs) { setEpoch(epoch() - Math.max(0, dtMs)); };

  // the bell is a lesson picker now — nothing ever auto-rings
  S.onBell = function () {};

  // mm:ss (or "Xשנ'") countdown helper — still handy for UI
  S.fmt = function (ms) {
    const s = Math.max(0, Math.round(ms / 1000));
    const m = Math.floor(s / 60), r = s % 60;
    return m > 0 ? (m + ':' + String(r).padStart(2, '0')) : (r + ' שׁנ\'');
  };
})();
