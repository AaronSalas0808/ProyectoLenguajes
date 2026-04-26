import React from 'react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  addSongToPlaylist,
  clearHistory,
  clearQueue,
  createPlaylist,
  enqueueSong,
  getHistory,
  getQueue,
  getStreamUrl,
  listPlaylists,
  listSongs,
  nextInQueue,
  removeFromQueue,
  searchSongs,
  startPlayback,
  stopPlayback,
} from './api';

// ── Constantes ────────────────────────────────────────────────────────────────

const CRITERIA = [
  { value: 'title',  label: 'Título'  },
  { value: 'artist', label: 'Artista' },
  { value: 'genre',  label: 'Género'  },
];

// ── Utilidades ────────────────────────────────────────────────────────────────

function formatDuration(seconds) {
  const min = Math.floor(seconds / 60);
  const sec = String(seconds % 60).padStart(2, '0');
  return `${min}:${sec}`;
}

// ── App ───────────────────────────────────────────────────────────────────────

export default function App() {
  // --- estado general ---
  const [songs,            setSongs]            = useState([]);
  const [playlists,        setPlaylists]        = useState([]);
  const [criterion,        setCriterion]        = useState('title');
  const [query,            setQuery]            = useState('');
  const [newPlaylist,      setNewPlaylist]      = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [loading,          setLoading]          = useState(true);
  const [error,            setError]            = useState('');

  // --- reproducción ---
  const [currentSong,  setCurrentSong]  = useState(null);  // canción en curso
  const [isPlaying,    setIsPlaying]    = useState(false);

  // --- cola e historial ---
  const [queue,   setQueue]   = useState([]);   // canciones en cola
  const [history, setHistory] = useState([]);   // canciones ya escuchadas

  // --- tab activa en panel lateral ---
  const [sideTab, setSideTab] = useState('queue'); // 'queue' | 'history' | 'playlist'

  // --- refs de audio ---
  const audioRef     = useRef(null);  // <audio> principal
  const nextAudioRef = useRef(null);  // <audio> oculto para pre-buffer

  // ── Carga inicial ───────────────────────────────────────────────────────────

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError('');
      const [songData, playlistData, queueData, historyData] = await Promise.all([
        listSongs(),
        listPlaylists(),
        getQueue(),
        getHistory(),
      ]);
      setSongs(songData);
      setPlaylists(playlistData);
      setQueue(queueData.queue ?? []);
      setHistory(historyData);
      if (playlistData[0]) setSelectedPlaylist(playlistData[0].id);
    } catch (err) {
      setError(`No se pudo cargar la información del backend: ${err.message}`);
    } finally {
      setLoading(false);
    }
  }

  // ── Búsqueda ────────────────────────────────────────────────────────────────

  async function handleSearch() {
    try {
      setError('');
      const results = query.trim()
        ? await searchSongs(criterion, query)
        : await listSongs();
      setSongs(results);
    } catch (err) {
      setError(`Error al buscar: ${err.message}`);
    }
  }

  // ── Reproducción ────────────────────────────────────────────────────────────

  /**
   * Empieza a reproducir una canción usando el endpoint de streaming.
   * El navegador pedirá los bytes por rangos conforme avanza el audio.
   */
  async function handlePlay(song) {
    try {
      setError('');

      // Detener la canción anterior en el servidor
      if (currentSong && currentSong.id !== song.id) {
        await stopPlayback(currentSong.id).catch(() => null);
      }

      await startPlayback(song.id);
      setCurrentSong(song);
      setIsPlaying(true);

      // Pequeño delay para que React actualice el src del <audio>
      setTimeout(() => {
        audioRef.current?.load();
        audioRef.current?.play().catch(() => null);
      }, 50);
    } catch (err) {
      setError(`No se pudo iniciar la reproducción: ${err.message}`);
    }
  }

  async function handlePause() {
    if (!currentSong) return;
    try {
      setError('');
      await stopPlayback(currentSong.id);
      audioRef.current?.pause();
      setIsPlaying(false);
    } catch (err) {
      setError(`No se pudo pausar: ${err.message}`);
    }
  }

  function handleResume() {
    audioRef.current?.play().catch(() => null);
    setIsPlaying(true);
  }

  /**
   * Cuando termina una canción, avanzamos automáticamente a la siguiente
   * de la cola. La canción siguiente ya estaba pre-bufferizada en el
   * <audio> oculto, así que el cambio es casi inmediato.
   */
  async function handleSongEnded() {
    if (currentSong) {
      await stopPlayback(currentSong.id).catch(() => null);
    }

    // Pedir la siguiente canción a la cola del servidor
    const next = await nextInQueue();
    const refreshedQueue = await getQueue();
    const refreshedHistory = await getHistory();
    setQueue(refreshedQueue.queue ?? []);
    setHistory(refreshedHistory);

    if (next) {
      setCurrentSong(next);
      setIsPlaying(true);
      setTimeout(() => {
        audioRef.current?.load();
        audioRef.current?.play().catch(() => null);
      }, 50);
    } else {
      setCurrentSong(null);
      setIsPlaying(false);
    }
  }

  // ── Cola de reproducción ────────────────────────────────────────────────────

  async function handleEnqueue(song) {
    try {
      setError('');
      const result = await enqueueSong(song.id);
      setQueue(result.queue ?? []);
      setSideTab('queue');
    } catch (err) {
      setError(`No se pudo agregar a la cola: ${err.message}`);
    }
  }

  async function handleRemoveFromQueue(songId) {
    try {
      setError('');
      const result = await removeFromQueue(songId);
      setQueue(result.queue ?? []);
    } catch (err) {
      setError(`Error al quitar de la cola: ${err.message}`);
    }
  }

  async function handleClearQueue() {
    try {
      setError('');
      await clearQueue();
      setQueue([]);
    } catch (err) {
      setError(`Error al vaciar la cola: ${err.message}`);
    }
  }

  /**
   * Avanza manualmente a la siguiente canción de la cola.
   */
  async function handleNext() {
    if (currentSong) {
      await stopPlayback(currentSong.id).catch(() => null);
    }
    const next = await nextInQueue();
    const refreshedQueue = await getQueue();
    const refreshedHistory = await getHistory();
    setQueue(refreshedQueue.queue ?? []);
    setHistory(refreshedHistory);

    if (next) {
      await handlePlay(next);
    } else {
      setCurrentSong(null);
      setIsPlaying(false);
      setError('La cola está vacía.');
    }
  }

  // ── Historial ───────────────────────────────────────────────────────────────

  async function handleClearHistory() {
    try {
      setError('');
      await clearHistory();
      setHistory([]);
    } catch (err) {
      setError(`Error al limpiar historial: ${err.message}`);
    }
  }

  // ── Playlists ───────────────────────────────────────────────────────────────

  async function handleCreatePlaylist(e) {
    e.preventDefault();
    if (!newPlaylist.trim()) return;
    try {
      setError('');
      const playlist = await createPlaylist(newPlaylist.trim());
      const updated  = await listPlaylists();
      setPlaylists(updated);
      setSelectedPlaylist(playlist.id);
      setNewPlaylist('');
    } catch (err) {
      setError(`No se pudo crear la playlist: ${err.message}`);
    }
  }

  async function handleAddToPlaylist(songId) {
    if (!selectedPlaylist) { setError('Seleccioná una playlist primero.'); return; }
    try {
      setError('');
      await addSongToPlaylist(selectedPlaylist, songId);
      const updated = await listPlaylists();
      setPlaylists(updated);
    } catch (err) {
      setError(`No se pudo agregar a la playlist: ${err.message}`);
    }
  }

  // ── Memos ───────────────────────────────────────────────────────────────────

  const selectedPlaylistData = useMemo(
    () => playlists.find((p) => p.id === selectedPlaylist),
    [playlists, selectedPlaylist],
  );

  // La siguiente canción en cola (para pre-buffer)
  const nextSong = queue[0] ?? null;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="app-shell">

      {/* ── Header ── */}
      <header className="hero">
        <div>
          <h1>SpotiCry</h1>
          <p>Streaming por chunks · Cola inteligente · Historial</p>
        </div>
        <div className="note">
          Backend HTTP: 127.0.0.1:3000 · TCP: 127.0.0.1:7878
        </div>
      </header>

      {/* ── Alertas ── */}
      {error   && <div className="alert">{error}</div>}
      {loading && <div className="alert">Cargando datos del backend...</div>}

      {/* ── Layout principal ── */}
      <main className="grid">

        {/* ── Panel izquierdo: canciones ── */}
        <section className="card">
          <h2>Canciones</h2>

          {/* Buscador */}
          <div className="search-row">
            <select value={criterion} onChange={(e) => setCriterion(e.target.value)}>
              {CRITERIA.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Buscar..."
            />
            <button onClick={handleSearch}>Buscar</button>
            <button className="secondary" onClick={loadInitialData}>↺</button>
          </div>

          {/* Lista de canciones */}
          <div className="song-list">
            {songs.map((song) => {
              const isActive = currentSong?.id === song.id;
              return (
                <article
                  className={`song-item${isActive ? ' song-item--active' : ''}`}
                  key={song.id}
                >
                  <div className="song-info">
                    <strong>{isActive ? '▶ ' : ''}{song.title}</strong>
                    <span>{song.artist} · {song.genre}</span>
                    <small>{song.file_path}</small>
                  </div>
                  <div className="song-actions">
                    <span>{formatDuration(song.duration_seconds)}</span>
                    <button className="secondary" onClick={() => handlePlay(song)}>
                      ▶ Play
                    </button>
                    <button onClick={() => handleEnqueue(song)}>
                      + Cola
                    </button>
                    <button className="secondary" onClick={() => handleAddToPlaylist(song.id)}>
                      + Lista
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        </section>

        {/* ── Panel derecho: cola / historial / playlist ── */}
        <section className="card">

          {/* Tabs */}
          <div className="tab-row">
            <button
              className={sideTab === 'queue'    ? '' : 'secondary'}
              onClick={() => setSideTab('queue')}
            >
              Cola ({queue.length})
            </button>
            <button
              className={sideTab === 'history'  ? '' : 'secondary'}
              onClick={() => setSideTab('history')}
            >
              Historial ({history.length})
            </button>
            <button
              className={sideTab === 'playlist' ? '' : 'secondary'}
              onClick={() => setSideTab('playlist')}
            >
              Playlists
            </button>
          </div>

          {/* ── Tab: Cola ── */}
          {sideTab === 'queue' && (
            <>
              <div className="section-header">
                <h2>En cola</h2>
                {queue.length > 0 && (
                  <button className="secondary small" onClick={handleClearQueue}>
                    Vaciar
                  </button>
                )}
              </div>

              {queue.length === 0 ? (
                <p className="empty-msg">La cola está vacía. Agregá canciones con "+ Cola".</p>
              ) : (
                <div className="song-list">
                  {queue.map((song, idx) => (
                    <article className="song-item" key={song.id}>
                      <div className="song-info">
                        <strong>#{idx + 1} {song.title}</strong>
                        <span>{song.artist} · {song.genre}</span>
                        {idx === 0 && (
                          <small className="badge">⏭ Siguiente — ya en buffer</small>
                        )}
                      </div>
                      <div className="song-actions">
                        <span>{formatDuration(song.duration_seconds)}</span>
                        <button className="secondary" onClick={() => handlePlay(song)}>
                          ▶
                        </button>
                        <button className="secondary" onClick={() => handleRemoveFromQueue(song.id)}>
                          ✕
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Historial ── */}
          {sideTab === 'history' && (
            <>
              <div className="section-header">
                <h2>Historial</h2>
                {history.length > 0 && (
                  <button className="secondary small" onClick={handleClearHistory}>
                    Limpiar
                  </button>
                )}
              </div>

              {history.length === 0 ? (
                <p className="empty-msg">Todavía no escuchaste ninguna canción desde la cola.</p>
              ) : (
                <div className="song-list">
                  {history.map((song, idx) => (
                    <article className="song-item" key={`${song.id}-${idx}`}>
                      <div className="song-info">
                        <strong>{song.title}</strong>
                        <span>{song.artist} · {song.genre}</span>
                      </div>
                      <div className="song-actions">
                        <span>{formatDuration(song.duration_seconds)}</span>
                        <button className="secondary" onClick={() => handlePlay(song)}>
                          ▶
                        </button>
                        <button onClick={() => handleEnqueue(song)}>
                          + Cola
                        </button>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── Tab: Playlists ── */}
          {sideTab === 'playlist' && (
            <>
              <h2>Playlists</h2>
              <form className="playlist-form" onSubmit={handleCreatePlaylist}>
                <input
                  value={newPlaylist}
                  onChange={(e) => setNewPlaylist(e.target.value)}
                  placeholder="Nombre nueva playlist"
                />
                <button type="submit">Crear</button>
              </form>

              <select
                className="playlist-select"
                value={selectedPlaylist}
                onChange={(e) => setSelectedPlaylist(e.target.value)}
              >
                <option value="">Seleccione una playlist</option>
                {playlists.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>

              <div className="playlist-box">
                <h3>{selectedPlaylistData?.name ?? 'Sin playlist seleccionada'}</h3>
                {selectedPlaylistData?.songs?.length ? (
                  <ul>
                    {selectedPlaylistData.songs.map((song) => (
                      <li key={song.id}>
                        {song.title} — {song.artist}
                        <button
                          className="secondary small"
                          style={{ marginLeft: 8 }}
                          onClick={() => handlePlay(song)}
                        >▶</button>
                        <button
                          className="secondary small"
                          style={{ marginLeft: 4 }}
                          onClick={() => handleEnqueue(song)}
                        >+ Cola</button>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p>No hay canciones en esta playlist.</p>
                )}
              </div>
            </>
          )}

        </section>
      </main>

      {/* ── Player ── */}
      <footer className="player">
        <div className="player-info">
          <strong>Reproduciendo:</strong>{' '}
          {currentSong
            ? `${currentSong.title} — ${currentSong.artist}`
            : 'Nada por ahora'}
          {nextSong && (
            <span className="next-label">
              &nbsp;· Siguiente en buffer: {nextSong.title}
            </span>
          )}
        </div>

        <div className="player-controls">
          <button
            className="secondary"
            onClick={() => {
              if (audioRef.current)
                audioRef.current.currentTime = Math.max(0, audioRef.current.currentTime - 10);
            }}
          >⏪ 10s</button>

          {isPlaying ? (
            <button onClick={handlePause}>⏸ Pausar</button>
          ) : (
            <button onClick={handleResume} disabled={!currentSong}>▶ Reanudar</button>
          )}

          <button
            className="secondary"
            onClick={() => {
              if (audioRef.current) audioRef.current.currentTime += 10;
            }}
          >⏩ 10s</button>

          <button onClick={handleNext} disabled={queue.length === 0}>
            ⏭ Siguiente
          </button>
        </div>

        {/*
          Audio principal — usa el endpoint /api/stream/:id
          El navegador enviará automáticamente headers Range: bytes=X-Y
          para pedir los chunks que necesita.
        */}
        <audio
          ref={audioRef}
          controls
          src={currentSong ? getStreamUrl(currentSong) : ''}
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onEnded={handleSongEnded}
          style={{ width: '100%', marginTop: 12 }}
        />

        {/*
          Audio oculto para pre-buffer de la SIGUIENTE canción.
          Mientras suena la canción actual, este elemento ya está
          descargando los primeros chunks de la siguiente, simulando
          el comportamiento de un servicio de streaming en la nube.
        */}
        <audio
          ref={nextAudioRef}
          preload="auto"
          src={nextSong ? getStreamUrl(nextSong) : ''}
          style={{ display: 'none' }}
        />
      </footer>
    </div>
  );
}