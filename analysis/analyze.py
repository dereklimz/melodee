#!/usr/bin/env python3
"""Melodee offline analysis pipeline.

Real stem separation (Demucs + MDX23C DrumSep) and real note transcription
(Basic Pitch + onset detection) on an actual song audio file, producing
Melodee's analysis.json schema plus encoded FLAC stems.

Usage:
    python analyze.py --song "<path to mp3/wav>" --out public/songs/<id>/ --id <id> --title "..." --artist "..."
"""
import argparse
import json
import math
import subprocess
import sys
import warnings
from pathlib import Path

warnings.filterwarnings("ignore")

import numpy as np
import librosa
import soundfile as sf
import pyloudnorm as pyln

# ---------------------------------------------------------------------------
# Lane / instrument constants
# ---------------------------------------------------------------------------
LANE_ORDER = ["kick", "clap", "hats", "perc", "bass", "chords", "pad", "lead", "vocal", "ear-candy"]
LANE_NAMES = {
    "kick": "Kick", "clap": "Clap", "hats": "Hats", "perc": "Perc",
    "bass": "Bass", "chords": "Chords", "pad": "Pad", "lead": "Lead",
    "vocal": "Vocal", "ear-candy": "Ear Candy",
}
DRUM_LANES = {"kick", "clap", "hats", "perc"}

PITCH_CLASSES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"]
# Camelot wheel: (tonic index, mode) -> code
CAMELOT_MAJOR = {0: "8B", 1: "3B", 2: "10B", 3: "5B", 4: "12B", 5: "7B", 6: "2B", 7: "9B", 8: "4B", 9: "11B", 10: "6B", 11: "1B"}
CAMELOT_MINOR = {0: "5A", 1: "12A", 2: "7A", 3: "2A", 4: "9A", 5: "4A", 6: "11A", 7: "6A", 8: "1A", 9: "8A", 10: "3A", 11: "10A"}

KS_MAJOR = np.array([6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88])
KS_MINOR = np.array([6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17])


def log(msg):
    print(f"[analyze] {msg}", flush=True)


def run(cmd):
    log("$ " + " ".join(str(c) for c in cmd))
    subprocess.run(cmd, check=True)


# ---------------------------------------------------------------------------
# Stage: load / convert
# ---------------------------------------------------------------------------
def to_wav(song_path: Path, work: Path) -> Path:
    wav_path = work / "mix.wav"
    run(["ffmpeg", "-y", "-i", str(song_path), "-ar", "44100", "-ac", "2", str(wav_path)])
    return wav_path


# ---------------------------------------------------------------------------
# Stage: beat grid
# ---------------------------------------------------------------------------
def detect_beat_grid(wav_path: Path):
    y, sr = librosa.load(wav_path, sr=44100, mono=True)
    tempo, beat_frames = librosa.beat.beat_track(y=y, sr=sr, trim=False)
    bpm = float(np.round(np.atleast_1d(tempo)[0], 2))
    beat_times = librosa.frames_to_time(beat_frames, sr=sr)
    first_downbeat_sec = float(beat_times[0]) if len(beat_times) else 0.0
    duration_sec = float(len(y) / sr)
    bar_len_sec = 4 * 60.0 / bpm
    total_bars = math.ceil((duration_sec - first_downbeat_sec) / bar_len_sec)
    return {
        "bpm": bpm,
        "first_downbeat_sec": first_downbeat_sec,
        "duration_sec": duration_sec,
        "total_bars": total_bars,
        "y": y,
        "sr": sr,
    }


# ---------------------------------------------------------------------------
# Stage: Demucs separation
# ---------------------------------------------------------------------------
def run_demucs(wav_path: Path, work: Path) -> dict:
    out_dir = work / "demucs"
    run([sys.executable, "-m", "demucs.separate", "-n", "htdemucs_6s", "-o", str(out_dir), str(wav_path)])
    stem_dir = out_dir / "htdemucs_6s" / wav_path.stem
    stems = {}
    for name in ["drums", "bass", "vocals", "other", "piano", "guitar"]:
        p = stem_dir / f"{name}.wav"
        if p.exists():
            stems[name] = p
    return stems


