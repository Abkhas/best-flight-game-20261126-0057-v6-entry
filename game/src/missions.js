// missions.js — the 4-leg campaign, the manifest, the scoring rules and the
// decisions. One job: turn flown events into score, progress and debrief.
//
// Scoring (single source of truth — every point is added here, and only here):
//   LOAD +1000 · TAKEOFF +2000 · GATE +3000 · TOUCHDOWN SOFT +5000 (hard +2500)
//   DROP +4000 · UNLOAD +4000. A clean leg totals 15,000. Cargo pods add +500
//   on every unload. Stars: 1 per leg flown + 1 soft touchdown + 1 fuel left
//   above 40% at unload — 3 per leg, 12 in the campaign.
//
// Legs (a campaign, not one loop — each leg has a different goal):
//   1 STATION RESUPPLY — 4.2 t food + fuel drums, Eureka -> Alert Station
//   2 MEDEVAC PICKUP  — Dr Elin Voss, frostbite, Alert -> Eureka, short strip
//   3 FUEL CACHE RUN  — 3.0 t fuel drums dropped by parachute over Gris Fjord
//   4 AURORA SCIENCE DROP — 4.0 t science pod released over Alexandra Fiord
// Total cargo 12.0 t. The whiteout closes the strait in 18:00 — any aircraft
// not down when it hits is lost.
import { STRIPS } from './flight-model.js';
import { recordIncident } from './flight-model.js';

export const LEGS = [
  {
    n: 1, name: 'STATION RESUPPLY', from: 'EUREKA', to: 'ALERT STATION',
    cargo: 4.2, cargoLabel: 'FOOD + FUEL DRUMS', kind: 'land',
    goal: 'Deliver 4.2 t before the whiteout',
    meta: '4.2 T · WHITEOUT 18:00 · STRIP 09',
    dir: -1, gateZ: -1280, strip: STRIPS.ALERT, dropZ: null,
  },
  {
    n: 2, name: 'MEDEVAC PICKUP', from: 'ALERT STATION', to: 'EUREKA',
    cargo: 0.8, cargoLabel: 'DR ELIN VOSS + MED KIT', kind: 'land',
    goal: 'Fly the frostbite case out fast',
    meta: '0.8 T · SHORT STRIP · STORM BEHIND',
    dir: 1, gateZ: -1280, strip: STRIPS.EUREKA, dropZ: null,
  },
  {
    n: 3, name: 'FUEL CACHE RUN', from: 'EUREKA', to: 'GRIS FJORD CACHE',
    cargo: 3.0, cargoLabel: 'FUEL DRUMS × 12', kind: 'drop',
    goal: 'Drop the drums on the cache, land light',
    meta: '3.0 T · PARACHUTE DROP · LAND LIGHT',
    dir: -1, gateZ: -1280, strip: STRIPS.ALERT, dropZ: -1920,
  },
  {
    n: 4, name: 'AURORA SCIENCE DROP', from: 'ALERT STATION', to: 'ALEXANDRA FIORD',
    cargo: 4.0, cargoLabel: 'SCIENCE POD · MAGNETOMETER', kind: 'drop',
    goal: 'Release the pod over the ice cap',
    meta: '4.0 T · PRECISE RELEASE · KP 6',
    dir: 1, gateZ: -1280, strip: STRIPS.EUREKA, dropZ: -2080,
  },
];

export const SCORE = {
  LOAD: 1000, TAKEOFF: 2000, GATE: 3000,
  TOUCHDOWN_SOFT: 5000, TOUCHDOWN_HARD: 2500,
  DROP: 4000, UNLOAD: 4000, POD_BONUS: 500,
};

export function legOf(s) { return LEGS[s.mission.leg - 1]; }
export function destStrip(s) { return legOf(s).strip; }
export function homeStrip(s) {
  return legOf(s).dir === -1 ? STRIPS.EUREKA : STRIPS.ALERT;
}

export function addScore(s, n, why) {
  s.save.score += n;
  s.mission.legScore += n;
  if (s.save.score > s.save.best) s.save.best = s.save.score;
  return why;
}

