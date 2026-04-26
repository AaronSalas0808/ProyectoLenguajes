import React from 'react';
const CRITERIA = [
  { value: 'title', label: 'Título' },
  { value: 'artist', label: 'Artista' },
  { value: 'genre', label: 'Género' },
];

export default function SearchBar({
  criterion,
  query,
  onCriterionChange,
  onQueryChange,
  onSearch,
  onReload,
}) {
  return (
    <div className="search-row">
      <select value={criterion} onChange={(e) => onCriterionChange(e.target.value)}>
        {CRITERIA.map((c) => (
          <option key={c.value} value={c.value}>
            {c.label}
          </option>
        ))}
      </select>

      <input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && onSearch()}
        placeholder="Buscar canción, artista o género..."
      />

      <button onClick={onSearch}>Buscar</button>
      <button className="secondary icon-btn" onClick={onReload}>↺</button>
    </div>
  );
}