// High-fidelity Multi-Section Synth Music & Rhythm Engine for Neon Rhythm Tapper
// Generates full, coherent, multi-track electronic songs with structured musical sections:
// Intro -> Verse -> Pre-Chorus -> Chorus Drop -> Bridge/Breakdown -> Climax Solo -> Outro

export interface NotePattern {
  time: number; // in musical beats from track start (0, 1, 1.5, 2, etc.)
  lane: number; // 0 (D), 1 (F), 2 (J), 3 (K)
  type: 'normal' | 'bonus' | 'hold';
  holdBeats?: number;
}

export interface SongSection {
  name: string;
  startBeat: number;
  endBeat: number;
  drumPattern: 'ambient' | 'verse' | 'buildup' | 'drop' | 'halftime' | 'fever';
}

export interface SongDefinition {
  id: string;
  title: string;
  artist: string;
  genre: string;
  bpm: number;
  durationBeats: number;
  difficulty: 'EASY' | 'MEDIUM' | 'HARD';
  accentColor: string;
  sections: SongSection[];
  notes: NotePattern[];
  // Musical composition tracks:
  chordProgression: number[][]; // Multi-note chords in Hz
  bassProgression: number[]; // Root bass notes in Hz
  leadMotifs: { beat: number; freq: number; duration: number; type?: OscillatorType }[];
}

// Frequency chart for precise electronic music tuning (Hz)
const NOTE = {
  F1: 43.65, G1: 49.00, A1: 55.00, B1: 61.74,
  C2: 65.41, D2: 73.42, E2: 82.41, F2: 87.31, G2: 98.00, A2: 110.00, B2: 123.47,
  C3: 130.81, D3: 146.83, E3: 164.81, F3: 174.61, G3: 196.00, A3: 220.00, B3: 246.94,
  C4: 261.63, D4: 293.66, E4: 329.63, F4: 349.23, G4: 392.00, A4: 440.00, B4: 493.88,
  C5: 523.25, D5: 587.33, E5: 659.25, F5: 698.46, G5: 783.99, A5: 880.00, B5: 987.77,
  C6: 1046.50, D6: 1174.66, E6: 1318.51, G6: 1567.98,
};

