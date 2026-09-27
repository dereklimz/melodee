#!/usr/bin/env python3
"""Convert the raw 'Where You Are' analysis assets into Melodee's analysis.json schema."""
import json
import random

SRC = "/Users/dekz/Downloads/files/where_you_are_analysis.json"
OUT = "/Users/dekz/Desktop/melodee/public/songs/where-you-are/analysis.json"

random.seed(42)

# The source analysis has per-bar intensity (0-1) but no true note-level
# pitch tracking for most instruments (README says as much). To get a real
# piano-roll look we synthesize plausible notes from that intensity, seeded
# for determinism, using each lane's MIDI range. Drum lanes get onset ticks
# on a sensible grid; melodic lanes get a pitch walk within range.
DRUM_LANES = {"kick", "clap", "hats", "perc"}
MELODIC_RANGE = {
    "bass": (28, 45),
    "chords": (59, 77),
    "lead": (74, 86),
    "vocal": (55, 73),
}
MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10]


def clamp(x, lo, hi):
    return max(lo, min(hi, x))


def generate_drum_notes(lane_id, bar_intensity, bars_total):
    notes = []
    pitch = {"kick": 36, "clap": 39, "hats": 42, "perc": 43}[lane_id]
    for bar in range(bars_total):
        intensity = bar_intensity[bar]
        if intensity <= 0.05:
            continue
        beat0 = bar * 4
        if lane_id == "kick":
            for b in range(4):
                if intensity < 0.55 and random.random() < 0.2:
                    continue
                notes.append((beat0 + b, pitch, 0.5, intensity))
        elif lane_id == "clap":
            for b in (1, 3):
                notes.append((beat0 + b, pitch, 0.5, intensity))
        elif lane_id == "hats":
            for b in (0.5, 1.5, 2.5, 3.5):
                if intensity < 0.6 and random.random() < 0.3:
                    continue
                notes.append((beat0 + b, pitch, 0.25, intensity * 0.85))
        elif lane_id == "perc":
            for b in (0.75, 1.5, 2.25, 3.5):
                if random.random() < (1 - intensity) * 0.65:
                    continue
                notes.append((beat0 + b, pitch + random.choice([0, 2, 3, 5]), 0.25, intensity))
    return notes


def generate_melodic_notes(bar_intensity, bars_total, midi_lo, midi_hi):
    notes = []
    root = midi_lo + (midi_hi - midi_lo) // 3
    current_pitch = root
    for bar in range(bars_total):
        intensity = bar_intensity[bar]
        if intensity <= 0.05:
            continue
        beat0 = bar * 4
        if intensity < 0.4 or random.random() < 0.3:
            # sustained whole-bar note
            step = random.choice(MINOR_SCALE)
            pitch = clamp(root + step, midi_lo, midi_hi)
            notes.append((beat0, pitch, 4.0, intensity))
            current_pitch = pitch
        else:
            n_notes = 2 if intensity < 0.7 else random.choice([2, 3, 4])
            slots = sorted(random.sample([0, 1, 1.5, 2, 2.5, 3, 3.5], k=min(n_notes, 7)))
            for i, bp in enumerate(slots):
                step = random.choice(MINOR_SCALE)
                direction = random.choice([-1, 1])
                pitch = clamp(current_pitch + direction * step, midi_lo, midi_hi)
                dur = (slots[i + 1] - bp) if i + 1 < len(slots) else (4 - bp)
                notes.append((beat0 + bp, pitch, max(dur - 0.1, 0.25), intensity))
                current_pitch = pitch
    return notes


