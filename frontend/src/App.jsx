import React from 'react';
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  addSong,
  addSongToPlaylist,
  clearHistory,
  clearQueue,
  createPlaylist,
  enqueueSong,
  getHistory,
  getQueue,
  listPlaylists,
  listSongs,
  nextInQueue,
  removeFromQueue,
  searchSongs,
  startPlayback,
  stopPlayback,
} from './api';

import Header from './components/Header';
import Alert from './components/Alert';
import SearchBar from './components/SearchBar';
import AddSongForm from './components/AddSongForm';
import SongList from './components/SongList';
import SidePanel from './components/SidePanel';
import Player from './components/Player';

export default function App() {
  const [songs, setSongs] = useState([]);
  const [playlists, setPlaylists] = useState([]);
  const [criterion, setCriterion] = useState('title');
  const [query, setQuery] = useState('');
  const [newPlaylist, setNewPlaylist] = useState('');
  const [selectedPlaylist, setSelectedPlaylist] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [currentSong, setCurrentSong] = useState(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const [queue, setQueue] = useState([]);
  const [history, setHistory] = useState([]);
  const [sideTab, setSideTab] = useState('queue');

  const audioRef = useRef(null);
  const nextAudioRef = useRef(null);

  useEffect(() => {
    loadInitialData();
  }, []);

  async function loadInitialData() {
    try {
      setLoading(true);
      setError('');
      setSuccess('');

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

  async function handleAddSong(songData) {
    try {
      setError('');
      setSuccess('');

      await addSong(songData);
      const updatedSongs = await listSongs();

      setSongs(updatedSongs);
      setSuccess('Canción agregada correctamente.');
    } catch (err) {
      setError(`No se pudo agregar la canción: ${err.message}`);
    }
  }

  async function handleSearch() {
    try {
      setError('');
      setSuccess('');

      const results = query.trim()
        ? await searchSongs(criterion, query)
        : await listSongs();

      setSongs(results);
    } catch (err) {
      setError(`Error al buscar: ${err.message}`);
    }
  }

  async function handlePlay(song) {
    try {
      setError('');
      setSuccess('');

      if (currentSong && currentSong.id !== song.id) {
        await stopPlayback(currentSong.id).catch(() => null);
      }

      await startPlayback(song.id);
      setCurrentSong(song);
      setIsPlaying(true);

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
      setSuccess('');

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

  async function handleSongEnded() {
    if (currentSong) {
      await stopPlayback(currentSong.id).catch(() => null);
    }

    const next = await nextInQueue();
    await refreshQueueAndHistory();

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

  async function refreshQueueAndHistory() {
    const [queueData, historyData] = await Promise.all([
      getQueue(),
      getHistory(),
    ]);

    setQueue(queueData.queue ?? []);
    setHistory(historyData);
  }

  async function handleEnqueue(song) {
    try {
      setError('');
      setSuccess('');

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
      setSuccess('');

      const result = await removeFromQueue(songId);
      setQueue(result.queue ?? []);
    } catch (err) {
      setError(`Error al quitar de la cola: ${err.message}`);
    }
  }

  async function handleClearQueue() {
    try {
      setError('');
      setSuccess('');

      await clearQueue();
      setQueue([]);
    } catch (err) {
      setError(`Error al vaciar la cola: ${err.message}`);
    }
  }

  async function handleNext() {
    if (currentSong) {
      await stopPlayback(currentSong.id).catch(() => null);
    }

    const next = await nextInQueue();
    await refreshQueueAndHistory();

    if (next) {
      await handlePlay(next);
    } else {
      setCurrentSong(null);
      setIsPlaying(false);
      setError('La cola está vacía.');
    }
  }

  async function handleClearHistory() {
    try {
      setError('');
      setSuccess('');

      await clearHistory();
      setHistory([]);
    } catch (err) {
      setError(`Error al limpiar historial: ${err.message}`);
    }
  }

  async function handleCreatePlaylist(e) {
    e.preventDefault();

    if (!newPlaylist.trim()) return;

    try {
      setError('');
      setSuccess('');

      const playlist = await createPlaylist(newPlaylist.trim());
      const updated = await listPlaylists();

      setPlaylists(updated);
      setSelectedPlaylist(playlist.id);
      setNewPlaylist('');
      setSuccess('Playlist creada correctamente.');
    } catch (err) {
      setError(`No se pudo crear la playlist: ${err.message}`);
    }
  }

  async function handleAddToPlaylist(songId) {
    if (!selectedPlaylist) {
      setError('Selecciona una playlist primero.');
      return;
    }

    try {
      setError('');
      setSuccess('');

      await addSongToPlaylist(selectedPlaylist, songId);
      const updated = await listPlaylists();

      setPlaylists(updated);
      setSuccess('Canción agregada a la playlist.');
    } catch (err) {
      setError(`No se pudo agregar a la playlist: ${err.message}`);
    }
  }

  const selectedPlaylistData = useMemo(
    () => playlists.find((playlist) => playlist.id === selectedPlaylist),
    [playlists, selectedPlaylist],
  );

  const nextSong = queue[0] ?? null;

  return (
    <div className="app-shell">
      <Header />

      <Alert type="error">{error}</Alert>
      <Alert type="success">{success}</Alert>
      {loading && <Alert type="info">Cargando datos del backend...</Alert>}

      <main className="grid">
        <section className="card main-card">
          <div className="section-header">
            <div>
              <p className="eyebrow">Biblioteca</p>
              <h2>Canciones</h2>
            </div>
            <span className="counter">{songs.length} canciones</span>
          </div>

          <SearchBar
            criterion={criterion}
            query={query}
            onCriterionChange={setCriterion}
            onQueryChange={setQuery}
            onSearch={handleSearch}
            onReload={loadInitialData}
          />

          <AddSongForm onAddSong={handleAddSong} />

          <SongList
            songs={songs}
            currentSong={currentSong}
            onPlay={handlePlay}
            onEnqueue={handleEnqueue}
            onAddToPlaylist={handleAddToPlaylist}
          />
        </section>

        <SidePanel
          sideTab={sideTab}
          setSideTab={setSideTab}
          queue={queue}
          history={history}
          playlists={playlists}
          selectedPlaylist={selectedPlaylist}
          selectedPlaylistData={selectedPlaylistData}
          newPlaylist={newPlaylist}
          setNewPlaylist={setNewPlaylist}
          setSelectedPlaylist={setSelectedPlaylist}
          onCreatePlaylist={handleCreatePlaylist}
          onPlay={handlePlay}
          onEnqueue={handleEnqueue}
          onRemoveFromQueue={handleRemoveFromQueue}
          onClearQueue={handleClearQueue}
          onClearHistory={handleClearHistory}
        />
      </main>

      <Player
        audioRef={audioRef}
        nextAudioRef={nextAudioRef}
        currentSong={currentSong}
        nextSong={nextSong}
        isPlaying={isPlaying}
        queueLength={queue.length}
        onPause={handlePause}
        onResume={handleResume}
        onNext={handleNext}
        onEnded={handleSongEnded}
        setIsPlaying={setIsPlaying}
      />
    </div>
  );
}