// =========================================================================
// SONG 1: "CYBER CITY ODYSSEY" (128 BPM - Melodic Synthwave Anthem)
// =========================================================================
function buildCyberCityOdyssey(): SongDefinition {
  const bpm = 128;
  const durationBeats = 192; // 48 bars = ~90 seconds full song structure
  const notes: NotePattern[] = [];
  const leadMotifs: { beat: number; freq: number; duration: number; type?: OscillatorType }[] = [];

  const sections: SongSection[] = [
    { name: 'INTRO', startBeat: 0, endBeat: 16, drumPattern: 'ambient' },
    { name: 'VERSE 1', startBeat: 16, endBeat: 48, drumPattern: 'verse' },
    { name: 'PRE-CHORUS', startBeat: 48, endBeat: 64, drumPattern: 'buildup' },
    { name: 'CHORUS DROP', startBeat: 64, endBeat: 112, drumPattern: 'drop' },
    { name: 'BREAKDOWN', startBeat: 112, endBeat: 136, drumPattern: 'halftime' },
    { name: 'CLIMAX SOLO', startBeat: 136, endBeat: 176, drumPattern: 'fever' },
    { name: 'OUTRO', startBeat: 176, endBeat: 192, drumPattern: 'ambient' },
  ];

  // Chords: Am -> Fmaj7 -> C -> G (Harmonic synthwave progression)
  const chordProgression = [
    [NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4], // Am7
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4], // Fmaj7
    [NOTE.C3, NOTE.E3, NOTE.G3, NOTE.B3], // Cmaj7
    [NOTE.G3, NOTE.B3, NOTE.D4, NOTE.F4], // G7
  ];
  const bassProgression = [NOTE.A2, NOTE.F2, NOTE.C2, NOTE.G2];

  // 1. INTRO (beats 0-16): Gentle rhythmic wake-up
  for (let b = 0; b < 16; b += 2) {
    notes.push({ time: b, lane: b % 4, type: 'normal' });
    if (b === 8 || b === 12) {
      notes.push({ time: b + 1, lane: (b + 2) % 4, type: 'normal' });
    }
  }
  // Intro lead melody
  [NOTE.E5, NOTE.G5, NOTE.A5, NOTE.C6, NOTE.B5, NOTE.G5, NOTE.E5, NOTE.D5].forEach((freq, idx) => {
    leadMotifs.push({ beat: idx * 2, freq, duration: 1.2, type: 'sine' });
  });

  // 2. VERSE 1 (beats 16-48): Groove & Melodic syncopation
  for (let bar = 4; bar < 12; bar++) {
    const sb = bar * 4;
    // Catchy varied patterns
    if (bar % 2 === 0) {
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb + 1, lane: 1, type: 'normal' });
      notes.push({ time: sb + 2, lane: 2, type: 'normal' });
      notes.push({ time: sb + 3, lane: 3, type: 'normal' });
      notes.push({ time: sb + 3.5, lane: 1, type: 'bonus' });
    } else {
      notes.push({ time: sb, lane: 3, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 2, type: 'normal' });
      notes.push({ time: sb + 2, lane: 1, type: 'hold', holdBeats: 1.0 });
      notes.push({ time: sb + 3.5, lane: 0, type: 'normal' });
    }

    // Lead motif
    const verseMelody = [NOTE.C5, NOTE.E5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5, NOTE.C5, NOTE.D5];
    leadMotifs.push({ beat: sb, freq: verseMelody[(bar * 2) % verseMelody.length], duration: 0.8, type: 'triangle' });
    leadMotifs.push({ beat: sb + 2, freq: verseMelody[(bar * 2 + 1) % verseMelody.length], duration: 0.8, type: 'triangle' });
  }

  // 3. PRE-CHORUS (beats 48-64): Snare buildup with rising stair cascades
  for (let bar = 12; bar < 16; bar++) {
    const sb = bar * 4;
    // Rapid stair runs
    notes.push({ time: sb, lane: 0, type: 'normal' });
    notes.push({ time: sb + 0.5, lane: 1, type: 'normal' });
    notes.push({ time: sb + 1.0, lane: 2, type: 'normal' });
    notes.push({ time: sb + 1.5, lane: 3, type: 'normal' });
    notes.push({ time: sb + 2.0, lane: 2, type: 'normal' });
    notes.push({ time: sb + 2.5, lane: 1, type: 'normal' });
    notes.push({ time: sb + 3.0, lane: 0, type: 'normal' });
    notes.push({ time: sb + 3.5, lane: 3, type: 'bonus' });

    // Rising synth riser
    leadMotifs.push({ beat: sb, freq: NOTE.A4 * (1 + (bar - 12) * 0.25), duration: 0.35, type: 'sawtooth' });
    leadMotifs.push({ beat: sb + 1, freq: NOTE.C5 * (1 + (bar - 12) * 0.25), duration: 0.35, type: 'sawtooth' });
    leadMotifs.push({ beat: sb + 2, freq: NOTE.E5 * (1 + (bar - 12) * 0.25), duration: 0.35, type: 'sawtooth' });
    leadMotifs.push({ beat: sb + 3, freq: NOTE.A5 * (1 + (bar - 12) * 0.25), duration: 0.35, type: 'sawtooth' });
  }

  // 4. CHORUS DROP (beats 64-112): Massive Energy, Double hits, laser holds
  for (let bar = 16; bar < 28; bar++) {
    const sb = bar * 4;
    // Heavy dual-note impact on beat 1
    notes.push({ time: sb, lane: 0, type: 'normal' });
    notes.push({ time: sb, lane: 3, type: 'normal' });

    notes.push({ time: sb + 1.0, lane: 1, type: 'normal' });
    notes.push({ time: sb + 1.5, lane: 2, type: 'normal' });
    notes.push({ time: sb + 2.0, lane: bar % 2 === 0 ? 0 : 3, type: 'hold', holdBeats: 1.5 });
    notes.push({ time: sb + 3.5, lane: 1, type: 'bonus' });

    if (bar % 4 === 3) {
      // 16th stream roll
      notes.push({ time: sb + 2.5, lane: 1, type: 'normal' });
      notes.push({ time: sb + 2.75, lane: 2, type: 'normal' });
      notes.push({ time: sb + 3.0, lane: 3, type: 'normal' });
      notes.push({ time: sb + 3.25, lane: 2, type: 'normal' });
    }

    // Anthem Lead Melody
    const chorusLead = [NOTE.A5, NOTE.C6, NOTE.B5, NOTE.G5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.E5];
    leadMotifs.push({ beat: sb, freq: chorusLead[(bar - 16) % chorusLead.length], duration: 0.9, type: 'triangle' });
    leadMotifs.push({ beat: sb + 1.5, freq: chorusLead[(bar - 15) % chorusLead.length], duration: 0.6, type: 'sawtooth' });
    leadMotifs.push({ beat: sb + 3, freq: chorusLead[(bar - 14) % chorusLead.length], duration: 0.8, type: 'triangle' });
  }

  // 5. BREAKDOWN (beats 112-136): Atmospheric half-time with jazz chords
  for (let bar = 28; bar < 34; bar++) {
    const sb = bar * 4;
    notes.push({ time: sb, lane: 1, type: 'normal' });
    notes.push({ time: sb + 2, lane: 2, type: 'hold', holdBeats: 1.8 });
    if (bar % 2 === 1) {
      notes.push({ time: sb + 3.5, lane: 0, type: 'bonus' });
    }

    const chillNotes = [NOTE.C5, NOTE.E5, NOTE.G5, NOTE.B5, NOTE.A5, NOTE.E5];
    leadMotifs.push({ beat: sb, freq: chillNotes[(bar - 28) % chillNotes.length], duration: 1.6, type: 'sine' });
  }

  // 6. CLIMAX SOLO / FEVER (beats 136-176): Hyperdrive ultimate finale
  for (let bar = 34; bar < 44; bar++) {
    const sb = bar * 4;
    // Fast zigzag rolls + double bonus notes
    notes.push({ time: sb, lane: 0, type: 'normal' });
    notes.push({ time: sb + 0.5, lane: 1, type: 'normal' });
    notes.push({ time: sb + 1.0, lane: 2, type: 'normal' });
    notes.push({ time: sb + 1.5, lane: 3, type: 'normal' });
    notes.push({ time: sb + 2.0, lane: 0, type: 'bonus' });
    notes.push({ time: sb + 2.0, lane: 3, type: 'bonus' });
    notes.push({ time: sb + 2.75, lane: 2, type: 'normal' });
    notes.push({ time: sb + 3.25, lane: 1, type: 'hold', holdBeats: 0.75 });

    const soloNotes = [NOTE.E6, NOTE.D6, NOTE.C6, NOTE.A5, NOTE.C6, NOTE.D6, NOTE.E6, NOTE.G6];
    for (let s = 0; s < 4; s++) {
      leadMotifs.push({
        beat: sb + s,
        freq: soloNotes[(bar * 2 + s) % soloNotes.length],
        duration: 0.45,
        type: 'sawtooth',
      });
    }
  }

  // 7. OUTRO (beats 176-192): Smooth victory landing
  for (let bar = 44; bar < 48; bar++) {
    const sb = bar * 4;
    notes.push({ time: sb, lane: 0, type: 'normal' });
    notes.push({ time: sb + 2, lane: 3, type: 'hold', holdBeats: 2.0 });
    leadMotifs.push({ beat: sb, freq: NOTE.A4, duration: 1.8, type: 'sine' });
  }

  return {
    id: 'cyber_odyssey',
    title: 'Cyber City Odyssey',
    artist: 'VaporPulse ft. Glitchwave',
    genre: 'Synthwave / Electro Anthem',
    bpm,
    durationBeats,
    difficulty: 'MEDIUM',
    accentColor: '#38BDF8',
    sections,
    notes,
    chordProgression,
    bassProgression,
    leadMotifs,
  };
}

