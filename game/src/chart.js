// chart.js — the strait chart: a top-down map of the Ellesmere Strait with
// the stations, the ice strips, the gate, the whiteout front and the
// freighter's dot. One job: draw the chart from the state, same numbers as
// the HUD.
export function drawChart(s, canvas) {
  const g = canvas.getContext('2d');
  const W = canvas.width, H = canvas.height;
  g.clearRect(0, 0, W, H);
  // ice background
  g.fillStyle = '#0a1a30';
  g.fillRect(0, 0, W, H);
  // strait water/ice channel: z from +200 (bottom) to -2900 (top)
  const zToY = (z) => H - ((z + 2900) / 3100) * H;
  const xToX = (x) => W / 2 + (x / 320) * (W / 2);
  g.fillStyle = '#16324e';
  g.fillRect(xToX(-150), 0, xToX(150) - xToX(-150), H);
  g.fillStyle = '#8fb4d0';
  g.fillRect(xToX(-150), 0, xToX(150) - xToX(-150), H);
  // fjord walls
  g.fillStyle = '#2a3550';
  g.fillRect(0, 0, xToX(-150), H);
  g.fillRect(xToX(150), 0, W - xToX(150), H);
  // gate ring
  g.strokeStyle = '#ffd27f'; g.lineWidth = 2;
  g.beginPath(); g.arc(xToX(0), zToY(-1280), 7, 0, Math.PI * 2); g.stroke();
  // whiteout front: a red line sweeping south as the storm closes
  const frontZ = -2900 + (s.mission.stormLeft / 1080) * 300;
  g.strokeStyle = '#ff5d5d'; g.lineWidth = 3;
  g.beginPath(); g.moveTo(0, zToY(frontZ)); g.lineTo(W, zToY(frontZ)); g.stroke();
  g.fillStyle = '#ff5d5d';
  g.font = 'bold 9px "Courier New", monospace';
  g.fillText('WHITEOUT', 4, zToY(frontZ) - 3);
  // strips
  for (const [name, z] of [['EUREKA', 0], ['ALERT', -2560]]) {
    g.fillStyle = '#e86a1e';
    g.fillRect(xToX(-12), zToY(z + 150), xToX(12) - xToX(-12), zToY(z - 150) - zToY(z + 150));
    g.fillStyle = '#ffd27f';
    g.font = 'bold 9px "Courier New", monospace';
    g.fillText(name, xToX(16), zToY(z) + 3);
  }
  // drop markers
  g.fillStyle = '#37d67a';
  for (const dz of [-1920, -2080]) {
    g.beginPath(); g.arc(xToX(0), zToY(dz), 3, 0, Math.PI * 2); g.fill();
  }
  // route line: home -> gate -> destination
  const leg = s.mission.leg;
  const homeZ = leg % 2 === 1 ? 0 : -2560;
  const destZ = leg % 2 === 1 ? -2560 : 0;
  g.strokeStyle = 'rgba(255,210,127,0.8)'; g.lineWidth = 1.5;
  g.setLineDash([4, 3]);
  g.beginPath();
  g.moveTo(xToX(0), zToY(homeZ));
  g.lineTo(xToX(0), zToY(-1280));
  g.lineTo(xToX(0), zToY(destZ));
  g.stroke();
  g.setLineDash([]);
  // the freighter's dot + heading tick
  const fx = xToX(s.flight.x), fy = zToY(s.flight.z);
  g.fillStyle = '#ffffff';
  g.beginPath(); g.arc(fx, fy, 4, 0, Math.PI * 2); g.fill();
  g.strokeStyle = '#ffffff'; g.lineWidth = 2;
  g.beginPath();
  g.moveTo(fx, fy);
  g.lineTo(fx + Math.sin(s.flight.heading) * 9, fy - Math.cos(s.flight.heading) * 9);
  g.stroke();
  // scale + label
  g.fillStyle = '#9fd8ff';
  g.font = '9px "Courier New", monospace';
  g.fillText('1 KM', 4, H - 4);
}