# ---------------------------------------------------------------------------
# Stage: DrumSep
# ---------------------------------------------------------------------------
def run_drumsep(drums_wav: Path, work: Path) -> dict:
    from audio_separator.separator import Separator

    out_dir = work / "drumsep"
    out_dir.mkdir(parents=True, exist_ok=True)
    sep = Separator(output_dir=str(out_dir))
    sep.load_model(model_filename="MDX23C-DrumSep-aufr33-jarredou.ckpt")
    files = sep.separate(str(drums_wav))
    stems = {}
    for f in files:
        fpath = out_dir / f
        low = f.lower()
        for key in ["kick", "snare", "toms", "hh", "ride", "crash"]:
            if f"({key})" in low:
                stems[key] = fpath
    # Residual = drums - sum(sub-stems), captures cymbals/percussion the
    # model didn't isolate into a named stem.
    drums_y, sr = sf.read(drums_wav)
    if drums_y.ndim == 1:
        drums_y = drums_y[:, None]
    acc = np.zeros_like(drums_y, dtype=np.float64)
    for key, p in stems.items():
        y, _ = sf.read(p)
        if y.ndim == 1:
            y = y[:, None]
        n = min(len(acc), len(y))
        acc[:n] += y[:n]
    n = min(len(acc), len(drums_y))
    residual = drums_y[:n].astype(np.float64) - acc[:n]
    residual_path = out_dir / "residual.wav"
    sf.write(residual_path, residual.astype(np.float32), sr)
    stems["residual"] = residual_path
    return stems


# ---------------------------------------------------------------------------
# Stage: onset-based drum notes (kick/clap/hats/perc)
# ---------------------------------------------------------------------------
def onset_notes(wav_path: Path, bpm: float, first_downbeat_sec: float, pitch: int, min_grid=0.25, amp_gate=0.12):
    """Onset-detect a drum sub-stem into quantized note events. `min_grid`
    is the smallest allowed spacing between hits in beats (default: 1/16 at
    this tempo would be 0.25 beats — actually a 1/16 note IS 0.25 beats in
    our 4-beats-per-bar convention); `amp_gate` drops onsets whose local
    peak is below this fraction of the stem's own max (filters separation
    bleed/noise rather than real hits)."""
    y, sr = librosa.load(wav_path, sr=44100, mono=True)
    if np.max(np.abs(y)) < 1e-4:
        return []
    beat_len = 60.0 / bpm
    min_frames_gap = int((min_grid * beat_len) * sr / 512)  # in onset-strength hop units
    onset_frames = librosa.onset.onset_detect(
        y=y, sr=sr, backtrack=True, units="frames",
        wait=max(min_frames_gap, 1), delta=0.07, pre_max=3, post_max=3,
    )
    onset_times = librosa.frames_to_time(onset_frames, sr=sr)
    rms = librosa.feature.rms(y=y)[0]
    rms_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr)
    notes = []
    max_rms = float(np.max(rms)) or 1.0
    for t in onset_times:
        idx = min(int(np.searchsorted(rms_times, t)), len(rms) - 1)
        level = rms[idx] / max_rms
        if level < amp_gate:
            continue
        vel = min(127, max(20, int(level * 127)))
        beat = (t - first_downbeat_sec) / beat_len
        if beat < 0:
            continue
        beat_q = round(beat * 4) / 4  # snap to 1/16
        notes.append({"beat": beat_q, "pitch": pitch, "durBeats": 0.25, "vel": vel})
    # De-dup any hits that still collapsed onto the same 1/16 slot.
    seen = set()
    deduped = []
    for n in notes:
        if n["beat"] in seen:
            continue
        seen.add(n["beat"])
        deduped.append(n)
    return deduped


