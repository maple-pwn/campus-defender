/**
 * Audio - Procedural sound effects via Web Audio API.
 *
 * Zero external dependencies. All sounds are synthesized in real-time.
 * Gracefully degrades if Web Audio is unavailable.
 *
 * Usage:
 *   AudioFX.init();
 *   AudioFX.play('keypress');
 *   AudioFX.play('success');
 *   AudioFX.play('error');
 *   AudioFX.play('levelComplete');
 *   AudioFX.play('crack');
 *   AudioFX.play('badge');
 */

var AudioFX = {
  _ctx: null,
  _enabled: true,
  _volume: 0.08,

  /** Initialize the AudioContext (must be called from a user gesture). */
  init: function () {
    try {
      var AudioCtx = window.AudioContext || window.webkitAudioContext;
      if (AudioCtx) {
        this._ctx = new AudioCtx();
      }
    } catch (_e) {
      this._enabled = false;
    }
  },

  /** Ensure context is running (unlocks after user gesture). */
  _resume: function () {
    if (!this._ctx) return false;
    if (this._ctx.state === 'suspended') {
      this._ctx.resume();
    }
    return true;
  },

  /**
   * Play a named sound effect.
   * @param {string} name  One of: keypress, success, error, levelComplete, crack, badge, enter
   */
  play: function (name) {
    if (!this._enabled || !this._ctx) return;
    this._resume();
    switch (name) {
      case 'keypress':  this._keypress();  break;
      case 'success':   this._success();   break;
      case 'error':     this._error();     break;
      case 'levelComplete': this._levelComplete(); break;
      case 'crack':     this._crack();     break;
      case 'badge':     this._badge();     break;
      case 'enter':     this._enter();     break;
    }
  },

  // ---- Internal sound generators ----

  /** Short mechanical click — like a real keyboard switch. */
  _keypress: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;

    // Noise burst for the "click" body
    var bufferSize = ctx.sampleRate * 0.015;
    var buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    var data = buffer.getChannelData(0);
    for (var i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.15));
    }
    var noise = ctx.createBufferSource();
    noise.buffer = buffer;

    var bandpass = ctx.createBiquadFilter();
    bandpass.type = 'bandpass';
    bandpass.frequency.value = 2800;
    bandpass.Q.value = 0.8;

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(v * 1.2, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.025);

    noise.connect(bandpass);
    bandpass.connect(gain);
    gain.connect(ctx.destination);
    noise.start(now);
    noise.stop(now + 0.03);
  },

  /** Slightly deeper click for Enter key. */
  _enter: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;

    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(60, now + 0.04);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(v * 0.6, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.06);
  },

  /** Short rising tone — command acknowledged. */
  _success: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;

    var osc = ctx.createOscillator();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(520, now);
    osc.frequency.linearRampToValueAtTime(780, now + 0.08);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(v, now);
    gain.gain.setValueAtTime(v, now + 0.06);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.15);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.18);
  },

  /** Low buzz — something went wrong. */
  _error: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;

    var osc = ctx.createOscillator();
    osc.type = 'square';
    osc.frequency.setValueAtTime(150, now);
    osc.frequency.linearRampToValueAtTime(100, now + 0.15);

    var gain = ctx.createGain();
    gain.gain.setValueAtTime(v * 0.5, now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.22);
  },

  /** Ascending arpeggio — level complete! */
  _levelComplete: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;
    var notes = [523, 659, 784, 1047]; // C5 E5 G5 C6

    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      osc.type = 'triangle';
      var startTime = now + i * 0.12;
      osc.frequency.setValueAtTime(notes[i], startTime);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(v, startTime + 0.03);
      gain.gain.setValueAtTime(v, startTime + 0.15);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.4);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.45);
    }
  },

  /** Dramatic descending sequence — password cracked! */
  _crack: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;

    // Phase 1: rapid scanning beeps
    for (var i = 0; i < 6; i++) {
      var osc1 = ctx.createOscillator();
      osc1.type = 'square';
      var t1 = now + i * 0.06;
      osc1.frequency.setValueAtTime(800 + Math.random() * 400, t1);

      var g1 = ctx.createGain();
      g1.gain.setValueAtTime(v * 0.3, t1);
      g1.gain.exponentialRampToValueAtTime(0.0001, t1 + 0.04);

      osc1.connect(g1);
      g1.connect(ctx.destination);
      osc1.start(t1);
      osc1.stop(t1 + 0.05);
    }

    // Phase 2: success chord
    var chordNotes = [523, 659, 784];
    for (var j = 0; j < chordNotes.length; j++) {
      var osc2 = ctx.createOscillator();
      osc2.type = 'triangle';
      var t2 = now + 0.4;
      osc2.frequency.setValueAtTime(chordNotes[j], t2);

      var g2 = ctx.createGain();
      g2.gain.setValueAtTime(0, t2);
      g2.gain.linearRampToValueAtTime(v * 0.7, t2 + 0.05);
      g2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.6);

      osc2.connect(g2);
      g2.connect(ctx.destination);
      osc2.start(t2);
      osc2.stop(t2 + 0.65);
    }
  },

  /** Sparkle chime — badge earned! */
  _badge: function () {
    var ctx = this._ctx;
    var now = ctx.currentTime;
    var v = this._volume;
    var notes = [880, 1109, 1319, 1760]; // A5 C#6 E6 A6

    for (var i = 0; i < notes.length; i++) {
      var osc = ctx.createOscillator();
      osc.type = 'sine';
      var startTime = now + i * 0.1;
      osc.frequency.setValueAtTime(notes[i], startTime);

      var gain = ctx.createGain();
      gain.gain.setValueAtTime(0, startTime);
      gain.gain.linearRampToValueAtTime(v * 0.5, startTime + 0.02);
      gain.gain.setValueAtTime(v * 0.5, startTime + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.5);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(startTime);
      osc.stop(startTime + 0.55);
    }
  },
};
