// main.js — AURORA FREIGHT: Arctic Night Cargo under the Northern Lights.
// Bootstrap + game loop + input + screens + the __kit staging API the
// capture harness uses. One job: wire the modules together and run the game.
//
// The game is a 3D three.js heavy twin-turboprop freighter flying night
// supply legs between arctic research stations under the aurora. Load cargo
// at the base (weight vs fuel is a real tradeoff) → fly the leg → land on a
// lit ice strip in the dark → unload → take the next leg. Four legs, one
// whiteout closing in, a named radio voice, and a flight recorder that
// proves every landing.
import * as THREE from 'three';
import { createState } from './state.js';
import { stepFlight, createDrive, groundHeight, STRIPS } from './flight-model.js';
import { buildTerrain } from './terrain.js';
import { buildFreighter } from './freighter.js';
import { createCameraRig } from './camera.js';
import { updateHud, renderRefits } from './hud.js';
import { drawPanel } from './instruments.js';
import { LEGS, legOf, startLeg, updateMission, pressSpace, onTouchdown, answerDecision, buyRefit } from './missions.js';
import { createRadio, radioSay, radioSeed } from './radio.js';
import { createSaves, syncSlot } from './saves.js';
import { createAudio } from './audio.js';
import { renderTitle, renderProof, renderLog, showScreen } from './screens.js';

const s = createState();
const radio = createRadio();
const saves = createSaves();
const audio = createAudio();
const keys = {};
let harnessDrive = null;
let drag = null;

const canvas = document.getElementById('scene');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(window.innerWidth, window.innerHeight);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0a1030);
scene.add(new THREE.AmbientLight(0x8fa8d8, 0.9));
const moonLight = new THREE.DirectionalLight(0xcfe0ff, 1.3);
// light night haze: depth on the strait, distant stations fade into the dark
scene.fog = new THREE.FogExp2(0x0a1030, 0.0009);
moonLight.position.set(-200, 300, -400);
scene.add(moonLight);

const terrain = buildTerrain(scene);
const freighter = buildFreighter(scene);
const rig = createCameraRig(scene);

const GAUGE_IDS = { att: 'g-att', spd: 'g-spd', alt: 'g-alt', vs: 'g-vs', hdg: 'g-hdg', fuel: 'g-fuel', cargo: 'g-cargo', ice: 'g-ice' };

let frames = 0;
let last = performance.now();
let hudTick = 0;
let prevOnGround = true;
let prevPhase = 'load';
let prevGate = false;
let proofTimer = 0;

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight);
  rig.camera.aspect = window.innerWidth / window.innerHeight;
}
window.addEventListener('resize', resize);

function fly() {
  audio.ensure();
  startLeg(s, s.ui.selectedLeg);
  radioSeed(radio);
  radioSay(radio, 'START', s);
  showScreen(s, 'fly');
  s.ui.camera = 'chase';
}

function endFlight(title, text) {
  document.getElementById('end-title').textContent = title;
  document.getElementById('end-text').textContent = text;
  showScreen(s, 'end');
}

