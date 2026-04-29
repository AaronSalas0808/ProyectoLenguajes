const API_BASE = 'http://127.0.0.1:3000/api';

async function parseResponse(response) {
  const payload = await response.json();

  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Ocurrió un error en el servidor');
  }

  return payload.data;
}

export function getStreamUrl(song) {
  const parts = (song.file_path || '').split('/');
  const filename = parts[parts.length - 1];

  return filename
    ? `http://127.0.0.1:3000/audio/${encodeURIComponent(filename)}`
    : '';
}

export function getAudioUrl(song) {
  return getStreamUrl(song);
}

// Canciones

export async function listSongs() {
  const response = await fetch(`${API_BASE}/songs`);
  return parseResponse(response);
}

export async function searchSongs(criterion, value) {
  const params = new URLSearchParams({ criterion, value });
  const response = await fetch(`${API_BASE}/songs?${params.toString()}`);
  return parseResponse(response);
}

export async function addSong(song) {
  const response = await fetch(`${API_BASE}/songs`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(song),
  });

  return parseResponse(response);
}

// Cola

export async function getQueue() {
  const response = await fetch(`${API_BASE}/queue`);
  return parseResponse(response);
}

export async function enqueueSong(songId) {
  const response = await fetch(`${API_BASE}/queue`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ song_id: songId }),
  });

  return parseResponse(response);
}

export async function nextInQueue() {
  const response = await fetch(`${API_BASE}/queue/next`, {
    method: 'POST',
  });

  const payload = await response.json();
  return payload.data ?? null;
}

export async function removeFromQueue(songId) {
  const response = await fetch(`${API_BASE}/queue/${songId}`, {
    method: 'DELETE',
  });

  return parseResponse(response);
}

export async function clearQueue() {
  const response = await fetch(`${API_BASE}/queue`, {
    method: 'DELETE',
  });

  return parseResponse(response);
}

// Historial

export async function getHistory() {
  const response = await fetch(`${API_BASE}/history`);
  return parseResponse(response);
}

export async function clearHistory() {
  const response = await fetch(`${API_BASE}/history`, {
    method: 'DELETE',
  });

  return parseResponse(response);
}

// Reproducción

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

// Playlists

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