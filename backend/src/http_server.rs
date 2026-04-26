use std::{io::SeekFrom, net::SocketAddr, path::Path};

use axum::{
    extract::{Path as AxumPath, Query, State},
    http::{HeaderMap, StatusCode},
    response::{IntoResponse, Response},
    routing::{delete, get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tokio::io::{AsyncReadExt, AsyncSeekExt};
use tower_http::{cors::CorsLayer, services::ServeDir};
use uuid::Uuid;

use crate::{
    model::{Playlist, Song},
    protocol::SearchCriterion,
    state::AppState,
};

// ── DTOs ─────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
pub struct ApiResponse<T> {
    pub success: bool,
    pub message: String,
    pub data: T,
}

#[derive(Debug, Serialize, Clone)]
pub struct PlaylistDto {
    pub id: Uuid,
    pub name: String,
    pub songs: Vec<Song>,
    pub created_at: chrono::DateTime<chrono::Utc>,
}

impl From<crate::protocol::PlaylistView> for PlaylistDto {
    fn from(value: crate::protocol::PlaylistView) -> Self {
        Self {
            id: value.playlist.id,
            name: value.playlist.name,
            songs: value.songs,
            created_at: value.playlist.created_at,
        }
    }
}

// ── Bodies de request ─────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
struct SongsQuery {
    criterion: Option<String>,
    value: Option<String>,
}

#[derive(Debug, Deserialize)]
struct CreatePlaylistBody {
    name: String,
}

#[derive(Debug, Deserialize)]
struct AddSongToPlaylistBody {
    song_id: Uuid,
}

#[derive(Debug, Deserialize)]
struct PlaybackBody {
    song_id: Uuid,
}

#[derive(Debug, Deserialize)]
struct EnqueueBody {
    song_id: Uuid,
}

// ── Respuestas auxiliares ─────────────────────────────────────────────────────

#[derive(Debug, Serialize)]
struct PlaybackStatus {
    song_id: Uuid,
    status: String,
}

#[derive(Debug, Serialize)]
struct QueueStatus {
    queue: Vec<Song>,
    queue_length: usize,
}

// ── Servidor ──────────────────────────────────────────────────────────────────

pub async fn run(addr: &str, state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        // Canciones
        .route("/api/songs", get(list_or_search_songs))
        // Streaming de audio (simula descarga desde nube con buffer por chunks)
        .route("/api/stream/:song_id", get(stream_song))
        // Cola de reproducción
        .route("/api/queue", get(get_queue).post(enqueue_song).delete(clear_queue))
        .route("/api/queue/next", post(next_in_queue))
        .route("/api/queue/:song_id", delete(remove_from_queue))
        // Historial
        .route("/api/history", get(get_history).delete(clear_history))
        // Playlists
        .route("/api/playlists", get(list_playlists).post(create_playlist))
        .route("/api/playlists/:playlist_id/songs", post(add_song_to_playlist))
        // Reproducción (registro en servidor)
        .route("/api/playback/start", post(start_playback))
        .route("/api/playback/stop", post(stop_playback))
        // Archivos de audio directos (fallback)
        .nest_service("/audio", ServeDir::new("data/songs"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = addr.parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

// ── Handlers: Canciones ───────────────────────────────────────────────────────

async fn list_or_search_songs(
    State(state): State<AppState>,
    Query(query): Query<SongsQuery>,
) -> impl IntoResponse {
    let songs = match (query.criterion.as_deref(), query.value.as_deref()) {
        (Some(criterion), Some(value)) if !value.trim().is_empty() => {
            let criterion = match parse_criterion(criterion) {
                Ok(c) => c,
                Err(message) => {
                    return (
                        StatusCode::BAD_REQUEST,
                        Json(ApiResponse {
                            success: false,
                            message,
                            data: Vec::<Song>::new(),
                        }),
                    )
                        .into_response()
                }
            };
            state.search_songs(criterion, value.to_string()).await
        }
        _ => state.list_songs().await,
    };

    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            message: "Listado de canciones".into(),
            data: songs,
        }),
    )
        .into_response()
}

// ── Handler: Streaming por chunks (simula nube) ───────────────────────────────
//
// El navegador envía un header "Range: bytes=START-END" automáticamente
// conforme el <audio> necesita más datos. Este endpoint responde con el
// fragmento solicitado (HTTP 206 Partial Content), simulando cómo una
// plataforma de streaming sirve audio desde la nube sin enviar el archivo
// completo de una vez.

async fn stream_song(
    State(state): State<AppState>,
    AxumPath(song_id): AxumPath<Uuid>,
    headers: HeaderMap,
) -> Response {
    // 1. Buscar canción
    let song = match state.get_song(song_id).await {
        Some(s) => s,
        None => {
            return (StatusCode::NOT_FOUND, "Canción no encontrada")
                .into_response()
        }
    };

    let file_path = &song.file_path;

    // 2. Obtener tamaño del archivo
    let metadata = match tokio::fs::metadata(file_path).await {
        Ok(m) => m,
        Err(_) => {
            return (
                StatusCode::NOT_FOUND,
                format!("Archivo no encontrado: {file_path}"),
            )
                .into_response()
        }
    };

    let file_size = metadata.len();
    if file_size == 0 {
        return (StatusCode::NO_CONTENT, "Archivo vacío").into_response();
    }

    // 3. Parsear el header Range enviado por el navegador
    //    Formato: "bytes=0-" o "bytes=0-1023" o "bytes=512-1023"
    let (start, end) = parse_range_header(&headers, file_size);
    let content_length = end - start + 1;

    // 4. Abrir el archivo y moverse al offset correcto (seek)
    let mut file = match tokio::fs::File::open(file_path).await {
        Ok(f) => f,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                format!("Error abriendo archivo: {e}"),
            )
                .into_response()
        }
    };

    if let Err(e) = file.seek(SeekFrom::Start(start)).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error buscando posición: {e}"),
        )
            .into_response();
    }

    // 5. Leer exactamente los bytes solicitados (el "chunk" del buffer)
    let mut buffer = vec![0u8; content_length as usize];
    if let Err(e) = file.read_exact(&mut buffer).await {
        return (
            StatusCode::INTERNAL_SERVER_ERROR,
            format!("Error leyendo datos: {e}"),
        )
            .into_response();
    }

    // 6. Detectar tipo MIME por extensión
    let mime = detect_mime(file_path);

    // 7. Responder con 206 Partial Content si es rango parcial, 200 si es todo
    let status = if start == 0 && end == file_size - 1 {
        StatusCode::OK
    } else {
        StatusCode::PARTIAL_CONTENT
    };

    Response::builder()
        .status(status)
        .header("Content-Type", mime)
        .header("Content-Length", content_length.to_string())
        .header(
            "Content-Range",
            format!("bytes {start}-{end}/{file_size}"),
        )
        .header("Accept-Ranges", "bytes")
        // Permite que el frontend acceda desde cualquier origen
        .header("Access-Control-Allow-Origin", "*")
        .header("Access-Control-Expose-Headers", "Content-Range, Accept-Ranges")
        .body(axum::body::Body::from(buffer))
        .unwrap_or_else(|_| StatusCode::INTERNAL_SERVER_ERROR.into_response())
}

