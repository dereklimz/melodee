#!/usr/bin/env python3
"""Extract a real peaks array from the analysis waveform.png so we can
render the waveform in Melodee's own styling instead of embedding the raw
(mismatched-color) source image."""
import json
from PIL import Image

SRC = "/Users/dekz/Downloads/files/waveform.png"
OUT = "/Users/dekz/Desktop/melodee/public/songs/where-you-are/waveform-peaks.json"
N_POINTS = 1600

def main():
    img = Image.open(SRC).convert("L")  # grayscale
    w, h = img.size
    px = img.load()

    # Background is near-black; the waveform is the brighter region.
    # For each of N_POINTS sample columns, find the vertical extent of
    # "lit" pixels and use that as the amplitude for that point.
    threshold = 18  # grayscale value above which a pixel counts as "waveform"
    peaks = []
    for i in range(N_POINTS):
        x = int(i / N_POINTS * w)
        x = min(x, w - 1)
        top = None
        bottom = None
        for y in range(h):
            if px[x, y] > threshold:
                if top is None:
                    top = y
                bottom = y
        if top is None:
            peaks.append(0.0)
        else:
            extent = (bottom - top) / h
            peaks.append(round(min(extent, 1.0), 4))

    # Normalize so the loudest point hits 1.0 (source image has margins).
    m = max(peaks) or 1.0
    peaks = [round(p / m, 4) for p in peaks]

    with open(OUT, "w") as f:
        json.dump(peaks, f)
    print(f"Wrote {OUT}: {len(peaks)} points, max={max(peaks)}, mean={sum(peaks)/len(peaks):.3f}")

if __name__ == "__main__":
    main()
