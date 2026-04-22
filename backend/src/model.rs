use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Song {
    pub id: Uuid,
    pub title: String,
    pub artist: String,
    pub genre: String,
    pub duration_seconds: u32,
    pub file_path: String,
    pub created_at: DateTime<Utc>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Playlist {
    pub id: Uuid,
    pub name: String,
    pub song_ids: Vec<Uuid>,
    pub created_at: DateTime<Utc>,
}

impl Song {
    pub fn new(
        title: String,
        artist: String,
        genre: String,
        duration_seconds: u32,
        file_path: String,
    ) -> Self {
        Self {
            id: Uuid::new_v4(),
            title,
            artist,
            genre,
            duration_seconds,
            file_path,
            created_at: Utc::now(),
        }
    }
}

impl Playlist {
    pub fn new(name: String) -> Self {
        Self {
            id: Uuid::new_v4(),
            name,
            song_ids: Vec::new(),
            created_at: Utc::now(),
        }
    }

    pub fn add_song_functional(&self, song_id: Uuid) -> Self {
        let song_ids = if self.song_ids.contains(&song_id) {
            self.song_ids.clone()
        } else {
            self.song_ids
                .iter()
                .copied()
                .chain(std::iter::once(song_id))
                .collect()
        };

        Self {
            song_ids,
            ..self.clone()
        }
    }

    pub fn remove_song_functional(&self, song_id: Uuid) -> Self {
        let song_ids = self
            .song_ids
            .iter()
            .copied()
            .filter(|id| *id != song_id)
            .collect();

        Self {
            song_ids,
            ..self.clone()
        }
    }

    pub fn sort_song_ids_functional(&self) -> Self {
        let mut song_ids: Vec<Uuid> = self.song_ids.iter().copied().collect();
        song_ids.sort();

        Self {
            song_ids,
            ..self.clone()
        }
    }
}
