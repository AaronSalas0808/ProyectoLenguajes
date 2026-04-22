# Frontend React - SpotiCry

## Cómo ejecutar
```bash
npm install
npm run dev
```

## Qué hace
- Busca canciones por título, artista o género
- Crea playlists
- Agrega canciones a una playlist
- Simula controles básicos de reproducción en la interfaz

## Nota técnica
Un navegador no se conecta directo por TCP puro al backend de Rust como lo haría un cliente de escritorio.
Para una integración real tienes dos rutas razonables:
1. agregar un pequeño gateway HTTP/WebSocket delante del servidor TCP
2. convertir el cliente en Electron o Tauri para abrir sockets TCP directamente

Para una entrega académica, este frontend sirve como maqueta funcional del cliente y deja lista la UI.
