#!/usr/bin/env python3
"""Convert the real Ableton remake project into Melodee's analysis.json schema.

Source: the user's own "Where You Are" Ableton remake (.als, gzipped XML).
This supersedes the earlier spectral-analysis pipeline output — real MIDI
notes (pitch, duration, velocity, loop-tiled to their arrangement position)
beat sections/energy inferred from real note density instead of heuristics
on the commercial mixdown.
"""
import gzip
import json
import math
import random
import xml.etree.ElementTree as ET
from PIL import Image

ALS_PATH = "/tmp/ableton-remake/Project/John Summit feat. Hayla - Where You Are.als"
WAVEFORM_SRC = "/Users/dekz/Downloads/files/waveform.png"
OUT_DIR = "/Users/dekz/Desktop/melodee/public/songs/where-you-are"
OUT = f"{OUT_DIR}/analysis.json"
N_PEAK_POINTS = 1600


def extract_waveform_peaks(image_path, n_points=N_PEAK_POINTS):
    """Real peak amplitude per x-column from the source waveform image, so
    the app can render the waveform in its own styling rather than embed
    the source PNG's mismatched colors."""
    img = Image.open(image_path).convert("L")
    w, h = img.size
    px = img.load()
    threshold = 18
    peaks = []
    for i in range(n_points):
        x = min(int(i / n_points * w), w - 1)
        top = bottom = None
        for y in range(h):
            if px[x, y] > threshold:
                if top is None:
                    top = y
                bottom = y
        peaks.append(0.0 if top is None else round((bottom - top) / h, 4))
    m = max(peaks) or 1.0
    return [round(p / m, 4) for p in peaks]

random.seed(7)

# Real MIDI tracks -> lane id. Tracks not listed are either audio-only
# doubles of a MIDI lane (skipped as redundant) or handled specially below
# (Acapella -> synthetic vocal notes, Crash/Sub down -> ear-candy event ticks).
TRACK_TO_LANE = {
    "kick": "kick",
    "clap": "clap",
    "hat1": "hats", "hat2": "hats", "hat3": "hats",
    "hat4": "hats", "hat5": "hats", "hat6": "hats",
    "Snare build": "perc",
    "Bass1": "bass", "Bass2": "bass",
    "Piano": "chords",
    "Pad1": "pad", "Pad2": "pad", "Pad3": "pad",
    "15-pluck1": "lead", "Arp1": "lead", "Arp2": "lead",
    "Lead1": "lead", "Lead2": "lead", "Lead3": "lead",
    "zap": "ear-candy", "fx1": "ear-candy",
    "Noise 1": "ear-candy", "Noise 2": "ear-candy",
}
AUDIO_EVENT_TRACKS = {"Crash": "ear-candy", "Sub down": "ear-candy"}
VOCAL_AUDIO_TRACK = "Acapella"

LANE_NAMES = {
    "kick": "Kick", "clap": "Clap", "hats": "Hats", "perc": "Perc",
    "bass": "Bass", "chords": "Chords", "pad": "Pad", "lead": "Lead",
    "vocal": "Vocal", "ear-candy": "Ear Candy",
}
LANE_ORDER = ["kick", "clap", "hats", "perc", "bass", "chords", "pad", "lead", "vocal", "ear-candy"]
DRUM_LANES = {"kick", "clap", "hats", "perc"}


def clip_notes(clip_el):
    """Extract (beat, pitch, duration, velocity) tuples in absolute beats,
    respecting Ableton's loop-tiling / partial-window semantics."""
    current_start = float(clip_el.find("CurrentStart").get("Value"))
    current_end = float(clip_el.find("CurrentEnd").get("Value"))
    loop_el = clip_el.find("Loop")
    loop_start = float(loop_el.find("LoopStart").get("Value"))
    loop_end = float(loop_el.find("LoopEnd").get("Value"))
    loop_on = loop_el.find("LoopOn").get("Value") == "true"
    loop_len = loop_end - loop_start
    clip_len = current_end - current_start

    base_notes = []
    for kt in clip_el.findall(".//Notes/KeyTracks/KeyTrack"):
        pitch = int(kt.find("MidiKey").get("Value"))
        for ev in kt.findall(".//MidiNoteEvent"):
            base_notes.append((float(ev.get("Time")), pitch, float(ev.get("Duration")), float(ev.get("Velocity"))))

    out = []
    if not base_notes:
        return out

    if loop_on and loop_len > 0 and clip_len > loop_len + 0.01:
        n_reps = math.ceil(clip_len / loop_len)
        for k in range(n_reps):
            offset = k * loop_len
            for t, pitch, dur, vel in base_notes:
                abs_beat = current_start + offset + (t - loop_start)
                if current_start <= abs_beat < current_end:
                    out.append((abs_beat, pitch, min(dur, current_end - abs_beat), vel))
    else:
        for t, pitch, dur, vel in base_notes:
            abs_beat = current_start + (t - loop_start)
            if current_start <= abs_beat < current_end:
                out.append((abs_beat, pitch, min(dur, current_end - abs_beat), vel))
    return out


