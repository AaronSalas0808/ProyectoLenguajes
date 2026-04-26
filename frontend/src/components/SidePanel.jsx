import React from 'react';
import { formatDuration } from '../utils/formatDuration';

export default function SidePanel({
  sideTab,
  setSideTab,
  queue,
  history,
  playlists,
  selectedPlaylist,
  selectedPlaylistData,
  newPlaylist,
  setNewPlaylist,
  setSelectedPlaylist,
  onCreatePlaylist,
  onPlay,
  onEnqueue,
  onRemoveFromQueue,
  onClearQueue,
  onClearHistory,
}) {
  return (
    <section className="card side-card">
      <div className="tab-row">
        <button
          className={sideTab === 'queue' ? '' : 'secondary'}
          onClick={() => setSideTab('queue')}
        >
          Cola ({queue.length})
        </button>

        <button
          className={sideTab === 'history' ? '' : 'secondary'}
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

      {sideTab === 'queue' && (
        <>
          <div className="section-header">
            <h2>En cola</h2>
            {queue.length > 0 && (
              <button className="secondary small" onClick={onClearQueue}>
                Vaciar
              </button>
            )}
          </div>

          {queue.length === 0 ? (
            <p className="empty-msg">La cola está vacía. Agrega canciones con “+ Cola”.</p>
          ) : (
            <div className="mini-list">
              {queue.map((song, index) => (
                <article className="mini-song" key={song.id}>
                  <div>
                    <strong>#{index + 1} {song.title}</strong>
                    <span>{song.artist}</span>
                    {index === 0 && <small className="badge">Siguiente</small>}
                  </div>

                  <div className="mini-actions">
                    <span>{formatDuration(song.duration_seconds)}</span>
                    <button className="secondary small" onClick={() => onPlay(song)}>▶</button>
                    <button className="secondary small" onClick={() => onRemoveFromQueue(song.id)}>✕</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {sideTab === 'history' && (
        <>
          <div className="section-header">
            <h2>Historial</h2>
            {history.length > 0 && (
              <button className="secondary small" onClick={onClearHistory}>
                Limpiar
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <p className="empty-msg">Todavía no hay canciones en el historial.</p>
          ) : (
            <div className="mini-list">
              {history.map((song, index) => (
                <article className="mini-song" key={`${song.id}-${index}`}>
                  <div>
                    <strong>{song.title}</strong>
                    <span>{song.artist}</span>
                  </div>

                  <div className="mini-actions">
                    <button className="secondary small" onClick={() => onPlay(song)}>▶</button>
                    <button className="small" onClick={() => onEnqueue(song)}>+ Cola</button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </>
      )}

      {sideTab === 'playlist' && (
        <>
          <h2>Playlists</h2>

          <form className="playlist-form" onSubmit={onCreatePlaylist}>
            <input
              value={newPlaylist}
              onChange={(e) => setNewPlaylist(e.target.value)}
              placeholder="Nombre de la nueva playlist"
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
            <h3>{selectedPlaylistData?.name ?? 'Sin playlist seleccionada'}</h3>

            {selectedPlaylistData?.songs?.length ? (
              <div className="mini-list">
                {selectedPlaylistData.songs.map((song) => (
                  <article className="mini-song" key={song.id}>
                    <div>
                      <strong>{song.title}</strong>
                      <span>{song.artist}</span>
                    </div>

                    <div className="mini-actions">
                      <button className="secondary small" onClick={() => onPlay(song)}>▶</button>
                      <button className="small" onClick={() => onEnqueue(song)}>+ Cola</button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <p className="empty-msg">No hay canciones en esta playlist.</p>
            )}
          </div>
        </>
      )}
    </section>
  );
}