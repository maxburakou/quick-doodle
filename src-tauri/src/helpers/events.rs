use tauri::{
    Emitter, Manager, AppHandle
};

pub fn handle_event(app: &AppHandle, event_name: &str) {
  if let Some(window) = app.get_webview_window("main") {
      eprintln!("EVENT: {}", event_name);
      let _ = window.emit(event_name, {}).map_err(|e| {
          eprintln!("Error emitting {}: {:?}", event_name, e);
      });
  }
}