# Backend Rust - SpotiCry

## Qué incluye
- Servidor TCP concurrente con `tokio`
- Protocolo JSON por líneas
- Búsqueda por 3 criterios: `title`, `artist`, `genre`
- Administración de canciones en memoria
- Simulación de inicio y fin de reproducción
- Playlists con operaciones funcionales e inmutables para agregar, quitar, filtrar y ordenar

## Cómo ejecutar
```bash
cargo run
```

El servidor escucha en:
```text
127.0.0.1:7878
```

## Ejemplo de solicitud
```json
{"type":"search_songs","criterion":"artist","value":"luna"}
```

## Ejemplo de respuesta
```json
{
  "success": true,
  "message": "Resultado de búsqueda",
  "data": {
    "kind": "songs",
    "songs": [
      {
        "id": "...",
        "title": "Brisa del Norte",
        "artist": "Luna Azul",
        "genre": "Indie",
        "duration_seconds": 215,
        "file_path": "./music/brisa-del-norte.mp3",
        "created_at": "2026-04-22T..."
      }
    ]
  }
}
```

## Nota importante
Para la entrega puedes explicar que el audio real puede extenderse luego con:
- lectura de bytes del archivo MP3
- streaming por chunks
- buffer local en cliente
- control de adelantar/retroceder sobre la canción actual
