import React from 'react';
import { formatDuration } from '../utils/formatDuration';

export default function SongList({
  songs,
  currentSong,
  onPlay,
  onEnqueue,
  onAddToPlaylist,
}) {
  if (!songs.length) {
    return <p className="empty-msg">No hay canciones disponibles.</p>;
  }

  return (
    <div className="song-list">
      {songs.map((song) => {
        const isActive = currentSong?.id === song.id;

        return (
          <article
            className={`song-item ${isActive ? 'song-item--active' : ''}`}
            key={song.id}
          >
            <div className="song-main">
              <div className="cover">
                {isActive ? '▶' : '♪'}
              </div>

              <div className="song-info">
                <strong>{song.title}</strong>
                <span>{song.artist} · {song.genre}</span>
              </div>
            </div>

            <div className="song-actions">
              <span className="duration">{formatDuration(song.duration_seconds)}</span>
              <button className="secondary" onClick={() => onPlay(song)}>▶ Play</button>
              <button onClick={() => onEnqueue(song)}>+ Cola</button>
              <button className="secondary" onClick={() => onAddToPlaylist(song.id)}>+ Lista</button>
            </div>
          </article>
        );
      })}
    </div>
  );
}