// =========================================================================
// SONG 2: "HYPERNOVA BLITZ" (152 BPM - High Octane Drum & Bass Arcade)
// =========================================================================
function buildHypernovaBlitz(): SongDefinition {
  const bpm = 152;
  const durationBeats = 192;
  const notes: NotePattern[] = [];
  const leadMotifs: { beat: number; freq: number; duration: number; type?: OscillatorType }[] = [];

  const sections: SongSection[] = [
    { name: 'LAUNCH', startBeat: 0, endBeat: 16, drumPattern: 'buildup' },
    { name: 'SONIC DRIFT', startBeat: 16, endBeat: 48, drumPattern: 'verse' },
    { name: 'WARP CORE', startBeat: 48, endBeat: 64, drumPattern: 'buildup' },
    { name: 'HYPER DROP', startBeat: 64, endBeat: 128, drumPattern: 'drop' },
    { name: 'GRAVITY SHIFT', startBeat: 128, endBeat: 144, drumPattern: 'halftime' },
    { name: 'OVERCLOCK OVERDRIVE', startBeat: 144, endBeat: 184, drumPattern: 'fever' },
    { name: 'WARP OUTRO', startBeat: 184, endBeat: 192, drumPattern: 'ambient' },
  ];

  // Chords: Dm -> Bb -> F -> C (Fast harmonic drive)
  const chordProgression = [
    [NOTE.D4, NOTE.F4, NOTE.A4],
    [NOTE.B3 * 0.943, NOTE.D4, NOTE.F4], // Bb
    [NOTE.F3, NOTE.A3, NOTE.C4],
    [NOTE.C4, NOTE.E4, NOTE.G4],
  ];
  const bassProgression = [NOTE.D2, NOTE.B1 * 0.943, NOTE.F2, NOTE.C2];

  for (let bar = 0; bar < 48; bar++) {
    const sb = bar * 4;
    const isDrop = bar >= 16 && bar < 32;
    const isFever = bar >= 36 && bar < 46;

    if (bar < 4) {
      // Intro 16th streams
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb + 1.0, lane: 1, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: 2, type: 'normal' });
      notes.push({ time: sb + 3.0, lane: 3, type: 'normal' });
    } else if (isDrop) {
      // Fast streams, alternating hits and staircase runs
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb, lane: 3, type: 'normal' });
      notes.push({ time: sb + 0.75, lane: 1, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 2, type: 'normal' });
      notes.push({ time: sb + 2.25, lane: 1, type: 'normal' });
      notes.push({ time: sb + 3.0, lane: 3, type: 'hold', holdBeats: 0.8 });
      notes.push({ time: sb + 3.5, lane: 0, type: 'bonus' });
    } else if (isFever) {
      // Maximum arcade fury
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb + 0.5, lane: 1, type: 'normal' });
      notes.push({ time: sb + 1.0, lane: 2, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 3, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: 2, type: 'bonus' });
      notes.push({ time: sb + 2.5, lane: 1, type: 'normal' });
      notes.push({ time: sb + 3.0, lane: 0, type: 'hold', holdBeats: 1.0 });
    } else {
      // Steady syncopated verse
      notes.push({ time: sb, lane: bar % 4, type: 'normal' });
      notes.push({ time: sb + 1.0, lane: (bar + 1) % 4, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: (bar + 2) % 4, type: 'hold', holdBeats: 1.2 });
      notes.push({ time: sb + 3.5, lane: (bar + 3) % 4, type: 'bonus' });
    }

    // Lead synthesizer arpeggio
    const fastNotes = [NOTE.D5, NOTE.F5, NOTE.A5, NOTE.C6, NOTE.D6, NOTE.A5, NOTE.F5, NOTE.E5];
    for (let s = 0; s < 2; s++) {
      leadMotifs.push({
        beat: sb + s * 2,
        freq: fastNotes[(bar * 2 + s) % fastNotes.length],
        duration: 0.6,
        type: isDrop || isFever ? 'sawtooth' : 'triangle',
      });
    }
  }

  return {
    id: 'hypernova',
    title: 'Hypernova Blitz',
    artist: 'GridSpeed & VectorByte',
    genre: 'Drum & Bass / High Speed',
    bpm,
    durationBeats,
    difficulty: 'HARD',
    accentColor: '#EC4899',
    sections,
    notes,
    chordProgression,
    bassProgression,
    leadMotifs,
  };
}

