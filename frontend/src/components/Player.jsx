import React from 'react';
import { getStreamUrl } from '../api';

export default function Player({
  audioRef,
  nextAudioRef,
  currentSong,
  nextSong,
  isPlaying,
  queueLength,
  onPause,
  onResume,
  onNext,
  onEnded,
  setIsPlaying,
}) {
  return (
    <footer className="player">
      <div className="player-left">
        <div className="now-cover">
          {currentSong ? '▶' : '♪'}
        </div>

        <div className="player-info">
          <span>Reproduciendo</span>
          <strong>
            {currentSong
              ? `${currentSong.title} — ${currentSong.artist}`
              : 'Nada por ahora'}
          </strong>

          {nextSong && (
            <small>Siguiente: {nextSong.title}</small>
          )}
        </div>
      </div>

      <div className="player-controls">
        <button
          className="secondary"
          onClick={() => {
            if (audioRef.current) {
              audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
            }
          }}
        >
          ⏪ 10s
        </button>

        {isPlaying ? (
          <button onClick={onPause}>⏸ Pausar</button>
        ) : (
          <button onClick={onResume} disabled={!currentSong}>▶ Reanudar</button>
        )}

        <button
          className="secondary"
          onClick={() => {
            if (audioRef.current) audioRef.current.currentTime += 10;
          }}
        >
          10s ⏩
        </button>

        <button onClick={onNext} disabled={queueLength === 0}>
          ⏭ Siguiente
        </button>
      </div>

      <audio
        ref={audioRef}
        controls
        src={currentSong ? getStreamUrl(currentSong) : ''}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={onEnded}
        className="audio-control"
      />

      <audio
        ref={nextAudioRef}
        preload="auto"
        src={nextSong ? getStreamUrl(nextSong) : ''}
        style={{ display: 'none' }}
      />
    </footer>
  );
}