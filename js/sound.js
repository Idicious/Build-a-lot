/* Sound effects synthesized with the Web Audio API, so the game ships no audio files. */
(function (root) {
  const STORE_KEY = 'lotbylot.sound.v1';
  let ctx = null;
  let master = null;
  let noiseBuffer = null;
  let muted = load();
  const lastPlayed = {};

  function load() {
    try { return localStorage.getItem(STORE_KEY) === 'off'; } catch (e) { return false; }
  }
  function save() {
    try { localStorage.setItem(STORE_KEY, muted ? 'off' : 'on'); } catch (e) { /* storage unavailable */ }
  }

  // Browsers only allow audio after a user gesture, so this is first called from a click or tap.
  function ensure() {
    if (!ctx) {
      const AC = root.AudioContext || root.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
      noiseBuffer = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
      const d = noiseBuffer.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function envelope(t, dur, vol, attack = 0.005) {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    g.connect(master);
    return g;
  }

  function tone(freq, { at = 0, dur = 0.15, vol = 0.4, type = 'sine', to = null } = {}) {
    const t = ctx.currentTime + at;
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t);
    if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur);
    osc.connect(envelope(t, dur, vol));
    osc.start(t);
    osc.stop(t + dur + 0.02);
  }

  function noise({ at = 0, dur = 0.1, vol = 0.3, filter = 'bandpass', freq = 1200, q = 1 } = {}) {
    const t = ctx.currentTime + at;
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer;
    const f = ctx.createBiquadFilter();
    f.type = filter;
    f.frequency.value = freq;
    f.Q.value = q;
    src.connect(f);
    f.connect(envelope(t, dur, vol, 0.002));
    src.start(t, Math.random() * 0.5);
    src.stop(t + dur + 0.02);
  }

  const notes = (list, opts) => list.forEach((f, i) => tone(f, Object.assign({}, opts, { at: i * (opts.step || 0.08) })));

  const SOUNDS = {
    click: () => tone(1800, { dur: 0.03, vol: 0.08, type: 'triangle' }),
    coin: () => { tone(988, { dur: 0.09, vol: 0.18, type: 'square' }); tone(1319, { at: 0.07, dur: 0.28, vol: 0.18, type: 'square' }); },
    sell: () => notes([784, 988, 1175, 1568], { dur: 0.22, vol: 0.16, type: 'square', step: 0.06 }),
    buy: () => { noise({ dur: 0.05, vol: 0.25, freq: 3000 }); tone(1568, { at: 0.04, dur: 0.35, vol: 0.2, type: 'triangle' }); tone(2093, { at: 0.04, dur: 0.35, vol: 0.12, type: 'sine' }); },
    materials: () => { tone(150, { dur: 0.16, vol: 0.45, to: 60 }); noise({ dur: 0.08, vol: 0.2, filter: 'lowpass', freq: 600 }); },
    mill: () => { tone(130, { dur: 0.12, vol: 0.2, to: 70 }); noise({ dur: 0.06, vol: 0.08, filter: 'lowpass', freq: 500 }); },
    hammer: () => [0, 0.13, 0.26].forEach((at) => { noise({ at, dur: 0.05, vol: 0.35, freq: 2200, q: 3 }); tone(420, { at, dur: 0.06, vol: 0.15, type: 'triangle', to: 300 }); }),
    crash: () => { noise({ dur: 0.45, vol: 0.4, filter: 'lowpass', freq: 900 }); tone(90, { dur: 0.4, vol: 0.35, to: 40 }); },
    hire: () => { tone(880, { dur: 0.12, vol: 0.15, type: 'sine', to: 1320 }); tone(1320, { at: 0.14, dur: 0.2, vol: 0.15, type: 'sine', to: 1760 }); },
    done: () => notes([1047, 1319, 1568], { dur: 0.4, vol: 0.15, type: 'sine', step: 0.07 }),
    goal: () => notes([523, 659, 784, 1047], { dur: 0.3, vol: 0.18, type: 'triangle', step: 0.09 }),
    win: () => {
      notes([523, 659, 784], { dur: 0.18, vol: 0.2, type: 'square', step: 0.12 });
      tone(1047, { at: 0.36, dur: 0.7, vol: 0.2, type: 'square' });
      tone(784, { at: 0.36, dur: 0.7, vol: 0.12, type: 'triangle' });
    },
    error: () => { tone(180, { dur: 0.12, vol: 0.2, type: 'square', to: 140 }); tone(140, { at: 0.12, dur: 0.14, vol: 0.2, type: 'square', to: 110 }); },
  };

  function play(name) {
    if (muted || !SOUNDS[name] || !ensure()) return;
    // Several events of one kind in the same frame play once.
    const now = ctx.currentTime;
    if (lastPlayed[name] && now - lastPlayed[name] < 0.06) return;
    lastPlayed[name] = now;
    SOUNDS[name]();
  }

  function setMuted(value) {
    muted = value;
    save();
    if (!muted) ensure();
  }

  // Unlock audio on the first interaction so sounds from the game clock can play later.
  const unlock = () => { if (!muted) ensure(); root.removeEventListener('pointerdown', unlock); root.removeEventListener('keydown', unlock); };
  root.addEventListener('pointerdown', unlock);
  root.addEventListener('keydown', unlock);

  root.BAL = Object.assign(root.BAL || {}, { sound: { play, setMuted, isMuted: () => muted } });
})(typeof self !== 'undefined' ? self : this);
