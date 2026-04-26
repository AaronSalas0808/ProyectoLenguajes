use std::collections::{HashMap, HashSet, VecDeque};
use std::sync::Arc;

use tokio::sync::RwLock;
use uuid::Uuid;

use crate::{
    model::{Playlist, Song},
    protocol::{PlaylistView, SearchCriterion},
};

#[derive(Clone)]
pub struct AppState {
    inner: Arc<RwLock<Library>>,
}

#[derive(Debug, Default)]
pub struct Library {
    pub songs: HashMap<Uuid, Song>,
    pub playlists: HashMap<Uuid, Playlist>,
    pub playing_now: HashSet<Uuid>,
    // --- NUEVO: cola e historial ---
    pub play_queue: VecDeque<Uuid>,  // próximas canciones por escuchar
    pub play_history: Vec<Uuid>,     // canciones ya escuchadas
}

impl AppState {
    pub fn new() -> Self {
        let mut library = Library::default();

        let seed = vec![
            Song::new(
                "Caballero".into(),
                "Alejandro Fernandez".into(),
                "Ranchera".into(),
                228,
                "data/songs/Alejandro_Fernandez_Caballero.mp3".into(),
            ),
            Song::new(
                "Río de Cristal".into(),
                "Monteverde".into(),
                "Folk".into(),
                189,
                "data/songs/rio-de-cristal.mp3".into(),
            ),
            Song::new(
                "Voltaje".into(),
                "Código Binario".into(),
                "Rock".into(),
                242,
                "data/songs/voltaje.mp3".into(),
            ),
        ];

        seed.into_iter().for_each(|song| {
            library.songs.insert(song.id, song);
        });

        Self {
            inner: Arc::new(RwLock::new(library)),
        }
    }

    // ── Canciones ────────────────────────────────────────────────────────────

    pub async fn list_songs(&self) -> Vec<Song> {
        let library = self.inner.read().await;
        library.songs.values().cloned().collect()
    }

    pub async fn get_song(&self, song_id: Uuid) -> Option<Song> {
        let library = self.inner.read().await;
        library.songs.get(&song_id).cloned()
    }

    pub async fn search_songs(&self, criterion: SearchCriterion, value: String) -> Vec<Song> {
        let library = self.inner.read().await;
        let q = value.to_lowercase();

        library
            .songs
            .values()
            .filter(|song| match criterion {
                SearchCriterion::Title => song.title.to_lowercase().contains(&q),
                SearchCriterion::Artist => song.artist.to_lowercase().contains(&q),
                SearchCriterion::Genre => song.genre.to_lowercase().contains(&q),
            })
            .cloned()
            .collect()
    }

    pub async fn add_song(&self, song: Song) -> Song {
        let mut library = self.inner.write().await;
        library.songs.insert(song.id, song.clone());
        song
    }

    pub async fn delete_song(&self, song_id: Uuid) -> Result<(), String> {
        let mut library = self.inner.write().await;

        if library.playing_now.contains(&song_id) {
            return Err("No se puede eliminar una canción en reproducción".into());
        }

        library
            .songs
            .remove(&song_id)
            .map(|_| ())
            .ok_or_else(|| "Canción no encontrada".into())
    }

    // ── Reproducción ─────────────────────────────────────────────────────────

    pub async fn start_playback(&self, song_id: Uuid) -> Result<(), String> {
        let mut library = self.inner.write().await;
        if !library.songs.contains_key(&song_id) {
            return Err("Canción no encontrada".into());
        }
        library.playing_now.insert(song_id);
        Ok(())
    }

    pub async fn stop_playback(&self, song_id: Uuid) -> Result<(), String> {
        let mut library = self.inner.write().await;
        if library.playing_now.remove(&song_id) {
            Ok(())
        } else {
            Err("La canción no estaba en reproducción".into())
        }
    }

    // ── Cola de reproducción (NUEVO) ─────────────────────────────────────────

    /// Agrega una canción al final de la cola.
    pub async fn enqueue(&self, song_id: Uuid) -> Result<(), String> {
        let mut library = self.inner.write().await;
        if !library.songs.contains_key(&song_id) {
            return Err("Canción no encontrada".into());
        }
        // Evita duplicados en la cola
        if !library.play_queue.contains(&song_id) {
            library.play_queue.push_back(song_id);
        }
        Ok(())
    }

    /// Saca la primera canción de la cola, la registra en el historial y la retorna.
    pub async fn dequeue(&self) -> Option<Song> {
        let mut library = self.inner.write().await;
        if let Some(song_id) = library.play_queue.pop_front() {
            // Mover al historial (más reciente al final)
            library.play_history.push(song_id);
            // Marcar como en reproducción
            library.playing_now.insert(song_id);
            library.songs.get(&song_id).cloned()
        } else {
            None
        }
    }

