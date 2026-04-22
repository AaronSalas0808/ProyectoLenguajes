import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addSongToPlaylist,
  createPlaylist,
  getAudioUrl,
  listPlaylists,
  listSongs,
  searchSongs,
  startPlayback,
  stopPlayback,
} from './api';

const criteria = [
  { value: 'title', label: 'Título' },
  { value: 'artist', label: 'Artista' },
  { value: 'genre', label: 'Género' },
];

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = String(seconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

export default function App() {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [criterion, setCriterion] = useState('title');
  const [query, setQuery] = useState('');
  const [newPlaylist, setNewPlaylist] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [currentSong, setCurrentSong] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const audioRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError('');
      const [songData, playlistData] = await Promise.all([listSongs(), listPlaylists()]);
      setSongs(songData);
      setPlaylists(playlistData);
      if (playlistData[0]) {
        setSelectedPlaylist(playlistData[0].id);
      }
    } catch (err) {
      console.error(err);
      setError(`No se pudo cargar la información del backend: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function handleSearch() {
    try {
      setError('');
      const results = query.trim() ? await searchSongs(criterion, query) : await listSongs();
      setSongs(results);
    } catch (err) {
      console.error(err);
      setError(`Ocurrió un error al buscar canciones: ${err.message}`);
    }
  }

  async function handleCreatePlaylist(e) {
    e.preventDefault();
    if (!newPlaylist.trim()) return;

    try {
      setError('');
      const playlist = await createPlaylist(newPlaylist.trim());
      const updated = await listPlaylists();
      setPlaylists(updated);
      setSelectedPlaylist(playlist.id);
      setNewPlaylist('');
    } catch (err) {
      console.error(err);
      setError(`No se pudo crear la playlist: ${err.message}`);
    }
  }

  async function handleAddToPlaylist(songId) {
    if (!selectedPlaylist) {
      setError('Primero seleccioná una playlist.');
      return;
    }

    try {
      setError('');
      await addSongToPlaylist(selectedPlaylist, songId);
      const updated = await listPlaylists();
      setPlaylists(updated);
    } catch (err) {
      console.error(err);
      setError(`No se pudo agregar la canción a la playlist: ${err.message}`);
    }
  }

  async function handlePlay(song) {
    try {
      setError('');
      if (currentSong && currentSong.id !== song.id) {
        await stopPlayback(currentSong.id).catch(() => null);
      }
      await startPlayback(song.id);
      setCurrentSong(song);
      setTimeout(() => audioRef.current?.play()?.catch(() => null), 0);
    } catch (err) {
      console.error(err);
      setError(`No se pudo iniciar la reproducción: ${err.message}`);
    }
  }

  async function handlePause() {
    if (!currentSong) return;
    try {
      setError('');
      await stopPlayback(currentSong.id);
      audioRef.current?.pause();
    } catch (err) {
      console.error(err);
      setError(`No se pudo detener la reproducción: ${err.message}`);
    }
  }

  const selectedPlaylistData = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylist),
    [playlists, selectedPlaylist]
  );

  return (
    <div className="app-shell">
      <header className="hero">
        <div>
          <h1>SpotiCry</h1>
          <p>Cliente React conectado al backend real en Rust.</p>
        </div>
        <div className="note">
          Backend HTTP: 127.0.0.1:3000 · Backend TCP: 127.0.0.1:7878
        </div>
      </header>

      {error ? <div className="alert">{error}</div> : null}
      {loading ? <div className="alert">Cargando datos del backend...</div> : null}

      <main className="grid">
        <section className="card">
          <h2>Buscar canciones</h2>
          <div className="search-row">
            <select value={criterion} onChange={(e) => setCriterion(e.target.value)}>
              {criteria.map((item) => (
                <option key={item.value} value={item.value}>
                  {item.label}
                </option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Escriba para buscar"
            />
            <button onClick={handleSearch}>Buscar</button>
            <button className="secondary" onClick={loadInitialData}>Reiniciar</button>
          </div>

          <div className="song-list">
            {songs.map((song) => (
              <article className="song-item" key={song.id}>
                <div>
                  <strong>{song.title}</strong>
                  <span>{song.artist} · {song.genre}</span>
                  <small>{song.file_path}</small>
                </div>
                <div className="song-actions">
                  <span>{formatDuration(song.duration_seconds)}</span>
                  <button className="secondary" onClick={() => handlePlay(song)}>
                    Reproducir
                  </button>
                  <button onClick={() => handleAddToPlaylist(song.id)}>
                    Agregar
                  </button>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="card">
          <h2>Playlists</h2>
          <form className="playlist-form" onSubmit={handleCreatePlaylist}>
            <input
              value={newPlaylist}
              onChange={(e) => setNewPlaylist(e.target.value)}
              placeholder="Nueva playlist"
            />
            <button type="submit">Crear</button>
          </form>

          <select
            className="playlist-select"
            value={selectedPlaylist}
            onChange={(e) => setSelectedPlaylist(e.target.value)}
          >
            <option value="">Seleccione una playlist</option>
            {playlists.map((playlist) => (
              <option key={playlist.id} value={playlist.id}>
                {playlist.name}
              </option>
            ))}
          </select>

          <div className="playlist-box">
            <h3>{selectedPlaylistData?.name || 'Sin playlist seleccionada'}</h3>
            {selectedPlaylistData?.songs?.length ? (
              <ul>
                {selectedPlaylistData.songs.map((song) => (
                  <li key={song.id}>{song.title} — {song.artist}</li>
                ))}
              </ul>
            ) : (
              <p>No hay canciones todavía.</p>
            )}
          </div>
        </section>
      </main>

      <footer className="player">
        <div>
          <strong>Reproduciendo:</strong>{' '}
          {currentSong ? `${currentSong.title} — ${currentSong.artist}` : 'Nada por ahora'}
        </div>
        <div className="player-controls">
          <button className="secondary" type="button" onClick={() => { if (audioRef.current) audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10); }}>
            ⏪ 10s
          </button>
          <button type="button" onClick={() => currentSong ? handlePause() : null}>
            {currentSong ? '⏸ Pausar' : '▶ Sin canción'}
          </button>
          <button className="secondary" type="button" onClick={() => { if (audioRef.current) audioRef.current.currentTime += 10; }}>
            ⏩ 10s
          </button>
        </div>
        <audio
          ref={audioRef}
          controls
          src={currentSong ? getAudioUrl(currentSong) : ''}
          onEnded={() => {
            if (currentSong) {
              stopPlayback(currentSong.id).catch(() => null);
            }
            setCurrentSong(null);
          }}
          style={{ width: '100%', marginTop: '12px' }}
        />
      </footer>
    </div>
  );
}
