import { useState } from 'react';
import './Landing.css';

interface SongCard {
  title: string;
  artist: string;
  duration: string;
  id: string;
}

interface LandingProps {
  onCardDrop: () => void;
  onFileDrop: (file: File) => void;
  mismatchMessage: string | null;
  onRetryDemo: () => void;
}

export function Landing({ onCardDrop, onFileDrop, mismatchMessage, onRetryDemo }: LandingProps) {
  const [isDragging, setIsDragging] = useState(false);

  const demoSong: SongCard = {
    id: 'where-you-are',
    title: 'Where You Are (Extended Mix)',
    artist: 'John Summit & HAYLA',
    duration: '5:10',
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      // A real file dragged from Finder.
      onFileDrop(e.dataTransfer.files[0]);
    } else {
      // The demo card, dragged internally.
      onCardDrop();
    }
  };

  return (
    <div className="landing">
      <div className="landing-container">
        <div
          className={`drop-zone ${isDragging ? 'dragging' : ''}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <div className="drop-content">
            <h1 className="product-name">melodee</h1>
            <p className="drop-instruction">Drop a song to analyze</p>
          </div>
        </div>

        <div className="song-card-container">
          <div
            className="song-card"
            draggable
            onDragStart={(e) => {
              e.dataTransfer?.setData('application/json', JSON.stringify(demoSong));
            }}
            onDragEnd={() => setIsDragging(false)}
          >
            <div className="song-card-header">
              <div className="song-info">
                <h2 className="song-title">{demoSong.title}</h2>
                <p className="song-artist">{demoSong.artist}</p>
              </div>
              <div className="song-duration">{demoSong.duration}</div>
            </div>
            <p className="drag-hint">Drag to drop zone, or drop the real mp3 →</p>
          </div>
        </div>

        {mismatchMessage && (
          <div className="mismatch-banner">
            <span>{mismatchMessage}</span>
            <button className="mismatch-retry" onClick={onRetryDemo}>
              Load {demoSong.title}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
