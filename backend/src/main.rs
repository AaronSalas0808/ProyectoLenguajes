mod http_server;
mod model;
mod protocol;
mod state;
mod tcp_server;
mod server_console;

use state::AppState;

#[tokio::main]
async fn main() {
    let state = AppState::new();

    println!("SpotiCry TCP escuchando en 127.0.0.1:7878");
    println!("SpotiCry HTTP escuchando en 127.0.0.1:3000");
    println!("Coloque sus mp3 en backend/data/songs/");
    println!("Consola del servidor activa. Escriba help para ver comandos.");

    let tcp_state = state.clone();
    let http_state = state.clone();
    let console_state = state.clone();

    let tcp_task = tokio::spawn(async move {
        if let Err(error) = tcp_server::run("127.0.0.1:7878", tcp_state).await {
            eprintln!("Error del servidor TCP: {error}");
        }
    });

    let http_task = tokio::spawn(async move {
        if let Err(error) = http_server::run("127.0.0.1:3000", http_state).await {
            eprintln!("Error del servidor HTTP: {error}");
        }
    });

    let console_task = tokio::spawn(async move {
        if let Err(error) = server_console::run(console_state).await {
            eprintln!("Error en consola del servidor: {error}");
        }
    });

    let _ = tokio::join!(tcp_task, http_task, console_task);
}