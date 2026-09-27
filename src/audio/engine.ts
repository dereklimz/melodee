import * as Tone from 'tone';
import type { Analysis, LaneId } from '../types/analysis';
import { buildInstrument, type BuiltInstrument } from './presets';

const OWNED_STEM_LANES: LaneId[] = ['kick', 'clap', 'hats', 'perc', 'bass', 'vocal'];
const SHARED_GROUP: LaneId[] = ['chords', 'pad', 'lead'];

interface LaneChannel {
  instrument: BuiltInstrument;
  synthGain: Tone.Gain;
  player: Tone.Player | null;
  playerGain: Tone.Gain | null;
  volume: Tone.Volume;
  part: Tone.Part;
  presetKey: string;
  isOriginal: boolean;
  muted: boolean;
  soloed: boolean;
}

class AudioEngine {
  private channels = new Map<LaneId, LaneChannel>();
  private analysis: Analysis | null = null;
  private masterVolume = new Tone.Volume(0).toDestination();
  private started = false;
  private onPositionChange: ((bar: number, beat: number) => void) | null = null;
  private positionTicker: number | null = null;

  // Shared "other" stem playback for the chords/pad/lead group (Replace
  // mode default: mute the shared stem the moment any sibling lane swaps
  // away from Original, so the other siblings fall back to synth-from-notes).
  private sharedPlayer: Tone.Player | null = null;
  private sharedPlayerGain: Tone.Gain | null = null;

  async ensureStarted() {
    if (!this.started) {
      await Tone.start();
      this.started = true;
    }
  }

  /** Loads baked analysis + (if present) real stem audio for owned-stem
   * lanes and the shared chords/pad/lead stem. Resolves once all real
   * audio buffers have finished loading (or immediately if none exist —
   * synth-only playback still works either way). */
  async load(analysis: Analysis, songId: string) {
    this.disposeAll();
    this.analysis = analysis;
    Tone.getTransport().bpm.value = analysis.song.bpm;
    const secPerBeat = 60 / analysis.song.bpm;
    const base = `/songs/${songId}`;

    analysis.lanes.forEach((lane) => {
      const volume = new Tone.Volume(0).connect(this.masterVolume);
      const synthGain = new Tone.Gain(1).connect(volume);
      const instrument = buildInstrument(lane.id, 'Original');
      instrument.output.connect(synthGain);

      let player: Tone.Player | null = null;
      let playerGain: Tone.Gain | null = null;
      const isOwnedStem = OWNED_STEM_LANES.includes(lane.id);
      const isOriginal = true;

      if (isOwnedStem) {
        playerGain = new Tone.Gain(1).connect(volume);
        player = new Tone.Player({
          url: `${base}/${lane.id}.flac`,
          loop: false,
          onerror: () => {
            // No real stem baked yet (or this song has none) — fall back
            // to synth-from-notes for this lane instead of silence.
            console.warn(`No real stem audio for lane "${lane.id}" — using synth fallback`);
            const ch = this.channels.get(lane.id);
            if (ch) {
              ch.isOriginal = false;
              ch.synthGain.gain.value = 1;
              if (ch.playerGain) ch.playerGain.gain.value = 0;
            }
          },
        });
        player.connect(playerGain);
        player.sync().start(0);
        synthGain.gain.value = 0; // real audio audible by default, synth silent
      }

      const notes = lane.clips.flatMap((c) => c.notes);
      const part = new Tone.Part((time, note: { pitch: number; durBeats: number; vel: number }) => {
        const channel = this.channels.get(lane.id);
        if (!channel || channel.muted) return;
        // Skip synth triggering entirely while real audio (or the shared
        // stem, for chords/pad/lead) is the audible source — saves voices
        // and avoids a faint synth doubling under the real stem.
        if (isOwnedStem && channel.isOriginal) return;
        if (SHARED_GROUP.includes(lane.id) && this.sharedStemActive()) return;
        channel.instrument.trigger(note.pitch, Math.max(note.durBeats * secPerBeat, 0.03), time, Math.max(note.vel, 1) / 100);
      }, notes.map((n) => [n.beat * secPerBeat, n]));
      part.start(0);

      this.channels.set(lane.id, {
        instrument, synthGain, player, playerGain, volume, part,
        presetKey: 'Original', isOriginal, muted: false, soloed: false,
      });
    });

    // Shared "other" stem for chords/pad/lead — one player, connected
    // straight to master (see class comment: simplification vs. three
    // independent volume-controlled copies of the same source audio).
    if (SHARED_GROUP.some((id) => analysis.lanes.find((l) => l.id === id))) {
      this.sharedPlayerGain = new Tone.Gain(1).connect(this.masterVolume);
      this.sharedPlayer = new Tone.Player({
        url: `${base}/chords.flac`,
        loop: false,
        onerror: () => {
          console.warn('No real shared stem audio (chords/pad/lead) — using synth fallback');
          SHARED_GROUP.forEach((id) => {
            const c = this.channels.get(id);
            if (c) {
              c.isOriginal = false;
              c.synthGain.gain.value = 1;
            }
          });
          if (this.sharedPlayerGain) this.sharedPlayerGain.gain.value = 0;
        },
      });
      this.sharedPlayer.connect(this.sharedPlayerGain);
      this.sharedPlayer.sync().start(0);
    }

    try {
      await Tone.loaded();
    } catch {
      // Individual player onerror handlers above already applied the
      // synth fallback for whichever stems failed to load.
    }
  }