/// Parsea el header Range y devuelve (start, end) en bytes.
/// Si el rango es abierto ("bytes=0-"), limita el chunk a 512 KB
/// para simular el buffer progresivo de un servicio de streaming.
fn parse_range_header(headers: &HeaderMap, file_size: u64) -> (u64, u64) {
    const CHUNK_SIZE: u64 = 512 * 1024; // 512 KB por chunk

    let range_str = headers
        .get("range")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");

    if let Some(stripped) = range_str.strip_prefix("bytes=") {
        let parts: Vec<&str> = stripped.splitn(2, '-').collect();
        if parts.len() == 2 {
            let start = parts[0].parse::<u64>().unwrap_or(0);

            let end = if parts[1].is_empty() {
                // Rango abierto → servir hasta CHUNK_SIZE bytes
                (start + CHUNK_SIZE - 1).min(file_size - 1)
            } else {
                parts[1].parse::<u64>().unwrap_or(file_size - 1).min(file_size - 1)
            };

            return (start.min(file_size - 1), end);
        }
    }

    // Sin header Range → servir primer chunk
    (0, CHUNK_SIZE.min(file_size) - 1)
}

fn detect_mime(path: &str) -> &'static str {
    match Path::new(path)
        .extension()
        .and_then(|e| e.to_str())
        .unwrap_or("")
        .to_lowercase()
        .as_str()
    {
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "flac" => "audio/flac",
        "aac" => "audio/aac",
        "m4a" => "audio/mp4",
        _ => "application/octet-stream",
    }
}

// ── Handlers: Cola de reproducción ───────────────────────────────────────────

/// GET /api/queue — devuelve las canciones en cola en orden
async fn get_queue(State(state): State<AppState>) -> impl IntoResponse {
    let queue = state.get_queue().await;
    let len = queue.len();
    Json(ApiResponse {
        success: true,
        message: format!("{len} canción(es) en cola"),
        data: QueueStatus {
            queue_length: len,
            queue,
        },
    })
}

/// POST /api/queue — agrega una canción al final de la cola
async fn enqueue_song(
    State(state): State<AppState>,
    Json(body): Json<EnqueueBody>,
) -> impl IntoResponse {
    match state.enqueue(body.song_id).await {
        Ok(()) => {
            let queue = state.get_queue().await;
            let len = queue.len();
            (
                StatusCode::OK,
                Json(ApiResponse {
                    success: true,
                    message: "Canción agregada a la cola".into(),
                    data: QueueStatus {
                        queue_length: len,
                        queue,
                    },
                }),
            )
                .into_response()
        }
        Err(message) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                message,
                data: QueueStatus {
                    queue: vec![],
                    queue_length: 0,
                },
            }),
        )
            .into_response(),
    }
}

