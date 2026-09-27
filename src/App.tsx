import { useState } from 'react';
import { useAppStore } from './store/app';
import { audioEngine } from './audio/engine';
import { Landing } from './components/Landing';
import { Workspace } from './components/Workspace';
import './styles/globals.css';

export const SONG_ID = 'where-you-are';

function App() {
  const [hasDropped, setHasDropped] = useState(false);
  const [mismatchMessage, setMismatchMessage] = useState<string | null>(null);
  const setAnalysis = useAppStore((state) => state.setAnalysis);
  const reset = useAppStore((state) => state.reset);

  const loadSong = () => {
    setMismatchMessage(null);
    fetch(`/songs/${SONG_ID}/analysis.json`)
      .then((res) => res.json())
      .then(async (data) => {
        setAnalysis(data);
        await audioEngine.load(data, SONG_ID);
        setHasDropped(true);
      })
      .catch((err) => console.error('Failed to load analysis:', err));
  };

  // Card drag from the landing page always matches (it *is* the baked demo song).
  const handleCardDrop = () => loadSong();

  // A real file dropped from Finder: match by filename or, failing that,
  // decoded duration (±1s), against the one baked song.
  const handleFileDrop = async (file: File) => {
    setMismatchMessage(null);
    let analysis: { song: { title: string; artist: string; durationSec: number } };
    try {
      const res = await fetch(`/songs/${SONG_ID}/analysis.json`);
      analysis = await res.json();
    } catch {
      setMismatchMessage('This demo build has no analysis loaded.');
      return;
    }

    const nameMatch = /where\s*you\s*are/i.test(file.name) && /summit/i.test(file.name);
    let durationMatch = false;
    try {
      const duration = await decodeAudioDuration(file);
      durationMatch = Math.abs(duration - analysis.song.durationSec) <= 1;
    } catch {
      // Duration probe failed (unsupported format etc.) — filename match alone still counts.
    }

    if (nameMatch || durationMatch) {
      loadSong();
    } else {
      setMismatchMessage(`This demo build has analysis for "${analysis.song.title}" only.`);
    }
  };

  const handleReset = () => {
    audioEngine.disposeAll();
    reset();
    setHasDropped(false);
    setMismatchMessage(null);
  };

  return (
    <div className="app">
      {!hasDropped ? (
        <Landing onCardDrop={handleCardDrop} onFileDrop={handleFileDrop} mismatchMessage={mismatchMessage} onRetryDemo={loadSong} />
      ) : (
        <Workspace onReset={handleReset} />
      )}
    </div>
  );
}

function decodeAudioDuration(file: File): Promise<number> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const audio = new Audio();
    audio.preload = 'metadata';
    audio.onloadedmetadata = () => {
      URL.revokeObjectURL(url);
      resolve(audio.duration);
    };
    audio.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Could not decode audio metadata'));
    };
    audio.src = url;
  });
}

export default App;