export function startLeg(s, n) {
  const m = s.mission, f = s.flight;
  m.leg = n;
  m.phase = 'load';
  m.gatePassed = false;
  m.divert = false;
  m.fuelDecision = null;
  m.iceDecision = null;
  m.legScore = 0;
  const leg = LEGS[n - 1];
  const home = leg.dir === -1 ? STRIPS.EUREKA : STRIPS.ALERT;
  f.x = 0; f.z = home.z; f.y = 0.6;
  f.heading = leg.dir === -1 ? 0 : Math.PI;
  f.speed = 0; f.throttle = 0; f.pitch = 0; f.bank = 0; f.vy = 0;
  f.onGround = true; f.crashed = false; f.cargoT = 0; f.gear = true;
  // Fuel: Eureka is the base and refuels to full. Alert is a remote station
  // with no fuel bowser — the fuel drums ARE the cargo — so a leg out of
  // Alert flies on whatever the tank holds. That is the BINGO-fuel drama:
  // leg 2, the return leg, is flown on a half tank.
  if (leg.dir === -1) f.fuel = 100;
  f.icing = 0; // de-iced on the ground between legs; airframe damage carries
  s.ui.moment = '';
  s.ui.decision = null;
}

// The phase machine, called every frame from main.js. Real events only:
// the phase changes when the flight state actually satisfies it.
export function updateMission(s) {
  const m = s.mission, f = s.flight;
  const leg = legOf(s);
  if (m.phase === 'takeoff' && !f.onGround) {
    m.phase = 'fly';
    addScore(s, SCORE.TAKEOFF, 'AIRBORNE');
    s.ui.msg = 'AIRBORNE ✓ +2000';
  }
  if (m.phase === 'fly' && !m.gatePassed) {
    const d = Math.abs(f.z - leg.gateZ);
    if (d < 25 && Math.abs(f.x) < 30 && !f.onGround) {
      m.gatePassed = true;
      addScore(s, SCORE.GATE, 'GATE');
      s.ui.msg = 'GATE ✓ ON COURSE +3000';
      s.ui.moment = 'GATE ✓ ON COURSE';
    }
  }
  if (m.phase === 'fly' && m.gatePassed) {
    if (leg.kind === 'drop') m.phase = 'drop';
    else m.phase = 'land';
  }
  if (m.phase === 'drop') {
    const d = Math.abs(f.z - leg.dropZ);
    if (d < 40 && !f.onGround) s.ui.msg = 'DROP ZONE — PRESS SPACE';
  }
  if (m.phase === 'land') {
    const st = destStrip(s);
    const d = Math.abs(f.z - st.z);
    if (d < 320 && !f.onGround) s.ui.msg = `FINAL — ${st.name} STRIP 09 · ${Math.round(d * 3.28)} FT`;
  }
  // decisions: fuel first, then icing — one banner at a time
  if (!f.onGround && !m.fuelDecision && f.fuel < 45 && !m.divert) {
    s.ui.decision = 'fuel';
  } else if (!f.onGround && !m.iceDecision && f.icing > 40) {
    s.ui.decision = 'ice';
  } else if (f.onGround) {
    s.ui.decision = null;
  }
}

export function legStatusText(s) {
  const m = s.mission;
  const leg = legOf(s);
  const phaseNames = {
    load: 'LOAD CARGO', takeoff: 'TAKE OFF', fly: 'FLY THE LEG',
    drop: 'DROP THE CARGO', land: 'LAND ON THE ICE STRIP', unload: 'UNLOAD', done: 'LEG DONE',
  };
  return `LEG ${leg.n} OF 4 · ${leg.name} — ${phaseNames[m.phase] || ''}`;
}

// SPACE on the ground at the home strip loads the manifest; at the
// destination strip unloads it; in the drop zone releases the cargo.
export function pressSpace(s) {
  const m = s.mission, f = s.flight;
  const leg = legOf(s);
  if (m.phase === 'load' && f.onGround) {
    f.cargoT = leg.cargo;
    m.phase = 'takeoff';
    addScore(s, SCORE.LOAD, 'LOADED');
    s.ui.msg = `LOADED ${leg.cargo.toFixed(1)} T ✓ +1000`;
    s.ui.moment = `LOADED ${leg.cargo.toFixed(1)} T ✓`;
    return 'loaded';
  }
  if (m.phase === 'drop' && !f.onGround && Math.abs(f.z - leg.dropZ) < 40) {
    const t = f.cargoT;
    f.cargoT = 0;
    m.deliveredT = Math.round((m.deliveredT + t) * 10) / 10;
    m.phase = 'land';
    addScore(s, SCORE.DROP, 'DROPPED');
    s.ui.msg = `DROP ✓ ${t.toFixed(1)} T ON THE CACHE +4000`;
    s.ui.moment = `DROP ✓ ${t.toFixed(1)} T ON TARGET`;
    recordIncident(s, `CARGO DROP ${leg.name} — ${t.toFixed(1)} T ON THE CACHE MARK`);
    return 'dropped';
  }
  if (m.phase === 'unload' && f.onGround) {
    const t = f.cargoT;
    f.cargoT = 0;
    m.deliveredT = Math.round((m.deliveredT + t) * 10) / 10;
    let bonus = 0;
    if (m.refits.pods) bonus = SCORE.POD_BONUS;
    addScore(s, SCORE.UNLOAD + bonus, 'DELIVERED');
    s.save.deliveries += 1;
    s.save.legsFlown += 1;
    if (m.refitPoints < 3) m.refitPoints += 1;
    const soft = f.touchSink <= 3.0;
    const fuelOk = f.fuel > 40;
    const stars = 1 + (soft ? 1 : 0) + (fuelOk ? 1 : 0);
    m.stars += stars;
    s.save.stars += stars;
    m.lastLeg = {
      name: leg.name, score: m.legScore,
      sink: f.touchSink, speed: f.touchSpeed, off: f.touchOff, flare: f.touchFlare, dist: f.touchDist,
      fuelLeft: Math.floor(f.fuel), icing: Math.floor(f.icing),
      stars, delivered: m.deliveredT, soft, fuelOk,
    };
    m.phase = 'done';
    s.ui.msg = `DELIVERED ✓ ${t.toFixed(1)} T +4000${bonus ? ' +500 PODS' : ''}`;
    s.ui.moment = `TOUCHDOWN ✓ ${t.toFixed(1)} T DELIVERED`;
    return 'unloaded';
  }
  return null;
}

