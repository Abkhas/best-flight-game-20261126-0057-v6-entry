// radio.js — the radio log with a NAMED voice: POLAR CONTROL · IVY.
//
// Every line is a real event (a load, a gate, a decision, a touchdown), never
// filler, and every line is short enough to fit its box without truncating —
// the v5 polish lesson. The log keeps the last 4 lines.
const LINES = {
  LOAD: (s) => `POLAR 7 LOADED ${s.flight.cargoT.toFixed(1)} T — MANIFEST OK`,
  TAKEOFF: () => 'POLAR 7 AIRBORNE — GEAR UP, CLIMBING',
  GATE: () => 'IVY · GATE CLEAR — ON COURSE, KEEP HER STEADY',
  DROP: (s) => `IVY · DROP ON THE MARK — ${s.mission.deliveredT.toFixed(1)} T DOWN`,
  TOUCHDOWN: (s) => `POLAR 7 DOWN — SINK ${s.flight.touchSink.toFixed(1)} M/S, STRIP CLEAR`,
  UNLOAD: (s) => `IVY · CARGO SAFE — ${s.mission.deliveredT.toFixed(1)} T DELIVERED`,
  FUEL_DECISION: () => 'IVY · FUEL LOW — DIVERT OR PRESS ON, YOUR CALL',
  ICE_DECISION: () => 'IVY · ICING BUILDING — CLIMB OR DE-ICE, NOW',
  WHITEOUT: () => 'IVY · WHITEOUT IN 20 MIN — CENTRELINE, POLAR 7',
  DIVERT: () => 'POLAR 7 DIVERTING TO EUREKA — FUEL FIRST',
  PRESS_ON: () => 'POLAR 7 PRESSING ON — WATCH THE FUEL',
  CLIMB: () => 'POLAR 7 CLIMBING ABOVE THE ICING',
  DEICE: () => 'POLAR 7 DE-ICING — BOOTS ON, ICE SHEDDING',
  CRASH: () => 'IVY · POLAR 7 DOWN — SEND THE SLED TEAM',
  START: () => 'IVY · POLAR 7, EUREKA — MANIFEST READY, LOAD UP',
};

export function createRadio() {
  return { lines: [] };
}

export function radioSay(radio, key, s) {
  const fn = LINES[key];
  if (!fn) return;
  const text = fn(s);
  const who = text.startsWith('IVY') ? 'twr' : text.startsWith('POLAR 7') ? 'plt' : 'sys';
  radio.lines.push({ who, text });
  if (radio.lines.length > 4) radio.lines.shift();
}

export function radioSeed(radio) {
  radio.lines = [
    { who: 'twr', text: 'IVY · POLAR 7, EUREKA — MANIFEST READY' },
    { who: 'twr', text: 'IVY · WHITEOUT IN 20 MIN — CENTRELINE' },
    { who: 'plt', text: 'POLAR 7 · LOADING 4.2 T, STANDBY' },
  ];
}

export function renderRadio(radio, el) {
  el.innerHTML = '<div class="rhead">RADIO · POLAR CONTROL · IVY</div>' + radio.lines.map((l) =>
    `<div class="rline ${l.who}">${l.text}</div>`).join('');
}