def audio_clip_ranges(track_el):
    ranges = []
    for c in track_el.findall(".//AudioClip"):
        cs = c.find("CurrentStart")
        ce = c.find("CurrentEnd")
        if cs is not None and ce is not None:
            ranges.append((float(cs.get("Value")), float(ce.get("Value"))))
    return ranges


def find_track(tracks, name):
    for t in tracks:
        name_el = t.find(".//Name/EffectiveName")
        if name_el is not None and name_el.get("Value") == name:
            return t
    return None


MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]


def synth_vocal_notes(ranges, midi_lo=55, midi_hi=74):
    """No real vocal MIDI exists (Acapella is audio-only) — synthesize a
    plausible pitch line inside the acapella clip's active time ranges."""
    notes = []
    root = midi_lo + (midi_hi - midi_lo) // 2
    current = root
    for start, end in ranges:
        beat = start
        while beat < end:
            dur = random.choice([0.5, 0.75, 1, 1.5, 2])
            dur = min(dur, end - beat)
            step = random.choice(MINOR_SCALE)
            direction = random.choice([-1, 1])
            current = max(midi_lo, min(midi_hi, current + direction * step))
            notes.append((beat, current, dur, 75 + random.random() * 20))
            beat += dur + random.choice([0, 0, 0.25])
    return notes


