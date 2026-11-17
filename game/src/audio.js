// All of Neon Salvage's sound is synthesised here with WebAudio: no audio files, just
// oscillators shaped by gain envelopes. The context is created lazily on the first user
// gesture (a browser will not start one before that), every voice is short, and a single
// master gain keeps the whole kit at a civil volume. M toggles mute.

export function createAudio() {
  let context = null;
  let master = null;
  let muted = false;

  /** Start the context if a gesture has unlocked it. Safe to call on every press. */
  function resume() {
    if (context === null) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (!AudioCtor) return;
      context = new AudioCtor();
      master = context.createGain();
      master.gain.value = muted ? 0 : 0.42;
      master.connect(context.destination);
    }
    if (context.state === 'suspended') context.resume();
  }

  /** One shaped tone: frequency glides to `slideTo` if given, volume swells and dies over `seconds`. */
  function tone({ freq, slideTo = null, seconds = 0.15, type = 'sine', volume = 0.5, delay = 0 }) {
    if (context === null || muted) return;
    const start = context.currentTime + delay;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (slideTo !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), start + seconds);
    gain.gain.setValueAtTime(0, start);
    gain.gain.linearRampToValueAtTime(volume, start + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.001, start + seconds);
    osc.connect(gain);
    gain.connect(master);
    osc.start(start);
    osc.stop(start + seconds + 0.05);
  }

  return {
    resume,
    get muted() {
      return muted;
    },
    toggleMute() {
      muted = !muted;
      if (master !== null) master.gain.value = muted ? 0 : 0.42;
      return muted;
    },
    /** The launch blip when a run starts. */
    click() {
      tone({ freq: 660, slideTo: 880, seconds: 0.09, type: 'triangle', volume: 0.35 });
    },
    /** A core hauled in: the note climbs with the combo it landed in. */
    pickup(combo) {
      const step = Math.min(combo, 8);
      const base = 520 * 2 ** ((step - 1) * 2 / 12);
      tone({ freq: base, seconds: 0.1, type: 'sine', volume: 0.4 });
      tone({ freq: base * 1.5, seconds: 0.14, type: 'sine', volume: 0.3, delay: 0.05 });
    },
    /** The shield orb taken: a soft rising triad. */
    shieldUp() {
      tone({ freq: 392, seconds: 0.12, type: 'triangle', volume: 0.35 });
      tone({ freq: 523, seconds: 0.12, type: 'triangle', volume: 0.35, delay: 0.07 });
      tone({ freq: 784, seconds: 0.2, type: 'triangle', volume: 0.35, delay: 0.14 });
    },
    /** The shield eats a hit: a glassy descending crack. */
    shieldBreak() {
      tone({ freq: 1180, slideTo: 340, seconds: 0.22, type: 'square', volume: 0.22 });
    },
    /** Hull damage: a low thud with a buzz on top. */
    hit() {
      tone({ freq: 170, slideTo: 42, seconds: 0.28, type: 'sawtooth', volume: 0.5 });
      tone({ freq: 90, slideTo: 30, seconds: 0.3, type: 'square', volume: 0.3 });
    },
    /** A level up: four quick notes up the scale. */
    levelUp() {
      const notes = [523, 659, 784, 1046];
      for (let index = 0; index < notes.length; index += 1) {
        tone({ freq: notes[index], seconds: 0.12, type: 'triangle', volume: 0.35, delay: index * 0.06 });
      }
    },
    /** The drone goes down: a long falling sweep. */
    gameOver() {
      tone({ freq: 420, slideTo: 55, seconds: 0.8, type: 'sawtooth', volume: 0.4 });
      tone({ freq: 210, slideTo: 40, seconds: 0.9, type: 'triangle', volume: 0.3, delay: 0.08 });
    },
    /** The contract completes: a small fanfare. */
    win() {
      const notes = [523, 659, 784, 1046, 784, 1046, 1318];
      for (let index = 0; index < notes.length; index += 1) {
        tone({ freq: notes[index], seconds: 0.16, type: 'triangle', volume: 0.36, delay: index * 0.09 });
      }
    },
  };
}