// =========================================================================
// SONG 3: "NEON MIDNIGHT DRIVE" (116 BPM - Chill Future Funk & Slap Bass)
// =========================================================================
function buildNeonMidnightDrive(): SongDefinition {
  const bpm = 116;
  const durationBeats = 192;
  const notes: NotePattern[] = [];
  const leadMotifs: { beat: number; freq: number; duration: number; type?: OscillatorType }[] = [];

  const sections: SongSection[] = [
    { name: 'IGNITION', startBeat: 0, endBeat: 16, drumPattern: 'ambient' },
    { name: 'NEON BOULEVARD', startBeat: 16, endBeat: 48, drumPattern: 'verse' },
    { name: 'SUNSET HORIZON', startBeat: 48, endBeat: 64, drumPattern: 'buildup' },
    { name: 'MIDNIGHT GROOVE', startBeat: 64, endBeat: 112, drumPattern: 'drop' },
    { name: 'STARLIGHT LOUNGE', startBeat: 112, endBeat: 144, drumPattern: 'halftime' },
    { name: 'MIDNIGHT CRUISE', startBeat: 144, endBeat: 180, drumPattern: 'fever' },
    { name: 'DESTINATION', startBeat: 180, endBeat: 192, drumPattern: 'ambient' },
  ];

  // Rich Jazz Chords: Fmaj9 -> Em7 -> Dm9 -> Cmaj7
  const chordProgression = [
    [NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4, NOTE.G4], // Fmaj9
    [NOTE.E3, NOTE.G3, NOTE.B3, NOTE.D4],          // Em7
    [NOTE.D3, NOTE.F3, NOTE.A3, NOTE.C4, NOTE.E4], // Dm9
    [NOTE.C3, NOTE.E3, NOTE.G3, NOTE.B3],          // Cmaj7
  ];
  const bassProgression = [NOTE.F2, NOTE.E2, NOTE.D2, NOTE.C2];

  for (let bar = 0; bar < 48; bar++) {
    const sb = bar * 4;
    // Funky, bouncy rhythm chart
    if (bar % 4 === 0) {
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 2, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: 1, type: 'hold', holdBeats: 1.0 });
      notes.push({ time: sb + 3.5, lane: 3, type: 'bonus' });
    } else if (bar % 4 === 1) {
      notes.push({ time: sb, lane: 3, type: 'normal' });
      notes.push({ time: sb + 0.75, lane: 1, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 2, type: 'normal' });
      notes.push({ time: sb + 2.5, lane: 0, type: 'normal' });
      notes.push({ time: sb + 3.0, lane: 2, type: 'hold', holdBeats: 0.8 });
    } else if (bar % 4 === 2) {
      notes.push({ time: sb, lane: 1, type: 'normal' });
      notes.push({ time: sb + 1.0, lane: 2, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: 0, type: 'normal' });
      notes.push({ time: sb + 2.0, lane: 3, type: 'normal' });
      notes.push({ time: sb + 3.5, lane: 1, type: 'bonus' });
    } else {
      notes.push({ time: sb, lane: 0, type: 'normal' });
      notes.push({ time: sb + 0.5, lane: 1, type: 'normal' });
      notes.push({ time: sb + 1.0, lane: 2, type: 'normal' });
      notes.push({ time: sb + 1.5, lane: 3, type: 'hold', holdBeats: 1.5 });
      notes.push({ time: sb + 3.5, lane: 0, type: 'bonus' });
    }

    // Melodic funk hook
    const funkLead = [NOTE.A4, NOTE.C5, NOTE.E5, NOTE.G5, NOTE.A5, NOTE.G5, NOTE.E5, NOTE.D5];
    leadMotifs.push({ beat: sb, freq: funkLead[(bar * 2) % funkLead.length], duration: 1.1, type: 'sine' });
    leadMotifs.push({ beat: sb + 2, freq: funkLead[(bar * 2 + 1) % funkLead.length], duration: 0.9, type: 'triangle' });
  }

  return {
    id: 'neon_midnight',
    title: 'Neon Midnight Drive',
    artist: 'Luna Groove',
    genre: 'Future Funk / Chillwave',
    bpm,
    durationBeats,
    difficulty: 'EASY',
    accentColor: '#A855F7',
    sections,
    notes,
    chordProgression,
    bassProgression,
    leadMotifs,
  };
}

