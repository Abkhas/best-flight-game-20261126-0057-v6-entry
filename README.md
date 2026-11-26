# AURORA FREIGHT — Arctic Night Cargo under the Northern Lights

A make.fun **best-flight-game-20261126-0057** entry (variant 6, for the FINAL).
A 3D three.js heavy twin-turboprop freighter flying night supply legs
between arctic research stations under the aurora. Callsign POLAR 7.

## The loop

Load cargo at the base (weight vs fuel is a real tradeoff) → fly the leg
between stations → land on a lit ice strip in the dark → unload → take the
next leg. Four legs with different goals, one whiteout closing in:

1. **STATION RESUPPLY** — 4.2 t of food + fuel drums, Eureka → Alert Station
2. **MEDEVAC PICKUP** — Dr Elin Voss, frostbite, Alert → Eureka, short strip
3. **FUEL CACHE RUN** — 3.0 t of fuel drums dropped by parachute over Gris Fjord
4. **AURORA SCIENCE DROP** — 4.0 t science pod released over Alexandra Fiord

Total cargo 12.0 t. The whiteout closes the strait in 18:00 — any aircraft
not down when it hits is lost.

## The depth layer (SQUALL LINE's 10 devices, adapted)

- Multi-part stage goals: each leg is load → fly → land → unload, with a
  visible manifest + stage checklist.
- A global countdown with stakes: WHITEOUT 18:00.
- A BINGO-fuel decision: `FUEL LOW: 1 DIVERT TO EUREKA / 2 PRESS ON` — and
  Alert has no fuel bowser, so the return leg flies on a half tank.
- A turnaround pick-1-of-3: de-ice boots / extra fuel tanks / cargo pods.
- Damage that turns flying into decisions: icing on the wings, engine temp,
  airframe on hard landings.
- A flight recorder + touchdown plan + incident log on the debrief.
- A named radio character: POLAR CONTROL · IVY, with a readable radio log.
- A strait chart + a full 8-gauge panel (airspeed, altitude, VS, heading,
  fuel, cargo, icing + warning lamps).
- A huge earned score + progress: per-tonne delivered + per-clean-landing,
  `DELIVERED n/12.0 T` + a BEST score.
- A second decision: `ICING BUILDING: 1 CLIMB ABOVE IT / 2 STAY LOW, DE-ICE NOW`.

## Flown proof

The capture harness flies two real legs through the game's own input path
(a proportional controller on `window.__kit.setDrive`) and lands on the ice
strip for real. All 4 shots in `checks.json` show one consistent state —
callsign POLAR 7, score 21,000, legsFlown 1, delivered 4.2 T, stars 3 —
and **73/73 checks pass, 0 failures** (zero console errors, zero failed
network requests).

- **Leg 1 — STATION RESUPPLY** (Eureka → Alert): load +1000, airborne
  +2000, gate +3000, then a soft touchdown on the Alert ice strip —
  sink 1.5 m/s, speed 48 KT, 2.4 m off-centreline, 86 m past threshold —
  +5000, unload +4000 → **15,000**, 4.2 T delivered, 3 stars,
  fuel 61% at unload.
- **Leg 2 — MEDEVAC PICKUP** (Alert → Eureka): load +1000, airborne
  +2000, gate +3000 → **21,000**. The BINGO-fuel decision genuinely
  fired at 40% fuel and was answered PRESS ON on the real input path
  (Digit2); the icing decision was answered DE-ICE, 52% → 5%.
- **Proof screen:** medal SILVER, RANK B, BEST 21,000, storm 16:20
  remaining, incident log clean — no hard landings, no icing events.
- **Cover score 21,000**, `DELIVERED 4.2 / 12.0 T`, `STARS 3 / 12` —
  earned, not staged. Only the camera position is staged for the shot.

## Controls

W/S throttle · arrows fly · A/D yaw · SPACE load / drop / unload · G gear ·
F flaps · C camera (chase / cockpit / tower) · 1/2 answer the decision ·
V debrief · M pilot log · P pause · R restart · mouse drag steers.

## Structure

- `game/index.html` — the HUD DOM + aurora theme (indigo / green / orange).
- `game/src/state.js` — the one session state; the single source of truth
  for every number (altitude FT, speed KT, fuel, cargo, score, progress).
- `game/src/flight-model.js` — fixed-wing physics + strips + icing + fuel.
- `game/src/missions.js` — the 4 legs, scoring, decisions, refits.
- `game/src/terrain.js` — the Ellesmere Strait: ice, ridges, fjord walls,
  stations, lit strips, aurora.
- `game/src/freighter.js` — the twin-turboprop freighter, built from parts.
- `game/src/camera.js` — chase / cockpit / tower cameras.
- `game/src/hud.js` — every HUD box, rendered from the state.
- `game/src/instruments.js` — the 8-gauge lit panel + compass strip.
- `game/src/chart.js` — the strait chart minimap.
- `game/src/radio.js` — POLAR CONTROL · IVY and the radio log.
- `game/src/recorder.js` — flight recorder chart + touchdown plan + incidents.
- `game/src/screens.js` — title / proof / pause / end / pilot log.
- `game/src/saves.js` — the pilot record (3 callsign slots, BEST, rank).
- `game/src/audio.js` — procedural turboprop + wind sound, no assets.
- `game/src/main.js` — bootstrap, loop, input, `window.__kit` staging API.
- `game/vendor/three.module.min.js` — vendored three.js.
- `main.ts` — hands game/ + screenshots/ to /output with a dossier.
- `capture.mjs` — flies the two legs in headless Chromium and takes the
  4 screenshots + contact sheet + `checks.json`.
- `screenshots/` — the 4 judged shots.

## Play

`node serve.ts`, then open http://localhost:8080.

## Status

Built for the FINAL of best-flight-game-20261126-0057 (cutoff Sat 28 Nov
07:57 WIB). DO NOT SUBMIT from this repo — the parent submits after the
duel gate + Khase's eye-check.
