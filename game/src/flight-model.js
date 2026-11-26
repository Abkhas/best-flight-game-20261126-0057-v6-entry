// flight-model.js — the fixed-wing flight model for the heavy twin-turboprop
// freighter. One job: advance the flight state one step, honestly.
//
// The model is deliberately forgiving but real: speed follows throttle with
// lag, pitch sets climb angle, bank turns the aircraft, icing drags the
// airframe down, fuel burns with throttle, and a landing is scored on the
// actual sink, speed and centreline error at touchdown. Nothing is staged
// here — the capture harness flies through this model's own drive input,
// and the score comes from real events (load, takeoff, gate, touchdown,
// unload) in missions.js.
import { GEAR_HEIGHT, STRIP_HALF_W } from './state.js';

export const MAX_SPEED = 62; // m/s at full throttle, clean airframe (~120 kt)
export const STALL_SPEED = 19; // m/s: below this, airborne, the wing gives up
export const TAKEOFF_SPEED = 24; // m/s: rotate speed on the ice strip

// The two ice strips, in world metres. Eureka (base) at z = 0, Alert at z = -2560.
// Each strip is 300 m long, 24 m wide, centred on x = 0.
export const STRIPS = {
  EUREKA: { name: 'EUREKA', z: 0, zMin: -150, zMax: 150 },
  ALERT: { name: 'ALERT STATION', z: -2560, zMin: -2710, zMax: -2410 },
};

export function stripAt(x, z) {
  for (const k of Object.keys(STRIPS)) {
    const st = STRIPS[k];
    if (Math.abs(x) <= STRIP_HALF_W && z >= st.zMin && z <= st.zMax) return st;
  }
  return null;
}

// Terrain height in metres: flat sea ice inside the strait (|x| < 150), then
// fjord walls rising steeply to 120 m. Landing on the walls is a crash.
export function groundHeight(x, z) {
  const ax = Math.abs(x);
  if (ax <= 150) return 0;
  if (ax >= 300) return 120;
  const t = (ax - 150) / 150;
  return 120 * t * t;
}

export function createDrive() {
  return { pitch: 0, bank: 0, yaw: 0, throttle: 0 };
}