# ---------------------------------------------------------------------------
# Stage: Basic Pitch transcription (melodic/harmonic stems)
# ---------------------------------------------------------------------------
def basic_pitch_notes(wav_path: Path, bpm: float, first_downbeat_sec: float, monophonic=False):
    from basic_pitch.inference import predict

    _, _, note_events = predict(str(wav_path))
    beat_len = 60.0 / bpm
    notes = []
    for start_s, end_s, pitch, amp, _bends in note_events:
        beat = (float(start_s) - first_downbeat_sec) / beat_len
        if beat < 0:
            continue
        dur_beats = max((float(end_s) - float(start_s)) / beat_len, 0.125)
        beat_q = round(beat * 16) / 16
        vel = min(127, max(20, int(float(amp) * 127)))
        notes.append({"beat": beat_q, "pitch": int(pitch), "durBeats": round(dur_beats, 3), "vel": vel})
    notes.sort(key=lambda n: n["beat"])
    if monophonic:
        # Keep only the highest-pitched note active at any given time,
        # merging into a single contour (drop lower simultaneous notes).
        notes = _monophonic_top_line(notes)
    return notes


def _monophonic_top_line(notes):
    if not notes:
        return notes
    events = []
    for n in notes:
        events.append((n["beat"], 1, n))
        events.append((n["beat"] + n["durBeats"], -1, n))
    events.sort(key=lambda e: (e[0], -e[1]))
    active = []
    out = []
    current_top = None
    seg_start = None
    for t, kind, n in events:
        if kind == 1:
            active.append(n)
        else:
            if n in active:
                active.remove(n)
        top = max(active, key=lambda a: a["pitch"]) if active else None
        if top is not current_top:
            if current_top is not None and seg_start is not None and t > seg_start:
                out.append({"beat": round(seg_start, 4), "pitch": current_top["pitch"],
                             "durBeats": round(t - seg_start, 4), "vel": current_top["vel"]})
            current_top = top
            seg_start = t
    return [n for n in out if n["durBeats"] > 0.05]


def split_chords_pad_lead(other_notes):
    """Classify polyphonic 'other' notes into Chords (short stabs), Pad
    (long sustained polyphony) and Lead (monophonic top line)."""
    lead = _monophonic_top_line(other_notes)
    chords, pad = [], []
    for n in other_notes:
        if n["durBeats"] >= 3.5:
            pad.append(n)
        else:
            chords.append(n)
    return chords, pad, lead


# ---------------------------------------------------------------------------
# Stage: key detection (Krumhansl-Schmuckler on chroma)
# ---------------------------------------------------------------------------
def detect_key(y, sr):
    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    chroma_mean = chroma.mean(axis=1)
    chroma_mean = chroma_mean / (chroma_mean.sum() or 1.0)
    best = (None, None, -1e9)
    for shift in range(12):
        maj = np.roll(KS_MAJOR, shift)
        score = np.corrcoef(chroma_mean, maj / maj.sum())[0, 1]
        if score > best[2]:
            best = (shift, "major", score)
        minr = np.roll(KS_MINOR, shift)
        score = np.corrcoef(chroma_mean, minr / minr.sum())[0, 1]
        if score > best[2]:
            best = (shift, "minor", score)
    tonic_idx, mode, _ = best
    tonic = PITCH_CLASSES[tonic_idx]
    camelot = (CAMELOT_MAJOR if mode == "major" else CAMELOT_MINOR)[tonic_idx]
    return {"tonic": tonic, "mode": mode, "camelot": camelot}


