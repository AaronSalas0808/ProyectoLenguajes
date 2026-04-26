import React from 'react';
export default function Header() {
  return (
    <header className="hero">
      <div>
        <p className="eyebrow">Music Streaming App</p>
        <h1>SpotiCry</h1>
        <p>Streaming local · Cola inteligente · Historial · Playlists</p>
      </div>

      <div className="status-card">
        <span className="status-dot"></span>
        Backend HTTP: 127.0.0.1:3000
        <br />
        TCP: 127.0.0.1:7878
      </div>
    </header>
  );
}