// drive: { pitch, bank, yaw, throttle } each in [-1, 1], throttle in [0, 1]
// (throttle is a delta: the harness / keyboard nudges it, the model holds it).
export function stepFlight(s, drive, dt) {
  const f = s.flight;
  const m = s.mission;
  if (f.crashed || s.ui.frozen) return;
  f.time += dt;

  // --- throttle: W/S (or the drive) moves it, the model holds it ---
  f.throttle = Math.max(0, Math.min(1, f.throttle + drive.throttle * dt * 0.9));

  // --- gust: a slow crosswind that pushes the freighter sideways ---
  f.gust = 2.2 * Math.sin(f.time * 0.31) + 1.4 * Math.sin(f.time * 0.83 + 1.7);

  // --- icing: builds in the whiteout band (above 55 m, north of z = -200),
  //     slower with de-ice boots fitted ---
  const inWhiteout = f.y > 55 && f.z < -200;
  const iceRate = s.mission.refits.boots ? 0.35 : 0.8;
  if (inWhiteout && !f.onGround) f.icing = Math.min(100, f.icing + iceRate * dt);
  else if (f.icing > 0) f.icing = Math.max(0, f.icing - 0.25 * dt);

  // --- speed: chases throttle * max, dragged down by icing and cargo ---
  const iceDrag = 1 - f.icing / 100 * 0.35;
  const loadDrag = 1 - f.cargoT * 0.012;
  const target = f.throttle * MAX_SPEED * iceDrag * loadDrag * (1 - f.flaps * 0.08);
  const rate = f.onGround ? 0.55 : 0.4;
  f.speed += (target - f.speed) * Math.min(1, rate * dt);
  if (f.onGround && f.throttle < 0.15) f.speed = Math.max(0, f.speed - 6 * dt);

  // --- pitch / bank: the stick sets angles, the angles set the motion ---
  const pitchTarget = drive.pitch * 0.24; // +/- ~14 deg
  const bankTarget = drive.bank * 0.61; // +/- ~35 deg
  f.pitch += (pitchTarget - f.pitch) * Math.min(1, 3.5 * dt);
  f.bank += (bankTarget - f.bank) * Math.min(1, 3.5 * dt);
  // coordinated turn: bank rolls the heading; rudder (yaw) nudges it too
  const turnRate = f.speed > 2 ? (-9.81 * Math.tan(f.bank)) / Math.max(f.speed, 8) : 0;
  f.heading += (turnRate + drive.yaw * 0.35) * dt;

  // --- vertical: climb angle from pitch; stall sinks; ground stops the fall ---
  let vy = 0;
  if (!f.onGround) {
    vy = Math.sin(f.pitch) * f.speed;
    if (f.speed < STALL_SPEED) vy -= (STALL_SPEED - f.speed) * 0.55;
    if (f.icing > 55) vy -= (f.icing - 55) * 0.02;
    vy = Math.max(vy, -9);
  }
  f.vy = vy;

  // --- integrate: forward along the heading, sideways from the gust ---
  const fh = Math.sin(f.heading), fz = -Math.cos(f.heading);
  const rh = Math.cos(f.heading), rz = Math.sin(f.heading);
  f.x += (fh * f.speed + rh * f.gust * 0.35) * dt;
  f.z += (fz * f.speed + rz * f.gust * 0.35) * dt;
  if (!f.onGround) f.y += vy * dt;

  // --- takeoff: rotate speed + pitch up lifts off the ice ---
  if (f.onGround && f.speed >= TAKEOFF_SPEED && f.pitch > 0.04) {
    f.onGround = false;
    f.y = GEAR_HEIGHT + 0.4;
  }

  // --- touchdown / crash ---
  const gh = groundHeight(f.x, f.z);
  if (!f.onGround && f.y <= GEAR_HEIGHT && vy <= 0) {
    const strip = stripAt(f.x, f.z);
    if (gh > 2) {
      crash(s, 'TERRAIN — FJORD WALL');
    } else if (strip && f.gear) {
      land(s, strip, vy);
    } else if (f.gear) {
      // rough ice landing off the strip: survivable, costs airframe, no score
      f.onGround = true;
      f.y = GEAR_HEIGHT;
      f.vy = 0;
      f.touchSink = Math.abs(vy);
      f.airframe = Math.max(0, f.airframe - 10);
      recordIncident(s, `ROUGH ICE LANDING OFF STRIP — SINK ${Math.abs(vy).toFixed(1)} M/S, AIRFRAME ${Math.floor(f.airframe)}%`);
    } else {
      crash(s, 'GEAR-UP LANDING ON THE ICE');
    }
  }
  if (!f.onGround && f.y <= gh + 0.5 && gh > 2) crash(s, 'TERRAIN — FJORD WALL');

  // --- rolling on the ice: drag + steering ---
  if (f.onGround) {
    f.y = GEAR_HEIGHT;
    f.vy = 0;
    f.pitch *= 0.8;
    f.bank *= 0.8;
    if (f.throttle < 0.3) f.speed = Math.max(0, f.speed - 4 * dt);
  }

  // --- fuel: burns with throttle; extra tanks halve the burn ---
  const burn = f.throttle * (m.refits.tanks ? 0.45 : 0.9);
  f.fuel = Math.max(0, f.fuel - burn * dt);
  if (m.iceDecision === 'CLIMB') f.fuel = Math.max(0, f.fuel - 0.12 * dt);
  f.engTemp = 58 + f.throttle * 34 + f.icing * 0.12;

  // --- storm clock + flight clock ---
  if (!f.onGround || f.speed > 1) {
    m.stormLeft = Math.max(0, m.stormLeft - dt);
    s.save.flightSeconds += dt;
    if (s.save.flightSeconds >= 60) { s.save.flightMinutes += 1; s.save.flightSeconds -= 60; }
  }
  if (m.stormLeft <= 0 && !m.stormFailed) {
    m.stormFailed = true;
    recordIncident(s, 'WHITEOUT CLOSED THE STRAIT — AIRCRAFT NOT DOWN IN TIME');
  }

  // --- recorder sample (every ~0.5 s) ---
  const rec = s.recorder;
  if (rec.samples.length === 0 || f.time - rec.samples[rec.samples.length - 1].t >= 0.5) {
    rec.samples.push({ t: f.time, alt: Math.round(f.y * 3.28084), spd: Math.round(f.speed * 1.94384) });
    if (rec.samples.length > rec.maxSamples) rec.samples.shift();
  }
  if (f.icing > 70 && !rec._iceWarned) { rec._iceWarned = true; recordIncident(s, `ICING ${Math.floor(f.icing)}% — WINGS LOSING LIFT`); }
  if (f.icing < 60) rec._iceWarned = false;
  if (f.fuel < 20 && !rec._fuelWarned) { rec._fuelWarned = true; recordIncident(s, `FUEL ${Math.floor(f.fuel)}% — BINGO, DIVERT OR PRESS ON`); }
  if (f.fuel > 25) rec._fuelWarned = false;
}

function land(s, strip, vy) {
  const f = s.flight;
  f.onGround = true;
  f.y = GEAR_HEIGHT;
  f.touchSink = Math.abs(vy);
  f.touchSpeed = f.speed;
  f.touchOff = Math.abs(f.x);
  f.touchFlare = Math.round((f.pitch * 180) / Math.PI);
  // metres past the near threshold of the strip (a real landing metric:
  // the flare angle is negative on a descending final, so it reads wrong)
  f.touchDist = Math.round(Math.min(Math.abs(f.z - strip.zMin), Math.abs(f.z - strip.zMax)));
  f.vy = 0;
  if (f.touchSink > 4.5) {
    f.airframe = Math.max(0, f.airframe - 20);
    recordIncident(s, `HARD LANDING ${strip.name} — SINK ${f.touchSink.toFixed(1)} M/S, AIRFRAME ${Math.floor(f.airframe)}%`);
  }
}

function crash(s, why) {
  const f = s.flight;
  f.crashed = true;
  f.onGround = true;
  f.speed = 0;
  recordIncident(s, `CRASH — ${why}`);
}

export function recordIncident(s, text) {
  s.recorder.incidents.push(text);
  if (s.recorder.incidents.length > 6) s.recorder.incidents.shift();
}