    /// Elimina una canción específica de la cola.
    pub async fn remove_from_queue(&self, song_id: Uuid) {
        let mut library = self.inner.write().await;
        library.play_queue.retain(|id| *id != song_id);
    }

    /// Limpia toda la cola.
    pub async fn clear_queue(&self) {
        let mut library = self.inner.write().await;
        library.play_queue.clear();
    }

    /// Devuelve las canciones en cola en orden.
    pub async fn get_queue(&self) -> Vec<Song> {
        let library = self.inner.read().await;
        library
            .play_queue
            .iter()
            .filter_map(|id| library.songs.get(id).cloned())
            .collect()
    }

    // ── Historial (NUEVO) ─────────────────────────────────────────────────────

    /// Devuelve el historial de canciones escuchadas (más reciente al final).
    pub async fn get_history(&self) -> Vec<Song> {
        let library = self.inner.read().await;
        // Retornamos del más reciente al más antiguo
        library
            .play_history
            .iter()
            .rev()
            .filter_map(|id| library.songs.get(id).cloned())
            .collect()
    }

    /// Limpia el historial.
    pub async fn clear_history(&self) {
        let mut library = self.inner.write().await;
        library.play_history.clear();
    }

    // ── Playlists ─────────────────────────────────────────────────────────────

    pub async fn create_playlist(&self, name: String) -> Playlist {
        let mut library = self.inner.write().await;
        let playlist = Playlist::new(name);
        library.playlists.insert(playlist.id, playlist.clone());
        playlist
    }

    pub async fn list_playlists(&self) -> Vec<PlaylistView> {
        let library = self.inner.read().await;
        library
            .playlists
            .values()
            .cloned()
            .map(|playlist| PlaylistView {
                songs: playlist
                    .song_ids
                    .iter()
                    .filter_map(|id| library.songs.get(id).cloned())
                    .collect(),
                playlist,
            })
            .collect()
    }

    pub async fn add_song_to_playlist(
        &self,
        playlist_id: Uuid,
        song_id: Uuid,
    ) -> Result<PlaylistView, String> {
        let mut library = self.inner.write().await;
        if !library.songs.contains_key(&song_id) {
            return Err("Canción no encontrada".into());
        }
        let updated = {
            let playlist = library
                .playlists
                .get(&playlist_id)
                .ok_or_else(|| "Playlist no encontrada".to_string())?
                .clone();
            playlist.add_song_functional(song_id)
        };
        library.playlists.insert(playlist_id, updated.clone());
        let songs = updated
            .song_ids
            .iter()
            .filter_map(|id| library.songs.get(id).cloned())
            .collect();
        Ok(PlaylistView {
            playlist: updated,
            songs,
        })
    }

    pub async fn remove_song_from_playlist(
        &self,
        playlist_id: Uuid,
        song_id: Uuid,
    ) -> Result<PlaylistView, String> {
        let mut library = self.inner.write().await;
        let updated = {
            let playlist = library
                .playlists
                .get(&playlist_id)
                .ok_or_else(|| "Playlist no encontrada".to_string())?
                .clone();
            playlist.remove_song_functional(song_id)
        };
        library.playlists.insert(playlist_id, updated.clone());
        let songs = updated
            .song_ids
            .iter()
            .filter_map(|id| library.songs.get(id).cloned())
            .collect();
        Ok(PlaylistView {
            playlist: updated,
            songs,
        })
    }

    pub async fn filter_playlist_songs(
        &self,
        playlist_id: Uuid,
        criterion: SearchCriterion,
        value: String,
    ) -> Result<PlaylistView, String> {
        let library = self.inner.read().await;
        let playlist = library
            .playlists
            .get(&playlist_id)
            .ok_or_else(|| "Playlist no encontrada".to_string())?
            .clone();
        let q = value.to_lowercase();
        let songs = playlist
            .song_ids
            .iter()
            .filter_map(|id| library.songs.get(id).cloned())
            .filter(|song| match criterion {
                SearchCriterion::Title => song.title.to_lowercase().contains(&q),
                SearchCriterion::Artist => song.artist.to_lowercase().contains(&q),
                SearchCriterion::Genre => song.genre.to_lowercase().contains(&q),
            })
            .collect();

        Ok(PlaylistView { playlist, songs })
    }

    pub async fn sort_playlist_songs(
        &self,
        playlist_id: Uuid,
    ) -> Result<PlaylistView, String> {
        let mut library = self.inner.write().await;
        let updated = {
            let playlist = library
                .playlists
                .get(&playlist_id)
                .ok_or_else(|| "Playlist no encontrada".to_string())?
                .clone();
            playlist.sort_song_ids_functional()
        };
        library.playlists.insert(playlist_id, updated.clone());
        let songs = updated
            .song_ids
            .iter()
            .filter_map(|id| library.songs.get(id).cloned())
            .collect();
        Ok(PlaylistView {
            playlist: updated,
            songs,
        })
    }
}