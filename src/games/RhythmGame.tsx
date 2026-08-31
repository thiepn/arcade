import React, { useEffect, useRef, useState, useCallback } from 'react';
import { GameComponentProps } from '../types';
import { sounds } from '../lib/sound';
import { RHYTHM_SONGS, SongDefinition, musicEngine } from '../lib/rhythmSongs';
import { Music, Flame, Zap, Award, Shield, Sparkles, Volume2, VolumeX, Play, Disc } from 'lucide-react';
import { useGameLoop, useSafeTimeout, useRenderPublishedState } from '../hooks/useGameLoop';
import {
  RHYTHM_HIT_WINDOWS_MS,
  RHYTHM_LATENCY_STEP_MS,
  RHYTHM_LATENCY_STORAGE_KEY,
  RHYTHM_MISS_WINDOW_MS,
  clampRhythmLatencyOffset,
  getLatencyCompensatedBeat,
  getSignedTimingErrorMs,
} from '../lib/rhythmTiming';
import {
  getRhythmHoldCompletionBonus,
  isRhythmHoldComplete,
  shouldBreakRhythmHold,
} from '../lib/rhythmHoldMastery';

interface ActiveNote {
  id: number;
  beatTime: number; // target beat when note reaches HIT_Y
  lane: number; // 0, 1, 2, 3
  type: 'normal' | 'bonus' | 'hold';
  holdBeats?: number;
  isHit?: boolean;
  isMissed?: boolean;
  isHolding?: boolean;
  holdCompleted?: boolean;
  scoreAwarded?: boolean;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface HitPopup {
  id: number;
  text: string;
  subtext?: string;
  color: string;
  lane: number;
  life: number;
  maxLife: number;
}

const LANE_COLORS = ['#38BDF8', '#818CF8', '#C084FC', '#F43F5E'];
const LANE_KEYS = [
  ['KeyD', 'Digit1', 'ArrowLeft'],
  ['KeyF', 'Digit2', 'ArrowDown'],
  ['KeyJ', 'Digit3', 'ArrowUp'],
  ['KeyK', 'Digit4', 'ArrowRight'],
];
const LANE_LABELS = ['D', 'F', 'J', 'K'];

export const RhythmGame: React.FC<GameComponentProps> = ({
  onGameOver,
  onScoreUpdate,
  isPaused,
  soundEnabled,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const isPausedRef = useRef(isPaused);
  isPausedRef.current = isPaused;
  const soundEnabledRef = useRef(soundEnabled);
  soundEnabledRef.current = soundEnabled;
  const setSafeTimeout = useSafeTimeout();

  const [selectedSongIndex, setSelectedSongIndex] = useState(0);
  const currentSong = RHYTHM_SONGS[selectedSongIndex];
  const [latencyOffsetMs, setLatencyOffsetMs] = useState(() => {
    if (typeof window === 'undefined') return 0;
    const stored = Number(window.localStorage.getItem(RHYTHM_LATENCY_STORAGE_KEY));
    return Number.isFinite(stored) ? clampRhythmLatencyOffset(stored) : 0;
  });
  const latencyOffsetRef = useRef(latencyOffsetMs);
  latencyOffsetRef.current = latencyOffsetMs;
  const [estimatedLatencyMs, setEstimatedLatencyMs] = useState(0);

  const updateLatencyOffset = useCallback((value: number) => {
    const next = clampRhythmLatencyOffset(value);
    latencyOffsetRef.current = next;
    setLatencyOffsetMs(next);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(RHYTHM_LATENCY_STORAGE_KEY, String(next));
    }
  }, []);

  const [activeLanes, setActiveLanes] = useState<boolean[]>([false, false, false, false]);
  const laneHeldRef = useRef<boolean[]>([false, false, false, false]);
  const [hudStats, setHudStats] = useRenderPublishedState({
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    grooveHealth: 100,
    overdrive: false,
    overdriveTime: 0,
    songProgress: 0,
    currentSongTitle: currentSong.title,
    currentSectionName: 'INTRO',
    bpm: currentSong.bpm,
  }, 100);

  const gameStateRef = useRef({
    score: 0,
    combo: 0,
    maxCombo: 0,
    multiplier: 1,
    grooveHealth: 100,
    isOverdrive: false,
    overdriveTimer: 0,
    isAlive: true,
    song: currentSong,
    currentBeat: -4, // 4-beat countdown lead-in
    beatsAhead: 3.5, // visible note highway depth in beats
    notes: [] as ActiveNote[],
    particles: [] as Particle[],
    popups: [] as HitPopup[],
    laneHitFlash: [0, 0, 0, 0],
    nextPopupId: 1,
    perfectHits: 0,
    greatHits: 0,
    goodHits: 0,
    missHits: 0,
  });

  // Switch song
  const handleSelectSong = (idx: number) => {
    setSelectedSongIndex(idx);
    const newSong = RHYTHM_SONGS[idx];
    const state = gameStateRef.current;
    state.song = newSong;
    state.currentBeat = -4; // reset with countdown
    state.score = 0;
    state.combo = 0;
    state.grooveHealth = 100;
    state.isOverdrive = false;
    state.isAlive = true;
    state.popups = [];
    state.particles = [];
    laneHeldRef.current = [false, false, false, false];
    state.notes = newSong.notes.map((n, i) => ({
      id: i + 1,
      beatTime: n.time,
      lane: n.lane,
      type: n.type,
      holdBeats: n.holdBeats,
      isHit: false,
      isMissed: false,
      isHolding: false,
      holdCompleted: false,
    }));
    onScoreUpdate(0);
    musicEngine.playSong(newSong, -4);
  };

  // Trigger lane hit logic
  const handleLaneTrigger = useCallback((laneIndex: number) => {
    if (!gameStateRef.current.isAlive || isPausedRef.current) return;

    const state = gameStateRef.current;
    state.laneHitFlash[laneIndex] = 1.0;

    const judgementBeat = getLatencyCompensatedBeat(
      state.currentBeat,
      state.song.bpm,
      latencyOffsetRef.current,
    );
    let closestNote: ActiveNote | null = null;
    let closestTimingErrorMs = Infinity;
    let closestSignedErrorMs = 0;

    for (const note of state.notes) {
      if (note.lane === laneIndex && !note.isHit && !note.isMissed) {
        const signedErrorMs = getSignedTimingErrorMs(note.beatTime, judgementBeat, state.song.bpm);
        const timingErrorMs = Math.abs(signedErrorMs);
        if (timingErrorMs < closestTimingErrorMs && timingErrorMs <= RHYTHM_HIT_WINDOWS_MS.good) {
          closestTimingErrorMs = timingErrorMs;
          closestSignedErrorMs = signedErrorMs;
          closestNote = note;
        }
      }
    }

    if (closestNote) {
      closestNote.isHit = true;
      if (closestNote.type === 'hold' && (closestNote.holdBeats ?? 0) > 0) {
        closestNote.isHolding = true;
        closestNote.holdCompleted = false;
      }
      let points = 60;
      let rating: 'PERFECT' | 'GREAT' | 'GOOD' = 'GOOD';
      let ratingColor = '#FACC15';

      if (closestTimingErrorMs <= RHYTHM_HIT_WINDOWS_MS.perfect) {
        rating = 'PERFECT';
        points = 350;
        ratingColor = '#38BDF8';
        state.perfectHits++;
      } else if (closestTimingErrorMs <= RHYTHM_HIT_WINDOWS_MS.great) {
        rating = 'GREAT';
        points = 180;
        ratingColor = '#34D399';
        state.greatHits++;
      } else {
        rating = 'GOOD';
        points = 90;
        ratingColor = '#F59E0B';
        state.goodHits++;
      }

      if (closestNote.type === 'bonus') {
        points *= 2;
      }

      // Combo & Multiplier scaling
      state.combo++;
      if (state.combo > state.maxCombo) {
        state.maxCombo = state.combo;
      }

      // Dynamic multipliers
      let mult = 1;
      if (state.combo >= 50) mult = 8;
      else if (state.combo >= 25) mult = 4;
      else if (state.combo >= 12) mult = 3;
      else if (state.combo >= 5) mult = 2;

      if (state.isOverdrive) {
        mult *= 2;
      }
      state.multiplier = mult;

      const earned = points * mult;
      state.score += earned;
      onScoreUpdate(state.score);

      // Restore Groove Health
      state.grooveHealth = Math.min(100, state.grooveHealth + (rating === 'PERFECT' ? 6 : 4));

      // Overdrive activation check
      if (state.combo >= 15 && !state.isOverdrive) {
        state.isOverdrive = true;
        state.overdriveTimer = 400 / 60; // ~6.7 seconds
        if (soundEnabledRef.current) sounds.playFeverMode();
      }

      if (soundEnabledRef.current) {
        sounds.playRhythmHit(laneIndex, rating);
      }

      // Spawn hit particles
      const canvas = canvasRef.current;
      if (canvas) {
        const curW = canvas.width / Math.min(window.devicePixelRatio || 1, 2);
        const curH = canvas.height / Math.min(window.devicePixelRatio || 1, 2);
        const laneW = curW / 4;
        const hitX = (laneIndex + 0.5) * laneW;
        const hitY = 0.86 * curH;

        for (let i = 0; i < (rating === 'PERFECT' ? 24 : 12); i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 5 + 2;
          state.particles.push({
            x: hitX,
            y: hitY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - 1.5,
            life: 1.0,
            maxLife: Math.random() * 0.4 + 0.3,
            color: ratingColor,
            size: Math.random() * 4 + 2,
          });
        }
      }

      // Add hit popup
      state.popups.push({
        id: state.nextPopupId++,
        text: rating,
        subtext: `${closestSignedErrorMs > 0 ? '+' : ''}${Math.round(closestSignedErrorMs)}ms • +${earned.toLocaleString()}`,
        color: ratingColor,
        lane: laneIndex,
        life: 1.0,
        maxLife: 0.65,
      });
    } else {
      // Early/off-beat tap
      state.popups.push({
        id: state.nextPopupId++,
        text: 'EARLY',
        color: '#71717A',
        lane: laneIndex,
        life: 0.4,
        maxLife: 0.3,
      });
      if (soundEnabledRef.current) sounds.playPop();
    }
  }, [onScoreUpdate]);

  // Initialize song notes & audio
  useEffect(() => {
    const song = RHYTHM_SONGS[selectedSongIndex];
    const state = gameStateRef.current;
    state.song = song;
    state.currentBeat = -4;
    state.score = 0;
    state.combo = 0;
    state.grooveHealth = 100;
    state.isAlive = true;
    laneHeldRef.current = [false, false, false, false];
    state.notes = song.notes.map((n, i) => ({
      id: i + 1,
      beatTime: n.time,
      lane: n.lane,
      type: n.type,
      holdBeats: n.holdBeats,
      isHit: false,
      isMissed: false,
      isHolding: false,
      holdCompleted: false,
    }));

    musicEngine.setMuted(!soundEnabledRef.current);
    musicEngine.playSong(song, -4);

    return () => {
      musicEngine.stop();
    };
  }, [selectedSongIndex]);

  // Sync mute state to music engine
  useEffect(() => {
    musicEngine.setMuted(!soundEnabled);
  }, [soundEnabled]);

  useEffect(() => {
    setEstimatedLatencyMs(musicEngine.getEstimatedOutputLatencyMs());
  }, [selectedSongIndex, soundEnabled]);

  // Keyboard events
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.repeat) return;
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          e.preventDefault();
          laneHeldRef.current[i] = true;
          setActiveLanes((prev) => {
            const next = [...prev];
            next[i] = true;
            return next;
          });
          handleLaneTrigger(i);
          break;
        }
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      for (let i = 0; i < 4; i++) {
        if (LANE_KEYS[i].includes(e.code)) {
          e.preventDefault();
          laneHeldRef.current[i] = false;
          setActiveLanes((prev) => {
            const next = [...prev];
            next[i] = false;
            return next;
          });
          break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('keyup', handleKeyUp);
    };
  }, [handleLaneTrigger]);

  useGameLoop({
    canvasRef,
    isPaused,
    onUpdate: (ctx, deltaSec, curW, curH) => {
      const dt = Math.min(deltaSec, 0.08);
      const state = gameStateRef.current;

      ctx.clearRect(0, 0, curW, curH);

      if (!isPausedRef.current && state.isAlive) {
        // Advance song beat time
        const beatsPerSecond = state.song.bpm / 60;
        state.currentBeat += beatsPerSecond * dt;

        // Drive procedural multi-instrument music synthesizer
        if (soundEnabled && state.currentBeat >= 0) {
          musicEngine.update(state.currentBeat);
        }

        // Overdrive fever timer
        if (state.isOverdrive) {
          state.overdriveTimer -= dt;
          if (state.overdriveTimer <= 0) {
            state.isOverdrive = false;
          }
        }

        // Update active notes using the same fixed-ms, latency-compensated clock as judgement.
        const judgementBeat = getLatencyCompensatedBeat(
          state.currentBeat,
          state.song.bpm,
          latencyOffsetRef.current,
        );

        // Hold heads still use the certified P0 fixed-ms judgement. After a valid
        // head hit, the lane must remain physically held until the laser tail ends.
        for (const note of state.notes) {
          if (!note.isHolding) continue;
          const holdBeats = note.holdBeats ?? 0;
          if (isRhythmHoldComplete(judgementBeat, note.beatTime, holdBeats)) {
            note.isHolding = false;
            note.holdCompleted = true;
            const holdBonus = getRhythmHoldCompletionBonus(holdBeats, state.multiplier);
            state.score += holdBonus;
            state.grooveHealth = Math.min(100, state.grooveHealth + 3);
            onScoreUpdate(state.score);
            state.popups.push({
              id: state.nextPopupId++,
              text: 'HOLD CLEAR',
              subtext: `+${holdBonus.toLocaleString()}`,
              color: '#34D399',
              lane: note.lane,
              life: 1.0,
              maxLife: 0.65,
            });
            if (soundEnabledRef.current) sounds.playSuccess();
          } else if (
            shouldBreakRhythmHold({
              judgementBeat,
              startBeat: note.beatTime,
              holdBeats,
              bpm: state.song.bpm,
              laneHeld: laneHeldRef.current[note.lane],
            })
          ) {
            note.isHolding = false;
            note.holdCompleted = false;
            note.isMissed = true;
            state.combo = 0;
            state.multiplier = 1;
            state.missHits++;
            state.grooveHealth = Math.max(0, state.grooveHealth - 7);
            state.popups.push({
              id: state.nextPopupId++,
              text: 'HOLD BREAK',
              color: '#EF4444',
              lane: note.lane,
              life: 1.0,
              maxLife: 0.55,
            });
            if (soundEnabledRef.current) sounds.playBuzz();
            if (state.grooveHealth <= 0) {
              state.isAlive = false;
              musicEngine.stop();
              if (soundEnabledRef.current) sounds.playGameOver();
              setSafeTimeout(() => onGameOver(state.score), 400);
              break;
            }
          }
        }

        for (const note of state.notes) {
          const lateByMs = getSignedTimingErrorMs(note.beatTime, judgementBeat, state.song.bpm);
          if (!note.isHit && !note.isMissed && lateByMs > RHYTHM_MISS_WINDOW_MS) {
            note.isMissed = true;
            state.combo = 0;
            state.multiplier = 1;
            state.missHits++;
            state.grooveHealth = Math.max(0, state.grooveHealth - 7); // Forgiving health drain

            state.popups.push({
              id: state.nextPopupId++,
              text: 'MISS',
              color: '#EF4444',
              lane: note.lane,
              life: 1.0,
              maxLife: 0.5,
            });

            if (soundEnabledRef.current) sounds.playBuzz();

            // Game over check if health depleted
            if (state.grooveHealth <= 0) {
              state.isAlive = false;
              musicEngine.stop();
              if (soundEnabledRef.current) sounds.playGameOver();
              setSafeTimeout(() => {
                onGameOver(state.score);
              }, 400);
            }
          }
        }

        // Loop song when complete with track bonus!
        if (state.currentBeat > state.song.durationBeats) {
          state.score += 5000;
          onScoreUpdate(state.score);
          if (soundEnabledRef.current) sounds.playSongFinish();
          state.currentBeat = 0; // seamless loop
          state.notes.forEach((n) => {
            n.isHit = false;
            n.isMissed = false;
            n.isHolding = false;
            n.holdCompleted = false;
          });
          laneHeldRef.current = [false, false, false, false];
        }

        // Update Lane flashes
        for (let l = 0; l < 4; l++) {
          if (state.laneHitFlash[l] > 0) {
            state.laneHitFlash[l] = Math.max(0, state.laneHitFlash[l] - dt * 5);
          }
        }

        // Update Particles
        for (let p = state.particles.length - 1; p >= 0; p--) {
          const part = state.particles[p];
          const particleFrameScale = dt * 60;
          part.x += part.vx * particleFrameScale;
          part.y += part.vy * particleFrameScale + 0.5 * 0.12 * particleFrameScale * (particleFrameScale - 1);
          part.vy += 0.12 * particleFrameScale;
          part.life -= dt / part.maxLife;
          if (part.life <= 0) {
            state.particles.splice(p, 1);
          }
        }

        // Update Popups
        for (let pop = state.popups.length - 1; pop >= 0; pop--) {
          const popup = state.popups[pop];
          popup.life -= dt / popup.maxLife;
          if (popup.life <= 0) {
            state.popups.splice(pop, 1);
          }
        }
      }

      // ==========================================
      // RENDER CANVAS HIGHWAY & NOTES
      // ==========================================
      const laneW = curW / 4;
      const HIT_Y = 0.86 * curH;
      const displayBeat = getLatencyCompensatedBeat(
        state.currentBeat,
        state.song.bpm,
        latencyOffsetRef.current,
      );

      // 1. Futuristic Cyber Highway Background
      const bgGrad = ctx.createLinearGradient(0, 0, 0, curH);
      if (state.isOverdrive) {
        bgGrad.addColorStop(0, '#2A0822');
        bgGrad.addColorStop(0.5, '#16081F');
        bgGrad.addColorStop(1, '#09040D');
      } else {
        bgGrad.addColorStop(0, '#060609');
        bgGrad.addColorStop(0.5, '#0E0F19');
        bgGrad.addColorStop(1, '#13141F');
      }
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, curW, curH);

      // Perspective horizon grid
      const beatPulse = Math.max(0.05, 0.18 * Math.sin(state.currentBeat * Math.PI));
      ctx.strokeStyle = state.isOverdrive
        ? `rgba(244, 63, 94, ${beatPulse + 0.15})`
        : `rgba(56, 189, 248, ${beatPulse})`;
      ctx.lineWidth = 1;
      for (let yG = 0; yG < curH; yG += 28) {
        ctx.beginPath();
        ctx.moveTo(0, yG);
        ctx.lineTo(curW, yG);
        ctx.stroke();
      }

      // 2. Render 4 Vertical Highway Lanes with Neon Accents
      for (let l = 0; l < 4; l++) {
        const lx = l * laneW;
        const laneColor = LANE_COLORS[l];

        // Lane Fill
        ctx.fillStyle = l % 2 === 0 ? 'rgba(255, 255, 255, 0.02)' : 'rgba(0, 0, 0, 0.25)';
        ctx.fillRect(lx, 0, laneW, curH);

        // Divider
        if (l > 0) {
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(lx, 0);
          ctx.lineTo(lx, curH);
          ctx.stroke();
        }

        // Active tap lane laser beam flash
        if (state.laneHitFlash[l] > 0) {
          const flashGrad = ctx.createLinearGradient(lx, HIT_Y, lx, 0);
          flashGrad.addColorStop(0, `${laneColor}66`);
          flashGrad.addColorStop(0.4, `${laneColor}22`);
          flashGrad.addColorStop(1, 'transparent');
          ctx.fillStyle = flashGrad;
          ctx.fillRect(lx, 0, laneW, curH);
        }

        // Receptor Target Ring at HIT_Y
        const receptorY = HIT_Y;
        const receptorH = 26;
        const rx = lx + 6;
        const rw = laneW - 12;

        ctx.fillStyle = state.laneHitFlash[l] > 0 ? `${laneColor}55` : 'rgba(255, 255, 255, 0.06)';
        ctx.strokeStyle = state.laneHitFlash[l] > 0 ? '#FFFFFF' : `${laneColor}88`;
        ctx.lineWidth = state.laneHitFlash[l] > 0 ? 3 : 1.5;

        // Rounded hit capsule
        ctx.fillRect(rx, receptorY - receptorH / 2, rw, receptorH);
        ctx.strokeRect(rx, receptorY - receptorH / 2, rw, receptorH);

        // Key Label
        ctx.fillStyle = state.laneHitFlash[l] > 0 ? '#FFFFFF' : 'rgba(255, 255, 255, 0.6)';
        ctx.font = 'bold 13px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(LANE_LABELS[l], lx + laneW / 2, receptorY);
      }

      // Horizontal Neon Hit Bar
      ctx.strokeStyle = state.isOverdrive ? '#F43F5E' : '#38BDF8';
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(0, HIT_Y);
      ctx.lineTo(curW, HIT_Y);
      ctx.stroke();

      // 3. Render Falling Notes
      // Check for simultaneous chord notes to connect with laser bar
      const visibleNotes = state.notes.filter((n) => {
        if (n.isHit && !n.isHolding) return false;
        if (n.isHolding && n.holdBeats) {
          return displayBeat <= n.beatTime + n.holdBeats;
        }
        const delta = n.beatTime - displayBeat;
        return delta <= state.beatsAhead && delta >= -0.8;
      });

      // Render Chord Connector lines for simultaneous double hits
      const notesByBeat = new Map<number, ActiveNote[]>();
      for (const n of visibleNotes) {
        const roundedBeat = Math.round(n.beatTime * 100) / 100;
        if (!notesByBeat.has(roundedBeat)) notesByBeat.set(roundedBeat, []);
        notesByBeat.get(roundedBeat)!.push(n);
      }

      for (const [, chordGroup] of notesByBeat) {
        if (chordGroup.length > 1) {
          const beatsRemaining = chordGroup[0].beatTime - displayBeat;
          const ny = HIT_Y - (beatsRemaining / state.beatsAhead) * HIT_Y;
          const minLane = Math.min(...chordGroup.map((c) => c.lane));
          const maxLane = Math.max(...chordGroup.map((c) => c.lane));
          const x1 = (minLane + 0.5) * laneW;
          const x2 = (maxLane + 0.5) * laneW;

          ctx.strokeStyle = '#FACC15';
          ctx.lineWidth = 4;
          ctx.beginPath();
          ctx.moveTo(x1, ny);
          ctx.lineTo(x2, ny);
          ctx.stroke();
        }
      }

      for (const note of visibleNotes) {
        const isActiveHold = Boolean(note.isHolding && note.holdBeats);
        const beatsRemaining = isActiveHold
          ? Math.max(0, note.beatTime + (note.holdBeats ?? 0) - displayBeat)
          : note.beatTime - displayBeat;
        const ny = isActiveHold ? HIT_Y : HIT_Y - (beatsRemaining / state.beatsAhead) * HIT_Y;
        const nx = note.lane * laneW + 8;
        const nw = laneW - 16;
        const noteColor = note.type === 'bonus' ? '#FACC15' : LANE_COLORS[note.lane];

        // Hold Note Laser Trail
        if (note.type === 'hold' && note.holdBeats) {
          const visibleHoldBeats = isActiveHold ? beatsRemaining : note.holdBeats;
          const holdPixelLen = (visibleHoldBeats / state.beatsAhead) * HIT_Y;
          const beamGrad = ctx.createLinearGradient(nx, ny - holdPixelLen, nx, ny);
          beamGrad.addColorStop(0, `${noteColor}22`);
          beamGrad.addColorStop(1, `${noteColor}BB`);
          ctx.fillStyle = beamGrad;
          ctx.fillRect(nx + nw * 0.25, ny - holdPixelLen, nw * 0.5, holdPixelLen);

          ctx.strokeStyle = noteColor;
          ctx.lineWidth = 2;
          ctx.strokeRect(nx + nw * 0.25, ny - holdPixelLen, nw * 0.5, holdPixelLen);
        }

        // Note Head
        const noteH = 22;
        ctx.save();

        const noteGrad = ctx.createLinearGradient(nx, ny - noteH / 2, nx, ny + noteH / 2);
        noteGrad.addColorStop(0, '#FFFFFF');
        noteGrad.addColorStop(0.35, noteColor);
        noteGrad.addColorStop(1, '#000000');

        ctx.fillStyle = noteGrad;
        ctx.fillRect(nx, ny - noteH / 2, nw, noteH);

        ctx.strokeStyle = '#FFFFFF';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(nx, ny - noteH / 2, nw, noteH);

        // Bonus Star Icon
        if (note.type === 'bonus') {
          ctx.fillStyle = '#000000';
          ctx.font = 'bold 11px monospace';
          ctx.textAlign = 'center';
          ctx.textBaseline = 'middle';
          ctx.fillText('★ 2X', nx + nw / 2, ny);
        }

        ctx.restore();
      }

      // Countdown Lead-in Overlay if currentBeat < 0
      if (state.currentBeat < 0) {
        const count = Math.ceil(-state.currentBeat);
        ctx.save();
        ctx.fillStyle = '#FFFFFF';
        ctx.font = '900 38px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = '#38BDF8';
        ctx.shadowBlur = 20;
        ctx.fillText(`GET READY: ${count}`, curW / 2, curH * 0.45);
        ctx.restore();
      }

      // 4. Render Particles
      for (const p of state.particles) {
        ctx.save();
        ctx.globalAlpha = p.life;
        ctx.fillStyle = p.color;
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      // 5. Render Accuracy Popups
      for (const pop of state.popups) {
        const px = (pop.lane + 0.5) * laneW;
        const py = HIT_Y - 40 - (1 - pop.life) * 32;
        ctx.save();
        ctx.globalAlpha = pop.life;
        ctx.fillStyle = pop.color;
        ctx.font = '900 16px monospace';
        ctx.textAlign = 'center';
        ctx.shadowColor = pop.color;
        ctx.shadowBlur = 10;
        ctx.fillText(pop.text, px, py);

        if (pop.subtext) {
          ctx.font = 'bold 11px monospace';
          ctx.fillStyle = '#FFFFFF';
          ctx.fillText(pop.subtext, px, py + 16);
        }
        ctx.restore();
      }

      // Determine current section name for HUD
      const curSection = musicEngine.getCurrentSection(state.currentBeat);
      const sectionName = curSection ? curSection.name : state.currentBeat < 0 ? 'COUNTDOWN' : 'PLAY';

      // Update HUD State
      setHudStats({
        score: state.score,
        combo: state.combo,
        maxCombo: state.maxCombo,
        multiplier: state.multiplier,
        grooveHealth: Math.round(state.grooveHealth),
        overdrive: state.isOverdrive,
        overdriveTime: Math.ceil(state.overdriveTimer),
        songProgress: Math.max(0, Math.min(100, Math.round((state.currentBeat / state.song.durationBeats) * 100))),
        currentSongTitle: state.song.title,
        currentSectionName: sectionName,
        bpm: state.song.bpm,
      });

      return state.isAlive;
    },
  });

  return (
    <div
      ref={containerRef}
      id="rhythm-game-container"
      className="relative w-full h-full min-h-0 flex flex-col items-center justify-center bg-[#09090D] select-none overflow-hidden touch-none"
    >
      {/* Top Cyber HUD Bar & Track Selector */}
      <div className="absolute top-2.5 left-2.5 right-2.5 flex items-center justify-between z-10 gap-1.5 flex-wrap">
        {/* Track Selector & Multiplier */}
        <div className="flex items-center gap-1.5 sm:gap-2">
          {/* Song Switcher Dropdown */}
          <div className="flex items-center gap-1 bg-[#18181B]/95 border border-[#27272A] p-1 rounded-xl shadow-lg backdrop-blur-md">
            <Disc className="w-3.5 h-3.5 text-rose-400 animate-spin ml-1 shrink-0" />
            <select
              value={selectedSongIndex}
              onChange={(e) => handleSelectSong(Number(e.target.value))}
              className="bg-transparent text-white text-xs font-mono font-bold focus:outline-none cursor-pointer pr-1"
            >
              {RHYTHM_SONGS.map((song, i) => (
                <option key={song.id} value={i} className="bg-[#18181B] text-white">
                  {song.title} ({song.bpm} BPM)
                </option>
              ))}
            </select>
          </div>

          <div
            className="flex items-center rounded-xl bg-[#18181B]/95 border border-[#27272A] overflow-hidden font-mono text-[10px]"
            title={`Audio sync compensation. Browser estimate: ${estimatedLatencyMs}ms. Positive values delay visual/judgement timing to match delayed audio.`}
          >
            <button
              type="button"
              onClick={() => updateLatencyOffset(latencyOffsetMs - RHYTHM_LATENCY_STEP_MS)}
              className="px-2 py-1 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] cursor-pointer"
              aria-label="Reduce rhythm latency compensation by 10 milliseconds"
            >
              −
            </button>
            <button
              type="button"
              onClick={() => updateLatencyOffset(estimatedLatencyMs)}
              className="px-1.5 py-1 text-cyan-300 hover:text-white hover:bg-[#27272A] cursor-pointer tabular-nums"
              title="Use the browser's estimated audio output latency"
            >
              SYNC {latencyOffsetMs >= 0 ? '+' : ''}{latencyOffsetMs}ms
            </button>
            <button
              type="button"
              onClick={() => updateLatencyOffset(latencyOffsetMs + RHYTHM_LATENCY_STEP_MS)}
              className="px-2 py-1 text-[#A1A1AA] hover:text-white hover:bg-[#27272A] cursor-pointer"
              aria-label="Increase rhythm latency compensation by 10 milliseconds"
            >
              +
            </button>
          </div>

          {/* Section Indicator */}
          <div className="px-2 py-0.5 rounded-lg bg-sky-500/15 border border-sky-500/30 text-sky-300 font-mono font-bold text-[10px] uppercase tracking-wider hidden xs:inline-block">
            {hudStats.currentSectionName}
          </div>

          <div
            className={`px-2 py-1 rounded-xl border flex items-center gap-1 transition-all ${
              hudStats.overdrive
                ? 'bg-rose-500/25 border-rose-500 text-rose-300 shadow-[0_0_15px_rgba(244,63,94,0.5)] animate-pulse'
                : hudStats.multiplier > 1
                ? 'bg-amber-500/20 border-amber-500/50 text-amber-300'
                : 'bg-[#18181B]/80 border-[#27272A] text-[#A1A1AA]'
            }`}
          >
            {hudStats.overdrive ? (
              <Flame className="w-3.5 h-3.5 text-rose-400 animate-bounce" />
            ) : (
              <Zap className="w-3 h-3 text-amber-400" />
            )}
            <span className="text-xs font-mono font-black tracking-wider">
              {hudStats.multiplier}x
            </span>
          </div>
        </div>

        {/* Groove Shield Meter & Progress */}
        <div className="flex items-center gap-2 bg-[#18181B]/95 border border-[#27272A] px-2.5 py-1 rounded-xl backdrop-blur-md">
          <Shield className={`w-3.5 h-3.5 ${hudStats.grooveHealth < 30 ? 'text-rose-500 animate-ping' : 'text-emerald-400'}`} />
          <div className="w-14 sm:w-20 h-2 bg-[#27272A] rounded-full overflow-hidden">
            <div
              className={`h-full transition-all duration-200 ${
                hudStats.grooveHealth < 30
                  ? 'bg-rose-500'
                  : hudStats.grooveHealth < 60
                  ? 'bg-amber-500'
                  : 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]'
              }`}
              style={{ width: `${hudStats.grooveHealth}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-[#A1A1AA] tabular-nums">{hudStats.grooveHealth}%</span>
        </div>
      </div>

      {/* Main Rhythm Canvas */}
      <canvas ref={canvasRef} className="w-full h-full block cursor-pointer" />

      {/* Mobile/Touch Lane Input Buttons */}
      <div className="absolute bottom-2 left-2 right-2 grid grid-cols-4 gap-1.5 z-20 md:hidden">
        {LANE_LABELS.map((label, idx) => {
          const isPressed = activeLanes[idx];
          const color = LANE_COLORS[idx];
          return (
            <button
              key={label}
              type="button"
              id={`lane-btn-${idx}`}
              onPointerDown={(e) => {
                e.preventDefault();
                laneHeldRef.current[idx] = true;
                setActiveLanes((prev) => {
                  const next = [...prev];
                  next[idx] = true;
                  return next;
                });
                handleLaneTrigger(idx);
              }}
              onPointerUp={() => {
                laneHeldRef.current[idx] = false;
                setActiveLanes((prev) => {
                  const next = [...prev];
                  next[idx] = false;
                  return next;
                });
              }}
              onPointerLeave={() => {
                laneHeldRef.current[idx] = false;
                setActiveLanes((prev) => {
                  const next = [...prev];
                  next[idx] = false;
                  return next;
                });
              }}
              className="py-3.5 rounded-xl border text-center font-mono font-black text-sm uppercase transition-transform active:scale-95 cursor-pointer backdrop-blur-md"
              style={{
                backgroundColor: isPressed ? `${color}44` : 'rgba(18, 18, 24, 0.85)',
                borderColor: isPressed ? color : 'rgba(255, 255, 255, 0.15)',
                color: isPressed ? '#FFFFFF' : color,
                boxShadow: isPressed ? `0 0 12px ${color}` : 'none',
              }}
            >
              {label}
            </button>
          );
        })}
      </div>

      {/* Desktop Keyboard Helper Footer */}
      <div className="absolute bottom-2 hidden md:flex items-center gap-3 px-3 py-1 rounded-full bg-[#121215]/80 border border-[#27272A] text-[10px] text-[#71717A] font-mono z-10 pointer-events-none">
        <span>Keys: <b className="text-white">D</b> • <b className="text-white">F</b> • <b className="text-white">J</b> • <b className="text-white">K</b></span>
        <span>or <b className="text-white">← ↓ ↑ →</b> / <b className="text-white">1 2 3 4</b></span>
      </div>
    </div>
  );
};
