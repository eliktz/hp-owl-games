// Book 3 ("האסיר מאזקבאן"), chapters 3-6: "בקרוב" cards in the 📖 book until their pieces land
// (briefs/2026-11-26-book3-azkaban-quests.md: piece B = the map + the Patronus, piece C = the Time-Turner + the finale).
// A card with soon: true never starts and never unlocks anything; its id is reserved so old saves stay valid later.
export const B3MAP = { id: 'b3-map', book: 3, soon: true, title: 'מפת הטרדנים', ico: '🗺️', col: '#4a3418', col2: '#d8b878',
  pic: [['🗺️', 0.5, 0.56, 66], ['👣', 0.22, 0.3, 28], ['🍬', 0.8, 0.3, 28]] };
export const B3PATRONUS = { id: 'b3-patronus', book: 3, soon: true, title: 'אקספקטו פטרונום', ico: '🦌', col: '#1a2a4a', col2: '#9ab8e8',
  pic: [['🦌', 0.5, 0.56, 66], ['✨', 0.2, 0.3, 30], ['🌙', 0.8, 0.28, 28]] };
export const B3TIMETURNER = { id: 'b3-timeturner', book: 3, soon: true, title: 'מחזיר הזמן', ico: '⏳', col: '#4a3a10', col2: '#e8c860',
  pic: [['⏳', 0.5, 0.56, 66], ['✨', 0.2, 0.3, 30], ['🔄', 0.8, 0.3, 28]] };
export const B3SAVE = { id: 'b3-save', book: 3, soon: true, title: 'מצילים את אבזם וסיריוס', ico: '🦅', col: '#2a3a2a', col2: '#9ac8a0',
  pic: [['🦅', 0.36, 0.56, 58], ['🐕', 0.72, 0.62, 44], ['⭐', 0.8, 0.26, 26]] };