// Touchdown is called by the flight model through this hook (main.js wires
// it): a real landing on the destination strip scores, a hard one costs.
export function onTouchdown(s) {
  const m = s.mission, f = s.flight;
  const leg = legOf(s);
  if (m.phase !== 'land' && m.phase !== 'fly') return;
  const st = destStrip(s);
  if (Math.abs(f.z - st.z) > 160) return; // not on the destination strip
  const soft = f.touchSink <= 3.0;
  addScore(s, soft ? SCORE.TOUCHDOWN_SOFT : SCORE.TOUCHDOWN_HARD, 'TOUCHDOWN');
  m.phase = 'unload';
  s.ui.msg = soft
    ? `TOUCHDOWN ✓ SOFT ${f.touchSink.toFixed(1)} M/S +5000`
    : `TOUCHDOWN — HARD ${f.touchSink.toFixed(1)} M/S +2500`;
  s.ui.moment = soft ? 'TOUCHDOWN ✓ SOFT LANDING' : 'TOUCHDOWN — HARD';
}

// Decisions, answered on the real input path (keys 1 / 2).
export function answerDecision(s, key) {
  const m = s.mission, f = s.flight;
  if (s.ui.decision === 'fuel') {
    if (key === '1') {
      m.divert = true; m.fuelDecision = 'DIVERT';
      s.save.stormDecision = 'DIVERT';
      s.ui.msg = 'DIVERTING TO EUREKA — FUEL FIRST';
      s.ui.decision = null;
      recordIncident(s, 'FUEL DECISION — DIVERTED TO EUREKA, LEG ABANDONED');
    } else if (key === '2') {
      m.fuelDecision = 'PRESS ON'; s.save.stormDecision = 'PRESS ON';
      s.ui.msg = 'PRESSING ON — WATCH THE FUEL';
      s.ui.decision = null;
    }
    return true;
  }
  if (s.ui.decision === 'ice') {
    if (key === '1') {
      m.iceDecision = 'CLIMB'; s.save.iceDecision = 'CLIMB';
      s.ui.msg = 'CLIMBING ABOVE THE ICING — FUEL BURNS';
      s.ui.decision = null;
      recordIncident(s, 'ICING DECISION — CLIMBED ABOVE IT, FUEL BURNING');
    } else if (key === '2') {
      m.iceDecision = 'DE-ICE'; s.save.iceDecision = 'DE-ICE';
      f.icing = 5; f.fuel = Math.max(0, f.fuel - 3);
      s.ui.msg = 'DE-ICE BOOTS ON — ICE SHEDDING';
      s.ui.decision = null;
    }
    return true;
  }
  return false;
}

// Turnaround pick-1-of-3: spend one refit point between legs.
export function buyRefit(s, which) {
  const m = s.mission;
  if (m.refitPoints < 1 || m.refits[which]) return false;
  m.refitPoints -= 1;
  m.refits[which] = true;
  return true;
}
export const REFITS = [
  { key: 'boots', name: 'DE-ICE BOOTS', desc: 'Icing builds half as fast' },
  { key: 'tanks', name: 'EXTRA FUEL TANKS', desc: 'Fuel burns half as fast' },
  { key: 'pods', name: 'CARGO PODS', desc: '+500 pts on every unload' },
];
