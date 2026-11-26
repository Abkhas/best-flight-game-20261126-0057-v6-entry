// terrain.js — the Ellesmere Strait: a PLACE, not a course.
//
// Sea ice with pressure ridges, fjord walls on both sides, two named stations
// (Eureka base and Alert Station) each with a lit ice strip (orange edge
// lights, threshold lights, windsock), a frozen fjord, and the aurora — green
// curtains hanging over the whole strait. The palette is deep indigo night +
// green aurora + orange strip lights + white ice: saturated, never fog-grey.
import * as THREE from 'three';

function mat(color, emissive = 0x000000, ei = 0) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: 0.85, metalness: 0.05 });
}

function textSprite(text, color = '#ffd27f', size = 42) {
  const c = document.createElement('canvas');
  c.width = 512; c.height = 96;
  const g = c.getContext('2d');
  g.font = `bold ${size}px "Courier New", monospace`;
  g.textAlign = 'center'; g.textBaseline = 'middle';
  g.shadowColor = '#000'; g.shadowBlur = 10;
  g.fillStyle = color;
  g.fillText(text, 256, 48);
  const tex = new THREE.CanvasTexture(c);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthWrite: false }));
  sp.scale.set(60, 11, 1);
  return sp;
}

export function buildTerrain(scene) {
  const group = new THREE.Group();
  scene.add(group);

  // --- sky dome: deep indigo, darker overhead ---
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(4500, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0x0a1030, side: THREE.BackSide, fog: false }),
  );
  group.add(sky);

  // --- stars ---
  const starGeo = new THREE.BufferGeometry();
  const starPos = [];
  for (let i = 0; i < 900; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = 0.12 + Math.random() * 1.2;
    const r = 4200;
    starPos.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r);
  }
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(starPos, 3));
  group.add(new THREE.Points(starGeo, new THREE.PointsMaterial({ color: 0xcfe0ff, size: 1.6, sizeAttenuation: false, fog: false })));

  // --- moon: a bright disc low over the fjord ---
  const moon = new THREE.Mesh(
    new THREE.CircleGeometry(26, 32),
    new THREE.MeshBasicMaterial({ color: 0xf4f1de, fog: false }),
  );
  moon.position.set(-260, 190, -2760);
  moon.lookAt(0, 20, 0);
  group.add(moon);

  // --- aurora: five great green curtains spanning the whole strait, so the
  // lights are in the sky whichever way the camera looks ---
  const aurora = [];
  const auroraCols = [0x2aff7a, 0x19e68a, 0x7dffb0, 0x2aff7a, 0x19e68a];
  const auroraZ = [100, -700, -1400, -2000, -2600];
  for (let k = 0; k < 5; k++) {
    const geo = new THREE.PlaneGeometry(700, 130, 48, 6);
    const pos = geo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const x = pos.getX(i), y = pos.getY(i);
      pos.setZ(i, Math.sin(x * 0.012 + k * 2.1) * 14 + Math.cos(y * 0.05) * 6);
    }
    geo.computeVertexNormals();
    const m = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({
      color: auroraCols[k], transparent: true, opacity: 0.38 - (k % 3) * 0.07,
      side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false,
    }));
    m.position.set(-80 + (k % 3) * 120, 210 + (k % 3) * 26, auroraZ[k]);
    m.rotation.y = 0.12 * (k % 3);
    group.add(m);
    aurora.push(m);
  }

  // --- sea ice: a big white-blue sheet with gentle undulation ---
  const iceGeo = new THREE.PlaneGeometry(900, 3600, 60, 90);
  {
    const p = iceGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i), y = p.getY(i);
      p.setZ(i, Math.sin(x * 0.05) * 0.35 + Math.cos(y * 0.04) * 0.3);
    }
    iceGeo.computeVertexNormals();
  }
  const ice = new THREE.Mesh(iceGeo, mat(0xdfeaf2, 0x2a3a55, 0.4));
  ice.rotation.x = -Math.PI / 2;
  ice.position.set(0, 0, -1280);
  group.add(ice);

  // --- pressure ridges: jagged ice teeth along both strait edges ---
  const ridgeGeo = new THREE.ConeGeometry(2.2, 7, 4);
  const ridgeMat = mat(0xc4d9e8, 0x223850, 0.3);
  const ridges = new THREE.InstancedMesh(ridgeGeo, ridgeMat, 320);
  const dummy = new THREE.Object3D();
  let ri = 0;
  for (let i = 0; i < 160; i++) {
    for (const side of [-1, 1]) {
      const x = side * (155 + Math.random() * 40);
      const z = 200 - Math.random() * 3100;
      dummy.position.set(x, 1.5 + Math.random() * 2, z);
      dummy.rotation.set((Math.random() - 0.5) * 0.5, Math.random() * Math.PI, (Math.random() - 0.5) * 0.5);
      const sc = 0.7 + Math.random() * 1.6;
      dummy.scale.set(sc, sc * (0.8 + Math.random()), sc);
      dummy.updateMatrix();
      ridges.setMatrixAt(ri++, dummy.matrix);
    }
  }
  group.add(ridges);

  // --- fjord walls: long dark ridges with snow caps, both sides ---
  for (const side of [-1, 1]) {
    const wallGeo = new THREE.PlaneGeometry(3600, 150, 60, 8);
    const p = wallGeo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const x = p.getX(i);
      p.setZ(i, 30 + Math.abs(Math.sin(x * 0.02)) * 55 + Math.random() * 12);
    }
    wallGeo.computeVertexNormals();
    const wall = new THREE.Mesh(wallGeo, mat(0x2a3550, 0x0c1226, 0.4));
    wall.position.set(side * 330, 55, -1280);
    wall.rotation.y = side * Math.PI * 0.5;
    group.add(wall);
    // snow cap strip along the top of the wall
    const cap = new THREE.Mesh(new THREE.PlaneGeometry(3600, 26, 60, 1), mat(0xe8f2fa, 0x2a3a55, 0.3));
    cap.position.set(side * 322, 128, -1280);
    cap.rotation.y = side * Math.PI * 0.5;
    cap.rotation.x = -0.35;
    group.add(cap);
  }

  // --- frozen fjord: a blue crack running off to the west ---
  const fjord = new THREE.Mesh(new THREE.PlaneGeometry(120, 2600), mat(0x9fc8e8, 0x16324e, 0.5));
  fjord.rotation.x = -Math.PI / 2;
  fjord.rotation.z = 0.5;
  fjord.position.set(-260, 0.15, -1280);
  group.add(fjord);

  // --- stations + strips ---
  buildStation(group, 0, 0, 'EUREKA');
  buildStation(group, 0, -2560, 'ALERT STATION');
  buildStrip(group, 0, 0);
  buildStrip(group, 0, -2560);

  // --- place labels floating over the strait ---
  const labels = [
    ['EUREKA BASE', 0, 26, 60, '#ffd27f'],
    ['ALERT STATION', 0, 26, -2500, '#ffd27f'],
    ['GRIS FJORD', -190, 30, -1920, '#9fd8ff'],
    ['ALEXANDRA FIORD', 190, 30, -2080, '#9fd8ff'],
    ['ELLESMERE STRAIT', 0, 40, -1280, '#7dffb0'],
  ];
  for (const [t, x, y, z, c] of labels) {
    const sp = textSprite(t, c);
    sp.position.set(x, y, z);
    group.add(sp);
  }

  // --- mid-leg gate ring at z = -1280 ---
  const gate = new THREE.Mesh(
    new THREE.TorusGeometry(18, 0.9, 10, 40),
    new THREE.MeshBasicMaterial({ color: 0xffd27f, transparent: true, opacity: 0.95 }),
  );
  gate.position.set(0, 35, -1280);
  group.add(gate);
  const gateLabel = textSprite('GATE · 35 M', '#ffd27f', 40);
  gateLabel.scale.set(42, 8, 1);
  gateLabel.position.set(0, 58, -1280);
  group.add(gateLabel);

  // --- drop markers for legs 3/4 ---
  for (const dz of [-1920, -2080]) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(12, 0.7, 8, 32),
      new THREE.MeshBasicMaterial({ color: 0x37d67a }),
    );
    ring.rotation.x = Math.PI / 2;
    ring.position.set(0, 1, dz);
    group.add(ring);
  }

  return {
    group, aurora,
    update(t) {
      for (let k = 0; k < aurora.length; k++) {
        aurora[k].material.opacity = 0.34 - (k % 3) * 0.06 + Math.sin(t * 0.5 + k * 1.7) * 0.08;
        aurora[k].position.y = 210 + (k % 3) * 26 + Math.sin(t * 0.22 + k) * 6;
      }
      gate.rotation.z = t * 0.25;
    },
  };
}

