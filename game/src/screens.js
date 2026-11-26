// screens.js — the title, proof, pause, end and pilot-log screens.
// One job: fill each screen from the state and show/hide it.
//
// The title is a flight-plan briefing board (stencil/mono, checklist layout,
// never a generic card grid). The proof is the debrief: headline, recorder
// chart, touchdown plan, 6 honest cells, the 4 leg cells, medal + rank +
// BEST, incident log, pilot-log line.
import { LEGS, REFITS } from './missions.js';
import { deliveredText, starsText, flightClock } from './state.js';
import { drawRecorder, touchdownPlanHTML, incidentLogText } from './recorder.js';
import { rankLetter, medalFor } from './saves.js';
import { renderRefits } from './hud.js';

const $ = (id) => document.getElementById(id);

export function renderTitle(s, saves) {
  $('mission-table').innerHTML = LEGS.map((leg) => {
    const flown = s.save.legsFlown >= leg.n;
    const current = s.mission.leg === leg.n && !flown;
    const score = flown && s.mission.lastLeg && leg.n === s.save.legsFlown ? s.mission.lastLeg.score : 0;
    return `<div class="mrow ${current ? 'sel' : ''}" data-leg="${leg.n}">
      <div class="mnum">${String(leg.n).padStart(2, '0')}</div>
      <div class="mname">${leg.name}<div class="msub">${leg.goal}</div></div>
      <div class="mmeta">${leg.from} → ${leg.to}<br>${leg.meta}</div>
      <div class="mscore">${flown ? `${score.toLocaleString('en-US')} PTS · ★★★` : current ? 'NEXT UP' : 'LOCKED'}</div>
    </div>`;
  }).join('');
  $('slots').innerHTML = saves.slots.map((slot, i) => `
    <div class="slot ${i === s.ui.selectedSlot ? 'sel' : ''}" data-slot="${i}">
      <div class="sname">PILOT ${i + 1}</div>
      <div class="scall">${slot.callsign}</div>
      <div class="sstat">SCORE ${slot.score.toLocaleString('en-US')}<br>LEGS ${slot.legs} · ${slot.delivered.toFixed(1)}T</div>
    </div>`).join('');
  $('count-banner').innerHTML =
    `<span><b>4</b> LEGS</span>·<span><b>12.0</b> T CARGO</span>·<span><b>12</b> STARS</span>`;
  renderRefits(s);
  $('btn-fly').textContent = `FLY — LEG ${s.mission.leg} · ${LEGS[s.mission.leg - 1].name}`;
}

export function renderProof(s) {
  const m = s.mission;
  const last = m.lastLeg;
  $('proof-headline').textContent = last
    ? `${last.name} — ${last.delivered.toFixed(1)} T DELIVERED · ${last.stars} STARS · SINK ${last.sink.toFixed(1)} M/S`
    : 'LEG 1 IN PROGRESS — FLY IT TO EARN THE DEBRIEF';
  $('proof-medal').textContent =
    `${medalFor(s)} · RANK ${rankLetter(s)} · BEST SCORE ${s.save.best.toLocaleString('en-US')} · SCORE ${s.save.score.toLocaleString('en-US')}`;
  const cells = [
    ['TOTAL SCORE', s.save.score.toLocaleString('en-US'), 'THIS SESSION · BEST ' + s.save.best.toLocaleString('en-US')],
    ['LANDING SINK', `${(last ? last.sink : s.flight.touchSink).toFixed(1)} M/S`, last && last.soft ? 'SOFT ✓ UNDER 3.0' : 'TARGET UNDER 3.0 M/S'],
    ['TOUCHDOWN SPEED', `${Math.round((last ? last.speed : s.flight.touchSpeed) * 1.94384)} KT`, 'TARGET 50–70 KT'],
    ['OFF CENTRELINE', `${(last ? last.off : s.flight.touchOff).toFixed(1)} M`, 'LIMIT 12 M · STRIP 09'],
    ['FUEL LEFT', `${last ? last.fuelLeft : Math.floor(s.flight.fuel)}%`, 'BURNED ON THE LEG'],
    ['ICING AT TOUCH', `${last ? last.icing : Math.floor(s.flight.icing)}%`, 'DE-ICE BOOTS ' + (m.refits.boots ? 'FITTED ✓' : 'NOT FITTED')],
  ];
  $('proof-grid').innerHTML = cells.map(([lab, val, sub]) =>
    `<div class="pcell"><div class="lab">${lab}</div><div class="val">${val}</div><div class="sub">${sub}</div></div>`).join('');
  drawRecorder(s, $('recorder-chart'));
  $('touchdown-plan').innerHTML = touchdownPlanHTML(s);
  $('proof-sorties').innerHTML = LEGS.map((leg) => {
    const flown = s.save.legsFlown >= leg.n;
    const sc = flown && last && leg.n === s.save.legsFlown ? last.score : 0;
    return `<div class="scell"><div class="lab">LEG ${leg.n} · ${leg.name}</div>
      <div class="val">${flown ? sc.toLocaleString('en-US') + ' PTS' : '—'}</div>
      <div class="sub">${flown ? '★'.repeat(last ? last.stars : 1) + ' · ' + leg.cargo.toFixed(1) + ' T' : leg.goal}</div></div>`;
  }).join('');
  $('proof-incident').textContent = incidentLogText(s);
  $('proof-note').textContent =
    `PILOT LOG — ${deliveredText(s)} · ${starsText(s)} · LEGS ${s.save.legsFlown}/4 · FLIGHT TIME ${flightClock(s)} · ` +
    `REFITS: ${REFITS.filter((r) => m.refits[r.key]).map((r) => r.name).join(', ') || 'NONE YET'}`;
}

