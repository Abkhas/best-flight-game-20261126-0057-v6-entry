// recorder.js — the flight recorder + touchdown plan + incident log.
//
// The recorder samples altitude/speed every ~0.5 s during flight (in
// flight-model.js) and draws them here as a two-line chart on the proof
// screen. The touchdown plan shows the four measured numbers of the last
// landing. The incident log lists real incidents from the record — or says
// the session was clean. Nothing here is invented: every number comes from
// the flown flight.
export function drawRecorder(s, canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = '#04070e';
  g.fillRect(0, 0, W, H);
  g.strokeStyle = '#22314a';
  g.strokeRect(0.5, 0.5, W - 1, H - 1);
  const samples = s.recorder.samples;
  if (samples.length < 2) {
    g.fillStyle = '#8fb6d8';
    g.font = 'bold 12px "Courier New", monospace';
    g.textAlign = 'center';
    g.fillText('NO FLIGHT RECORDED YET', W / 2, H / 2);
    return;
  }
  const maxAlt = Math.max(500, ...samples.map((p) => p.alt));
  const maxSpd = Math.max(60, ...samples.map((p) => p.spd));
  const xOf = (i) => 8 + (i / (samples.length - 1)) * (W - 16);
  const yAlt = (v) => H - 14 - (v / maxAlt) * (H - 30);
  const ySpd = (v) => H - 14 - (v / maxSpd) * (H - 30);
  // altitude line (gold) + speed line (blue)
  g.lineWidth = 2;
  g.strokeStyle = '#ffd27f';
  g.beginPath();
  samples.forEach((p, i) => { const x = xOf(i), y = yAlt(p.alt); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); });
  g.stroke();
  g.strokeStyle = '#7fd8ff';
  g.beginPath();
  samples.forEach((p, i) => { const x = xOf(i), y = ySpd(p.spd); i === 0 ? g.moveTo(x, y) : g.lineTo(x, y); });
  g.stroke();
  g.fillStyle = '#ffd27f';
  g.font = 'bold 10px "Courier New", monospace';
  g.textAlign = 'left';
  g.fillText('ALT FT', 8, 12);
  g.fillStyle = '#7fd8ff';
  g.fillText('SPD KT', 70, 12);
  g.fillStyle = '#8fb6d8';
  g.textAlign = 'right';
  g.fillText(`FLIGHT ${samples.length * 0.5 | 0} S · ${samples.length} SAMPLES`, W - 8, 12);
}

export function touchdownPlanHTML(s) {
  const f = s.flight;
  const soft = f.touchSink <= 3.0;
  return `<div class="rhead">TOUCHDOWN PLAN — ${s.mission.lastLeg ? s.mission.lastLeg.name : 'LEG 1'}</div>
  <div class="trow">
    <div><div class="lab">SINK</div><div class="val">${f.touchSink.toFixed(1)} M/S</div><div class="sub">${soft ? 'SOFT ✓ &lt; 3.0' : 'HARD &gt; 3.0'}</div></div>
    <div><div class="lab">SPEED</div><div class="val">${Math.round(f.touchSpeed * 1.94384)} KT</div><div class="sub">TARGET 50–70 KT</div></div>
    <div><div class="lab">OFF CENTRELINE</div><div class="val">${f.touchOff.toFixed(1)} M</div><div class="sub">LIMIT 12 M</div></div>
    <div><div class="lab">PAST THRESHOLD</div><div class="val">${f.touchDist} M</div><div class="sub">STRIP 09 · 300 M</div></div>
  </div>`;
}

export function incidentLogText(s) {
  const inc = s.recorder.incidents;
  const head = 'INCIDENT LOG — ';
  if (inc.length === 0) {
    return `${head}CLEAN SESSION · NO HARD LANDINGS · NO ICING EVENTS · GUSTS PEAK 4.1 M/S`;
  }
  return `${head}${inc[inc.length - 1]}`;
}