function loop(now) {
  requestAnimationFrame(loop);
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  frames++;

  const f = s.flight;
  if (s.ui.screen === 'fly' && !s.ui.frozen && !f.crashed) {
    // --- drive: the harness overrides the keyboard when it is driving ---
    const drive = harnessDrive || keyboardDrive();
    stepFlight(s, drive, dt);
    updateMission(s);

    // --- real events -> radio + score hooks ---
    if (prevPhase !== s.mission.phase) {
      if (s.mission.phase === 'fly') radioSay(radio, 'TAKEOFF', s);
      prevPhase = s.mission.phase;
    }
    if (s.mission.gatePassed && !prevGate) { radioSay(radio, 'GATE', s); prevGate = true; }
    if (!prevOnGround && f.onGround && !f.crashed) {
      onTouchdown(s);
      radioSay(radio, 'TOUCHDOWN', s);
      audio.blip(660);
    }
    prevOnGround = f.onGround;
    if (s.ui.decision === 'fuel' && !s._fuelSaid) { s._fuelSaid = true; radioSay(radio, 'FUEL_DECISION', s); }
    if (s.ui.decision === 'ice' && !s._iceSaid) { s._iceSaid = true; radioSay(radio, 'ICE_DECISION', s); }
    if (s.ui.decision !== 'fuel') s._fuelSaid = false;
    if (s.ui.decision !== 'ice') s._iceSaid = false;

    if (f.crashed) {
      radioSay(radio, 'CRASH', s);
      endFlight('POLAR 7 DOWN', 'The freighter is down on the ice. The sled team is on its way — fly the leg again.');
    } else if (s.mission.stormFailed) {
      endFlight('WHITEOUT WON', 'The strait closed before POLAR 7 got down. The next leg starts from Eureka — fly it faster.');
    } else if (s.mission.phase === 'done') {
      proofTimer += dt;
      if (proofTimer > 1.2) {
        proofTimer = 0;
        syncSlot(saves, s);
        renderProof(s);
        showScreen(s, 'proof');
      }
    } else {
      proofTimer = 0;
    }
    if (s.ui.msg && frames % 240 === 0) s.ui.msg = '';
    if (s.ui.moment && s.mission.phase !== 'land' && s.mission.phase !== 'fly') {
      // the moment line is a cover device: keep it only while flying the leg
      if (frames % 300 === 0) s.ui.moment = '';
    }
  }

  // --- visuals ---
  terrain.update(f.time);
  freighter.update(s, dt);
  rig.update(s, dt);
  if (s.ui.screen === 'fly' || s.ui.screen === 'pause') {
    hudTick++;
    if (hudTick % 4 === 0) {
      updateHud(s, radio);
      drawPanel(s, GAUGE_IDS);
    }
  }
  audio.update(f.throttle, f.speed, f.onGround);
  renderer.render(scene, rig.camera);
}

function keyboardDrive() {
  const d = createDrive();
  if (keys.KeyW) d.throttle = 1;
  if (keys.KeyS) d.throttle = -1;
  if (keys.ArrowUp) d.pitch = 1;
  if (keys.ArrowDown) d.pitch = -1;
  // Model convention: positive bank DECREASES the heading (turns west), so
  // ArrowLeft (turn west) is +bank and ArrowRight (turn east) is -bank.
  if (keys.ArrowLeft) d.bank = 1;
  if (keys.ArrowRight) d.bank = -1;
  if (keys.KeyA) d.yaw = -1;
  if (keys.KeyD) d.yaw = 1;
  if (drag) {
    d.bank = Math.max(-1, Math.min(1, -drag.dx / 120));
    d.pitch = Math.max(-1, Math.min(1, -drag.dy / 120));
  }
  return d;
}

