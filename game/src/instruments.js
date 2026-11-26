// instruments.js — the lit instrument panel: 8 round gauges drawn on canvas,
// plus the compass strip. One job: draw the panel from the state — the same
// numbers the HUD shows, so a gauge never disagrees with its HUD box.
//
// Gauges: attitude, airspeed, altitude, vertical speed, heading, fuel, cargo
// weight, icing + warning lamps. All read the shared getters in state.js.
import { altFt, speedKt, headingDeg, fuelPct, icingPct } from './state.js';

function dial(c, label, draw) {
  const g = c.getContext('2d');
  const W = c.width, H = c.height, cx = W / 2, cy = H / 2 + 4, r = Math.min(W, H) / 2 - 8;
  g.clearRect(0, 0, W, H);
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2);
  g.fillStyle = '#04070e'; g.fill();
  g.lineWidth = 2; g.strokeStyle = '#2a4a6a'; g.stroke();
  g.fillStyle = '#8fb6d8';
  g.font = 'bold 10px "Courier New", monospace';
  g.textAlign = 'center';
  g.fillText(label, cx, H - 4);
  draw(g, cx, cy, r);
}

function needle(g, cx, cy, r, angle, color = '#ffd27f') {
  g.save();
  g.translate(cx, cy);
  g.rotate(angle);
  g.strokeStyle = color; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, 6); g.lineTo(0, -r + 12); g.stroke();
  g.restore();
  g.beginPath(); g.arc(cx, cy, 4, 0, Math.PI * 2);
  g.fillStyle = color; g.fill();
}

function ticks(g, cx, cy, r, n, a0, a1) {
  g.strokeStyle = '#7fb8e8'; g.lineWidth = 1.5;
  for (let i = 0; i <= n; i++) {
    const a = a0 + ((a1 - a0) * i) / n;
    g.beginPath();
    g.moveTo(cx + Math.sin(a) * (r - 8), cy - Math.cos(a) * (r - 8));
    g.lineTo(cx + Math.sin(a) * (r - 2), cy - Math.cos(a) * (r - 2));
    g.stroke();
  }
}

function text(g, cx, cy, str, size = 16, color = '#eaf6ff') {
  g.fillStyle = color;
  g.font = `bold ${size}px "Courier New", monospace`;
  g.textAlign = 'center';
  g.fillText(str, cx, cy);
}

