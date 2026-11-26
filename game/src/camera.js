// camera.js — three cameras, one job each, and none of them fights the pilot.
// chase: close behind and above the freighter, the aircraft big in frame.
// cockpit: at the nose, over the lit panel, the strip lights ahead.
// tower: a fixed wide shot from the destination station, for the title screen.
import * as THREE from 'three';
import { destStrip } from './missions.js';

export function createCameraRig(scene) {
  const camera = new THREE.PerspectiveCamera(62, 1280 / 993, 0.1, 6000);
  scene.add(camera);
  return {
    camera,
    update(s, dt) {
      const f = s.flight;
      const fh = Math.sin(f.heading), fz = -Math.cos(f.heading);
      const rh = Math.cos(f.heading), rz = Math.sin(f.heading);
      if (s.ui.camera === 'cockpit') {
        // nose-mounted: 6 m ahead of the centre, just forward of the opaque
        // windshield glass box (local z -5.1) — the first version sat 0.25 m
        // behind that box and stared at its back, so the shot was flat blue.
        // Now the ice, the strip lights and the station fill the lower frame,
        // the aurora the top; the canopy struts + panel frame it as a cockpit.
        camera.position.set(f.x + fh * 6.0, f.y + 2.5, f.z + fz * 6.0);
        camera.lookAt(f.x + fh * 90, f.y - 10 + f.pitch * 40, f.z + fz * 90);
      } else if (s.ui.camera === 'tower') {
        const st = destStrip(s);
        camera.position.set(38, 26, st.z + 90);
        camera.lookAt(f.x, f.y + 2, f.z);
      } else {
        // chase: 21 m behind, 5 m above, 7 m to the starboard side — a 3/4
        // rear view, so the flank + livery read and the strip stays ahead.
        // The freighter fills a third of the frame without its tail fin
        // blocking the centre of the picture.
        const back = 21, up = 5, side = 7;
        camera.position.set(f.x - fh * back + rh * side, f.y + up, f.z - fz * back + rz * side);
        camera.lookAt(f.x + fh * 35, f.y + 0.5, f.z + fz * 35);
      }
      camera.updateProjectionMatrix();
    },
    // Project a world point into the 1280x993 frame: used by the checks to
    // prove the gate and the strip are geometrically in frame on the cover.
    inFrame(x, y, z) {
      const v = new THREE.Vector3(x, y, z).project(camera);
      const px = (v.x * 0.5 + 0.5) * 1280;
      const py = (-v.y * 0.5 + 0.5) * 993;
      return { visible: v.z < 1 && px >= 0 && px <= 1280 && py >= 0 && py <= 993, x: Math.round(px), y: Math.round(py) };
    },
  };
}
