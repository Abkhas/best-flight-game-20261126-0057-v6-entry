// hud.js — the HUD: every DOM box on the flight screens, updated from the
// state and nothing else. One job: render the state legibly.
//
// The persistent HUD is the same on all four shots: a slim top bar
// (callsign + heading + score) and a slim bottom bar (the same numbers again
// in one line), the 6 top boxes (altitude, speed, heading, throttle, score,
// whiteout timer), the resource bars (fuel / airframe / cargo), the radio
// log, the leg checklist, the landing check, the chart, the compass, the
// coaching banner and the one big moment line. No controls manual on the
// cover — the controls legend lives on the title screen only.
import {
  altFt, speedKt, headingDeg, fuelPct, icingPct,
  stormText, deliveredText, starsText, flightClock,
} from './state.js';
import { legOf, legStatusText, REFITS } from './missions.js';
import { renderRadio } from './radio.js';
import { drawCompass } from './instruments.js';
import { drawChart } from './chart.js';

const $ = (id) => document.getElementById(id);

export function updateHud(s, radio) {
  const f = s.flight, m = s.mission;
  const leg = legOf(s);
  const inFlight = s.ui.screen === 'fly';

  // top boxes — the same getters the gauges and the bottom bar use
  $('hud-alt-v').textContent = altFt(s);
  $('hud-spd-v').textContent = speedKt(s);
  $('hud-hdg-v').textContent = String(headingDeg(s)).padStart(3, '0');
  $('hud-rpm-v').textContent = `${Math.round(f.throttle * 100)}%`;
  $('hud-score-v').textContent = s.save.score.toLocaleString('en-US');
  $('hud-score-sub').textContent = `${deliveredText(s)} · ${starsText(s)}`;
  $('hud-storm-v').textContent = stormText(s);
  const frontNm = (m.stormLeft / 1080 * 2.8).toFixed(1);
  $('hud-storm-sub').textContent = `WHITEOUT FRONT — ${frontNm} NM BEHIND`;

  // resource bars
  $('hud-fuel-v').textContent = `${fuelPct(s)}%`;
  $('hud-fuel-bar').style.width = `${fuelPct(s)}%`;
  $('hud-airframe-v').textContent = `${Math.floor(f.airframe)}%`;
  $('hud-airframe-bar').style.width = `${f.airframe}%`;
  $('hud-cargo-v').textContent = `${f.cargoT.toFixed(1)} T / 6.0 T`;
  $('hud-cargo-bar').style.width = `${Math.min(100, (f.cargoT / 6) * 100)}%`;
  $('hud-icing-v').textContent = `${icingPct(s)}%`;
  $('hud-icing-bar').style.width = `${icingPct(s)}%`;
  $('hud-rescue-v').textContent =
    m.phase === 'load' ? 'LOADING' : m.phase === 'takeoff' ? 'TAKEOFF' :
    m.phase === 'fly' ? 'EN ROUTE' : m.phase === 'drop' ? 'DROP ZONE' :
    m.phase === 'land' ? 'FINAL' : m.phase === 'unload' ? 'UNLOADING' : 'LEG DONE';

  // objective
  $('hud-obj-kicker').textContent = `LEG ${leg.n} OF 4 · WHITEOUT CLOSING IN`;
  $('hud-obj-name').textContent = leg.name;
  $('hud-obj-sub').textContent = legObjectiveText(s);

  // radio + checklist + landing check + chart + compass
  renderRadio(radio, $('radio-log'));
  renderChecklist(s);
  renderLandingCheck(s);
  drawChart(s, $('chart-c'));
  drawCompass(s, $('hud-compass-c'));

  // messages, moment line, decision, coaching
  $('hud-msg').textContent = s.ui.msg || '';
  const moment = $('hud-moment');
  if (s.ui.moment && inFlight) {
    moment.style.display = 'block';
    moment.textContent = s.ui.moment;
  } else {
    moment.style.display = 'none';
  }
  const dec = $('hud-decision');
  if (s.ui.decision === 'fuel') {
    dec.style.display = 'block';
    dec.textContent = `FUEL LOW ${fuelPct(s)}% — 1 DIVERT TO EUREKA · 2 PRESS ON`;
  } else if (s.ui.decision === 'ice') {
    dec.style.display = 'block';
    dec.textContent = `ICING ${icingPct(s)}% — 1 CLIMB ABOVE IT · 2 STAY LOW, DE-ICE NOW`;
  } else {
    dec.style.display = 'none';
  }
  $('hud-coach').textContent = coachText(s);
  $('hud-warn').textContent = s.ui.warn || '';

  // wind + throttle line
  $('hud-wind').textContent =
    `WIND 310°/18 KT GUST ${f.gust >= 0 ? '+' : ''}${f.gust.toFixed(1)} · THR ${Math.round(f.throttle * 100)}% · ENG ${Math.round(f.engTemp)}°C`;
  $('hud-hint').textContent =
    'W/S THROTTLE · ARROWS FLY · A/D YAW · SPACE LOAD / DROP · G GEAR · C CAMERA';

  // persistent slim bars — the same numbers, one line each
  $('pbar-top-c').textContent = `HDG ${String(headingDeg(s)).padStart(3, '0')}° · ${legStatusText(s)}`;
  $('pbar-top-r').textContent = `SCORE ${s.save.score.toLocaleString('en-US')} · BEST ${s.save.best.toLocaleString('en-US')}`;
  $('pbar-bot').textContent =
    `ALT ${altFt(s)} FT · SPD ${speedKt(s)} KT · HDG ${String(headingDeg(s)).padStart(3, '0')}° · ` +
    `FUEL ${fuelPct(s)}% · CARGO ${f.cargoT.toFixed(1)} T · ICING ${icingPct(s)}% · ` +
    `SCORE ${s.save.score.toLocaleString('en-US')} · ${deliveredText(s)} · ${starsText(s)} · ${flightClock(s)}`;
}