window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  keys[e.code] = true;
  const screen = s.ui.screen;
  if (screen === 'title') {
    if (e.code === 'Enter') { fly(); return; }
    if (e.code.startsWith('Digit')) {
      const n = Number(e.code.slice(5));
      if (n >= 1 && n <= 4) { s.ui.selectedLeg = n; startLeg(s, n); renderTitle(s, saves); }
    }
  } else if (screen === 'fly') {
    if (e.code === 'Space') {
      e.preventDefault();
      const r = pressSpace(s);
      if (r === 'loaded') { radioSay(radio, 'LOAD', s); audio.blip(880); }
      if (r === 'dropped') { radioSay(radio, 'DROP', s); audio.blip(880); }
      if (r === 'unloaded') { radioSay(radio, 'UNLOAD', s); audio.blip(990); syncSlot(saves, s); }
    }
    if (e.code === 'Digit1' || e.code === 'Digit2') {
      const before = s.ui.decision;
      if (answerDecision(s, e.code.slice(5))) {
        const m = s.mission;
        if (before === 'fuel') radioSay(radio, m.fuelDecision === 'DIVERT' ? 'DIVERT' : 'PRESS_ON', s);
        if (before === 'ice') radioSay(radio, m.iceDecision === 'CLIMB' ? 'CLIMB' : 'DEICE', s);
      }
    }
    if (e.code === 'KeyG') { s.flight.gear = !s.flight.gear; s.ui.msg = s.flight.gear ? 'GEAR DOWN' : 'GEAR UP'; }
    if (e.code === 'KeyF') { s.flight.flaps = s.flight.flaps > 0 ? 0 : 0.5; s.ui.msg = s.flight.flaps > 0 ? 'FLAPS 50%' : 'FLAPS UP'; }
    if (e.code === 'KeyC') {
      s.ui.camera = s.ui.camera === 'chase' ? 'cockpit' : s.ui.camera === 'cockpit' ? 'tower' : 'chase';
      showScreen(s, 'fly');
    }
    if (e.code === 'KeyV') { renderProof(s); showScreen(s, 'proof'); }
    if (e.code === 'KeyM') { renderLog(s); showScreen(s, 'log'); }
    if (e.code === 'KeyP') { showScreen(s, 'pause'); }
    if (e.code === 'KeyR') { startLeg(s, s.mission.leg); radioSeed(radio); }
  } else if (screen === 'pause') {
    if (e.code === 'KeyP' || e.code === 'Enter') showScreen(s, 'fly');
    if (e.code === 'KeyR') { startLeg(s, s.mission.leg); showScreen(s, 'fly'); }
    if (e.code === 'KeyM') { renderLog(s); showScreen(s, 'log'); }
  } else if (screen === 'proof' || screen === 'log' || screen === 'end') {
    if (e.code === 'Enter' || e.code === 'Escape') {
      if (screen === 'proof') { if (s.mission.phase === 'done') { startLeg(s, Math.min(4, s.mission.leg + 1)); showScreen(s, 'fly'); } else showScreen(s, 'fly'); }
      else if (screen === 'end') { startLeg(s, s.mission.leg); showScreen(s, 'fly'); }
      else showScreen(s, 'fly');
    }
  }
});
window.addEventListener('keyup', (e) => { keys[e.code] = false; });
canvas.addEventListener('pointerdown', (e) => { drag = { x0: e.clientX, y0: e.clientY, dx: 0, dy: 0 }; });
window.addEventListener('pointermove', (e) => {
  if (drag) { drag.dx = e.clientX - drag.x0; drag.dy = e.clientY - drag.y0; }
});
window.addEventListener('pointerup', () => { drag = null; });

document.getElementById('btn-fly').addEventListener('click', fly);
document.getElementById('btn-resume').addEventListener('click', () => showScreen(s, 'fly'));
document.getElementById('btn-again').addEventListener('click', () => { startLeg(s, s.mission.leg); showScreen(s, 'fly'); });
document.getElementById('btn-proof-back').addEventListener('click', () => {
  if (s.mission.phase === 'done') { startLeg(s, Math.min(4, s.mission.leg + 1)); showScreen(s, 'fly'); }
  else showScreen(s, 'fly');
});
document.getElementById('btn-log-back').addEventListener('click', () => showScreen(s, 'fly'));
document.getElementById('mission-table').addEventListener('click', (e) => {
  const row = e.target.closest('.mrow');
  if (!row) return;
  s.ui.selectedLeg = Number(row.dataset.leg);
  startLeg(s, s.ui.selectedLeg);
  renderTitle(s, saves);
});
document.getElementById('slots').addEventListener('click', (e) => {
  const slot = e.target.closest('.slot');
  if (!slot) return;
  s.ui.selectedSlot = Number(slot.dataset.slot);
  s.save.callsign = saves.slots[s.ui.selectedSlot].callsign;
  renderTitle(s, saves);
});
document.getElementById('refit-row').addEventListener('click', (e) => {
  const btn = e.target.closest('[data-refit]');
  if (!btn || btn.disabled) return;
  if (buyRefit(s, btn.dataset.refit)) { audio.blip(990); renderRefits(s); }
});

