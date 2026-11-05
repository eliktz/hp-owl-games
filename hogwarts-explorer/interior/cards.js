/* Chocolate-frog cards: a hidden collectible you find scattered through the castle. Each
 * card is an ORIGINAL whimsical "famous wizard" archetype (generic emoji face + Hebrew
 * name + a power icon — no ripped art). Finding one chimes, pops a card banner and tucks
 * it into a collection screen (the 🃏 button, bottom-left). Progress persists in
 * localStorage. Self-contained like the map/lessons: owns its own DOM + window.HPICards. */
(function () {
  const T = window.THREE;

  // the deck: 9 cards → a tidy 3×3 collection grid
  const CATALOG = [
    { id: 'merlin', e: '🧙‍♂️', n: 'מֶרְלִין', fact: '🪄' },
    { id: 'star', e: '🌟', n: 'כּוֹכֶבֶת', fact: '🔭' },
    { id: 'owl', e: '🦉', n: 'חַכְמוֹן', fact: '📚' },
    { id: 'dragon', e: '🐉', n: 'שׁוֹמֶרֶת הַדְּרָקוֹן', fact: '🔥' },
    { id: 'potion', e: '🧪', n: 'מָאֶסְטְרוֹ', fact: '⚗️' },
    { id: 'cat', e: '🐱', n: 'גְּבִירַת הֶחָתוּל', fact: '✨' },
    { id: 'herb', e: '🌿', n: 'יֶרֶק־אֶצְבַּע', fact: '🪴' },
    { id: 'broom', e: '🧹', n: 'אַלּוּף הַמָּטְאֲטֵא', fact: '🏆' },
    { id: 'ghost', e: '👻', n: 'רוּחַ טוֹבָה', fact: '🏰' },
  ];
  const byId = {}; CATALOG.forEach((c) => (byId[c.id] = c));

  // ---- persisted found-set ----
  const KEY = 'hpCards1';
  let found = new Set();
  try { found = new Set(JSON.parse(localStorage.getItem(KEY) || '[]')); } catch (e) {}
  function save() { try { localStorage.setItem(KEY, JSON.stringify([...found])); } catch (e) {} }

  const HPC = (window.HPICards = { CATALOG });
  HPC.has = (id) => found.has(id);
  HPC.count = () => found.size;
  HPC.total = () => CATALOG.length;

  // ---- card face as a canvas (used for the 3D pickup mesh) ----
  function cardCanvas(card) {
    const c = document.createElement('canvas'); c.width = 256; c.height = 358; const g = c.getContext('2d');
    g.fillStyle = '#2a1b5e'; g.fillRect(0, 0, 256, 358);
    g.fillStyle = '#1b1140'; g.fillRect(14, 14, 228, 330);
    g.strokeStyle = '#ffd76a'; g.lineWidth = 10; g.strokeRect(10, 10, 236, 338);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.font = '130px serif'; g.fillText(card.e, 128, 150);
    g.font = 'bold 34px Rubik,Arial,sans-serif'; g.fillStyle = '#ffe9a8'; g.fillText(card.n, 128, 258);
    g.font = '46px serif'; g.fillText(card.fact, 128, 312);
    return c;
  }

  // ---- 3D pickup mesh: a glowing card standing in the room ----
  HPC.mesh = function (card) {
    const g = new T.Group();
    const tex = new T.CanvasTexture(cardCanvas(card)); tex.anisotropy = 2;
    const face = new T.Mesh(new T.PlaneGeometry(0.92, 1.28),
      new T.MeshBasicMaterial({ map: tex, transparent: true, side: T.DoubleSide, fog: false }));
    face.position.y = 1.05; g.add(face);
    const glow = new T.Sprite(new T.SpriteMaterial({ map: HP.glowTex, color: 0xffd76a, transparent: true, opacity: 0.55, depthWrite: false, blending: T.AdditiveBlending, fog: false }));
    glow.scale.set(2.6, 2.6, 1); glow.position.y = 1.05; g.add(glow);
    g.userData.card = card;
    return g;
  };

  // ---- collecting one: returns true if it's new ----
  HPC.collect = function (id) {
    if (found.has(id)) return false;
    found.add(id); save(); refreshBtn(); popup(byId[id]);
    return true;
  };

  // ---- CSS ----
  const style = document.createElement('style');
  style.textContent = `
  #cardBtn{position:fixed;left:calc(14px + env(safe-area-inset-left));top:calc(180px + env(safe-area-inset-top));
    width:72px;height:72px;border-radius:50%;border:4px solid #ffd76a;background:rgba(40,25,90,.72);color:#fff;
    font-size:34px;z-index:11;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 14px rgba(0,0,0,.4);
    touch-action:none;-webkit-tap-highlight-color:transparent}
  #cardBtn:active{transform:scale(.9)}
  #cardBtn .cb{position:absolute;top:-4px;inset-inline-end:-4px;background:#7CFC7C;color:#13351a;font-size:14px;font-weight:bold;
    min-width:22px;height:22px;border-radius:12px;border:2px solid #13351a;display:flex;align-items:center;justify-content:center;padding:0 3px}
  #cardsOv{position:fixed;inset:0;z-index:31;display:none;align-items:center;justify-content:center;
    background:radial-gradient(ellipse at center,rgba(30,20,80,.55),rgba(5,3,25,.85));font-family:'Rubik',sans-serif}
  #cardsOv.on{display:flex}
  .cpanel{background:rgba(40,25,90,.95);border:5px solid #ffd76a;border-radius:28px;padding:20px 18px 24px;
    max-width:min(94vw,600px);max-height:92vh;overflow:auto;box-shadow:0 10px 40px rgba(0,0,0,.6)}
  .ctitle{text-align:center;color:#ffd76a;font-size:34px;font-weight:bold;margin:0 0 4px;text-shadow:0 3px 0 #7a3b00}
  .csub{text-align:center;color:#cbbce8;font-size:20px;margin:0 0 14px}
  .cgrid{display:grid;grid-template-columns:repeat(3,1fr);gap:12px}
  .ccard{aspect-ratio:.72;border-radius:16px;border:3px solid rgba(255,215,106,.35);background:rgba(20,12,50,.6);
    display:flex;flex-direction:column;align-items:center;justify-content:center;gap:3px;padding:6px;
    filter:grayscale(1) brightness(.5);transition:all .25s}
  .ccard .ce{font-size:min(13vw,52px);line-height:1}
  .ccard .cn{font-size:15px;color:#cbbce8;text-align:center;line-height:1.1}
  .ccard .cf{font-size:20px}
  .ccard.got{filter:none;border-color:#ffd76a;background:linear-gradient(#36226e,#241247);box-shadow:0 0 20px rgba(255,210,90,.45)}
  .ccard.got .cn{color:#ffe9a8}
  .cclose{display:block;margin:18px auto 0;padding:10px 40px;border-radius:40px;border:4px solid #fff;
    background:linear-gradient(#ffe48a,#ffb020);color:#7a3b00;font-size:28px;font-weight:bold;cursor:pointer;font-family:inherit}
  #cardPop{position:fixed;left:50%;top:26%;transform:translate(-50%,-50%) scale(0);z-index:45;pointer-events:none;
    text-align:center;background:rgba(32,20,70,.96);border:4px solid #ffd76a;border-radius:22px;padding:14px 22px;
    color:#fff;box-shadow:0 10px 36px rgba(0,0,0,.6);transition:transform .45s cubic-bezier(.3,1.7,.5,1)}
  #cardPop.on{transform:translate(-50%,-50%) scale(1)}
  #cardPop .pe{font-size:68px;line-height:1} #cardPop .pt{font-size:24px;color:#ffe9a8;font-weight:bold;margin-top:4px}
  #cardPop .pn{font-size:30px;color:#fff;font-weight:bold}`;
  document.head.appendChild(style);

  // ---- DOM: button, overlay grid, pickup popup ----
  let btn, ov, popEl;
  function mk(tag, id) { const e = document.createElement(tag); if (id) e.id = id; return e; }
  function build() {
    btn = mk('button', 'cardBtn'); btn.innerHTML = '🃏<span class="cb">0</span>'; btn.title = 'אוסף הכרטיסים';
    btn.addEventListener('click', (e) => { e.stopPropagation(); open(); });
    document.body.appendChild(btn);
    ov = mk('div', 'cardsOv'); document.body.appendChild(ov);
    ov.addEventListener('pointerdown', (e) => { e.stopPropagation(); if (e.target === ov) close(); });
    popEl = mk('div', 'cardPop'); document.body.appendChild(popEl);
    refreshBtn();
  }
  function refreshBtn() { if (btn) btn.querySelector('.cb').textContent = found.size; }

  function render() {
    const p = mk('div'); p.className = 'cpanel';
    p.innerHTML = '<div class="ctitle">🃏 כרטיסי שוקולד</div><div class="csub">' + found.size + ' / ' + CATALOG.length + '</div>';
    const grid = mk('div'); grid.className = 'cgrid';
    CATALOG.forEach((c) => {
      const got = found.has(c.id);
      const d = mk('div'); d.className = 'ccard' + (got ? ' got' : '');
      d.innerHTML = '<div class="ce">' + (got ? c.e : '❓') + '</div><div class="cn">' + (got ? c.n : '???') + '</div><div class="cf">' + (got ? c.fact : '') + '</div>';
      grid.appendChild(d);
    });
    p.appendChild(grid);
    const close = mk('button'); close.className = 'cclose'; close.textContent = 'סגור';
    close.addEventListener('click', (e) => { e.stopPropagation(); close2(); });
    p.appendChild(close);
    ov.innerHTML = ''; ov.appendChild(p);
  }
  function open() { if (popEl) popEl.classList.remove('on'); render(); ov.classList.add('on'); setModal(true); try { HP.sfx.flip(); } catch (e) {} }
  function close2() { ov.classList.remove('on'); setModal(false); try { HP.sfx.pop(); } catch (e) {} }
  const close = close2;
  function setModal(v) { try { window.__game && __game.setModal && __game.setModal(v); } catch (e) {} }

  function popup(card) {
    if (!popEl || !card) return;
    popEl.innerHTML = '<div class="pe">' + card.e + '</div><div class="pt">כרטיס חדש!</div><div class="pn">' + card.n + '</div>';
    popEl.classList.add('on');
    try { HP.sfx.fanfare ? HP.sfx.fanfare() : HP.sfx.chime(); } catch (e) {}
    clearTimeout(popup._t); popup._t = setTimeout(() => popEl.classList.remove('on'), 2200);
  }

  // boot when the body + HP helpers are ready
  (function boot() {
    if (!document.body || !window.HP || !window.THREE) return void setTimeout(boot, 120);
    build();
  })();
})();
