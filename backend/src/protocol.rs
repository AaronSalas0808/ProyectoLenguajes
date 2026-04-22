use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::model::{Playlist, Song};

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum Request {
    ListSongs,
    SearchSongs {
        criterion: SearchCriterion,
        value: String,
    },
    AddSong {
        title: String,
        artist: String,
        genre: String,
        duration_seconds: u32,
        file_path: String,
    },
    DeleteSong {
        song_id: Uuid,
    },
    StartPlayback {
        song_id: Uuid,
    },
    StopPlayback {
        song_id: Uuid,
    },
    CreatePlaylist {
        name: String,
    },
    ListPlaylists,
    AddSongToPlaylist {
        playlist_id: Uuid,
        song_id: Uuid,
    },
    RemoveSongFromPlaylist {
        playlist_id: Uuid,
        song_id: Uuid,
    },
    FilterPlaylistSongs {
        playlist_id: Uuid,
        criterion: SearchCriterion,
        value: String,
    },
    SortPlaylistSongs {
        playlist_id: Uuid,
    },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SearchCriterion {
    Title,
    Artist,
    Genre,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct Response {
    pub success: bool,
    pub message: String,
    pub data: Option<ResponseData>,
}

#[derive(Debug, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ResponseData {
    Songs { songs: Vec<Song> },
    Playlists { playlists: Vec<PlaylistView> },
    Song { song: Song },
    Playlist { playlist: PlaylistView },
    Playback { song_id: Uuid, status: String },
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PlaylistView {
    pub playlist: Playlist,
    pub songs: Vec<Song>,
}
