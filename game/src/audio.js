// audio.js — procedural sound, no assets: a twin-turboprop drone whose pitch
// follows throttle, a wind wash, and short blips for score events. One job:
// make the game sound alive without loading a single file.
export function createAudio() {
  let ctx = null, osc1 = null, osc2 = null, gain = null, wind = null, windGain = null;
  let started = false;
  return {
    ensure() {
      if (started) return;
      try {
        ctx = new (window.AudioContext || window.webkitAudioContext)();
        gain = ctx.createGain(); gain.gain.value = 0.0; gain.connect(ctx.destination);
        osc1 = ctx.createOscillator(); osc1.type = 'sawtooth'; osc1.frequency.value = 55;
        osc2 = ctx.createOscillator(); osc2.type = 'square'; osc2.frequency.value = 110;
        const o1g = ctx.createGain(); o1g.gain.value = 0.5;
        const o2g = ctx.createGain(); o2g.gain.value = 0.25;
        osc1.connect(o1g); o1g.connect(gain);
        osc2.connect(o2g); o2g.connect(gain);
        // wind: looped noise through a low-pass
        const len = ctx.sampleRate * 2;
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
        wind = ctx.createBufferSource(); wind.buffer = buf; wind.loop = true;
        const filt = ctx.createBiquadFilter(); filt.type = 'lowpass'; filt.frequency.value = 400;
        windGain = ctx.createGain(); windGain.gain.value = 0.0;
        wind.connect(filt); filt.connect(windGain); windGain.connect(ctx.destination);
        osc1.start(); osc2.start(); wind.start();
        started = true;
      } catch { /* audio is a garnish: silence never blocks the game */ }
    },
    update(throttle, speed, onGround) {
      if (!started || !ctx) return;
      const t = ctx.currentTime;
      osc1.frequency.setTargetAtTime(45 + throttle * 55, t, 0.1);
      osc2.frequency.setTargetAtTime(90 + throttle * 110, t, 0.1);
      gain.gain.setTargetAtTime(onGround ? 0.02 + throttle * 0.05 : 0.05 + throttle * 0.06, t, 0.2);
      windGain.gain.setTargetAtTime(Math.min(0.12, speed * 0.0012), t, 0.3);
    },
    blip(freq = 880) {
      if (!started || !ctx) return;
      const o = ctx.createOscillator(); o.type = 'sine'; o.frequency.value = freq;
      const g = ctx.createGain();
      g.gain.setValueAtTime(0.12, ctx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25);
      o.connect(g); g.connect(ctx.destination);
      o.start(); o.stop(ctx.currentTime + 0.3);
    },
  };
}