/// POST /api/queue/next — saca la próxima canción de la cola y la retorna
async fn next_in_queue(State(state): State<AppState>) -> impl IntoResponse {
    match state.dequeue().await {
        Some(song) => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: format!("Reproduciendo: {}", song.title),
                data: Some(song),
            }),
        )
            .into_response(),
        None => (
            StatusCode::OK,
            Json(ApiResponse {
                success: false,
                message: "La cola está vacía".into(),
                data: Option::<Song>::None,
            }),
        )
            .into_response(),
    }
}

/// DELETE /api/queue/:song_id — elimina una canción específica de la cola
async fn remove_from_queue(
    State(state): State<AppState>,
    AxumPath(song_id): AxumPath<Uuid>,
) -> impl IntoResponse {
    state.remove_from_queue(song_id).await;
    let queue = state.get_queue().await;
    let len = queue.len();
    Json(ApiResponse {
        success: true,
        message: "Canción eliminada de la cola".into(),
        data: QueueStatus {
            queue_length: len,
            queue,
        },
    })
}

/// DELETE /api/queue — vacía toda la cola
async fn clear_queue(State(state): State<AppState>) -> impl IntoResponse {
    state.clear_queue().await;
    Json(ApiResponse {
        success: true,
        message: "Cola vaciada".into(),
        data: QueueStatus {
            queue: vec![],
            queue_length: 0,
        },
    })
}

// ── Handlers: Historial ───────────────────────────────────────────────────────

/// GET /api/history — devuelve historial (más reciente primero)
async fn get_history(State(state): State<AppState>) -> impl IntoResponse {
    let history = state.get_history().await;
    let len = history.len();
    Json(ApiResponse {
        success: true,
        message: format!("{len} canción(es) en historial"),
        data: history,
    })
}

/// DELETE /api/history — limpia el historial
async fn clear_history(State(state): State<AppState>) -> impl IntoResponse {
    state.clear_history().await;
    Json(ApiResponse {
        success: true,
        message: "Historial limpiado".into(),
        data: Vec::<Song>::new(),
    })
}

// ── Handlers: Reproducción ────────────────────────────────────────────────────

async fn start_playback(
    State(state): State<AppState>,
    Json(body): Json<PlaybackBody>,
) -> impl IntoResponse {
    match state.start_playback(body.song_id).await {
        Ok(()) => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Reproducción iniciada".into(),
                data: PlaybackStatus {
                    song_id: body.song_id,
                    status: "playing".into(),
                },
            }),
        )
            .into_response(),
        Err(message) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                message,
                data: serde_json::json!(null),
            }),
        )
            .into_response(),
    }
}

async fn stop_playback(
    State(state): State<AppState>,
    Json(body): Json<PlaybackBody>,
) -> impl IntoResponse {
    match state.stop_playback(body.song_id).await {
        Ok(()) => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Reproducción detenida".into(),
                data: PlaybackStatus {
                    song_id: body.song_id,
                    status: "stopped".into(),
                },
            }),
        )
            .into_response(),
        Err(message) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                message,
                data: serde_json::json!(null),
            }),
        )
            .into_response(),
    }
}

// ── Handlers: Playlists ───────────────────────────────────────────────────────

async fn list_playlists(State(state): State<AppState>) -> impl IntoResponse {
    let playlists: Vec<PlaylistDto> = state
        .list_playlists()
        .await
        .into_iter()
        .map(Into::into)
        .collect();
    (
        StatusCode::OK,
        Json(ApiResponse {
            success: true,
            message: "Listado de playlists".into(),
            data: playlists,
        }),
    )
}

async fn create_playlist(
    State(state): State<AppState>,
    Json(body): Json<CreatePlaylistBody>,
) -> impl IntoResponse {
    let playlist: Playlist = state.create_playlist(body.name).await;
    let dto = PlaylistDto {
        id: playlist.id,
        name: playlist.name,
        songs: vec![],
        created_at: playlist.created_at,
    };

    (
        StatusCode::CREATED,
        Json(ApiResponse {
            success: true,
            message: "Playlist creada".into(),
            data: dto,
        }),
    )
}

async fn add_song_to_playlist(
    State(state): State<AppState>,
    AxumPath(playlist_id): AxumPath<Uuid>,
    Json(body): Json<AddSongToPlaylistBody>,
) -> impl IntoResponse {
    match state
        .add_song_to_playlist(playlist_id, body.song_id)
        .await
    {
        Ok(playlist) => (
            StatusCode::OK,
            Json(ApiResponse {
                success: true,
                message: "Canción agregada a la playlist".into(),
                data: PlaylistDto::from(playlist),
            }),
        )
            .into_response(),
        Err(message) => (
            StatusCode::BAD_REQUEST,
            Json(ApiResponse {
                success: false,
                message,
                data: serde_json::json!(null),
            }),
        )
            .into_response(),
    }
}

// ── Utilidades ────────────────────────────────────────────────────────────────

fn parse_criterion(raw: &str) -> Result<SearchCriterion, String> {
    match raw.to_lowercase().as_str() {
        "title" | "titulo" => Ok(SearchCriterion::Title),
        "artist" | "artista" => Ok(SearchCriterion::Artist),
        "genre" | "genero" => Ok(SearchCriterion::Genre),
        _ => Err("Criterio inválido. Use: title, artist o genre".into()),
    }
}