def main():
    with open(ALS_PATH, "rb") as f:
        xml_bytes = gzip.decompress(f.read())
    root = ET.fromstring(xml_bytes)
    liveset = root.find("LiveSet")
    tracks = liveset.find("Tracks")

    tempo_el = liveset.find(".//MasterTrack/DeviceChain/Mixer/Tempo/Manual")
    bpm = float(tempo_el.get("Value"))

    # Collect notes per lane from real MIDI tracks.
    lane_notes = {lid: [] for lid in LANE_ORDER}
    max_end = 0.0
    for track_name, lane_id in TRACK_TO_LANE.items():
        track_el = find_track(tracks, track_name)
        if track_el is None:
            print(f"WARNING: track not found: {track_name}")
            continue
        for clip_el in track_el.findall(".//MidiClip"):
            for beat, pitch, dur, vel in clip_notes(clip_el):
                lane_notes[lane_id].append({"beat": beat, "pitch": pitch, "durBeats": dur, "vel": vel})
                max_end = max(max_end, beat + dur)

    # Ear-candy one-shot audio layers (Crash, Sub down): represent as short
    # marker "notes" at each clip's onset so they render like real hits.
    for track_name, lane_id in AUDIO_EVENT_TRACKS.items():
        track_el = find_track(tracks, track_name)
        if track_el is None:
            continue
        for start, end in audio_clip_ranges(track_el):
            lane_notes[lane_id].append({"beat": start, "pitch": 72, "durBeats": min(1.0, end - start), "vel": 100})
            max_end = max(max_end, end)

    # Vocal: synthesize from the Acapella audio clip's active ranges.
    acapella = find_track(tracks, VOCAL_AUDIO_TRACK)
    vocal_ranges = audio_clip_ranges(acapella) if acapella is not None else []
    for beat, pitch, dur, vel in synth_vocal_notes(vocal_ranges):
        lane_notes["vocal"].append({"beat": beat, "pitch": pitch, "durBeats": dur, "vel": vel})
    for start, end in vocal_ranges:
        max_end = max(max_end, end)

    total_bars = math.ceil(max_end / 4)
    total_beats = total_bars * 4

    # --- Per-bar note density -> energy curve + section detection ---
    bar_activity = [0.0] * total_bars
    bar_lane_presence = [set() for _ in range(total_bars)]
    for lane_id, notes in lane_notes.items():
        for n in notes:
            bar = int(n["beat"] // 4)
            if 0 <= bar < total_bars:
                weight = (n["vel"] / 127.0)
                bar_activity[bar] += weight
                bar_lane_presence[bar].add(lane_id)

    max_activity = max(bar_activity) or 1.0
    raw_energy_by_bar = []
    for bar in range(total_bars):
        note_score = bar_activity[bar] / max_activity
        lane_score = len(bar_lane_presence[bar]) / len(LANE_ORDER)
        raw_energy_by_bar.append(round(100 * (0.65 * note_score + 0.35 * lane_score), 1))

    # Smooth with a small moving average so the curve doesn't look like noise.
    def smooth(vals, window=3):
        out = []
        for i in range(len(vals)):
            lo = max(0, i - window)
            hi = min(len(vals), i + window + 1)
            out.append(round(sum(vals[lo:hi]) / (hi - lo), 1))
        return out

    energy_by_bar = smooth(raw_energy_by_bar)

    # Build a fine-grained (beat-resolution) energy curve by interpolating
    # bar values, matching the schema's {beat, value} point list.
    energy = []
    for bar in range(total_bars):
        for sub in (0, 2):  # two points per bar (half-bar resolution)
            energy.append({"beat": bar * 4 + sub, "value": energy_by_bar[bar]})
    energy.append({"beat": total_beats, "value": energy_by_bar[-1]})

    # Section detection: 8-bar phrases, classified by mean energy, merged
    # when adjacent phrases share a level, typed by position + trend.
    def energy_level(e):
        if e < 35:
            return "low"
        if e < 65:
            return "medium"
        return "high"

    phrase_bars = 8
    n_phrases = math.ceil(total_bars / phrase_bars)
    phrase_energy = []
    for p in range(n_phrases):
        lo = p * phrase_bars
        hi = min(total_bars, lo + phrase_bars)
        phrase_energy.append(sum(energy_by_bar[lo:hi]) / (hi - lo))

    phrase_levels = [energy_level(e) for e in phrase_energy]

    # Merge consecutive same-level phrases into raw blocks.
    blocks = []  # (start_phrase, end_phrase_exclusive, level)
    i = 0
    while i < n_phrases:
        j = i + 1
        while j < n_phrases and phrase_levels[j] == phrase_levels[i]:
            j += 1
        blocks.append((i, j, phrase_levels[i]))
        i = j

    sections = []
    for idx, (p0, p1, level) in enumerate(blocks):
        start_bar = p0 * phrase_bars
        end_bar = min(total_bars, p1 * phrase_bars)
        if idx == 0:
            sec_type, label = "intro", "Intro"
        elif idx == len(blocks) - 1:
            sec_type, label = "outro", "Outro"
        elif level == "low":
            sec_type, label = "breakdown", "Breakdown"
        elif level == "high":
            sec_type, label = "drop", "Drop"
        else:  # medium
            next_level = blocks[idx + 1][2] if idx + 1 < len(blocks) else level
            if next_level == "high":
                sec_type, label = "build", "Build"
            else:
                sec_type, label = "breakdown", "Groove"
        sections.append({
            "id": f"s{idx+1}", "type": sec_type, "label": label,
            "startBar": start_bar, "endBar": end_bar,
            "energyLevel": level,
        })

    # De-duplicate repeated labels (Drop, Drop, Drop -> Drop 1, Drop 2, ...)
    label_counts = {}
    for s in sections:
        label_counts[s["label"]] = label_counts.get(s["label"], 0) + 1
    label_seen = {}
    for s in sections:
        base = s["label"]
        if label_counts[base] > 1:
            label_seen[base] = label_seen.get(base, 0) + 1
            s["label"] = f"{base} {label_seen[base]}"

    # --- Assemble lanes with clips (one clip per section where the lane has
    # activity) and their notes. ---
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
                "id": f"{lane_id}-{sec['id']}",
                "sectionId": sec["id"],
                "startBar": sec["startBar"],
                "endBar": sec["endBar"],
                "avgIntensity": round(min(avg_vel / 127.0, 1.0), 3),
                "notes": [
                    {"beat": round(n["beat"], 3), "pitch": n["pitch"],
                     "durBeats": round(n["durBeats"], 3), "vel": round(n["vel"])}
                    for n in sec_notes
                ],
            })
        lanes.append({
            "id": lane_id, "name": LANE_NAMES[lane_id], "stemId": lane_id,
            "sharedWith": [], "clips": clips,
        })

    analysis = {
        "song": {
            "id": "where-you-are",
            "title": "Where You Are (Extended Mix)",
            "artist": "John Summit & HAYLA",
            "durationSec": round(total_beats * (60.0 / bpm), 1),
            "bpm": bpm,
            "timeSignature": [4, 4],
            "firstDownbeatSec": 0.0,
            "bars": total_bars,
            "key": {"tonic": "G", "mode": "minor", "camelot": "6A"},
            "lufsIntegrated": -7.8,
            "genre": "House",
        },
        "waveformPeaks": extract_waveform_peaks(WAVEFORM_SRC),
        "sections": sections,
        "energy": energy,
        "chords": [],
        "stems": [
            {"id": lane["id"], "file": f"{lane['id']}.flac", "channels": 1 if lane["id"] in ("kick", "bass") else 2}
            for lane in lanes
        ],
        "lanes": lanes,
        "events": [],
    }

    import shutil
    shutil.copy(WAVEFORM_SRC, f"{OUT_DIR}/waveform.png")

    with open(OUT, "w") as f:
        json.dump(analysis, f, indent=2)

    print(f"Wrote {OUT}")
    print(f"BPM: {bpm}, total bars: {total_bars}, sections: {len(sections)}")
    for s in sections:
        print(f"  {s['label']:20s} ({s['type']:10s}) bars {s['startBar']:3d}-{s['endBar']:3d}  {s['energyLevel']}")
    print()
    for lane in lanes:
        n_notes = sum(len(c["notes"]) for c in lane["clips"])
        print(f"  {lane['name']:10s}: {len(lane['clips'])} clips, {n_notes} notes")


if __name__ == "__main__":
    main()
