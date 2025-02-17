use tauri::{
    image::Image, AppHandle, Emitter, Manager
};
use std::path::PathBuf;

use crate::{components::tray::create_tray_menu, state::WindowState};

pub fn get_icon_path(app: &AppHandle, icon_name: &str) -> PathBuf {
    app.path()
        .resource_dir()
        .expect("Failed to get resource directory")
        .join(format!("icons/tray/{}", icon_name))
}

pub fn handle_event(app: &AppHandle, event_name: &str) {
    if let Some(window) = app.get_webview_window("main") {
        eprintln!("EVENT: {}", event_name);
        let _ = window.emit(event_name, {}).map_err(|e| {
            eprintln!("Error emitting {}: {:?}", event_name, e);
        });
    }
}

pub fn toggle_window(app: &AppHandle) {
    let state = app.state::<WindowState>();
    let mut is_visible = state.is_visible.lock().unwrap();
    let tray_icon = state.tray_icon.lock().unwrap();
  
    if let Some(window) = app.get_webview_window("main") {
        let new_menu = create_tray_menu(app, !*is_visible).unwrap();
        if *is_visible {
            let _ = window.hide();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path(get_icon_path(app, "tray_icon--inactive.png")).unwrap()));
                let _ = tray.set_icon_as_template(true);
                let _ = tray.set_menu(Some(new_menu));
            }
        } else {
            let _ = window.show();
            let _ = window.set_focus();
            if let Some(ref tray) = *tray_icon {
                let _ = tray.set_icon(Some(Image::from_path(get_icon_path(app, "tray_icon--active.png")).unwrap()));
                let _ = tray.set_icon_as_template(false);
                let _ = tray.set_menu(Some(new_menu));
            }
        }
        *is_visible = !*is_visible;
    }
}