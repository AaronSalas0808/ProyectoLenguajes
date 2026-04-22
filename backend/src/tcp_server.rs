use std::sync::Arc;

use tokio::{
    io::{AsyncBufReadExt, AsyncWriteExt, BufReader},
    net::{TcpListener, TcpStream},
};

use crate::{
    model::Song,
    protocol::{Request, Response, ResponseData},
    state::AppState,
};

pub async fn run(addr: &str, state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    let listener = TcpListener::bind(addr).await?;
    let state = Arc::new(state);

    loop {
        let (socket, _) = listener.accept().await?;
        let state = Arc::clone(&state);

        tokio::spawn(async move {
            if let Err(error) = handle_client(socket, state).await {
                eprintln!("Error atendiendo cliente: {error}");
            }
        });
    }
}

async fn handle_client(socket: TcpStream, state: Arc<AppState>) -> Result<(), Box<dyn std::error::Error>> {
    let (read_half, mut write_half) = socket.into_split();
    let mut lines = BufReader::new(read_half).lines();

    while let Some(line) = lines.next_line().await? {
        let response = match serde_json::from_str::<Request>(&line) {
            Ok(request) => process_request(request, &state).await,
            Err(error) => Response {
                success: false,
                message: format!("Solicitud inválida: {error}"),
                data: None,
            },
        };

        let json = serde_json::to_string(&response)?;
        write_half.write_all(json.as_bytes()).await?;
        write_half.write_all(b"\n").await?;
    }

    Ok(())
}

async fn process_request(request: Request, state: &AppState) -> Response {
    match request {
        Request::ListSongs => Response {
            success: true,
            message: "Listado de canciones".into(),
            data: Some(ResponseData::Songs {
                songs: state.list_songs().await,
            }),
        },
        Request::SearchSongs { criterion, value } => Response {
            success: true,
            message: "Resultado de búsqueda".into(),
            data: Some(ResponseData::Songs {
                songs: state.search_songs(criterion, value).await,
            }),
        },
        Request::AddSong {
            title,
            artist,
            genre,
            duration_seconds,
            file_path,
        } => {
            let song = Song::new(title, artist, genre, duration_seconds, file_path);
            let song = state.add_song(song).await;
            Response {
                success: true,
                message: "Canción agregada".into(),
                data: Some(ResponseData::Song { song }),
            }
        }
        Request::DeleteSong { song_id } => match state.delete_song(song_id).await {
            Ok(()) => Response {
                success: true,
                message: "Canción eliminada".into(),
                data: None,
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::StartPlayback { song_id } => match state.start_playback(song_id).await {
            Ok(()) => Response {
                success: true,
                message: "Reproducción iniciada".into(),
                data: Some(ResponseData::Playback {
                    song_id,
                    status: "playing".into(),
                }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::StopPlayback { song_id } => match state.stop_playback(song_id).await {
            Ok(()) => Response {
                success: true,
                message: "Reproducción detenida".into(),
                data: Some(ResponseData::Playback {
                    song_id,
                    status: "stopped".into(),
                }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::CreatePlaylist { name } => {
            let playlist = state.create_playlist(name).await;
            Response {
                success: true,
                message: "Playlist creada".into(),
                data: Some(ResponseData::Playlist {
                    playlist: crate::protocol::PlaylistView {
                        playlist,
                        songs: vec![],
                    },
                }),
            }
        }
        Request::ListPlaylists => Response {
            success: true,
            message: "Listado de playlists".into(),
            data: Some(ResponseData::Playlists {
                playlists: state.list_playlists().await,
            }),
        },
        Request::AddSongToPlaylist {
            playlist_id,
            song_id,
        } => match state.add_song_to_playlist(playlist_id, song_id).await {
            Ok(playlist) => Response {
                success: true,
                message: "Canción agregada a la playlist".into(),
                data: Some(ResponseData::Playlist { playlist }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::RemoveSongFromPlaylist {
            playlist_id,
            song_id,
        } => match state.remove_song_from_playlist(playlist_id, song_id).await {
            Ok(playlist) => Response {
                success: true,
                message: "Canción eliminada de la playlist".into(),
                data: Some(ResponseData::Playlist { playlist }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::FilterPlaylistSongs {
            playlist_id,
            criterion,
            value,
        } => match state.filter_playlist_songs(playlist_id, criterion, value).await {
            Ok(playlist) => Response {
                success: true,
                message: "Playlist filtrada".into(),
                data: Some(ResponseData::Playlist { playlist }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
        Request::SortPlaylistSongs { playlist_id } => match state.sort_playlist_songs(playlist_id).await {
            Ok(playlist) => Response {
                success: true,
                message: "Playlist ordenada".into(),
                data: Some(ResponseData::Playlist { playlist }),
            },
            Err(message) => Response {
                success: false,
                message,
                data: None,
            },
        },
    }
}
