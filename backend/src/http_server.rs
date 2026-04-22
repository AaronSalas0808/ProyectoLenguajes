use std::{net::SocketAddr, path::Path};

use axum::{
    extract::{Path as AxumPath, Query, State},
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use tower_http::{cors::CorsLayer, services::ServeDir};
use uuid::Uuid;

use crate::{
    model::{Playlist, Song},
    protocol::SearchCriterion,
    state::AppState,
};

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

#[derive(Debug, Serialize)]
struct PlaybackStatus {
    song_id: Uuid,
    status: String,
}

pub async fn run(addr: &str, state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let app = Router::new()
        .route("/api/songs", get(list_or_search_songs))
        .route("/api/playlists", get(list_playlists).post(create_playlist))
        .route("/api/playlists/:playlist_id/songs", post(add_song_to_playlist))
        .route("/api/playback/start", post(start_playback))
        .route("/api/playback/stop", post(stop_playback))
        .nest_service("/audio", ServeDir::new("data/songs"))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr: SocketAddr = addr.parse()?;
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;
    Ok(())
}

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

async fn list_playlists(State(state): State<AppState>) -> impl IntoResponse {
    let playlists: Vec<PlaylistDto> = state.list_playlists().await.into_iter().map(Into::into).collect();
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
    match state.add_song_to_playlist(playlist_id, body.song_id).await {
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

fn parse_criterion(raw: &str) -> Result<SearchCriterion, String> {
    match raw.to_lowercase().as_str() {
        "title" | "titulo" => Ok(SearchCriterion::Title),
        "artist" | "artista" => Ok(SearchCriterion::Artist),
        "genre" | "genero" => Ok(SearchCriterion::Genre),
        _ => Err("Criterio inválido. Use: title, artist o genre".into()),
    }
}

pub fn audio_url_from_path(file_path: &str) -> String {
    let filename = Path::new(file_path)
        .file_name()
        .and_then(|name| name.to_str())
        .unwrap_or_default();
    format!("http://127.0.0.1:3000/audio/{filename}")
}