function buildStation(group, x, z, name) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // huts: dark boxes with lit amber windows
  const hutMat = mat(0x3a2c22, 0x000000, 0);
  const winMat = new THREE.MeshBasicMaterial({ color: 0xffb347 });
  const hutSpots = [[-38, -28], [-30, 18], [34, -20], [40, 26], [-44, 4]];
  for (const [hx, hz] of hutSpots) {
    const hut = new THREE.Mesh(new THREE.BoxGeometry(12, 6, 9), hutMat);
    hut.position.set(hx, 3, hz);
    g.add(hut);
    const roof = new THREE.Mesh(new THREE.ConeGeometry(8.5, 4, 4), mat(0xe8f2fa, 0x223850, 0.3));
    roof.position.set(hx, 8, hz);
    roof.rotation.y = Math.PI / 4;
    g.add(roof);
    for (let w = 0; w < 2; w++) {
      const win = new THREE.Mesh(new THREE.PlaneGeometry(1.8, 1.4), winMat);
      win.position.set(hx - 3 + w * 6, 3.4, hz + 4.6);
      g.add(win);
    }
  }
  // radio tower with a red beacon
  const tower = new THREE.Mesh(new THREE.CylinderGeometry(0.7, 1.4, 34, 6), mat(0x8a94a8));
  tower.position.set(52, 17, -34);
  g.add(tower);
  const beacon = new THREE.Mesh(new THREE.SphereGeometry(1.4, 10, 8), new THREE.MeshBasicMaterial({ color: 0xff3b30 }));
  beacon.position.set(52, 35, -34);
  g.add(beacon);
  const beaconLight = new THREE.PointLight(0xff3b30, 60, 120);
  beaconLight.position.set(52, 35, -34);
  g.add(beaconLight);
  // fuel drums: orange barrels by the strip
  const drumMat = mat(0xe86a1e, 0x431505, 0.4);
  for (let i = 0; i < 8; i++) {
    const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.1, 1.1, 2.4, 10), drumMat);
    drum.position.set(28 + (i % 4) * 3, 1.2, 40 + Math.floor(i / 4) * 3);
    g.add(drum);
  }
  // apron floodlight
  const flood = new THREE.PointLight(0xffc27a, 120, 160);
  flood.position.set(0, 18, 30);
  g.add(flood);
  group.add(g);
}