  private sharedStemActive(): boolean {
    return SHARED_GROUP.every((id) => this.channels.get(id)?.isOriginal !== false);
  }

  private refreshSharedStemMute() {
    if (this.sharedPlayerGain) {
      this.sharedPlayerGain.gain.value = this.sharedStemActive() ? 1 : 0;
    }
  }

  swapInstrument(laneId: LaneId, presetKey: string) {
    const channel = this.channels.get(laneId);
    if (!channel) return;
    const newInstrument = buildInstrument(laneId, presetKey);
    newInstrument.output.connect(channel.synthGain);
    const old = channel.instrument;
    channel.instrument = newInstrument;
    channel.presetKey = presetKey;
    channel.isOriginal = presetKey === 'Original';

    if (OWNED_STEM_LANES.includes(laneId)) {
      channel.synthGain.gain.value = channel.isOriginal ? 0 : 1;
      if (channel.playerGain) channel.playerGain.gain.value = channel.isOriginal ? 1 : 0;
    } else if (SHARED_GROUP.includes(laneId)) {
      this.refreshSharedStemMute();
      SHARED_GROUP.forEach((id) => {
        const c = this.channels.get(id);
        if (c) c.synthGain.gain.value = this.sharedStemActive() ? 0 : 1;
      });
    }

    window.setTimeout(() => old.dispose(), 200);
  }

  setMute(laneId: LaneId, muted: boolean) {
    const channel = this.channels.get(laneId);
    if (!channel) return;
    channel.muted = muted;
    this.applySoloMute();
  }

  setSolo(laneId: LaneId, soloed: boolean) {
    const channel = this.channels.get(laneId);
    if (!channel) return;
    channel.soloed = soloed;
    this.applySoloMute();
  }

  private applySoloMute() {
    const anySoloed = Array.from(this.channels.values()).some((c) => c.soloed);
    this.channels.forEach((channel) => {
      const audible = anySoloed ? channel.soloed : !channel.muted;
      channel.volume.mute = !audible;
    });
  }

  setLaneVolume(laneId: LaneId, value: number) {
    const channel = this.channels.get(laneId);
    if (!channel) return;
    channel.volume.volume.value = Tone.gainToDb(Math.max(value, 0.0001));
  }

  setMasterVolume(value: number) {
    this.masterVolume.volume.value = Tone.gainToDb(Math.max(value, 0.0001));
  }

  async play(onPosition?: (bar: number, beat: number) => void) {
    await this.ensureStarted();
    if (onPosition) this.onPositionChange = onPosition;
    Tone.getTransport().start();
    this.startTicker();
  }

  pause() {
    Tone.getTransport().pause();
    this.stopTicker();
  }

  stop() {
    Tone.getTransport().stop();
    Tone.getTransport().position = 0;
    this.stopTicker();
  }

  setLoop(range: { startBar: number; endBar: number } | null) {
    const transport = Tone.getTransport();
    if (!range || !this.analysis) {
      transport.loop = false;
      return;
    }
    const secPerBeat = 60 / this.analysis.song.bpm;
    transport.loopStart = range.startBar * 4 * secPerBeat;
    transport.loopEnd = range.endBar * 4 * secPerBeat;
    transport.loop = true;
  }

  seekToBar(bar: number) {
    if (!this.analysis) return;
    const secPerBeat = 60 / this.analysis.song.bpm;
    Tone.getTransport().seconds = bar * 4 * secPerBeat;
  }

  private startTicker() {
    this.stopTicker();
    this.positionTicker = window.setInterval(() => {
      if (!this.analysis || !this.onPositionChange) return;
      const secPerBeat = 60 / this.analysis.song.bpm;
      const totalBeats = Tone.getTransport().seconds / secPerBeat;
      const bar = Math.floor(totalBeats / 4);
      const beat = totalBeats % 4;
      this.onPositionChange(bar, beat);
    }, 60);
  }

  private stopTicker() {
    if (this.positionTicker !== null) {
      window.clearInterval(this.positionTicker);
      this.positionTicker = null;
    }
  }

  disposeAll() {
    this.stop();
    this.channels.forEach((c) => {
      c.part.dispose();
      c.instrument.dispose();
      c.synthGain.dispose();
      c.player?.dispose();
      c.playerGain?.dispose();
      c.volume.dispose();
    });
    this.channels.clear();
    this.sharedPlayer?.dispose();
    this.sharedPlayerGain?.dispose();
    this.sharedPlayer = null;
    this.sharedPlayerGain = null;
  }
}

export const audioEngine = new AudioEngine();
