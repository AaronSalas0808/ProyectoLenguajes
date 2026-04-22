# SpotiCry - propuesta base

Este entregable deja una base enfocada en lo que pide la tarea:

- **Backend en Rust** con concurrencia, sockets TCP y manejo local de canciones.
- **Playlists en estilo funcional**: transformaciones inmutables con `filter`, `chain` y clonación controlada.
- **Frontend pequeño en React** para demostrar búsqueda, playlists y controles básicos de interfaz.

## Estructura
- `backend/` → servidor Rust
- `frontend/` → cliente demo React

## Alcance de esta base
Quedó resuelta la parte estructural fuerte del proyecto. Lo que faltaría para una versión más robusta es:
- streaming real de audio por chunks
- decodificación MP3
- buffer local real para adelantar y retroceder
- persistencia en disco para canciones y playlists
- puente HTTP/WebSocket para que React hable con el servidor TCP

## Idea de defensa en la documentación
Puedes justificar que:
- el **núcleo obligatorio** está en el servidor TCP concurrente en Rust
- la **parte funcional** se aplicó exclusivamente a playlists, como pide el enunciado
- el frontend en React es una **interfaz inicial** y puede integrarse formalmente mediante un gateway o con Electron/Tauri
