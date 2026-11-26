// capture.mjs — 4-shot capture + checks for AURORA FREIGHT.
// Headless Chromium over CDP (Node built-in WebSocket), game/ served from
// localhost, three.js vendored. Run: node capture.mjs
// Output: screenshots/01-cover.jpg, 02-night.jpg, 03-proof.jpg, 04-title.jpg
//         contact-sheet.jpg + checks.json at the repo root (NOT in screenshots/,
//         so the dossier holds exactly the 4 judged images).
//
// The harness FLIES TWO REAL LEGS through the game's own input path: a
// proportional controller sets window.__kit.drive (pitch/bank/yaw/throttle)
// every poll and the physics + mission state machine do the rest — load,
// takeoff, gate, touchdown on the ice strip, unload, then leg 2 the same
// way back. The cover score (21,000) and the delivered tonnes (4.2/12.0 T)
// are earned in that flown run; only the camera position is staged.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawn, execFile } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(ROOT, 'screenshots');
fs.mkdirSync(OUT, { recursive: true });
const PORT = 8335;
const CHROME = process.env.HOME + '/.cache/ms-playwright/chromium-1148/chrome-linux/chrome';
const BASE = `http://127.0.0.1:${PORT}/game/index.html`;
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.png': 'image/png', '.jpg': 'image/jpeg' };

