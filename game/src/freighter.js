// freighter.js — the heavy twin-turboprop freighter "POLAR 7", built from
// primitives so the aircraft LOOKS built: a long high-wing fuselage in
// orange/white AURORA FREIGHT livery, twin engines with spinning props, a
// T-tail, a rear cargo ramp, landing gear, nav lights and landing lights.
// One job: build the mesh and pose it from the flight state.
import * as THREE from 'three';

function mat(color, emissive = 0x000000, ei = 0, rough = 0.6) {
  return new THREE.MeshStandardMaterial({ color, emissive, emissiveIntensity: ei, roughness: rough, metalness: 0.15 });
}

function liveryTexture() {
  // Fuselage side livery: orange cheatline + "AURORA FREIGHT · POLAR 7".
  const c = document.createElement('canvas');
  c.width = 1024; c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = '#f2f5f7';
  g.fillRect(0, 0, 1024, 128);
  g.fillStyle = '#e86a1e';
  g.fillRect(0, 78, 1024, 22);
  g.fillStyle = '#0e2a44';
  g.font = 'bold 52px "Arial Narrow", sans-serif';
  g.textBaseline = 'middle';
  g.fillText('AURORA FREIGHT', 30, 46);
  g.font = 'bold 34px "Courier New", monospace';
  g.fillStyle = '#e86a1e';
  g.fillText('POLAR 7', 700, 46);
  const tex = new THREE.CanvasTexture(c);
  tex.anisotropy = 4;
  return tex;
}