function buildStrip(group, x, z) {
  const g = new THREE.Group();
  g.position.set(x, 0, z);
  // the strip itself: packed snow, lighter than the ice around it so the
  // lit band reads, with a centreline
  const pad = new THREE.Mesh(new THREE.PlaneGeometry(24, 300), mat(0x5a6678, 0x2a3444, 0.5));
  pad.rotation.x = -Math.PI / 2;
  pad.position.y = 0.12;
  g.add(pad);
  const line = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 280), new THREE.MeshBasicMaterial({ color: 0xffd27f }));
  line.rotation.x = -Math.PI / 2;
  line.position.y = 0.2;
  g.add(line);
  // orange edge lights, both sides, every 20 m — the lit target ahead
  const edgeGeo = new THREE.SphereGeometry(0.9, 8, 6);
  const edgeMat = new THREE.MeshBasicMaterial({ color: 0xff7a1e });
  const edges = new THREE.InstancedMesh(edgeGeo, edgeMat, 32);
  const dummy = new THREE.Object3D();
  let i = 0;
  for (let k = 0; k < 16; k++) {
    for (const side of [-1, 1]) {
      dummy.position.set(side * 12.5, 0.8, -140 + k * 18.7);
      dummy.updateMatrix();
      edges.setMatrixAt(i++, dummy.matrix);
    }
  }
  g.add(edges);
  // threshold lights: green at the near end, red at the far end
  for (const [zz, col] of [[-150, 0x37d67a], [150, 0xff3b30]]) {
    for (const side of [-10, -3.3, 3.3, 10]) {
      const th = new THREE.Mesh(new THREE.SphereGeometry(1.1, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
      th.position.set(side, 0.9, zz);
      g.add(th);
    }
  }
  // windsock
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 9, 6), mat(0x8a94a8));
  pole.position.set(20, 4.5, -120);
  g.add(pole);
  const sock = new THREE.Mesh(new THREE.ConeGeometry(1.1, 5, 8), new THREE.MeshBasicMaterial({ color: 0xff7a1e }));
  sock.rotation.z = Math.PI / 2;
  sock.position.set(22.5, 8.6, -120);
  g.add(sock);
  group.add(g);
}