function legObjectiveText(s) {
  const m = s.mission, f = s.flight;
  const leg = legOf(s);
  const st = leg.strip;
  if (m.phase === 'load') return `${leg.cargoLabel} — PRESS SPACE TO LOAD AT ${leg.from}`;
  if (m.phase === 'takeoff') return `FULL THROTTLE — ROTATE AT 47 KT, CLIMB TO 400 FT`;
  if (m.phase === 'fly') {
    const d = Math.round(Math.abs(f.z - leg.gateZ) * 3.28);
    return m.gatePassed ? `${leg.to} AHEAD — ${Math.round(Math.abs(f.z - st.z) * 3.28)} FT TO THE STRIP`
      : `GATE AHEAD — ${d} FT · FLY THROUGH THE GOLD RING`;
  }
  if (m.phase === 'drop') {
    const d = Math.round(Math.abs(f.z - leg.dropZ) * 3.28);
    return `DROP ZONE ${d} FT — PRESS SPACE OVER THE GREEN RING`;
  }
  if (m.phase === 'land') {
    const d = Math.round(Math.abs(f.z - st.z) * 3.28);
    return `FINAL — ${st.name} STRIP 09 · ${d} FT · GEAR DOWN`;
  }
  if (m.phase === 'unload') return `ON THE STRIP — PRESS SPACE TO UNLOAD ${leg.cargo.toFixed(1)} T`;
  return 'LEG COMPLETE — PICK A REFIT, FLY THE NEXT LEG';
}

function renderChecklist(s) {
  const m = s.mission;
  const leg = legOf(s);
  const steps = leg.kind === 'drop'
    ? ['LOAD THE MANIFEST', 'TAKE OFF FROM THE ICE', 'FLY THE GATE RING', 'DROP ON THE CACHE', 'LAND ON THE STRIP']
    : ['LOAD THE MANIFEST', 'TAKE OFF FROM THE ICE', 'FLY THE GATE RING', 'LAND ON THE ICE STRIP', 'UNLOAD THE CARGO'];
  const order = ['load', 'takeoff', 'fly', 'drop', 'land', 'unload'];
  const cur = order.indexOf(m.phase);
  const doneIdx = m.phase === 'done' ? steps.length : { load: 0, takeoff: 1, fly: 2, drop: 3, land: 3, unload: 4 }[m.phase];
  const rows = steps.map((t, i) => {
    const cls = i < doneIdx ? 'done' : i === doneIdx ? 'cur' : '';
    const mark = i < doneIdx ? '✓' : i === doneIdx ? '▸' : '○';
    return `<div class="cline ${cls}">${mark} ${t}</div>`;
  }).join('');
  const next = leg.n === 1 ? 'NEXT: DR ELIN VOSS, 41' : leg.n === 2 ? 'NEXT: FUEL DRUMS × 12' : leg.n === 3 ? 'NEXT: SCIENCE POD' : 'NEXT: CAMPAIGN DONE';
  $('checklist').innerHTML =
    `<div class="rhead">MANIFEST — ${leg.name}</div>${rows}` +
    `<div class="cline sub">${leg.cargoLabel} · ${leg.cargo.toFixed(1)} T</div>` +
    `<div class="cline sub">${next}</div>`;
}