export const RHYTHM_SONGS: SongDefinition[] = [
  buildCyberCityOdyssey(),
  buildNeonMidnightDrive(),
  buildHypernovaBlitz(),
];

// =========================================================================
// MULTI-CHANNEL WEB AUDIO SYNTHESIZER
// Generates authentic punchy kicks, snares, hats, rolling bass & polyphonic pads
// =========================================================================
export class RhythmMusicEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private isPlaying: boolean = false;
  private masterGain: GainNode | null = null;
  private filterNode: BiquadFilterNode | null = null;
  private song: SongDefinition | null = null;
  private currentBeat: number = 0;

  constructor() {}

  public init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioContextClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioContextClass) {
        this.ctx = new AudioContextClass();
        this.masterGain = this.ctx.createGain();
        this.masterGain.gain.setValueAtTime(0.35, this.ctx.currentTime);

        this.filterNode = this.ctx.createBiquadFilter();
        this.filterNode.type = 'lowpass';
        this.filterNode.frequency.setValueAtTime(14000, this.ctx.currentTime);
        this.filterNode.Q.setValueAtTime(1.5, this.ctx.currentTime);

        this.filterNode.connect(this.masterGain);
        this.masterGain.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.masterGain && this.ctx) {
      this.masterGain.gain.setValueAtTime(muted ? 0 : 0.35, this.ctx.currentTime);
    }
  }

  public playSong(song: SongDefinition, startBeat: number = 0) {
    this.init();
    this.song = song;
    this.currentBeat = startBeat;
    this.isPlaying = true;
  }

  public stop() {
    this.isPlaying = false;
  }

  public getCurrentSection(beat: number): SongSection | null {
    if (!this.song) return null;
    return this.song.sections.find((s) => beat >= s.startBeat && beat < s.endBeat) || null;
  }

  public update(currentSongBeat: number) {
    if (!this.isPlaying || !this.song || !this.ctx || !this.filterNode || this.isMuted) return;

    const prevBeat = this.currentBeat;
    this.currentBeat = currentSongBeat;

    if (currentSongBeat < 0) return; // Silent during negative countdown beats

    const prevStep = Math.max(0, Math.floor(prevBeat * 4)); // 16th note resolution
    const curStep = Math.floor(currentSongBeat * 4);

    for (let step = prevStep + 1; step <= curStep; step++) {
      const beat = step / 4;
      this.triggerAudioBeat(beat);
    }
  }

  private triggerAudioBeat(beat: number) {
    if (!this.ctx || !this.filterNode || !this.song || beat < 0) return;
    try {
      const now = this.ctx.currentTime;
      const bar = Math.max(0, Math.floor(beat / 4));
      const beatInBar = ((beat % 4) + 4) % 4;
      const currentSection = this.getCurrentSection(beat);
      const pattern = currentSection ? currentSection.drumPattern : 'verse';

      // 1. DRUMS
      if (pattern === 'drop' || pattern === 'fever') {
        // 4-on-the-floor kick
        if (beat % 1 === 0) {
          this.playKick(now);
        }
        // Snare on 1 & 3 + ghost 3.75
        if (beatInBar === 1 || beatInBar === 3) {
          this.playSnare(now);
        }
        // Hi-hat on 16ths
        if (beat % 0.25 === 0) {
          this.playHiHat(now, beat % 0.5 === 0.25);
        }
        // Crash cymbal on drop start
        if (currentSection && beat === currentSection.startBeat) {
          this.playCrash(now);
        }
      } else if (pattern === 'buildup') {
        // Accelerating Snare Roll
        if (beat % 0.5 === 0) {
          this.playSnare(now, 0.25 + (beatInBar / 4) * 0.2);
        }
        if (beat % 1 === 0) {
          this.playKick(now, 0.4);
        }
      } else if (pattern === 'verse') {
        // Steady Kick on 0, 2; Snare on 1, 3; 8th Hats
        if (beatInBar === 0 || beatInBar === 2) {
          this.playKick(now);
        } else if (beatInBar === 1 || beatInBar === 3) {
          this.playSnare(now);
        }
        if (beat % 0.5 === 0) {
          this.playHiHat(now);
        }
      } else if (pattern === 'halftime') {
        // Chill half-time: Kick on 0, Snare on 2
        if (beatInBar === 0) this.playKick(now, 0.6);
        if (beatInBar === 2) this.playSnare(now, 0.5);
        if (beat % 0.5 === 0) this.playHiHat(now, false);
      } else {
        // Ambient Intro / Outro
        if (beatInBar === 0) this.playHiHat(now);
      }

      // 2. ROLLING SYNTH BASS
      if (pattern !== 'ambient' && beat % 0.5 === 0 && this.song.bassProgression?.length) {
        const chordIdx = bar % this.song.bassProgression.length;
        const rootBass = this.song.bassProgression[chordIdx] || 110;
        const isOctave = beat % 1 === 0.5;
        const bassFreq = isOctave ? rootBass * 1.5 : rootBass;

        const osc = this.ctx.createOscillator();
        const gain = this.ctx.createGain();
        osc.type = pattern === 'fever' || pattern === 'drop' ? 'sawtooth' : 'triangle';
        osc.frequency.setValueAtTime(bassFreq, now);

        gain.gain.setValueAtTime(0.3, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        osc.connect(gain);
        gain.connect(this.filterNode);
        osc.start(now);
        osc.stop(now + 0.24);
      }

      // 3. POLYPHONIC CHORD PADS
      if (beatInBar === 0 && this.song.chordProgression?.length) {
        const chord = this.song.chordProgression[bar % this.song.chordProgression.length];
        if (Array.isArray(chord)) {
          chord.forEach((freq) => {
            const osc = this.ctx!.createOscillator();
            const gain = this.ctx!.createGain();
            osc.type = 'sine';
            osc.frequency.setValueAtTime(freq, now);
            gain.gain.setValueAtTime(0.12, now);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.8);

            osc.connect(gain);
            gain.connect(this.filterNode!);
            osc.start(now);
            osc.stop(now + 2.9);
          });
        }
      }

      // 4. MELODIC LEAD SYNTH
      if (this.song.leadMotifs?.length) {
        const lead = this.song.leadMotifs.find((m) => Math.abs(m.beat - beat) < 0.1);
        if (lead) {
          const osc = this.ctx.createOscillator();
          const gain = this.ctx.createGain();
          osc.type = lead.type || 'triangle';
          osc.frequency.setValueAtTime(lead.freq, now);

          gain.gain.setValueAtTime(0.24, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + lead.duration);

          osc.connect(gain);
          gain.connect(this.filterNode);
          osc.start(now);
          osc.stop(now + lead.duration + 0.03);
        }
      }
    } catch {
      // Audio trigger safe guard
    }
  }

  private playKick(now: number, vol = 0.65) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(160, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.1);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.14);
    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(now);
    osc.stop(now + 0.15);
  }

  private playSnare(now: number, vol = 0.45) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(260, now);
    osc.frequency.exponentialRampToValueAtTime(90, now + 0.08);
    gain.gain.setValueAtTime(vol, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.11);
    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(now);
    osc.stop(now + 0.12);
  }

  private playHiHat(now: number, accent = false) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(7000, now);
    osc.frequency.exponentialRampToValueAtTime(14000, now + 0.025);
    gain.gain.setValueAtTime(accent ? 0.16 : 0.09, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.035);
    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(now);
    osc.stop(now + 0.04);
  }

  private playCrash(now: number) {
    if (!this.ctx || !this.filterNode) return;
    const osc = this.ctx.createOscillator();
    const gain = this.ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(5000, now);
    osc.frequency.exponentialRampToValueAtTime(800, now + 0.8);
    gain.gain.setValueAtTime(0.3, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.8);
    osc.connect(gain);
    gain.connect(this.filterNode);
    osc.start(now);
    osc.stop(now + 0.85);
  }
}

export const musicEngine = new RhythmMusicEngine();