export function drawPanel(s, ids) {
  const f = s.flight;
  const el = (id) => document.getElementById(id);
  // attitude: horizon ball + bank
  dial(el(ids.att), 'ATT', (g, cx, cy, r) => {
    g.save();
    g.beginPath(); g.arc(cx, cy, r - 4, 0, Math.PI * 2); g.clip();
    g.translate(cx, cy);
    g.rotate(-f.bank);
    g.translate(0, f.pitch * 160);
    g.fillStyle = '#1d5a8a'; g.fillRect(-r, -r, r * 2, r);
    g.fillStyle = '#0e2a44'; g.fillRect(-r, 0, r * 2, r);
    g.fillStyle = '#37d67a'; g.fillRect(-r, -1, r * 2, 2);
    g.restore();
    g.fillStyle = '#ffd27f';
    g.fillRect(cx - 16, cy - 1, 12, 3); g.fillRect(cx + 4, cy - 1, 12, 3);
  });
  // airspeed in knots
  dial(el(ids.spd), 'KT', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 10, -2.2, 2.2);
    const a = -2.2 + (Math.min(speedKt(s), 160) / 160) * 4.4;
    needle(g, cx, cy, r, a);
    text(g, cx, cy + r * 0.55, String(speedKt(s)), 18);
  });
  // altitude in feet
  dial(el(ids.alt), 'FT', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 10, -2.2, 2.2);
    const a = -2.2 + (Math.min(altFt(s), 2000) / 2000) * 4.4;
    needle(g, cx, cy, r, a, '#7fd8ff');
    text(g, cx, cy + r * 0.55, String(altFt(s)), 16);
  });
  // vertical speed
  dial(el(ids.vs), 'V/S', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 8, -2.2, 2.2);
    const a = -2.2 + ((Math.max(-9, Math.min(9, f.vy)) + 9) / 18) * 4.4;
    needle(g, cx, cy, r, a, '#9fd8ff');
    text(g, cx, cy + r * 0.55, `${f.vy >= 0 ? '+' : ''}${f.vy.toFixed(1)}`, 15);
  });
  // heading
  dial(el(ids.hdg), 'HDG', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 12, -Math.PI, Math.PI);
    const a = (f.heading % (Math.PI * 2));
    needle(g, cx, cy, r, a, '#37d67a');
    text(g, cx, cy + r * 0.55, String(headingDeg(s)).padStart(3, '0'), 16);
  });
  // fuel
  dial(el(ids.fuel), 'FUEL', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 10, -2.2, 2.2);
    const a = -2.2 + (fuelPct(s) / 100) * 4.4;
    needle(g, cx, cy, r, a, fuelPct(s) < 35 ? '#ff5d5d' : '#37d67a');
    text(g, cx, cy + r * 0.55, `${fuelPct(s)}%`, 16, fuelPct(s) < 35 ? '#ff5d5d' : '#eaf6ff');
  });
  // cargo weight in tonnes
  dial(el(ids.cargo), 'CARGO T', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 6, -2.2, 2.2);
    const a = -2.2 + (Math.min(f.cargoT, 6) / 6) * 4.4;
    needle(g, cx, cy, r, a, '#e86a1e');
    text(g, cx, cy + r * 0.55, f.cargoT.toFixed(1), 18);
  });
  // icing + warning lamps
  dial(el(ids.ice), 'ICING', (g, cx, cy, r) => {
    ticks(g, cx, cy, r, 10, -2.2, 2.2);
    const a = -2.2 + (icingPct(s) / 100) * 4.4;
    needle(g, cx, cy, r, a, icingPct(s) > 40 ? '#ff5d5d' : '#7fd8ff');
    text(g, cx, cy + r * 0.55, `${icingPct(s)}%`, 16, icingPct(s) > 40 ? '#ff5d5d' : '#eaf6ff');
    // lamps: STORM / GEAR / CARGO
    const lamps = [
      ['STORM', s.mission.stormLeft < 300, '#ff5d5d'],
      ['GEAR', f.gear, '#37d67a'],
      ['CARGO', f.cargoT > 0, '#ffd27f'],
    ];
    lamps.forEach(([lab, on, col], i) => {
      g.beginPath(); g.arc(cx - 34 + i * 34, cy - r + 16, 7, 0, Math.PI * 2);
      g.fillStyle = on ? col : '#1a2a3a'; g.fill();
      g.fillStyle = '#8fb6d8'; g.font = 'bold 7px "Courier New", monospace';
      g.fillText(lab, cx - 34 + i * 34, cy - r + 32);
    });
  });
}

export function drawCompass(s, canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(4,12,24,0.7)';
  g.fillRect(0, 0, W, H);
  const hdg = headingDeg(s);
  g.strokeStyle = '#7fb8e8'; g.lineWidth = 1;
  g.beginPath(); g.moveTo(W / 2, 2); g.lineTo(W / 2, H - 2); g.stroke();
  g.fillStyle = '#ffd27f';
  g.font = 'bold 11px "Courier New", monospace';
  g.textAlign = 'center';
  for (let d = -60; d <= 60; d += 15) {
    const deg = ((hdg + d) % 360 + 360) % 360;
    const x = W / 2 + (d / 60) * (W / 2 - 10);
    const card = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[deg];
    g.fillText(card || String(deg), x, 12);
    g.beginPath(); g.moveTo(x, 16); g.lineTo(x, 22); g.stroke();
  }
  g.fillStyle = '#eaf6ff';
  g.fillText(`HDG ${String(hdg).padStart(3, '0')}°`, W / 2, H - 4);
}
