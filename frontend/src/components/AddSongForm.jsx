import React, { useState } from 'react';

export default function AddSongForm({ onAddSong }) {
  const [form, setForm] = useState({
    title: '',
    artist: '',
    genre: '',
    duration_seconds: '',
    file_path: '',
  });

  function handleChange(e) {
    const { name, value } = e.target;

    setForm((prev) => ({
      ...prev,
      [name]: value,
    }));
  }

  function handleSubmit(e) {
    e.preventDefault();

    const duration = Number(form.duration_seconds);

    if (!duration || duration <= 0) return;

    onAddSong({
      title: form.title.trim(),
      artist: form.artist.trim(),
      genre: form.genre.trim(),
      duration_seconds: duration,
      file_path: form.file_path.trim(),
    });

    setForm({
      title: '',
      artist: '',
      genre: '',
      duration_seconds: '',
      file_path: '',
    });
  }

  return (
    <form className="add-song-form" onSubmit={handleSubmit}>
      <h3>Agregar canción</h3>

      <input
        name="title"
        value={form.title}
        onChange={handleChange}
        placeholder="Título"
        required
      />

      <input
        name="artist"
        value={form.artist}
        onChange={handleChange}
        placeholder="Artista"
        required
      />

      <input
        name="genre"
        value={form.genre}
        onChange={handleChange}
        placeholder="Género"
        required
      />

      <input
        name="duration_seconds"
        type="number"
        min="1"
        value={form.duration_seconds}
        onChange={handleChange}
        placeholder="Duración en segundos"
        required
      />

      <input
        name="file_path"
        value={form.file_path}
        onChange={handleChange}
        placeholder="Nombre de la cancion"
        required
      />

      <button type="submit">+ Agregar canción</button>
    </form>
  );
}