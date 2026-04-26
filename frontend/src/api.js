const API_BASE = 'http://127.0.0.1:3000/api';

// ── Utilidades internas ───────────────────────────────────────────────────────

async function parseResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Ocurrió un error en el servidor');
  }
  return payload.data;
}

// ── URL de streaming ──────────────────────────────────────────────────────────
//
// En lugar de apuntar al archivo directamente, apuntamos al endpoint de
// streaming que sirve el audio en chunks (simula descarga desde la nube).
// El elemento <audio> del navegador pedirá automáticamente los rangos
// de bytes que necesite conforme avanza la reproducción.

export function getStreamUrl(songId) {
  return `${API_BASE}/stream/${songId}`;
}

// Mantener compatibilidad con código viejo si se necesita la ruta directa
export function getAudioUrl(song) {
  const parts = (song.file_path || '').split('/');
  const filename = parts[parts.length - 1];
  return filename
    ? `http://127.0.0.1:3000/audio/${encodeURIComponent(filename)}`
    : '';
}

// ── Canciones ─────────────────────────────────────────────────────────────────

export async function listSongs() {
  const response = await fetch(`${API_BASE}/songs`);
  return parseResponse(response);
}

export async function searchSongs(criterion, value) {
  const params = new URLSearchParams({ criterion, value });
  const response = await fetch(`${API_BASE}/songs?${params.toString()}`);
  return parseResponse(response);
}

// ── Cola de reproducción ──────────────────────────────────────────────────────

/** Devuelve el estado actual de la cola: { queue: Song[], queue_length: number } */
export async function getQueue() {
  const response = await fetch(`${API_BASE}/queue`);
  return parseResponse(response);
}

/** Agrega una canción al final de la cola */
export async function enqueueSong(songId) {
  const response = await fetch(`${API_BASE}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return parseResponse(response);
}

/**
 * Saca la primera canción de la cola, la registra en el historial
 * y la retorna. Devuelve null si la cola está vacía.
 */
export async function nextInQueue() {
  const response = await fetch(`${API_BASE}/queue/next`, {
    method: 'POST',
  });
  // Este endpoint puede devolver success:false si la cola está vacía,
  // en ese caso parseResponse lanza error — lo manejamos aquí
  const payload = await response.json();
  return payload.data ?? null; // null si cola vacía
}

/** Elimina una canción específica de la cola */
export async function removeFromQueue(songId) {
  const response = await fetch(`${API_BASE}/queue/${songId}`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}

/** Vacía toda la cola */
export async function clearQueue() {
  const response = await fetch(`${API_BASE}/queue`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}

// ── Historial ─────────────────────────────────────────────────────────────────

/** Devuelve las canciones escuchadas (más reciente primero) */
export async function getHistory() {
  const response = await fetch(`${API_BASE}/history`);
  return parseResponse(response);
}

/** Limpia el historial */
export async function clearHistory() {
  const response = await fetch(`${API_BASE}/history`, {
    method: 'DELETE',
  });
  return parseResponse(response);
}

// ── Reproducción ──────────────────────────────────────────────────────────────

export async function startPlayback(songId) {
  const response = await fetch(`${API_BASE}/playback/start`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return parseResponse(response);
}

export async function stopPlayback(songId) {
  const response = await fetch(`${API_BASE}/playback/stop`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return parseResponse(response);
}

// ── Playlists ─────────────────────────────────────────────────────────────────

export async function listPlaylists() {
  const response = await fetch(`${API_BASE}/playlists`);
  return parseResponse(response);
}

export async function createPlaylist(name) {
  const response = await fetch(`${API_BASE}/playlists`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  });
  return parseResponse(response);
}

export async function addSongToPlaylist(playlistId, songId) {
  const response = await fetch(`${API_BASE}/playlists/${playlistId}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });
  return parseResponse(response);
}