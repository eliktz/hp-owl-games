// Book 3 ("האסיר מאזקבאן"), chapters 5-6 (chapters 3-4 are adventure-b3-map.js and adventure-b3-patronus.js): "בקרוב" cards in the 📖 book until their pieces land
// (briefs/2026-11-26-book3-azkaban-quests.md: piece B = the map + the Patronus, piece C = the Time-Turner + the finale).
// A card with soon: true never starts and never unlocks anything; its id is reserved so old saves stay valid later.
export const B3TIMETURNER = { id: 'b3-timeturner', book: 3, soon: true, title: 'מחזיר הזמן', ico: '⏳', col: '#4a3a10', col2: '#e8c860',
  pic: [['⏳', 0.5, 0.56, 66], ['✨', 0.2, 0.3, 30], ['🔄', 0.8, 0.3, 28]] };
export const B3SAVE = { id: 'b3-save', book: 3, soon: true, title: 'מצילים את אבזם וסיריוס', ico: '🦅', col: '#2a3a2a', col2: '#9ac8a0',
  pic: [['🦅', 0.36, 0.56, 58], ['🐕', 0.72, 0.62, 44], ['⭐', 0.8, 0.26, 26]] };
