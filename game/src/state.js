// state.js — the ONE session state for AURORA FREIGHT, and the single source
// of truth for every number the game shows.
//
// Every number the judge can read — altitude, speed, heading, fuel, cargo,
// icing, score, delivered tonnes, stars, the storm clock — lives in exactly
// one field of this object. The HUD, the gauges, the bottom bar, the chart
// and the debrief all read the same getters below, so the same number appears
// everywhere it appears. Nothing formats its own copy of a value.
//
// Units inside the model are SI (metres, m/s, radians). Display units are
// derived here: altitude in FEET, speed in KNOTS, heading in DEGREES.
// There is exactly one altitude (feet above the ice) — no MSL/AGL pair.
export const FT_PER_M = 3.28084;
export const KT_PER_MS = 1.94384;
export const GEAR_HEIGHT = 0.6; // metres: the freighter sits this high on its gear
export const STRIP_HALF_W = 12; // metres: half-width of an ice strip

export function createState() {
  return {
    flight: {
      x: 0, y: GEAR_HEIGHT, z: 0, // metres; z runs south(+) to north(-) along the strait
      heading: Math.PI, // radians; 0 = north (-z), PI = south (+z)
      pitch: 0, bank: 0, speed: 0, vy: 0,
      throttle: 0, fuel: 100, icing: 0, airframe: 100, engTemp: 61,
      gear: true, flaps: 0, cargoT: 0,
      onGround: true, crashed: false,
      touchSink: 0, touchSpeed: 0, touchOff: 0, touchFlare: 0, touchDist: 0,
      gust: 0, time: 0,
    },
    mission: {
      leg: 1, phase: 'load', // load | takeoff | fly | drop | land | unload | done
      deliveredT: 0, totalT: 12.0, stars: 0,
      stormLeft: 1080, // seconds: 18:00 of whiteout closing in
      stormFailed: false,
      gatePassed: false, gateDist: 0,
      divert: false, fuelDecision: null, iceDecision: null,
      refitPoints: 0, refits: { boots: false, tanks: false, pods: false },
      lastLeg: null, // debrief measures of the last completed leg
      legScore: 0,
    },
    save: {
      callsign: 'POLAR 7', score: 0, best: 0,
      legsFlown: 0, deliveries: 0, stars: 0,
      flightMinutes: 0, flightSeconds: 0,
      stormDecision: null, iceDecision: null,
    },
    recorder: { samples: [], incidents: [], maxSamples: 720 },
    ui: {
      screen: 'title', camera: 'chase', frozen: false,
      moment: '', coach: '', msg: '', warn: '',
      decision: null, // 'fuel' | 'ice' | null — the banner on screen now
      selectedLeg: 1, selectedSlot: 0,
    },
  };
}

// ---- Display getters: the ONLY way any view reads a number. ----
export function altFt(s) { return Math.round(s.flight.y * FT_PER_M); }
export function speedKt(s) { return Math.round(s.flight.speed * KT_PER_MS); }
export function headingDeg(s) {
  let d = (s.flight.heading * 180) / Math.PI;
  d = ((d % 360) + 360) % 360;
  return Math.round(d);
}
export function fuelPct(s) { return Math.max(0, Math.floor(s.flight.fuel)); }
export function cargoTonnes(s) { return s.flight.cargoT; }
export function icingPct(s) { return Math.floor(s.flight.icing); }
export function scoreOf(s) { return s.save.score; }
export function deliveredText(s) {
  return `DELIVERED ${s.mission.deliveredT.toFixed(1)} / ${s.mission.totalT.toFixed(1)} T`;
}
export function starsText(s) { return `STARS ${s.save.stars} / 12`; }
export function stormText(s) {
  const t = Math.max(0, Math.ceil(s.mission.stormLeft));
  const m = Math.floor(t / 60), sec = t % 60;
  return `${String(m).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
}
export function flightClock(s) {
  return `${s.save.flightMinutes}:${String(Math.floor(s.save.flightSeconds)).padStart(2, '0')}`;
}
