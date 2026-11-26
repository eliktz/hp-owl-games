// Hebrew map / fast-travel screen (like v1's map): a full-screen overlay of destination
// cards. Outdoor landmarks teleport the player across the grounds; the four interiors
// stream in on arrival. Tapping a card calls onTravel(id, kind) and closes the overlay.
export const DESTS = [
  { id: 'gates',     kind: 'spot',     ico: '🏰', label: 'השער הראשי' },
  { id: 'courtyard', kind: 'spot',     ico: '🌳', label: 'החצר' },
  { id: 'lake',      kind: 'spot',     ico: '🌊', label: 'האגם' },
  { id: 'bridge',    kind: 'spot',     ico: '🌉', label: 'הגשר' },
  { id: 'hut',       kind: 'spot',     ico: '🏡', label: 'הבקתה של האגריד' },
  { id: 'greathall', kind: 'interior', ico: '🕯️', label: 'האולם הגדול' },
  { id: 'staircase', kind: 'interior', ico: '🪜', label: 'המדרגות הנעות' },
  { id: 'library',   kind: 'interior', ico: '📚', label: 'הספרייה' },
  { id: 'commonroom',kind: 'interior', ico: '🔥', label: 'חדר הטרקלין' },
  { id: 'classrooms',kind: 'interior', ico: '🪄', label: 'הכיתות' },
  { id: 'dungeon',   kind: 'interior', ico: '⚗️', label: 'מרתף השיקויים' },
  { id: 'tower',     kind: 'interior', ico: '🔭', label: 'מגדל הכוכבים' },
  { id: 'showers',   kind: 'interior', ico: '🚿', label: 'המקלחות' },
  { id: 'greenhouse',kind: 'spot',     ico: '🌿', label: 'החממה' },
  { id: 'paddock',   kind: 'spot',     ico: '🐉', label: 'יצורי הפלא' },
  { id: 'pitch',     kind: 'spot',     ico: '🧹', label: 'מגרש הקווידיץ׳' },
  { id: 'b3bus',     kind: 'bus',      ico: '🚌', label: 'האוטובוס הלילי' },   // a free ride on the Knight Bus (adventure-b3-bus.js)
  { id: 'b3lake',    kind: 'lake',     ico: '🦌', label: 'האגם בערב' },        // book 3: chase grey shadows with the Patronus (adventure-b3-patronus.js)
];

// Build the overlay once and return { toggle, open, close }. onTravel(id, kind) is called
// with the chosen destination; the overlay then hides itself.
export function createMap({ onTravel }) {
  const root = document.getElementById('map');
  if (!root) return { toggle() {}, open() {}, close() {}, setBadges() {}, setChips() {} };
  root.innerHTML = '';

  const h = document.createElement('h2');
  h.textContent = '🗺️ לאן נטייל?';
  root.appendChild(h);

  const grid = document.createElement('div'); grid.className = 'grid';
  for (const d of DESTS) {
    const card = document.createElement('button');
    card.className = 'dest'; card.dataset.id = d.id;
    card.innerHTML = `<span class="ico">${d.ico}</span><span>${d.label}</span>`;
    card.addEventListener('click', () => { close(); onTravel(d.id, d.kind); });
    grid.appendChild(card);
  }
  root.appendChild(grid);

  const back = document.createElement('button');
  back.className = 'close'; back.textContent = '✨ חזרה למשחק';
  back.addEventListener('click', () => close());
  root.appendChild(back);

  // a small badge on some cards (floo.js: 🔥 on the places with a Floo fireplace; the Floo itself is not map travel)
  function setBadges(ids, mark) {
    for (const c of grid.children) {
      const id = c.dataset.id; let b = c.querySelector('.badge');
      if (ids.includes(id)) { if (!b) { b = document.createElement('span'); b.className = 'badge'; c.appendChild(b); } b.textContent = mark; }
      else if (b) b.remove();
    }
  }
  // small teacher chips (roam.js: where each teacher is right now), top-right of a card; separate from the Floo badge
  // byId = { cardId: ['🐱', '🪶'], ... }; cards not listed lose their chips
  function setChips(byId) {
    if (!document.getElementById('mapChipsCss')) {
      const st = document.createElement('style'); st.id = 'mapChipsCss';
      st.textContent = '#map .dest .chips{position:absolute;top:4px;right:6px;display:flex;flex-wrap:wrap;gap:2px;max-width:60%;justify-content:flex-end;pointer-events:none}' +
        '#map .dest .chips i{font-style:normal;font-size:17px;line-height:1;background:rgba(255,236,170,.92);border-radius:12px;padding:2px 3px;box-shadow:0 1px 3px rgba(0,0,0,.5)}';
      document.head.appendChild(st);
    }
    for (const c of grid.children) {
      const list = byId[c.dataset.id] || []; let el = c.querySelector('.chips');
      if (!list.length) { if (el) el.remove(); continue; }
      if (!el) { el = document.createElement('span'); el.className = 'chips'; c.appendChild(el); }
      const html = list.map(e => '<i>' + e + '</i>').join('');
      if (el.innerHTML !== html) el.innerHTML = html;
    }
  }
  function open() { root.classList.add('on'); }
  function close() { root.classList.remove('on'); }
  function toggle() { root.classList.toggle('on'); }
  return { toggle, open, close, setBadges, setChips, isOpen: () => root.classList.contains('on') };
}