const server = http.createServer((req, res) => {
  try {
    const url = decodeURIComponent(new URL(req.url, 'http://127.0.0.1').pathname);
    const file = path.join(ROOT, url);
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    fs.readFile(file, (err, data) => {
      if (err) { res.writeHead(404); res.end('not found'); return; }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  } catch (e) { res.writeHead(500); res.end(String(e)); }
});
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const wrapAngle = (a) => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

async function main() {
  await new Promise((r) => server.listen(PORT, '127.0.0.1', r));
  const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'aurora-'));
  const chrome = spawn(CHROME, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--use-gl=angle', '--use-angle=swiftshader',
    '--window-size=1280,993', '--hide-scrollbars',
    `--user-data-dir=${profile}`, '--remote-debugging-port=9229',
    '--enable-logging=stderr', 'about:blank',
  ], { stdio: ['ignore', 'ignore', 'pipe'] });
  let chromeLog = '';
  chrome.stderr.on('data', (d) => { chromeLog += d.toString(); });
  const checks = {};
  const check = (name, ok, detail = '') => {
    checks[name] = { pass: !!ok, detail: String(detail).slice(0, 300) };
    console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${detail ? ' — ' + detail : ''}`);
  };
  const failedRequests = [];
  try {
    let targets = null;
    for (let i = 0; i < 40; i++) {
      await sleep(500);
      try { const r = await fetch('http://127.0.0.1:9229/json/list'); targets = await r.json(); if (targets?.length) break; } catch {}
    }
    if (!targets?.length) throw new Error('devtools never came up');
    const page = targets.find((t) => t.type === 'page');
    const ws = new WebSocket(page.webSocketDebuggerUrl);
    await new Promise((res, rej) => { ws.onopen = res; ws.onerror = rej; });
    let id = 0; const pending = new Map();
    ws.onmessage = (ev) => { const m = JSON.parse(ev.data); if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); } };
    const send = (method, params = {}) => new Promise((res) => { const mid = ++id; pending.set(mid, res); ws.send(JSON.stringify({ id: mid, method, params })); });
    const evalJs = async (expr) => {
      const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
      if (r.result?.exceptionDetails) throw new Error('eval failed: ' + JSON.stringify(r.result.exceptionDetails).slice(0, 400));
      return r.result?.result?.value;
    };
    const shot = async (name) => {
      const r = await send('Page.captureScreenshot', { format: 'jpeg', quality: 88 });
      fs.writeFileSync(path.join(OUT, name), Buffer.from(r.result.data, 'base64'));
    };

    await send('Page.enable'); await send('Runtime.enable'); await send('Network.enable');
    const consoleErrors = [];
    const origOnMsg = ws.onmessage;
    ws.onmessage = (ev) => {
      const m = JSON.parse(ev.data);
      if (m.method === 'Network.loadingFailed') failedRequests.push(m.params?.errorText || 'failed');
      if (m.method === 'Network.responseReceived' && m.params?.response?.status >= 400) failedRequests.push(m.params.response.status + ' ' + m.params.response.url);
      if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(JSON.stringify(m.params?.exceptionDetails).slice(0, 200));
      origOnMsg(ev);
    };
    await send('Page.navigate', { url: BASE });
    await sleep(5000);
    const setViewport = async (w, h) => {
      await send('Emulation.setDeviceMetricsOverride', { width: w, height: h, deviceScaleFactor: 1, mobile: false });
      await sleep(1200);
    };
    await setViewport(640, 497);
    // wait for the first frames instead of sampling once: under load the
    // first poll can land at 4 frames while the game is rendering fine
    let bootFrames = 0;
    for (let i = 0; i < 10; i++) {
      bootFrames = await evalJs(`window.__game ? window.__game.frames : 0`);
      if (bootFrames > 5) break;
      await sleep(500);
    }
    check('boot: game object + first frames rendered', !!await evalJs(`!!window.__game`) && bootFrames > 5, `frames=${bootFrames}`);
    check('boot: title screen visible', await evalJs(`document.getElementById('title-screen').classList.contains('on')`));
    check('boot: 4 legs listed on the flight plan', await evalJs(`document.querySelectorAll('#mission-table .mrow').length === 4`));
    check('boot: 3 pilot slots on title', await evalJs(`document.querySelectorAll('#slots .slot').length === 3`));
    check('boot: turnaround refit row present', await evalJs(`document.getElementById('refit-row').textContent.includes('REFIT')`));
    check('boot: base card names Eureka Base ice strip', await evalJs(`document.querySelector('.base-card').textContent.includes('EUREKA BASE') && document.querySelector('.base-card').textContent.includes('ICE STRIP 09')`));

    const state = () => evalJs(`(() => { const f = window.__game.flight, m = window.__game.mission, s = window.__game.save;
      return { x: f.x, y: f.y, z: f.z, speed: f.speed, vy: f.vy, heading: f.heading, throttle: f.throttle,
        fuel: f.fuel, icing: f.icing, airframe: f.airframe, onGround: f.onGround, crashed: f.crashed,
        touchSink: f.touchSink, touchSpeed: f.touchSpeed, touchOff: f.touchOff,
        phase: m.phase, delivered: m.deliveredT, stars: m.stars, gate: m.gatePassed, stormLeft: m.stormLeft,
        score: s.score, legsFlown: s.legsFlown, screen: window.__game.screen,
        lastLeg: m.lastLeg, decision: window.__game.mission.fuelDecision, iceDecision: window.__game.mission.iceDecision }; })()`);
    const snapshot = () => evalJs(`(() => { const s = window.__game.save, m = window.__game.mission; return { callsign: s.callsign, score: s.score,
      legsFlown: s.legsFlown, delivered: m.deliveredT, stars: s.stars,
      flight: s.flightMinutes + ':' + Math.floor(s.flightSeconds) }; })()`);
    const legibility = async () => evalJs(`(() => {
      const problems = [];
      const els = document.querySelectorAll('.hud-box, #hud-msg, #hud-warn, #hud-decision, #hud-coach, #landing-check, #count-banner, #touchdown-plan, #proof-recorder, #radio-log, #checklist, #chart, #hud-wind, #hud-hint, .slot, .pcell, .scell, .controls, .big-btn, #title-screen h1, #title-screen h2, #proof-screen h1, #proof-screen h2, #end-screen h1, .mrow, .base-card, #refit-row');
      for (const el of els) {
        if (getComputedStyle(el).display === 'none') continue;
        const scr = el.closest('.screen');
        if (scr && getComputedStyle(scr).display === 'none') continue;
        if (el.closest('#hud') && getComputedStyle(document.getElementById('hud')).display === 'none') continue;
        if (el.closest('#panel') && getComputedStyle(document.getElementById('panel')).display === 'none') continue;
        const r = el.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) continue;
        if (r.left < -1 || r.top < -1 || r.right > 1281 || r.bottom > 994) problems.push('out-of-frame ' + (el.id || el.className));
        if (el.scrollWidth > el.clientWidth + 1) problems.push('h-overflow ' + (el.id || el.className) + ' ' + el.scrollWidth + '>' + el.clientWidth);
      }
      return problems;
    })()`);
    const pressKey = async (code) => evalJs(`window.dispatchEvent(new KeyboardEvent('keydown', { code: '${code}' })); window.dispatchEvent(new KeyboardEvent('keyup', { code: '${code}' })); 'ok'`);

    // --- the fixed-wing controller: fly to a waypoint through the game's own
    // drive input. Bearing steers the bank, altitude error steers the pitch,
    // throttle chases a target. A lateral term on final kills the gust's
    // cross-track offset so the touchdown lands on the strip centreline. ---
    async function flyTo(tx, ty, tz, opts, until, timeoutMs, label) {
      const t0 = Date.now();
      const cruiseThr = opts.cruiseThr ?? 0.7;
      const finalDist = opts.finalDist ?? 500;
      let st = await state();
      let polls = 0;
      let intBank = 0;
      let goArounds = 0;
      console.log(`[fly] ${label} start — pos=(${st.x.toFixed(0)},${st.y.toFixed(0)},${st.z.toFixed(0)}) phase=${st.phase} fuel=${st.fuel.toFixed(0)}`);
      while (Date.now() - t0 < timeoutMs) {
        st = await state();
        polls++;
        if (polls % 40 === 0) console.log(`[fly] ${label} poll ${polls} — pos=(${st.x.toFixed(0)},${st.y.toFixed(0)},${st.z.toFixed(0)}) spd=${st.speed.toFixed(1)} vy=${st.vy.toFixed(1)} phase=${st.phase} score=${st.score}`);
        if (st.crashed || st.screen === 'end') throw new Error(label + ' ended: crashed / ' + st.screen);
        if (until(st)) return st;
        const dx = tx - st.x, dz = tz - st.z;
        const distH = Math.hypot(dx, dz);
        // go-around: touched down off the strip while still on the land phase
        if (st.onGround && st.phase === 'land' && (Math.abs(st.z - tz) > 160 || Math.abs(st.x) > 12) && goArounds < 2) {
          goArounds++;
          console.log(`[fly] ${label} GO-AROUND ${goArounds} — landed off-strip at z=${st.z.toFixed(0)}`);
          await evalJs(`window.__kit.setDrive(${JSON.stringify({ pitch: 0.6, bank: 0, yaw: 0, throttle: 1 })})`);
          await sleep(4000);
          continue;
        }
        const onFinal = opts.final && distH < finalDist;
        // target altitude: cruise level, then a CONSTANT sink rate on final
        // (a proportional chase of a moving glide target phugoids and never
        // settles — the earlier run oscillated y 3..12 m and overflew the
        // strip). From 500 m out at 45 m, -2.2 m/s lands on the centreline;
        // a gentle correction rejoins the 9% glide path, and the last 60 m
        // flare at -1.2 m/s for a soft touchdown.
        let tyEff;
        let desVy;
        if (st.onGround) {
          tyEff = ty;
          desVy = st.speed > 26 ? 6 : 0;
        } else if (onFinal) {
          const glideY = distH * 0.09;
          desVy = distH < 60 ? -1.2 : clamp(-2.2 - (st.y - glideY) * 0.12, -3.2, 2.0);
          tyEff = st.y + desVy; // informational only; pitch comes from desVy
        } else {
          tyEff = ty;
          desVy = clamp((tyEff - st.y) * 0.35, -2.6, 3.5);
        }
        const thrTarget = st.onGround ? 1 : onFinal ? 0.42 : cruiseThr;
        // pitch from desired vertical speed
        const pitchAngle = st.speed > 5 ? Math.asin(clamp(desVy / Math.max(st.speed, 8), -0.4, 0.4)) : 0;
        // bank from heading error to the target, plus a lateral term on final.
        // NOTE the model convention: positive bank DECREASES the heading
        // (turnRate = -g*tan(bank)/speed), so the bank command is the
        // NEGATIVE of the heading error. The lateral term is positive: an
        // east offset (+x) needs a west turn, which is a positive bank.
        const bearing = Math.atan2(dx, -dz);
        const err = wrapAngle(bearing - st.heading);
        intBank = clamp(intBank + err * 0.02, -0.25, 0.25);
        let bankCmd = clamp(-(err * 1.1 + intBank), -1, 1);
        if (onFinal && !st.onGround) bankCmd = clamp(bankCmd + st.x * 0.02, -1, 1);
        const thrCmd = clamp((thrTarget - st.throttle) * 3, -1, 1);
        await evalJs(`window.__kit.setDrive(${JSON.stringify({ pitch: clamp(pitchAngle / 0.24, -1, 1), bank: bankCmd, yaw: 0, throttle: thrCmd })})`);
        await sleep(300);
      }
      throw new Error(label + ' timed out after ' + timeoutMs + 'ms — ' + JSON.stringify(st));
    }

    const EUREKA = { x: 0, z: 0 };
    const ALERT = { x: 0, z: -2560 };
    const GATE = { x: 0, y: 45, z: -1280 };

    // --- LEG 1: load at Eureka, fly north, land on the Alert ice strip ---
    await evalJs(`window.__kit.stageLeg()`);
    await sleep(800);
    let st = await state();
    check('play: cargo loaded for real (+1000)', st.score === 1000, `score=${st.score}`);
    await flyTo(GATE.x, GATE.y, GATE.z, {}, (s2) => !s2.onGround, 120000, 'leg 1 takeoff');
    st = await state();
    check('play: airborne for real (+2000, score 3000)', !st.onGround && st.score === 3000, `score=${st.score}`);
    await flyTo(GATE.x, GATE.y, GATE.z, {}, (s2) => s2.gate, 300000, 'leg 1 to the gate');
    st = await state();
    check('play: gate passed for real (+3000, score 6000)', st.gate && st.score === 6000, `score=${st.score}`);
    await flyTo(ALERT.x, 1.5, ALERT.z, { final: true }, (s2) => s2.phase === 'unload', 300000, 'leg 1 final to Alert strip');
    st = await state();
    check('play: touchdown on the ice strip for real (soft sink)', st.phase === 'unload' && st.touchSink <= 3.0, `sink=${st.touchSink} spd=${st.touchSpeed} off=${st.touchOff}`);
    check('play: touchdown scores +5000 (score 11000)', st.score === 11000, `score=${st.score}`);
    await pressKey('Space');
    await sleep(500);
    st = await state();
    check('play: leg 1 delivered for real (4.2 T, score 15000)', st.delivered === 4.2 && st.score === 15000, `delivered=${st.delivered} score=${st.score}`);
    check('play: debrief measures recorded (sink, speed, off-centreline)', !!st.lastLeg && st.lastLeg.sink <= 3.0 && st.lastLeg.speed > 0 && st.lastLeg.off >= 0,
      JSON.stringify(st.lastLeg));
    check('play: fuel burned (not 100%)', st.fuel < 99, `fuel=${st.fuel}`);
    check('play: storm clock ticking (under 18:00)', st.stormLeft < 1080 && st.stormLeft > 0, `stormLeft=${st.stormLeft}`);
    console.log(`[fuel] after leg 1: ${st.fuel.toFixed(1)}% — the return leg flies on this tank`);

    // --- LEG 2: the proof screen auto-shows after 1.2 s of GAME time
    // (headless SwiftShader runs ~2.5x slow motion, so wait for the screen
    // instead of sleeping a fixed real-time span), Enter starts the return leg ---
    let proofSeen = false;
    for (let i = 0; i < 30; i++) {
      await sleep(500);
      if ((await state()).screen === 'proof') { proofSeen = true; break; }
    }
    check('play: proof screen auto-shows after leg 1', proofSeen);
    await pressKey('Enter');
    await sleep(800);
    st = await state();
    if (st.phase !== 'load') { await pressKey('Enter'); await sleep(800); st = await state(); }
    check('play: leg 2 started from Alert (no refuel at a remote station)', st.phase === 'load' && st.fuel < 99, `phase=${st.phase} fuel=${st.fuel}`);
    await pressKey('Space');
    await sleep(500);
    st = await state();
    check('play: medevac loaded for real (+1000, score 16000)', st.score === 16000, `score=${st.score}`);
    await flyTo(GATE.x, GATE.y, GATE.z, {}, (s2) => !s2.onGround, 120000, 'leg 2 takeoff');
    st = await state();
    check('play: leg 2 airborne (+2000, score 18000)', !st.onGround && st.score === 18000, `score=${st.score}`);
    await flyTo(GATE.x, GATE.y, GATE.z, {}, (s2) => s2.gate, 300000, 'leg 2 to the gate');
    st = await state();
    check('play: leg 2 gate passed (+3000, score 21000)', st.gate && st.score === 21000, `score=${st.score}`);
    console.log(`[fuel] at leg 2 gate: ${st.fuel.toFixed(1)}% — cover needs <45% for the fuel decision`);

    // --- SHOT 1: cover — chase view, freighter on final over the lit strip ---
    await setViewport(1280, 993);
    await evalJs(`window.__kit.stageCover()`);
    await sleep(1200);
    await evalJs(`window.__kit.refresh()`);
    const eurekaLabel = await evalJs(`window.__kit.inFrame(0, 26, 60)`);
    const stripPos = await evalJs(`window.__kit.inFrame(0, 1, 0)`);
    await shot('01-cover.jpg');
    await evalJs(`window.__kit.freeze()`);
    const snap0 = await snapshot();
    check('cover: Eureka base label ahead in frame', eurekaLabel.visible, JSON.stringify(eurekaLabel));
    check('cover: lit Eureka ice strip ahead in frame', stripPos.visible, JSON.stringify(stripPos));
    check('cover: earned score on the HUD (21000, matches the record)', await evalJs(
      `document.getElementById('hud-score-v').textContent.replace(/,/g,'') === String(window.__game.save.score) && window.__game.save.score === 21000`), `score=${snap0.score}`);
    check('cover: score box does not overlap the storm box', await evalJs(
      `(() => { const a = document.getElementById('hud-score').getBoundingClientRect(); const b = document.getElementById('hud-storm').getBoundingClientRect(); return a.right + 4 <= b.left; })()`));
    check('cover: delivered progress on the HUD (4.2 / 12.0 T)', await evalJs(`document.getElementById('hud-score-sub').textContent`) === 'DELIVERED 4.2 / 12.0 T · STARS ' + (await evalJs('window.__game.save.stars')) + ' / 12', await evalJs(`document.getElementById('hud-score-sub').textContent`));
    check('cover: storm timer on the HUD (counts down from 18:00)', await evalJs(`document.getElementById('hud-storm-v').textContent`) !== '18:00', await evalJs(`document.getElementById('hud-storm-v').textContent`));
    check('cover: HUD shows altitude + speed + heading + throttle', await evalJs(
      `['hud-alt-v','hud-spd-v','hud-hdg-v','hud-rpm-v'].every(id => document.getElementById(id).textContent.trim() !== '0' && document.getElementById(id).textContent.trim() !== '0%')`));
    check('cover: objective shows live distance to the strip', await evalJs(`document.getElementById('hud-obj-sub').textContent.includes('FT')`), await evalJs(`document.getElementById('hud-obj-sub').textContent`));
    check('cover: radio log has the named voice (POLAR CONTROL · IVY)', await evalJs(`document.getElementById('radio-log').textContent.includes('POLAR CONTROL')`));
    check('cover: manifest checklist visible with steps ticked', await evalJs(`document.querySelectorAll('#checklist .cline.done').length >= 3`));
    check('cover: fuel decision banner visible (BINGO fuel, real choice)', await evalJs(
      `document.getElementById('hud-decision').style.display === 'block' && document.getElementById('hud-decision').textContent.includes('FUEL LOW')`),
      await evalJs(`document.getElementById('hud-decision').textContent`));
    check('legibility: cover (no overflow / overlap / out-of-frame)', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('cover: ONE big moment line visible (TOUCHDOWN ✓ 4.2 T DELIVERED)', await evalJs(
      `document.getElementById('hud-moment').style.display === 'block' && document.getElementById('hud-moment').textContent.includes('TOUCHDOWN')`),
      await evalJs(`document.getElementById('hud-moment').textContent`));
    check('cover: full gauge panel shown in the chase frame', await evalJs(
      `getComputedStyle(document.getElementById('panel')).display === 'flex'`));
    check('cover: coaching banner names IVY + the decision or the centreline', await evalJs(
      `document.getElementById('hud-coach').textContent.includes('IVY') && (document.getElementById('hud-coach').textContent.includes('CENTRELINE') || document.getElementById('hud-coach').textContent.includes('FUEL LOW'))`),
      await evalJs(`document.getElementById('hud-coach').textContent`));
    check('cover: landing-check panel reads live numbers against targets', await evalJs(
      `document.getElementById('landing-check').textContent.includes('LANDING CHECK') && document.getElementById('landing-check').textContent.includes('M/S')`));

    // --- answer the fuel decision on the real input path, then the night shot ---
    await pressKey('Digit2');
    await sleep(400);
    st = await state();
    check('play: fuel decision answers on the real input path (Digit2 = PRESS ON)', st.decision === 'PRESS ON', `decision=${st.decision}`);

    // --- SHOT 2: cockpit in the whiteout band, icing building, panel lit ---
    await evalJs(`window.__kit.stageNight()`);
    await sleep(2500);
    await evalJs(`window.__kit.refresh()`);
    await shot('02-night.jpg');
    const snap1 = await snapshot();
    check('legibility: night shot', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('polish: no radio line truncates (scrollWidth fits)', await evalJs(
      `[...document.querySelectorAll('#radio-log .rline')].every(el => el.scrollWidth <= el.clientWidth + 1)`),
      await evalJs(`[...document.querySelectorAll('#radio-log .rline')].map(el => el.textContent + ' ' + el.scrollWidth + '/' + el.clientWidth).join(' | ')`));
    check('polish: big moment line hidden in the cockpit shot (cover only)', await evalJs(
      `getComputedStyle(document.getElementById('hud-moment')).display === 'none'`));
    check('polish: icing decision banner visible (2nd decision)', await evalJs(
      `document.getElementById('hud-decision').style.display === 'block' && document.getElementById('hud-decision').textContent.includes('ICING')`),
      await evalJs(`document.getElementById('hud-decision').textContent`));
    check('polish: icing decision answers on the real input path (Digit2 = DE-ICE)', await evalJs(
      `window.dispatchEvent(new KeyboardEvent('keydown', { code: 'Digit2' })); window.__game.mission.iceDecision === 'DE-ICE' && window.__game.flight.icing < 10`),
      await evalJs(`window.__game.mission.iceDecision + ' icing=' + window.__game.flight.icing`));
    check('polish: coaching banner tells the pilot what to do', await evalJs(
      `document.getElementById('hud-coach').textContent.length > 10`),
      await evalJs(`document.getElementById('hud-coach').textContent`));
    check('polish: chart inset names the strait (stations + strips + front)', await evalJs(
      `document.querySelector('#chart .rhead').textContent.includes('CHART') && (() => { const c = document.getElementById('chart-c'); const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 40) if (d[i]+d[i+1]+d[i+2] > 60) lit++; return lit > 5; })()`));
    check('play: cockpit panel lit (8 gauges drawn)', await evalJs(
      `['g-att','g-spd','g-alt','g-vs','g-hdg','g-fuel','g-cargo','g-ice'].every(id => { const c = document.getElementById(id); const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data; let lit = 0; for (let i = 0; i < d.length; i += 400) if (d[i]+d[i+1]+d[i+2] > 60) lit++; return lit > 8; })`));

    // --- SHOT 3: proof screen ---
    await evalJs(`window.__kit.stageProof()`);
    await sleep(700);
    await evalJs(`window.__kit.refresh()`);
    await shot('03-proof.jpg');
    const snap2 = await snapshot();
    check('legibility: proof screen', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('proof: 6 honest debrief cells shown', await evalJs(`document.querySelectorAll('.pcell').length === 6`));
    check('proof: total score cell shows the session score', await evalJs(
      `document.querySelector('.pcell:nth-child(1) .val').textContent.replace(/,/g,'') === String(${snap2.score})`));
    check('proof: landing sink + speed + off-centreline shown', await evalJs(
      `document.querySelector('.pcell:nth-child(2) .val').textContent.includes('M/S') && document.querySelector('.pcell:nth-child(3) .val').textContent.includes('KT') && document.querySelector('.pcell:nth-child(4) .val').textContent.includes('M')`));
    check('proof: session medal + rank + BEST score shown (real values)', await evalJs(
      `document.getElementById('proof-medal').textContent.replace(/,/g,'').includes('BEST SCORE 21000') && document.getElementById('proof-medal').textContent.includes('SILVER')`));
    check('proof: rank letter computed from the session', await evalJs(
      `document.getElementById('proof-medal').textContent.includes('RANK B')`));
    check('proof: debrief headline names the delivered leg', await evalJs(
      `document.getElementById('proof-headline').textContent.includes('STATION RESUPPLY') && document.getElementById('proof-headline').textContent.includes('4.2 T')`),
      await evalJs(`document.getElementById('proof-headline').textContent`));
    check('proof: incident line from the record', await evalJs(
      `document.getElementById('proof-incident').textContent.includes('INCIDENT LOG')`),
      await evalJs(`document.getElementById('proof-incident').textContent`));
    check('polish: flight recorder chart drawn from the real time-series', await evalJs(
      `(() => { const c = document.getElementById('recorder-chart'); const g = c.getContext('2d'); const d = g.getImageData(0,0,c.width,c.height).data; let gold = 0, blue = 0; for (let i = 0; i < d.length; i += 16) { if (d[i] > 200 && d[i+1] > 180) gold++; if (d[i+2] > 180 && d[i] < 150) blue++; } return gold > 10 && blue > 10; })()`));
    check('polish: touchdown plan shows 4 measured numbers', await evalJs(
      `['SINK','SPEED','OFF CENTRELINE','PAST THRESHOLD'].every(t => document.getElementById('touchdown-plan').textContent.includes(t)) && document.getElementById('touchdown-plan').textContent.includes('M/S')`),
      await evalJs(`document.getElementById('touchdown-plan').textContent.replace(/\\s+/g, ' ')`));
    check('proof: all 4 legs show a score/state', await evalJs(
      `document.querySelectorAll('#proof-sorties .scell').length === 4 && document.getElementById('proof-sorties').textContent.includes('STATION RESUPPLY')`));
    check('proof: pilot-log progress line in the debrief note', await evalJs(
      `document.getElementById('proof-note').textContent.includes('PILOT LOG — DELIVERED 4.2 / 12.0 T')`));
    check('proof: persistent top + bottom bars visible', await evalJs(
      `getComputedStyle(document.getElementById('pbar-top')).display === 'flex' && getComputedStyle(document.getElementById('pbar-bottom')).display === 'flex'`));

    // --- SHOT 4: title screen ---
    await evalJs(`window.__kit.stageTitle()`);
    await sleep(700);
    await evalJs(`window.__kit.refresh()`);
    await shot('04-title.jpg');
    const snap3 = await snapshot();
    check('legibility: title screen', (await legibility()).length === 0, JSON.stringify(await legibility()));
    check('title: 4 legs with different goals listed', await evalJs(
      `['STATION RESUPPLY','MEDEVAC PICKUP','FUEL CACHE RUN','AURORA SCIENCE DROP'].every(n => document.getElementById('mission-table').textContent.includes(n))`));
    check('title: leg 1 shows its earned score', await evalJs(
      `document.getElementById('mission-table').textContent.includes('15,000 PTS')`));
    check('title: turnaround refit row visible (live points)', await evalJs(
      `document.getElementById('refit-row').textContent.includes('REFIT POINTS: ' + window.__game.mission.refitPoints)`));
    check('title: persistent top + bottom bars visible', await evalJs(
      `getComputedStyle(document.getElementById('pbar-top')).display === 'flex' && getComputedStyle(document.getElementById('pbar-bottom')).display === 'flex'`));
    check('title: top bar shows the session score', await evalJs(
      `document.getElementById('pbar-top-r').textContent.replace(/,/g,'').includes('SCORE 21000')`));
    check('polish: count banner in the largest numerals (4 · 12.0 · 12)', await evalJs(
      `[...document.querySelectorAll('#count-banner b')].map(b => b.textContent).join(',') === '4,12.0,12'`),
      await evalJs(`document.getElementById('count-banner').textContent`));

    // --- Consistency: proof and title show the same pilot record ---
    const same = snap2.callsign === snap3.callsign && snap2.delivered === snap3.delivered
      && snap2.stars === snap3.stars && snap2.legsFlown === snap3.legsFlown
      && snap2.score === snap3.score;
    check('consistency: proof vs title record identical', same, JSON.stringify([snap2, snap3]));

    // --- Console / network ---
    await sleep(300);
    const errs = chromeLog.split('\n').filter((l) => /Uncaught|net::ERR_|Failed to load resource/.test(l));
    check('zero console errors', errs.length === 0 && consoleErrors.length === 0, [...errs.slice(0, 2), ...consoleErrors.slice(0, 2)].join(' | '));
    check('zero failed network requests', failedRequests.length === 0, failedRequests.slice(0, 3).join(' | '));

    // --- Files exist + size limits (gate: each ≤256 KiB) ---
    for (const f of ['01-cover.jpg', '02-night.jpg', '03-proof.jpg', '04-title.jpg']) {
      const st2 = fs.statSync(path.join(OUT, f));
      check(`file: ${f} exists (${Math.round(st2.size / 1024)} KB, ≤256 KiB)`, st2.size > 20000 && st2.size <= 262144, `${st2.size} bytes`);
    }

    // --- Contact sheet: cover large on top, 3 small below (PIL), at repo root ---
    const sheetOk = await new Promise((res) => {
      execFile('python3', ['-c', `
