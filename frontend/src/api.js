const API_BASE = 'http://127.0.0.1:3000/api';
const AUDIO_BASE = 'http://127.0.0.1:3000/audio';

async function parseResponse(response) {
  const payload = await response.json();
  if (!response.ok || payload.success === false) {
    throw new Error(payload.message || 'Ocurrió un error en el servidor');
  }
  return payload.data;
}

export function getAudioUrl(song) {
  const parts = (song.file_path || '').split('/');
  const filename = parts[parts.length - 1];
  return filename ? `${AUDIO_BASE}/${encodeURIComponent(filename)}` : '';
}

export async function listSongs() {
  const response = await fetch(`${API_BASE}/songs`);
  return parseResponse(response);
}

export async function searchSongs(criterion, value) {
  const params = new URLSearchParams({ criterion, value });
  const response = await fetch(`${API_BASE}/songs?${params.toString()}`);
  return parseResponse(response);
}

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
