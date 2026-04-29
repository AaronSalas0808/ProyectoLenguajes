use std::collections::HashMap;

use tokio::{
    fs,
    io::{self, AsyncBufReadExt, BufReader},
};
use uuid::Uuid;

use crate::{
    model::Song,
    state::AppState,
};

pub async fn run(state: AppState) -> Result<(), Box<dyn std::error::Error>> {
    print_help();

    let stdin = BufReader::new(io::stdin());
    let mut lines = stdin.lines();

    loop {
        println!();
        println!("spoticry-server> ");

        let Some(line) = lines.next_line().await? else {
            break;
        };

        let command = line.trim();

        if command.is_empty() {
            continue;
        }

        let mut parts = command.split_whitespace();
        let action = parts.next().unwrap_or("").to_lowercase();

        match action.as_str() {
            "help" => {
                print_help();
            }

            "list" => {
                list_songs(&state).await;
            }

            "add" => {
                let Some(file_path) = parts.next() else {
                    println!("Uso correcto: add ruta/del/archivo.txt");
                    continue;
                };

                match add_song_from_txt(&state, file_path).await {
                    Ok(song) => {
                        println!("Canción agregada correctamente:");
                        println!("ID: {}", song.id);
                        println!("Título: {}", song.title);
                        println!("Artista: {}", song.artist);
                        println!("Género: {}", song.genre);
                        println!("Duración: {} segundos", song.duration_seconds);
                        println!("Archivo: {}", song.file_path);
                    }
                    Err(error) => {
                        println!("No se pudo agregar la canción: {error}");
                    }
                }
            }

            "delete" => {
                let Some(song_id_raw) = parts.next() else {
                    println!("Uso correcto: delete ID_DE_LA_CANCION");
                    continue;
                };

                match Uuid::parse_str(song_id_raw) {
                    Ok(song_id) => {
                        match state.delete_song(song_id).await {
                            Ok(()) => {
                                println!("Canción eliminada correctamente.");
                            }
                            Err(error) => {
                                println!("No se pudo eliminar la canción: {error}");
                            }
                        }
                    }
                    Err(_) => {
                        println!("ID inválido. Debe ser un UUID válido.");
                    }
                }
            }

            "exit" | "quit" => {
                println!("Cerrando consola del servidor.");
                break;
            }

            _ => {
                println!("Comando no reconocido: {action}");
                println!("Escriba help para ver los comandos disponibles.");
            }
        }
    }

    Ok(())
}

fn print_help() {
    println!();
    println!("================ CONSOLA DEL SERVIDOR SPOTICRY ================");
    println!("Comandos disponibles:");
    println!();
    println!("help");
    println!("  Muestra esta ayuda.");
    println!();
    println!("list");
    println!("  Muestra las canciones registradas en el servidor.");
    println!();
    println!("add ruta/del/archivo.txt");
    println!("  Agrega una canción leyendo sus datos desde un archivo de texto local.");
    println!();
    println!("delete ID_DE_LA_CANCION");
    println!("  Elimina una canción existente si no se encuentra en reproducción.");
    println!();
    println!("exit");
    println!("  Cierra la consola del servidor.");
    println!();
    println!("Formato del archivo .txt para agregar canción:");
    println!("title=Nombre de la canción");
    println!("artist=Nombre del artista");
    println!("genre=Género");
    println!("duration_seconds=228");
    println!("file_path=data/songs/archivo.mp3");
    println!("===============================================================");
}

async fn list_songs(state: &AppState) {
    let songs = state.list_songs().await;

    if songs.is_empty() {
        println!("No hay canciones registradas.");
        return;
    }

    println!("Canciones registradas:");

    for song in songs {
        println!("--------------------------------------------------");
        println!("ID: {}", song.id);
        println!("Título: {}", song.title);
        println!("Artista: {}", song.artist);
        println!("Género: {}", song.genre);
        println!("Duración: {} segundos", song.duration_seconds);
        println!("Archivo: {}", song.file_path);
    }

    println!("--------------------------------------------------");
}

async fn add_song_from_txt(
    state: &AppState,
    txt_path: &str,
) -> Result<Song, Box<dyn std::error::Error>> {
    let content = fs::read_to_string(txt_path).await?;

    let data = parse_song_txt(&content);

    let title = get_required(&data, "title")?;
    let artist = get_required(&data, "artist")?;
    let genre = get_required(&data, "genre")?;
    let duration_raw = get_required(&data, "duration_seconds")?;
    let file_path = get_required(&data, "file_path")?;

    let duration_seconds: u32 = duration_raw
        .parse()
        .map_err(|_| "duration_seconds debe ser un número entero válido")?;

    if duration_seconds == 0 {
        return Err("duration_seconds debe ser mayor a 0".into());
    }

    if fs::metadata(file_path).await.is_err() {
        return Err(format!("El archivo de audio no existe: {file_path}").into());
    }

    let song = Song::new(
        title.to_string(),
        artist.to_string(),
        genre.to_string(),
        duration_seconds,
        file_path.to_string(),
    );

    let saved = state.add_song(song).await;

    Ok(saved)
}

fn parse_song_txt(content: &str) -> HashMap<String, String> {
    let mut data = HashMap::new();

    for line in content.lines() {
        let trimmed = line.trim();

        if trimmed.is_empty() || trimmed.starts_with('#') {
            continue;
        }

        if let Some((key, value)) = trimmed.split_once('=') {
            data.insert(
                key.trim().to_lowercase(),
                value.trim().to_string(),
            );
        }
    }

    data
}

fn get_required<'a>(
    data: &'a HashMap<String, String>,
    key: &str,
) -> Result<&'a str, Box<dyn std::error::Error>> {
    data.get(key)
        .map(|value| value.as_str())
        .filter(|value| !value.trim().is_empty())
        .ok_or_else(|| format!("Falta el campo obligatorio: {key}").into())
}