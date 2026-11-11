/* Lesson data + progress, shared by BOTH games (v1 hogwarts-explorer and hogwarts-explorer-hd
 * load this same file, and the same localStorage key, so a child's stars, skill ratings and
 * house points carry across the two worlds). No DOM, no three.js — just the subjects and the
 * persisted store. The host page may set HPL.onProgress to refresh its own badge. */
(function () {
  const HPL = (window.HPLessons = window.HPLessons || {});
  const SCH = window.HPSchedule;
  const refreshBell = () => { try { HPL.onProgress && HPL.onProgress(); } catch (e) {} };

  // ---- the subjects: chibi professor, room + a warm Hebrew greeting ----
  const LESSONS = [
    { key: 'potions', subject: 'שיקויים', teacher: 'snape', icon: '⚗️', color: '#7ef0a0', sticker: '⚗️', world: 'inside', room: 'dungeon', greet: 'שב בשקט... היום נבשל שיקוי. בלי לשבור כלום!' },
    { key: 'charms', subject: 'לחשים', teacher: 'flitwick', icon: '🪶', color: '#bfa0ff', sticker: '🪶', world: 'inside', room: 'charms', greet: 'סְוִיש וּפְלִיק! בוא נרחף נוצה יחד!' },
    { key: 'herbology', subject: 'עשבים', teacher: 'sprout', icon: '🌿', color: '#8cff9e', sticker: '🌿', world: 'outside', room: 'greenhouse', trigger: { x: -34, z: -16 }, dest: { world: 'outside', x: -34, z: -10, face: Math.PI, yaw: Math.PI }, greet: 'לחממה! בוא נספור ונשתול עציצים.' },
    { key: 'spells', subject: 'הֲגַנָּה', teacher: 'defence', icon: '🪄', color: '#9fd0ff', sticker: '🪄', world: 'inside', room: 'spells', greet: 'שלוף שרביט! נלמד לומוס, וינגרדיום וחיסול.' },
    { key: 'transfiguration', subject: 'שינוי צורה', teacher: 'mcgon', icon: '🐱', color: '#ffd0a0', sticker: '🐱', world: 'inside', room: 'transfiguration', greet: 'ריכוז! נהפוך חפץ לחפץ אחר.' },
    { key: 'astronomy', subject: 'כוכבים', teacher: 'sinistra', icon: '🔭', color: '#9fb0ff', sticker: '🔭', world: 'inside', room: 'astronomy', greet: 'הלילה יפה. בוא נחבר את הכוכבים לציור.' },
    { key: 'creatures', subject: 'יצורי פלא', teacher: 'hagrid', icon: '🐉', color: '#ffb070', sticker: '🐉', world: 'outside', room: 'hagrid', trigger: { x: 68, z: 14 }, dest: { world: 'outside', x: 67, z: 22, face: 3.0, yaw: 3.0 + Math.PI }, greet: 'בוא תכיר את החברים שלי! הם רעבים...' },
  ];
  HPL.LESSONS = LESSONS;
  const byKey = {}; LESSONS.forEach((l) => (byKey[l.key] = l));

  // ---- progress store (localStorage): best stars + attendance + "done today" ----
  const KEY = 'hpLessons1';
  function load() { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; } }
  const store = load();
  store.stars = store.stars || {}; store.got = store.got || {};
  store.att = store.att || {};        // completed-count per subject (feeds difficulty)
  store.points = store.points || 0;   // total house points (kept internal)
  store.pday = store.pday || {};      // points earned per weekday index (kept internal)
  store.done = store.done || {};      // subjects completed on the current calendar day
  store.doneDate = store.doneDate || '';
  store.skill = store.skill || {};    // per-subject skill rating 1..8 — the real difficulty driver
  function save() { try { localStorage.setItem(KEY, JSON.stringify(store)); } catch (e) {} }
  function todayStamp() { try { return new Date().toDateString(); } catch (e) { return 'day'; } }
  // roll the "done today" set over at a real calendar-day boundary
  function doneReset() { const d = todayStamp(); if (store.doneDate !== d) { store.doneDate = d; store.done = {}; save(); } }
  doneReset();
  HPL.progress = {
    // Difficulty follows a per-subject SKILL RATING that moves with how each lesson actually
    // went (see rate()): sail through → it climbs, struggle → it eases. So every subject
    // settles at the child's own level and keeps stretching them a little — truly adaptive,
    // across visits, not just a counter of times played.
    skill(key) {
      if (store.skill[key] == null) { const s = store.stars[key] || 0, a = store.att[key] || 0; store.skill[key] = Math.max(2.5, Math.min(6, 1 + (s + a) / 2)); }   // newcomers start at level 3, not baby-easy
      return store.skill[key];
    },
    level(key) { return Math.max(1, Math.min(8, Math.round(this.skill(key)))); },
    // outcome: stars 1..3 on a finish, 0 on a fail screen; dyn = where the in-lesson difficulty ended (−2..3)
    rate(key, stars, dyn) {
      const before = this.level(key);
      const d = stars >= 3 ? (dyn >= 1 ? 0.8 : 0.5) : stars === 2 ? 0.2 : stars === 1 ? -0.35 : -0.6;
      store.skill[key] = Math.max(1, Math.min(8, this.skill(key) + d)); save();
      return { before, after: this.level(key), up: this.level(key) > before };
    },
    // a friendly title for the child's level in a subject (shown on the reward + picker)
    rank(key) { const l = this.level(key); return l >= 7 ? { e: '🏆', n: 'אַלּוּף' } : l >= 5 ? { e: '🥇', n: 'אָשָׁף' } : l >= 3 ? { e: '🥈', n: 'קוֹסֵם' } : { e: '🥉', n: 'שׁוּלְיָה' }; },
    stars(key) { return store.stars[key] || 0; },
    att(key) { return store.att[key] || 0; },
    points() { return store.points; },
    pday() { return store.pday; },
    total() { return LESSONS.reduce((s, l) => s + (store.stars[l.key] || 0), 0); },
    doneToday(key) { doneReset(); return !!store.done[key]; },
    award(key, stars) { store.stars[key] = Math.max(store.stars[key] || 0, stars); store.got[key] = true; save(); refreshBell(); return byKey[key] ? byKey[key].sticker : '⭐'; },
    // a lesson finished: record attendance, mark it done today + book house points
    // personal best streak-of-right-answers per subject; returns true when this run beat it
    record(key, combo) { store.best = store.best || {}; if (combo >= 3 && combo > (store.best[key] || 0)) { store.best[key] = combo; save(); return true; } return false; },
    best(key) { return (store.best && store.best[key]) || 0; },
    // 🔥 day streak: how many days in a row at least one lesson was finished. Shown on the picker
    // in both games — a gentle reason to come back tomorrow (missing a day just restarts at 1).
    streak() {
      const d = store.streakDay; if (!d) return 0;
      const gap = Math.round((new Date(todayStamp()) - new Date(d)) / 86400000);
      return gap <= 1 ? (store.streak || 0) : 0;
    },
    attend(key, stars) {
      const tday = todayStamp();
      if (store.streakDay !== tday) { store.streak = this.streak() + 1; store.streakDay = tday; }
      store.att[key] = (store.att[key] || 0) + 1;
      doneReset(); store.done[key] = true;
      const day = (SCH && SCH.state) ? SCH.state().day : 0;
      const pts = stars * 10 + 5;    // 15–35 points per attended lesson
      store.points += pts; store.pday[day] = (store.pday[day] || 0) + pts;
      this.award(key, stars); return pts;
    },
    bonus(pts) { const day = (SCH && SCH.state) ? SCH.state().day : 0; store.points += pts; store.pday[day] = (store.pday[day] || 0) + pts; save(); },
  };
})();
