let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    ctx = new (window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export function playChipClick(): void {
  try {
    const c = getCtx();
    if (!c) return;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.connect(gain);
    gain.connect(c.destination);
    osc.frequency.value = 900;
    osc.type = 'sine';
    gain.gain.setValueAtTime(0.12, c.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, c.currentTime + 0.07);
    osc.start(c.currentTime);
    osc.stop(c.currentTime + 0.07);
  } catch { /* audio blocked */ }
}

export function playBallRattle(): () => void {
  try {
    const c = getCtx();
    if (!c) return () => {};
    const bufSize = Math.floor(c.sampleRate * 7);
    const buf = c.createBuffer(1, bufSize, c.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < bufSize; i++) data[i] = Math.random() * 2 - 1;

    const source = c.createBufferSource();
    source.buffer = buf;

    const filter = c.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.value = 800;
    filter.Q.value = 2;

    const gain = c.createGain();
    gain.gain.setValueAtTime(0.28, c.currentTime);
    gain.gain.linearRampToValueAtTime(0.07, c.currentTime + 5.5);
    gain.gain.linearRampToValueAtTime(0, c.currentTime + 7);

    source.connect(filter);
    filter.connect(gain);
    gain.connect(c.destination);
    source.start();
    return () => { try { source.stop(); } catch { /* already ended */ } };
  } catch {
    return () => {};
  }
}

export function playWin(): void {
  try {
    const c = getCtx();
    if (!c) return;
    [523.25, 659.25, 783.99, 1046.5].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.frequency.value = freq;
      osc.type = 'sine';
      const t = c.currentTime + i * 0.11;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.18, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      osc.start(t);
      osc.stop(t + 0.45);
    });
  } catch { /* audio blocked */ }
}

export function playLoss(): void {
  try {
    const c = getCtx();
    if (!c) return;
    [280, 210].forEach((freq, i) => {
      const osc = c.createOscillator();
      const gain = c.createGain();
      osc.connect(gain);
      gain.connect(c.destination);
      osc.frequency.value = freq;
      osc.type = 'sawtooth';
      const t = c.currentTime + i * 0.18;
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.12, t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.38);
      osc.start(t);
      osc.stop(t + 0.38);
    });
  } catch { /* audio blocked */ }
}