export function buildFreighter(scene) {
  const group = new THREE.Group();
  const orange = mat(0xe86a1e);
  const white = mat(0xf2f5f7);
  const dark = mat(0x1d2637);
  const grey = mat(0x8a94a8);

  // fuselage: a long cylinder, white below, orange above, with the livery
  const fus = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.5, 11, 14), white);
  fus.rotation.x = Math.PI / 2;
  group.add(fus);
  const topStripe = new THREE.Mesh(new THREE.CylinderGeometry(1.52, 1.52, 11, 14, 1, true, 0, Math.PI), orange);
  topStripe.rotation.x = Math.PI / 2;
  topStripe.rotation.z = Math.PI / 2;
  topStripe.position.y = 0.02;
  group.add(topStripe);
  // livery boards on both flanks
  const liv = liveryTexture();
  for (const side of [-1, 1]) {
    const board = new THREE.Mesh(
      new THREE.PlaneGeometry(9, 1.1),
      new THREE.MeshBasicMaterial({ map: liv }),
    );
    board.position.set(side * 1.52, 0.15, 0.5);
    board.rotation.y = side * Math.PI / 2;
    group.add(board);
  }
  // nose + cockpit windows
  const nose = new THREE.Mesh(new THREE.SphereGeometry(1.5, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2), white);
  nose.rotation.x = Math.PI / 2;
  nose.position.z = -5.5;
  group.add(nose);
  const glassMat = new THREE.MeshStandardMaterial({ color: 0x0a1a2a, emissive: 0x2a5a8a, emissiveIntensity: 0.7, roughness: 0.2, metalness: 0.4 });
  const glass = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.8, 0.5), glassMat);
  glass.position.set(0, 0.75, -5.1);
  glass.rotation.x = -0.35;
  group.add(glass);
  // rear ramp (slightly lowered, the cargo door the manifest goes through)
  const ramp = new THREE.Mesh(new THREE.BoxGeometry(2.6, 0.35, 2.2), grey);
  ramp.position.set(0, -0.9, 6.2);
  ramp.rotation.x = 0.35;
  group.add(ramp);
  const tailCone = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 1.5, 2.5, 12), white);
  tailCone.rotation.x = Math.PI / 2;
  tailCone.position.z = 6.2;
  group.add(tailCone);

  // high wing + struts
  const wing = new THREE.Mesh(new THREE.BoxGeometry(16, 0.35, 2.6), white);
  wing.position.set(0, 1.55, -0.6);
  group.add(wing);
  const wingTipL = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, 2.6), orange);
  wingTipL.position.set(-8, 1.55, -0.6);
  group.add(wingTipL);
  const wingTipR = wingTipL.clone();
  wingTipR.position.x = 8;
  group.add(wingTipR);
  for (const side of [-1, 1]) {
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.18, 2.2, 0.18), grey);
    strut.position.set(side * 4.2, 0.4, -0.6);
    strut.rotation.z = side * 0.5;
    group.add(strut);
  }

  // twin engines + spinning props
  const props = [];
  for (const side of [-1, 1]) {
    const nacelle = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.85, 3.2, 12), orange);
    nacelle.rotation.x = Math.PI / 2;
    nacelle.position.set(side * 3.4, 0.9, -1.2);
    group.add(nacelle);
    const prop = new THREE.Group();
    prop.position.set(side * 3.4, 0.9, -2.9);
    for (let b = 0; b < 3; b++) {
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.28, 3.4, 0.08), dark);
      blade.rotation.z = (b * Math.PI * 2) / 3;
      prop.add(blade);
    }
    const hub = new THREE.Mesh(new THREE.SphereGeometry(0.35, 10, 8), grey);
    prop.add(hub);
    // prop blur disc: reads as a spinning prop at speed
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(1.75, 24),
      new THREE.MeshBasicMaterial({ color: 0x9aa8b8, transparent: true, opacity: 0.16, side: THREE.DoubleSide }),
    );
    prop.add(disc);
    group.add(prop);
    props.push(prop);
  }

  // T-tail
  const fin = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3.2, 2.4), orange);
  fin.position.set(0, 2.6, 6.4);
  group.add(fin);
  const stab = new THREE.Mesh(new THREE.BoxGeometry(6.4, 0.3, 1.8), white);
  stab.position.set(0, 4.1, 6.4);
  group.add(stab);

  // landing gear: nose + two mains
  for (const [gx, gz] of [[0, -3.6], [-1.3, 1.6], [1.3, 1.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.14, 1.6, 8), dark);
    leg.position.set(gx, -1.9, gz);
    group.add(leg);
    const wheel = new THREE.Mesh(new THREE.CylinderGeometry(0.55, 0.55, 0.4, 12), mat(0x0a0c10, 0, 0, 0.9));
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(gx, -2.7, gz);
    group.add(wheel);
  }

  // nav lights: red port, green starboard, white tail
  const navLights = [];
  for (const [x, col] of [[-8.2, 0xff3b30], [8.2, 0x37d67a]]) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.22, 8, 6), new THREE.MeshBasicMaterial({ color: col }));
    l.position.set(x, 1.55, -0.6);
    group.add(l);
    navLights.push(l);
  }
  const tailLight = new THREE.Mesh(new THREE.SphereGeometry(0.2, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }));
  tailLight.position.set(0, 4.1, 7.4);
  group.add(tailLight);

  // landing lights: two bright cones + spotlights under the wing
  const spots = [];
  for (const side of [-1, 1]) {
    const spot = new THREE.SpotLight(0xffe9b0, 260, 220, 0.32, 0.5, 1.2);
    spot.position.set(side * 3.4, 0.4, -2.4);
    spot.target.position.set(side * 3.4, -6, -60);
    group.add(spot);
    group.add(spot.target);
    spots.push(spot);
    const lens = new THREE.Mesh(new THREE.SphereGeometry(0.3, 8, 6), new THREE.MeshBasicMaterial({ color: 0xfff2c0 }));
    lens.position.set(side * 3.4, 0.4, -2.4);
    group.add(lens);
  }

  scene.add(group);
  return {
    group, props, spots,
    update(s, dt) {
      const f = s.flight;
      group.position.set(f.x, f.y + 1.5, f.z);
      group.rotation.set(0, f.heading, 0);
      group.rotation.x = f.pitch;
      group.rotation.z = f.bank;
      // props spin with throttle
      const spin = (0.4 + f.throttle * 38) * dt;
      for (const p of props) p.rotation.z += spin;
      // landing lights only with gear down
      for (const sp of spots) sp.intensity = f.gear ? 260 : 0;
    },
  };
}