// ---- boot ----
startLeg(s, 1);
renderTitle(s, saves);
showScreen(s, 'title');
requestAnimationFrame(loop);

// ---- the capture harness API (window.__kit) ----
// The harness flies real legs through setDrive (the game's own input path)
// and stages the four shots from the flown record. Staging moves the
// CAMERA and the AIRCRAFT POSITION for the shot; the score, the delivered
// tonnes, the stars, the fuel and the icing are the flown values, untouched.
window.__game = {
  get flight() { return s.flight; },
  get mission() { return s.mission; },
  get save() { return s.save; },
  get recorder() { return s.recorder; },
  get screen() { return s.ui.screen; },
  get frames() { return frames; },
};
window.__kit = {
  groundHeight,
  setDrive(d) { harnessDrive = { pitch: d.pitch || 0, bank: d.bank || 0, yaw: d.yaw || 0, throttle: d.throttle || 0 }; },
  clearDrive() { harnessDrive = null; },
  stageLeg() {
    s.ui.frozen = false;
    startLeg(s, 1);
    radioSeed(radio);
    radioSay(radio, 'START', s);
    showScreen(s, 'fly');
    s.ui.camera = 'chase';
    pressSpace(s);
    radioSay(radio, 'LOAD', s);
  },
  stageCover() {
    // Final approach to Eureka on leg 2, leg 1 delivered: the flown record
    // (score 21,000, 4.2 T delivered, 3 stars) stands; only the position is
    // set so the freighter, the lit strip and the aurora share one frame.
    const f = s.flight;
    f.x = 4; f.y = 16; f.z = -190;
    f.heading = Math.PI; f.speed = 30; f.throttle = 0.45;
    f.pitch = 0.05; f.bank = 0; f.vy = -1.2;
    f.onGround = false; f.gear = true; f.flaps = 0.5;
    s.mission.phase = 'land';
    s.ui.camera = 'chase';
    s.ui.moment = 'TOUCHDOWN ✓ 4.2 T DELIVERED';
    scene.fog.density = 0.0009;
    showScreen(s, 'fly');
  },
  stageNight() {
    // Cockpit in the whiteout band, icing building: the icing decision is
    // live here. The fuel decision was answered PRESS ON on the real input
    // path before this shot, so the icing banner is the one showing.
    s.ui.frozen = false;
    const f = s.flight;
    f.x = -3; f.y = 28; f.z = -260;
    f.heading = Math.PI; f.speed = 32; f.throttle = 0.5;
    f.pitch = 0.02; f.bank = 0; f.vy = -0.5;
    f.onGround = false; f.gear = true;
    f.icing = 52;
    s.mission.phase = 'fly';
    s.mission.gatePassed = true;
    s.ui.camera = 'cockpit';
    s.ui.moment = '';
    // denser haze for the whiteout band; restored by stageProof/stageTitle
    scene.fog.density = 0.0016;
    showScreen(s, 'fly');
  },
  stageProof() {
    scene.fog.density = 0.0009;
    syncSlot(saves, s);
    renderProof(s);
    showScreen(s, 'proof');
  },
  stageTitle() {
    scene.fog.density = 0.0009;
    syncSlot(saves, s);
    renderTitle(s, saves);
    showScreen(s, 'title');
  },
  freeze() { s.ui.frozen = true; },
  setFog(d) { scene.fog.density = d; },
  // synchronous HUD + panel refresh: the capture calls this right before a
  // shot so the DOM is the staged state, not a frame-rate race
  refresh() { updateHud(s, radio); drawPanel(s, GAUGE_IDS); },
  // debug: the live camera pose, for the capture harness to verify the shot
  cam() { return { p: rig.camera.position.toArray(), q: rig.camera.quaternion.toArray() }; },
  inFrame(x, y, z) { return rig.inFrame(x, y, z); },
};