function renderLandingCheck(s) {
  const f = s.flight;
  const sinkOk = f.vy >= -3.0;
  const spd = speedKt(s);
  const spdOk = spd >= 45 && spd <= 75;
  const offOk = Math.abs(f.x) <= 12;
  const mark = (ok) => (ok ? '✓' : '·');
  $('landing-check').innerHTML =
    `<div class="rhead">LANDING CHECK — STRIP 09</div>` +
    `<div class="lrow">SINK <b>${f.vy >= 0 ? '+' : ''}${f.vy.toFixed(1)} M/S</b> <span>${mark(sinkOk)} &lt; 3.0 M/S</span></div>` +
    `<div class="lrow">SPEED <b>${spd} KT</b> <span>${mark(spdOk)} 45–75 KT</span></div>` +
    `<div class="lrow">CENTRELINE <b>${Math.abs(f.x).toFixed(1)} M</b> <span>${mark(offOk)} &lt; 12 M</span></div>` +
    `<div class="lrow">GEAR <b>${f.gear ? 'DOWN ✓' : 'UP'}</b> <span>FLAPS ${f.flaps * 100 | 0}%</span></div>`;
}

function coachText(s) {
  const f = s.flight, m = s.mission;
  if (f.crashed) return 'IVY · POLAR 7 DOWN — SEND THE SLED TEAM';
  if (m.stormFailed) return 'WHITEOUT HAS THE STRAIT — GET HER DOWN NOW';
  if (s.ui.decision === 'ice') return 'IVY · ICE ON THE WINGS — CLIMB OR DE-ICE, POLAR 7';
  if (s.ui.decision === 'fuel') return 'IVY · FUEL LOW — DIVERT OR PRESS ON, YOUR CALL';
  if (m.phase === 'land') {
    if (Math.abs(f.x) > 12) return `IVY · ${f.x > 0 ? 'DRIFTING RIGHT' : 'DRIFTING LEFT'} — EASE BACK TO THE CENTRELINE`;
    if (f.vy < -3) return 'IVY · SINKING FAST — EASE THE NOSE UP, FLARE';
    if (speedKt(s) > 75) return 'IVY · TOO FAST FOR THE STRIP — POWER BACK';
    return 'IVY · ON THE CENTRELINE — HOLD HER STEADY, FLARE AT 30 FT';
  }
  if (m.phase === 'fly' && !m.gatePassed) return 'IVY · GATE AHEAD — THROUGH THE GOLD RING, STEADY';
  if (m.phase === 'takeoff') return 'IVY · FULL THROTTLE — ROTATE AT 47 KT';
  if (m.phase === 'load') return 'IVY · MANIFEST READY — PRESS SPACE TO LOAD';
  if (m.phase === 'unload') return 'IVY · ON THE STRIP — PRESS SPACE TO UNLOAD';
  if (m.phase === 'drop') return 'IVY · OVER THE CACHE SOON — SPACE TO DROP';
  return 'IVY · WHITEOUT IN 20 MIN — KEEP HER ON THE CENTRELINE';
}

export function renderRefits(s) {
  const m = s.mission;
  $('refit-row').innerHTML =
    `<div class="rhead">TURNAROUND — PICK 1 OF 3 · REFIT POINTS: ${m.refitPoints}</div>` +
    REFITS.map((r) => {
      const owned = m.refits[r.key];
      const dis = owned || m.refitPoints < 1 ? 'disabled' : '';
      return `<button class="refit-btn" data-refit="${r.key}" ${dis}>${owned ? '✓ ' : ''}${r.name} — ${r.desc}</button>`;
    }).join('') +
    `<div class="rnote">Each refit costs 1 point, earned per leg flown. ${m.refitPoints === 0 ? 'Fly a leg to earn one.' : ''}</div>`;
}