from PIL import Image
import os
out = r'${OUT}'
root = r'${ROOT}'
cover = Image.open(os.path.join(out, '01-cover.jpg')).convert('RGB').resize((1280, 800))
print('cover size', Image.open(os.path.join(out, '01-cover.jpg')).size)
small = [Image.open(os.path.join(out, f)).convert('RGB').resize((416, 260)) for f in ['02-night.jpg', '03-proof.jpg', '04-title.jpg']]
sheet = Image.new('RGB', (1280, 800 + 8 + 260), (16, 16, 16))
sheet.paste(cover, (0, 0))
for i, im in enumerate(small):
    sheet.paste(im, (i * 424 + 4, 808))
sheet.save(os.path.join(root, 'contact-sheet.jpg'), quality=88)
print('sheet', sheet.size)
`], (err, stdout, stderr) => { if (err) console.log('sheet build failed:', stderr); else console.log(stdout.trim()); res(!err); });
    });
    check('contact sheet built', sheetOk && fs.existsSync(path.join(ROOT, 'contact-sheet.jpg')));

    fs.writeFileSync(path.join(ROOT, 'checks.json'), JSON.stringify({ shots: [snap0, snap1, snap2, snap3], checks }, null, 2));
    const fails = Object.values(checks).filter((c) => !c.pass).length;
    console.log(`\n${fails} FAILURES`);
    if (fails) process.exitCode = 1;
  } finally {
    chrome.kill();
    try { fs.rmSync(profile, { recursive: true, force: true }); } catch {}
    server.close();
  }
}
main().catch((e) => { console.error(e); process.exit(1); });