def bar_of_beat(beat):
    return int(beat // 4)

# Map source instruments to Melodee lane ids. Some source instruments split
# across two lanes conceptually (sub bass + bass synth -> bass), others map
# 1:1. Vocal hook is high-register pitched material in the drops, kept as
# its own "lead" lane per the README's own uncertainty note.
INSTRUMENT_TO_LANE = {
    "Kick": "kick",
    "Clap (2 & 4)": "clap",
    "Hi-hat (offbeat)": "hats",
    "Perc / top loop": "perc",
    "Sub bass": "bass",
    "Bass synth": "bass",
    "Chords / pads": "chords",
    "Vocal – verse (HAYLA)": "vocal",
    "Vocal hook / lead (drop)": "lead",
    "FX / riser / noise": "ear-candy",
}

LANE_NAMES = {
    "kick": "Kick",
    "clap": "Clap",
    "hats": "Hats",
    "perc": "Perc",
    "bass": "Bass",
    "chords": "Chords",
    "pad": "Pad",
    "lead": "Lead",
    "vocal": "Vocal",
    "ear-candy": "Ear Candy",
}

SECTION_KIND_MAP = {
    "intro": "intro",
    "breakdown": "breakdown",
    "groove": "drop",  # grooves in this track read as sustained high-energy = closest to "drop" visually
    "build": "build",
    "drop": "drop",
    "verse": "breakdown",
    "outro": "outro",
}


def energy_level(e):
    if e < 40:
        return "low"
    if e < 70:
        return "medium"
    return "high"


def bar_to_beat(bar):
    return (bar - 1) * 4


def main():
    with open(SRC) as f:
        src = json.load(f)

    bpm = src["bpm"]
    total_bars = src["total_bars"]

    # Source bars are 1-indexed inclusive (e.g. start_bar=1, end_bar=16 means
    # 16 bars). Our schema is 0-indexed with an exclusive endBar, so
    # startBar = start_bar - 1 and endBar = end_bar (unchanged) line up.
    sections = []
    for i, s in enumerate(src["sections"]):
        sid = f"s{i+1}"
        sections.append({
            "id": sid,
            "type": SECTION_KIND_MAP.get(s["kind"], "breakdown"),
            "label": s["name"],
            "startBar": s["start_bar"] - 1,
            "endBar": s["end_bar"],
            "energyLevel": energy_level(s["energy"]),
        })

    # Energy curve: use the smooth half-second curve, converted to beats.
    energy = []
    for pt in src["energy_curve_half_sec"]:
        beat = pt["t"] / (60.0 / bpm)
        energy.append({"beat": round(beat, 3), "value": round(pt["energy"], 1)})

    # Build per-lane clips from instrument segments, and merge lanes that
    # share a target (sub bass + bass synth both -> "bass").
    lanes_by_id = {}
    for inst in src["instruments"]:
        lane_id = INSTRUMENT_TO_LANE.get(inst["instrument"])
        if not lane_id:
            continue
        lane = lanes_by_id.setdefault(lane_id, {
            "id": lane_id,
            "name": LANE_NAMES[lane_id],
            "stemId": lane_id,
            "sharedWith": [],
            "clips": [],
            "sourceInstruments": [],
        })
        lane["sourceInstruments"].append(inst["instrument"])
        for j, seg in enumerate(inst["segments"]):
            clip_start = seg["start_bar"] - 1
            clip_end = seg["end_bar"]
            # find which section this segment starts in, for clip->section linkage
            section_id = None
            for sec in sections:
                if sec["startBar"] <= clip_start < sec["endBar"]:
                    section_id = sec["id"]
                    break
            lane["clips"].append({
                "id": f"{lane_id}-{inst['instrument'].replace(' ', '_').replace('/', '').replace('(', '').replace(')', '').replace('&', 'and')}-{j+1}",
                "sectionId": section_id or sections[0]["id"],
                "startBar": clip_start,
                "endBar": clip_end,
                "avgIntensity": seg["avg_intensity"],
                "sourceInstrument": inst["instrument"],
                "notes": [],
            })

    lanes = list(lanes_by_id.values())
    lane_order = ["kick", "clap", "hats", "perc", "bass", "chords", "pad", "lead", "vocal", "ear-candy"]
    lanes.sort(key=lambda l: lane_order.index(l["id"]) if l["id"] in lane_order else 99)

    # Per-bar intensity matrix per lane (for fine-grained opacity rendering),
    # summing/maxing across merged source instruments per bar.
    bar_matrix = {}
    with open("/Users/dekz/Downloads/files/instrument_matrix_by_bar.csv") as f:
        header = f.readline().strip().split(",")
        n_bars = len(header) - 1
        for line in f:
            parts = line.strip().split(",")
            inst_name = parts[0]
            vals = [float(v) if v else 0.0 for v in parts[1:]]
            bar_matrix[inst_name] = vals

    for lane in lanes:
        merged = [0.0] * n_bars
        for src_inst in lane["sourceInstruments"]:
            vals = bar_matrix.get(src_inst, [0.0] * n_bars)
            merged = [max(a, b) for a, b in zip(merged, vals)]
        lane["barIntensity"] = [round(v, 3) for v in merged]
        del lane["sourceInstruments"]

        # Synthesize notes (see generator docstring at top) and drop them
        # into whichever clip covers that bar.
        if lane["id"] in DRUM_LANES:
            raw_notes = generate_drum_notes(lane["id"], lane["barIntensity"], total_bars)
        elif lane["id"] in MELODIC_RANGE:
            lo, hi = MELODIC_RANGE[lane["id"]]
            raw_notes = generate_melodic_notes(lane["barIntensity"], total_bars, lo, hi)
        else:
            raw_notes = []

        for beat, pitch, dur, intensity in raw_notes:
            bar = bar_of_beat(beat)
            target_clip = None
            for clip in lane["clips"]:
                if clip["startBar"] <= bar < clip["endBar"]:
                    target_clip = clip
                    break
            if target_clip is None:
                continue
            target_clip["notes"].append({
                "beat": round(beat, 3),
                "pitch": pitch,
                "durBeats": round(dur, 3),
                "vel": round(intensity * 100),
            })

    analysis = {
        "song": {
            "id": "where-you-are",
            "title": "Where You Are (Extended Mix)",
            "artist": "John Summit & HAYLA",
            "durationSec": src["duration_sec"],
            "bpm": bpm,
            "timeSignature": [4, 4],
            "firstDownbeatSec": src["first_downbeat_sec"],
            "bars": total_bars,
            "key": {"tonic": "G", "mode": "minor", "camelot": "6A"},
            "lufsIntegrated": -7.8,
            "genre": "House",
        },
        "waveformImage": "waveform.png",
        "waveformPeaks": [],
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

    with open(OUT, "w") as f:
        json.dump(analysis, f, indent=2)

    print(f"Wrote {OUT}")
    print(f"Sections: {len(sections)}, Lanes: {len(lanes)}, Energy points: {len(energy)}")
    for lane in lanes:
        n_notes = sum(len(c["notes"]) for c in lane["clips"])
        print(f"  {lane['name']}: {len(lane['clips'])} clips, {n_notes} notes")


if __name__ == "__main__":
    main()
