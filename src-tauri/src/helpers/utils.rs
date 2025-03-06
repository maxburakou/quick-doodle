use tauri::{
    command, image::Image, AppHandle, Emitter, Manager, State
};
use std::path::PathBuf;
use window_vibrancy::{apply_blur, apply_vibrancy, clear_blur, clear_vibrancy, NSVisualEffectMaterial, NSVisualEffectState};

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

#[command]
pub fn get_background_state(app: AppHandle) -> bool {
    let state = app.state::<WindowState>();
    let is_background_active = state.is_background_active.lock().unwrap();
    
    *is_background_active
}

#[command]
pub fn set_background_state(app: AppHandle, is_active: bool) {
    let state = app.state::<WindowState>();
    let mut is_background_active = state.is_background_active.lock().unwrap();

    *is_background_active = is_active;
}

#[command]
pub fn toggle_background_state(app: AppHandle) {
    let state = app.state::<WindowState>();
    let mut is_background_active = state.is_background_active.lock().unwrap();

    *is_background_active = !*is_background_active;
}

#[command]
pub fn activate_window_background(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();

    #[cfg(target_os = "macos")]
    apply_vibrancy(&window, NSVisualEffectMaterial::FullScreenUI, Some(NSVisualEffectState::Active), None).expect("Unsupported platform! 'apply_vibrancy' is only supported on macOS");

    #[cfg(target_os = "windows")]
    apply_blur(&window, Some((18, 18, 18, 125))).expect("Unsupported platform! 'apply_blur' is only supported on Windows");
}

#[command]
pub fn deactivate_window_background(app: AppHandle) {
    let window = app.get_webview_window("main").unwrap();

    #[cfg(target_os = "macos")]
    clear_vibrancy(&window).expect("Unsupported platform! 'clear_vibrancy' is only supported on macOS");

    #[cfg(target_os = "windows")]
    clear_blur(&window).expect("Unsupported platform! 'clear_blur' is only supported on Windows");
}

#[command]
pub fn toggle_background(app: AppHandle) {
    let state = app.state::<WindowState>();
    let mut is_background_active = state.is_background_active.lock().unwrap();

    if *is_background_active {
        deactivate_window_background(app.clone());
    } else {
        activate_window_background(app.clone());
    }

    *is_background_active = !*is_background_active;
}