export function renderLog(s) {
  const m = s.mission;
  $('log-list').innerHTML = [
    `<b>CALLSIGN</b> ${s.save.callsign} · EUREKA BASE · ICE STRIP 09 · −38°C · AURORA KP 6`,
    `<b>SCORE</b> ${s.save.score.toLocaleString('en-US')} · BEST ${s.save.best.toLocaleString('en-US')} · RANK ${rankLetter(s)}`,
    `<b>CAMPAIGN</b> ${deliveredText(s)} · ${starsText(s)} · LEGS ${s.save.legsFlown}/4`,
    `<b>LEG ${m.leg}</b> ${LEGS[m.leg - 1].name} — ${LEGS[m.leg - 1].goal}`,
    `<b>STORM</b> WHITEOUT IN ${Math.ceil(m.stormLeft / 60)} MIN — STRAIT CLOSES, ANY AIRCRAFT NOT DOWN IS LOST`,
    `<b>REFITS</b> ${REFITS.filter((r) => m.refits[r.key]).map((r) => r.name).join(', ') || 'NONE YET'} · POINTS ${m.refitPoints}`,
    `<b>INCIDENTS</b> ${s.recorder.incidents.length ? s.recorder.incidents[s.recorder.incidents.length - 1] : 'NONE — CLEAN SESSION'}`,
  ].join('<br>');
}

export function showScreen(s, name) {
  s.ui.screen = name;
  for (const id of ['title-screen', 'proof-screen', 'pause-screen', 'end-screen', 'log-screen']) {
    $(id).classList.remove('on');
  }
  const map = { title: 'title-screen', proof: 'proof-screen', pause: 'pause-screen', end: 'end-screen', log: 'log-screen', fly: null };
  if (map[name]) $(map[name]).classList.add('on');
  $('hud').classList.toggle('on', name === 'fly' || name === 'pause' || name === 'proof');
  $('panel').classList.toggle('on', name === 'fly' || name === 'pause');
  $('canopy').classList.toggle('on', name === 'fly' && s.ui.camera === 'cockpit');
  // The top bar lives on title/proof only: on fly/pause the HUD's own boxes
  // ARE the top bar, and the persistent bar collides with their labels.
  // The bottom bar is on all four (it reads over the panel's dark base).
  $('pbar-top').style.display = (name === 'proof' || name === 'title') ? 'flex' : 'none';
  $('pbar-bottom').style.display = (name === 'fly' || name === 'pause' || name === 'proof' || name === 'title') ? 'flex' : 'none';
  document.getElementById('status').textContent =
    name === 'fly' ? 'AURORA FREIGHT — flying' : `AURORA FREIGHT — ${name} screen`;
}
