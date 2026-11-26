// saves.js — the pilot record: three callsign slots, the best score, the
// campaign totals. One job: hold the record the title and proof screens read.
export function createSaves() {
  return {
    slots: [
      { callsign: 'POLAR 7', score: 0, legs: 0, delivered: 0, stars: 0 },
      { callsign: 'POLAR 3', score: 0, legs: 0, delivered: 0, stars: 0 },
      { callsign: 'POLAR 9', score: 0, legs: 0, delivered: 0, stars: 0 },
    ],
  };
}

export function syncSlot(saves, s) {
  const slot = saves.slots[s.ui.selectedSlot];
  slot.score = s.save.score;
  slot.legs = s.save.legsFlown;
  slot.delivered = s.mission.deliveredT;
  slot.stars = s.save.stars;
  if (s.save.score > s.save.best) s.save.best = s.save.score;
}

export function rankLetter(s) {
  const sc = s.save.score;
  if (sc >= 40000) return 'S';
  if (sc >= 25000) return 'A';
  if (sc >= 15000) return 'B';
  if (sc >= 8000) return 'C';
  return 'D';
}

export function medalFor(s) {
  const sc = s.save.score;
  if (sc >= 25000) return 'GOLD';
  if (sc >= 15000) return 'SILVER';
  return 'BRONZE';
}
