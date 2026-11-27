/* Sound + particle kit, carried over from the first version of the game. */
(() => {
  "use strict";
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  class SoundKit {
    constructor() {
      this.ctx = null;
      this.master = null;
      this.enabled = true;
      this.sfx = true;
      this.wantMusic = true;
      this.ready = false;
      this.noiseBuffer = null;
      this.musicBus = null;
      this.musicConvolver = null;
      this.musicWet = null;
      this.musicSequence = null;
      this.musicPlaying = false;
      this.musicStarting = false;
      this.musicTimer = 0;
      this.musicStep = 0;
      this.musicNextTime = 0;
      this.musicStepDuration = 60 / 96 / 4;
      this.musicFade = null;
      this.musicLoopBuffer = null;
      this.musicSource = null;
      // Background music: a royalty-free track from Pixabay
      // ("Puzzle Game Loop" by Cyberwave-Orchestra, Pixabay Content License).
      // The synthesized tune below is only a fallback if the file can't load
      // (e.g. opening index.html straight from disk).
      this.musicTrackUrl = "assets/music/puzzle-game-loop.mp3";
      this.musicTrackLevel = 0.22;
      this.musicTrackGain = null;
      this.musicTrackFetch = null;
      this.musicTrackLoading = false;
      this.musicTrackFailed = false;
      this.musicLoopStart = 0;
      this.musicLoopEnd = 0;
      this.musicStartedAt = 0;
      this.musicOffset = 0;
      this.prefetchMusicTrack();
    }

    prefetchMusicTrack() {
      if (this.musicTrackFetch) return this.musicTrackFetch;
      if (typeof fetch !== "function" || location.protocol === "file:") {
        this.musicTrackFetch = Promise.reject(new Error("no fetch"));
      } else {
        this.musicTrackFetch = fetch(this.musicTrackUrl).then((res) => {
          if (!res.ok) throw new Error(`music ${res.status}`);
          return res.arrayBuffer();
        });
      }
      this.musicTrackFetch.catch(() => {});
      return this.musicTrackFetch;
    }

    init() {
      if (this.ctx) {
        if (this.ctx.state !== "running") {
          // A resume() that started outside a user gesture can hang forever on mobile;
          // retry from this gesture instead.
          this.musicStarting = false;
          this.ctx
            .resume()
            .then(() => {
              if (this.enabled) this.startMusic();
            })
            .catch(() => {});
        }
        if (this.enabled) this.startMusic();
        return;
      }

      // iOS: play through the ringer/silent switch like a game or video would,
      // instead of the default "ambient" session that the silent switch mutes.
      try {
        if (navigator.audioSession) navigator.audioSession.type = "playback";
      } catch (error) {
        /* not supported */
      }

      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return;

      try {
        this.ctx = new AudioContextClass();
        const compressor = this.ctx.createDynamicsCompressor();
        compressor.threshold.value = -20;
        compressor.knee.value = 18;
        compressor.ratio.value = 5;
        compressor.attack.value = 0.003;
        compressor.release.value = 0.2;
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.48;
        this.master.connect(compressor);
        compressor.connect(this.ctx.destination);
        this.ready = true;
        // iOS/Safari: after a call, Siri or another app takes audio the context goes
        // "interrupted"/"suspended"; try to get it back instead of staying silent.
        this.ctx.onstatechange = () => {
          const state = this.ctx && this.ctx.state;
          if ((state === "interrupted" || state === "suspended") && !document.hidden && this.enabled && this.wantMusic) {
            this.ctx.resume().catch(() => {});
          }
        };
        this.setupMusicGraph();
        if (this.ctx.state === "suspended") {
          this.ctx
            .resume()
            .then(() => {
              if (this.enabled) this.startMusic();
            })
            .catch(() => {});
        } else if (this.enabled) {
          this.startMusic();
        }
      } catch (error) {
        this.ctx = null;
        this.ready = false;
      }
    }

    setupMusicGraph() {
      if (!this.ctx || !this.master || this.musicBus) return;
      const ctx = this.ctx;
      // musicFade: fade in/out for both the pre-rendered loop and the live fallback.
      const fade = ctx.createGain();
      fade.gain.value = 0.0001;
      fade.connect(this.master);
      const trackGain = ctx.createGain();
      trackGain.gain.value = this.musicTrackLevel;
      trackGain.connect(fade);
      this.musicTrackGain = trackGain;
      const bus = ctx.createGain();
      bus.connect(fade);

      const convolver = ctx.createConvolver();
      const length = Math.floor(ctx.sampleRate * 1.6);
      const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
      for (let channel = 0; channel < 2; channel += 1) {
        const data = impulse.getChannelData(channel);
        for (let i = 0; i < length; i += 1) {
          const decay = Math.pow(1 - i / length, 2.7);
          data[i] = (Math.random() * 2 - 1) * decay * 0.5;
        }
      }
      convolver.buffer = impulse;
      const wet = ctx.createGain();
      wet.gain.value = 0.24;
      bus.connect(convolver);
      convolver.connect(wet);
      wet.connect(fade);

      this.musicFade = fade;
      this.musicBus = bus;
      this.musicConvolver = convolver;
      this.musicWet = wet;
    }

    buildMusicSequence() {
      if (this.musicSequence) return this.musicSequence;

      // Original tune: a breezy bossa-pop loop in F major (16 bars, 16th-note grid).
      const SEMI = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
      const hz = (name) => {
        const m = /^([A-G])(b|#)?(\d)$/.exec(name);
        const midi = 12 * (Number(m[3]) + 1) + SEMI[m[1]] + (m[2] === "b" ? -1 : m[2] === "#" ? 1 : 0);
        return 440 * Math.pow(2, (midi - 69) / 12);
      };

      const STEPS_PER_BAR = 16;
      const chords = {
        Fmaj7: { root: "F2", fifth: "C3", voicing: ["F3", "A3", "C4", "E4"] },
        Dm7: { root: "D2", fifth: "A2", voicing: ["A3", "C4", "D4", "F4"] },
        Gm7: { root: "G2", fifth: "D3", voicing: ["G3", "Bb3", "D4", "F4"] },
        C7: { root: "C3", fifth: "G2", voicing: ["G3", "Bb3", "C4", "E4"] },
        Bbmaj7: { root: "Bb2", fifth: "F2", voicing: ["Bb3", "D4", "F4", "A4"] },
        Am7: { root: "A2", fifth: "E2", voicing: ["G3", "A3", "C4", "E4"] },
      };
      // each bar: one chord, or two chords split at the half bar
      const bars = [
        ["Fmaj7"], ["Dm7"], ["Gm7"], ["C7"], ["Fmaj7"], ["Dm7"], ["Gm7"], ["C7"],
        ["Bbmaj7"], ["Am7"], ["Gm7"], ["C7"], ["Bbmaj7"], ["Am7"], ["Dm7"], ["Gm7", "C7"],
      ];
      // melody: [step, note, lengthInSteps] per bar
      const melody = [
        [[0, "A4", 3], [3, "C5", 3], [6, "E5", 2], [8, "D5", 2], [10, "C5", 4]],
        [[2, "D5", 2], [4, "F5", 4], [8, "E5", 2], [10, "D5", 2], [12, "A4", 4]],
        [[0, "Bb4", 3], [3, "D5", 3], [6, "F5", 2], [8, "E5", 2], [10, "D5", 2], [12, "C5", 4]],
        [[0, "E5", 4], [4, "G5", 2], [6, "F5", 2], [8, "E5", 6]],
        [[0, "A4", 3], [3, "C5", 3], [6, "E5", 2], [8, "D5", 2], [10, "C5", 4]],
        [[2, "F5", 2], [4, "A5", 4], [8, "G5", 2], [10, "F5", 2], [12, "D5", 4]],
        [[0, "D5", 2], [2, "C5", 2], [4, "Bb4", 2], [6, "D5", 2], [8, "C5", 4], [12, "G4", 4]],
        [[0, "G4", 3], [3, "Bb4", 3], [6, "E5", 2], [8, "F5", 6]],
        [[0, "D5", 2], [2, "F5", 2], [4, "A5", 6], [10, "G5", 2], [12, "F5", 4]],
        [[0, "E5", 3], [3, "C5", 3], [6, "A4", 2], [8, "C5", 2], [10, "E5", 2], [12, "G5", 4]],
        [[0, "F5", 3], [3, "D5", 3], [6, "Bb4", 2], [8, "D5", 2], [10, "F5", 2], [12, "A5", 4]],
        [[0, "G5", 4], [4, "E5", 4], [8, "C5", 2], [10, "Bb4", 2], [12, "G4", 4]],
        [[0, "F5", 2], [2, "D5", 2], [4, "F5", 2], [6, "A5", 6], [12, "G5", 2], [14, "F5", 2]],
        [[0, "E5", 6], [6, "C5", 2], [8, "E5", 2], [10, "G5", 6]],
        [[0, "F5", 4], [4, "E5", 2], [6, "D5", 2], [8, "A4", 4], [12, "C5", 4]],
        [[0, "Bb4", 2], [2, "D5", 2], [4, "C5", 4], [8, "E5", 2], [10, "G5", 2], [12, "Bb5", 4]],
      ];

      const total = bars.length * STEPS_PER_BAR;
      const sequence = Array.from({ length: total }, () => []);
      const add = (step, event) => sequence[step % total].push(event);
      const sec = (steps) => steps * this.musicStepDuration;

      // bossa strum pattern (step, volume, direction)
      const strum = [[0, 1], [3, 0.55], [6, 0.8], [10, 0.6], [12, 0.75]];
      const shaker = [0, 2, 4, 6, 8, 10, 12, 14];

      bars.forEach((names, bar) => {
        const base = bar * STEPS_PER_BAR;
        const chordAt = (s) => chords[names.length === 2 && s >= 8 ? names[1] : names[0]];

        strum.forEach(([s, vol], i) => {
          const chord = chordAt(s);
          chord.voicing.forEach((note, n) => {
            add(base + s, {
              voice: "pluck",
              freq: hz(note),
              offset: (i % 2 ? chord.voicing.length - 1 - n : n) * 0.014,
              duration: s === 0 || s === 6 ? 0.9 : 0.45,
              volume: 0.011 * vol,
              pan: (n - 1.5) * 0.18,
            });
          });
        });

        // walking-ish bass: root, fifth, little pickup
        const c1 = chordAt(0);
        const c2 = chordAt(8);
        add(base, { voice: "bass", freq: hz(c1.root), duration: sec(5), volume: 0.05 });
        add(base + 6, { voice: "bass", freq: hz(c1.fifth), duration: sec(2), volume: 0.03 });
        add(base + 8, { voice: "bass", freq: hz(c2.root === c1.root ? c2.fifth : c2.root), duration: sec(4), volume: 0.04 });
        add(base + 14, { voice: "bass", freq: hz(c2.root) * 1.5, duration: sec(1.5), volume: 0.022 });

        add(base, { voice: "kick", volume: 0.07 });
        add(base + 10, { voice: "kick", volume: 0.045 });
        shaker.forEach((s) => add(base + s, { voice: "shaker", volume: s % 4 === 2 ? 0.014 : 0.008 }));
        if (bar % 2 === 1) add(base + 8, { voice: "rim", volume: 0.03 });

        melody[bar].forEach(([s, note, len]) => {
          add(base + s, {
            voice: "kalimba",
            freq: hz(note),
            duration: Math.max(0.35, sec(len) * 1.6),
            volume: 0.05,
            pan: 0.06,
          });
        });
      });

      this.musicSequence = sequence;
      return sequence;
    }

    startMusic() {
      if (!this.enabled || !this.wantMusic || !this.ctx || !this.master) return;
      if (this.musicPlaying || this.musicStarting) return;
      if (!this.musicBus) this.setupMusicGraph();
      if (!this.musicBus || !this.musicFade) return;

      if (this.ctx.state !== "running") {
        this.musicStarting = true;
        this.ctx
          .resume()
          .then(() => {
            this.musicStarting = false;
            if (this.enabled && !this.musicPlaying) this.startMusic();
          })
          .catch(() => {
            this.musicStarting = false;
          });
        return;
      }

      this.buildMusicSequence();
      const now = this.ctx.currentTime;
      try {
        this.musicFade.gain.cancelScheduledValues(now);
        this.musicFade.gain.setValueAtTime(
          Math.max(0.0001, this.musicFade.gain.value),
          now
        );
        this.musicFade.gain.linearRampToValueAtTime(0.85, now + 1.1);
      } catch (error) {
        /* The graph can be missing on very old browsers */
      }

      this.musicStep = 0;
      this.musicNextTime = now + 0.18;
      this.musicPlaying = true;
      window.clearInterval(this.musicTimer);
      document.body.classList.add("is-music-playing");
      if (this.musicLoopBuffer) {
        this.startMusicLoop(this.musicNextTime);
        return;
      }
      if (!this.musicTrackFailed) {
        // Starts playing as soon as the track is decoded.
        this.loadMusicTrack();
        return;
      }
      this.startSynthMusic();
    }

    // Fallback: the synthesized tune, scheduled live from the main thread.
    startSynthMusic() {
      if (!this.musicPlaying || this.musicTimer || !this.ctx) return;
      this.musicStep = 0;
      this.musicNextTime = this.ctx.currentTime + 0.1;
      this.pumpMusic();
      this.musicTimer = window.setInterval(() => this.pumpMusic(), 100);
    }

    stopMusic() {
      this.musicStarting = false;
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
      this.musicPlaying = false;
      document.body.classList.remove("is-music-playing");
      if (!this.ctx || !this.musicFade) return;

      const now = this.ctx.currentTime;
      try {
        this.musicFade.gain.cancelScheduledValues(now);
        this.musicFade.gain.setValueAtTime(
          Math.max(0.0001, this.musicFade.gain.value),
          now
        );
        this.musicFade.gain.exponentialRampToValueAtTime(0.0001, now + 0.38);
      } catch (error) {
        /* Already silent */
      }
      if (this.musicSource) {
        const span = this.musicLoopEnd - this.musicLoopStart;
        if (span > 0) {
          const played = Math.max(0, now - this.musicStartedAt) + this.musicOffset;
          this.musicOffset = played % span;
        }
        try {
          this.musicSource.stop(now + 0.42);
        } catch (error) {
          /* already stopped */
        }
        this.musicSource = null;
      }
    }

    // Play the music track as a seamless looping buffer on the audio thread,
    // so a busy main thread (cascades, particles, screen shake) can't make it
    // stutter. Resumes from where it stopped (e.g. after switching apps).
    startMusicLoop(when) {
      if (!this.ctx || !this.musicFade || !this.musicLoopBuffer || !this.musicTrackGain) return;
      window.clearInterval(this.musicTimer);
      this.musicTimer = 0;
      if (this.musicSource) {
        try {
          this.musicSource.stop();
        } catch (error) {
          /* already stopped */
        }
      }
      const at = Math.max(when, this.ctx.currentTime + 0.02);
      const src = this.ctx.createBufferSource();
      src.buffer = this.musicLoopBuffer;
      src.loop = true;
      src.loopStart = this.musicLoopStart;
      src.loopEnd = this.musicLoopEnd;
      src.connect(this.musicTrackGain);
      src.start(at, this.musicLoopStart + this.musicOffset);
      this.musicSource = src;
      this.musicStartedAt = at;
      try {
        const g = this.musicFade.gain;
        g.cancelScheduledValues(this.ctx.currentTime);
        g.setValueAtTime(0.0001, at);
        g.linearRampToValueAtTime(0.85, at + 0.8);
      } catch (error) {
        /* very old browsers */
      }
    }

    loadMusicTrack() {
      if (this.musicLoopBuffer || this.musicTrackLoading || this.musicTrackFailed || !this.ctx) return;
      this.musicTrackLoading = true;
      const ctx = this.ctx;
      const decode = (data) =>
        new Promise((resolve, reject) => {
          // callback form works on old Safari; newer browsers also return a promise
          const p = ctx.decodeAudioData(data, resolve, reject);
          if (p && typeof p.then === "function") p.then(resolve, reject);
        });
      this.prefetchMusicTrack()
        .then((data) => decode(data.slice(0)))
        .then((buffer) => {
          this.musicTrackLoading = false;
          if (this.ctx !== ctx) return;
          // MP3 encoders pad the start/end with silence; loop only the real audio.
          const a = buffer.getChannelData(0);
          const b = buffer.numberOfChannels > 1 ? buffer.getChannelData(1) : a;
          const loud = (i) => Math.abs(a[i]) > 0.0005 || Math.abs(b[i]) > 0.0005;
          let first = 0;
          let last = buffer.length - 1;
          while (first < last && !loud(first)) first += 1;
          while (last > first && !loud(last)) last -= 1;
          this.musicLoopStart = first / buffer.sampleRate;
          this.musicLoopEnd = (last + 1) / buffer.sampleRate;
          this.musicOffset = 0;
          this.musicLoopBuffer = buffer;
          if (this.musicPlaying && !this.musicSource) this.startMusicLoop(ctx.currentTime);
        })
        .catch(() => {
          this.musicTrackLoading = false;
          this.musicTrackFailed = true;
          if (this.musicPlaying && !this.musicSource) this.startSynthMusic();
        });
    }

    pumpMusic() {
      if (!this.musicPlaying || !this.ctx || !this.musicBus || !this.musicSequence) {
        return;
      }
      const now = this.ctx.currentTime;
      if (this.musicNextTime < now - 0.04) {
        // Returning from a throttled background tab: continue the tune from
        // here instead of firing a pile of overdue notes.
        this.musicNextTime = now + 0.05;
      }
      // Long look-ahead so short main-thread stalls don't leave gaps.
      const horizon = now + 1.2;
      let guard = 0;
      while (this.musicNextTime < horizon && guard < 24) {
        const events = this.musicSequence[this.musicStep];
        this.musicStepSwing = this.musicStep % 2 === 1 ? this.musicStepDuration * 0.18 : 0;
        if (events && events.length) {
          events.forEach((event) => this.scheduleMusicEvent(event, this.musicNextTime));
        }
        this.musicStep = (this.musicStep + 1) % this.musicSequence.length;
        this.musicNextTime += this.musicStepDuration;
        guard += 1;
      }
    }

    routeMusic(node, pan = 0) {
      if (!this.ctx || !this.musicBus) return;
      if (typeof this.ctx.createStereoPanner === "function") {
        const panner = this.ctx.createStereoPanner();
        panner.pan.value = clamp(pan, -1, 1);
        node.connect(panner);
        panner.connect(this.musicBus);
      } else {
        node.connect(this.musicBus);
      }
    }

    scheduleMusicEvent(event, when) {
      if (!this.enabled) return;
      // gentle swing on the off-beat 16ths
      const t = when + (this.musicStepSwing || 0) + (event.offset || 0);
      if (event.voice === "kalimba") this.playMusicKalimba(event, t);
      else if (event.voice === "pluck") this.playMusicPluck(event, t);
      else if (event.voice === "bass") this.playMusicBass(event, t);
      else if (event.voice === "kick") this.playMusicKick(event, t);
      else if (event.voice === "shaker") this.playMusicNoise(event, t, 7000, 0.05);
      else if (event.voice === "rim") this.playMusicNoise(event, t, 2400, 0.04);
    }

    playMusicKalimba(event, when) {
      if (!this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.006);
      out.gain.exponentialRampToValueAtTime(event.volume * 0.35, start + 0.18);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      this.routeMusic(out, event.pan || 0);
      const body = ctx.createOscillator();
      body.type = "sine";
      body.frequency.setValueAtTime(event.freq, start);
      body.connect(out);
      // metallic tine partial that fades quickly
      const tine = ctx.createOscillator();
      tine.type = "sine";
      tine.frequency.setValueAtTime(event.freq * 5.4, start);
      const tineGain = ctx.createGain();
      tineGain.gain.setValueAtTime(0.22, start);
      tineGain.gain.exponentialRampToValueAtTime(0.001, start + 0.09);
      tine.connect(tineGain);
      tineGain.connect(out);
      const oct = ctx.createOscillator();
      oct.type = "triangle";
      oct.frequency.setValueAtTime(event.freq * 2, start);
      const octGain = ctx.createGain();
      octGain.gain.value = 0.08;
      oct.connect(octGain);
      octGain.connect(out);
      [body, tine, oct].forEach((o) => {
        o.start(start);
        o.stop(start + event.duration + 0.05);
      });
    }

    playMusicPluck(event, when) {
      if (!this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.004);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.Q.value = 0.7;
      filter.frequency.setValueAtTime(3200, start);
      filter.frequency.exponentialRampToValueAtTime(700, start + 0.25);
      filter.connect(out);
      this.routeMusic(out, event.pan || 0);
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(event.freq, start);
      osc.connect(filter);
      const sub = ctx.createOscillator();
      sub.type = "triangle";
      sub.frequency.setValueAtTime(event.freq, start);
      const subGain = ctx.createGain();
      subGain.gain.value = 1.4;
      sub.connect(subGain);
      subGain.connect(filter);
      [osc, sub].forEach((o) => {
        o.start(start);
        o.stop(start + event.duration + 0.05);
      });
    }

    playMusicKick(event, when) {
      if (!this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(event.volume, start);
      out.gain.exponentialRampToValueAtTime(0.0001, start + 0.28);
      out.connect(this.musicBus);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(120, start);
      osc.frequency.exponentialRampToValueAtTime(48, start + 0.16);
      osc.connect(out);
      osc.start(start);
      osc.stop(start + 0.3);
    }

    playMusicNoise(event, when, cutoff, length) {
      if (!this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      if (!this.musicNoiseBuffer) {
        const len = Math.floor(ctx.sampleRate * 0.2);
        const buf = ctx.createBuffer(1, len, ctx.sampleRate);
        const data = buf.getChannelData(0);
        for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1;
        this.musicNoiseBuffer = buf;
      }
      const start = Math.max(when, ctx.currentTime + 0.003);
      const src = ctx.createBufferSource();
      src.buffer = this.musicNoiseBuffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "highpass";
      filter.frequency.value = cutoff;
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.004);
      out.gain.exponentialRampToValueAtTime(0.0001, start + length);
      src.connect(filter);
      filter.connect(out);
      this.routeMusic(out, 0.1);
      src.start(start);
      src.stop(start + length + 0.02);
    }

    playMusicBell(event, when) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.008);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      this.routeMusic(out, event.pan || 0);

      const fundamental = ctx.createOscillator();
      fundamental.type = "sine";
      fundamental.frequency.setValueAtTime(event.freq, start);
      fundamental.connect(out);

      const glint = ctx.createOscillator();
      glint.type = "triangle";
      glint.frequency.setValueAtTime(event.freq * 2.01, start);
      const glintGain = ctx.createGain();
      glintGain.gain.value = 0.11;
      glint.connect(glintGain);
      glintGain.connect(out);

      fundamental.start(start);
      glint.start(start);
      fundamental.stop(start + event.duration + 0.05);
      glint.stop(start + event.duration + 0.05);
    }

    playMusicPad(event, when) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.28);
      out.gain.setValueAtTime(event.volume, start + event.duration * 0.55);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      this.routeMusic(out, event.pan || 0);

      const warm = ctx.createOscillator();
      warm.type = "sine";
      warm.frequency.setValueAtTime(event.freq, start);
      warm.connect(out);

      const air = ctx.createOscillator();
      air.type = "sine";
      air.frequency.setValueAtTime(event.freq * 1.004, start);
      const airGain = ctx.createGain();
      airGain.gain.value = 0.32;
      air.connect(airGain);
      airGain.connect(out);

      warm.start(start);
      air.start(start);
      warm.stop(start + event.duration + 0.05);
      air.stop(start + event.duration + 0.05);
    }

    playMusicBass(event, when) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.012);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      this.routeMusic(out, 0);

      const osc = ctx.createOscillator();
      osc.type = "triangle";
      osc.frequency.setValueAtTime(event.freq, start);
      osc.connect(out);
      osc.start(start);
      osc.stop(start + event.duration + 0.05);
    }

    playMusicSparkle(event, when) {
      if (!this.enabled || !this.ctx || !this.musicBus) return;
      const ctx = this.ctx;
      const start = Math.max(when, ctx.currentTime + 0.003);
      const out = ctx.createGain();
      out.gain.setValueAtTime(0.0001, start);
      out.gain.linearRampToValueAtTime(event.volume, start + 0.008);
      out.gain.exponentialRampToValueAtTime(0.0001, start + event.duration);
      this.routeMusic(out, event.pan || 0);

      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(event.freq, start);
      osc.connect(out);
      osc.start(start);
      osc.stop(start + event.duration + 0.05);
    }

    tone(freq, options = {}) {
      if (!this.enabled || !this.sfx || !this.ctx || !this.master) return;
      const {
        duration = 0.18,
        type = "sine",
        volume = 0.045,
        delay = 0,
        slideTo = null,
        attack = 0.006,
      } = options;
      const now = this.ctx.currentTime + delay;
      const oscillator = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(Math.max(30, freq), now);
      if (slideTo) {
        oscillator.frequency.exponentialRampToValueAtTime(
          Math.max(30, slideTo),
          now + duration
        );
      }
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + attack);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      oscillator.connect(gain);
      gain.connect(this.master);
      oscillator.start(now);
      oscillator.stop(now + duration + 0.035);
    }

    click() {
      this.tone(610, { duration: 0.07, type: "sine", volume: 0.022, slideTo: 720 });
    }

    select() {
      this.tone(680, { duration: 0.09, type: "sine", volume: 0.03, slideTo: 860 });
      this.tone(1360, { duration: 0.055, type: "triangle", volume: 0.009, delay: 0.015 });
    }

    swap() {
      this.tone(360, { duration: 0.12, type: "sine", volume: 0.025, slideTo: 500 });
    }

    invalid() {
      this.tone(210, { duration: 0.16, type: "triangle", volume: 0.026, slideTo: 160 });
      this.tone(160, { duration: 0.12, type: "sine", volume: 0.018, delay: 0.06 });
    }

    match(cascade) {
      const scale = [523.25, 587.33, 659.25, 783.99, 880];
      const shift = Math.min(Math.max(cascade - 1, 0), 4);
      const count = cascade >= 4 ? 4 : 3;
      for (let i = 0; i < count; i += 1) {
        const frequency = scale[(shift + i) % scale.length] * (i === 3 ? 2 : 1);
        this.tone(frequency, {
          duration: 0.18 + i * 0.015,
          type: "sine",
          volume: 0.035 - i * 0.003,
          delay: i * 0.047,
        });
        this.tone(frequency * 2, {
          duration: 0.09,
          type: "triangle",
          volume: 0.008,
          delay: i * 0.047,
        });
      }
    }


    noise(duration = 0.3, volume = 0.055, cutoff = 850) {
      if (!this.enabled || !this.sfx || !this.ctx || !this.master) return;
      if (!this.noiseBuffer) {
        const length = Math.floor(this.ctx.sampleRate * 0.55);
        const buffer = this.ctx.createBuffer(1, length, this.ctx.sampleRate);
        const data = buffer.getChannelData(0);
        for (let i = 0; i < length; i += 1) {
          data[i] = Math.random() * 2 - 1;
        }
        this.noiseBuffer = buffer;
      }
      const now = this.ctx.currentTime;
      const source = this.ctx.createBufferSource();
      source.buffer = this.noiseBuffer;
      const filter = this.ctx.createBiquadFilter();
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(cutoff, now);
      filter.frequency.exponentialRampToValueAtTime(Math.max(90, cutoff * 0.28), now + duration);
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now);
      gain.gain.linearRampToValueAtTime(volume, now + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
      source.connect(filter);
      filter.connect(gain);
      gain.connect(this.master);
      source.start(now);
      source.stop(now + duration + 0.03);
    }

    ignite() {
      this.tone(250, {
        duration: 0.16,
        type: "triangle",
        volume: 0.028,
        slideTo: 880,
      });
      this.tone(420, {
        duration: 0.1,
        type: "sine",
        volume: 0.018,
        slideTo: 1060,
        delay: 0.04,
      });
    }

    detonate(kind = "bomb") {
      if (kind === "lineH" || kind === "lineV") {
        this.noise(0.26, 0.065, 1800);
        this.tone(880, {
          duration: 0.24,
          type: "sawtooth",
          volume: 0.028,
          slideTo: 220,
        });
        [1046.5, 1318.5, 1760].forEach((frequency, index) => {
          this.tone(frequency, {
            duration: 0.18,
            type: "triangle",
            volume: 0.022,
            delay: 0.03 + index * 0.045,
          });
        });
        return;
      }

      if (kind === "rainbow") {
        this.noise(0.42, 0.06, 1500);
        [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98].forEach(
          (frequency, index) => {
            this.tone(frequency, {
              duration: 0.32,
              type: index % 2 ? "triangle" : "sine",
              volume: 0.028,
              delay: index * 0.045,
            });
          }
        );
        this.tone(96, {
          duration: 0.4,
          type: "sine",
          volume: 0.06,
          slideTo: 48,
        });
        return;
      }

      this.noise(0.4, 0.1, 1100);
      this.tone(96, {
        duration: 0.44,
        type: "sine",
        volume: 0.095,
        slideTo: 40,
      });
      this.tone(180, {
        duration: 0.26,
        type: "triangle",
        volume: 0.045,
        slideTo: 70,
      });
      [1046.5, 1318.5, 1568].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.22,
          type: "triangle",
          volume: 0.022 - index * 0.003,
          delay: 0.045 + index * 0.055,
        });
      });
    }

    ovenReady() {
      [523.25, 659.25, 783.99, 1046.5].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.34,
          type: index % 2 ? "triangle" : "sine",
          volume: 0.034,
          delay: index * 0.08,
        });
      });
      this.tone(1567.98, {
        duration: 0.5,
        type: "sine",
        volume: 0.025,
        delay: 0.34,
      });
    }

    storm() {
      this.noise(0.72, 0.11, 1700);
      this.tone(120, {
        duration: 0.55,
        type: "sawtooth",
        volume: 0.055,
        slideTo: 42,
      });
      [392, 523.25, 659.25, 783.99, 1046.5, 1318.5].forEach(
        (frequency, index) => {
          this.tone(frequency, {
            duration: 0.4,
            type: "triangle",
            volume: 0.03,
            delay: 0.06 + index * 0.055,
          });
        }
      );
    }

    special() {
      [659.25, 880, 1046.5, 1318.5].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.22,
          type: "triangle",
          volume: 0.026,
          delay: index * 0.055,
        });
      });
    }

    specialCreated() {
      [783.99, 1046.5, 1318.5].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.3,
          type: "sine",
          volume: 0.032,
          delay: index * 0.075,
        });
      });
    }

    shuffle() {
      [620, 540, 680, 760].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.13,
          type: "triangle",
          volume: 0.018,
          delay: index * 0.055,
        });
      });
    }

    levelStart() {
      this.tone(523.25, { duration: 0.17, type: "sine", volume: 0.028 });
      this.tone(659.25, { duration: 0.2, type: "sine", volume: 0.028, delay: 0.09 });
      this.tone(783.99, { duration: 0.26, type: "sine", volume: 0.03, delay: 0.18 });
    }

    win() {
      const notes = [523.25, 659.25, 783.99, 1046.5, 1318.5, 1567.98];
      notes.forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.46,
          type: index % 2 === 0 ? "sine" : "triangle",
          volume: 0.04,
          delay: index * 0.11,
        });
        this.tone(frequency / 2, {
          duration: 0.34,
          type: "sine",
          volume: 0.012,
          delay: index * 0.11,
        });
      });
    }

    lose() {
      [392, 329.63, 261.63].forEach((frequency, index) => {
        this.tone(frequency, {
          duration: 0.38,
          type: "sine",
          volume: 0.03,
          delay: index * 0.13,
        });
      });
    }
  }

  class ParticleField {
    constructor(canvas) {
      this.canvas = canvas;
      this.ctx = canvas.getContext("2d");
      this.particles = [];
      this.raf = 0;
      this.lastTime = 0;
      this.width = 0;
      this.height = 0;
      this.dpr = 1;
      this.supported = Boolean(this.ctx);
      this.resize = this.resize.bind(this);
      this.tick = this.tick.bind(this);
      if (this.supported && "ResizeObserver" in window) {
        this.resizeObserver = new ResizeObserver(this.resize);
        this.resizeObserver.observe(canvas.parentElement);
      }
      this.resize();
    }

    resize() {
      if (!this.supported) return;
      const rect = this.canvas.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      this.width = rect.width;
      this.height = rect.height;
      this.dpr = Math.min(window.devicePixelRatio || 1, 2);
      this.canvas.width = Math.round(this.width * this.dpr);
      this.canvas.height = Math.round(this.height * this.dpr);
      this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
      this.ctx.clearRect(0, 0, this.width, this.height);
      this.particles = [];
    }

    clear() {
      this.particles = [];
      if (this.supported) {
        this.ctx.clearRect(0, 0, this.width, this.height);
      }
    }

    spawn(x, y, colors, count = 6, power = 1) {
      if (!this.supported || !this.width) return;
      const amount = reducedMotion ? Math.ceil(count * 0.3) : count;
      const speedScale = reducedMotion ? 0.4 : 1;

      for (let i = 0; i < amount; i += 1) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (0.9 + Math.random() * 3.4) * power * speedScale;
        const shapes = ["dot", "star", "heart", "dot", "star"];
        const size = 1.8 + Math.random() * 4.7;
        this.particles.push({
          x: x + (Math.random() - 0.5) * 10,
          y: y + (Math.random() - 0.5) * 10,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 1.15 * speedScale,
          gravity: 0.105 + Math.random() * 0.06,
          drag: 0.985 + Math.random() * 0.008,
          size,
          color: colors[Math.floor(Math.random() * colors.length)],
          shape: shapes[Math.floor(Math.random() * shapes.length)],
          rotation: Math.random() * Math.PI * 2,
          spin: (Math.random() - 0.5) * 0.25,
          life: 0.75 + Math.random() * 0.7,
          maxLife: 1.45,
          opacity: 0.85 + Math.random() * 0.15,
        });
      }

      if (this.particles.length > 260) {
        this.particles.splice(0, this.particles.length - 260);
      }
      if (!this.raf) {
        this.lastTime = performance.now();
        this.raf = requestAnimationFrame(this.tick);
      }
    }

    circle(x, y, radius) {
      this.ctx.beginPath();
      this.ctx.arc(x, y, radius, 0, Math.PI * 2);
      this.ctx.fill();
    }

    star(x, y, radius) {
      const inner = radius * 0.28;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y - radius);
      this.ctx.quadraticCurveTo(x + inner, y - inner, x + radius, y);
      this.ctx.quadraticCurveTo(x + inner, y + inner, x, y + radius);
      this.ctx.quadraticCurveTo(x - inner, y + inner, x - radius, y);
      this.ctx.quadraticCurveTo(x - inner, y - inner, x, y - radius);
      this.ctx.closePath();
      this.ctx.fill();
    }

    heart(x, y, size) {
      const s = size / 10;
      this.ctx.beginPath();
      this.ctx.moveTo(x, y + 5 * s);
      this.ctx.bezierCurveTo(x - 10 * s, y - 2 * s, x - 5 * s, y - 9 * s, x, y - 3.5 * s);
      this.ctx.bezierCurveTo(x + 5 * s, y - 9 * s, x + 10 * s, y - 2 * s, x, y + 5 * s);
      this.ctx.closePath();
      this.ctx.fill();
    }

    tick(now) {
      const delta = Math.min((now - this.lastTime) / 16.6667, 2.2);
      this.lastTime = now;
      const ctx = this.ctx;
      ctx.clearRect(0, 0, this.width, this.height);

      const alive = [];
      for (const particle of this.particles) {
        particle.life -= 0.016 * delta;
        if (particle.life <= 0) continue;

        particle.vy += particle.gravity * delta;
        particle.vx *= particle.drag;
        particle.vy *= particle.drag;
        particle.x += particle.vx * delta;
        particle.y += particle.vy * delta;
        particle.rotation += particle.spin * delta;

        const ageRatio = Math.max(0, particle.life / particle.maxLife);
        const alpha = Math.min(1, ageRatio * 1.8) * particle.opacity;

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = particle.color;
        ctx.translate(particle.x, particle.y);
        ctx.rotate(particle.rotation);
        if (particle.shape === "star") {
          this.star(0, 0, particle.size * 1.2);
        } else if (particle.shape === "heart") {
          this.heart(0, 0, particle.size * 1.35);
        } else {
          this.circle(0, 0, particle.size * 0.68);
        }
        ctx.restore();

        if (
          particle.y < this.height + 30 &&
          particle.y > -40 &&
          particle.x > -40 &&
          particle.x < this.width + 40
        ) {
          alive.push(particle);
        }
      }

      this.particles = alive;
      if (this.particles.length) {
        this.raf = requestAnimationFrame(this.tick);
      } else {
        this.raf = 0;
        ctx.clearRect(0, 0, this.width, this.height);
      }
    }
  }

  window.BellaKit = { SoundKit, ParticleField };
})();