# ---------------------------------------------------------------------------
# Stage: sections (novelty + 8-bar snap) and energy
# ---------------------------------------------------------------------------
def analyze_structure(y, sr, bpm, first_downbeat_sec, total_bars):
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    onset_env = librosa.onset.onset_strength(y=y, sr=sr, hop_length=hop)
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

    beat_len = 60.0 / bpm
    bar_len = beat_len * 4

    def bar_slice(bar):
        t0 = first_downbeat_sec + bar * bar_len
        t1 = t0 + bar_len
        mask = (frame_times >= t0) & (frame_times < t1)
        return mask

    bar_rms, bar_cent, bar_onset = [], [], []
    for bar in range(total_bars):
        mask = bar_slice(bar)
        bar_rms.append(float(rms[mask].mean()) if mask.any() else 0.0)
        bar_cent.append(float(cent[mask].mean()) if mask.any() else 0.0)
        bar_onset.append(float(onset_env[mask].mean()) if mask.any() else 0.0)

    def norm(vals):
        arr = np.array(vals)
        lo, hi = arr.min(), arr.max()
        return ((arr - lo) / (hi - lo + 1e-9)).tolist()

    n_rms, n_cent, n_onset = norm(bar_rms), norm(bar_cent), norm(bar_onset)
    bar_energy = [round(100 * (0.5 * n_rms[i] + 0.25 * n_cent[i] + 0.25 * n_onset[i]), 1) for i in range(total_bars)]

    def smooth(vals, w=2):
        out = []
        for i in range(len(vals)):
            lo, hi = max(0, i - w), min(len(vals), i + w + 1)
            out.append(round(sum(vals[lo:hi]) / (hi - lo), 1))
        return out

    bar_energy = smooth(bar_energy)

    # Sections: 8-bar phrases classified by mean energy, merged, typed by
    # position + trend. Levels are assigned by PERCENTILE within this
    # track's own phrase-energy distribution, not fixed absolute cutoffs —
    # a loudness-maximized master can have its whole song sit in a narrow
    # band (e.g. 20-70) where fixed 35/65 thresholds collapse everything
    # into "medium". Tercile split guarantees real low/medium/high spread
    # regardless of the track's absolute dynamic range.
    phrase_bars = 8
    n_phrases = math.ceil(total_bars / phrase_bars)
    phrase_energy = []
    for p in range(n_phrases):
        lo, hi = p * phrase_bars, min(total_bars, (p + 1) * phrase_bars)
        phrase_energy.append(sum(bar_energy[lo:hi]) / max(hi - lo, 1))

    sorted_energy = sorted(phrase_energy)
    low_cut = sorted_energy[len(sorted_energy) // 3]
    high_cut = sorted_energy[(2 * len(sorted_energy)) // 3]

    def energy_level(e):
        if e <= low_cut:
            return "low"
        if e >= high_cut:
            return "high"
        return "medium"

    phrase_levels = [energy_level(e) for e in phrase_energy]

    blocks = []
    i = 0
    while i < n_phrases:
        j = i + 1
        while j < n_phrases and phrase_levels[j] == phrase_levels[i]:
            j += 1
        blocks.append((i, j, phrase_levels[i]))
        i = j

    sections = []
    for idx, (p0, p1, level) in enumerate(blocks):
        start_bar, end_bar = p0 * phrase_bars, min(total_bars, p1 * phrase_bars)
        if idx == 0:
            sec_type, label = "intro", "Intro"
        elif idx == len(blocks) - 1:
            sec_type, label = "outro", "Outro"
        elif level == "low":
            sec_type, label = "breakdown", "Breakdown"
        elif level == "high":
            sec_type, label = "drop", "Drop"
        else:
            next_level = blocks[idx + 1][2] if idx + 1 < len(blocks) else level
            sec_type, label = ("build", "Build") if next_level == "high" else ("breakdown", "Groove")
        sections.append({"id": f"s{idx+1}", "type": sec_type, "label": label,
                          "startBar": start_bar, "endBar": end_bar, "energyLevel": level})

    counts = {}
    for s in sections:
        counts[s["label"]] = counts.get(s["label"], 0) + 1
    seen = {}
    for s in sections:
        base = s["label"]
        if counts[base] > 1:
            seen[base] = seen.get(base, 0) + 1
            s["label"] = f"{base} {seen[base]}"

    energy_points = []
    for bar in range(total_bars):
        for sub in (0, 2):
            energy_points.append({"beat": bar * 4 + sub, "value": bar_energy[bar]})
    energy_points.append({"beat": total_bars * 4, "value": bar_energy[-1]})

    return sections, energy_points, bar_energy


# ---------------------------------------------------------------------------
# Stage: chords per bar
# ---------------------------------------------------------------------------
TRIADS = {
    "maj": [0, 4, 7], "min": [0, 3, 7],
}


def detect_chords_per_bar(y, sr, bpm, first_downbeat_sec, total_bars, key):
    beat_len = 60.0 / bpm
    bar_len = beat_len * 4
    tonic_idx = PITCH_CLASSES.index(key["tonic"])
    # Diatonic triads of the key (major or natural-minor scale degrees)
    scale = [0, 2, 4, 5, 7, 9, 11] if key["mode"] == "major" else [0, 2, 3, 5, 7, 8, 10]
    diatonic = []
    for degree in scale:
        root = (tonic_idx + degree) % 12
        quality = "maj" if degree in ([0, 5, 7] if key["mode"] == "major" else [3, 8, 10]) else "min"
        diatonic.append((root, quality))

    chroma = librosa.feature.chroma_cqt(y=y, sr=sr)
    frame_times = librosa.frames_to_time(np.arange(chroma.shape[1]), sr=sr)

    chords = []
    for bar in range(total_bars):
        t0 = first_downbeat_sec + bar * bar_len
        t1 = t0 + bar_len
        mask = (frame_times >= t0) & (frame_times < t1)
        if not mask.any():
            continue
        hist = chroma[:, mask].mean(axis=1)
        best = max(diatonic, key=lambda rq: sum(hist[(rq[0] + iv) % 12] for iv in TRIADS[rq[1]]))
        root, quality = best
        symbol = f"{PITCH_CLASSES[root]}{'m' if quality == 'min' else ''}"
        pitches = [60 + (root - tonic_idx) % 12 + iv for iv in TRIADS[quality]]
        chords.append({"bar": bar, "symbol": symbol, "root": PITCH_CLASSES[root], "pitches": pitches})
    return chords


# ---------------------------------------------------------------------------
# Stage: ear-candy candidate events (riser/impact/silence-gap heuristics)
# ---------------------------------------------------------------------------
def detect_ear_candy(y, sr, bpm, first_downbeat_sec, sections):
    beat_len = 60.0 / bpm
    hop = 512
    rms = librosa.feature.rms(y=y, hop_length=hop)[0]
    cent = librosa.feature.spectral_centroid(y=y, sr=sr, hop_length=hop)[0]
    frame_times = librosa.frames_to_time(np.arange(len(rms)), sr=sr, hop_length=hop)

    events = []
    for sec in sections:
        start_sec = first_downbeat_sec + sec["startBar"] * 4 * beat_len
        window_start = start_sec - 2 * beat_len
        mask = (frame_times >= max(window_start, 0)) & (frame_times < start_sec)
        if mask.sum() < 2:
            continue
        cent_seg = cent[mask]
        rms_seg = rms[mask]
        if len(cent_seg) > 1 and cent_seg[-1] > cent_seg[0] * 1.15 and rms_seg[-1] > rms_seg[0] * 1.1:
            beat = (start_sec - 2 * beat_len - first_downbeat_sec) / beat_len
            events.append({"beat": round(max(beat, 0), 2), "type": "riser", "durBeats": 2.0,
                            "label": f"Riser into {sec['label']}"})
        onset_at_start = np.searchsorted(frame_times, start_sec)
        if onset_at_start < len(rms) and rms[onset_at_start] > np.mean(rms) * 1.3:
            beat = (start_sec - first_downbeat_sec) / beat_len
            events.append({"beat": round(beat, 2), "type": "impact", "durBeats": 0.5,
                            "label": f"{sec['label']} impact"})
    return events


# ---------------------------------------------------------------------------
# Stage: waveform peaks + FLAC encode
# ---------------------------------------------------------------------------
def waveform_peaks(y, n_points=1600):
    y_mono = y if y.ndim == 1 else y
    n = len(y_mono)
    step = max(n // n_points, 1)
    peaks = []
    for i in range(n_points):
        seg = y_mono[i * step:(i + 1) * step]
        peaks.append(round(float(np.max(np.abs(seg))) if len(seg) else 0.0, 4))
    m = max(peaks) or 1.0
    return [round(p / m, 4) for p in peaks]


def encode_flac(src_wav: Path, dst_flac: Path, mono=False):
    y, sr = sf.read(src_wav)
    if mono and y.ndim > 1:
        y = y.mean(axis=1)
    sf.write(dst_flac, y, sr, format="FLAC")


# ---------------------------------------------------------------------------
# Main
# ---------------------------------------------------------------------------
def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--song", required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--id", default="where-you-are")
    ap.add_argument("--title", default="Where You Are (Extended Mix)")
    ap.add_argument("--artist", default="John Summit & HAYLA")
    ap.add_argument("--genre", default="House")
    args = ap.parse_args()

    song_path = Path(args.song)
    out_dir = Path(args.out)
    out_dir.mkdir(parents=True, exist_ok=True)
    work = Path("work_full")
    work.mkdir(exist_ok=True)

    log("Converting to WAV...")
    wav_path = to_wav(song_path, work)

    log("Detecting beat grid...")
    grid = detect_beat_grid(wav_path)
    bpm, first_downbeat_sec, duration_sec, total_bars = grid["bpm"], grid["first_downbeat_sec"], grid["duration_sec"], grid["total_bars"]
    y, sr = grid["y"], grid["sr"]
    log(f"BPM={bpm} first_downbeat={first_downbeat_sec:.3f}s bars={total_bars} duration={duration_sec:.1f}s")

    log("Running Demucs (htdemucs_6s)...")
    demucs_stems = run_demucs(wav_path, work)
    log(f"Demucs stems: {list(demucs_stems.keys())}")

    log("Running DrumSep on drums stem...")
    drum_stems = run_drumsep(demucs_stems["drums"], work)
    log(f"DrumSep stems: {list(drum_stems.keys())}")

    log("Detecting key...")
    key = detect_key(y, sr)
    log(f"Key: {key}")

    log("Loudness (LUFS)...")
    meter = pyln.Meter(sr)
    lufs = float(meter.integrated_loudness(y if y.ndim == 1 else y))

    log("Analyzing structure (sections/energy)...")
    sections, energy_points, bar_energy = analyze_structure(y, sr, bpm, first_downbeat_sec, total_bars)
    log(f"Sections: {[s['label'] for s in sections]}")

    log("Detecting chords per bar...")
    chords = detect_chords_per_bar(y, sr, bpm, first_downbeat_sec, total_bars, key)

    log("Detecting ear-candy candidates...")
    events = detect_ear_candy(y, sr, bpm, first_downbeat_sec, sections)

    # --- Notes per lane ---
    log("Transcribing notes: kick/clap/hats/perc (onset detection)...")
    lane_notes = {lid: [] for lid in LANE_ORDER}
    lane_notes["kick"] = onset_notes(drum_stems["kick"], bpm, first_downbeat_sec, 36)
    lane_notes["clap"] = onset_notes(drum_stems["snare"], bpm, first_downbeat_sec, 39)
    hats_notes = onset_notes(drum_stems["hh"], bpm, first_downbeat_sec, 42)
    ride_notes = onset_notes(drum_stems["ride"], bpm, first_downbeat_sec, 46)
    lane_notes["hats"] = sorted(hats_notes + ride_notes, key=lambda n: n["beat"])
    toms_notes = onset_notes(drum_stems["toms"], bpm, first_downbeat_sec, 45)
    crash_notes = onset_notes(drum_stems["crash"], bpm, first_downbeat_sec, 49)
    residual_notes = onset_notes(drum_stems["residual"], bpm, first_downbeat_sec, 51)
    lane_notes["perc"] = sorted(toms_notes + crash_notes + residual_notes, key=lambda n: n["beat"])

    log("Transcribing notes: bass (Basic Pitch, monophonic)...")
    lane_notes["bass"] = basic_pitch_notes(demucs_stems["bass"], bpm, first_downbeat_sec, monophonic=True)

    log("Transcribing notes: vocals (Basic Pitch)...")
    lane_notes["vocal"] = basic_pitch_notes(demucs_stems["vocals"], bpm, first_downbeat_sec)

    log("Transcribing notes: other -> chords/pad/lead (Basic Pitch)...")
    piano_notes = basic_pitch_notes(demucs_stems["piano"], bpm, first_downbeat_sec) if "piano" in demucs_stems else []
    other_notes = basic_pitch_notes(demucs_stems["other"], bpm, first_downbeat_sec)
    if len(piano_notes) > 20:
        log(f"Using clean piano stem for Chords ({len(piano_notes)} notes)")
        lane_notes["chords"] = piano_notes
        _, pad_notes, lead_notes = split_chords_pad_lead(other_notes)
        lane_notes["pad"] = pad_notes
        lane_notes["lead"] = lead_notes
    else:
        chords_notes, pad_notes, lead_notes = split_chords_pad_lead(other_notes)
        lane_notes["chords"] = chords_notes
        lane_notes["pad"] = pad_notes
        lane_notes["lead"] = lead_notes

    for lid, notes in lane_notes.items():
        log(f"  {lid}: {len(notes)} notes")

    # --- Assemble lanes with clips per section ---
    lanes = []
    for lane_id in LANE_ORDER:
        notes = sorted(lane_notes[lane_id], key=lambda n: n["beat"])
        clips = []
        for sec in sections:
            sec_notes = [n for n in notes if sec["startBar"] * 4 <= n["beat"] < sec["endBar"] * 4]
            if not sec_notes:
                continue
            avg_vel = sum(n["vel"] for n in sec_notes) / len(sec_notes)
            clips.append({
                "id": f"{lane_id}-{sec['id']}", "sectionId": sec["id"],
                "startBar": sec["startBar"], "endBar": sec["endBar"],
                "avgIntensity": round(min(avg_vel / 127.0, 1.0), 3),
                "notes": [{"beat": round(n["beat"], 3), "pitch": n["pitch"],
                           "durBeats": round(n["durBeats"], 3), "vel": round(n["vel"])} for n in sec_notes],
            })
        lanes.append({"id": lane_id, "name": LANE_NAMES[lane_id], "stemId": lane_id if lane_id != "ear-candy" else None,
                       "sharedWith": ["pad", "lead"] if lane_id == "chords" else (["chords", "lead"] if lane_id == "pad" else (["chords", "pad"] if lane_id == "lead" else [])),
                       "clips": clips})

    # --- Encode stems to FLAC ---
    log("Encoding stems to FLAC...")
    stem_files = {
        "kick": (drum_stems["kick"], True), "clap": (drum_stems["snare"], True),
        "hats": (drum_stems["hh"], False), "perc": (drum_stems["toms"], False),
        "bass": (demucs_stems["bass"], True), "chords": (demucs_stems.get("piano", demucs_stems["other"]), False),
        "pad": (demucs_stems["other"], False), "lead": (demucs_stems["other"], False),
        "vocal": (demucs_stems["vocals"], False),
    }
    stems_meta = []
    for lane_id, (src, mono) in stem_files.items():
        dst = out_dir / f"{lane_id}.flac"
        encode_flac(src, dst, mono=mono)
        stems_meta.append({"id": lane_id, "file": f"{lane_id}.flac", "channels": 1 if mono else 2})
    mix_dst = out_dir / "mix.flac"
    encode_flac(wav_path, mix_dst, mono=False)

    log("Computing waveform peaks...")
    peaks = waveform_peaks(y)

    analysis = {
        "song": {
            "id": args.id, "title": args.title, "artist": args.artist,
            "durationSec": round(duration_sec, 1), "bpm": bpm, "timeSignature": [4, 4],
            "firstDownbeatSec": round(first_downbeat_sec, 3), "bars": total_bars,
            "key": key, "lufsIntegrated": round(lufs, 1), "genre": args.genre,
        },
        "waveformPeaks": peaks,
        "sections": sections,
        "energy": energy_points,
        "chords": chords,
        "stems": stems_meta,
        "lanes": lanes,
        "events": events,
    }

    analysis_path = out_dir / "analysis.json"
    with open(analysis_path, "w") as f:
        json.dump(analysis, f, indent=2)
    log(f"Wrote {analysis_path}")

    # --- Report ---
    write_report(out_dir, bar_energy, sections, lanes, total_bars, y, demucs_stems)

    log("Done.")


def write_report(out_dir: Path, bar_energy, sections, lanes, total_bars, mix_y, demucs_stems):
    import matplotlib
    matplotlib.use("Agg")
    import matplotlib.pyplot as plt

    fig, ax = plt.subplots(figsize=(16, 6))
    ax.plot(bar_energy, color="#F5B84B")
    ax.fill_between(range(len(bar_energy)), bar_energy, alpha=0.2, color="#F5B84B")
    for sec in sections:
        ax.axvspan(sec["startBar"], sec["endBar"], alpha=0.08)
        ax.text((sec["startBar"] + sec["endBar"]) / 2, 102, sec["label"], ha="center", fontsize=8)
    ax.set_ylim(0, 110)
    ax.set_xlabel("Bar")
    ax.set_ylabel("Energy")
    ax.set_title("Where You Are — sections + energy (real analysis)")
    fig.tight_layout()
    fig.savefig(out_dir / "report.png", dpi=120)
    plt.close(fig)

    # Null test: mix vs sum of demucs stems (dB)
    try:
        stem_sum = None
        for name, p in demucs_stems.items():
            y, _sr = sf.read(p)
            if y.ndim == 1:
                y = y[:, None]
            stem_sum = y.astype(np.float64) if stem_sum is None else stem_sum[:min(len(stem_sum), len(y))] + y[:min(len(stem_sum), len(y))]
        n = min(len(stem_sum), len(mix_y)) if mix_y.ndim == 1 else min(len(stem_sum), mix_y.shape[0])
        mix_ref = mix_y[:n] if mix_y.ndim == 1 else mix_y[:n].mean(axis=1)
        diff = mix_ref - stem_sum[:n].mean(axis=1)
        null_db = 20 * np.log10(np.sqrt(np.mean(diff ** 2)) + 1e-12)
    except Exception as e:
        null_db = None
        log(f"Null test failed: {e}")

    note_counts = {lane["id"]: sum(len(c["notes"]) for c in lane["clips"]) for lane in lanes}
    report_txt = out_dir / "report.txt"
    with open(report_txt, "w") as f:
        f.write(f"Total bars: {total_bars}\n")
        f.write(f"Null test (mix vs sum of stems): {null_db:.1f} dB\n" if null_db is not None else "Null test: failed\n")
        f.write("Note counts per lane:\n")
        for lid, n in note_counts.items():
            f.write(f"  {lid}: {n}\n")
    log(f"Report written to {out_dir / 'report.png'} and {report_txt}")


if __name__ == "__main__":
    main()
